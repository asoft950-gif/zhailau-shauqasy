import { sql, send, sessionUid, needJson, AVATARS, ACH, levelOf } from './_lib.js';

export default async function handler(req, res) {
  try {
    const uid = sessionUid(req);
    if (!uid) return send(res, 200, { user: null });
    const bn = await sql.query('SELECT banned FROM users WHERE id=$1', [uid]);
    if (!bn.length || bn[0].banned) return send(res, 200, { user: null });
    if (req.method === 'PATCH') {
      if (!needJson(req)) return send(res, 400, { error: 'json' });
      const b = req.body || {};
      if (b.avatar !== undefined && AVATARS.includes(b.avatar)) await sql.query('UPDATE users SET avatar=$1 WHERE id=$2', [b.avatar, uid]);
      if (b.bio !== undefined) await sql.query('UPDATE users SET bio=$1 WHERE id=$2', [String(b.bio).slice(0, 140), uid]);
    }
    const u = (await sql.query(
      `SELECT id, username, role, banned, avatar, bio, games, wins, losses, draws, captures, streak, best_streak, rating, xp, created_at,
        (SELECT count(*)+1 FROM users x WHERE x.rating > users.rating) AS rank
       FROM users WHERE id=$1`, [uid]))[0];
    if (!u || u.banned) return send(res, 200, { user: null });
    if (u.role === 'creator') await sql.query("INSERT INTO achievements (user_id,key) VALUES ($1,'creator') ON CONFLICT DO NOTHING", [uid]);
    const ach = await sql.query('SELECT key, unlocked_at FROM achievements WHERE user_id=$1', [uid]);
    const hist = await sql.query('SELECT result, side, moves, captures, lost, created_at FROM games WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10', [uid]);
    send(res, 200, { user: { ...u, level: levelOf(u.xp), xpNext: Math.pow(levelOf(u.xp), 2) * 50 }, achievements: ach, history: hist, catalog: ACH });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
