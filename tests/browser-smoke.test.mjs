import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

const publishedArtists=JSON.parse(readFileSync('artists.json','utf8'));
const newestFirst=artists=>[...artists].sort((a,b)=>b.postId.localeCompare(a.postId));
const roomIds=['postphotography','sketchbook','illustrated','anime'];
function uncategorizedArtists(gallery){
 const curatedIds=new Set(roomIds.flatMap(room=>gallery.curationArtists(room).map(a=>a.postId)));
 return newestFirst(publishedArtists.filter(a=>!curatedIds.has(a.postId)));
}
function assertGalleryTotals(doc){
 assert.equal(Number(doc.getElementById('artist-count').textContent),publishedArtists.length);
 assert.equal(doc.getElementById('work-count').textContent,(publishedArtists.length*20).toLocaleString('en-US'));
}

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
  assertGalleryTotals(t.doc);
  assert.equal(t.doc.querySelectorAll('.collection-card').length,10);
  assert.match(t.doc.querySelector('#feature-image').src,/pbs\.twimg\.com\/media/);
  assert.ok(JSON.parse(t.doc.querySelector('#seeded-artists').textContent).some(a=>a.name===t.doc.querySelector('#feature-title').textContent),'featured work is from an actual artist');
  assert.equal(t.doc.querySelectorAll('.card-mosaic img').length,200);
  const input=t.doc.querySelector('#search');
  input.value='Stunnifer';input.dispatchEvent(new t.win.Event('input',{bubbles:true}));
  assert.equal(t.doc.querySelectorAll('.collection-card').length,1,'search should filter the exhibit');
  assert.match(t.doc.querySelector('.collection-card').textContent,/Stunnifer/);
  t.doc.querySelector('.artist-name-link').click();
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
  assert.equal(t.doc.querySelectorAll('.checkartist').length,publishedArtists.length);
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
  assert.equal(t.doc.querySelector('.artist-presenter'),null,'repetitive presenter label is removed');
  assert.match(t.doc.querySelector('#artist-handle').textContent,/@stunnifer on X/);
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
  t.doc.querySelector('#search').value='Stunnifer';
   t.doc.querySelector('#search').dispatchEvent(new t.win.Event('input',{bubbles:true}));
   t.doc.querySelector('.artist-name-link').click();
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
  const priorityHandles=['skelevaggio','stunnifer','pepavaggio','giselxphoto','hplovebux','artxygenishim','exolorian','jjjjere','ctwlk','turonworld','allthebots','nikdraperivey'];
  const seed=JSON.parse(t.doc.querySelector('#seeded-artists').textContent);
  const priority=seed.filter(a=>priorityHandles.includes(a.handle.toLowerCase())).sort((a,b)=>b.postId.localeCompare(a.postId)).map(a=>a.handle.toLowerCase());
  const cards=[...t.doc.querySelectorAll('.collection-card')].map(x=>x.querySelector('.card-handle').textContent.toLowerCase());
  const recentFirst=Array.from(t.win.curationArtists('postphotography'),a=>'@'+a.handle.toLowerCase()+' on x');
  assert.deepEqual(cards,recentFirst,'gallery blocks must show newest artist posts first');
  assert.ok(cards.length===10);
  const hour=Math.floor(Date.now()/3600000);
  const scheduled=Array.from({length:priority.length},(_,i)=>t.win.currentFeature((hour+i)*3600000).artist);
  const featuredLength=priority.length;
  assert.equal(new Set(scheduled.map(x=>x.postUrl)).size,featuredLength,'all twelve curated featured artists rotate');
  assert.ok(!scheduled.some(a=>String(a.handle).toLowerCase()==='ciphervoss'));
  assert.equal(t.win.currentFeature((hour+featuredLength)*3600000).artist.postUrl,scheduled[0].postUrl,'featured cycle repeats after all eligible artists');
  const restart=t.win.currentFeature(0).lineup;
  assert.deepEqual(Array.from(restart.slice(0,priority.length),a=>String(a.handle).toLowerCase()),priority,'curatorial priorities lead each full featured cycle');
  assert.equal(t.doc.querySelectorAll('#feature-ticker-track .ticker-entry').length,2*Math.max(8,featuredLength));
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
  assert.deepEqual(themes,['violet','analog','heritage','nostalgia','glitch']);
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
  t.doc.querySelector('.artist-name-link').click();
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
  assert.equal(cards.length,10);
  for(const card of cards){
   const artworks=card.querySelectorAll('.card-mosaic .artwork-thumb');
   assert.equal(artworks.length,20);
   assert.ok([...artworks].every(tile=>!tile.style.getPropertyValue('--artwork-source')),'artwork-grid tiles must not paint duplicate blur backgrounds');
   assert.match(card.querySelector('.card-handle').textContent,/@.* on X/);
   assert.match(card.querySelector('.card-date').textContent,/\d{2} \d{2} \d{4} curation/);
   assert.equal(card.querySelector('.card-explore'),null,'Explore overlay belongs only to the featured exhibitions');
   assert.ok(card.querySelector('.artist-name-link'));
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


test('twelve newest-first featured original artworks lead the gallery',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,65));
  const home=t.doc.querySelector('#home-view');
  const feature=home.querySelector('.feature-section');
  const selected=t.doc.querySelector('#featured-six');
  const header=t.doc.querySelector('.topbar');
  const ticker=t.doc.querySelector('.top-feature-schedule');
  const hero=home.querySelector('.hero');
  const gallery=home.querySelector('#home-gallery');
  const order=[t.doc.querySelector('#arrival-image'),selected,t.doc.querySelector('.arrival-curations'),header,ticker,feature,hero,gallery];
  assert.ok(order.every(Boolean),'all required elements must be present');
  for(let i=1;i<order.length;i++){
   assert.ok(order[i-1].compareDocumentPosition(order[i]) & t.win.Node.DOCUMENT_POSITION_FOLLOWING,'twelve featured artworks first, then wordmark, ticker, XXL and gallery');
  }
  const featured=[...t.doc.querySelectorAll('.featured-six-card')];
  assert.equal(featured.length,12,'twelve distinct artist exhibitions are featured');
  const handles=['skelevaggio','stunnifer','pepavaggio','giselxphoto','hplovebux','artxygenishim','exolorian','jjjjere','ctwlk','turonworld','allthebots','nikdraperivey'];
  const seed=JSON.parse(t.doc.querySelector('#seeded-artists').textContent);
  assert.ok(handles.every(handle=>seed.some(a=>a.handle.toLowerCase()===handle)),'every featured artist has a verified complete exhibition');
  const names=seed.filter(a=>handles.includes(a.handle.toLowerCase())).sort((a,b)=>b.postId.localeCompare(a.postId)).map(a=>a.handle.toLowerCase()==='ctwlk'?'CTWLK XR · @ctwlk':a.name);
  assert.deepEqual(featured.map(x=>x.querySelector('.featured-six-name').textContent),names);
  assert.ok(featured.every(x=>x.querySelector('.featured-six-art img')),'all twelve features show actual artist artwork');
  assert.ok(featured.every(x=>x.querySelector('.featured-six-art').style.getPropertyValue('--artwork-source')));
  assert.ok(featured.every(x=>x.querySelector('.featured-six-cta')?.textContent.includes('Explore the 20')));
  assert.equal(t.doc.querySelectorAll('.arrival-curations a').length,6);
  const ctwlk=featured.find(card=>card.querySelector('.featured-six-name').textContent.includes('CTWLK XR'));
  ctwlk.click();
  assert.equal(t.doc.querySelector('#artist-title').textContent,'CTWLK XR Models');
  assert.equal(t.win.location.pathname,'/@ctwlk/');
  assert.equal(t.doc.querySelectorAll('#artist-wall img').length,20);
  t.win.history.pushState(null,'','/');
  t.win.renderRoute();
  assert.match(readFileSync('styles.css','utf8'),/object-fit:contain!important/);
  const css=readFileSync('styles.css','utf8');
  assert.ok(css.includes('.featured-six-card>.featured-six-cta'),'featured CTA has an absolute artwork overlay');
  assert.ok(css.includes('height:clamp(580px,62vw,900px)!important'),'XXL artwork frame uses its full edge-to-edge viewport area');
  featured[0].click();
  assert.equal(t.doc.querySelector('#artist-title').textContent,'Futurist Motor Club ✨');
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


test('artwork-derived color palettes and original plus two new theme identities',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,55));
  const css=readFileSync('styles.css','utf8');
  assert.ok(css.includes('body[data-art-color="ready"]'),'artwork atmosphere is styled');
  assert.ok(css.includes('body[data-theme="violet"] .brand-wordmark'),'ArtVision identity');
  assert.ok(css.includes("font-family:'Computerist'"),'Computerist wordmark');
  assert.ok(css.includes("font-family:'Golden Girdle'"),'metadata Golden Girdle');
  assert.ok(css.includes("font-family:'Analog Pixel Calculon'"),'Nostalgia ticker');
  assert.ok(css.includes("font-family:'Analog Multivac'"),'Glitch heading');
  assert.equal(typeof t.win.extractArtworkColors,'function','original image palette engine exists');
  const sample=new Uint8ClampedArray(4*10*10);
  for(let i=0;i<sample.length;i+=4){
   sample[i]=211;sample[i+1]=177;sample[i+2]=28;sample[i+3]=255;
  }
  const color=t.win.extractArtworkColors(sample,10,10);
  assert.match(color.edge,/rgb\(211 177 28\)/);
  t.doc.querySelector('#theme-select').value='glitch';
  t.doc.querySelector('#theme-select').dispatchEvent(new t.win.Event('change',{bubbles:true}));
  assert.equal(t.doc.body.dataset.theme,'glitch');
 }finally{t.close()}
});

test('no redundant XXL or ticker labels; gallery route hides opportunities and feature six',async()=>{
 const t=boot('https://twentyx.artvision.today/@stunnifer/','@stunnifer/index.html');
 try{
  await new Promise(done=>setTimeout(done,55));
  assert.equal(t.doc.body.dataset.view,'artist');
  assert.equal(t.doc.querySelector('#opportunities').open,false);
  assert.equal(t.doc.querySelector('#header-subscribe').hidden,false);
  assert.equal(t.doc.querySelector('#featured-six').hidden,true);
  assert.equal(t.doc.querySelector('.artist-presenter'),null);
  assert.equal(t.doc.querySelector('.feature-program-head .overline'),null);
  assert.equal(t.doc.querySelector('.feature-label-row .overline'),null);
  assert.match(t.doc.querySelector('.artist-interaction-cue').textContent,/Tap or click/);
 }finally{t.close()}
});

test('landscape-first ordering, newsletter drawer and cross-artist cinema navigation',async()=>{
 const t=boot();try{
  await new Promise(done=>setTimeout(done,55));
  const arrival=t.doc.getElementById('arrival-image');
  assert.ok(arrival,'artwork-first arrival exists');
  assert.ok(arrival.compareDocumentPosition(t.doc.querySelector('.topbar')) & t.win.Node.DOCUMENT_POSITION_FOLLOWING,'landscape precedes any menus');
  t.doc.getElementById('header-subscribe').click();
  assert.equal(t.doc.getElementById('opportunities').open,true);
  t.doc.getElementById('opportunities-close').click();
  assert.equal(t.doc.getElementById('opportunities').open,false);
  t.doc.getElementById('feature-artwork').click();
  const before=t.doc.getElementById('cinema-artist').textContent;
  t.doc.getElementById('cinema-next-artist').click();
  assert.notEqual(t.doc.getElementById('cinema-artist').textContent,before);
  assert.match(t.doc.getElementById('cinema-progress').textContent,/IN THIS CURATION/);
  assert.ok(t.doc.getElementById('cinema-download'));
 }finally{t.close()}
});

test('spatial carousel restores exclusive visibility and artwork navigation',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,50));
  t.doc.querySelector('.artist-name-link').click();
  const wall=t.doc.getElementById('artist-wall');
  const stage=t.doc.getElementById('spatial-stage');
  assert.equal(wall.hidden,false,'artist room starts on its exhibition wall');
  assert.equal(stage.hidden,true);
  t.doc.getElementById('spatial-mode').click();
  assert.equal(wall.hidden,true,'masonry wall must be fully hidden when spatial is active');
  assert.equal(wall.getAttribute('aria-hidden'),'true');
  assert.equal(stage.hidden,false,'spatial stage becomes visible');
  assert.equal(stage.getAttribute('aria-hidden'),'false');
  const original=t.doc.getElementById('stage-main').src;
  assert.match(original,/pbs\.twimg\.com\/media/);
  t.doc.getElementById('spatial-next').click();
  const next=t.doc.getElementById('stage-main').src;
  assert.notEqual(next,original,'next side artwork advances original work');
  assert.match(t.doc.getElementById('stage-counter').textContent,/02 \/ 20/);
  t.doc.getElementById('spatial-prev').click();
  assert.equal(t.doc.getElementById('stage-main').src,original,'previous artwork restores selected piece');
  t.doc.getElementById('spatial-current').click();
  assert.equal(t.doc.getElementById('cinema').classList.contains('active'),true,'center artwork opens cinema');
  assert.equal(t.doc.getElementById('cinema-img').src,original);
  const rail=t.doc.querySelector('#cinema .cinema-controls-rail');
  assert.ok(rail,'cinema has one dedicated control rail');
  assert.ok(rail.contains(t.doc.querySelector('.cinema-top')));
  assert.ok(rail.contains(t.doc.querySelector('.cinema-bottom')));
  assert.equal(rail.contains(t.doc.querySelector('.cinema-viewport')),false,'large artwork is outside the controls rail');
  t.doc.getElementById('cinema-close').click();
  t.doc.getElementById('wall-mode').click();
  assert.equal(wall.hidden,false);
  assert.equal(stage.hidden,true);
  const css=readFileSync('styles.css','utf8');
  assert.match(css,/#artist-wall\[hidden\]/,'specific hidden rule defeats column masonry');
  assert.match(css,/#cinema\.active \.cinema-controls-rail/,'control rail is styled');
 }finally{t.close()}
});

test('artist title and actions are on one side of uncropped artwork',async()=>{
 const t=boot('https://twentyx.artvision.today/@stunnifer/','@stunnifer/index.html');
 try{
  await new Promise(done=>setTimeout(done,50));
  const room=t.doc.getElementById('artist-view');
  const rail=room.querySelector('.artist-room-rail');
  const art=room.querySelector('.artist-room-display');
  assert.ok(rail&&art);
  assert.ok(rail.contains(t.doc.getElementById('artist-title')));
  assert.ok(rail.contains(t.doc.getElementById('download-qr')));
  assert.ok(rail.contains(t.doc.getElementById('previous-artist')));
  assert.ok(art.contains(t.doc.getElementById('artist-wall')));
  assert.ok(art.contains(t.doc.getElementById('spatial-stage')));
  assert.equal(art.querySelectorAll('.artist-wall img').length,20);
 }finally{t.close()}
});

test('new CTWLK curation is 20 genuine unique artworks and listed in gallery',async()=>{
 const seed=JSON.parse(readFileSync('artists.json','utf8'));
 const ctwlk=seed.find(a=>a.handle.toLowerCase()==='ctwlk');
 assert.ok(ctwlk,'CTWLK is in the permanent gallery data');
 assert.equal(ctwlk.postUrl,'https://x.com/ctwlk/status/2123831155942453451');
 assert.equal(ctwlk.media.length,20);
 assert.equal(new Set(ctwlk.media).size,20);
 assert.ok(ctwlk.media.every(url=>url.startsWith('https://pbs.twimg.com/media/')));
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,55));
  assertGalleryTotals(t.doc);
  assert.equal(t.doc.querySelectorAll('.card-mosaic img').length,200);
  assert.ok([...t.doc.querySelectorAll('.collection-card')].some(x=>x.dataset.artistHandle==='ctwlk'));
 }finally{t.close()}
});

test('Postphotography opens by default; anime and all other viewing rooms are opt-in',async()=>{
 const t=boot();try{
  await new Promise(done=>setTimeout(done,70));
  const buttons=[...t.doc.querySelectorAll('#curation-tabs [data-curation]')];
  assert.deepEqual(buttons.map(x=>x.dataset.curation),['postphotography','sketchbook','illustrated','anime','other','all']);
  const uncategorized=uncategorizedArtists(t.win);
  const visibleRooms=[...roomIds,...(uncategorized.length?['other']:[]),'all'];
  assert.deepEqual(buttons.filter(x=>!x.hidden).map(x=>x.dataset.curation),visibleRooms);
  assert.equal(t.doc.querySelector('[data-curation="postphotography"]').getAttribute('aria-selected'),'true');
  const handles=()=>[...t.doc.querySelectorAll('.collection-card')].map(c=>c.dataset.artistHandle);
  assert.equal(handles().length,10);
  assert.ok(handles().includes('allthebots'));
  assert.ok(handles().includes('turonworld'));
  assert.ok(handles().includes('ciphervoss'),'Cipher Voss belongs to #Postphotography');
  assert.ok(!handles().includes('ayyzirly'));
  t.doc.querySelector('[data-curation="sketchbook"]').click();
  assert.equal(handles().length,6);
  assert.ok(handles().includes('iridescent_bug'));
  assert.ok(handles().includes('andyybzyy'));
  t.doc.querySelector('[data-curation="illustrated"]').click();
  assert.equal(handles().length,5);
  assert.ok(handles().includes('andyybzyy'),'overlap should not duplicate original media');
  assert.ok(handles().includes('nikdraperivey'));
  t.doc.querySelector('[data-curation="anime"]').click();
  assert.equal(handles().length,11);
  assert.ok(handles().includes('ayyzirly'));
  assert.ok(handles().includes('aarandommm'));
  assert.ok(handles().includes('ftpickaxe'));
  assert.ok(handles().includes('for1un3'));
  assert.ok(!handles().includes('skelevaggio'));
  const other=t.doc.querySelector('[data-curation="other"]');
  assert.equal(other.hidden,uncategorized.length===0);
  assert.equal(Number(other.querySelector('.curation-tab-count').textContent),uncategorized.length);
  if(uncategorized.length){
   other.click();
   assert.deepEqual(handles(),uncategorized.map(a=>a.handle.toLowerCase()));
  }
  t.doc.querySelector('[data-curation="all"]').click();
  assert.deepEqual(handles(),newestFirst(publishedArtists).map(a=>a.handle.toLowerCase()));
  assert.equal(t.doc.querySelectorAll('.card-mosaic img').length,publishedArtists.length*20);
  t.doc.querySelector('[data-curation="postphotography"]').click();
  const search=t.doc.querySelector('#search');search.value='YenaArt';search.dispatchEvent(new t.win.Event('input',{bubbles:true}));
  assert.deepEqual(handles(),['yenaarteng'],'artist search traverses every visual genre');
 }finally{t.close()}
});

test('verified Futurist Motor Club collection and all twelve newest-first features are present',async()=>{
 const data=JSON.parse(readFileSync('artists.json','utf8'));
 const artist=data.find(a=>a.handle==='allthebots');
 assert.ok(artist);
 assert.equal(artist.postUrl,'https://x.com/allthebots/status/2124591130381836713');
 assert.equal(artist.media.length,20);
 assert.equal(new Set(artist.media).size,20);
 assert.ok(artist.media.every(u=>u.startsWith('https://pbs.twimg.com/media/')));
 const t=boot();try{
  await new Promise(done=>setTimeout(done,65));
  const featured=[...t.doc.querySelectorAll('.featured-six-card')];
  assert.equal(featured.length,12);
  assert.ok(featured[0].querySelector('.featured-six-name').textContent.includes('Futurist Motor Club'));
  const arrivals=[...t.doc.querySelectorAll('#arrival-links a')];
  assert.deepEqual(arrivals.map(a=>a.getAttribute('href')),
   newestFirst(data).slice(0,6).map(a=>'/@'+a.handle.toLowerCase()+'/'));
  assert.equal(t.win.currentFeature(0).lineup.length,12);
  const css=readFileSync('styles.css','utf8');
  assert.ok(css.includes('.curation-tab[aria-selected="true"]'));
 }finally{t.close()}
});

test('artists fill rows from newest upper-left to right; numbering stays horizontal',async()=>{
 const t=boot();
 try{
  await new Promise(done=>setTimeout(done,70));
  const cards=[...t.doc.querySelectorAll('#home-gallery>.collection-card')];
  const seed=JSON.parse(t.doc.querySelector('#seeded-artists').textContent);
  const expected=seed.filter(a=>['allthebots','turonworld','ctwlk','skelevaggio','giselxphoto','pepavaggio','stunnifer','exolorian','jjjjere','ciphervoss'].includes(a.handle.toLowerCase()))
   .sort((a,b)=>b.postId.localeCompare(a.postId)).map(a=>a.handle.toLowerCase());
  assert.deepEqual(cards.map(c=>c.dataset.artistHandle),expected,'DOM order follows newest first across gallery rows');
  assert.ok(cards.some(c=>c.dataset.artistHandle==='ciphervoss'));
  assert.ok(cards.findIndex(c=>c.dataset.artistHandle==='ciphervoss')<cards.findIndex(c=>c.dataset.artistHandle==='jjjjere'),'Cipher Voss precedes the older J collection');
  cards.forEach((card,i)=>assert.equal(card.querySelector('.collection-sequence').textContent,String(i+1).padStart(2,'0')+' / 10'));
  const ciphervoss=cards.find(c=>c.dataset.artistHandle==='ciphervoss');
  assert.equal(ciphervoss.querySelectorAll('.card-mosaic img').length,20,'Cipher retains intact twenty-work block');
  assert.equal(t.doc.querySelector('[data-curation="postphotography"] .curation-tab-count').textContent,'10');
  const featured=[...t.doc.querySelectorAll('.featured-six-card')];
  assert.equal(featured.length,12);
  assert.deepEqual(featured.slice(0,3).map(x=>x.querySelector('.featured-six-number').textContent),['01 / 12','02 / 12','03 / 12']);
  t.doc.querySelector('[data-curation="all"]').click();
  const allCards=[...t.doc.querySelectorAll('#home-gallery>.collection-card')];
  assert.equal(allCards.length,publishedArtists.length);
  assert.equal(allCards[0].querySelector('.collection-sequence').textContent,'01 / '+String(publishedArtists.length).padStart(2,'0'));
  const css=readFileSync('styles.css','utf8');
  assert.match(css,/#home-gallery\.home-gallery\s*\{\s*display:grid!important;/,'grid overrides obsolete multi-column layout');
  assert.match(css,/grid-auto-flow:row!important/,'CSS must fill left to right, then top to bottom');
  assert.match(css,/writing-mode:horizontal-tb!important/,'ordinal labels must be horizontal');
 }finally{t.close()}
});

test('remaining Other Visions exhibitions belong to Anime without changing originals',async()=>{
 const t=boot();try{
  await new Promise(done=>setTimeout(done,60));
  const all=JSON.parse(t.doc.querySelector('#seeded-artists').textContent);
  const previouslyOther=['aarandommm','ftpickaxe','for1un3'];
  for(const handle of previouslyOther){
   const artist=all.find(a=>a.handle.toLowerCase()===handle);
   assert.ok(artist,handle+' must remain in the complete archive');
   assert.equal(artist.media.length,20,handle+' still has twenty original works');
   assert.ok(t.win.curationArtists('anime').some(a=>a.postId===artist.postId),handle+' now appears in Anime');
   assert.ok(!t.win.curationArtists('other').some(a=>a.postId===artist.postId),handle+' leaves Other Visions');
  }
  assert.equal(t.win.curationArtists('anime').length,11);
  const uncategorized=uncategorizedArtists(t.win);
  assert.equal(t.win.curationArtists('other').length,uncategorized.length);
  const futureUnclassified={name:'Future Curation',handle:'futureart',postId:'2125000000000000000',postUrl:'https://x.com/futureart/status/2125000000000000000',date:'2026-12-01',media:Array.from({length:20},(_,i)=>'https://pbs.twimg.com/media/test'+i+'.jpg')};
  assert.ok(t.win.curationArtists('other',[...all,futureUnclassified]).some(a=>a.postId===futureUnclassified.postId),'a future unclassified artist can still use Other Visions');
  assert.equal(t.doc.querySelector('[data-curation="other"]').hidden,uncategorized.length===0);
  t.doc.querySelector('[data-curation="anime"]').click();
  assert.equal(t.doc.querySelectorAll('.collection-card').length,11);
  assert.equal(t.doc.querySelectorAll('.card-mosaic img').length,220);
  t.doc.querySelector('[data-curation="all"]').click();
  assert.equal(t.doc.querySelectorAll('.collection-card').length,publishedArtists.length);
 }finally{t.close()}
});
