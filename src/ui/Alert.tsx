import { memo, type HTMLAttributes } from 'react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type?: AlertType;
}

// Alert component
export const Alert = memo(({ type = 'info', children, className = '', ...props }: AlertProps) => {
  const types: Record<AlertType, string> = {
    info: 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    success: 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className={`mb-4 p-3 rounded ${types[type] || types.info} transition-colors ${className}`} {...props}>
      {children}
    </div>
  );
});
