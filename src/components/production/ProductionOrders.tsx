import React from 'react';
import { OrderItem } from '../types';
import { AllocationManager } from '../utils/allocationManager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface ProductionDashboardProps {
  orders: OrderItem[];
  allocationManager: AllocationManager;
}

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ orders, allocationManager }) => {
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

  // Aggregate orders by customer
  const customerOrders: Record<string, OrderItem[]> = {};
  orders.forEach(order => {
    const status = order.OrderStatus?.toLowerCase() || '';
    if (['delivered', 'shipped', 'finished', 'in delivery'].includes(status)) return;
    const customer = order.SoldToParty || '';
    if (!customerOrders[customer]) customerOrders[customer] = [];
    customerOrders[customer].push(order);
  });

  const uniqueCustomers = Object.keys(customerOrders).sort();

  return (
    <div className="bg-black/20 rounded-lg border border-blue-500/10 p-4">
      <Table className="min-w-full text-white">
        <TableHeader>
          <TableRow className="border-b border-blue-500/20">
            <TableHead className="text-blue-400 py-2 px-4">Customer</TableHead>
            <TableHead className="text-blue-400 py-2 px-4">Total KG</TableHead>
            <TableHead className="text-blue-400 py-2 px-4">Allocation Status</TableHead>
            <TableHead className="text-blue-400 py-2 px-4">Order Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uniqueCustomers.map(customerName => {
            const customerOrdersList = customerOrders[customerName];
            const totalKG = customerOrdersList.reduce((sum, order) => sum + (parseFloat(order.SalesQuantityKG.replace(/[^\d.-]/g, '')) || 0), 0);
            const allocationStatus = allocationManager.getOrderAllocationStatus(customerOrdersList[0]); // Use first order as representative
            const orderStatus = customerOrdersList.every(o => o.OrderStatus?.toLowerCase() === customerOrdersList[0].OrderStatus?.toLowerCase())
              ? getStatusText(customerOrdersList[0].OrderStatus)
              : 'Mixed';

            return (
              <TableRow key={customerName} className="border-b border-blue-500/10 hover:bg-blue-500/5 transition-colors">
                <TableCell className="py-2 px-4">{customerName}</TableCell>
                <TableCell className="py-2 px-4 text-blue-300">{totalKG.toFixed(2)} KG</TableCell>
                <TableCell className="py-2 px-4 text-blue-300">{allocationStatus}</TableCell>
                <TableCell className="py-2 px-4 text-blue-300">{orderStatus}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {uniqueCustomers.length === 0 && (
        <div className="text-blue-300/80 text-sm mt-4">
          Please upload orders data to view the production dashboard
        </div>
      )}
    </div>
  );
};
