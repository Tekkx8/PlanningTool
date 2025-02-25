import { OrderItem } from '../types';

export interface CustomerOrderGroup {
  customer: string;
  conventional: {
    orders: OrderItem[];
    totalKilos: number;
  };
  organic: {
    orders: OrderItem[];
    totalKilos: number;
  };
  totalKilos: number;
}

export class OrderGrouper {
  /**
   * Groups orders by customer and type (conventional/organic)
   * @param orders List of orders to group
   * @returns Map of customer name to their order groups
   */
  static groupOrdersByCustomer(orders: OrderItem[]): Map<string, CustomerOrderGroup> {
    const customerGroups = new Map<string, CustomerOrderGroup>();

    // Process each order
    orders.forEach(order => {
      const customer = order.SoldToParty;
      const isOrganic = order.isOrganic;
      const kilos = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, ''));

      // Get or create customer group
      if (!customerGroups.has(customer)) {
        customerGroups.set(customer, {
          customer,
          conventional: {
            orders: [],
            totalKilos: 0
          },
          organic: {
            orders: [],
            totalKilos: 0
          },
          totalKilos: 0
        });
      }

      const group = customerGroups.get(customer)!;

      // Add order to appropriate type group
      if (isOrganic) {
        group.organic.orders.push(order);
        group.organic.totalKilos += kilos;
      } else {
        group.conventional.orders.push(order);
        group.conventional.totalKilos += kilos;
      }

      // Update total kilos
      group.totalKilos += kilos;
    });

    // Sort orders within each group by loading date
    for (const group of customerGroups.values()) {
      group.conventional.orders.sort((a, b) => 
        new Date(a['Loading Date']).getTime() - new Date(b['Loading Date']).getTime()
      );
      group.organic.orders.sort((a, b) => 
        new Date(a['Loading Date']).getTime() - new Date(b['Loading Date']).getTime()
      );
    }

    return customerGroups;
  }

  /**
   * Gets total kilos needed for each type
   */
  static getTotalsByType(orders: OrderItem[]): {
    conventional: number;
    organic: number;
    total: number;
  } {
    return orders.reduce((acc, order) => {
      const kilos = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, ''));
      if (order.isOrganic) {
        acc.organic += kilos;
      } else {
        acc.conventional += kilos;
      }
      acc.total += kilos;
      return acc;
    }, {
      conventional: 0,
      organic: 0,
      total: 0
    });
  }

  /**
   * Gets priority score for a customer group
   * Higher score = higher priority for allocation
   */
  static getCustomerPriority(group: CustomerOrderGroup): number {
    let score = 0;

    // More total kilos = higher priority
    score += Math.log10(group.totalKilos);

    // Having both types of orders increases priority
    if (group.conventional.orders.length > 0 && group.organic.orders.length > 0) {
      score += 2;
    }

    // More individual orders = higher priority
    score += Math.log2(group.conventional.orders.length + group.organic.orders.length);

    return score;
  }

  /**
   * Sorts customer groups by priority
   */
  static sortGroupsByPriority(groups: Map<string, CustomerOrderGroup>): CustomerOrderGroup[] {
    return Array.from(groups.values())
      .sort((a, b) => this.getCustomerPriority(b) - this.getCustomerPriority(a));
  }
}