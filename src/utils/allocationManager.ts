import { AllocationStorage } from './allocationStorage';
import { StockItem, OrderItem, AllocationRecord, Customer, AllocationStatus } from '../types';
import { SpotSaleAllocator } from './SpotSaleAllocator';

export class AllocationManager {
  public storage: AllocationStorage;
  private readonly PRODUCTION_BUFFER = 0.10; // 10% extra for production orders
  private readonly SMALL_BATCH_THRESHOLD = 900; // KG
  private readonly QUALITY_ORDER = {
    'Poor M/C': 0,
    'Poor': 1,
    'Fair M/C': 2,
    'Fair': 3,
    'Good Q/S': 4,
    'Good': 5
  };

  constructor() {
    this.storage = new AllocationStorage();
  }

  private isOrganic(item: StockItem): boolean {
    const materialId = item['Material ID']?.toLowerCase() || '';
    // OHB batches are always organic
    if (materialId.startsWith('ohb')) return true;
    
    // Check other organic indicators
    return materialId.startsWith('bob') ||
           materialId.startsWith('bio') ||
           materialId.includes('org') ||
           materialId.includes('organic');
  }

  private matchStockToOrder(stock: StockItem, order: OrderItem, customers: Customer[]): boolean {
    // Skip delivered/in delivery orders
    const status = order.OrderStatus?.toLowerCase() || '';
    if (status === 'delivered' || status === 'in delivery') {
      return false;
    }

    // Check organic/conventional match first
    const isStockOrganic = this.isOrganic(stock);
    if (isStockOrganic !== order.isOrganic) {
      // Strict organic/conventional matching
      return false;
    }

    // For spot sales, only match exact material codes
    if (SpotSaleAllocator.isSpotSale(order)) {
      const stockMaterial = stock['Material ID']?.toLowerCase() || '';
      const orderMaterial = order.Material?.toLowerCase() || '';
      // Exact match required for spot sales
      return stockMaterial === orderMaterial && isStockOrganic === order.isOrganic;
    }

    // Check customer restrictions
    const customer = customers.find(c => c.name === order.SoldToParty);
    if (customer) {
      const meetsRestrictions = Object.entries(customer.restrictions).every(([key, value]) => {
        if (!value) return true; // Skip if no restriction
        return stock[key as keyof StockItem] === value;
      });
      if (!meetsRestrictions) return false;
    }

    // Check if material codes match exactly
    const stockMaterial = stock['Material ID']?.toLowerCase() || '';
    const orderMaterial = order.Material?.toLowerCase() || '';
    
    // For exact material matches, still enforce organic/conventional rules
    if (stockMaterial && orderMaterial && stockMaterial === orderMaterial && isStockOrganic === order.isOrganic) {
      return true;
    }

    // Otherwise check variety match
    const orderDesc = order['Material Description']?.toLowerCase() || '';
    const varietyMatch = stock.Variety?.toLowerCase().includes(orderDesc) || 
                        orderDesc.includes(stock.Variety?.toLowerCase() || '');
    
    // Only allow variety match if organic/conventional types match
    return varietyMatch && isStockOrganic === order.isOrganic;
  }

  private isSmallBatch(weight: number): boolean {
    return weight <= this.SMALL_BATCH_THRESHOLD;
  }

  public processNewData(stock: StockItem[], orders: OrderItem[], customers: Customer[]): {
    allocations: AllocationRecord[];
    errors: string[];
    warnings: string[];
  } {
    const result = {
      allocations: [] as AllocationRecord[],
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Sort stock by quality and age
    const sortedStock = [...stock].sort((a, b) => {
      const qualityA = this.QUALITY_ORDER[a['Q3: Reinspection Quality'] as keyof typeof this.QUALITY_ORDER] ?? 999;
      const qualityB = this.QUALITY_ORDER[b['Q3: Reinspection Quality'] as keyof typeof this.QUALITY_ORDER] ?? 999;
      
      // First sort by quality
      if (qualityA !== qualityB) return qualityA - qualityB;
      
      // Then by age (oldest first)
      return b['Real Stock Age'] - a['Real Stock Age'];
    });

    // Split stock into small and large batches
    const smallBatches = sortedStock.filter(item => 
      this.isSmallBatch(parseFloat(String(item['Stock Weight']).replace(' KG', '')))
    );
    const largeBatches = sortedStock.filter(item => 
      !this.isSmallBatch(parseFloat(String(item['Stock Weight']).replace(' KG', '')))
    );

    // Process orders chronologically
    const sortedOrders = [...orders].sort((a, b) => 
      new Date(a['Loading Date']).getTime() - new Date(b['Loading Date']).getTime()
    );

    for (const order of sortedOrders) {
      const customer = customers.find(c => c.name === order.SoldToParty);
      if (!customer) continue;

      const requiredQuantity = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, ''));
      const targetQuantity = order.isSpotSale ? 
        requiredQuantity : 
        requiredQuantity * (1 + this.PRODUCTION_BUFFER);

      let remainingQuantity = targetQuantity;

      // Try small batches first
      for (const batch of smallBatches) {
        if (remainingQuantity <= 0) break;
        if (!this.matchStockToOrder(batch, order, customers)) continue;

        const weight = parseFloat(String(batch['Stock Weight']).replace(' KG', ''));
        if (this.storage.isAllocated(batch['Batch Number'])) continue;

        const allocateQuantity = Math.min(weight, remainingQuantity);
        
        try {
          this.storage.addAllocation({
            batchNumber: batch['Batch Number'],
            order: order.Order || '',
            salesDocument: order['Sales document'],
            salesDocumentItem: order['Sales document item'] || '10',
            customer: order.SoldToParty,
            allocationDate: new Date().toISOString(),
            quantityKG: allocateQuantity,
            status: 'Allocated',
            materialDescription: order['Material Description'],
            materialId: batch['Material ID'],
            loadingDate: order['Loading Date'],
            originalQuantity: weight,
            remainingQuantity: weight - allocateQuantity,
            canReallocate: false,
            lastStatusUpdate: new Date().toISOString(),
            orderStatus: order.OrderStatus || 'Not Released'
          });

          result.allocations.push({
            batchNumber: batch['Batch Number'],
            order: order.Order || '',
            salesDocument: order['Sales document'],
            salesDocumentItem: order['Sales document item'] || '10',
            customer: order.SoldToParty,
            allocationDate: new Date().toISOString(),
            quantityKG: allocateQuantity,
            status: 'Allocated',
            materialDescription: order['Material Description'],
            materialId: batch['Material ID'],
            loadingDate: order['Loading Date'],
            originalQuantity: weight,
            remainingQuantity: weight - allocateQuantity,
            canReallocate: false,
            lastStatusUpdate: new Date().toISOString(),
            orderStatus: order.OrderStatus || 'Not Released'
          });

          remainingQuantity -= allocateQuantity;
        } catch (error) {
          result.errors.push(`Error allocating batch ${batch['Batch Number']}: ${(error as Error).message}`);
        }
      }

      // If still need more, use large batches
      if (remainingQuantity > 0) {
        for (const batch of largeBatches) {
          if (remainingQuantity <= 0) break;
          if (!this.matchStockToOrder(batch, order, customers)) continue;

          const weight = parseFloat(String(batch['Stock Weight']).replace(' KG', ''));
          if (this.storage.isAllocated(batch['Batch Number'])) continue;

          const allocateQuantity = Math.min(weight, remainingQuantity);
          
          try {
            this.storage.addAllocation({
              batchNumber: batch['Batch Number'],
              order: order.Order || '',
              salesDocument: order['Sales document'],
              salesDocumentItem: order['Sales document item'] || '10',
              customer: order.SoldToParty,
              allocationDate: new Date().toISOString(),
              quantityKG: allocateQuantity,
              status: 'Allocated',
              materialDescription: order['Material Description'],
              materialId: batch['Material ID'],
              loadingDate: order['Loading Date'],
              originalQuantity: weight,
              remainingQuantity: weight - allocateQuantity,
              canReallocate: false,
              lastStatusUpdate: new Date().toISOString(),
              orderStatus: order.OrderStatus || 'Not Released'
            });

            result.allocations.push({
              batchNumber: batch['Batch Number'],
              order: order.Order || '',
              salesDocument: order['Sales document'],
              salesDocumentItem: order['Sales document item'] || '10',
              customer: order.SoldToParty,
              allocationDate: new Date().toISOString(),
              quantityKG: allocateQuantity,
              status: 'Allocated',
              materialDescription: order['Material Description'],
              materialId: batch['Material ID'],
              loadingDate: order['Loading Date'],
              originalQuantity: weight,
              remainingQuantity: weight - allocateQuantity,
              canReallocate: false,
              lastStatusUpdate: new Date().toISOString(),
              orderStatus: order.OrderStatus || 'Not Released'
            });

            remainingQuantity -= allocateQuantity;
          } catch (error) {
            result.errors.push(`Error allocating batch ${batch['Batch Number']}: ${(error as Error).message}`);
          }
        }
      }

      // Add warning if allocation was incomplete
      if (remainingQuantity > 0) {
        result.warnings.push(
          `Could not fully allocate order ${order.Order || order['Sales document']}. ` +
          `Required: ${requiredQuantity}KG, Remaining: ${remainingQuantity}KG`
        );
      }
    }

    return result;
  }

  public getAllocations(): AllocationRecord[] {
    return Object.values(this.storage.getAllocations());
  }

  public getStockAllocation(batchNumber: string): AllocationRecord | null {
    return this.storage.getAllocationByBatch(batchNumber);
  }

  public getOrderAllocations(salesDocument: string, salesDocumentItem: string): AllocationRecord[] {
    return this.storage.getAllocationsByOrder(salesDocument, salesDocumentItem);
  }

  public getOrderAllocationStatus(salesDocument: string, salesDocumentItem: string, requiredQuantity: number): AllocationStatus {
    const allocations = this.getOrderAllocations(salesDocument, salesDocumentItem);

    if (allocations.length === 0) {
      return { 
        status: 'unallocated', 
        text: '-',
        canReallocate: true 
      };
    }

    const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.quantityKG, 0);
    
    // Allow for 1% tolerance in matching
    if (Math.abs(totalAllocated - requiredQuantity) / requiredQuantity <= 0.01) {
      return { 
        status: 'allocated',
        text: 'Fully Allocated',
        className: 'bg-green-500/20 text-green-300',
        canReallocate: allocations.every(a => a.canReallocate)
      };
    }
    
    return {
      status: 'partial',
      text: 'Partial',
      className: 'bg-yellow-500/20 text-yellow-300',
      canReallocate: allocations.every(a => a.canReallocate)
    };
  }
}