import React from 'react';
import { format, parseISO, addDays, subDays, isAfter } from 'date-fns';
import { OrderItem } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ForecastOrdersProps {
  orders: OrderItem[];
}

export const ForecastOrders: React.FC<ForecastOrdersProps> = ({ orders }) => {
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => {
    const futureDates = orders
      .filter(order => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const orderDate = parseISO(order['Loading Date']);
        return isAfter(orderDate, today);
      })
      .map(order => parseISO(order['Loading Date']))
      .sort((a, b) => a.getTime() - b.getTime());
    return futureDates[0] || new Date();
  });

  // Get future dates range
  const futureDates = React.useMemo(() => {
    return orders
      .filter(order => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const orderDate = parseISO(order['Loading Date']);
        return isAfter(orderDate, today);
      })
      .map(order => parseISO(order['Loading Date']))
      .sort((a, b) => a.getTime() - b.getTime());
  }, [orders]);

  const startDate = futureDates[0];
  const endDate = futureDates[futureDates.length - 1];
  const dateRange = startDate && endDate
    ? `${format(startDate, 'M/d/yyyy')} - ${format(endDate, 'M/d/yyyy')}`
    : 'No upcoming orders';

  const getFilteredOrders = () => {
    return orders.filter(order => 
      format(parseISO(order['Loading Date']), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );
  };

  const filteredOrders = getFilteredOrders();
  const conventionalOrders = filteredOrders.filter(order => !order.isOrganic);
  const organicOrders = filteredOrders.filter(order => order.isOrganic);

  const getTotalKilos = (orders: OrderItem[]) => {
    return orders.reduce((sum, order) => sum + parseFloat(order.SalesQuantityKG || '0'), 0);
  };

  const handlePrevDay = () => {
    const newDate = subDays(selectedDate, 1);
    if (startDate && newDate >= startDate) {
      setSelectedDate(newDate);
    }
  };

  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    if (endDate && newDate <= endDate) {
      setSelectedDate(newDate);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 p-6 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">Upcoming Orders</h2>
          </div>
          <div className="text-sm text-blue-300 mt-1">
            {dateRange}
          </div>
        </div>
      </div>

      <div className="relative mb-8">
        <div className="flex items-center justify-between bg-black/40 border border-blue-500/20 rounded px-3 py-2">
          <button
            onClick={handlePrevDay}
            disabled={!startDate || selectedDate <= startDate}
            className="p-1 hover:bg-blue-500/20 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-5 h-5 text-blue-400" />
          </button>
          
          <span className="text-white font-medium">
            {format(selectedDate, 'MMMM d, yyyy')}
          </span>
          
          <button
            onClick={handleNextDay}
            disabled={!endDate || selectedDate >= endDate}
            className="p-1 hover:bg-blue-500/20 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-5 h-5 text-blue-400" />
          </button>
        </div>
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