import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AllocationNotification {
  id: string;
  type: 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AllocationNotificationProps {
  notifications: AllocationNotification[];
  onDismiss: (id: string) => void;
}

export const AllocationNotifications: React.FC<AllocationNotificationProps> = ({
  notifications,
  onDismiss
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-4 max-w-md w-full">
      <AnimatePresence>
        {notifications.map(notification => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`${
              notification.type === 'error'
                ? 'bg-red-500/20 border-red-500/30'
                : 'bg-yellow-500/20 border-yellow-500/30'
            } backdrop-blur-sm rounded-lg border p-4 shadow-lg`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                notification.type === 'error' ? 'text-red-400' : 'text-yellow-400'
              }`} />
              
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium ${
                  notification.type === 'error' ? 'text-red-300' : 'text-yellow-300'
                }`}>
                  {notification.title}
                </h3>
                <p className="mt-1 text-sm text-white/80">
                  {notification.message}
                </p>
                {notification.action && (
                  <button
                    onClick={notification.action.onClick}
                    className={`mt-3 text-sm font-medium ${
                      notification.type === 'error'
                        ? 'text-red-400 hover:text-red-300'
                        : 'text-yellow-400 hover:text-yellow-300'
                    } transition-colors`}
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>

              <button
                onClick={() => onDismiss(notification.id)}
                className={`p-1 rounded-full transition-colors ${
                  notification.type === 'error'
                    ? 'hover:bg-red-500/20 text-red-400'
                    : 'hover:bg-yellow-500/20 text-yellow-400'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};