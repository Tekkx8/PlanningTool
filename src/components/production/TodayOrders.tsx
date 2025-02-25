import React from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { OrderItem } from '../../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TodayOrdersProps {
  orders: OrderItem[];
  selectedDate?: Date;
}

export const TodayOrders: React.FC<TodayOrdersProps> = ({ orders, selectedDate = new Date() }) => {
  const todayOrders = orders.filter(order => 
    format(parseISO(order['Loading Date']), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  );

  const conventionalOrders = todayOrders.filter(order => !order.isOrganic);
  const organicOrders = todayOrders.filter(order => order.isOrganic);

  const previousDayOrders = orders.filter(order => {
    const orderDate = parseISO(order['Loading Date']);
    const prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - 1);
    return format(orderDate, 'yyyy-MM-dd') === format(prevDate, 'yyyy-MM-dd');
  });
  
  const orderDifference = todayOrders.length - previousDayOrders.length;

  const getTotalKilos = (orders: OrderItem[]) => {
    return orders.reduce((sum, order) => sum + parseFloat(order.SalesQuantityKG || '0'), 0);
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-6 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Today's Orders</h2>
          <div className="text-sm text-blue-300 mt-1">
            {format(selectedDate, 'MMMM d, yyyy')}
          </div>
        </div>
        {previousDayOrders.length > 0 && orderDifference !== 0 && (
          <div className={`flex items-center gap-2 ${orderDifference > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {orderDifference > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm">
              {orderDifference > 0 ? '+' : ''}{orderDifference} vs yesterday
            </span>
          </div>
        )}
      </div>

      <div className="text-5xl font-bold text-white mb-8">
        {todayOrders.length}
        <span className="text-lg text-blue-300 ml-2">orders</span>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-500/10 rounded-lg p-4">
          <div className="text-sm text-blue-300 mb-1">Conventional Orders</div>
          <div className="flex justify-between items-baseline">
            <div className="text-2xl font-semibold text-white">
              {conventionalOrders.length}
            </div>
            <div className="text-lg text-blue-400">
              {Math.round(getTotalKilos(conventionalOrders)).toLocaleString()} KG
            </div>
          </div>
        </div>

        <div className="bg-green-500/10 rounded-lg p-4">
          <div className="text-sm text-green-300 mb-1">Organic Orders</div>
          <div className="flex justify-between items-baseline">
            <div className="text-2xl font-semibold text-white">
              {organicOrders.length}
            </div>
            <div className="text-lg text-green-400">
              {Math.round(getTotalKilos(organicOrders)).toLocaleString()} KG
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};