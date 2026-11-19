// Reel Legends: USA service worker.
// Everything is fetched network-first, so a new version always loads when the phone is online and the
// page, scripts and styles never mix versions; the cached copy is used only when offline.
// On update it removes only this game's own old caches, never other apps' caches on this site.
const PREFIX='artifacts-reel-legends-';
const CACHE=PREFIX+'v1';
const FILES=['./','./index.html','./manifest.webmanifest','./style.css','./data.js','./engine.js','./render.js','./app.js','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-512-maskable.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const put=(req,res)=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}return res;};
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const page=req.mode==='navigate'||req.destination==='document';
  e.respondWith(fetch(req).then(r=>put(req,r)).catch(()=>caches.match(req).then(hit=>hit||(page?caches.match('./index.html'):Response.error()))));
});
