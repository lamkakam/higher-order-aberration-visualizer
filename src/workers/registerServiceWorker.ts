import { resolvePublicAssetPath } from '../publicAssetUrls';

export function registerServiceWorker(
  basePath = import.meta.env.BASE_URL
): Promise<ServiceWorkerRegistration> | undefined {
  if (!('serviceWorker' in navigator)) {
    return undefined;
  }

  return navigator.serviceWorker.register(resolvePublicAssetPath('/sw.js', basePath), {
    scope: basePath,
    updateViaCache: 'none'
  });
}
