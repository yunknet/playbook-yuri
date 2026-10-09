import {createApp} from './app.mjs';
import {store,pool} from './store.mjs';
import {reelsStore} from './reels-store.mjs';
const origin=new URL(process.env.APP_ORIGIN).origin;
if(!origin.startsWith('https://'))throw Error('APP_ORIGIN precisa usar HTTPS.');
const server=createApp({store:{...store,applyReelsLastlink:reelsStore.applyLastlink},secret:process.env.SESSION_SECRET,origin,
 lastlinkReelsProductId:process.env.LASTLINK_REELS_PRODUCT_ID,
 lastlinkProductId:process.env.LASTLINK_PRODUCT_ID,
 lastlinkToken:process.env.LASTLINK_TOKEN,
 lastlinkWebhookSecret:process.env.LASTLINK_WEBHOOK_SECRET});
await pool.query('SELECT id FROM compradores LIMIT 0');
await pool.query('SELECT id FROM compras LIMIT 0');
if(process.env.LASTLINK_REELS_PRODUCT_ID)await pool.query('SELECT id FROM reels_compras LIMIT 0');
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Playbook pronto na porta '+(process.env.PORT||3000)));
process.on('SIGTERM',()=>server.close(async()=>{await pool.end();process.exit(0)}));
