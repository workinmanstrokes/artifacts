// Loop Pop service worker.
// The game page is fetched network-first so new versions reach installed phones; everything else
// (icons) is served from cache and refreshed in the background. Only OK responses are cached.
// On update it removes only this copy's own old caches (and its legacy 'looppop-v2'), never the
// caches of other games and apps on this site.
const PREFIX='artifacts-looppop-';
const C=PREFIX+'v3';
const OWN=n=>n==='looppop-v2'||n.startsWith(PREFIX);
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>OWN(n)&&n!==C).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
const put=(req,res)=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp)).catch(()=>{});}return res;};
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const page=req.mode==='navigate'||req.destination==='document';
  if(page){e.respondWith(fetch(req).then(r=>put(req,r)).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));return;}
  e.respondWith(caches.match(req).then(hit=>{const net=fetch(req).then(r=>put(req,r)).catch(()=>hit||Response.error());return hit||net;}));
});
