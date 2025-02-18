import React from 'react';
import { cn } from '../../lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500",
        className
      )}
      {...props}
    />
  );
} 