#!/usr/bin/env node
import fs from 'node:fs';
import QRCode from 'qrcode';
const entries=JSON.parse(fs.readFileSync('artists.json','utf8'));
const previousFile='data/previous-posts.json';
const previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):[];
const prior=new Set(previous);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
fs.mkdirSync('welcome',{recursive:true});
let created=0;
for(const a of entries){
 const id=a.postId||a.postUrl.match(/\/status\/(\d+)/)?.[1];
 if(!id||prior.has(id))continue;
 const handle=a.handle||new URL(a.postUrl).pathname.split('/')[1];
 const qr=await QRCode.toString('https://twentyx.artvision.today/?artist='+id,{type:'svg',margin:2,width:420});
 const b64=Buffer.from(qr).toString('base64');
 const name=esc(a.name);
 const titleSize=a.name.length>24?48:a.name.length>15?66:88;
 const graphic=[
 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">',
 '<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#12112f"/><stop offset=".56" stop-color="#54284e"/><stop offset="1" stop-color="#243e65"/></linearGradient></defs>',
 '<rect width="1080" height="1350" fill="url(#bg)"/>',
 '<text x="75" y="120" font-family="sans-serif" font-size="34" font-weight="bold" letter-spacing="5" fill="#ffb7e5">ARTVISION X / TWENTYX</text>',
 '<text x="66" y="310" font-family="sans-serif" font-weight="900" font-size="112" fill="#fff1fa">WELCOME</text>',
 '<text x="66" y="424" font-family="sans-serif" font-weight="900" font-size="112" fill="#ffc7ec">TO THE 20.</text>',
 '<text x="76" y="575" font-family="sans-serif" font-weight="bold" font-size="'+titleSize+'" fill="#fff">'+name+'</text>',
 '<text x="76" y="632" font-family="sans-serif" font-size="32" fill="#e9d7f0">@'+esc(handle)+' · 20 WORKS / ONE POST</text>',
 '<rect x="73" y="707" width="450" height="450" fill="white" rx="18"/>',
 '<image href="data:image/svg+xml;base64,'+b64+'" x="88" y="722" width="420" height="420"/>',
 '<text x="556" y="834" font-family="sans-serif" font-weight="bold" font-size="42" fill="#fff">EXPLORE</text>',
 '<text x="556" y="893" font-family="sans-serif" font-weight="bold" font-size="42" fill="#fff">THE FULL</text>',
 '<text x="556" y="952" font-family="sans-serif" font-weight="bold" font-size="42" fill="#fff">COLLECTION</text>',
 '<text x="556" y="1010" font-family="sans-serif" font-size="26" fill="#e9d7f0">Scan to meet the artist</text>',
 '<text x="556" y="1048" font-family="sans-serif" font-size="26" fill="#e9d7f0">in the TwentyX gallery.</text>',
 '<text x="73" y="1260" font-family="sans-serif" font-size="30" fill="#ffc0e6">#TwentyX · TWENTY IS THE MAXIMUM.</text>',
 '</svg>'
 ].join('\n');
 fs.writeFileSync('welcome/'+handle.toLowerCase()+'-'+id+'.svg',graphic);
 created++;
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(previousFile,JSON.stringify(entries.map(a=>a.postId||a.postUrl.match(/\/status\/(\d+)/)?.[1]).filter(Boolean),null,2)+'\n');
console.log('Generated',created,'new QR welcome graphics.');
