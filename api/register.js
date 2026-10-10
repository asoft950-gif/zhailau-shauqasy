import { sql, send, hashPw, setSession, limited, needJson, AVATARS } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' || !needJson(req)) return send(res, 405, { error: 'method' });
  try {
    if (await limited(req, 'reg', 8, 3600)) return send(res, 429, { error: 'Тым көп әрекет. Кейінірек қайталаңыз.' });
    const b = req.body || {};
    const name = String(b.username || '').trim().normalize('NFC');
    const pw = String(b.password || '');
    if (!/^[\p{L}\p{N}_]{3,20}$/u.test(name)) return send(res, 400, { error: 'Атау 3–20 таңба: әріп, сан немесе _' });
    if (pw.length < 6 || pw.length > 100) return send(res, 400, { error: 'Құпия сөз кемінде 6 таңба' });
    const av = AVATARS.includes(b.avatar) ? b.avatar : 'P';
    /* progress a guest earned before registering is carried over (capped), plus a welcome gift */
    const g = b.guest && typeof b.guest === 'object' ? b.guest : {};
    const cl = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));
    const games = cl(g.g, 30), wins = Math.min(games, cl(g.w, 30)), caps = cl(g.c, 300);
    const xp = wins * 30 + (games - wins) * 10;
    const GIFT = 100;
    const r = await sql.query(
      `INSERT INTO users (username, username_lc, pass_hash, avatar, coins, games, wins, losses, captures, xp, skins) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       ON CONFLICT (username_lc) DO NOTHING RETURNING id`,
      [name, name.toLowerCase(), hashPw(pw), av, GIFT, games, wins, games - wins, caps, xp, JSON.stringify({ own: ['grass'], board: 'grass', pown: ['heroes'] })]);
    if (!r.length) return send(res, 409, { error: 'Бұл атау бос емес' });
    if (wins > 0) await sql.query("INSERT INTO achievements (user_id,key) VALUES ($1,'first_win') ON CONFLICT DO NOTHING", [r[0].id]);
    if (games >= 10) await sql.query("INSERT INTO achievements (user_id,key) VALUES ($1,'games_10') ON CONFLICT DO NOTHING", [r[0].id]);
    setSession(res, r[0].id);
    send(res, 200, { ok: true, gift: { coins: GIFT, skin: 'heroes', games, wins } });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
