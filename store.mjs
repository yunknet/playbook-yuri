import pg from 'pg';
export const pool=new pg.Pool({max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:5000});
pool.on('error',e=>console.error('Conexão PostgreSQL:',e.code||e.name));
const base=`SELECT c.id, MIN(p.aprovado_em) AS aprovado_em FROM compradores c JOIN compras p ON p.comprador_id=c.id WHERE p.status='aprovada' AND p.produto_codigo='playbook-yuri'`;
export const store={
 async byEmail(email){return (await pool.query(base+' AND c.email=$1 GROUP BY c.id',[email])).rows[0]||null},
 async byId(id){return (await pool.query(base+' AND c.id=$1 GROUP BY c.id',[id])).rows[0]||null},
 async applyLastlink(event){
  const db=await pool.connect();
  try{
   await db.query('BEGIN');
   const {rows:[buyer]}=await db.query(`INSERT INTO compradores(nome,email) VALUES($1,$2)
    ON CONFLICT(email) DO UPDATE SET nome=COALESCE(NULLIF(EXCLUDED.nome,''),compradores.nome)
    RETURNING id`,[event.name,event.email]);
   await db.query(`INSERT INTO compras(comprador_id,checkout,transacao_id,produto_codigo,status,aprovado_em,evento_em)
    VALUES($1,'lastlink',$2,'playbook-yuri',$3,$4,$5)
    ON CONFLICT(checkout,transacao_id) DO UPDATE SET
      comprador_id=EXCLUDED.comprador_id,
      status=EXCLUDED.status,
      aprovado_em=CASE WHEN EXCLUDED.status='aprovada' THEN EXCLUDED.aprovado_em ELSE compras.aprovado_em END,
      evento_em=EXCLUDED.evento_em,
      atualizado_em=NOW()
    WHERE compras.produto_codigo='playbook-yuri'
      AND (compras.evento_em IS NULL OR EXCLUDED.evento_em>compras.evento_em
        OR (EXCLUDED.evento_em=compras.evento_em AND compras.status='aprovada' AND EXCLUDED.status<>'aprovada'))`,
    [buyer.id,event.paymentId,event.status,event.approvedAt,event.eventAt]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
 }
};
