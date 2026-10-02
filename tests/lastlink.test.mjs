import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../app.mjs';

const secret='a'.repeat(64);
const productId='produto-correto';
const payload=(Event,override={})=>({
  Id:'evento-1',IsTest:false,Event,CreatedAt:'2026-10-02T12:00:00Z',
  Data:{Products:[{Id:productId}],Buyer:{Email:' COMPRADOR@EXAMPLE.COM ',Name:'Comprador'},
    Purchase:{PaymentId:'pagamento-1',PaymentDate:'2026-10-02T11:59:00Z'}},
  ...override
});

test('diagnóstico sem produto configurado não grava compras nem imprime dados pessoais',async t=>{
  const logs=[];
  t.mock.method(console,'log',(...args)=>logs.push(args.join(' ')));
  let writes=0;
  const server=createApp({store:{applyLastlink:async()=>writes++},secret:'s'.repeat(64),
    origin:'http://local',secure:false,lastlinkWebhookSecret:secret});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/webhook/lastlink/${secret}`,{
      method:'POST',headers:{'Content-Type':'application/json','x-example-token':'token-privado'},
      body:JSON.stringify(payload('Purchase_Order_Confirmed'))});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{ok:true,mode:'diagnostic',accessGranted:false});
    assert.equal(writes,0);
    const output=logs.join('\n');
    assert.ok(output.includes(productId));
    assert.ok(output.includes('x-example-token'));
    assert.ok(!output.includes('token-privado'));
    assert.ok(!output.includes('COMPRADOR@EXAMPLE.COM'));
    assert.ok(!output.includes(secret));
  }finally{await new Promise(resolve=>server.close(resolve))}
});

test('webhook recebe somente evento válido do produto configurado',async()=>{
  const received=[];
  const store={byEmail:async()=>null,byId:async()=>null,applyLastlink:async event=>received.push(event)};
  const server=createApp({store,secret:'s'.repeat(64),origin:'http://local',secure:false,
    lastlinkProductId:productId,lastlinkWebhookSecret:secret});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    assert.equal((await post('/webhook/lastlink/errado',payload('Purchase_Order_Confirmed'))).status,403);
    assert.equal((await post('/webhook/lastlink/'+secret,payload('Purchase_Order_Confirmed',{IsTest:true}))).status,200);
    assert.equal((await post('/webhook/lastlink/'+secret,payload('Purchase_Order_Confirmed',{Data:{...payload('x').Data,Products:[{Id:'outro'}]}}))).status,200);
    assert.equal(received.length,0);
    assert.equal((await post('/webhook/lastlink/'+secret,payload('Purchase_Order_Confirmed'))).status,200);
    assert.deepEqual(received[0],{kind:'purchase',paymentId:'pagamento-1',email:'comprador@example.com',name:'Comprador',status:'aprovada',eventAt:'2026-10-02T12:00:00.000Z',approvedAt:'2026-10-02T11:59:00.000Z'});
    assert.equal((await post('/webhook/lastlink/'+secret,payload('Payment_Refund'))).status,200);
    assert.equal(received[1].status,'reembolsada');
    assert.equal((await post('/webhook/lastlink/'+secret,payload('Payment_Chargeback'))).status,200);
    assert.equal(received[2].status,'chargeback');
    assert.equal((await post('/webhook/lastlink/'+secret,payload('Purchase_Order_Confirmed',{Data:{...payload('x').Data,Purchase:{PaymentId:'pagamento-1'}}}))).status,400);
  }finally{await new Promise(resolve=>server.close(resolve))}
});
