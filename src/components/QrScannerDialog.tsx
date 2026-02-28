import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export function QrScannerDialog({ isOpen, onClose, onScanSuccess }: QrScannerDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  const containerId = "qr-reader";

  // Keep the latest callback without triggering re-renders
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onCloseRef.current = onClose;
  }, [onScanSuccess, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    let isMounted = true;
    let isStopping = false;
    let scanner: Html5Qrcode | null = null;
    let startPromise: Promise<any> | null = null;

    const safeStop = async () => {
      if (isStopping || !scanner) return;
      isStopping = true;
      try {
        if (startPromise) {
          // If start is still resolving, wait for it before stopping!
          // Html5Qrcode throws if stop() happens concurrently with start()
          await startPromise.catch(() => {});
        }
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (err) {
        // ignore stop errors
      }
    };

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode(containerId);
        startPromise = scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (decodedText.startsWith("otpauth://")) {
              if (!isStopping) {
                safeStop();
                onScanSuccessRef.current(decodedText);
                onCloseRef.current();
              }
            }
          },
          () => {} // ignore frame scan fails
        );
        await startPromise;
      } catch (err: any) {
        if (isMounted && !isStopping) {
          setError(err?.message || "Failed to start camera.");
        }
      }
    };

    const timer = setTimeout(startScanner, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      safeStop();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                       w-[320px] glass-strong border border-border-subtle rounded-2xl overflow-hidden
                       shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h3 className="text-sm font-semibold text-primary">Scan QR Code</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           hover:bg-white/[0.06] transition-colors duration-200 cursor-pointer"
                title="Cancel scanning"
              >
                <X className="w-4 h-4 text-muted" strokeWidth={1.5} />
              </button>
            </div>
            
            <div className="p-4 bg-black/40 flex items-center justify-center min-h-[250px]">
              {error ? (
                <div className="text-xs text-danger-text text-center px-4">{error}</div>
              ) : (
                <div id={containerId} className="w-full pt-4 rounded-lg overflow-hidden [&>video]:rounded-lg" />
              )}
            </div>
            
            <div className="px-4 py-3 border-t border-border-subtle text-center">
              <p className="text-[10px] text-muted-dark leading-tight">
                Position your 2FA QR code within the frame to automatically fill the secret
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
