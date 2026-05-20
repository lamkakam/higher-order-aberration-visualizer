export function registerServiceWorker(): Promise<ServiceWorkerRegistration> | undefined {
  if (!('serviceWorker' in navigator)) {
    return undefined;
  }

  return navigator.serviceWorker.register('/sw.js');
}
