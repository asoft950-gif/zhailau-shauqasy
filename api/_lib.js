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
  creator:     { name: 'Жайлау жаратушысы', desc: 'Осы ойынның Создателі', icon: '🌄' },
  pvp_win:     { name: 'Адамды жеңдің', desc: 'Онлайн ойында шын ойыншыны жеңу', icon: '🌐' },
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
  add('pvp_win', win && g.mode === 'pvp');
  add('hunter_50', u.captures >= 50);
  add('rating_1200', u.rating >= 1200);
  return out;
}

/* ---------- result bookkeeping (rating, xp, streak, achievements) ---------- */
export const AI_RATING = { 1: 800, 2: 1000, 3: 1200 };
export async function applyResult(uid, g, oppRating) {
  const u = (await sql.query('SELECT * FROM users WHERE id=$1', [uid]))[0];
  if (!u || u.banned) return null;
  const win = g.result === 'win', draw = g.result === 'draw';
  const score = win ? 1 : draw ? .5 : 0;
  const exp = 1 / (1 + Math.pow(10, (oppRating - u.rating) / 400));
  const dRating = Math.round(24 * (score - exp));
  const dXp = (win ? 30 : draw ? 15 : 8) + g.captures * 2 + (g.mode === 'pvp' ? 10 : 0);
  const dCoins = (win ? 15 : draw ? 8 : 5) + (g.mode === 'pvp' ? 5 : 0);
  const streak = win ? u.streak + 1 : 0;
  const nu = {
    games: u.games + 1, wins: u.wins + (win ? 1 : 0), losses: u.losses + (g.result === 'loss' ? 1 : 0), draws: u.draws + (draw ? 1 : 0),
    captures: u.captures + g.captures, streak, best_streak: Math.max(u.best_streak, streak),
    rating: Math.max(100, u.rating + dRating), xp: u.xp + dXp
  };
  const had = new Set((await sql.query('SELECT key FROM achievements WHERE user_id=$1', [uid])).map(r => r.key));
  const newKeys = earned(nu, g, had);
  const q = [
    sql.query('UPDATE users SET games=$1,wins=$2,losses=$3,draws=$4,captures=$5,streak=$6,best_streak=$7,rating=$8,xp=$9,coins=coins+$11 WHERE id=$10',
      [nu.games, nu.wins, nu.losses, nu.draws, nu.captures, nu.streak, nu.best_streak, nu.rating, nu.xp, uid, dCoins + newKeys.length * 20]),
    sql.query('INSERT INTO games (user_id,result,mode,side,moves,captures,lost,by_piece) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [uid, g.result, g.mode, g.side, g.moves, g.captures, g.lost, JSON.stringify(g.by_piece)])
  ];
  for (const k of newKeys) q.push(sql.query('INSERT INTO achievements (user_id,key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, k]));
  await Promise.all(q);
  return { dRating, dXp, dCoins: dCoins + newKeys.length * 20, rating: nu.rating, xp: nu.xp, level: levelOf(nu.xp), levelUp: levelOf(nu.xp) > levelOf(u.xp), newAchievements: newKeys };
}

/* ---------- daily quests + shop ---------- */
const H5 = 5 * 3600e3; // Asia/Qyzylorda
export function dayInfo() {
  const n = Math.floor((Date.now() + H5) / 86400000);
  return { n, key: new Date(n * 86400000).toISOString().slice(0, 10), start: new Date(n * 86400000 - H5) };
}
export const QUESTS = [
  { k: 'win1', t: 'Бүгін 1 ойында жең', goal: 1, reward: 30, col: "count(*) FILTER (WHERE result='win')" },
  { k: 'play3', t: '3 ойын ойна', goal: 3, reward: 25, col: 'count(*)' },
  { k: 'caps8', t: '8 жауды құлат', goal: 8, reward: 30, col: 'COALESCE(sum(captures),0)' },
  { k: 'pvp1', t: 'Адаммен 1 ойын ойна', goal: 1, reward: 40, col: "count(*) FILTER (WHERE mode='pvp')" },
  { k: 'clean', t: 'Фигурасын жоғалтпай жең', goal: 1, reward: 60, col: "count(*) FILTER (WHERE result='win' AND lost=0)" },
  { k: 'pvpwin', t: 'Адамды жең', goal: 1, reward: 50, col: "count(*) FILTER (WHERE result='win' AND mode='pvp')" }
];
export const DAILY_BONUS = 50;
export const SHOP = { grass: 0, night: 250, snow: 350, sand: 450, royal: 800 };
export async function dailyFor(uid) {
  const d = dayInfo();
  const picks = [0, 2, 4].map(i => QUESTS[(d.n + i) % QUESTS.length]);
  const sel = picks.map((q, i) => `${q.col} AS q${i}`).join(', ');
  const p = (await sql.query(`SELECT ${sel} FROM games WHERE user_id=$1 AND created_at >= $2`, [uid, d.start.toISOString()]))[0] || {};
  const cl = new Set((await sql.query('SELECT key FROM claims WHERE user_id=$1 AND day=$2', [uid, d.key])).map(r => r.key));
  const quests = picks.map((q, i) => ({ key: q.k, title: q.t, goal: q.goal, reward: q.reward, progress: Math.min(q.goal, Number(p['q' + i] || 0)), claimed: cl.has(q.k) }));
  return { day: d.key, quests, bonus: { reward: DAILY_BONUS, claimed: cl.has('all') }, nextAt: new Date(d.start.getTime() + 86400000).toISOString() };
}
export async function claimQuest(uid, key) {
  const d = await dailyFor(uid);
  if (key === 'all') {
    if (!d.quests.every(q => q.claimed) || d.bonus.claimed) return null;
    const r = await sql.query("INSERT INTO claims (user_id,day,key) VALUES ($1,$2,'all') ON CONFLICT DO NOTHING RETURNING key", [uid, d.day]);
    if (!r.length) return null;
    await sql.query('UPDATE users SET coins=coins+$1 WHERE id=$2', [DAILY_BONUS, uid]);
    return DAILY_BONUS;
  }
  const q = d.quests.find(x => x.key === key);
  if (!q || q.claimed || q.progress < q.goal) return null;
  const r = await sql.query('INSERT INTO claims (user_id,day,key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key', [uid, d.day, key]);
  if (!r.length) return null;
  await sql.query('UPDATE users SET coins=coins+$1 WHERE id=$2', [q.reward, uid]);
  return q.reward;
}
