import { sql, send } from './_lib.js';
export default async function handler(req, res) {
  try {
    const rows = await sql.query(
      `SELECT username, avatar, rating, wins, games FROM users WHERE games > 0 ORDER BY rating DESC, wins DESC, id ASC LIMIT 20`);
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
    res.status(200).json({ rows });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
