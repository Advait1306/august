import { X } from "lucide-react";

interface CheckoutModalProps {
  url: string;
  onClose: () => void;
}

export function CheckoutModal({ url, onClose }: CheckoutModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative h-[80%] w-[80%] rounded-lg bg-white shadow-xl">
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 shadow-md hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
        <iframe
          src={url}
          className="h-full w-full rounded-lg"
          title="Checkout"
        />
      </div>
    </div>
  );
}
