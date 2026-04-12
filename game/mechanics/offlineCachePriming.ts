const OFFLINE_PRIME_CACHE_NAME = 'hero-adventure-offline-prime-v1';
const OFFLINE_PRIME_SW_READY_TIMEOUT_MS = 3500;
const OFFLINE_PRIME_FETCH_TIMEOUT_MS = 5000;
const OFFLINE_PRIME_MAX_ASSETS = 96;

const CORE_OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-icon.svg',
  '/pwa-icon-maskable.svg',
  '/apple-touch-icon.svg',
] as const;

export interface OfflinePrimeStats {
  attempted: number;
  cached: number;
  failed: number;
  skipped: number;
}

const canPrimeOfflineCache = () => (
  typeof window !== 'undefined'
  && typeof caches !== 'undefined'
  && typeof fetch === 'function'
);

const normalizePrimeUrl = (input: string) => {
  if (!input || input.includes('undefined') || /^data:|^blob:/i.test(input)) {
    return null;
  }

  try {
    const parsed = new URL(input, window.location.href);
    if (parsed.origin !== window.location.origin) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
};

const waitForServiceWorkerReady = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => window.setTimeout(resolve, OFFLINE_PRIME_SW_READY_TIMEOUT_MS)),
  ]);
};

const fetchWithTimeout = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), OFFLINE_PRIME_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'reload',
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const toUniquePrimeUrls = (assetUrls: string[]) => {
  const allUrls = [...assetUrls, ...CORE_OFFLINE_URLS];
  const normalized = allUrls
    .map((url) => normalizePrimeUrl(url))
    .filter((url): url is string => Boolean(url));

  return [...new Set(normalized)].slice(0, OFFLINE_PRIME_MAX_ASSETS);
};

export const primeOfflineBootCache = async (assetUrls: string[]): Promise<OfflinePrimeStats> => {
  if (!canPrimeOfflineCache() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return {
      attempted: 0,
      cached: 0,
      failed: 0,
      skipped: 0,
    };
  }

  await waitForServiceWorkerReady();

  const primeUrls = toUniquePrimeUrls(assetUrls);
  if (primeUrls.length === 0) {
    return {
      attempted: 0,
      cached: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const cache = await caches.open(OFFLINE_PRIME_CACHE_NAME);
  const stats: OfflinePrimeStats = {
    attempted: primeUrls.length,
    cached: 0,
    failed: 0,
    skipped: 0,
  };

  for (const url of primeUrls) {
    try {
      const existing = await cache.match(url, { ignoreSearch: false });
      if (existing) {
        stats.skipped += 1;
        continue;
      }

      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        stats.failed += 1;
        continue;
      }

      await cache.put(url, response.clone());
      stats.cached += 1;
    } catch {
      stats.failed += 1;
    }
  }

  return stats;
};
