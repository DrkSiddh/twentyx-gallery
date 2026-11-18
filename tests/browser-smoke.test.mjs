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
  assert.equal(t.doc.getElementById('artist-count').textContent,'16');
  assert.equal(t.doc.getElementById('work-count').textContent,'320');
  assert.equal(t.doc.querySelectorAll('.collection-card').length,16);
  assert.match(t.doc.querySelector('#feature-image').src,/pbs\.twimg\.com\/media/);
  assert.ok(['Skelevaggio','Stunnifer','Pepavaggio','WEB3GISEL','HPLoveBux #postAmericana FineArt Illustration','DTN'].includes(t.doc.querySelector('#feature-title').textContent));
  assert.equal(t.doc.querySelectorAll('.card-mosaic img').length,320);
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
  assert.equal(t.doc.querySelectorAll('.checkartist').length,16);
  t.doc.querySelector('#launch-selection').click();
  assert.ok(t.doc.querySelector('#cinema').classList.contains('active'));
  assert.match(t.doc.querySelector('#cinema-img').src,/pbs\.twimg\.com\/media/);
  assert.equal(t.doc.querySelector('#cinema-filmstrip'),null,'No thumbnail strip must obscure the artwork');
  assert.equal(t.doc.querySelectorAll('.cinema-viewport img#cinema-img').length,1);
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


test('single-word artist names cannot wrap and dynamic fit marks both headlines',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,55));
  assert.equal(t.doc.querySelector('#feature-title').textContent.length>0,true);
  const feature=t.doc.querySelector('#feature-title');
  feature.textContent='Pepavaggio';t.win.fitArtistHeadlines();
  assert.ok(feature.classList.contains('single-moniker'));
  t.doc.querySelector('.artist-open').click();
  assert.ok(t.doc.querySelector('#artist-title').classList.contains('single-moniker'));
  const styles=readFileSync('styles.css','utf8');
  assert.match(styles,/\.feature-artist-name\.single-moniker[^}]+white-space:nowrap/);
  assert.match(styles,/font-family:'Oxanium'/);
  const template=readFileSync('src/index.template.html','utf8');
  assert.match(template,/family=Oxanium/);
 }finally{t.close()}
});

test('fullscreen autoplay hides controls but restores them on interaction or pause',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,55));
  t.doc.querySelector('#choose-slideshow').click();
  t.doc.querySelector('#launch-selection').click();
  const cinema=t.doc.querySelector('#cinema');
  assert.equal(cinema.classList.contains('playing'),true,'autoplay should start');
  t.win.hideCinemaControls();
  assert.equal(cinema.classList.contains('controls-hidden'),true,'playing cinema should fade UI');
  cinema.dispatchEvent(new t.win.Event('pointermove',{bubbles:true}));
  assert.equal(cinema.classList.contains('controls-hidden'),false,'pointer movement reveals UI');
  t.win.hideCinemaControls();
  cinema.dispatchEvent(new t.win.Event('touchstart',{bubbles:true}));
  assert.equal(cinema.classList.contains('controls-hidden'),false,'touch reveals UI');
  t.doc.querySelector('#cinema-play').click();
  assert.equal(cinema.classList.contains('playing'),false,'pause ends auto-fade');
  t.win.hideCinemaControls();
  assert.equal(cinema.classList.contains('controls-hidden'),false,'paused mode must remain visible');
  t.doc.querySelector('#cinema-close').click();
  assert.equal(cinema.classList.contains('active'),false);
 }finally{t.close()}
});


test('priority lineup leads every unfiltered gallery and cycles each hour',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,60));
  const priority=['skelevaggio','stunnifer','pepavaggio','giselxphoto','hplovebux','artxygenishim'];
  const cards=[...t.doc.querySelectorAll('.collection-card')].map(x=>x.querySelector('.card-handle').textContent.toLowerCase());
  for(const name of priority) assert.ok(cards.slice(0,6).some(c=>c.includes('@'+name)),'missing front-row priority '+name);
  const hour=Math.floor(Date.now()/3600000);
  const scheduled=priority.map((_,i)=>t.win.currentFeature((hour+i)*3600000).artist);
  assert.equal(new Set(scheduled.map(x=>x.postUrl)).size,6,'no artist should hold an adjacent hourly slot');
  assert.equal(t.win.currentFeature((hour+6)*3600000).artist.postUrl,scheduled[0].postUrl,'feature queue repeats');
  assert.equal(t.doc.querySelectorAll('#feature-ticker-track .ticker-entry').length,16);
  assert.match(t.doc.querySelector('#feature-next-change').textContent,/NEXT FEATURE IN/);
  t.doc.querySelector('#search').value='YenaArt';
  t.doc.querySelector('#search').dispatchEvent(new t.win.Event('input',{bubbles:true}));
  assert.equal(t.doc.querySelectorAll('.collection-card').length,1,'explicit search excludes priorities');
 }finally{t.close()}
});

test('Themes switch all views and persisted selected theme routes to matching original-art brochure',async()=>{
 const t=boot('https://twentyx.artvision.today/@stunnifer/','@stunnifer/index.html');
 try{
  await new Promise(done=>setTimeout(done,55));
  const themes=[...t.doc.querySelectorAll('#theme-select option')].map(x=>x.value);
  assert.deepEqual(themes,['violet','analog','heritage']);
  const select=t.doc.querySelector('#theme-select');
  assert.equal(t.doc.querySelector('#theme-dock').dataset.open,'false');
  t.doc.querySelector('#theme-dock-tab').click();
  assert.equal(t.doc.querySelector('#theme-dock').dataset.open,'true');
  select.value='analog';
  select.dispatchEvent(new t.win.Event('change',{bubbles:true}));
  assert.equal(t.doc.body.dataset.theme,'analog');
  assert.equal(t.doc.querySelector('#theme-dock').dataset.open,'false','theme dock automatically retracts');
  assert.equal(t.win.localStorage.getItem('twentyx-theme-v1'),'analog');
  const downloaded=[];
  t.win.fetch=async()=>({ok:true});
  t.win.HTMLAnchorElement.prototype.click=function(){downloaded.push({href:this.href,filename:this.download})};
  t.doc.querySelector('#download-qr').click();
  await new Promise(done=>setTimeout(done,35));
  assert.match(downloaded[0].href,/--analog\.png$/);
  select.value='heritage';
  select.dispatchEvent(new t.win.Event('change',{bubbles:true}));
  t.doc.querySelector('#download-qr').click();
  await new Promise(done=>setTimeout(done,35));
  assert.match(downloaded[1].href,/--heritage\.png$/);
  const css=readFileSync('styles.css','utf8');
  assert.match(css,/#7400B8/);
  assert.match(css,/#FFCAD4/);
  assert.doesNotMatch(css,/--theme-image:\\s*url\\(/,'no displayed colorway image');
 }finally{t.close()}
});

test('time phases include the exclusive 4:20 to 4:43 PM green window',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,50));
  const NativeDate=t.win.Date;
  const mock=(minute)=>{t.win.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[2026,10,17,16,minute,0]))}};t.win.setDayPhase()};
  mock(19);assert.notEqual(t.doc.body.dataset.phase,'green');
  mock(20);assert.equal(t.doc.body.dataset.phase,'green');
  mock(43);assert.equal(t.doc.body.dataset.phase,'green');
  mock(44);assert.notEqual(t.doc.body.dataset.phase,'green');
  t.win.Date=NativeDate;
 }finally{t.close()}
});

test('X community and follow actions open centered site dialogs, not navigate away',async()=>{
 const t=boot('https://twentyx.artvision.today/@stunnifer/','@stunnifer/index.html');
 try{
  await new Promise(done=>setTimeout(done,50));
  const before=t.win.location.href;
  t.doc.querySelector('#enter-artvision').click();
  assert.ok(t.doc.querySelector('#x-action-modal').open);
  assert.match(t.doc.querySelector('#x-action-title').textContent,/ArtVision community/);
  t.doc.querySelector('#x-action-done').click();
  assert.equal(t.doc.querySelector('#x-action-modal').open,false);
  t.doc.querySelector('#follow-link').click();
  assert.equal(t.doc.querySelector('#x-action-modal').open,true);
  assert.match(t.doc.querySelector('#x-action-title').textContent,/@stunnifer/);
  let opened='';
  t.win.open=(url)=>{opened=url;return {closed:false}};
  t.doc.querySelector('#x-action-continue').click();
  assert.match(opened,/intent\/follow/);
  assert.equal(t.win.location.href,before,'original exhibition stays in current page');
 }finally{t.close()}
});


test('Skelevaggio enters as top priority with 20 authentic images and a dedicated permalink',async()=>{
 const t=boot('https://twentyx.artvision.today/@skelevaggio/','@skelevaggio/index.html');
 try{
  await new Promise(done=>setTimeout(done,45));
  assert.equal(t.doc.querySelector('#artist-title').textContent,'Skelevaggio');
  assert.equal(t.doc.querySelectorAll('#artist-wall img').length,20);
  assert.equal(t.doc.querySelector('#original-link').href,'https://x.com/skelevaggio/status/2122828926619992070');
  const seed=JSON.parse(t.doc.querySelector('#seeded-artists').textContent);
  const skelevaggio=seed.find(x=>x.handle==='skelevaggio');
  assert.equal(skelevaggio.media.length,20);
  assert.equal(new Set(skelevaggio.media).size,20);
  assert.match(skelevaggio.media[0],/HXXKTlKbAAASVo4/);
 }finally{t.close()}
});

test('site offers readable retractable vertical theme dock and slide-out curated guide',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,45));
  assert.equal(t.doc.querySelector('#theme-dock').dataset.open,'false');
  assert.equal(t.doc.querySelectorAll('.theme-toggle select').length,1,'only one compact theme selector');
  const button=t.doc.querySelector('#theme-dock-tab');
  button.click();
  assert.equal(button.getAttribute('aria-expanded'),'true');
  t.doc.querySelector('#theme-dock-close').click();
  assert.equal(button.getAttribute('aria-expanded'),'false');
  t.doc.querySelector('#header-guide').click();
  const guide=t.doc.querySelector('#guide-drawer');
  assert.ok(guide.open,'curation drawer opens');
  for(const tab of ['faq','terms','ideas']){
   guide.querySelector('[data-guide-tab="'+tab+'"]').click();
   assert.equal(guide.querySelector('[data-guide-panel="'+tab+'"]').hidden,false);
  }
  t.doc.querySelector('#guide-close').click();
  assert.equal(guide.open,false);
  const css=readFileSync('styles.css','utf8');
  assert.match(css,/\\.theme-dock\\[data-open="true"\\]/);
  assert.match(css,/\\.guide-drawer\\[open\\]/);
  assert.match(css,/font-size:clamp\\(19px/);
 }finally{t.close()}
});

test('ArtVision invite contains complete 20-image hashtag instructions and curation actions',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,45));
  t.doc.querySelector('#enter-artvision').click();
  const modal=t.doc.querySelector('#x-action-modal');
  assert.equal(modal.open,true);
  assert.equal(t.doc.querySelector('#x-action-copy').textContent,
   'join the artVision community and post twenty images with the hashtag #TwentyX to join this exhibition.');
  t.doc.querySelector('#x-action-guide').click();
  assert.equal(modal.open,false);
  assert.equal(t.doc.querySelector('#guide-drawer').open,true);
  t.doc.querySelector('#guide-community').click();
  assert.equal(modal.open,true);
 }finally{t.close()}
});

test('negative space derives from the current artwork in all three presentation modes',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,45));
  const heroSrc=t.doc.querySelector('#feature-image').src;
  assert.ok(t.doc.querySelector('#feature-artwork').style.getPropertyValue('--artwork-source').includes(heroSrc));
  t.doc.querySelector('.artist-open').click();
  t.doc.querySelector('#spatial-mode').click();
  const stage=t.doc.querySelector('#stage-main');
  assert.ok(t.doc.querySelector('#spatial-current').style.getPropertyValue('--artwork-source').includes(stage.src));
  t.doc.querySelector('#play-artist').click();
  const theater=t.doc.querySelector('#cinema-img');
  assert.ok(t.doc.querySelector('.cinema-viewport').style.getPropertyValue('--artwork-source').includes(theater.src));
  const css=readFileSync('styles.css','utf8');
  assert.match(css,/\\.feature-artwork::before/);
  assert.match(css,/\\.perspective-scene button::before/);
  assert.match(css,/\\.cinema-viewport::before/);
  assert.match(css,/object-fit:contain/);
 }finally{t.close()}
});
