import React from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { OrderItem } from '../../types';
import { ChevronLeft, ChevronRight, Download, Filter, X, Check } from 'lucide-react';
import { ScrollablePanel } from '../ScrollablePanel';
import { AllocationManager } from '../../utils/allocationManager';
import { AllocationStatus } from '../../types';

interface FilterState {
  order: string;
  salesDocument: string;
  soldToParty: string;
  status: string[];
  allocation: string;
}

interface ProductionOrdersProps {
  orders: OrderItem[];
  selectedDate: Date;
  allocationManager: AllocationManager;
  onDateChange: (date: Date) => void;
}

export const ProductionOrders: React.FC<ProductionOrdersProps> = ({ 
  orders, 
  selectedDate, 
  allocationManager,
  onDateChange 
}) => {
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState<FilterState>({
    order: '',
    salesDocument: '',
    soldToParty: '',
    status: [],
    allocation: ''
  });

  // Get date range from orders
  const dateRange = React.useMemo(() => {
    const dates = orders.map(order => parseISO(order['Loading Date']));
    if (dates.length === 0) return { start: new Date(), end: new Date() };
    return {
      start: new Date(Math.min(...dates.map(date => date.getTime()))),
      end: new Date(Math.max(...dates.map(date => date.getTime())))
    };
  }, [orders]);

  // Add date picker for easier navigation
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange(new Date(e.target.value));
  };

  const handlePrevDay = () => {
    const newDate = subDays(selectedDate, 1);
    if (newDate >= dateRange.start) {
      onDateChange(newDate);
    }
  };

  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    if (newDate <= dateRange.end) {
      onDateChange(newDate);
    }
  };

  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Date filter
      if (format(parseISO(order['Loading Date']), 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')) {
        return false;
      }

      // Order number filter
      if (filters.order && !order.Order?.toLowerCase().includes(filters.order.toLowerCase())) {
        return false;
      }

      // Sales document filter
      if (filters.salesDocument && !order['Sales document']?.toLowerCase().includes(filters.salesDocument.toLowerCase())) {
        return false;
      }

      // Sold to party filter
      if (filters.soldToParty && !order.SoldToParty?.toLowerCase().includes(filters.soldToParty.toLowerCase())) {
        return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(order.OrderStatus || 'Pending')) {
        return false;
      }

      // Allocation filter
      if (filters.allocation) {
        const isAllocated = order.Allocation !== '-' && order.Allocation !== undefined;
        if (filters.allocation === 'allocated' && !isAllocated) return false;
        if (filters.allocation === 'unallocated' && isAllocated) return false;
      }

      return true;
    });
  }, [orders, selectedDate, filters]);

  const getStatusStyle = (status: string = '') => {
    switch (status.toLowerCase()) {
      case 'shipped':
      case 'delivered':
        return 'bg-emerald-800/30 text-emerald-400'; // Dark green
      case 'finished':
      case 'in delivery':
        return 'bg-green-500/30 text-green-400'; // Bright green
      case 'created':
      case 'in production':
      case 'in progress':
        return 'bg-blue-500/30 text-blue-300'; // Blue
      case 'to be created':
      case 'not released':
      case 'pending':
      default:
        return 'bg-gray-500/30 text-gray-300';
    }
  };

  const getStatusText = (status: string = '') => {
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'shipped':
        return 'Shipped';
      case 'in delivery':
      case 'finished': 
        return 'Finished';
      case 'in progress':
      case 'in production':
      case 'created':
        return 'Created';
      case 'not released':
      case 'pending':
      case 'to be created':
        return 'To be created';
      default:
        return 'To be created';
    }
  };

  const statusOptions = [
    { value: 'shipped', label: 'Shipped', color: 'emerald-400' },
    { value: 'finished', label: 'Finished', color: 'green-400' },
    { value: 'created', label: 'Created', color: 'blue-300' },
    { value: 'to be created', label: 'To be created', color: 'gray-300' }
  ];

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleStatus = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const clearFilters = () => {
    setFilters({
      order: '',
      salesDocument: '',
      soldToParty: '',
      status: [],
      allocation: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

  const getAllocationStatus = (order: OrderItem) => {
    const requiredQuantity = parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, ''));
    return allocationManager.getOrderAllocationStatus(
      order['Sales document'], 
      order['Sales document item'] || '10',
      requiredQuantity
    );
  };

  const FilterDropdown = () => (
    <div className="absolute top-full left-0 mt-2 w-80 bg-black/90 border border-blue-500/20 rounded-lg shadow-xl backdrop-blur-sm z-50">
      <div className="p-4 border-b border-blue-500/20 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Filter Orders</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-blue-300 mb-1">Order Number</label>
          <input
            type="text"
            value={filters.order}
            onChange={(e) => handleFilterChange('order', e.target.value)}
            placeholder="Filter by order number..."
            className="w-full bg-black/40 border border-blue-500/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-blue-300/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-300 mb-1">Sales Document</label>
          <input
            type="text"
            value={filters.salesDocument}
            onChange={(e) => handleFilterChange('salesDocument', e.target.value)}
            placeholder="Filter by sales document..."
            className="w-full bg-black/40 border border-blue-500/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-blue-300/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-300 mb-1">Sold To Party</label>
          <input
            type="text"
            value={filters.soldToParty}
            onChange={(e) => handleFilterChange('soldToParty', e.target.value)}
            placeholder="Filter by customer name..."
            className="w-full bg-black/40 border border-blue-500/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-blue-300/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-300 mb-1">Status</label>
          <div className="space-y-2">
            {statusOptions.map(option => (
              <button
                key={option.value}
                onClick={() => toggleStatus(option.value)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-500/10 transition-colors"
              >
                <span className="text-blue-300">{option.label}</span>
                {filters.status.includes(option.value) && (
                  <Check className="w-4 h-4 text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-300 mb-1">Allocation</label>
          <select
            value={filters.allocation}
            onChange={(e) => handleFilterChange('allocation', e.target.value)}
            className="w-full bg-black/40 border border-blue-500/20 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="">All</option>
            <option value="allocated">Allocated</option>
            <option value="unallocated">Unallocated</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <ScrollablePanel
      title="Production Orders"
      maxHeight="calc(100vh - 8rem)"
    >
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center bg-black/40 border border-blue-500/20 rounded-lg overflow-hidden">
          <button
            onClick={handlePrevDay}
            disabled={selectedDate <= dateRange.start}
            className={`p-2 transition-colors ${
              selectedDate <= dateRange.start
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-500/20'
            }`}
          >
            <ChevronLeft className="w-4 h-4 text-blue-400" />
          </button>
          
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={handleDateChange}
            className="bg-transparent border-x border-blue-500/20 px-3 py-1.5 text-white text-sm w-36"
          />
          
          <button
            onClick={handleNextDay}
            disabled={selectedDate >= dateRange.end}
            className={`p-2 transition-colors ${
              selectedDate >= dateRange.end
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-500/20'
            }`}
          >
            <ChevronRight className="w-4 h-4 text-blue-400" />
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              hasActiveFilters
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">
                {Object.values(filters).filter(value => 
                  Array.isArray(value) ? value.length > 0 : Boolean(value)
                ).length}
              </span>
            )}
          </button>
          {showFilters && <FilterDropdown />}
        </div>
        
        <button
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg text-blue-300 hover:bg-blue-500/20 transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      <div className="relative overflow-x-auto -mx-6 -mt-6">
        <table className="w-full border-collapse min-w-[1200px] table-fixed">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-left py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[120px]">
                Sales Doc Item
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-left py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[120px]">
                Order
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-left py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[160px]">
                Sales Document
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-left py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[180px]">
                Sold To Party
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-left py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20">
                Material Description
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-right py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[140px]">
                Sales Quantity CS
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-right py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[140px]">
                Sales Quantity KG
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-left py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[120px]">
                Status
              </th>
              <th className="sticky top-0 z-10 bg-black/60 backdrop-blur-sm text-left py-3 px-4 text-blue-300 font-medium whitespace-nowrap border-b border-blue-500/20 w-[120px]">
                Allocation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-500/10 bg-black/20">
            {filteredOrders.map((order) => (
              <tr
                key={`${order['Sales document']}-${order['Sales document item']}-${order.SoldToParty}-${order.SalesQuantityKG}`}
                className="hover:bg-blue-500/5 transition-colors"
              >
                <td className="py-3 px-4 text-white whitespace-nowrap truncate">
                  {order['Sales document item'] || '000'}
                </td>
                <td className="py-3 px-4 text-white whitespace-nowrap truncate">
                  {order.Order || '-'}
                </td>
                <td className="py-3 px-4 text-white whitespace-nowrap truncate">
                  {order['Sales document']}
                </td>
                <td className="py-3 px-4 text-white whitespace-nowrap truncate">
                  {order.SoldToParty}
                </td>
                <td className="py-3 px-4 text-white truncate">
                  {order['Material Description']}
                </td>
                <td className="py-3 px-4 text-white text-right whitespace-nowrap truncate">
                  {order.SalesQuantityCS}
                </td>
                <td className="py-3 px-4 text-white text-right whitespace-nowrap truncate">
                  {parseFloat(order.SalesQuantityKG).toLocaleString()} KG
                </td>
                <td className="py-3 px-4 whitespace-nowrap truncate">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusStyle(order.OrderStatus)}`}>
                    {getStatusText(order.OrderStatus)}
                  </span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap truncate">
                  {(() => {
                    const allocation = getAllocationStatus(order);
                    const allocations = allocationManager.getOrderAllocations(
                      order['Sales document'],
                      order['Sales document item'] || '10'
                    );
                    
                    // Update order number if we have an allocation
                    if (allocations.length > 0 && !order.Order) {
                      order.Order = allocations[0].order;
                    }
                    
                    return allocation.status === 'unallocated' ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${allocation.className}`}>
                        {allocation.text}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScrollablePanel>
  );
};