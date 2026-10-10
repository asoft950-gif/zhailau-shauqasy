import { sql, send, checkPw, setSession, limited, needJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' || !needJson(req)) return send(res, 405, { error: 'method' });
  try {
    if (await limited(req, 'login', 15, 600)) return send(res, 429, { error: 'Тым көп әрекет. Бірнеше минуттан кейін қайталаңыз.' });
    const b = req.body || {};
    const name = String(b.username || '').trim().normalize('NFC').toLowerCase();
    const r = await sql.query('SELECT id, pass_hash, banned FROM users WHERE username_lc=$1', [name]);
    const ok = r.length && checkPw(String(b.password || ''), r[0].pass_hash);
    if (!ok) return send(res, 401, { error: 'Атау немесе құпия сөз қате' });
    if (r[0].banned) return send(res, 403, { error: 'Аккаунт бұғатталған' });
    setSession(res, r[0].id);
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
