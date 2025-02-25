import React, { useState } from 'react';
import { format, parseISO, differenceInDays, isAfter, isSameDay, addDays } from 'date-fns';
import { useSpring, animated } from '@react-spring/web';
import { ArrowRight } from 'lucide-react';
import { OrderItem } from '../types';
import { TodayOrders } from './production/TodayOrders';
import { SpotSales } from './production/SpotSales';
import { ForecastOrders } from './production/ForecastOrders';
import { ProductionOrders } from './production/ProductionOrders';
import { AllocationManager } from '../utils/allocationManager';

interface ProductionDashboardProps {
  orders: OrderItem[];
  allocationManager: AllocationManager;
}

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ orders, allocationManager }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (orders.length === 0) return new Date();
    
    // Get all order dates
    const today = new Date();
    const orderDates = orders
      .map(order => parseISO(order['Loading Date']))
      .sort((a, b) => a.getTime() - b.getTime());
    
    // Check if there are orders for today
    const todayOrders = orderDates.find(date => isSameDay(date, today));
    if (todayOrders) return today;
    
    // Find the closest future date with orders
    const futureDate = orderDates.find(date => isAfter(date, today));
    if (futureDate) return futureDate;
    
    // If no future dates, return today
    return today;
  });

  const { transform, opacity } = useSpring({
    opacity: isFlipped ? 1 : 0,
    transform: `perspective(600px) rotateY(${isFlipped ? 180 : 0}deg)`,
    config: { mass: 5, tension: 500, friction: 80 }
  });


  return (
    <div className="relative min-h-[800px]">
      {/* Flip Button */}
      <button
        onClick={() => setIsFlipped(state => !state)}
        className="absolute right-4 top-4 z-10 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
        title={isFlipped ? "Show Front" : "Show Back"}
      >
        <ArrowRight className={`w-5 h-5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
      </button>

      {/* Front Side */}
      <animated.div
        style={{
          opacity: opacity.to(o => 1 - o),
          transform,
          position: 'absolute',
          width: '100%'
        }}
        className={`${isFlipped ? 'pointer-events-none' : ''}`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <TodayOrders orders={orders} selectedDate={selectedDate} />
          <ForecastOrders orders={orders} />
          <SpotSales
            orders={orders}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>
      </animated.div>

      {/* Back Side */}
      <animated.div
        style={{
          opacity,
          transform: transform.to(t => `${t} rotateY(180deg)`),
          position: 'absolute',
          width: '100%'
        }}
        className={`${!isFlipped ? 'pointer-events-none' : ''}`}
      >
        <ProductionOrders
          orders={orders}
          selectedDate={selectedDate}
          allocationManager={allocationManager}
          onDateChange={setSelectedDate}
        />
      </animated.div>
    </div>
  );
};