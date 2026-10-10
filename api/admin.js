import { sql, send, sessionUid, needJson } from './_lib.js';

async function creator(req) {
  const uid = sessionUid(req);
  if (!uid) return null;
  const r = await sql.query("SELECT id FROM users WHERE id=$1 AND role='creator' AND NOT banned", [uid]);
  return r.length ? r[0].id : null;
}

export default async function handler(req, res) {
  try {
    const me = await creator(req);
    if (!me) return send(res, 403, { error: 'Рұқсат жоқ' });
    if (req.method === 'GET') {
      const q = String(req.query?.q || '').trim().toLowerCase();
      const rows = await sql.query(
        `SELECT id, username, role, banned, games, wins, rating, created_at FROM users
         WHERE ($1 = '' OR username_lc LIKE '%' || $1 || '%') ORDER BY created_at DESC LIMIT 100`, [q.replace(/[%_]/g, '')]);
      const tot = (await sql.query('SELECT count(*)::int AS n FROM users'))[0].n;
      return send(res, 200, { rows, total: tot, me });
    }
    if (req.method !== 'POST' || !needJson(req)) return send(res, 405, { error: 'method' });
    const b = req.body || {};
    const id = Math.floor(Number(b.id));
    if (!id) return send(res, 400, { error: 'id' });
    if (id === me && ['ban', 'delete'].includes(b.action)) return send(res, 400, { error: 'Өзіңе мұны істей алмайсың' });
    const t = (await sql.query('SELECT role FROM users WHERE id=$1', [id]))[0];
    if (!t) return send(res, 404, { error: 'Табылмады' });
    if (t.role === 'creator' && id !== me) return send(res, 400, { error: 'Басқа Создательге тиіспеймін' });
    if (b.action === 'ban') await sql.query('UPDATE users SET banned=true WHERE id=$1', [id]);
    else if (b.action === 'unban') await sql.query('UPDATE users SET banned=false WHERE id=$1', [id]);
    else if (b.action === 'reset') {
      await sql.query('UPDATE users SET games=0,wins=0,losses=0,draws=0,captures=0,streak=0,best_streak=0,rating=1000,xp=0 WHERE id=$1', [id]);
      await sql.query("DELETE FROM achievements WHERE user_id=$1 AND key<>'creator'", [id]);
      await sql.query('DELETE FROM games WHERE user_id=$1', [id]);
    } else if (b.action === 'delete') await sql.query('DELETE FROM users WHERE id=$1', [id]);
    else return send(res, 400, { error: 'action' });
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
