import http from 'node:http';
import {readFileSync} from 'node:fs';
import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {parseLastlinkEvent} from './lastlink.mjs';
const root=new URL('./',import.meta.url);
const files=Object.fromEntries(['public/login.html','private/playbook.html','private/bonus.html'].map(p=>[p,readFileSync(new URL(p,root),'utf8')]));
const eq=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export function createApp({store,secret,origin,secure=true,now=()=>Date.now(),lastlinkProductId='',lastlinkWebhookSecret=''}){
 if(!secret||secret.length<32)throw Error('SESSION_SECRET deve ter ao menos 32 caracteres.');
 if(lastlinkProductId&&!lastlinkWebhookSecret)throw Error('Configure LASTLINK_WEBHOOK_SECRET para ativar a integração.');
 if(lastlinkWebhookSecret && !/^[a-f0-9]{64}$/.test(lastlinkWebhookSecret))throw Error('LASTLINK_WEBHOOK_SECRET precisa ter 64 caracteres hexadecimais.');
 const sign=x=>createHmac('sha256',secret).update(x).digest('base64url');
 const cookie=(v,age)=>`yuri_session=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
 const attempts=new Map();
 function limited(key,max=20){const t=now();let x=attempts.get(key);if(!x||x.until<t){x={count:0,until:t+900000};attempts.set(key,x)}return ++x.count>max}
 const timer=setInterval(()=>{for(const [k,v] of attempts)if(v.until<now())attempts.delete(k)},60000);timer.unref();
 async function session(req){const token=(req.headers.cookie||'').match(/(?:^|;\s*)yuri_session=([^;]+)/)?.[1];if(!token)return null;
  try{const [data,sig,...rest]=token.split('.');if(rest.length||!sig||!eq(sign(data),sig))return null;const p=JSON.parse(Buffer.from(data,'base64url'));if(!Number.isFinite(p.exp)||p.exp<=now()||typeof p.id!=='string')return null;return await store.byId(p.id)}catch(e){if(e.code)throw e;return null}}
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8'});res.end(type==='application/json'?JSON.stringify(body):body)};
  const redirect=path=>{res.writeHead(303,{Location:path});res.end()};
  try{
   const path=new URL(req.url,'http://local').pathname;
   if(req.method==='GET'&&path==='/health')return send(200,{ok:true});
   if(req.method==='POST'&&lastlinkWebhookSecret&&path==='/webhook/lastlink/'+lastlinkWebhookSecret){
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return send(415,{error:'Envie JSON.'});
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65536)return send(413,{error:'Solicitação muito grande.'});chunks.push(chunk)}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString())}catch{return send(400,{error:'JSON inválido.'})}
    if(!lastlinkProductId){
     const products=Array.isArray(body?.Data?.Products)?body.Data.Products:[];
     console.log('Lastlink diagnóstico:',JSON.stringify({test:body?.IsTest===true,
      productIds:products.map(p=>p?.Id).filter(id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id)),
      headerNames:Object.keys(req.headers)}));
     return send(200,{ok:true,mode:'diagnostic',accessGranted:false});
    }
    const event=parseLastlinkEvent(body,lastlinkProductId);
    if(event.kind==='invalid')return send(400,{error:'Evento inválido.'});
    if(event.kind==='purchase')await store.applyLastlink(event);
    return send(200,{ok:true});
   }
   if(req.method==='POST'){
    if(req.headers.origin!==origin)return send(403,{error:'Origem não autorizada.'});
    if(path==='/logout'){res.setHeader('Set-Cookie',cookie('',0));return redirect('/')}
    if(path!=='/login')return send(404,{error:'Não encontrado.'});
    if(limited('global',1000))return send(429,{error:'Muitas tentativas. Aguarde 15 minutos.'});
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'Solicitação muito grande.'});chunks.push(chunk)}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString())}catch{return send(400,{error:'Dados inválidos.'})}
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    if(!email||email.length>254||!email.includes('@')||typeof body.password!=='string')return send(400,{error:'Informe seu e-mail e sua senha.'});
    if(attempts.size>10000||limited('email:'+email))return send(429,{error:'Muitas tentativas. Aguarde 15 minutos.'});
    const user=eq(body.password,'bookplay')?await store.byEmail(email):null;
    if(!user)return send(401,{error:'Não foi possível liberar o acesso. Confira os dados e a aprovação da compra.'});
    const data=Buffer.from(JSON.stringify({id:String(user.id),exp:now()+28800000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
    res.setHeader('Set-Cookie',cookie(data+'.'+sign(data),28800));return send(200,{redirect:'/playbook'});
   }
   if(req.method!=='GET')return send(405,{error:'Método não permitido.'});
   if(path==='/')return send(200,files['public/login.html'],'text/html');
   if(!['/playbook','/access.php','/module11.php'].includes(path))return send(404,{error:'Não encontrado.'});
   const user=await session(req);
   if(!user){if(path==='/playbook')return redirect('/');return send(401,{error:'Entre novamente para acessar.'})}
   const unlockAt=new Date(new Date(user.aprovado_em).getTime()+7*86400000);
   const module11Available=now()>=unlockAt.getTime();
   if(path==='/access.php')return send(200,{serverNow:new Date(now()).toISOString(),unlockAt:unlockAt.toISOString(),module11Available});
   if(path==='/module11.php')return module11Available?send(200,files['private/bonus.html'],'text/html'):send(403,{error:'Módulo disponível sete dias após a aprovação.'});
   return send(200,files['private/playbook.html'].replaceAll('__BUYER_ID__',String(user.id).replace(/[^0-9]/g,'')),'text/html');
  }catch(e){console.error('Falha na requisição:',e.code||e.name);return send(503,{error:'Serviço temporariamente indisponível. Tente novamente em instantes.'})}
 });
}
