import { useEffect, useRef } from 'react';
import { isNativeApp } from '../utils/native';

/**
 * Hooks the Android hardware/gesture back button.
 * `handler` should close the top-most UI layer and return true, or return
 * false when there is nothing left to close — in which case the app exits.
 */
export function useAndroidBackButton(handler: () => boolean): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isNativeApp) return;
    let remove: (() => void) | undefined;
    let disposed = false;

    void import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        if (!handlerRef.current()) {
          void App.exitApp();
        }
      }).then((listener) => {
        if (disposed) void listener.remove();
        else remove = () => void listener.remove();
      })
    );

    return () => {
      disposed = true;
      remove?.();
    };
  }, []);
}
