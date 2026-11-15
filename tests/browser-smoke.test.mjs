import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

function boot(url='https://twentyx.artvision.today/',file='index.html'){
 const html=readFileSync(file,'utf8');
 const errors=[];
 const console=new VirtualConsole();
 console.on('jsdomError',err=>errors.push(err.message));
 console.on('error',msg=>errors.push(msg));
 console.on('warn',(...args)=>errors.push('WARN: '+args.map(a=>String(a)).join(' :: ')));
 const seed=html.match(/<script id="seeded-artists" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
 if(!seed)errors.push('MISSING SEED TAG');else try{const data=JSON.parse(seed);if(!Array.isArray(data))errors.push('SEED NOT ARRAY')}catch(e){errors.push('INVALID SEED JSON: '+e.message+' near '+seed.slice(0,120))}
 const dom=new JSDOM(html,{
  url,
  runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,
  beforeParse(win){
   win.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
   win.scrollTo=()=>{};
   win.fetch=()=>Promise.reject(new Error('No network in offline smoke test'));
   if(win.HTMLDialogElement){
    win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
    win.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
   }
  }
 });
 return {dom,win:dom.window,doc:dom.window.document,errors,close:()=>dom.window.close()};
}
test('inline script boots with live statistics and working search',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,40));
  assert.deepEqual(t.errors.filter(e=>!e.startsWith('WARN: Live refresh unavailable')),[],t.errors.join('\n'));
  assert.equal(t.doc.getElementById('artist-count').textContent,'9');
  assert.equal(t.doc.getElementById('work-count').textContent,'180');
  assert.equal(t.doc.querySelectorAll('.collection-card').length,9);
  assert.match(t.doc.querySelector('#feature-image').src,/pbs\.twimg\.com\/media/);
  assert.match(t.doc.querySelector('#feature-title').textContent,/Pepavaggio/);
  assert.equal(t.doc.querySelectorAll('.card-mosaic img').length,180);
  const input=t.doc.querySelector('#search');
  input.value='Stunnifer';input.dispatchEvent(new t.win.Event('input',{bubbles:true}));
  assert.equal(t.doc.querySelectorAll('.collection-card').length,1,'search should filter the exhibit');
  assert.match(t.doc.querySelector('.collection-card').textContent,/Stunnifer/);
  t.doc.querySelector('.artist-open').click();
  assert.equal(t.doc.querySelector('#artist-view').hidden,false);
  assert.equal(t.doc.querySelectorAll('#artist-wall img').length,20);
 }finally{t.close()}
});
test('slideshow selection opens and shows an actual artwork',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,40));
  t.doc.querySelector('#choose-slideshow').click();
  assert.ok(t.doc.querySelector('#selection-modal').open,'selection dialog should open');
  assert.equal(t.doc.querySelectorAll('.checkartist').length,9);
  t.doc.querySelector('#launch-selection').click();
  assert.ok(t.doc.querySelector('#cinema').classList.contains('active'));
  assert.match(t.doc.querySelector('#cinema-img').src,/pbs\.twimg\.com\/media/);
  assert.equal(t.doc.querySelector('#cinema-filmstrip'),null,'No thumbnail strip must obscure the artwork');
  assert.equal(t.doc.querySelectorAll('#cinema-viewport img#cinema-img').length,1);
  t.doc.querySelector('#cinema-next').click();
  assert.match(t.doc.querySelector('#cinema-progress').textContent,/02 \/ 20/);
 }finally{t.close()}
});

test('clean @stunnifer route opens solo exhibition and old post-ID URL remains supported',async()=>{
 const clean=boot('https://twentyx.artvision.today/@stunnifer/','@stunnifer/index.html');
 try{
  await new Promise(done=>setTimeout(done,45));
  assert.equal(clean.doc.querySelector('#artist-view').hidden,false);
  assert.equal(clean.doc.querySelector('#artist-title').textContent,'Stunnifer');
  assert.equal(clean.doc.querySelectorAll('#artist-wall img').length,20);
  clean.doc.querySelector('#back-to-all').click();
  assert.equal(clean.win.location.pathname,'/');
 }finally{clean.close()}
 const legacy=boot('https://twentyx.artvision.today/?artist=2121572867485626453');
 try{
  await new Promise(done=>setTimeout(done,45));
  assert.equal(legacy.doc.querySelector('#artist-title').textContent,'Stunnifer');
 }finally{legacy.close()}
});


test('artist credits use display type; brochure download is a same-origin file',async()=>{
 const t=boot('https://twentyx.artvision.today/@stunnifer/','@stunnifer/index.html');
 try{
  await new Promise(done=>setTimeout(done,45));
  assert.equal(t.doc.querySelector('.artist-presenter').textContent,'Presented by ArtVision');
  assert.match(t.doc.querySelector('.artist-presenter').className,/iridescent/);
  const captures=[];
  t.win.HTMLAnchorElement.prototype.click=function(){captures.push({href:this.href,filename:this.download})};
  t.doc.querySelector('#download-qr').click();
  await new Promise(done=>setTimeout(done,30));
  assert.equal(captures.length,1);
  assert.match(captures[0].href,/\/welcome\/stunnifer-2121572867485626453\.(svg|png)$/);
  assert.match(captures[0].filename,/^TwentyX-stunnifer-exhibition\.(svg|png)$/i);
 }finally{t.close()}
});
