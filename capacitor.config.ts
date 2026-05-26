import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wala.tienda',
  appName: 'WALA',
  webDir: 'build',
  backgroundColor: '#7C3AED',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '572322137024-0bl118c7mnuglq3fbnbdlhv5kg36dp9a.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#7C3AED',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;