import pg from 'pg';
export const pool=new pg.Pool({max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:5000});
pool.on('error',e=>console.error('Conexão PostgreSQL:',e.code||e.name));
const base=`SELECT c.id, MIN(p.aprovado_em) AS aprovado_em FROM compradores c JOIN compras p ON p.comprador_id=c.id WHERE p.status='aprovada' AND p.produto_codigo='playbook-yuri'`;
export const store={
 async byEmail(email){return (await pool.query(base+' AND c.email=$1 GROUP BY c.id',[email])).rows[0]||null},
 async byId(id){return (await pool.query(base+' AND c.id=$1 GROUP BY c.id',[id])).rows[0]||null}
};
