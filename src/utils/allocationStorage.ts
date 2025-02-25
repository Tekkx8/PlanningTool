import { AllocationStore, AllocationRecord, OrderItem, StockItem } from '../types';

const STORAGE_KEY = 'hortiblue_allocations';
const CURRENT_VERSION = '1.0.2';
const BATCH_NUMBER_REGEX = /^[A-Z0-9]{3,4}\d{7,8}$/i;

export class AllocationStorage {
  private store: AllocationStore;
  private pendingAllocations: Set<string>;

  constructor() {
    const stored = this.loadFromStorage();
    this.store = stored || this.createInitialStore();
    this.pendingAllocations = new Set();
    
    // If we loaded from storage but versions don't match, migrate data
    if (stored && stored.version !== CURRENT_VERSION) {
      this.migrateStore(stored);
    }
  }

  private validateBatchNumber(batchNumber: string): boolean {
    if (!batchNumber) return false;
    
    // Normalize batch number: remove all non-alphanumeric characters, convert to uppercase
    const normalizedBatchNumber = batchNumber
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    
    // Basic validation: must be at least 10 characters (3-4 letter prefix + 7-8 digits)
    return normalizedBatchNumber.length >= 10;
  }

  private validateOrderFields(order: OrderItem): string[] {
    const errors: string[] = [];
    if (!order['Sales document']) errors.push('Missing Sales Document');
    if (!order['Sales document item']) errors.push('Missing Sales Document Item');
    if (!order.SoldToParty) errors.push('Missing Customer');
    if (!order['Loading Date']) errors.push('Missing Loading Date');
    return errors;
  }

  private createInitialStore(): AllocationStore {
    return {
      allocations: {},
      lastUpdated: new Date().toISOString(),
      version: CURRENT_VERSION
    };
  }

  private migrateStore(oldStore: AllocationStore): void {
    // Handle migrations between versions
    if (oldStore.version === '1.0.0') {
      // Migrate from 1.0.0 to 1.0.2
      // Clean up any invalid allocations
      const validAllocations = Object.entries(oldStore.allocations).reduce((acc, [batchNumber, allocation]) => {
        if (this.validateBatchNumber(batchNumber)) {
          acc[batchNumber] = allocation;
        }
        return acc;
      }, {} as Record<string, AllocationRecord>);

      this.store = {
        allocations: validAllocations,
        version: CURRENT_VERSION,
        lastUpdated: new Date().toISOString()
      };
      this.saveToStorage();
    }
  }

  public beginAllocationBatch(): void {
    this.pendingAllocations.clear();
  }

  public commitAllocationBatch(): void {
    this.pendingAllocations.clear();
    this.saveToStorage();
  }

  public rollbackAllocationBatch(): void {
    // Remove any allocations that were added in this batch
    this.pendingAllocations.forEach(batchNumber => {
      delete this.store.allocations[batchNumber];
    });
    this.pendingAllocations.clear();
  }

  private loadFromStorage(): AllocationStore | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      
      // Add migration logic here if needed in future
      
      return parsed;
    } catch (error) {
      console.error('Error loading allocation store:', error);
      return null;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (error) {
      console.error('Error saving allocation store:', error);
    }
  }

  public getAllocations(): Record<string, AllocationRecord> {
    return this.store.allocations;
  }

  public getAllocationByBatch(batchNumber: string): AllocationRecord | null {
    return this.store.allocations[batchNumber] || null;
  }

  public getAllocationsByBatch(batchNumber: string): AllocationRecord[] {
    return Object.values(this.store.allocations)
      .filter(allocation => allocation.batchNumber === batchNumber);
  }

  public isAllocated(batchNumber: string): boolean {
    const allocation = this.getAllocationByBatch(batchNumber);
    return allocation !== null && allocation.status === 'Allocated';
  }

  public addAllocation(record: AllocationRecord): void {
    // Normalize batch number: remove all non-alphanumeric characters, convert to uppercase
    const normalizedBatchNumber = record.batchNumber
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    
    if (!normalizedBatchNumber) {
      throw new Error('Missing batch number');
    }

    // Get existing allocation
    const existingAllocation = this.getAllocationByBatch(normalizedBatchNumber);

    // Check if reallocation is allowed
    if (existingAllocation && !existingAllocation.canReallocate && 
        existingAllocation.customer !== record.customer) {
      throw new Error(`Batch ${normalizedBatchNumber} cannot be reallocated`);
    }

    // Calculate remaining quantity
    const remainingQuantity = record.originalQuantity - record.quantityKG;
    if (remainingQuantity < 0) {
      throw new Error(`Insufficient quantity in batch ${normalizedBatchNumber}`);
    }

    // Update allocation status based on order status
    const canReallocate = ['Finished', 'Delivered', 'Shipped', 'In delivery'].includes(record.orderStatus);

    // Create allocation record
    const allocation: AllocationRecord = {
      ...record,
      batchNumber: normalizedBatchNumber,
      remainingQuantity,
      canReallocate,
      lastStatusUpdate: new Date().toISOString()
    }

    // Validate the allocation
    const errors = [
      !normalizedBatchNumber && 'Missing Batch Number',
      !record.salesDocument && 'Missing Sales Document',
      !record.customer && 'Missing Customer'
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(`Invalid allocation: ${errors.join(', ')}`);
    }

    // Generate unique allocation ID that includes order info
    const allocationId = `${normalizedBatchNumber}-${record.salesDocument}-${record.salesDocumentItem}-${Date.now()}`;

    this.pendingAllocations.add(normalizedBatchNumber);
    
    this.store.allocations[allocationId] = {
      ...record,
      batchNumber: normalizedBatchNumber,
      allocationDate: new Date().toISOString(),
      originalQuantity // Keep track of the total batch quantity
    };
    
    this.store.lastUpdated = new Date().toISOString();
    this.saveToStorage();
  }

  public updateAllocation(batchNumber: string, updates: Partial<AllocationRecord>): void {
    const existing = this.getAllocationByBatch(batchNumber);
    if (!existing) {
      throw new Error(`No allocation found for batch ${batchNumber}`);
    }
    
    // Validate updates
    if (updates.status === 'Allocated' && (!updates.salesDocument || !updates.customer)) {
      throw new Error('Missing required fields for allocation');
    }

    this.store.allocations[batchNumber] = {
      ...existing,
      ...updates,
      allocationDate: new Date().toISOString()
    };
    
    this.store.lastUpdated = new Date().toISOString();
    this.saveToStorage();
  }

  public removeAllocation(batchNumber: string): void {
    delete this.store.allocations[batchNumber];
    this.store.lastUpdated = new Date().toISOString();
    this.saveToStorage();
  }

  public validateAllocation(stock: StockItem, order: OrderItem): string[] {
    const errors: string[] = [];

    // Validate batch number format
    if (!this.validateBatchNumber(stock['Batch Number'])) {
      errors.push(`Invalid batch number format: ${stock['Batch Number']}`);
      return errors;
    }

    // Check if stock is already allocated to a different customer
    const existingAllocations = this.getAllocationsByBatch(stock['Batch Number']);
    if (existingAllocations.length > 0) {
      const firstAllocation = existingAllocations[0];
      if (firstAllocation.customer !== order.SoldToParty) {
        errors.push(`Batch ${stock['Batch Number']} is already allocated to customer ${firstAllocation.customer}`);
        return errors;
      }
      
      // Check remaining quantity
      const totalAllocated = existingAllocations.reduce((sum, a) => sum + a.quantityKG, 0);
      const stockWeight = parseFloat(String(stock['Stock Weight']).replace(' KG', ''));
      if (totalAllocated >= stockWeight) {
        errors.push(`No remaining quantity in batch ${stock['Batch Number']}`);
        return errors;
      }
    }

    // Required fields validation
    errors.push(...this.validateOrderFields(order));
    // Quantity validation
    const stockWeight = parseFloat(String(stock['Stock Weight']).replace(' KG', ''));
    const orderWeight = parseFloat(order.SalesQuantityKG);
    
    if (isNaN(stockWeight)) errors.push('Invalid Stock Weight');
    if (isNaN(orderWeight)) errors.push('Invalid Order Quantity');

    return errors;
  }

  public getAllocationsByOrder(salesDocument: string, salesDocumentItem: string): AllocationRecord[] {
    return Object.values(this.store.allocations)
      .filter(allocation => 
        allocation.status === 'Allocated' &&
        allocation.salesDocument === salesDocument &&
        allocation.salesDocumentItem === salesDocumentItem
      );
  }

  public clearAllAllocations(): void {
    this.store = this.createInitialStore();
    this.saveToStorage();
  }

  public resetAllocations(newStock: StockItem[]): void {
    // Keep track of existing allocations
    const existingAllocations = { ...this.store.allocations };
    
    // Clear all allocations
    this.store.allocations = {};
    
    // Restore allocations for stock items that still exist
    newStock.forEach(item => {
      const batchNumber = item['Batch Number'];
      if (existingAllocations[batchNumber]) {
        this.store.allocations[batchNumber] = existingAllocations[batchNumber];
      }
    });
    
    this.store.lastUpdated = new Date().toISOString();
    this.saveToStorage();
  }
}