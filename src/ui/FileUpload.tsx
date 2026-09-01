import { memo, type ComponentProps, type ReactNode } from 'react';

export interface FileUploadProps extends ComponentProps<'input'> {
  label?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

// File upload component
export const FileUpload = memo(
  ({ label, accept, onChange, error, containerClassName = '', capture, onClick, ref, ...props }: FileUploadProps) => {
    return (
      <div className={`mb-4 ${containerClassName}`}>
        {label && (
          <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors">
            {label}
          </label>
        )}
        <input
          type="file"
          ref={ref}
          accept={accept}
          onChange={onChange}
          onClick={onClick}
          // Only add capture attribute when it's provided
          {...(capture ? { capture } : {})}
          className="block w-full text-sm text-zinc-700 dark:text-zinc-300 transition-colors
          file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
          file:text-sm file:font-medium
          file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100
          dark:file:bg-blue-900 dark:file:text-blue-200"
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400 transition-colors">{error}</p>}
      </div>
    );
  }
);
