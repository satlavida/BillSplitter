import { useRef, useState, useCallback, type ChangeEvent } from 'react';
import { Button, Alert } from '../../ui/components';

interface FileImportProps {
  onImport: (fileContent: string) => void;
  buttonText?: string;
  acceptTypes?: string;
}

const FileImport = ({ onImport, buttonText = 'Import File', acceptTypes = '.json' }: FileImportProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset error
      setError(null);

      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          // Try to parse as JSON first
          const fileContent = event.target?.result as string;

          // Pass the raw file content to parent handler
          onImport(fileContent);
        } catch (err) {
          setError(`Failed to read file: ${(err as Error).message}`);
        }
      };

      reader.onerror = () => {
        setError('Error reading file');
      };

      reader.readAsText(file);

      // Reset the input value
      e.target.value = '';
    },
    [onImport]
  );

  return (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={acceptTypes} className="hidden" />

      <Button variant="secondary" onClick={handleButtonClick}>
        {buttonText}
      </Button>

      {error && <Alert type="error" className="mt-2">{error}</Alert>}
    </div>
  );
};

export default FileImport;
