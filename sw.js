const CACHE='sejong-v2';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const isManual=new URL(e.request.url).pathname.includes('/manuals/');
  if(isManual){
    // network-first : « Rafraîchir » récupère les manuels à jour ; le cache sert de repli hors-ligne
    e.respondWith(fetch(e.request).then(resp=>{
      const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return resp;
    }).catch(()=>caches.match(e.request)));
    return;
  }
  // cache-first pour la coquille de l'app
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return resp;
  }).catch(()=>caches.match('./index.html'))));
});
