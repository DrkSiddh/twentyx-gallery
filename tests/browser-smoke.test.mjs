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
  assert.ok(JSON.parse(t.doc.querySelector('#seeded-artists').textContent).some(a=>a.name===t.doc.querySelector('#feature-title').textContent),'featured work is from an actual artist');
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
  assert.equal(t.doc.querySelector('.artist-presenter').textContent,'20 ORIGINAL WORKS · ONE ARTIST CURATION');
  assert.match(t.doc.querySelector('.artist-presenter').className,/artist-presenter/);
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


test('newest-to-oldest arrivals and priority-first full feature rotation',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,60));
  const priority=['skelevaggio','stunnifer','pepavaggio','giselxphoto','hplovebux','artxygenishim'];
  const cards=[...t.doc.querySelectorAll('.collection-card')].map(x=>x.querySelector('.card-handle').textContent.toLowerCase());
  const seed=JSON.parse(t.doc.querySelector('#seeded-artists').textContent);
  const recentFirst=[...seed].sort((a,b)=>b.postId.localeCompare(a.postId)).map(a=>'@'+a.handle.toLowerCase()+' on x');
  assert.deepEqual(cards,recentFirst,'gallery blocks must show newest artist posts first');
  assert.ok(cards.length===16);
  const hour=Math.floor(Date.now()/3600000);
  const scheduled=Array.from({length:cards.length},(_,i)=>t.win.currentFeature((hour+i)*3600000).artist);
  assert.equal(new Set(scheduled.map(x=>x.postUrl)).size,cards.length,'every artist must receive an hourly feature before the cycle restarts');
  assert.equal(t.win.currentFeature((hour+cards.length)*3600000).artist.postUrl,scheduled[0].postUrl,'featured cycle repeats after all artists');
  const restart=t.win.currentFeature(0).lineup;
  assert.deepEqual(Array.from(restart.slice(0,priority.length),a=>String(a.handle).toLowerCase()),priority,'curatorial priorities lead each full featured cycle');
  assert.equal(t.doc.querySelectorAll('#feature-ticker-track .ticker-entry').length,2*Math.max(8,cards.length));
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
  assert.equal(css.includes('--theme-image:url('),false,'no displayed colorway image');
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
  assert.ok(css.includes('.theme-dock[data-open="true"]'));
  assert.ok(css.includes('.guide-drawer[open]'));
  assert.equal(css.includes('font-size:clamp(19px'),true,'readable mobile body type');
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
  assert.ok(css.includes('.feature-artwork::before'));
  assert.ok(css.includes('.perspective-scene button::before'));
  assert.ok(css.includes('.cinema-viewport::before'));
  assert.match(css,/object-fit:contain/);
 }finally{t.close()}
});

test('ArtVision branding is not duplicated, ticker is above hero, and mailing list has explicit choices',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,40));
  const logo=t.doc.querySelector('#home-link');
  assert.match(logo.textContent,/TwentyX/);
  assert.match(logo.textContent,/Presented by ArtVision/);
  assert.equal(t.doc.querySelectorAll('#phase-label').length,0);
  assert.ok(t.doc.querySelector('.top-feature-schedule').compareDocumentPosition(t.doc.querySelector('.hero')) & t.win.Node.DOCUMENT_POSITION_FOLLOWING);
  const form=t.doc.querySelector('#opportunity-signup');
  assert.ok(form);
  assert.deepEqual([...form.querySelectorAll('input[name="cadence"]')].map(x=>x.value),['weekday','weekly','weekend']);
  assert.equal(form.querySelector('#subscribe-consent').required,true);
 }finally{t.close()}
});

test('gallery artist cards have no artwork matte, 20 natural-size uncut images and concise metadata',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,40));
  const cards=[...t.doc.querySelectorAll('.collection-card')];
  assert.equal(cards.length,16);
  for(const card of cards){
   const artworks=card.querySelectorAll('.card-mosaic .artwork-thumb');
   assert.equal(artworks.length,20);
   assert.ok([...artworks].every(tile=>!tile.style.getPropertyValue('--artwork-source')),'artwork-grid tiles must not paint duplicate blur backgrounds');
   assert.match(card.querySelector('.card-handle').textContent,/@.* on X/);
   assert.match(card.querySelector('.card-date').textContent,/\d{2} \d{2} \d{4} curation/);
   assert.ok(card.querySelector('.card-explore'));
   assert.ok(card.querySelector('.card-footer a[data-follow]'));
  }
  const css=readFileSync('styles.css','utf8');
  assert.match(css,/\.card-mosaic \.artwork-thumb img/);
  assert.match(css,/object-fit:contain/);
  assert.match(css,/column-count:4;column-gap:2px/);
  assert.ok(css.includes('height:auto!important'),'tile height must be intrinsic');
  assert.ok(css.includes('content:none!important'),'blurred thumbnail layers must be removed');
 }finally{t.close()}
});


test('art leads: XXL then six curator picks then short editorial intro, all before gallery blocks',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,65));
  const home=t.doc.querySelector('#home-view');
  const feature=home.querySelector('.feature-section');
  const selected=home.querySelector('#featured-six');
  const hero=home.querySelector('.hero');
  const gallery=home.querySelector('#home-gallery');
  const order=[feature,selected,hero,gallery];
  for(let i=1;i<order.length;i++){
   assert.ok(order[i-1].compareDocumentPosition(order[i]) & t.win.Node.DOCUMENT_POSITION_FOLLOWING,'art before editorial before archive');
  }
  const featured=[...t.doc.querySelectorAll('.featured-six-card')];
  assert.equal(featured.length,6);
  const handles=['skelevaggio','stunnifer','pepavaggio','giselxphoto','hplovebux','artxygenishim'];
  const seed=JSON.parse(t.doc.querySelector('#seeded-artists').textContent);
  const expected=handles.map(handle=>seed.find(a=>a.handle.toLowerCase()===handle).name);
  assert.deepEqual(featured.map(x=>x.querySelector('.featured-six-name').textContent),expected);
  assert.ok(featured.every(x=>x.querySelector('.featured-six-art img')));
  assert.ok(featured.every(x=>x.querySelector('.featured-six-art').style.getPropertyValue('--artwork-source')));
  featured[0].click();
  assert.equal(t.doc.querySelector('#artist-title').textContent,'Skelevaggio');
 }finally{t.close()}
});

test('theme fonts restored and permanent TwentyX logo font fixed; ticker flush edge-to-edge',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,50));
  const css=readFileSync('styles.css','utf8');
  assert.ok(css.includes("font-family:'Analog Pixel Calculon'"));
  assert.ok(css.includes("font-family:'Heritage Stellari'"));
  assert.ok(css.includes("font-family:'Analog Multivac'"));
  assert.ok(css.includes("font-family:'Heritage SAIBA'"));
  assert.ok(css.includes(".brand-wordmark"));
  assert.ok(css.includes("font-family:'Dune Rise','Oxanium',sans-serif!important"));
  assert.equal(css.includes('CONSOLIDATED EDITORIAL TYPOGRAPHY'),false,'theme-level font flattening must stay removed');
  assert.ok(css.includes('border-radius:0!important'),'ticker is edge to edge');
  assert.equal(t.doc.querySelector('.top-feature-schedule .feature-ticker-track')!==null,true);
 }finally{t.close()}
});
