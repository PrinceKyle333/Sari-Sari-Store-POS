import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tindahanpos.app',
  appName: 'Reston Store',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // hidden from JS once React has mounted
      backgroundColor: '#023824',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#023824',
      style: 'DARK',
      overlaysWebView: false,
    },
  },
};

export default config;
