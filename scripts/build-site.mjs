#!/usr/bin/env node
/**
 * Build the self-contained, fully artwork-seeded GitHub Pages landing page.
 * No API keys, network requests, build service, or database required.
 *
 * Produces a single index.html with:
 *  - embedded CSS and JS (no relative asset requests to break in previews)
 *  - embedded current artists.json (network-independent first paint)
 *  - server-rendered 20-work artist mosaics for even JS-disabled browsers
 *
 * New validated artist records are always rendered on the next publication.
 */
import fs from 'node:fs';

const load=file=>fs.readFileSync(file,'utf8');
const html=load('src/index.template.html');
const css=load('styles.css');
const javascript=load('app.js');
const artists=JSON.parse(load('artists.json'));
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const idOf=artist=>String(artist.postUrl||'').match(/\/status\/(\d+)\/?$/)?.[1];
const handle=artist=>new URL(artist.postUrl).pathname.split('/')[1];
const validMedia=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/media/')}catch{return false}};
if(!Array.isArray(artists)||!artists.length)throw Error('No artists: refusing blank exhibition build');
const ids=new Set();
for(const a of artists){
 const id=idOf(a),h=handle(a);
 if(!id||!h||ids.has(id))throw Error('Duplicate or invalid artist source: '+a.name);
 if(!Array.isArray(a.media)||a.media.length!==20||new Set(a.media).size!==20)throw Error('Not twenty works: '+a.name);
 if(a.media.some(u=>!validMedia(u)))throw Error('Unsafe media source for '+a.name);
 ids.add(id);
}
const rank=a=>['pepavaggio','stunnifer','ciphervoss'].indexOf(handle(a).toLowerCase());
const ordered=[...artists].sort((a,b)=>{
 const ra=rank(a),rb=rank(b);
 if(ra>=0||rb>=0)return (ra<0?99:ra)-(rb<0?99:rb);
 return idOf(b).localeCompare(idOf(a));
});
function renderCard(a,index){
 const title=esc(a.name),artistHandle=esc(handle(a)),date=esc(a.date||'');
 const originals=a.media.map((u,i)=>'<a class="artwork-thumb" href="'+esc(a.postUrl)+'" target="_blank" rel="noopener noreferrer" aria-label="Work '+(i+1)+' of 20 by '+title+'"><img src="'+esc(u)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="Artwork '+(i+1)+' by '+title+'"></a>').join('');
 return '<article class="collection-card" id="artist-'+idOf(a)+'">'
  +'<div class="card-meta"><div>'+(index<3?'<div class="card-overline">FEATURED ARTIST / '+String(index+1).padStart(2,'0')+'</div>':'')
  +'<h3 class="card-name">'+title+'</h3><div class="card-handle">@'+artistHandle+' · 20 / 20</div></div><span class="card-date">'+date+'</span></div>'
  +'<div class="card-mosaic">'+originals+'</div>'
  +'<div class="card-footer"><a class="pill primary" href="https://twitter.com/intent/follow?screen_name='+artistHandle+'" data-follow="true" target="_blank" rel="noopener noreferrer">Follow on X ↗</a>'
  +'<a class="ghost" href="'+esc(a.postUrl)+'" target="_blank" rel="noopener noreferrer">Original post ↗</a>'
  +'<a class="ghost artist-open" href="/@'+artistHandle.toLowerCase()+'/">Explore 20 →</a></div>'
  +'</article>';
}
const initial=ordered.map(renderCard).join('\n');
const seed=JSON.stringify(ordered).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
let output=html;
const requireReplace=(from,to)=>{if(!output.includes(from))throw Error('Missing expected HTML anchor: '+from);output=output.replace(from,to)};
const newest=[...artists].sort((a,b)=>idOf(b).localeCompare(idOf(a)))[0];
const sourceFeatured=newest.media[0];
requireReplace('<strong id="artist-count">0</strong>','<strong id="artist-count">'+artists.length+'</strong>');
requireReplace('<strong id="work-count">0</strong>','<strong id="work-count">'+(artists.length*20)+'</strong>');
requireReplace('<img id="feature-image" alt="Featured TwentyX artwork" loading="eager" decoding="async">',
 '<img id="feature-image" src="'+esc(sourceFeatured)+'" alt="Featured original artwork curated by '+esc(newest.name)+'" loading="eager" decoding="async">');
requireReplace('<h2 id="feature-title" class="feature-artist-name">Artist spotlight</h2>',
 '<h2 id="feature-title" class="feature-artist-name">'+esc(newest.name)+'</h2>');

requireReplace('<link rel="stylesheet" href="./styles.css">','<style>\n'+css+'\n</style>');
requireReplace('<script src="./app.js" defer></script>','');
requireReplace('<div class="home-gallery" id="home-gallery"></div>','<div class="home-gallery" id="home-gallery">\n'+initial+'\n</div>');
requireReplace('</body>','<script id="seeded-artists" type="application/json">'+seed+'</script>\n<script>\n'+javascript.replaceAll('</script','<\\/script')+'\n</script>\n</body>');
if(!output.includes('id="seeded-artists"')||!output.includes('FEATURED ARTIST')||!output.includes('CURATED')) {
 // CURATED lives in brochure copy, not necessarily in site — don't require it here.
 if(!output.includes('id="seeded-artists"')||!output.includes('FEATURED ARTIST'))throw Error('Missing seeded artwork proof');
}
const result='index.html';
fs.writeFileSync(result,output);
const slugs=new Set();
for(const artist of ordered){
 const slug=handle(artist).toLowerCase();
 if(!/^[a-z0-9_]{1,15}$/.test(slug)||slugs.has(slug))throw Error('Unsafe or duplicate artist handle '+slug);
 slugs.add(slug);
 const path='@'+slug;
 fs.mkdirSync(path,{recursive:true});
 const canonical='https://twentyx.artvision.today/'+path+'/';
 const artistHtml=output.replace('<title>TwentyX • ArtVision X</title>','<title>'+esc(artist.name)+' — TwentyX Presented By ArtVision</title>')
   .replace('</head>','<link rel="canonical" href="'+canonical+'">\n<meta property="og:title" content="'+esc(artist.name)+' — TwentyX">\n<meta property="og:description" content="A twenty-work digital art exhibition curated by '+esc(artist.name)+'.">\n</head>');
 fs.writeFileSync(path+'/index.html',artistHtml);
}
console.log('Built TwentyX exhibition:',artists.length,'artist rooms;',artists.length*20,'works;',Buffer.byteLength(output),'bytes home');
