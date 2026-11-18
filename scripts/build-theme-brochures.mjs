#!/usr/bin/env node
/**
 * Produce fully downloadable themed brochures using actual TwentyX artwork.
 * Art pixels are extracted WITHOUT recoloring from the existing (verified)
 * exhibition brochure PNG, then placed on a freshly themed page.
 * The art mosaic is never AI-generated, fabricated or recolored.
 * Only brochure furniture / backdrop changes. Source colorway images are
 * taken from user-supplied case-sensitive Themes/ folder.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {pathToFileURL} from 'node:url';

// Color stops transcribed exactly from the supplied Themes/ palette swatches.
// Swatch PNGs are reference images only and NEVER embedded in the brochure.
const THEMES={
 violet:{
  name:'ArtVision Violet',bg:'#160b27',deep:'#311342',frame:'#ce99ec',
  text:'#fcf4ff',muted:'#e8d5f0',accent:'#d7a7f9',
  stops:['#160B27','#3C1B57','#6930C3','#D7A7F9','#A6EEE7']
 },
 analog:{
  name:'Analog Nostalgia',bg:'#1b102c',deep:'#403277',frame:'#80FFDB',
  text:'#fff8ff',muted:'#e2f5ff',accent:'#80FFDB',
  stops:['#7400B8','#6930C3','#5E60CE','#5390D9','#4EA8DE','#48BFE3','#56CFE1','#64DFDF','#72EFDD','#80FFDB']
 },
 heritage:{
  name:'Minimalist Heritage',bg:'#201727',deep:'#55424e',frame:'#FFCAD4',
  text:'#fff9fc',muted:'#f4e2e8',accent:'#FFCAD4',
  stops:['#D8E2DC','#FFE5D9','#FFCAD4','#F4ACB7','#9D8189']
 }
};
const safe=str=>String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
const idOf=a=>String(a.postUrl||'').match(/\/status\/(\d+)\/?$/)?.[1];
const handleOf=a=>new URL(a.postUrl).pathname.split('/')[1].toLowerCase();
async function renderThemeBrochure(artist,theme,mosaic){
 const color=THEMES[theme],handle=handleOf(artist),id=idOf(artist);
 if(!color||!mosaic)throw Error('Invalid brochure theme or original mosaic');
 const stops=color.stops.map((hex,index)=>'<stop offset="'+(index*100/(color.stops.length-1)).toFixed(2)+'%" stop-color="'+hex+'"/>').join('');
 const qr=(await QRCode.toDataURL('https://twentyx.artvision.today/@'+handle+'/',{
  margin:2,errorCorrectionLevel:'H',width:156,color:{dark:color.bg,light:'#ffffff'}
 })).split(',')[1];
 const name=safe(artist.name),titleSize=artist.name.length>32?33:artist.name.length>20?43:artist.name.length>12?51:69;
 const svg=[
 '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">',
 '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'+stops+'</linearGradient></defs>',
 '<rect width="1080" height="1350" fill="url(#bg)"/>',
 // A translucent legibility veil is composited; no palette image used.
 '<rect width="1080" height="1350" fill="'+color.bg+'" opacity=".73"/>',
 '<path d="M0 8H1080" stroke="'+color.accent+'" stroke-width="15"/>',
 '<rect x="22" y="22" width="1036" height="1306" rx="10" fill="none" stroke="'+color.frame+'" stroke-opacity=".61"/>',
 '<text x="64" y="73" font-family="sans-serif" font-size="21" font-weight="bold" letter-spacing="4" fill="'+color.accent+'">ARTVISION / '+safe(color.name).toUpperCase()+'</text>',
 '<text x="62" y="183" font-family="sans-serif" font-size="113" font-weight="800" letter-spacing="-4" fill="'+color.text+'">TWENTYX</text>',
 '<line x1="65" y1="208" x2="1015" y2="208" stroke="'+color.frame+'" stroke-opacity=".65"/>',
 '<text x="65" y="253" font-family="sans-serif" font-size="21" letter-spacing="3" fill="'+color.accent+'">AN ARTIST-CURATED EXHIBITION</text>',
 '<text x="65" y="333" font-family="sans-serif" font-size="'+titleSize+'" font-weight="bold" fill="'+color.text+'">CURATED BY '+name+'</text>',
 '<text x="68" y="367" font-family="sans-serif" font-size="21" fill="'+color.muted+'">@'+safe(handle)+'   /   20 WORKS   /   '+safe(artist.date||'')+'</text>',
 '<rect x="64" y="387" width="952" height="755" rx="10" fill="'+color.bg+'" stroke="'+color.frame+'" stroke-opacity=".62" stroke-width="2"/>',
 // Extracted 20-artwork mosaic from the existing actual-art brochure, untouched.
 '<image x="76" y="399" width="928" height="741" href="data:image/png;base64,'+mosaic.toString('base64')+'"/>',
 '<rect x="65" y="1168" width="146" height="146" rx="5" fill="#ffffff"/>',
 '<image x="67" y="1170" width="142" height="142" href="data:image/png;base64,'+qr+'"/>',
 '<text x="243" y="1213" font-family="sans-serif" font-size="26" font-weight="bold" fill="'+color.text+'">TwentyX Presented By ArtVision</text>',
 '<text x="243" y="1250" font-family="sans-serif" font-size="21" fill="'+color.muted+'">Scan to see all 20 artworks in full size.</text>',
 '<text x="243" y="1290" font-family="sans-serif" font-size="18" letter-spacing="2" fill="'+color.accent+'">#TWENTYX  &#8226;  '+safe(color.name).toUpperCase()+'</text>',
 '</svg>'
 ].join('\n');
 const base='welcome/'+handle+'-'+id+'--'+theme;
 fs.writeFileSync(base+'.svg',svg);
 const png=await sharp(Buffer.from(svg)).png({compressionLevel:8}).toBuffer();
 fs.writeFileSync(base+'.png',png);
 return base;
}
export async function buildThemeBrochures(artists){
 let generated=0,withoutSource=[];
 for(const artist of artists){
  const base='welcome/'+handleOf(artist)+'-'+idOf(artist);
  if(!fs.existsSync(base+'.png')){withoutSource.push(handleOf(artist));continue}
  const pngBytes=fs.readFileSync(base+'.png');
  let mosaic;
  try{
   mosaic=await sharp(pngBytes).extract({left:76,top:399,width:928,height:741}).png().toBuffer();
  }catch(e){withoutSource.push(handleOf(artist)+': '+e.message);continue}
  for(const theme of Object.keys(THEMES)){
   // Always rebuild: earlier editions embedded the swatch PNG itself.
   // Overwriting ensures every edition now uses the hex gradient only.
   await renderThemeBrochure(artist,theme,mosaic);
   generated++;
  }
 }
 console.log('Hex-gradient brochures ready:',generated,'theme editions; original 20-work PNG unavailable for',withoutSource.length,'artists');
 if(withoutSource.length)console.warn('Themed brochure fallback to original edition:',withoutSource.join(', '));
 return {generated,withoutSource};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const artists=JSON.parse(fs.readFileSync('artists.json','utf8'));
 buildThemeBrochures(artists).catch(e=>{console.error(e);process.exitCode=1});
}
