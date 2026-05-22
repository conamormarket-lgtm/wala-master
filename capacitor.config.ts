import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wala.tienda',
  appName: 'WALA',
  webDir: 'build',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '572322137024-0bl118c7mnuglq3fbnbdlhv5kg36dp9a.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
