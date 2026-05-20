import { resolvePublicAssetPath } from '../publicAssetUrls';

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> | undefined {
  if (!('serviceWorker' in navigator)) {
    return undefined;
  }

  return navigator.serviceWorker.register(resolvePublicAssetPath('/sw.js'), {
    scope: import.meta.env.BASE_URL
  });
}
