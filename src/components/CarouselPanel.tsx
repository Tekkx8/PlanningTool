import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselPanelProps {
  items: React.ReactNode[];
  slidesPerView?: number;
  spaceBetween?: number;
  className?: string;
}

export const CarouselPanel: React.FC<CarouselPanelProps> = ({
  items,
  slidesPerView = 'auto',
  spaceBetween = 24,
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={spaceBetween}
        slidesPerView={slidesPerView}
        navigation={{
          prevEl: '.carousel-nav.prev',
          nextEl: '.carousel-nav.next',
        }}
        pagination={{ clickable: true }}
        className="w-full"
      >
        {items.map((item, index) => (
          <SwiperSlide key={index}>
            {item}
          </SwiperSlide>
        ))}
      </Swiper>
      
      <button className="carousel-nav prev">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button className="carousel-nav next">
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};