import { useState, useRef, useEffect, type ChangeEvent, type MouseEvent, type RefObject } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import useSessionStore from '../sessionStore';
import { Button, Modal, FileUpload, Spinner, Alert } from '../ui/components';
import useOnlineStatus from '../hooks/useOnlineStatus';
import ReceiptBoundaryEditor, { computeStartingQuad } from './ReceiptBoundaryEditor';
import { detectReceiptBoundary, enhanceReceiptFromImageAndQuad, loadImageFile, type Quad } from '../lib/receiptEnhance';
import { saveImageBlob, dataUrlToBlob } from '../lib/imageStore';
import { generateId } from '../lib/generateId';
import { scanBillReceipt } from '../lib/receiptScan';

interface ModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUpload: () => void;
  onSelectCapture: () => void;
}

// Mode Selection Modal Component
const ModeSelectionModal = ({ isOpen, onClose, onSelectUpload, onSelectCapture }: ModeSelectionModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white transition-colors">Choose Method</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-zinc-700 dark:text-zinc-300">How would you like to add your receipt?</p>
        <div className="flex flex-col space-y-4">
          <Button onClick={onSelectUpload} className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Choose from Gallery
          </Button>
          <Button onClick={onSelectCapture} className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            Take Photo
          </Button>
        </div>
      </div>
    </div>
  );
};

interface ReceiptFilePickerProps {
  onCancel: () => void;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileInputClick: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  useCameraCapture: boolean | undefined;
  isDetecting: boolean;
}

// Step 1: pick/capture a receipt photo. Selecting a file immediately hands
// off to the crop step below (loads the image + runs boundary detection)
// rather than requiring a separate "submit" click.
const ReceiptFilePicker = ({
  onCancel,
  error,
  fileInputRef,
  onFileInputClick,
  onFileChange,
  useCameraCapture,
  isDetecting,
}: ReceiptFilePickerProps) => {
  // Only intercept the click if useCameraCapture is undefined
  const handleFileInputClick = (e: MouseEvent<HTMLInputElement>) => {
    if (useCameraCapture === undefined && onFileInputClick) {
      e.preventDefault();
      onFileInputClick();
    }
  };

  return (
    <div>
      <FileUpload
        ref={fileInputRef}
        label={useCameraCapture ? 'Take photo of receipt' : 'Select receipt image'}
        accept="image/*"
        capture={useCameraCapture ? 'environment' : undefined}
        error={error}
        onClick={handleFileInputClick}
        onChange={onFileChange}
        disabled={isDetecting}
      />

      {isDetecting && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
          <Spinner size="sm" /> Analyzing photo...
        </div>
      )}

      <div className="flex justify-end mt-4">
        <Button variant="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
      </div>
    </div>
  );
};

// Main ScanReceiptButton Component
const ScanReceiptButton = () => {
  const { sessionId, billId } = useParams<{ sessionId: string; billId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModeSelectionOpen, setIsModeSelectionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCameraCapture, setUseCameraCapture] = useState<boolean | undefined>(undefined);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

  // Crop step state: set once a file has been picked and loaded.
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [detectedBoundary, setDetectedBoundary] = useState<Quad | null | undefined>(undefined);
  const [editableQuad, setEditableQuad] = useState<Quad | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isOnline = useOnlineStatus();

  const isScanning = useSessionStore((state) => {
    if (!sessionId || !billId) return false;
    return state.getBill(sessionId, billId)?.scanStatus === 'processing';
  });

  // Single file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetCropState = () => {
    setSelectedImg(null);
    setDetectedBoundary(undefined);
    setEditableQuad(null);
    setIsDetecting(false);
    setIsProcessing(false);
  };

  const openModal = () => {
    if (!isOnline) {
      setIsOfflineModalOpen(true);
      return;
    }
    setIsModalOpen(true);
    setError(null);
    setUseCameraCapture(undefined);
    resetCropState();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
    setUseCameraCapture(undefined);
    resetCropState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeOfflineModal = () => {
    setIsOfflineModalOpen(false);
  };

  const openModeSelection = () => {
    setIsModeSelectionOpen(true);
  };

  // Session-page "Scan New Bill" (SessionHomePage.tsx's handleScanNewBill)
  // creates an empty bill, then navigates straight here with this nav-state
  // flag so the scan modal opens immediately instead of landing on a blank
  // items step. Cleared via a state-less replace so browser back/forward
  // through this route doesn't keep re-opening it.
  useEffect(() => {
    if (!(location.state as { autoOpenScan?: boolean } | null)?.autoOpenScan) return;
    openModal();
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModeSelection = () => {
    setIsModeSelectionOpen(false);
  };

  // React effect to trigger file input click when useCameraCapture changes from undefined
  useEffect(() => {
    // Only trigger if useCameraCapture is explicitly true or false (not undefined)
    if (useCameraCapture !== undefined && fileInputRef.current) {
      // Use setTimeout to ensure all state updates and renders have completed
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    }
  }, [useCameraCapture]);

  const handleSelectUpload = () => {
    closeModeSelection();
    setUseCameraCapture(false);
  };

  const handleSelectCapture = () => {
    closeModeSelection();
    setUseCameraCapture(true);
  };

  const validateImageFile = (file: File | undefined): string | null => {
    // Check if file exists
    if (!file) return 'Please select an image file';

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return 'The selected file is not an image. Please select an image file.';
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return 'Image size exceeds 5MB. Please select a smaller image.';
    }

    return null; // No error
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsDetecting(true);

    try {
      const img = await loadImageFile(file as File);
      setSelectedImg(img);

      // A failure here shouldn't block scanning entirely — fall back to
      // letting the user draw the boundary manually over the full image.
      let detected: Quad | null = null;
      try {
        detected = await detectReceiptBoundary(img);
      } catch (detectErr) {
        console.error('Boundary detection failed, falling back to full image:', detectErr);
      }

      setDetectedBoundary(detected);
      setEditableQuad(computeStartingQuad(detected, img));
    } catch (err) {
      console.error('Failed to load selected image:', err);
      setError('Failed to load the selected image. Please try a different photo.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRedetectEdges = async () => {
    if (!selectedImg) return;
    setIsDetecting(true);
    setError(null);
    try {
      const detected = await detectReceiptBoundary(selectedImg);
      setDetectedBoundary(detected);
      setEditableQuad(computeStartingQuad(detected, selectedImg));
    } catch (err) {
      console.error('Redetecting edges failed:', err);
      setError('Could not redetect edges. You can still adjust the boundary manually.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleResetBoundary = () => {
    if (!selectedImg) return;
    setEditableQuad(computeStartingQuad(detectedBoundary ?? null, selectedImg));
  };

  const handleConfirmCrop = async () => {
    if (!sessionId || !billId || !selectedImg || !editableQuad) {
      setError('Failed to process receipt. Please try again.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Perspective-crop to the selected boundary, grayscale + contrast
      // enhance, and resize — then store the result exactly as before.
      // It's both what's shown as the bill's receipt reference and what
      // gets scanned, and it needs to exist in IndexedDB before
      // scanBillReceipt (or a later retry) can read it back.
      const enhanced = await enhanceReceiptFromImageAndQuad(selectedImg, editableQuad);
      const refKey = generateId();
      await saveImageBlob(refKey, dataUrlToBlob(enhanced.dataUrl));

      useSessionStore.getState().updateBill(sessionId, billId, {
        receiptImage: { refKey, width: enhanced.width, height: enhanced.height },
        scanStatus: 'processing',
        scanError: null,
      });

      // Close the modal immediately — scanning happens in the background.
      // scanBillReceipt has its own try/catch and writes results straight
      // to the store, so it's fine that this component may unmount before
      // it resolves.
      closeModal();
      void scanBillReceipt(sessionId, billId);
    } catch (err) {
      console.error('Error preparing receipt image:', err);
      setError('Failed to process receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={openModal} className="mb-2" disabled={isScanning}>
        Scan Receipt
      </Button>

      {isScanning && (
        <div className="flex items-center gap-2 mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Spinner size="sm" />
          Receipt is being scanned…
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedImg ? 'Crop Receipt' : 'Upload Receipt'}
        className={selectedImg ? 'max-w-2xl max-h-[85vh] overflow-y-auto' : undefined}
      >
        {!selectedImg ? (
          <ReceiptFilePicker
            onCancel={closeModal}
            error={error}
            fileInputRef={fileInputRef}
            onFileInputClick={openModeSelection}
            onFileChange={handleFileChange}
            useCameraCapture={useCameraCapture}
            isDetecting={isDetecting}
          />
        ) : (
          <div>
            <h3 className="font-medium mb-2 dark:text-white">Select receipt area</h3>
            {isDetecting && !editableQuad && (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                <Spinner size="sm" /> Detecting receipt edges...
              </div>
            )}
            {editableQuad && (
              <>
                <ReceiptBoundaryEditor
                  img={selectedImg}
                  quad={editableQuad}
                  onChange={setEditableQuad}
                  className="max-w-full max-h-[60vh] border border-zinc-200 dark:border-zinc-700 rounded"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                  Drag the corners so they line up with the receipt's edges.
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="secondary" size="sm" onClick={handleRedetectEdges} disabled={isDetecting}>
                    {isDetecting ? <Spinner size="sm" /> : 'Redetect edges'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleResetBoundary} disabled={isDetecting}>
                    Reset boundary
                  </Button>
                </div>
              </>
            )}

            {error && <Alert type="error">{error}</Alert>}

            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="secondary" onClick={closeModal} type="button">
                Cancel
              </Button>
              <Button onClick={handleConfirmCrop} disabled={isProcessing || isDetecting || !editableQuad}>
                {isProcessing ? (
                  <div className="flex items-center">
                    <Spinner className="mr-2" />
                    Processing...
                  </div>
                ) : (
                  'Use This Crop'
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ModeSelectionModal
        isOpen={isModeSelectionOpen}
        onClose={closeModeSelection}
        onSelectUpload={handleSelectUpload}
        onSelectCapture={handleSelectCapture}
      />

      <Modal isOpen={isOfflineModalOpen} onClose={closeOfflineModal} title="Offline">
        <Alert type="warning">
          <p>You are offline. Scan Receipt requires an internet connection.</p>
        </Alert>
        <div className="flex justify-end">
          <Button onClick={closeOfflineModal}>OK</Button>
        </div>
      </Modal>
    </>
  );
};

export default ScanReceiptButton;
