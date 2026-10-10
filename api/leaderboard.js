import { sql, send } from './_lib.js';
export default async function handler(req, res) {
  try {
    const rows = await sql.query(
      `SELECT username, avatar, role, rating, wins, games FROM users WHERE games > 0 AND NOT banned ORDER BY rating DESC, wins DESC, id ASC LIMIT 20`);
    const cr = await sql.query("SELECT username FROM users WHERE role='creator' AND NOT banned ORDER BY id");
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
    res.status(200).json({ rows, creators: cr.map(x => x.username) });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
