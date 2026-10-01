import {createApp} from './app.mjs';
import {store,pool} from './store.mjs';
const origin=new URL(process.env.APP_ORIGIN).origin;
if(!origin.startsWith('https://'))throw Error('APP_ORIGIN precisa usar HTTPS.');
const server=createApp({store,secret:process.env.SESSION_SECRET,origin});
await pool.query('SELECT id FROM compradores LIMIT 0');
await pool.query('SELECT id FROM compras LIMIT 0');
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Playbook pronto na porta '+(process.env.PORT||3000)));
process.on('SIGTERM',()=>server.close(async()=>{await pool.end();process.exit(0)}));
