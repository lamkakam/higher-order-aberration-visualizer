import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../registerServiceWorker';

describe('registerServiceWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the service worker under the current Vite base path when supported', () => {
    const registration = Promise.resolve({} as ServiceWorkerRegistration);
    const register = vi.fn(() => registration);

    vi.stubGlobal('navigator', {
      serviceWorker: {
        register
      }
    });

    expect(registerServiceWorker()).toBe(registration);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  });

  it('does nothing when service workers are unsupported', () => {
    vi.stubGlobal('navigator', {});

    expect(registerServiceWorker()).toBeUndefined();
  });
});
