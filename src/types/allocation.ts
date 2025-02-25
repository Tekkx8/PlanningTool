/**
 * Core allocation types for the HORTIBlue Fruit Allocation System
 */

/**
 * Represents a batch of stock with its allocation status
 */
export interface StockBatch {
  batchNumber: string;
  location: string;
  materialId: string;
  variety: string;
  quality: string;
  stockWeight: number;
  age: number;
  ggn: string;
  originCountry: string;
  supplier: string;
  isOrganic: boolean;
  allocations: BatchAllocation[];
}

/**
 * Represents an allocation of a stock batch to an order
 */
export interface BatchAllocation {
  id: string;
  batchNumber: string;
  orderNumber: string;
  salesDocument: string;
  salesDocumentItem: string;
  customer: string;
  allocationDate: string;
  quantityKg: number;
  status: AllocationStatus;
  loadingDate: string;
}

/**
 * Represents a customer order that needs allocation
 */
export interface OrderAllocation {
  orderNumber: string;
  salesDocument: string;
  salesDocumentItem: string;
  customer: string;
  loadingDate: string;
  materialDescription: string;
  materialId: string;
  quantityKg: number;
  isOrganic: boolean;
  isSpotSale: boolean;
  status: OrderStatus;
  priority: number;
  restrictions: CustomerRestrictions;
}

/**
 * Status of an allocation
 */
export type AllocationStatus = 
  | 'pending'    // Not yet allocated
  | 'allocated'  // Fully allocated
  | 'partial'    // Partially allocated
  | 'cancelled'  // Allocation cancelled
  | 'released';  // Allocation confirmed and released

/**
 * Status of an order
 */
export type OrderStatus =
  | 'not_released'  // Order not yet released for allocation
  | 'pending'       // Order ready for allocation
  | 'in_progress'   // Order being allocated
  | 'allocated'     // Order fully allocated
  | 'released'      // Order released for production
  | 'delivered';    // Order delivered

/**
 * Customer restrictions for allocation
 */
export interface CustomerRestrictions {
  originCountry?: string[];
  variety?: string[];
  quality?: string[];
  ggn?: string[];
  supplier?: string[];
  minAge?: number;
  maxAge?: number;
}

/**
 * Result of an allocation attempt
 */
export interface AllocationResult {
  success: boolean;
  allocatedQuantity: number;
  remainingQuantity: number;
  allocations: BatchAllocation[];
  errors: string[];
  warnings: string[];
}

/**
 * Allocation rules and preferences
 */
export interface AllocationRules {
  // Quality preferences (1-5, higher is better)
  qualityPreferences: {
    'Good': 5,
    'Good Q/S': 4,
    'Fair': 3,
    'Fair M/C': 2,
    'Poor': 1,
    'Poor M/C': 0
  };
  
  // Maximum age for stock (in days)
  maxStockAge: number;
  
  // Minimum remaining shelf life (in days)
  minShelfLife: number;
  
  // Whether to allow partial allocations
  allowPartialAllocations: boolean;
  
  // Whether to allow mixing batches for a single order
  allowBatchMixing: boolean;
  
  // Extra allocation percentage for production orders
  productionOrderBuffer: number;
  
  // Minimum allocation quantity (in kg)
  minAllocationQuantity: number;
}

/**
 * Storage interface for allocations
 */
export interface AllocationStorage {
  // Batch operations
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  
  // CRUD operations
  getAllocations(): Promise<BatchAllocation[]>;
  getAllocationsByBatch(batchNumber: string): Promise<BatchAllocation[]>;
  getAllocationsByOrder(salesDocument: string, salesDocumentItem: string): Promise<BatchAllocation[]>;
  addAllocation(allocation: BatchAllocation): Promise<void>;
  updateAllocation(id: string, updates: Partial<BatchAllocation>): Promise<void>;
  removeAllocation(id: string): Promise<void>;
  
  // Batch operations
  clearAllocations(): Promise<void>;
  resetAllocations(stock: StockBatch[]): Promise<void>;
}