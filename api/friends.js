import { sql, send, sessionUid, needJson, limited } from './_lib.js';

const ONLINE_MS = 75000;

export default async function handler(req, res) {
  try {
    const uid = sessionUid(req);
    if (!uid) return send(res, 401, { error: 'Кіру керек' });
    const me = await sql.query('SELECT banned FROM users WHERE id=$1', [uid]);
    if (!me.length || me[0].banned) return send(res, 403, { error: 'Аккаунт бұғатталған' });

    if (req.method === 'POST') {
      if (!needJson(req)) return send(res, 400, { error: 'json' });
      const b = req.body || {};
      if (b.action === 'add') {
        if (await limited(req, 'fadd', 30, 600)) return send(res, 429, { error: 'Тым жиі' });
        const name = String(b.name || '').trim().toLowerCase();
        if (!name) return send(res, 400, { error: 'Есімді жаз' });
        const u = (await sql.query('SELECT id, username FROM users WHERE username_lc=$1 AND NOT banned', [name]))[0];
        if (!u) return send(res, 404, { error: 'Мұндай ойыншы жоқ' });
        if (u.id === uid) return send(res, 400, { error: 'Өзіңді қоса алмайсың' });
        const ex = (await sql.query('SELECT a, b, status FROM friendships WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)', [uid, u.id]))[0];
        if (ex) {
          if (ex.status === 'accepted') return send(res, 200, { ok: true, state: 'friends', name: u.username });
          if (ex.a === u.id) { await sql.query("UPDATE friendships SET status='accepted' WHERE a=$1 AND b=$2", [u.id, uid]); return send(res, 200, { ok: true, state: 'friends', name: u.username }); }
          return send(res, 200, { ok: true, state: 'sent', name: u.username });
        }
        const cnt = await sql.query('SELECT count(*)::int AS n FROM friendships WHERE a=$1 OR b=$1', [uid]);
        if (cnt[0].n >= 100) return send(res, 400, { error: 'Достар тым көп' });
        await sql.query("INSERT INTO friendships (a,b,status) VALUES ($1,$2,'pending')", [uid, u.id]);
        return send(res, 200, { ok: true, state: 'sent', name: u.username });
      }
      const id = Number(b.id);
      if (!Number.isInteger(id)) return send(res, 400, { error: 'Қате' });
      if (b.action === 'accept') {
        const r = await sql.query("UPDATE friendships SET status='accepted' WHERE a=$1 AND b=$2 AND status='pending' RETURNING a", [id, uid]);
        return send(res, r.length ? 200 : 404, r.length ? { ok: true } : { error: 'Сұраныс жоқ' });
      }
      if (b.action === 'decline' || b.action === 'remove' || b.action === 'cancel') {
        await sql.query('DELETE FROM friendships WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)', [uid, id]);
        return send(res, 200, { ok: true });
      }
      return send(res, 400, { error: 'Қате' });
    }

    if (req.method !== 'GET') return send(res, 405, { error: 'method' });
    await sql.query('UPDATE users SET last_seen=now() WHERE id=$1', [uid]);
    const rows = await sql.query(
      `SELECT f.a, f.b, f.status, u.id AS uid, u.username, u.avatar, u.role, u.rating, u.last_seen, u.hide_online,
         (SELECT m.id FROM matches m WHERE m.mode='pvp' AND m.status='active' AND (m.white_id=u.id OR m.black_id=u.id) ORDER BY m.updated_at DESC LIMIT 1) AS playing
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.a=$1 THEN f.b ELSE f.a END
       WHERE (f.a=$1 OR f.b=$1) AND NOT u.banned`, [uid]);
    const now = Date.now();
    const pub = (r) => ({ id: r.uid, name: r.username, avatar: r.avatar, role: r.role, rating: r.rating, online: !r.hide_online && !!r.last_seen && now - new Date(r.last_seen).getTime() < ONLINE_MS, playing: r.playing || null });
    const friends = rows.filter(r => r.status === 'accepted').map(pub).sort((x, y) => (y.online - x.online) || x.name.localeCompare(y.name));
    const incoming = rows.filter(r => r.status === 'pending' && r.b === uid).map(pub);
    const outgoing = rows.filter(r => r.status === 'pending' && r.a === uid).map(pub);
    const inv = await sql.query(
      `SELECT m.id, m.code, u.username FROM matches m JOIN users u ON u.id=m.white_id
       WHERE m.status='open' AND m.invite_id=$1 AND m.created_at > now() - interval '5 minutes' ORDER BY m.created_at DESC LIMIT 3`, [uid]);
    send(res, 200, { friends, incoming, outgoing, invites: inv.map(x => ({ id: x.id, code: x.code, from: x.username })) });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
