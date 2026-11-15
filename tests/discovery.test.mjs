import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePost} from '../scripts/discover.mjs';
const COMMUNITY='1835009931231322257';
const makeFixture=()=>{
 const keys=Array.from({length:20},(_,i)=>'3_'+(1000+i));
 const images=keys.map((media_key,i)=>({media_key,type:'photo',url:'https://pbs.twimg.com/media/Example'+i+'.jpg'}));
 const post={id:'2121763650881077596',text:'My twenty #TwentyX',author_id:'42',
  created_at:'2026-11-14T17:00:00Z',community_id:COMMUNITY,
  entities:{hashtags:[{tag:'TwentyX'}]},attachments:{media_keys:keys}};
 const includes={users:[{id:'42',name:'Example Artist',username:'ExampleMaker'}],media:images};
 return {post,includes};
};
test('only exactly twenty image attachments with explicit matching community pass',()=>{
 const {post,includes}=makeFixture();
 const result=evaluatePost(post,includes);
 assert.equal(result.kind,'admit');
 assert.equal(result.record.media.length,20);
 assert.equal(result.record.name,'Example Artist');
 assert.equal(result.record.postUrl,'https://x.com/ExampleMaker/status/2121763650881077596');
});
test('one- or four-image posts are rejected; no placeholder filling',()=>{
 for(const count of [1,4,19,21]){
  const {post,includes}=makeFixture();
  post.attachments.media_keys=post.attachments.media_keys.slice(0,count);
  if(count===21)post.attachments.media_keys.push('3_2001');
  const result=evaluatePost(post,includes);
  assert.equal(result.kind,'reject');
  assert.equal(result.reason,'not-exactly-twenty-attachments');
 }
});
test('hashtag alone does not prove ArtVision community membership',()=>{
 const {post,includes}=makeFixture();
 delete post.community_id;
 const result=evaluatePost(post,includes);
 assert.equal(result.kind,'review');
 assert.equal(result.reason,'community-unverified');
});
test('other communities never enter the archive automatically',()=>{
 const {post,includes}=makeFixture();post.community_id='123456789';
 assert.equal(evaluatePost(post,includes).kind,'review');
});
test('missing media expansion is held for review, never guessed',()=>{
 const {post,includes}=makeFixture();includes.media.pop();
 assert.equal(evaluatePost(post,includes).reason,'missing-expanded-media');
});
test('video posts are held until renderer supports native video',()=>{
 const {post,includes}=makeFixture();includes.media[2].type='video';
 assert.equal(evaluatePost(post,includes).reason,'non-image-media-needs-video-renderer');
});
test('retweeted posts and absent hashtags cannot qualify',()=>{
 const {post,includes}=makeFixture();
 post.referenced_tweets=[{type:'retweeted',id:'42'}];
 assert.equal(evaluatePost(post,includes).kind,'reject');
 delete post.referenced_tweets;post.text='Twenty pieces';post.entities.hashtags=[];
 assert.equal(evaluatePost(post,includes).reason,'missing-twentyx-hashtag');
});
