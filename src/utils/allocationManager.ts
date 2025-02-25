import { AllocationStorage } from './allocationStorage';
import { StockItem, OrderItem, Allocation } from '../types';

export class AllocationManager {
  storage: AllocationStorage;

  constructor() {
    this.storage = new AllocationStorage();
  }

  processNewData(stock: StockItem[], orders: OrderItem[]): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.storage.beginAllocationBatch();

    // Aggregate orders by customer and type
    const customerOrders: Record<string, Record<'conventional' | 'organic' | 'spot', number>> = {};
    orders.forEach(order => {
      const status = order.OrderStatus?.toLowerCase() || '';
      if (['delivered', 'shipped', 'finished', 'in delivery'].includes(status)) return;

      const customer = order.SoldToParty || '';
      const isSpot = order.Material?.toLowerCase().startsWith('bcb') || order.Material?.toLowerCase().startsWith('bob') || false;
      const type = isSpot ? 'spot' : order.isOrganic ? 'organic' : 'conventional';
      if (!customerOrders[customer]) customerOrders[customer] = { conventional: 0, organic: 0, spot: 0 };
      customerOrders[customer][type] += parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, '')) || 0;
    });

    // Sort stock by quality and age (Poor/Fair before Good, oldest first)
    const sortedStock = [...stock].sort((a, b) => {
      const qualityOrder = {
        'Poor M/C': 0,
        'Poor': 1,
        'Fair M/C': 2,
        'Fair': 3,
        'Good Q/S': 4,
        'Good': 5
      };
      const qualityA = qualityOrder[a['Q3: Reinspection Quality'] as keyof typeof qualityOrder] ?? 999;
      const qualityB = qualityOrder[b['Q3: Reinspection Quality'] as keyof typeof qualityOrder] ?? 999;
      
      if (qualityA !== qualityB) return qualityA - qualityB;
      return (b['Real Stock Age'] || 0) - (a['Real Stock Age'] || 0);
    });

    Object.entries(customerOrders).forEach(([customerName, totals]) => {
      ['conventional', 'organic', 'spot'].forEach(type => {
        if (totals[type] === 0) return;

        const targetQuantity = type === 'spot' ? totals[type] : totals[type] * 1.1; // +10% for production orders
        let remainingQuantity = targetQuantity;

        const matchingStock = sortedStock.filter(item => {
          const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
          const existingAllocations = this.storage.getAllocationsByBatch(item['Batch Number']);
          const totalAllocated = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
          const remainingStock = stockWeight - totalAllocated;

          if (remainingStock <= 0) return false;

          if (existingAllocations.length > 0 && !existingAllocations.some(a => a.customer === customerName)) {
            return false;
          }

          const isOrg = this.isOrganic(item);
          if ((type === 'conventional' && isOrg) || (type === 'organic' && !isOrg) || (type === 'spot' && !this.isSpotSale(item))) return false;

          return true; // No restrictions for simplicity; add customer restrictions here if needed
        });

        let allocatedBatches: StockItem[] = [];
        let totalAllocated = 0;

        for (const item of matchingStock) {
          if (remainingQuantity <= 0) break;

          const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
          const existingAllocations = this.storage.getAllocationsByBatch(item['Batch Number']);
          const totalAllocatedForBatch = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
          const remainingStock = stockWeight - totalAllocatedForBatch;
          const allocateQuantity = Math.min(remainingStock, remainingQuantity);

          if (allocateQuantity <= 0) continue;

          allocatedBatches.push(item);
          totalAllocated += allocateQuantity;
          remainingQuantity -= allocateQuantity;

          this.storage.addAllocation({
            batchNumber: item['Batch Number'],
            order: '',
            salesDocument: '',
            salesDocumentItem: '10',
            customer: customerName,
            allocationDate: new Date().toISOString(),
            quantityKG: allocateQuantity,
            status: 'Allocated',
            materialDescription: item['Material Description'] || '',
            materialId: item['Material ID'] || '',
            loadingDate: '',
            originalQuantity: stockWeight
          });
        }

        // Optimize with larger batches if target not met (for production orders only)
        if (remainingQuantity > 0 && type !== 'spot') {
          const largerBatches = matchingStock
            .filter(item => !allocatedBatches.includes(item))
            .sort((a, b) => {
              const weightA = parseFloat(String(a['Stock Weight']).replace(' KG', '')) || 0;
              const weightB = parseFloat(String(b['Stock Weight']).replace(' KG', '')) || 0;
              return weightB - weightA; // Sort descending by weight
            });

          for (const largeBatch of largerBatches) {
            if (remainingQuantity <= 0) break;

            const stockWeight = parseFloat(String(largeBatch['Stock Weight']).replace(' KG', '')) || 0;
            const existingAllocations = this.storage.getAllocationsByBatch(largeBatch['Batch Number']);
            const totalAllocatedForBatch = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
            const remainingStock = stockWeight - totalAllocatedForBatch;
            const allocateQuantity = Math.min(remainingStock, targetQuantity - totalAllocated);

            if (allocateQuantity <= 0) continue;

            // Remove smaller allocations for this customer/type match
            const existingSmaller = allocatedBatches.filter(b => 
              parseFloat(String(b['Stock Weight']).replace(' KG', '')) < stockWeight
            );
            existingSmaller.forEach(smallBatch => {
              const smallAllocations = this.storage.getAllocationsByBatch(smallBatch['Batch Number']);
              smallAllocations.forEach(allocation => this.storage.removeAllocation(allocation.batchNumber));
            });

            allocatedBatches = [largeBatch];
            totalAllocated = allocateQuantity;
            remainingQuantity = targetQuantity - totalAllocated;

            this.storage.addAllocation({
              batchNumber: largeBatch['Batch Number'],
              order: '',
              salesDocument: '',
              salesDocumentItem: '10',
              customer: customerName,
              allocationDate: new Date().toISOString(),
              quantityKG: allocateQuantity,
              status: 'Allocated',
              materialDescription: largeBatch['Material Description'] || '',
              materialId: largeBatch['Material ID'] || '',
              loadingDate: '',
              originalQuantity: stockWeight
            });
          }
        }

        if (remainingQuantity > 0) {
          warnings.push(`Customer ${customerName} (${type} orders) could not be fully allocated. Required: ${totals[type]}KG, Allocated: ${totalAllocated}KG`);
        }
      });
    });

    // Handle restriction groups (simplified for now)
    const restrictionGroups: Record<string, { customers: string[], totalKG: number, type: 'conventional' | 'organic' | 'spot' }> = {};
    customers.forEach(customer => {
      const restrictionKey = JSON.stringify(customer.restrictions);
      Object.entries(customerOrders[customer.name] || {}).forEach(([type, total]) => {
        if (total > 0) {
          if (!restrictionGroups[restrictionKey]) {
            restrictionGroups[restrictionKey] = { customers: [], totalKG: 0, type: type as 'conventional' | 'organic' | 'spot' };
          }
          restrictionGroups[restrictionKey].customers.push(customer.name);
          restrictionGroups[restrictionKey].totalKG += total as number;
        }
      });
    });

    Object.entries(restrictionGroups).forEach(([key, group]) => {
      if (group.totalKG === 0) return;

      const targetQuantity = group.type === 'spot' ? group.totalKG : group.totalKG * 1.1;
      let remainingQuantity = targetQuantity;

      const matchingStock = sortedStock.filter(item => {
        const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
        const existingAllocations = this.storage.getAllocationsByBatch(item['Batch Number']);
        const totalAllocated = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
        const remainingStock = stockWeight - totalAllocated;

        if (remainingStock <= 0) return false;

        const isOrg = this.isOrganic(item);
        if ((group.type === 'conventional' && isOrg) || (group.type === 'organic' && !isOrg) || (group.type === 'spot' && !this.isSpotSale(item))) return false;

        const customer = customers.find(c => group.customers.includes(c.name));
        if (!customer) return false;

        return Object.entries(customer.restrictions).every(([key, value]) => {
          if (!value) return true;
          return item[key as keyof StockItem] === value;
        });
      });

      let allocatedBatches: StockItem[] = [];
      let totalAllocated = 0;

      for (const item of matchingStock) {
        if (remainingQuantity <= 0) break;

        const stockWeight = parseFloat(String(item['Stock Weight']).replace(' KG', '')) || 0;
        const existingAllocations = this.storage.getAllocationsByBatch(item['Batch Number']);
        const totalAllocatedForBatch = existingAllocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
        const remainingStock = stockWeight - totalAllocatedForBatch;
        const allocateQuantity = Math.min(remainingStock, remainingQuantity);

        if (allocateQuantity <= 0) continue;

        allocatedBatches.push(item);
        totalAllocated += allocateQuantity;
        remainingQuantity -= allocateQuantity;

        group.customers.forEach(customer => {
          this.storage.addAllocation({
            batchNumber: item['Batch Number'],
            order: '',
            salesDocument: '',
            salesDocumentItem: '10',
            customer,
            allocationDate: new Date().toISOString(),
            quantityKG: allocateQuantity / group.customers.length, // Distribute evenly
            status: 'Allocated',
            materialDescription: item['Material Description'] || '',
            materialId: item['Material ID'] || '',
            loadingDate: '',
            originalQuantity: stockWeight
          });
        });
      }

      if (remainingQuantity > 0) {
        warnings.push(`Restriction group (${group.type}) could not be fully allocated. Required: ${group.totalKG}KG, Allocated: ${totalAllocated}KG`);
      }
    });

    if (errors.length > 0 || warnings.length > 0) {
      this.storage.rollbackAllocationBatch();
    } else {
      this.storage.commitAllocationBatch();
    }

    return { errors, warnings };
  };

  private isOrganic(item: StockItem): boolean {
    const materialId = item['Material ID']?.toLowerCase() || '';
    return materialId.includes('org') || materialId.includes('organic') || materialId.startsWith('bob') || materialId.startsWith('bio');
  }

  private isSpotSale(item: StockItem): boolean {
    const materialId = item['Material ID']?.toLowerCase() || '';
    return materialId.startsWith('bcb') || materialId.startsWith('bob');
  }

  getOrderAllocationStatus(order: OrderItem): string {
    const allocations = this.storage.getAllocationsByCustomer(order.SoldToParty || '');
    const totalOrdered = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, '')) || 0;
    const totalAllocated = allocations.reduce((sum, a) => sum + (a.quantityKG || 0), 0);
    const isSpot = this.isSpotSale({ 'Material ID': order.Material } as StockItem);

    if (isSpot) {
      return totalAllocated >= totalOrdered ? 'Fully Allocated' : 'Partial';
    }

    const target = totalOrdered * 1.1; // +10% for production orders
    if (totalAllocated >= target) return 'Fully Allocated';
    if (totalAllocated > 0) return 'Partial';
    return '-';
  }
}
