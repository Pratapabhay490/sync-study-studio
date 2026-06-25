/* Service worker for Let's be in sync push notifications */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Let's be in sync", body: "You have a new update", url: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    try { payload.body = event.data ? event.data.text() : payload.body; } catch (e) {}
  }
  const options = {
    body: payload.body,
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || payload.kind || "lbis",
    renotify: true,
    data: { url: payload.url || "/dashboard", ...payload.data },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const c of wins) {
        if ("focus" in c) {
          c.navigate ? c.navigate(url) : null;
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
