import React from 'react';

interface ScrollablePanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  maxHeight?: string;
}

export const ScrollablePanel: React.FC<ScrollablePanelProps> = ({
  title,
  children,
  className = '',
  headerActions,
  maxHeight = '60vh'
}) => {
  return (
    <div className={`bg-black/40 backdrop-blur-sm rounded-lg border border-blue-500/20 ${className}`}>
      <div className="sticky top-0 z-30 bg-black/60 backdrop-blur-md border-b border-blue-500/20 px-6 py-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {headerActions}
      </div>
      <div 
        className="overflow-auto scrollbar-thin"
        style={{ maxHeight, height: maxHeight }}
      >
        <div className="p-6 min-w-full">
          {children}
        </div>
      </div>
    </div>
  );
};