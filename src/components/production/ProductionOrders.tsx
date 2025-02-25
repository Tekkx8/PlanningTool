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
            <TableHead className="text
