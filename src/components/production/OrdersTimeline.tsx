import React from 'react';
import { format, parseISO, eachDayOfInterval, subDays, addDays } from 'date-fns';
import { OrderItem } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface OrdersTimelineProps {
  orders: OrderItem[];
}

export const OrdersTimeline: React.FC<OrdersTimelineProps> = ({ orders }) => {
  const dateRange = eachDayOfInterval({
    start: subDays(new Date(), 15),
    end: addDays(new Date(), 15)
  });

  const data = dateRange.map(date => {
    const dayOrders = orders.filter(order => 
      format(parseISO(order['Loading Date']), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );

    return {
      date: format(date, 'MMM dd'),
      orders: dayOrders.length,
      cancelled: dayOrders.filter(order => order.OrderStatus === 'Cancelled').length
    };
  });

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-6">
      <h2 className="text-xl font-semibold text-white mb-6">Orders this month</h2>
      
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              interval={2}
            />
            <YAxis tick={{ fill: '#94A3B8' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '0.5rem'
              }}
            />
            <Bar dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};