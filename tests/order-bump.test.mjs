import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../app.mjs';
const events=JSON.parse(readFileSync(new URL('./order-bump-fixtures.json',import.meta.url),'utf8'));
const secret='a'.repeat(64),token='native-token',mainId='e8b41bd4-90c3-47d0-af99-66dbe458c015',reelsId='167648e6-49ce-41c7-893f-49a97cf258ba';
test('payloads reais sanitizados: só Playbook, conjunto e reembolso são separados por produto',async()=>{
 const main=[],reels=[];
 let fail=false;
 const server=createApp({store:{applyLastlink:async e=>main.push(e),applyReelsLastlink:async e=>{if(fail)throw Error('test');reels.push(e)}},secret,origin:'http://local',secure:false,lastlinkWebhookSecret:secret,lastlinkToken:token,lastlinkProductId:mainId,lastlinkReelsProductId:reelsId});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const post=(p,t=token)=>fetch(`http://127.0.0.1:${server.address().port}/webhook/lastlink/${secret}`,{method:'POST',headers:{'content-type':'application/json','x-lastlink-token':t},body:JSON.stringify(p)});
 try{
  for(const row of [4,3]){assert.equal((await post(events.find(x=>x.sourceRow===row))).status,200)}
  assert.equal(main.length,2);assert.equal(reels.length,0);
  for(const row of [6,5,2]){assert.equal((await post(events.find(x=>x.sourceRow===row))).status,200)}
  assert.deepEqual(reels.map(e=>e.status),['aprovada','reembolsada','aprovada']);
  assert.equal(reels.at(-1).paymentId,'9a64b75a-e92a-4f2f-8b0c-6886c8af0e25');
  const n=main.length,m=reels.length;
  assert.equal((await post({...events[0],IsTest:true})).status,200);
  assert.equal((await post(events[0],'wrong')).status,401);
  assert.equal(main.length,n);assert.equal(reels.length,m);
  fail=true;assert.equal((await post(events[0])).status,503);
  fail=false;assert.equal((await post(events[0])).status,200);
 }finally{await new Promise(r=>server.close(r))}
});
