import { Customer, StockItem, CustomerRestrictions } from '../types';

export interface RestrictionGroup {
  restrictions: CustomerRestrictions;
  customers: Customer[];
  totalKilos: number;
}

export class RestrictionGrouper {
  /**
   * Groups customers by shared restrictions
   */
  static groupByRestrictions(customers: Customer[]): RestrictionGroup[] {
    const groups: RestrictionGroup[] = [];

    // Process each customer
    customers.forEach(customer => {
      // Find matching group
      const matchingGroup = groups.find(group => 
        this.restrictionsMatch(group.restrictions, customer.restrictions)
      );

      if (matchingGroup) {
        matchingGroup.customers.push(customer);
      } else {
        // Create new group
        groups.push({
          restrictions: { ...customer.restrictions },
          customers: [customer],
          totalKilos: 0
        });
      }
    });

    return groups;
  }

  /**
   * Checks if two sets of restrictions match
   */
  private static restrictionsMatch(
    restrictions1: CustomerRestrictions,
    restrictions2: CustomerRestrictions
  ): boolean {
    const fields = [
      'Origin Country',
      'Variety',
      'GGN',
      'Q3: Reinspection Quality',
      'BL/AWB/CMR',
      'MinimumSize',
      'Origin Pallet Number',
      'Supplier'
    ] as const;

    return fields.every(field => 
      restrictions1[field] === restrictions2[field]
    );
  }

  /**
   * Filters stock based on customer restrictions
   */
  static filterStockByRestrictions(
    stock: StockItem[],
    restrictions: CustomerRestrictions
  ): StockItem[] {
    return stock.filter(item => {
      // Check each restriction
      return Object.entries(restrictions).every(([field, value]) => {
        if (!value) return true; // Skip if no restriction
        return item[field as keyof StockItem] === value;
      });
    });
  }

  /**
   * Gets available stock for a restriction group
   */
  static getAvailableStock(
    stock: StockItem[],
    group: RestrictionGroup
  ): StockItem[] {
    return this.filterStockByRestrictions(stock, group.restrictions);
  }

  /**
   * Validates if a stock item meets customer restrictions
   */
  static validateStockRestrictions(
    stock: StockItem,
    restrictions: CustomerRestrictions
  ): boolean {
    return Object.entries(restrictions).every(([field, value]) => {
      if (!value) return true; // Skip if no restriction
      return stock[field as keyof StockItem] === value;
    });
  }

  /**
   * Gets restriction validation errors if any
   */
  static getValidationErrors(
    stock: StockItem,
    restrictions: CustomerRestrictions
  ): string[] {
    const errors: string[] = [];

    Object.entries(restrictions).forEach(([field, value]) => {
      if (!value) return; // Skip if no restriction
      
      const stockValue = stock[field as keyof StockItem];
      if (stockValue !== value) {
        errors.push(`${field} mismatch: expected ${value}, got ${stockValue}`);
      }
    });

    return errors;
  }
}