import React from 'react';
import { cn } from '../../lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-gray-300 bg-white shadow-xs text-sm text-gray-900 placeholder:text-gray-400 dark:bg-white/[0.03] dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-shadow disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
} 