/* Service worker da Luz (PWA — Fase E). Um só, escopo "/", pros dois apps
 * (painel do dono/profissional e app do estabelecimento pro cliente).
 *
 * - Navegação: sempre rede primeiro (agenda tem que estar atualizada); sem
 *   conexão, mostra /offline.html. Nada de cache de API ou de páginas.
 * - Push: mostra a notificação; o clique abre/foca a URL que veio no payload.
 *
 * Mudou este arquivo? Suba VERSION pra forçar a troca do cache offline. */
const VERSION = "luz-sw-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Luz", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Luz";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      icon: data.icon || "/pwa-icon?app=luz&size=192",
      badge: "/pwa-icon?app=luz&size=192",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url === target && "focus" in win) return win.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
