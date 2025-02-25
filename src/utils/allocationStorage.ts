import { Allocation } from '../types';

export class AllocationStorage {
  private allocations: Map<string, Allocation[]> = new Map(); // BatchNumber -> Allocations
  private batchAllocations: Map<string, Allocation[]> = new Map(); // Track allocations during a batch

  beginAllocationBatch() {
    this.batchAllocations.clear();
  }

  commitAllocationBatch() {
    this.batchAllocations.forEach((allocations, batchNumber) => {
      if (!this.allocations.has(batchNumber)) {
        this.allocations.set(batchNumber, []);
      }
      this.allocations.get(batchNumber)?.push(...allocations);
    });
    this.batchAllocations.clear();
  }

  rollbackAllocationBatch() {
    this.batchAllocations.clear();
  }

  addAllocation(allocation: Allocation) {
    const batchNumber = allocation.batchNumber;
    if (!this.batchAllocations.has(batchNumber)) {
      this.batchAllocations.set(batchNumber, []);
    }
    const existing = this.batchAllocations.get(batchNumber) || [];
    if (!existing.some(a => a.customer === allocation.customer && a.order === allocation.order)) {
      existing.push(allocation);
      this.batchAllocations.set(batchNumber, existing);
    } else {
      throw new Error(`Duplicate allocation for Batch ${batchNumber} and Customer ${allocation.customer}`);
    }
  }

  removeAllocation(batchNumber: string) {
    const allocations = this.batchAllocations.get(batchNumber) || [];
    this.batchAllocations.set(batchNumber, allocations.filter(a => a.status !== 'Allocated'));
    const persistent = this.allocations.get(batchNumber) || [];
    this.allocations.set(batchNumber, persistent.filter(a => a.status !== 'Allocated'));
  }

  getAllocationsByBatch(batchNumber: string): Allocation[] {
    return [...(this.allocations.get(batchNumber) || []), ...(this.batchAllocations.get(batchNumber) || [])];
  }

  getAllocationsByCustomer(customer: string): Allocation[] {
    const allAllocations: Allocation[] = [];
    this.allocations.forEach(allocations => {
      allocations.forEach(a => {
        if (a.customer === customer) allAllocations.push(a);
      });
    });
    this.batchAllocations.forEach(allocations => {
      allocations.forEach(a => {
        if (a.customer === customer) allAllocations.push(a);
      });
    });
    return allAllocations;
  }

  getAllocationByBatch(batchNumber: string): Allocation | undefined {
    const allAllocations = this.getAllocationsByBatch(batchNumber);
    return allAllocations.find(a => a.status === 'Allocated');
  }

  resetAllocations(stock: StockItem[]) {
    this.allocations.clear();
    stock.forEach(item => {
      if (this.getAllocationsByBatch(item['Batch Number']).length > 0) {
        this.removeAllocation(item['Batch Number']);
      }
    });
  }
}
