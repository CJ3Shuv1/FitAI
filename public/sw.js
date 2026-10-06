// Minimal service worker: makes FitAI installable and shows a friendly page
// when a navigation fails offline. It deliberately caches nothing — the app
// is fully server-rendered per user, so stale cached pages would be wrong.

const OFFLINE_HTML = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FitAI</title></head>
<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#15140F;color:#EDE8DD;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div>
<div style="font-size:44px">📡</div>
<h1 style="font-size:20px;margin:12px 0 6px">Gerade offline</h1>
<p style="color:#9C9588;margin:0 0 16px">FitAI braucht eine Internetverbindung. Sobald du wieder online bist, geht's weiter.</p>
<button onclick="location.reload()" style="padding:12px 22px;border:0;border-radius:12px;background:#D97B3F;color:#1A1209;font-weight:700;font-size:15px">Neu laden</button>
</div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    )
  );
});
