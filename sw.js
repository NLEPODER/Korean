const CACHE='sejong-v6';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-192-maskable.png','./icon-512-maskable.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.hostname==='api.github.com')return; // ne jamais mettre l'API GitHub en cache (le sha doit rester frais)
  const isHTML=e.request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('.html');
  const isManual=url.pathname.includes('/manuals/');
  if(isHTML||isManual){
    // network-first : l'app et les manuels restent à jour ; le cache sert de repli hors-ligne
    e.respondWith(fetch(e.request).then(resp=>{
      const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return resp;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
    return;
  }
  // cache-first pour les assets statiques (icônes, manifeste, polices)
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return resp;
  }).catch(()=>caches.match('./index.html'))));
});
