export interface StockItem {
  Location?: string;
  'Batch Number': string;
  'Stock Weight': string;
  'Material ID': string;
  'Real Stock Age': number;
  Variety: string;
  GGN: string;
  'Origin Country': string;
  'Q3: Reinspection Quality'?: string;
  'BL/AWB/CMR': string;
  Allocation?: string;
  MinimumSize: string;
  'Origin Pallet Number': string;
  Supplier: string;
}

export interface OrderItem {
  OrderStatus: string;
  'Sales document': string;
  'Sales document item'?: string;
  Order?: string;
  'Loading Date': string;
  SoldToParty: string;
  'Material Description': string;
  Material: string;
  SalesQuantityCS: string;
  SalesQuantityKG: string;
  isOrganic: boolean;
  isSpotSale?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  restrictions: CustomerRestrictions;
}

export interface CustomerRestrictions {
  'Origin Country'?: string;
  Variety?: string;
  GGN?: string;
  'Q3: Reinspection Quality'?: string;
  'BL/AWB/CMR'?: string;
  MinimumSize?: string;
  'Origin Pallet Number'?: string;
  Supplier?: string;
}

export interface AllocationResult extends StockItem {
  originalRow: number;
  customer: string;
  allocatedQuantity: number;
  allocationDetails?: {
    orderNumber: string;
    salesDocument: string;
    requiredQuantity: number;
    allocatedQuantity: number;
    isPartial: boolean;
    isSpotSale: boolean;
  };
}

export interface AllocationRecord {
  batchNumber: string;
  order: string;
  salesDocument: string;
  salesDocumentItem: string;
  customer: string;
  allocationDate: string;
  quantityKG: number;
  status: 'Allocated' | 'Unallocated';
  materialDescription?: string;
  materialId?: string;
  loadingDate: string;
  originalQuantity: number;
  remainingQuantity: number;
  canReallocate: boolean;
  lastStatusUpdate: string;
  orderStatus: string;
}

export interface AllocationStatus {
  status: 'unallocated' | 'allocated' | 'partial';
  text: string;
  className?: string;
  canReallocate: boolean;
}

export interface AllocationStore {
  allocations: Record<string, AllocationRecord>;
  lastUpdated: string;
  version: string;
}