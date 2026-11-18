import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { isNativeApp } from '../utils/native';

interface PWAInstallButtonProps {
  compact?: boolean;
}

// Already a native app — there is nothing to install.
export const PWAInstallButton: React.FC<PWAInstallButtonProps> = (props) =>
  isNativeApp ? null : <PWAInstallButtonWeb {...props} />;

const PWAInstallButtonWeb: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
        App is installed on this device and works offline.
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          compact
            ? 'flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0'
            : 'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800'
        }
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'flex min-h-[40px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50 whitespace-nowrap shrink-0'
              : 'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50'
          }
        >
          <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <h3 id="ios-install-title" className="text-base font-bold text-stone-900">
                Install on iPhone / iPad
              </h3>
              <ol className="mt-3 space-y-2 text-sm text-stone-700 list-decimal list-inside">
                <li>
                  Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> to use offline like a native app.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[48px] w-full rounded-xl bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (compact) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-relaxed text-stone-600">
      To install on Android Chrome: tap the browser menu (<strong>⋮</strong>) and choose{' '}
      <strong>Add to Home screen</strong> or <strong>Install app</strong>.
    </div>
  );
};
