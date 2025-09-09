import { Workbox } from 'workbox-window';

let wb: Workbox | null = null;

export function registerServiceWorker(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ('serviceWorker' in navigator) {
      wb = new Workbox('/sw.js');

      wb.addEventListener('installed', (event) => {
        if (event.isUpdate) {
          console.log('New service worker installed, will activate on next visit');
          
          // Optionally show update notification to user
          if (confirm('New version available! Reload to update?')) {
            window.location.reload();
          }
        } else {
          console.log('Service worker installed for the first time');
        }
      });

      wb.addEventListener('waiting', () => {
        console.log('Service worker is waiting to activate');
        
        // Show update prompt
        if (confirm('New version available! Reload to update?')) {
          wb?.addEventListener('controlling', () => {
            window.location.reload();
          });
          
          // Send message to skip waiting
          wb?.messageSkipWaiting();
        }
      });

      wb.addEventListener('controlling', () => {
        console.log('Service worker is now controlling the page');
      });

      wb.register()
        .then((registration) => {
          console.log('Service worker registered successfully:', registration);
          resolve();
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
          reject(error);
        });
    } else {
      console.log('Service workers are not supported in this browser');
      reject(new Error('Service workers not supported'));
    }
  });
}

export function unregisterServiceWorker(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          const promises = registrations.map(registration => registration.unregister());
          return Promise.all(promises);
        })
        .then(() => {
          console.log('All service workers unregistered');
          resolve();
        })
        .catch((error) => {
          console.error('Error unregistering service workers:', error);
          reject(error);
        });
    } else {
      resolve();
    }
  });
}

export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}