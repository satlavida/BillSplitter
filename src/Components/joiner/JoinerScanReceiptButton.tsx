import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal, FileUpload, Spinner, Alert } from '../../ui/components';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import ReceiptBoundaryEditor, { computeStartingQuad } from '../ReceiptBoundaryEditor';
import { enhanceReceiptFromImageAndQuad, loadImageFile, type Quad } from '../../lib/receiptEnhance';
import { dataUrlToBlob } from '../../lib/imageStore';
import { uploadLiveImage } from '../../lib/liveApi';
import { scanLiveBillReceipt } from '../../lib/joinerReceiptScan';
import type { LiveBill } from '../../schemas/live.schema';

const SCAN_ERROR_COPY: Record<'offline' | 'failed', string> = {
  offline: 'Scanning service is unreachable. Check your connection and try again.',
  failed: "Couldn't read that receipt. Try again, or dismiss and enter items manually.",
};

interface JoinerScanReceiptButtonProps {
  code: string;
  bill: LiveBill;
  myPersonId: string | null;
  joinerToken: string | null;
  disabled?: boolean;
  onScanned: () => void;
}

// Joiner-side mirror of ScanReceiptButton.tsx (creator): same pick/capture
// -> crop -> enhance pipeline (reusing ReceiptBoundaryEditor/receiptEnhance,
// which are already framework/store-agnostic), but pushes the image +
// scanned items straight to the live server (joinerReceiptScan.ts) instead
// of through sessionStore, since a joiner has no local persisted store for
// this session. Unlike the creator's fire-and-forget background scan, this
// stays modal-open with its own spinner/error state until the scan
// resolves — there's no per-bill scanStatus on LiveBill to show a
// background indicator elsewhere (see architecture/live-collaboration.md).
const JoinerScanReceiptButton = ({ code, bill, myPersonId, joinerToken, disabled, onScanned }: JoinerScanReceiptButtonProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [editableQuad, setEditableQuad] = useState<Quad | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isOnline = useOnlineStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetCropState = () => {
    setSelectedImg(null);
    setEditableQuad(null);
    setIsLoadingImage(false);
    setIsProcessing(false);
  };

  const openModal = () => {
    if (!isOnline) {
      setIsOfflineModalOpen(true);
      return;
    }
    setIsModalOpen(true);
    setError(null);
    resetCropState();
  };

  // JoinerSessionView.tsx's "Scan New Bill" creates an empty bill, then
  // navigates straight to this bill's step 1 with this nav-state flag so
  // the scan modal opens immediately — mirrors ScanReceiptButton.tsx's own
  // autoOpenScan handling on the creator side. Read/cleared here (not by
  // JoinerBillEditorPage) so it survives however long the session/bill
  // fetch takes to resolve before this component actually mounts; clearing
  // it a level up unconditionally on first render raced that fetch and
  // cleared the flag before this component ever saw it.
  useEffect(() => {
    if (!(location.state as { autoOpenScan?: boolean } | null)?.autoOpenScan || disabled) return;
    openModal();
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
    resetCropState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setError('Please select an image file');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('The selected file is not an image. Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size exceeds 5MB. Please select a smaller image.');
      return;
    }

    setError(null);
    setIsLoadingImage(true);
    try {
      const img = await loadImageFile(file);
      setSelectedImg(img);
      // No auto-detection (see receiptEnhance.ts's detectReceiptBoundary) —
      // always start from the full image and let the user drag the
      // boundary in by hand.
      setEditableQuad(computeStartingQuad(null, img));
    } catch (err) {
      console.error('Failed to load selected image:', err);
      setError('Failed to load the selected image. Please try a different photo.');
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleConfirmCrop = async () => {
    if (!selectedImg || !editableQuad) {
      setError('Failed to process receipt. Please try again.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const enhanced = await enhanceReceiptFromImageAndQuad(selectedImg, editableQuad);
      const blob = dataUrlToBlob(enhanced.dataUrl);

      await uploadLiveImage(code, bill.id, blob, enhanced.width, enhanced.height, joinerToken ?? undefined);
      const result = await scanLiveBillReceipt(code, bill, blob, myPersonId, joinerToken);

      closeModal();
      onScanned();
      if (!result.ok && result.errorKind) {
        setError(SCAN_ERROR_COPY[result.errorKind]);
      }
    } catch (err) {
      console.error('Error processing receipt:', err);
      setError('Failed to process receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openModal} disabled={disabled}>
        Scan Receipt
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedImg ? 'Crop Receipt' : 'Upload Receipt'}
        className={selectedImg ? 'max-w-2xl max-h-[85vh] overflow-y-auto' : undefined}
      >
        {!selectedImg ? (
          <div>
            <FileUpload ref={fileInputRef} label="Select receipt image" accept="image/*" error={error} onChange={handleFileChange} disabled={isLoadingImage} />
            {isLoadingImage && (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                <Spinner size="sm" /> Loading photo...
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={closeModal} type="button">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-medium mb-2 dark:text-white">Select receipt area</h3>
            {editableQuad && (
              <>
                <ReceiptBoundaryEditor
                  img={selectedImg}
                  quad={editableQuad}
                  onChange={setEditableQuad}
                  className="max-w-full max-h-[60vh] border border-zinc-200 dark:border-zinc-700 rounded"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Drag the corners so they line up with the receipt's edges.</p>
                <div className="flex gap-2 mt-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditableQuad(computeStartingQuad(null, selectedImg))}>
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
              <Button onClick={handleConfirmCrop} disabled={isProcessing || !editableQuad}>
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

      <Modal isOpen={isOfflineModalOpen} onClose={() => setIsOfflineModalOpen(false)} title="Offline">
        <Alert type="warning">
          <p>You are offline. Scan Receipt requires an internet connection.</p>
        </Alert>
        <div className="flex justify-end">
          <Button onClick={() => setIsOfflineModalOpen(false)}>OK</Button>
        </div>
      </Modal>
    </>
  );
};

export default JoinerScanReceiptButton;
