import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CameraOff, Flashlight, Keyboard, RefreshCw, X } from 'lucide-react';
import type { ScannerSettings } from '../types/pos';
import { shouldAcceptScan } from '../utils/posLogic';
import { playScanBeep, triggerScanVibration } from '../utils/audio';

interface BarcodeScannerProps {
  open: boolean;
  title?: string;
  continuousMode?: boolean;
  onToggleContinuous?: (next: boolean) => void;
  scannerSettings: ScannerSettings;
  lastScannedMessage?: string | null;
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  open,
  title = 'Scan Barcode',
  continuousMode = false,
  onToggleContinuous,
  scannerSettings,
  lastScannedMessage,
  onDetected,
  onClose,
}) => {
  const reactId = useId().replace(/:/g, '');
  const readerId = `barcode-reader-${reactId}`;

  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const continuousRef = useRef(continuousMode);
  const settingsRef = useRef(scannerSettings);

  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;
  continuousRef.current = continuousMode;
  settingsRef.current = scannerSettings;

  useEffect(() => {
    if (!open) {
      setManualCode('');
      setTorchOn(false);
      setTorchSupported(false);
      setCameraError(null);
      setPermissionDenied(false);
      return;
    }

    let cancelled = false;
    let instance: Html5Qrcode | null = null;

    const startScanner = async () => {
      setCameraStarting(true);
      setCameraError(null);
      setPermissionDenied(false);

      // Give DOM container one frame to mount
      await new Promise((r) => setTimeout(r, 60));
      if (cancelled) return;

      const el = document.getElementById(readerId);
      if (!el) return;

      try {
        instance = new Html5Qrcode(readerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: settingsRef.current.preferredCamera },
          {
            fps: 12,
            qrbox: { width: 260, height: 150 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            const now = Date.now();
            if (!shouldAcceptScan(lastScanRef.current, decodedText, now, 1500)) {
              return;
            }
            const clean = decodedText.trim();
            lastScanRef.current = { code: clean, timestamp: now };
            playScanBeep(settingsRef.current.beepEnabled);
            triggerScanVibration(settingsRef.current.vibrationEnabled);
            onDetectedRef.current(clean);
            if (!continuousRef.current) {
              onCloseRef.current();
            }
          },
          () => {
            // Ignore per-frame decode misses
          }
        );

        if (cancelled) {
          await instance.stop().catch(() => undefined);
          return;
        }

        // Check torch capability safely
        try {
          const capabilities = instance.getRunningTrackCameraCapabilities();
          const torchFeature = capabilities?.torchFeature?.();
          if (torchFeature && torchFeature.isSupported()) {
            setTorchSupported(true);
          }
        } catch {
          setTorchSupported(false);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        const lower = msg.toLowerCase();
        if (
          lower.includes('permission') ||
          lower.includes('notallowed') ||
          lower.includes('denied')
        ) {
          setPermissionDenied(true);
          setCameraError(
            'Camera permission was denied. Please allow camera access in your browser settings, or type the barcode below.'
          );
        } else {
          setCameraError(
            'Camera is unavailable on this device. You can type or paste the barcode manually below.'
          );
        }
      } finally {
        if (!cancelled) {
          setCameraStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      const active = scannerRef.current ?? instance;
      scannerRef.current = null;
      if (active) {
        active
          .stop()
          .then(() => active.clear())
          .catch(() => {
            try {
              active.clear();
            } catch {
              // ignore cleanup errors
            }
          });
      }
    };
  }, [open, readerId, retryCount, scannerSettings.preferredCamera]);

  const handleToggleTorch = async () => {
    const active = scannerRef.current;
    if (!active || !torchSupported) return;
    try {
      const capabilities = active.getRunningTrackCameraCapabilities();
      const torchFeature = capabilities?.torchFeature?.();
      if (torchFeature && torchFeature.isSupported()) {
        const nextState = !torchOn;
        await torchFeature.apply(nextState);
        setTorchOn(nextState);
      }
    } catch {
      // Torch toggle not supported at runtime
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCode.trim();
    if (!cleaned) return;
    const now = Date.now();
    lastScanRef.current = { code: cleaned, timestamp: now };
    playScanBeep(scannerSettings.beepEnabled);
    triggerScanVibration(scannerSettings.vibrationEnabled);
    onDetected(cleaned);
    setManualCode('');
    if (!continuousMode) {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-white">{title}</h2>
          <p className="truncate text-xs text-stone-400">
            EAN-13, EAN-8, UPC, Code 128, QR
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {torchSupported && (
            <button
              type="button"
              onClick={() => void handleToggleTorch()}
              aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              aria-pressed={torchOn}
              className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${
                torchOn
                  ? 'border-amber-400 bg-amber-500 text-stone-950'
                  : 'border-stone-700 bg-stone-900 text-white hover:bg-stone-800'
              }`}
            >
              <Flashlight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[48px] items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{continuousMode ? 'Done' : 'Cancel'}</span>
          </button>
        </div>
      </div>

      {/* Continuous scan status & toggle inside scanner when available */}
      {(onToggleContinuous || lastScannedMessage) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 bg-stone-900/70 px-4 py-2.5">
          {onToggleContinuous && (
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm font-medium text-stone-200">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => onToggleContinuous(e.target.checked)}
                className="h-5 w-5 rounded accent-emerald-500"
              />
              <span>Continuous scan</span>
            </label>
          )}
          {lastScannedMessage && (
            <div className="text-xs font-semibold text-emerald-300">
              {lastScannedMessage}
            </div>
          )}
        </div>
      )}

      {/* Viewfinder Area */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
        {cameraError ? (
          <div className="w-full max-w-sm rounded-2xl border border-stone-800 bg-stone-900 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <CameraOff className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-base font-bold text-white">
              {permissionDenied ? 'Camera Access Needed' : 'Camera Not Available'}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">{cameraError}</p>
            {permissionDenied && (
              <ol className="mt-3 space-y-1 text-left text-xs text-stone-400 list-decimal list-inside">
                <li>Tap the lock or settings icon in your browser address bar.</li>
                <li>Set Camera permission to Allow.</li>
                <li>Tap Retry Camera below.</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Retry Camera</span>
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-stone-700 bg-black">
            <div id={readerId} className="w-full min-h-[260px]" />
            {/* Visible scan frame overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-36 w-64 rounded-xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
            </div>
            {cameraStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-950/80 text-sm font-medium text-stone-300">
                Starting camera...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Barcode Input Fallback */}
      <form
        onSubmit={handleManualSubmit}
        className="border-t border-stone-800 bg-stone-900 p-4 pb-safe"
      >
        <label
          htmlFor="manual-barcode-input"
          className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-300"
        >
          <Keyboard className="h-4 w-4 text-stone-400" aria-hidden="true" />
          <span>Type barcode manually (fallback)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="manual-barcode-input"
            type="text"
            inputMode="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g. 4807770270017"
            className="min-h-[48px] flex-1 rounded-xl border border-stone-700 bg-stone-950 px-3.5 text-base font-mono-num text-white placeholder:text-stone-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[48px] rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-600 shrink-0"
          >
            Enter
          </button>
        </div>
      </form>
    </div>
  );
};
