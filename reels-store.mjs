import {pool} from './store.mjs';
const base = `SELECT c.id FROM compradores c WHERE EXISTS (
 SELECT 1 FROM reels_compras p WHERE p.comprador_id=c.id AND p.status='aprovada' AND p.produto_codigo='reels-yuri')`;
export const reelsStore = {
 async byEmail(email){return (await pool.query(base+' AND c.email=$1',[email])).rows[0]||null},
 async byId(id){return (await pool.query(base+' AND c.id=$1',[id])).rows[0]||null},
 async applyLastlink(event){
  const db=await pool.connect();
  try{
   await db.query('BEGIN');
   const {rows:[buyer]}=await db.query(`INSERT INTO compradores(nome,email) VALUES($1,$2)
    ON CONFLICT(email) DO UPDATE SET nome=COALESCE(NULLIF(EXCLUDED.nome,''),compradores.nome) RETURNING id`,[event.name,event.email]);
   await db.query(`INSERT INTO reels_compras(comprador_id,transacao_id,status,aprovado_em,evento_em)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(checkout,transacao_id) DO UPDATE SET
    status=EXCLUDED.status,
    aprovado_em=CASE WHEN EXCLUDED.status='aprovada' THEN EXCLUDED.aprovado_em ELSE reels_compras.aprovado_em END,
    evento_em=EXCLUDED.evento_em, atualizado_em=NOW()
    WHERE reels_compras.comprador_id=EXCLUDED.comprador_id AND
    (EXCLUDED.evento_em>reels_compras.evento_em OR
    (EXCLUDED.evento_em=reels_compras.evento_em AND reels_compras.status='aprovada' AND EXCLUDED.status<>'aprovada'))`,
    [buyer.id,event.paymentId,event.status,event.approvedAt,event.eventAt]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
 }
};

