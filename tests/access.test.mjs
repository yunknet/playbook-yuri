import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../app.mjs';
test('controle real de acesso, bônus e revogação',async()=>{
 let active=true;let clock=Date.parse('2026-10-01T12:00:00Z');const buyer={id:'1',aprovado_em:'2026-10-01T12:00:00Z'};
 const store={byEmail:async e=>active&&e==='teste@example.com'?buyer:null,byId:async id=>active&&id==='1'?buyer:null};
 const server=createApp({store,secret:'x'.repeat(64),origin:'http://local',secure:false,now:()=>clock});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const login=(email,password='bookplay',origin='http://local')=>fetch(base+'/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({email,password})});
 try{
  assert.equal((await fetch(base+'/playbook',{redirect:'manual'})).status,303);
  assert.equal((await fetch(base+'/module11.php')).status,401);
  assert.equal((await fetch(base+'/private/bonus.html')).status,404);
  assert.equal((await login('teste@example.com','errada')).status,401);
  assert.equal((await login('outro@example.com')).status,401);
  assert.equal((await login('teste@example.com','bookplay','http://outro')).status,403);
  const r=await login(' TESTE@example.com ');assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];const auth={headers:{Cookie:cookie}};
  const page=await(await fetch(base+'/playbook',auth)).text();assert.ok(page.includes('IS_PREVIEW=false'));assert.ok(page.includes('<template id="bonus-content"></template>'));assert.ok(!page.includes('PARE DE TER UM INSTAGRAM DE VENDEDOR</h'));
  assert.equal((await fetch(base+'/module11.php',auth)).status,403);
  assert.equal((await(await fetch(base+'/access.php',auth)).json()).module11Available,false);
  clock+=7*86400000;assert.equal((await fetch(base+'/access.php',auth)).status,401); // sessão venceu
  const later=await login('teste@example.com');const auth2={headers:{Cookie:later.headers.get('set-cookie').split(';')[0]}};
  assert.equal((await fetch(base+'/module11.php',auth2)).status,200);
  assert.equal((await(await fetch(base+'/access.php',auth2)).json()).module11Available,true);
  active=false;assert.equal((await fetch(base+'/module11.php',auth2)).status,401);
  active=true;for(let i=0;i<21;i++)await login('rate@example.com');assert.equal((await login('rate@example.com')).status,429);
 }finally{await new Promise(r=>server.close(r))}
});
