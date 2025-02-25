import { StockItem } from '../types';

export interface StockPriorityScore {
  stock: StockItem;
  score: number;
  isGoodQuality: boolean;
}

export class StockPrioritizer {
  // Quality rankings from lowest to highest priority
  private static QUALITY_RANKINGS = {
    'Good': 1,      // Reserve for spot sales
    'Good Q/S': 2,  // Reserve for spot sales
    'Fair': 3,      // Use for regular orders
    'Fair M/C': 4,  // Prioritize for regular orders
    'Poor': 5,      // Highest priority to use
    'Poor M/C': 6   // Highest priority to use
  };

  /**
   * Determines if a quality level is considered "good"
   */
  static isGoodQuality(quality: string): boolean {
    return quality === 'Good' || quality === 'Good Q/S';
  }

  /**
   * Calculates priority score for a stock item
   * Higher score = higher priority for allocation
   */
  static getPriorityScore(stock: StockItem): StockPriorityScore {
    const quality = stock['Q3: Reinspection Quality'] || 'Unknown';
    const age = stock['Real Stock Age'] || 0;
    
    // Base score from quality ranking
    let score = this.QUALITY_RANKINGS[quality as keyof typeof this.QUALITY_RANKINGS] || 0;
    
    // Add age factor (older stock gets higher priority)
    score += Math.min(age / 10, 10); // Cap age bonus at 10 points
    
    return {
      stock,
      score,
      isGoodQuality: this.isGoodQuality(quality)
    };
  }

  /**
   * Sorts stock items by priority for allocation
   * @param stock List of stock items to sort
   * @param forSpotSale Whether this is for a spot sale order
   * @returns Sorted list of stock items
   */
  static prioritizeStock(stock: StockItem[], forSpotSale: boolean): StockItem[] {
    // Calculate priority scores
    const scoredStock = stock.map(item => this.getPriorityScore(item));

    // For spot sales, prioritize good quality stock
    if (forSpotSale) {
      // Sort good quality stock by age (FIFO)
      const goodQuality = scoredStock
        .filter(item => item.isGoodQuality)
        .sort((a, b) => b.stock['Real Stock Age'] - a.stock['Real Stock Age'])
        .map(item => item.stock);

      // Then add other stock as backup
      const otherQuality = scoredStock
        .filter(item => !item.isGoodQuality)
        .sort((a, b) => b.score - a.score)
        .map(item => item.stock);

      return [...goodQuality, ...otherQuality];
    }

    // For regular orders, prioritize poor/fair quality and older stock
    return scoredStock
      .sort((a, b) => {
        // If one is good quality and the other isn't, prioritize non-good quality
        if (a.isGoodQuality !== b.isGoodQuality) {
          return a.isGoodQuality ? 1 : -1;
        }
        
        // Otherwise sort by score (higher score first)
        return b.score - a.score;
      })
      .map(item => item.stock);
  }

  /**
   * Finds the best stock batch for an order
   * @param stock Available stock items
   * @param targetQuantity Required quantity (including buffer)
   * @param forSpotSale Whether this is for a spot sale
   * @returns Best matching stock item or null if none found
   */
  static findBestMatch(
    stock: StockItem[],
    targetQuantity: number,
    forSpotSale: boolean
  ): StockItem | null {
    const prioritizedStock = this.prioritizeStock(stock, forSpotSale);
    
    // First try to find a batch that closely matches the target quantity
    const perfectMatch = prioritizedStock.find(item => {
      const weight = parseFloat(String(item['Stock Weight']).replace(' KG', ''));
      // Allow 5% tolerance for "perfect" match
      return Math.abs(weight - targetQuantity) / targetQuantity <= 0.05;
    });
    
    if (perfectMatch) return perfectMatch;

    // Otherwise return the highest priority batch that can fulfill the order
    return prioritizedStock.find(item => {
      const weight = parseFloat(String(item['Stock Weight']).replace(' KG', ''));
      return weight >= targetQuantity;
    }) || null;
  }

  /**
   * Gets available stock batches sorted by priority
   * @param stock All stock items
   * @param minQuantity Minimum required quantity
   * @param forSpotSale Whether this is for a spot sale
   * @returns List of valid stock items
   */
  static getAvailableStock(
    stock: StockItem[],
    minQuantity: number,
    forSpotSale: boolean
  ): StockItem[] {
    // Filter out batches that are too small
    const validStock = stock.filter(item => {
      const weight = parseFloat(String(item['Stock Weight']).replace(' KG', ''));
      return weight >= minQuantity;
    });

    // Sort by priority
    return this.prioritizeStock(validStock, forSpotSale);
  }
}