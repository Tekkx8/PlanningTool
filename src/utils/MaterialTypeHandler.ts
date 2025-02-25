import { StockItem, OrderItem } from '../types';

export interface OrganicAllocationRequest {
  order: OrderItem;
  availableStock: StockItem[];
  selectedSupplier?: string;
}

export class MaterialTypeHandler {
  /**
   * Determines if a material is conventional based on its ID
   */
  static isConventional(materialId: string): boolean {
    const id = materialId.toLowerCase();
    return id.startsWith('fiargrn') || id.startsWith('bcb');
  }

  /**
   * Determines if a material is organic based on its ID
   */
  static isOrganic(materialId: string): boolean {
    const id = materialId.toLowerCase();
    return id.startsWith('fiarorg') || id.startsWith('bob');
  }

  /**
   * Gets all organic suppliers from a list of stock items
   */
  static getOrganicSuppliers(stock: StockItem[]): string[] {
    return Array.from(new Set(
      stock
        .filter(item => this.isOrganic(item['Material ID']))
        .map(item => item.Supplier)
        .filter(Boolean)
    )).sort();
  }

  /**
   * Checks if organic stock can be used for a conventional order
   */
  static canUseOrganicForConventional(
    order: OrderItem,
    organicStock: StockItem[],
    selectedSupplier?: string
  ): boolean {
    // Must be a conventional order
    if (order.isOrganic) return false;

    // Must have organic stock available
    if (!organicStock.length) return false;

    // If supplier specified, must have stock from that supplier
    if (selectedSupplier) {
      return organicStock.some(item => item.Supplier === selectedSupplier);
    }

    return true;
  }

  /**
   * Gets available organic stock that could be used for conventional orders
   */
  static getOrganicStockForConventional(
    stock: StockItem[],
    selectedSupplier?: string
  ): StockItem[] {
    let organicStock = stock.filter(item => this.isOrganic(item['Material ID']));

    if (selectedSupplier) {
      organicStock = organicStock.filter(item => item.Supplier === selectedSupplier);
    }

    return organicStock;
  }

  /**
   * Validates if a stock item can be allocated to an order based on material type
   */
  static validateMaterialTypeMatch(stock: StockItem, order: OrderItem): boolean {
    const stockMaterial = stock['Material ID'].toLowerCase();
    const orderMaterial = order.Material?.toLowerCase() || '';

    // Direct material ID match
    if (stockMaterial === orderMaterial) return true;

    // Check organic/conventional match
    const isStockOrganic = this.isOrganic(stockMaterial);
    const isOrderOrganic = order.isOrganic;

    // Organic stock can only go to organic orders (unless explicitly allowed)
    if (isStockOrganic && !isOrderOrganic) return false;

    // Conventional stock can only go to conventional orders
    if (!isStockOrganic && isOrderOrganic) return false;

    return true;
  }

  /**
   * Gets allocation options for a conventional order when organic stock might be used
   */
  static getOrganicAllocationOptions(request: OrganicAllocationRequest): {
    canUseOrganic: boolean;
    availableSuppliers: string[];
    recommendedSupplier?: string;
  } {
    const { order, availableStock, selectedSupplier } = request;

    // Must be a conventional order
    if (order.isOrganic) {
      return {
        canUseOrganic: false,
        availableSuppliers: []
      };
    }

    // Get all organic stock
    const organicStock = this.getOrganicStockForConventional(availableStock);
    if (!organicStock.length) {
      return {
        canUseOrganic: false,
        availableSuppliers: []
      };
    }

    // Get available suppliers
    const suppliers = this.getOrganicSuppliers(organicStock);

    // If supplier specified, validate it
    if (selectedSupplier && !suppliers.includes(selectedSupplier)) {
      return {
        canUseOrganic: false,
        availableSuppliers: suppliers
      };
    }

    // Find recommended supplier (one with most matching stock)
    const supplierStock = suppliers.map(supplier => ({
      supplier,
      stockCount: organicStock.filter(item => item.Supplier === supplier).length
    }));

    const recommendedSupplier = supplierStock
      .sort((a, b) => b.stockCount - a.stockCount)[0]?.supplier;

    return {
      canUseOrganic: true,
      availableSuppliers: suppliers,
      recommendedSupplier
    };
  }
}