import React from 'react';
import { format, parseISO } from 'date-fns';
import { OrderItem } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface OrderStatusProps {
  orders: OrderItem[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const STATUS_COLORS = {
  'Not Released': '#6B7280',
  'Not Started': '#3B82F6',
  'In Progress': '#EAB308',
  'Finished': '#22C55E',
  'PGI\'d': '#15803D'
};

const STATUS_MAPPING = {
  'PGI\'d': 'PGI\'d',
  'Finished': 'Finished',
  'Not Started': 'Not Started',
  'Not Released': 'Not Released',
  'In Progress': 'In Progress'
};

export const OrderStatus: React.FC<OrderStatusProps> = ({ orders, selectedDate, onDateChange }) => {
  const getStatusData = () => {
    const statusCounts: Record<string, number> = {};
    
    orders
      .filter(order => format(parseISO(order['Loading Date']), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
      .forEach(order => {
        const status = order.OrderStatus || 'Not Released';
        const mappedStatus = STATUS_MAPPING[status as keyof typeof STATUS_MAPPING] || status;
        statusCounts[mappedStatus] = (statusCounts[mappedStatus] || 0) + 1;
      });

    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Order Status</h2>
        <input
          type="date"
          value={format(selectedDate, 'yyyy-MM-dd')}
          onChange={(e) => onDateChange(new Date(e.target.value))}
          className="bg-black/40 border border-blue-500/20 rounded px-3 py-1 text-white"
        />
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={getStatusData()}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {getStatusData().map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '0.5rem'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};