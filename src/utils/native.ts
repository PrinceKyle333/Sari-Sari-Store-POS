import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor Android/iOS shell (not a browser/PWA). */
export const isNativeApp = Capacitor.isNativePlatform();

export const nativePlatform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

/** Configure status bar + hide splash once the React tree has mounted. */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ]);
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    if (nativePlatform === 'android') {
      await StatusBar.setBackgroundColor({ color: '#023824' }).catch(() => {});
    }
    await SplashScreen.hide().catch(() => {});
  } catch {
    // Plugins unavailable — non-fatal.
  }
}
