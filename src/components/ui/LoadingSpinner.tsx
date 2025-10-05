import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
};

export function LoadingSpinner({ 
  size = 'md', 
  text, 
  className = '', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const spinnerElement = (
    <div className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin`} />
      {text && <span>{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen dark:bg-gray-900 bg-gray-50 flex items-center justify-center">
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
}
