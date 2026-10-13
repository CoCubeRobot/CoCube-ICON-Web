import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

document.addEventListener('DOMContentLoaded', () => {
  if (Capacitor.isNativePlatform()) {
    void Promise.allSettled([StatusBar.hide(), SplashScreen.hide()]);
  }
})

