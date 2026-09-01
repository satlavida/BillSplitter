import { memo, type ReactNode } from 'react';

export interface PrintWrapperProps {
  children: ReactNode;
}

// Print wrapper for styling print content
export const PrintWrapper = memo(({ children }: PrintWrapperProps) => {
  return (
    <div className="print-content">
      {children}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
          #sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
});
