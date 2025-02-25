import { StockItem, OrderItem, AllocationResult } from '../types';
import { StockPrioritizer } from './StockPrioritizer';

export class SpotSaleAllocator {
  /**
   * Allocates stock for spot sale orders
   * - Only allocates full pallets
   * - No 10% buffer rule
   * - Tries to match requested quantity exactly
   */
  static allocateSpotSale(
    stock: StockItem[],
    order: OrderItem,
    isOrganic: (item: StockItem) => boolean
  ): {
    allocations: AllocationResult[];
    remainingQuantity: number;
  } {
    // Validate order is spot sale
    if (!this.isSpotSale(order)) {
      throw new Error('Not a spot sale order');
    }

    const requiredQuantity = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, ''));
    let remainingQuantity = requiredQuantity;

    // Get available unallocated stock matching order type
    const availableStock = stock.filter(item => {
      // Must match organic/conventional
      if (isOrganic(item) !== order.isOrganic) return false;
      
      // Must not be allocated
      if (item.customer) return false;
      
      return true;
    });

    // Prioritize stock based on quality and age
    const prioritizedStock = StockPrioritizer.prioritizeStock(availableStock, true);

    // Try to find exact matches first
    const allocations: AllocationResult[] = [];
    const tolerance = 0.05; // 5% tolerance for "exact" match

    for (const item of prioritizedStock) {
      if (remainingQuantity <= 0) break;

      const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', ''));
      
      // Check if this batch is a good match for remaining quantity
      const matchPercentage = Math.abs(stockWeight - remainingQuantity) / remainingQuantity;
      
      if (matchPercentage <= tolerance) {
        // Perfect match - allocate entire batch
        allocations.push({
          ...item,
          originalRow: stock.indexOf(item) + 2,
          customer: order.SoldToParty,
          allocatedQuantity: stockWeight,
          allocationDetails: {
            orderNumber: order.Order || '',
            salesDocument: order['Sales document'],
            requiredQuantity,
            allocatedQuantity: stockWeight,
            isPartial: false,
            isSpotSale: true
          }
        });
        remainingQuantity -= stockWeight;
        break;
      }
    }

    // If no exact matches, try to find closest full pallet
    if (remainingQuantity > 0) {
      // Sort by size (closest to remaining quantity first)
      const sortedBySize = [...prioritizedStock]
        .filter(item => !allocations.some(a => a['Batch Number'] === item['Batch Number']))
        .sort((a, b) => {
          const weightA = parseFloat(String(a['Stock Weight']).replace(' KG', ''));
          const weightB = parseFloat(String(b['Stock Weight']).replace(' KG', ''));
          return Math.abs(weightA - remainingQuantity) - Math.abs(weightB - remainingQuantity);
        });

      // Allocate closest matching pallet
      const bestMatch = sortedBySize[0];
      if (bestMatch) {
        const stockWeight = parseFloat(String(bestMatch['Stock Weight']).replace(' KG', ''));
        allocations.push({
          ...bestMatch,
          originalRow: stock.indexOf(bestMatch) + 2,
          customer: order.SoldToParty,
          allocatedQuantity: stockWeight,
          allocationDetails: {
            orderNumber: order.Order || '',
            salesDocument: order['Sales document'],
            requiredQuantity,
            allocatedQuantity: stockWeight,
            isPartial: false,
            isSpotSale: true
          }
        });
        remainingQuantity = Math.max(0, remainingQuantity - stockWeight);
      }
    }

    return {
      allocations,
      remainingQuantity
    };
  }

  /**
   * Determines if an order is a spot sale based on material code
   */
  static isSpotSale(order: OrderItem): boolean {
    const material = order.Material?.toLowerCase() || '';
    return material.startsWith('bcb') || material.startsWith('bob');
  }

  /**
   * Gets available stock suitable for spot sales
   */
  static getSpotSaleStock(stock: StockItem[]): StockItem[] {
    return StockPrioritizer.prioritizeStock(stock, true);
  }
}