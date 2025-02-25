import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, RotateCcw, Filter, Search, Check } from 'lucide-react';
import { Customer, CustomerRestrictions, StockItem, OrderItem } from '../types';
import { ScrollablePanel } from './ScrollablePanel';

interface CustomerListProps {
  customers: Customer[];
  stock: StockItem[];
  orders: OrderItem[];
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  includeSpotSales: boolean;
  onIncludeSpotSalesChange: (include: boolean) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onRemoveCustomer: (customerId: string) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  stock,
  orders,
  dateRange,
  onDateRangeChange,
  includeSpotSales,
  onIncludeSpotSalesChange,
  onUpdateCustomer,
  onRemoveCustomer,
}) => {
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [pendingSort, setPendingSort] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());

  const filterOptions = [
    { id: 'production', label: 'Production Orders Only' },
    { id: 'spot', label: 'Spot Sales Only' },
    { id: 'organic', label: 'Organic Orders Only' },
    { id: 'conventional', label: 'Conventional Orders Only' }
  ];

  const toggleExpand = (customerId: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
        // Trigger sort if this customer has pending sort
        if (pendingSort === customerId) {
          setPendingSort(null);
        }
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(filterId)) {
        newFilters.delete(filterId);
      } else {
        newFilters.add(filterId);
      }
      return newFilters;
    });
  };

  const filterCustomers = (customers: Customer[]) => {
    return customers.filter(customer => {
      // Get customer orders within date range
      const customerOrders = orders.filter(order => 
        order.SoldToParty === customer.name &&
        order['Loading Date'] >= dateRange.start &&
        order['Loading Date'] <= dateRange.end
      );

      // If customer has no orders in date range, exclude them
      if (customerOrders.length === 0) return false;
      
      // Apply additional filters if any are selected
      if (selectedFilters.size === 0) return true;

      if (selectedFilters.has('production')) {
        if (!customerOrders.some(order => 
          order.OrderStatus === 'In Progress' || 
          order.OrderStatus === 'Pending' || 
          order.OrderStatus === 'Not Released'
        )) return false;
      }

      if (selectedFilters.has('spot')) {
        if (!customerOrders.some(order => 
          order.Material?.startsWith('BCB') || 
          order.Material?.startsWith('BOB')
        )) return false;
      }

      if (selectedFilters.has('organic')) {
        if (!customerOrders.some(order => order.isOrganic)) return false;
      }

      if (selectedFilters.has('conventional')) {
        if (!customerOrders.some(order => !order.isOrganic)) return false;
      }

      return true;
    });
  };

  const getUniqueValues = (field: keyof StockItem) => {
    const values = new Set(stock.map(item => item[field]).filter(Boolean));
    return Array.from(values).sort();
  };

  const getCustomerOrders = (customer: Customer) => {
    return orders.filter(order => 
      order.SoldToParty === customer.name &&
      order['Loading Date'] >= dateRange.start && 
      order['Loading Date'] <= dateRange.end
    );
  };
  const handleFieldChange = (customer: Customer, field: keyof CustomerRestrictions, value: string) => {
    const updatedCustomer = {
      ...customer,
      restrictions: {
        ...customer.restrictions,
        [field]: value === 'N/A' ? undefined : value
      }
    };
    // Mark this customer for sorting when collapsed
    setPendingSort(customer.id);
    onUpdateCustomer(updatedCustomer);
  };

  const handleResetRestrictions = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateCustomer({
      ...customer,
      restrictions: {}
    });
  };

  const fields = [
    { field: 'Origin Country', label: 'Origin' },
    { field: 'Variety', label: 'Variety' },
    { field: 'GGN', label: 'GGN' },
    { field: 'Q3: Reinspection Quality', label: 'Quality' },
    { field: 'BL/AWB/CMR', label: 'BL/AWB/CMR' },
    { field: 'MinimumSize', label: 'Minimum Size' },
    { field: 'Origin Pallet Number', label: 'Origin Pallet Number' },
    { field: 'Supplier', label: 'Supplier' }
  ] as const;

  const getActiveRestrictions = (customer: Customer) => {
    return Object.entries(customer.restrictions)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        label: fields.find(f => f.field === key)?.label || key,
        value
      }));
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort customers: those with restrictions first, then alphabetically
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const aHasRestrictions = Object.values(a.restrictions).some(value => value !== undefined);
    const bHasRestrictions = Object.values(b.restrictions).some(value => value !== undefined);

    // Only apply restrictions-based sorting for customers that are not expanded
    if (!expandedCustomers.has(a.id) && !expandedCustomers.has(b.id)) {
      if (aHasRestrictions && !bHasRestrictions) return -1;
      if (!aHasRestrictions && bHasRestrictions) return 1;
    }

    return a.name.localeCompare(b.name);
  });

  return (
    <ScrollablePanel
      title="Customer Restrictions"
      headerActions={
        <div className="flex items-center gap-2">
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-black/40 border border-blue-500/20 rounded-lg overflow-hidden">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              className="bg-transparent border-r border-blue-500/20 px-3 py-1.5 text-white text-sm w-36"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              className="bg-transparent px-3 py-1.5 text-white text-sm w-36"
            />
          </div>

          {/* Spot Sales Toggle */}
          <button
            onClick={() => onIncludeSpotSalesChange(!includeSpotSales)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              includeSpotSales
                ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
            }`}
          >
            <span>{includeSpotSales ? 'Including Spot Sales' : 'Excluding Spot Sales'}</span>
          </button>

          {/* Filters */}
          <button
            onClick={() => setActiveFilters(new Set())}
            className="relative flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg text-blue-300 hover:bg-blue-500/20 transition-colors text-sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {selectedFilters.size > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-xs flex items-center justify-center">
                {selectedFilters.size}
              </span>
            )}
          </button>
          
          {/* Filter Dropdown */}
          {showFilters && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-black/90 border border-blue-500/20 rounded-lg shadow-xl backdrop-blur-sm z-50">
              <div className="p-3 border-b border-blue-500/20">
                <h3 className="text-sm font-medium text-white">Filter Customers</h3>
              </div>
              <div className="p-2">
                {filterOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => toggleFilter(option.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                  >
                    <span className="text-blue-300">{option.label}</span>
                    {selectedFilters.has(option.id) && (
                      <Check className="w-4 h-4 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
              {selectedFilters.size > 0 && (
                <div className="p-3 border-t border-blue-500/20">
                  <button
                    onClick={() => setSelectedFilters(new Set())}
                    className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      }
      maxHeight="calc(100vh - 20rem)"
    >
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-blue-500/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          onClick={() => setActiveFilters(new Set())}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-lg text-blue-300 hover:bg-blue-500/20 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </button>
      </div>

      <div className="grid gap-4">
      {filterCustomers(sortedCustomers).map((customer) => {
        const activeRestrictions = getActiveRestrictions(customer);
        const isExpanded = expandedCustomers.has(customer.id);
        
        return (
          <div
            key={customer.id}
            className="bg-black/20 rounded-lg border border-blue-500/10 overflow-hidden transition-all duration-200 hover:border-blue-500/30"
          >
            <div className="flex flex-col">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-500/5 transition-colors"
                onClick={() => toggleExpand(customer.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-blue-400 transition-transform duration-200" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-blue-400 transition-transform duration-200" />
                  )}
                  <span className="font-semibold text-white text-lg">{customer.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {activeRestrictions.length > 0 && (
                    <button
                      onClick={(e) => handleResetRestrictions(customer, e)}
                      className="text-blue-400 hover:text-blue-300 transition-all p-2 hover:bg-blue-500/10 rounded-lg group"
                      title="Reset restrictions"
                    >
                      <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCustomer(customer.id);
                    }}
                    className="text-blue-400 hover:text-red-400 transition-all p-2 hover:bg-red-500/10 rounded-lg group"
                    title="Remove customer"
                  >
                    <X className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                  </button>
                </div>
              </div>

              {!isExpanded && activeRestrictions.length > 0 && (
                <div className="px-10 pb-3 flex flex-wrap gap-2">
                  {activeRestrictions.map(({ label, value }) => (
                    <div
                      key={label}
                      className="inline-flex items-center bg-blue-500/10 rounded-full px-3 py-1 text-sm border border-blue-500/20"
                    >
                      <span className="text-blue-400">{label}:</span>
                      <span className="ml-1 text-white">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {isExpanded && (
              <div className="p-6 space-y-6 border-t border-blue-500/10 bg-blue-950/20">
                {/* Customer Orders */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-blue-300 mb-3">Orders</h3>
                  {(() => {
                    const customerOrders = getCustomerOrders(customer);
                    if (customerOrders.length === 0) {
                      return (
                        <div className="text-sm text-gray-400 italic">
                          No orders in selected date range
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-2">
                        {customerOrders.map(order => (
                          <div
                            key={`${order['Sales document']}-${order['Sales document item']}`}
                            className={`flex items-center justify-between p-2 rounded-lg border ${
                              order.isOrganic
                                ? 'bg-green-500/5 border-green-500/20'
                                : 'bg-blue-500/5 border-blue-500/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-sm ${order.isOrganic ? 'text-green-300' : 'text-blue-300'}`}>
                                Order: {order.Order || 'N/A'}
                              </span>
                              <span className="text-white text-sm">{order.SalesQuantityKG} KG</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">{order['Loading Date']}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                order.isOrganic
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {order.isOrganic ? 'Organic' : 'Conventional'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Restrictions */}
                <h3 className="text-sm font-medium text-blue-300 mb-3">Restrictions</h3>
                {fields.map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-blue-300 mb-2">
                      {label}
                    </label>
                    <select
                      value={customer.restrictions[field] || 'N/A'}
                      onChange={(e) => handleFieldChange(customer, field, e.target.value)}
                      className="w-full rounded-lg border border-blue-500/20 bg-black/40 text-white px-4 py-2 
                               focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                               transition-all duration-200 hover:border-blue-500/40"
                    >
                      <option value="N/A">N/A</option>
                      {getUniqueValues(field).map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </ScrollablePanel>
  );
};