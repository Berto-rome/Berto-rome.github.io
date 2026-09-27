'use strict';
const PRIVATE_APP='https://super-profe-may.berto-rome86.workers.dev';
const base=new URL('./',location.href),form=document.querySelector('form'),button=form.querySelector('button'),status=document.querySelector('#status');
const activation=new URLSearchParams(location.hash.slice(1)).get('acceso');
if(location.hash)history.replaceState(null,'',location.pathname);
function credential(value){
  value=value.trim();
  if(value.startsWith('https://')){
    const link=new URL(value);
    if(!((link.origin===PRIVATE_APP&&link.pathname==='/__login')||(link.origin===location.origin&&link.pathname===base.pathname)))throw Error('Ese no es el enlace privado de esta app.');
    return new URLSearchParams(link.hash.slice(1)).get('acceso')||'';
  }
  return value;
}
async function enter(value){
  button.disabled=true;status.textContent='Entrando…';
  try{
    const response=await fetch(new URL('__login',base),{method:'POST',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({password:credential(value),remember:'1'}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok||result.authenticated!==true)throw Error(result.error||'No se ha podido entrar.');
    form.reset();location.replace(base.href);
  }catch(e){status.textContent=e instanceof TypeError||e.name==='TimeoutError'||e.name==='SyntaxError'?'No se ha podido conectar. Comprueba la conexión e inténtalo de nuevo.':e.message;button.disabled=false;}
}
form.addEventListener('submit',event=>{event.preventDefault();enter(document.querySelector('#access').value);});
(async()=>{
  try{
    if(!('serviceWorker' in navigator))throw Error('Abre este enlace con un navegador actualizado.');
    await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    button.disabled=false;status.textContent='Pega tu enlace privado y pulsa Entrar. Tus datos se conservan.';
    if(activation)await enter(activation);
    else {const response=await fetch(new URL('__session',base),{cache:'no-store',signal:AbortSignal.timeout(8000)});if(response.ok)location.replace(base.href);}
  }catch(e){status.textContent='No se ha podido preparar el acceso. Cierra la app y vuelve a abrirla con conexión.';}
})();
