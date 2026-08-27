import { Modal } from '../ui/components';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
}

// Full-size click-to-view for a thumbnail image (receipt previews), built
// on the generic Modal — widened past Modal's default max-w-md since an
// image benefits from more room than a form/confirmation dialog does.
const ImageLightbox = ({ isOpen, onClose, src, alt }: ImageLightboxProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title={alt} className="max-w-3xl">
    <img src={src} alt={alt} className="max-w-full max-h-[75vh] mx-auto rounded" />
  </Modal>
);

export default ImageLightbox;
