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
        "w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500",
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