/* Generic private-app gateway. No app code, credentials or pupil data are here. */
'use strict';
const PRIVATE_APP='https://super-profe-may.berto-rome86.workers.dev';
const DB='super-profe-access',STORE='device';
const scope=new URL(self.registration.scope);
const assets=new Set(['','index.html','app.js','data.js','school-calendar.js','vault.js','access.js','version.js','style.css','xlsx.full.min.js','__session','__login','__logout']);
const safeHeaders={'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
let database;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function token(value){
  const d=await db();
  return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,value===undefined?'readonly':'readwrite'),store=tx.objectStore(STORE);let result;
    const r=value===undefined?store.get('token'):value===null?store.delete('token'):store.put(value,'token');
    r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result||null);tx.onerror=tx.onabort=()=>reject(tx.error||Error('storage'));
  });
}
const reply=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{...safeHeaders,'Content-Type':'application/json',...extra}});
async function gate(){return fetch(new URL('index.html',scope),{cache:'no-store'});}
async function proxy(event,path){
  const request=event.request,method=request.method;
  if(path==='__logout'&&method==='POST'){await token(null);return new Response(null,{status:204,headers:safeHeaders});}
  if(path==='__login'&&method==='POST'){
    const upstream=await fetch(PRIVATE_APP+'/__bridge/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:await request.text(),credentials:'omit',cache:'no-store'});
    const value=await upstream.json();
    if(!upstream.ok)return reply({error:value.error||'No se ha podido entrar.'},upstream.status);
    if(typeof value.deviceToken!=='string'||!value.deviceToken.startsWith('bridge.1.'))return reply({error:'No se ha podido comprobar el acceso.'},502);
    try{await token(value.deviceToken);}catch(e){return reply({error:'El navegador no ha podido recordar el acceso. Comprueba el espacio disponible y vuelve a intentarlo.'},503);}
    return reply({authenticated:true});
  }
  if(path==='__login'&&method==='GET')return gate();
  if(!['GET','HEAD'].includes(method))return new Response('Método no admitido',{status:405,headers:safeHeaders});
  const access=await token();
  if(!access)return request.mode==='navigate'?gate():reply({authenticated:false},401);
  const upstream=await fetch(PRIVATE_APP+'/'+path,{method,headers:{Authorization:'Bearer '+access},credentials:'omit',cache:'no-store'});
  if(upstream.status===401){await token(null);return request.mode==='navigate'?gate():reply({authenticated:false},401);}
  if(path==='__session'&&upstream.ok){
    const value=await upstream.json();if(value.deviceToken)await token(value.deviceToken);
    return reply({authenticated:value.authenticated===true},200,{'X-SuperProfe-Release':upstream.headers.get('X-SuperProfe-Release')||''});
  }
  // A fresh Response keeps relative asset URLs on the installed origin.
  const headers=new Headers(upstream.headers);headers.delete('Set-Cookie');headers.delete('Access-Control-Allow-Origin');headers.delete('Access-Control-Expose-Headers');
  return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
}
// The old cached app gets time to finish editing. Activate after it closes;
// never delete its caches, localStorage, settings, timetable or pupil records.
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const path=url.pathname.slice(scope.pathname.length);
  if(!assets.has(path)&&!path.startsWith('fonts/'))return;
  event.respondWith(proxy(event,path).catch(()=>event.request.mode==='navigate'
    ? new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Super Profe</title><h1>Sin conexión</h1><p>Tus datos siguen guardados. Vuelve a abrir la app cuando tengas conexión.</p></html>',{status:503,headers:{...safeHeaders,'Content-Type':'text/html;charset=utf-8'}})
    : reply({error:'No se ha podido conectar.'},503)));
});
