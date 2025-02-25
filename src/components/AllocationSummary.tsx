import React from 'react';
import { motion } from 'framer-motion';
import { PieChart as ChartPie, Package, AlertCircle } from 'lucide-react';
import { StockItem, OrderItem, Customer } from '../types';
import { format, parseISO } from 'date-fns';

interface AllocationSummaryProps {
  customers: Customer[];
  orders: OrderItem[];
  stock: StockItem[];
  dateRange: { start: string; end: string };
  allocationResults: StockItem[];
  isOrganic: (item: StockItem) => boolean;
}

export const AllocationSummary: React.FC<AllocationSummaryProps> = ({
  customers,
  orders,
  stock,
  dateRange,
  allocationResults,
  isOrganic
}) => {
  // Calculate statistics for each customer/type group
  const stats = React.useMemo(() => {
    return customers.map(customer => {
      // Get customer orders in date range
      const customerOrders = orders.filter(o => 
        o.SoldToParty === customer.name &&
        format(parseISO(o['Loading Date']), 'yyyy-MM-dd') >= dateRange.start &&
        format(parseISO(o['Loading Date']), 'yyyy-MM-dd') <= dateRange.end
      );

      // Group by type
      const conventional = {
        orders: customerOrders.filter(o => !o.isOrganic),
        allocations: allocationResults.filter(r => 
          r.customer === customer.name && !isOrganic(r)
        )
      };

      const organic = {
        orders: customerOrders.filter(o => o.isOrganic),
        allocations: allocationResults.filter(r => 
          r.customer === customer.name && isOrganic(r)
        )
      };

      // Calculate totals
      const getOrderTotal = (orders: OrderItem[]) =>
        orders.reduce((sum, o) => sum + parseFloat(o.SalesQuantityKG.replace(/[^\d.-]/g, '')), 0);

      const getAllocationTotal = (allocations: StockItem[]) =>
        allocations.reduce((sum, a) => sum + parseFloat(String(a['Stock Weight']).replace(' KG', '')), 0);

      return {
        customer,
        conventional: {
          orderTotal: getOrderTotal(conventional.orders),
          allocatedTotal: getAllocationTotal(conventional.allocations),
          allocations: conventional.allocations
        },
        organic: {
          orderTotal: getOrderTotal(organic.orders),
          allocatedTotal: getAllocationTotal(organic.allocations),
          allocations: organic.allocations
        }
      };
    });
  }, [customers, orders, allocationResults, dateRange, isOrganic]);

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-black/20 rounded-lg p-6 border border-blue-500/10">
          <div className="flex items-center gap-3 mb-4">
            <Package className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-medium text-white">Total Allocation</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-500/10 rounded-lg">
              <div className="text-sm text-blue-300">Conventional</div>
              <div className="text-2xl font-bold text-white">
                {Math.round(stats.reduce((sum, s) => sum + s.conventional.allocatedTotal, 0)).toLocaleString()} KG
              </div>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg">
              <div className="text-sm text-green-300">Organic</div>
              <div className="text-2xl font-bold text-white">
                {Math.round(stats.reduce((sum, s) => sum + s.organic.allocatedTotal, 0)).toLocaleString()} KG
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/20 rounded-lg p-6 border border-blue-500/10">
          <div className="flex items-center gap-3 mb-4">
            <ChartPie className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-medium text-white">Allocation Rate</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-500/10 rounded-lg">
              <div className="text-sm text-blue-300">Conventional</div>
              {(() => {
                const total = stats.reduce((sum, s) => sum + s.conventional.orderTotal, 0);
                const allocated = stats.reduce((sum, s) => sum + s.conventional.allocatedTotal, 0);
                const percentage = total > 0 ? (allocated / total) * 100 : 0;
                return (
                  <div className="text-2xl font-bold text-white">
                    {Math.round(percentage)}%
                  </div>
                );
              })()}
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg">
              <div className="text-sm text-green-300">Organic</div>
              {(() => {
                const total = stats.reduce((sum, s) => sum + s.organic.orderTotal, 0);
                const allocated = stats.reduce((sum, s) => sum + s.organic.allocatedTotal, 0);
                const percentage = total > 0 ? (allocated / total) * 100 : 0;
                return (
                  <div className="text-2xl font-bold text-white">
                    {Math.round(percentage)}%
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="bg-black/20 rounded-lg p-6 border border-blue-500/10">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-medium text-white">Unallocated Orders</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-500/10 rounded-lg">
              <div className="text-sm text-blue-300">Conventional</div>
              {(() => {
                const total = stats.reduce((sum, s) => sum + s.conventional.orderTotal, 0);
                const allocated = stats.reduce((sum, s) => sum + s.conventional.allocatedTotal, 0);
                return (
                  <div className="text-2xl font-bold text-white">
                    {Math.round(Math.max(0, total - allocated)).toLocaleString()} KG
                  </div>
                );
              })()}
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg">
              <div className="text-sm text-green-300">Organic</div>
              {(() => {
                const total = stats.reduce((sum, s) => sum + s.organic.orderTotal, 0);
                const allocated = stats.reduce((sum, s) => sum + s.organic.allocatedTotal, 0);
                return (
                  <div className="text-2xl font-bold text-white">
                    {Math.round(Math.max(0, total - allocated)).toLocaleString()} KG
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="space-y-6">
        {stats.map(({ customer, conventional, organic }) => (
          <div key={customer.id} className="bg-black/20 rounded-lg border border-blue-500/10">
            <div className="bg-blue-900/20 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {customer.name}
              </h3>
              <div className="flex items-center gap-4">
                {conventional.orderTotal > 0 && (
                  <div className="text-sm">
                    <span className="text-blue-300">Required:</span>
                    <span className="text-white ml-2">{Math.round(conventional.orderTotal).toLocaleString()} KG</span>
                    <span className="text-blue-300 mx-2">•</span>
                    <span className="text-blue-300">Allocated:</span>
                    <span className="text-white ml-2">{Math.round(conventional.allocatedTotal).toLocaleString()} KG</span>
                    <span className="text-blue-300 mx-2">•</span>
                    <span className={`${
                      conventional.allocatedTotal >= conventional.orderTotal 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {Math.round((conventional.allocatedTotal / conventional.orderTotal) * 100)}%
                    </span>
                  </div>
                )}
                {organic.orderTotal > 0 && (
                  <div className="text-sm border-l border-blue-500/20 pl-4 ml-4">
                    <span className="text-green-300">Required:</span>
                    <span className="text-white ml-2">{Math.round(organic.orderTotal).toLocaleString()} KG</span>
                    <span className="text-green-300 mx-2">•</span>
                    <span className="text-green-300">Allocated:</span>
                    <span className="text-white ml-2">{Math.round(organic.allocatedTotal).toLocaleString()} KG</span>
                    <span className="text-green-300 mx-2">•</span>
                    <span className={`${
                      organic.allocatedTotal >= organic.orderTotal 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {Math.round((organic.allocatedTotal / organic.orderTotal) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Conventional */}
            {conventional.orderTotal > 0 && (
              <div className="p-6 border-b border-blue-500/10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-blue-400">Conventional Orders</h4>
                  <div className="text-sm text-blue-300">
                    {conventional.allocations.length} batches allocated
                  </div>
                </div>
                <div className="space-y-2">
                  {conventional.allocations.map(item => (
                    <div 
                      key={item['Batch Number']}
                      className="flex items-center justify-between py-2 px-4 bg-blue-500/5 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-blue-300">{item.Location || '-'}</span>
                        <span className="text-white">{item['Batch Number']}</span>
                        <span className="text-blue-300">{Math.round(parseFloat(String(item['Stock Weight']).replace(' KG', ''))).toLocaleString()} KG</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-blue-300">{item['Q3: Reinspection Quality']}</span>
                        <span className="text-blue-300">{item['Real Stock Age']} days</span>
                        <span className="text-blue-300">GGN: {item.GGN}</span>
                        {item.allocationDetails?.isSpotSale && (
                          <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded text-xs">
                            Spot Sale
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Organic */}
            {organic.orderTotal > 0 && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-green-400">Organic Orders</h4>
                  <div className="text-sm text-green-300">
                    {organic.allocations.length} batches allocated
                  </div>
                </div>
                <div className="space-y-2">
                  {organic.allocations.map(item => (
                    <div 
                      key={item['Batch Number']}
                      className="flex items-center justify-between py-2 px-4 bg-green-500/5 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-green-300">{item.Location || '-'}</span>
                        <span className="text-white">{item['Batch Number']}</span>
                        <span className="text-green-300">{Math.round(parseFloat(String(item['Stock Weight']).replace(' KG', ''))).toLocaleString()} KG</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-green-300">{item['Q3: Reinspection Quality']}</span>
                        <span className="text-green-300">{item['Real Stock Age']} days</span>
                        <span className="text-green-300">GGN: {item.GGN}</span>
                        {item.allocationDetails?.isSpotSale && (
                          <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded text-xs">
                            Spot Sale
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};