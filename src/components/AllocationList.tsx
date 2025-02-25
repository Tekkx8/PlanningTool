import React from 'react';
import { AllocationResult, OrderItem, StockItem } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AllocationListProps {
  allocationResults: AllocationResult[];
  orders: OrderItem[];
  stock: StockItem[];
  dateRange: { start: string; end: string };
  isOrganic: (item: StockItem) => boolean;
  isSpotSale: (item: OrderItem) => boolean;
  collapsedCustomers: Set<string>;
  onToggleCollapse: (customerName: string) => void;
}

export const AllocationList: React.FC<AllocationListProps> = ({
  allocationResults,
  orders,
  stock,
  dateRange,
  isOrganic,
  isSpotSale,
  collapsedCustomers,
  onToggleCollapse,
}) => {
  const uniqueCustomers = Array.from(new Set(allocationResults.map(r => r.customer.split(', ')[0] || r.customer)));

  return (
    <div className="space-y-6">
      {uniqueCustomers.map(customerName => {
        const customerAllocations = allocationResults.filter(r => r.customer.includes(customerName));
        const customerOrders = orders.filter(o => 
          o.SoldToParty === customerName &&
          format(parseISO(o['Loading Date']), 'yyyy-MM-dd') >= dateRange.start &&
          format(parseISO(o['Loading Date']), 'yyyy-MM-dd') <= dateRange.end &&
          !['delivered', 'shipped', 'finished', 'in delivery'].includes(o.OrderStatus?.toLowerCase() || '')
        );
        
        const conventionalOrders = customerOrders.filter(o => !o.isOrganic && !o.isSpotSale);
        const organicOrders = customerOrders.filter(o => o.isOrganic && !o.isSpotSale);
        const spotOrders = customerOrders.filter(o => o.isSpotSale);

        const conventionalAllocations = customerAllocations.filter(a => !isOrganic(a));
        const organicAllocations = customerAllocations.filter(a => isOrganic(a));

        const conventionalTotal = conventionalOrders.reduce((sum, o) => sum + (parseFloat(o.SalesQuantityKG) || 0), 0);
        const organicTotal = organicOrders.reduce((sum, o) => sum + (parseFloat(o.SalesQuantityKG) || 0), 0);
        const spotTotal = spotOrders.reduce((sum, o) => sum + (parseFloat(o.SalesQuantityKG) || 0), 0);

        const conventionalAllocated = conventionalAllocations.reduce((sum, a) => sum + (a.allocatedQuantity || 0), 0);
        const organicAllocated = organicAllocations.reduce((sum, a) => sum + (a.allocatedQuantity || 0), 0);

        const isCollapsed = collapsedCustomers.has(customerName);

        return (
          <div key={customerName} className="bg-black/20 rounded-lg border border-blue-500/10 overflow-hidden">
            <button
              onClick={() => onToggleCollapse(customerName)}
              className="w-full bg-blue-900/20 px-6 py-4 flex items-center justify-between hover:bg-blue-900/30 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white">{customerName}</h3>
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5 text-blue-400" />
              ) : (
                <ChevronUp className="h-5 w-5 text-blue-400" />
              )}
            </button>

            {!isCollapsed && (
              <>
                <div className="px-6 py-3 border-b border-blue-500/10">
                  <div className="text-sm text-blue-300 mb-2">Orders:</div>
                  
                  {conventionalTotal > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-blue-400 mb-2">Conventional Orders</h4>
                      <div className="space-y-2">
                        <p className="text-blue-300 text-sm">
                          Total: {conventionalTotal} KG (Target: {conventionalTotal * 1.1} KG)
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {organicTotal > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-green-400 mb-2">Organic Orders</h4>
                      <div className="space-y-2">
                        <p className="text-green-300 text-sm">
                          Total: {organicTotal} KG (Target: {organicTotal * 1.1} KG)
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {spotTotal > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-yellow-400 mb-2">Spot Sale Orders</h4>
                      <div className="space-y-2">
                        <p className="text-yellow-300 text-sm">
                          Total: {spotTotal} KG
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="px-6 py-4">
                  {conventionalAllocations.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-blue-400 mb-2">Conventional Stock</h4>
                      <div className="space-y-2">
                        {conventionalAllocations.map((item, index) => (
                          <div 
                            key={`${item.Location || 'no-loc'}-${item['Batch Number']}`}
                            className="flex items-center justify-between py-2 px-4 bg-blue-500/5 rounded-lg hover:bg-blue-500/10 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-blue-300">{item.Location || '-'}</span>
                              <span className="text-white">{item['Batch Number']}</span>
                              <span className="text-blue-300">{item['Stock Weight']} KG</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-blue-300">{item['Q3: Reinspection Quality'] || '-'}</span>
                              <span className="text-blue-300">{item['Real Stock Age']} days</span>
                              <span className="text-blue-300">GGN: {item.GGN || '-'}</span>
                            </div>
                          </div>
                        ))}
                        <p className="text-blue-300 text-sm mt-2">
                          Allocated: {conventionalAllocated} KG (+{((conventionalAllocated / conventionalTotal - 1) * 100 || 0).toFixed(1)}% over-allocation)
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {organicAllocations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-400 mb-2">Organic Stock</h4>
                      <div className="space-y-2">
                        {organicAllocations.map((item, index) => (
                          <div 
                            key={`${item.Location || 'no-loc'}-${item['Batch Number']}`}
                            className="flex items-center justify-between py-2 px-4 bg-green-500/5 rounded-lg hover:bg-green-500/10 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-green-300">{item.Location || '-'}</span>
                              <span className="text-white">{item['Batch Number']}</span>
                              <span className="text-green-300">{item['Stock Weight']} KG</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-green-300">{item['Q3: Reinspection Quality'] || '-'}</span>
                              <span className="text-green-300">{item['Real Stock Age']} days</span>
                              <span className="text-green-300">GGN: {item.GGN || '-'}</span>
                            </div>
                          </div>
                        ))}
                        <p className="text-green-300 text-sm mt-2">
                          Allocated: {organicAllocated} KG (+{((organicAllocated / organicTotal - 1) * 100 || 0).toFixed(1)}% over-allocation)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
