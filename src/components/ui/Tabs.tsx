import React from 'react';
import { motion } from 'framer-motion';

interface TabOption {
  id: string;
  label: string;
}

interface TabsProps {
  options: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ options, activeId, onChange, className = '' }) => {
  return (
    <div className={`flex clay-input-wrapper p-1 rounded-lg relative select-none overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {options.map((option) => {
        const isActive = option.id === activeId;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`
              relative flex-1 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none z-10 cursor-pointer
              ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabBg"
                className="absolute inset-0 bg-card rounded-md -z-10 clay-btn"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
