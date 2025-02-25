import { StockItem, OrderItem, AllocationResult } from '../types';
import { OrderGrouper, CustomerOrderGroup } from './OrderGrouper';

interface AllocationCandidate {
  stock: StockItem;
  remainingQuantity: number;
  isSmallBatch: boolean;
}

export class StockAllocator {
  private static SMALL_BATCH_THRESHOLD = 900; // KG
  private static BUFFER_PERCENTAGE = 0.10; // 10% extra allocation

  /**
   * Allocates stock to orders with 10% buffer for non-spot orders
   */
  static allocateStock(
    stock: StockItem[],
    orders: OrderItem[],
    isOrganic: (item: StockItem) => boolean
  ): AllocationResult[] {
    // Initialize allocation results
    const allocation = stock.map((item, index) => ({
      ...item,
      originalRow: index + 2,
      customer: '',
      allocatedQuantity: 0,
      allocationDetails: undefined
    }));

    // Group orders by customer
    const customerGroups = OrderGrouper.groupOrdersByCustomer(orders);
    const sortedGroups = OrderGrouper.sortGroupsByPriority(customerGroups);

    // Process each customer group
    for (const group of sortedGroups) {
      // Process conventional orders first, then organic
      this.processOrderGroup(allocation, group.conventional.orders, false, isOrganic);
      this.processOrderGroup(allocation, group.organic.orders, true, isOrganic);
    }

    return allocation;
  }

  private static processOrderGroup(
    allocation: AllocationResult[],
    orders: OrderItem[],
    isOrganic: boolean,
    isOrganicFn: (item: StockItem) => boolean
  ) {
    // Sort orders by date and quantity
    const sortedOrders = [...orders].sort((a, b) => {
      // First by date
      const dateCompare = new Date(a['Loading Date']).getTime() - 
                         new Date(b['Loading Date']).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      // Then by quantity (larger orders first)
      const aQty = parseFloat(a.SalesQuantityKG.replace(/[^\d.-]/g, ''));
      const bQty = parseFloat(b.SalesQuantityKG.replace(/[^\d.-]/g, ''));
      return bQty - aQty;
    });

    for (const order of sortedOrders) {
      const requiredQuantity = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, ''));
      const targetQuantity = order.isSpotSale ? 
        requiredQuantity : 
        requiredQuantity * (1 + this.BUFFER_PERCENTAGE);

      // Get available stock matching order type
      const availableStock = allocation
        .filter(item => {
          // Must match organic/conventional
          if (isOrganicFn(item) !== isOrganic) return false;
          
          // Must not be allocated
          if (item.customer) return false;
          
          return true;
        })
        .map(item => ({
          stock: item,
          remainingQuantity: parseFloat(String(item['Stock Weight']).replace(' KG', '')),
          isSmallBatch: parseFloat(String(item['Stock Weight']).replace(' KG', '')) <= this.SMALL_BATCH_THRESHOLD
        }));

      // First try to allocate using small batches
      const smallBatches = availableStock.filter(item => item.isSmallBatch);
      let remainingQuantity = this.allocateFromCandidates(
        smallBatches,
        order,
        targetQuantity,
        allocation
      );

      // If still need more, use larger batches
      if (remainingQuantity > 0) {
        const largeBatches = availableStock.filter(item => !item.isSmallBatch)
          .sort((a, b) => a.remainingQuantity - b.remainingQuantity);

        // Find the smallest large batch that can fulfill the remaining quantity
        const perfectMatch = largeBatches.find(item => 
          Math.abs(item.remainingQuantity - remainingQuantity) / remainingQuantity <= 0.1
        );

        if (perfectMatch) {
          // Use the perfect match batch
          this.allocateBatch(
            allocation.find(a => a['Batch Number'] === perfectMatch.stock['Batch Number'])!,
            order,
            remainingQuantity
          );
          remainingQuantity = 0;
        } else {
          // Otherwise use remaining large batches
          remainingQuantity = this.allocateFromCandidates(
            largeBatches,
            order,
            remainingQuantity,
            allocation
          );
        }
      }
    }
  }

  private static allocateFromCandidates(
    candidates: AllocationCandidate[],
    order: OrderItem,
    targetQuantity: number,
    allocation: AllocationResult[]
  ): number {
    let remainingQuantity = targetQuantity;

    // Sort by age (oldest first) and size (smallest first)
    candidates.sort((a, b) => {
      const ageA = a.stock['Real Stock Age'];
      const ageB = b.stock['Real Stock Age'];
      if (ageA !== ageB) return ageB - ageA;
      return a.remainingQuantity - b.remainingQuantity;
    });

    for (const candidate of candidates) {
      if (remainingQuantity <= 0) break;

      const allocationItem = allocation.find(
        item => item['Batch Number'] === candidate.stock['Batch Number']
      )!;

      const allocateQuantity = Math.min(candidate.remainingQuantity, remainingQuantity);
      this.allocateBatch(allocationItem, order, allocateQuantity);
      remainingQuantity -= allocateQuantity;
    }

    return remainingQuantity;
  }

  private static allocateBatch(
    item: AllocationResult,
    order: OrderItem,
    quantity: number
  ) {
    item.customer = order.SoldToParty;
    item.allocatedQuantity = quantity;
    item.allocationDetails = {
      orderNumber: order.Order || '',
      salesDocument: order['Sales document'],
      requiredQuantity: parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, '')),
      allocatedQuantity: quantity,
      isPartial: false,
      isSpotSale: order.isSpotSale || false
    };
  }
}