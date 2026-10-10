import { sql, send, sessionUid } from './_lib.js';

const H5 = 5 * 3600e3; // Asia/Qyzylorda
const PRIZE = { week: [200, 120, 80], month: [600, 350, 200] };
const dayN = () => Math.floor((Date.now() + H5) / 86400000);

/* period windows (UTC+5): week = Mon..Sun, month = calendar month */
function window_(period, offset = 0) {
  const n = dayN();
  if (period === 'week') {
    const wi = Math.floor((n + 3) / 7) + offset, s = wi * 7 - 3;
    return { key: 'w' + wi, start: new Date(s * 86400000 - H5), end: new Date((s + 7) * 86400000 - H5), label: 'Апта' };
  }
  const d = new Date(n * 86400000);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + offset;
  const s = Date.UTC(y, m, 1), e = Date.UTC(y, m + 1, 1), sd = new Date(s);
  return { key: 'm' + sd.getUTCFullYear() + '-' + String(sd.getUTCMonth() + 1).padStart(2, '0'), start: new Date(s - H5), end: new Date(e - H5), label: 'Маусым' };
}
async function standings(w, limit) {
  return sql.query(
    `SELECT u.id, u.username, u.avatar, u.role,
       sum(CASE g.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END)::int AS points,
       count(*) FILTER (WHERE g.result='win')::int AS wins, count(*)::int AS games
     FROM games g JOIN users u ON u.id=g.user_id
     WHERE g.mode='pvp' AND g.created_at >= $1 AND g.created_at < $2 AND NOT u.banned
     GROUP BY u.id HAVING sum(CASE g.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END) > 0
     ORDER BY points DESC, wins DESC, games ASC, u.id ASC LIMIT $3`, [w.start.toISOString(), w.end.toISOString(), limit]);
}
/* hand out medals + coins for the period that just ended (once) */
async function finalize(period) {
  const prev = window_(period, -1);
  const top = (await standings(prev, 3));
  for (let i = 0; i < top.length; i++) {
    const r = await sql.query('INSERT INTO season_awards (period_key,user_id,place) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id', [prev.key, top[i].id, i + 1]);
    if (r.length) await sql.query('UPDATE users SET coins=coins+$1 WHERE id=$2', [PRIZE[period][i], top[i].id]);
  }
}
export default async function handler(req, res) {
  try {
    const period = req.query?.period === 'month' ? 'month' : 'week';
    await finalize(period);
    const w = window_(period);
    const rows = await standings(w, 20);
    const uid = sessionUid(req);
    let me = null;
    if (uid) {
      const all = await standings(w, 1000);
      const i = all.findIndex(x => x.id === uid);
      if (i >= 0) me = { rank: i + 1, points: all[i].points, wins: all[i].wins, games: all[i].games };
    }
    const champs = await sql.query(
      `SELECT u.username, u.avatar FROM season_awards a JOIN users u ON u.id=a.user_id WHERE a.period_key=$1 AND a.place=1 AND NOT u.banned`, [window_(period, -1).key]);
    send(res, 200, {
      period, label: w.label, endsAt: w.end.toISOString(), prizes: PRIZE[period],
      rows: rows.map((r, i) => ({ rank: i + 1, name: r.username, avatar: r.avatar, role: r.role, points: r.points, wins: r.wins, games: r.games })),
      me, lastChamp: champs[0] || null
    });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
