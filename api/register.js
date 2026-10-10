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
    const r = await sql.query(
      `INSERT INTO users (username, username_lc, pass_hash, avatar) VALUES ($1,$2,$3,$4)
       ON CONFLICT (username_lc) DO NOTHING RETURNING id`, [name, name.toLowerCase(), hashPw(pw), av]);
    if (!r.length) return send(res, 409, { error: 'Бұл атау бос емес' });
    setSession(res, r[0].id);
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
