import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStatus,COMMUNITY_ID} from '../scripts/discover-free.mjs';

const fixture=()=>{
 const photos=Array.from({length:20},(_,i)=>({
  id:String(i),type:'photo',url:'https://pbs.twimg.com/media/HXG_'+i+'.jpg?name=orig'
 }));
 return {
  id:'2121728209721131289',
  text:'My 20 images for #TwentyX',
  author:{name:'ok vision',screen_name:'ok__vision'},
  created_timestamp:1794675600,
  community:{id:COMMUNITY_ID},
  media:{all:photos,photos}
 };
};
test('20 distinct images and verified community qualify for publication',()=>{
 const result=checkStatus(fixture(),'free-search');
 assert.equal(result.kind,'admit');
 assert.equal(result.record.media.length,20);
 assert.equal(result.record.postUrl,'https://x.com/ok__vision/status/2121728209721131289');
});
test('one-image and four-image snippets NEVER count as exact 20',()=>{
 for(const n of [1,4,19]){
  const s=fixture();s.media.all=s.media.photos.slice(0,n);
  const result=checkStatus(s,'free-search');
  assert.equal(result.kind,'review');
  assert.equal(result.reason,'twenty-media-not-proven');
  assert.equal(result.observed,n);
 }
});
test('hashtag without community proof remains unadmitted',()=>{
 const s=fixture();delete s.community;
 assert.equal(checkStatus(s,'free-search').reason,'community-not-confirmed');
});
test('post found within actual community page is valid source evidence',()=>{
 const s=fixture();delete s.community;
 assert.equal(checkStatus(s,'confirmed-community-feed').kind,'admit');
});
test('no false positive from mosaic, duplicates, or video',()=>{
 let s=fixture();s.media.all[0]={type:'mosaic_photo',url:'https://mosaic.fxtwitter.com/mosaic.jpg'};
 assert.equal(checkStatus(s,'free-search').kind,'review');
 s=fixture();s.media.all[0]={...s.media.all[1]};
 assert.equal(checkStatus(s,'free-search').reason,'duplicate-photo-urls');
 s=fixture();s.media.all[0]={type:'video',url:'https://pbs.twimg.com/media/video.jpg'};
 assert.equal(checkStatus(s,'free-search').reason,'incomplete-photo-media');
});
test('wrong tag or wrong community never publishes',()=>{
 let s=fixture();s.text='Hello artists';
 assert.equal(checkStatus(s,'free-search').kind,'reject');
 s=fixture();s.community.id='999';
 assert.equal(checkStatus(s,'free-search').kind,'review');
});
