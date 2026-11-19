import React from 'react';
import { cn } from '../../lib/utils';

interface SelectProps {
  value: string | number;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Select({ value, onValueChange, children, className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn(
        "w-full h-10 pl-3 pr-8 rounded-lg border border-gray-300 bg-white shadow-xs text-sm text-gray-900 dark:bg-white/[0.03] dark:border-gray-700 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-shadow",
        className
      )}
    >
      {children}
    </select>
  );
}

Select.Item = function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}; 