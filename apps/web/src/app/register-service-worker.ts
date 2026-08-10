const LOCAL_REVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const WORKBOX_CACHE_PREFIX = "workbox-";

async function unregisterLocalServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(WORKBOX_CACHE_PREFIX))
        .map((cacheName) => caches.delete(cacheName))
    );
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (LOCAL_REVIEW_HOSTS.has(window.location.hostname)) {
    await unregisterLocalServiceWorkers();
    return;
  }

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await registration.update();
  }
}
