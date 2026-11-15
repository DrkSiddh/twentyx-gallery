import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {makeBrochure} from '../scripts/welcome.mjs';
import {readFileSync} from 'node:fs';

test('brochure includes twenty real-source image slots and renders PNG & SVG',async()=>{
 const artist=JSON.parse(readFileSync('artists.json','utf8'))[0];
 const fixture=await sharp({create:{width:12,height:12,channels:3,background:'#17223b'}}).jpeg().toBuffer();
 let requests=0;
 const card=await makeBrochure(artist,{loadImage:async url=>{
  assert.ok(url.startsWith('https://pbs.twimg.com/media/'));
  requests++;return fixture;
 }});
 assert.equal(requests,20);
 assert.equal((card.svg.match(/data:image\/jpeg;base64,/g)||[]).length,20);
 assert.ok(card.svg.includes('data:image/png;base64,'));
 const meta=await sharp(card.png).metadata();
 assert.equal(meta.width,1080);assert.equal(meta.height,1350);
 assert.equal(meta.format,'png');
 assert.ok(card.png.length>10000);
});
test('brochure refuses incomplete twenty-media source',async()=>{
 const artist=JSON.parse(readFileSync('artists.json','utf8'))[0];
 await assert.rejects(()=>makeBrochure({...artist,media:artist.media.slice(0,4)}),/20 distinct/);
});
