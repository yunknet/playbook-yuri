import {pool} from './store.mjs';
const [action,emailRaw,name='']=process.argv.slice(2);
const email=(emailRaw||'').trim().toLowerCase();
if(!['liberar','revogar'].includes(action)||!email.includes('@')){console.error('Uso: npm run comprador -- liberar email "Nome" OU revogar email');process.exit(1)}
const db=await pool.connect();
try{
 await db.query('BEGIN');
 if(action==='liberar'){
  const {rows:[buyer]}=await db.query('INSERT INTO compradores(nome,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET nome=COALESCE(NULLIF(EXCLUDED.nome,\'\'),compradores.nome) RETURNING id',[name,email]);
  await db.query(`INSERT INTO compras(comprador_id,checkout,transacao_id,status,aprovado_em) VALUES($1,'manual',$2,'aprovada',NOW()) ON CONFLICT(checkout,transacao_id) DO UPDATE SET status='aprovada',aprovado_em=CASE WHEN compras.status='aprovada' THEN compras.aprovado_em ELSE NOW() END,atualizado_em=NOW()`,[buyer.id,'manual-'+buyer.id]);
 }else{
  await db.query(`UPDATE compras SET status='cancelada',atualizado_em=NOW() WHERE comprador_id=(SELECT id FROM compradores WHERE email=$1) AND checkout='manual' AND produto_codigo='playbook-yuri'`,[email]);
 }
 await db.query('COMMIT');console.log(action==='liberar'?'Acesso manual liberado.':'Acessos manuais cancelados. Compras de checkout não foram alteradas.');
}catch(e){await db.query('ROLLBACK');console.error('Falha:',e.code||e.name);process.exitCode=1}finally{db.release();await pool.end()}
