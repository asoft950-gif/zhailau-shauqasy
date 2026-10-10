import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export const sql = globalThis.__TEST_SQL || neon(process.env.DATABASE_URL);
const SECRET = process.env.AUTH_SECRET || '';
const MAX_AGE = 60 * 60 * 24 * 30;

export const send = (res, code, data) => {
  res.status(code);
  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
};

/* ---------- passwords ---------- */
export function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return salt.toString('hex') + ':' + h.toString('hex');
}
export function checkPw(pw, stored) {
  const [s, h] = String(stored).split(':');
  if (!s || !h) return false;
  const x = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  const y = Buffer.from(h, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------- signed cookie session ---------- */
const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
export function setSession(res, uid) {
  const p = Buffer.from(JSON.stringify({ u: uid, e: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  res.setHeader('Set-Cookie', `sid=${p}.${sign(p)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
}
export function clearSession(res) {
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}
export function sessionUid(req) {
  if (!SECRET) return null;
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, sig] = m[1].split('.');
  if (!p || !sig) return null;
  const good = sign(p);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.e > Date.now() ? d.u : null;
  } catch { return null; }
}

/* ---------- misc ---------- */
export async function limited(req, bucket, max, windowSec) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const k = bucket + ':' + ip;
  const r = await sql.query(
    `INSERT INTO rate_limits (k,n,reset_at) VALUES ($1,1,now()+($2||' seconds')::interval)
     ON CONFLICT (k) DO UPDATE SET n = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.n+1 END,
       reset_at = CASE WHEN rate_limits.reset_at < now() THEN now()+($2||' seconds')::interval ELSE rate_limits.reset_at END
     RETURNING n`, [k, String(windowSec)]);
  return r[0].n > max;
}
export const needJson = (req) => /application\/json/.test(req.headers['content-type'] || '');
export const AVATARS = ['P', 'N', 'B', 'R', 'Q', 'K'];
export const levelOf = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;

/* ---------- achievements ---------- */
export const ACH = {
  first_win:   { name: 'Алғашқы жеңіс', desc: 'Бірінші ойында жеңу', icon: '🏆' },
  wins_10:     { name: 'Дала батыры', desc: '10 жеңіс', icon: '⚔️' },
  wins_25:     { name: 'Жайлау билеушісі', desc: '25 жеңіс', icon: '👑' },
  games_10:    { name: 'Жас ойыншы', desc: '10 ойын ойнау', icon: '🎲' },
  games_50:    { name: 'Тәжірибелі', desc: '50 ойын ойнау', icon: '🧭' },
  streak_3:    { name: 'Үш қатар', desc: 'Қатарынан 3 жеңіс', icon: '🔥' },
  streak_5:    { name: 'Тоқтамас', desc: 'Қатарынан 5 жеңіс', icon: '🌪️' },
  quick_win:   { name: 'Найзағай', desc: '20 жүрістен аз уақытта жеңу', icon: '⚡' },
  flawless:    { name: 'Шығынсыз жеңіс', desc: 'Бірде-бір фигураңды жоғалтпай жеңу', icon: '🛡️' },
  draw_1:      { name: 'Тең күрес', desc: 'Тең ойнау', icon: '🤝' },
  hare_kill:   { name: 'Қоян секірісі', desc: 'Қоянмен жауды қағып алу', icon: '🐇' },
  horse_kill:  { name: 'Тұяқ соққысы', desc: 'Жылқымен жауды қағып алу', icon: '🐎' },
  camel_kill:  { name: 'Түйе екпіні', desc: 'Түйемен жауды қағып алу', icon: '🐫' },
  snake_kill:  { name: 'Улы шағу', desc: 'Жыланмен жауды қағып алу', icon: '🐍' },
  eagle_kill:  { name: 'Бүркіттің қармауы', desc: 'Бүркітпен жауды қағып алу', icon: '🦅' },
  king_kill:   { name: 'Батыр қылышы', desc: 'Батырмен жауды қағып алу', icon: '🗡️' },
  promo:       { name: 'Қоян — Бүркіт', desc: 'Қоянды бүркітке айналдыру', icon: '✨' },
  hunter_50:   { name: 'Аңшы', desc: 'Барлығы 50 жауды қағып алу', icon: '🎯' },
  rating_1200: { name: 'Шебер', desc: 'Рейтинг 1200-ге жету', icon: '⭐' }
};
export function earned(u, g, had) {
  const out = [];
  const add = (k, c) => { if (c && !had.has(k)) out.push(k); };
  const win = g.result === 'win';
  add('first_win', u.wins >= 1);
  add('wins_10', u.wins >= 10); add('wins_25', u.wins >= 25);
  add('games_10', u.games >= 10); add('games_50', u.games >= 50);
  add('streak_3', u.best_streak >= 3); add('streak_5', u.best_streak >= 5);
  add('quick_win', win && g.moves <= 20);
  add('flawless', win && g.lost === 0);
  add('draw_1', g.result === 'draw');
  const bp = g.by_piece || {};
  add('hare_kill', bp.P > 0); add('horse_kill', bp.N > 0); add('camel_kill', bp.R > 0);
  add('snake_kill', bp.B > 0); add('eagle_kill', bp.Q > 0); add('king_kill', bp.K > 0);
  add('promo', g.promos > 0);
  add('hunter_50', u.captures >= 50);
  add('rating_1200', u.rating >= 1200);
  return out;
}
