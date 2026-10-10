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
  snake_kill:  { name: 'Піл соққысы', desc: 'Пілмен жауды қағып алу', icon: '🐘' },
  eagle_kill:  { name: 'Бүркіттің қармауы', desc: 'Бүркітпен жауды қағып алу', icon: '🦅' },
  king_kill:   { name: 'Батыр қылышы', desc: 'Батырмен жауды қағып алу', icon: '🗡️' },
  promo:       { name: 'Қоян — Бүркіт', desc: 'Қоянды бүркітке айналдыру', icon: '✨' },
  hunter_50:   { name: 'Аңшы', desc: 'Барлығы 50 жауды қағып алу', icon: '🎯' },
  creator:     { name: 'Жайлау жаратушысы', desc: 'Осы ойынның Создателі', icon: '🌄' },
  pvp_win:     { name: 'Адамды жеңдің', desc: 'Онлайн ойында шын ойыншыны жеңу', icon: '🌐' },
  rating_1200: { name: 'Шебер', desc: 'Рейтинг 1200-ге жету', icon: '⭐' },
  camp_3:      { name: 'Жорық басталды', desc: 'Батыр жорығының 3-деңгейін өту', icon: '🏹' },
  camp_5:      { name: 'Жорық жартысы', desc: 'Батыр жорығының 5-деңгейін өту', icon: '🛡️' },
  camp_7:      { name: 'Дала көсемі', desc: 'Батыр жорығының 7-деңгейін өту', icon: '🐎' },
  camp_10:     { name: 'Қара Хан жеңілді', desc: 'Батыр жорығын толық өту', icon: '🏔️' },
  puzzle_1:    { name: 'Жұмбақшы', desc: 'Күнделікті жұмбақты шешу', icon: '🧩' }
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
  const chest = g.result === 'win' && g.mode === 'pvp' ? await winChest(uid) : false;
  return { chest, dRating, dXp, dCoins: dCoins + newKeys.length * 20, rating: nu.rating, xp: nu.xp, level: levelOf(nu.xp), levelUp: levelOf(nu.xp) > levelOf(u.xp), newAchievements: newKeys };
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

/* ---------- login streak + chests ---------- */
export const STREAK = [20, 20, 30, 30, 40, 50, 100]; // day 7 also gives a chest
const dayKeyN = n => new Date(n * 86400000).toISOString().slice(0, 10);
export async function streakInfo(uid) {
  const d = dayInfo();
  const u = (await sql.query('SELECT login_streak, streak_day, chests FROM users WHERE id=$1', [uid]))[0] || {};
  const last = u.streak_day || '';
  let count = Number(u.login_streak || 0), canClaim = true;
  if (last === d.key) canClaim = false;
  else if (last !== dayKeyN(d.n - 1)) count = 0;
  const next = canClaim ? (count % 7) + 1 : 0;
  return { count, canClaim, next, rewards: STREAK, chests: Number(u.chests || 0) };
}
export async function checkin(uid) {
  const d = dayInfo();
  const u = (await sql.query('SELECT login_streak, streak_day FROM users WHERE id=$1', [uid]))[0];
  if (!u || u.streak_day === d.key) return null;
  const cont = u.streak_day === dayKeyN(d.n - 1);
  const ns = cont ? Number(u.login_streak || 0) + 1 : 1;
  const day = ((ns - 1) % 7) + 1;
  const coins = STREAK[day - 1], chest = day === 7 ? 1 : 0;
  const r = await sql.query("UPDATE users SET login_streak=$2, streak_day=$3, coins=coins+$4, chests=chests+$5 WHERE id=$1 AND COALESCE(streak_day,'')<>$3 RETURNING id", [uid, ns, d.key, coins, chest]);
  if (!r.length) return null;
  return { streak: ns, day, coins, chest };
}
export async function giveChest(uid, n = 1) { await sql.query('UPDATE users SET chests=chests+$2 WHERE id=$1', [uid, n]); }
/* PvP win -> chest (max 5 per day) */
export async function winChest(uid) {
  const d = dayInfo();
  for (let i = 1; i <= 5; i++) {
    const r = await sql.query('INSERT INTO claims (user_id,day,key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key', [uid, d.key, 'chest' + i]);
    if (r.length) { await giveChest(uid); return true; }
  }
  return false;
}
export async function openChest(uid) {
  const r = await sql.query('UPDATE users SET chests=chests-1 WHERE id=$1 AND chests>0 RETURNING skins', [uid]);
  if (!r.length) return null;
  const sk = r[0].skins || {};
  const ownB = new Set(sk.own || []), ownP = new Set(sk.pown || []);
  const roll = crypto.randomInt(100);
  let out = null;
  if (roll >= 98) out = { type: 'coins', coins: 500, rare: 3 };
  else if (roll >= 90) {
    const free = Object.keys(PSKINS).filter(k => PSKINS[k].price > 0 && !ownP.has(k));
    if (free.length) {
      const k = free[crypto.randomInt(free.length)];
      await sql.query("UPDATE users SET skins=jsonb_set(skins,'{pown}', COALESCE(skins->'pown','[]'::jsonb) || to_jsonb($2::text)) WHERE id=$1", [uid, k]);
      out = { type: 'pskin', key: k, rare: 2 };
    } else out = { type: 'coins', coins: 150, rare: 2 };
  } else if (roll >= 70) {
    const free = Object.keys(SHOP).filter(k => SHOP[k] > 0 && !ownB.has(k));
    if (free.length) {
      const k = free[crypto.randomInt(free.length)];
      await sql.query("UPDATE users SET skins=jsonb_set(skins,'{own}', (skins->'own') || to_jsonb($2::text)) WHERE id=$1", [uid, k]);
      out = { type: 'bskin', key: k, rare: 1 };
    } else out = { type: 'coins', coins: 100, rare: 1 };
  } else out = { type: 'coins', coins: 30 + crypto.randomInt(91), rare: 0 };
  if (out.type === 'coins') await sql.query('UPDATE users SET coins=coins+$2 WHERE id=$1', [uid, out.coins]);
  return out;
}

/* ---------- piece skins ---------- */
export const PSKINS = {
  classic: { price: 0 }, beast: { price: 0 },
  heroes: { price: 500, ach: ['wins_10', 'camp_3'] }, alien: { price: 600, ach: ['pvp_win', 'camp_5'] }, space: { price: 700, ach: ['streak_5', 'camp_7'] },
  dark: { price: 800, ach: ['wins_25', 'camp_10'] }, light: { price: 800, ach: ['rating_1200', 'puzzle_1'] },
  knights: { price: 900, ach: ['wins_25', 'pvp_win'] }
};
export async function unlockedPieceSkins(u) {
  const have = new Set((u.skins && u.skins.pown) || []);
  const ach = new Set((await sql.query('SELECT key FROM achievements WHERE user_id=$1', [u.id])).map(r => r.key));
  return Object.keys(PSKINS).filter(k => PSKINS[k].price === 0 || have.has(k) || u.role === 'creator' || (PSKINS[k].ach && PSKINS[k].ach.some(a => ach.has(a))));
}

/* ---------- Batyr campaign ---------- */
export const CAMP = [
  { title: 'Ұры бекінісі', story: 'Ауылға ұрылар түсті. Жас жауынгер, алғашқы шайқасың осы!', level: 1, noise: 0.6, reward: 20 },
  { title: 'Қасқыр аулау', story: 'Түнде қасқырлар отарға тиді. Жолын кес.', level: 1, noise: 0.4, reward: 25 },
  { title: 'Құм дауылы', story: 'Дауылдың ішінде жау жасырынған. Көзіңді аш.', level: 1, noise: 0.2, reward: 30 },
  { title: 'Тау асуы', story: 'Асудағы күзетшілер өткізбейді. Ақылмен жең.', level: 2, noise: 0.35, reward: 35 },
  { title: 'Күзет қамалы', story: 'Қамал қабырғасы биік, бірақ әр қамалдың әлсіз жері бар.', level: 2, noise: 0.15, reward: 50 },
  { title: 'Түнгі шабуыл', story: 'Жау түнде шабады. Батырың қауіпте болмасын.', level: 2, noise: 0, reward: 50 },
  { title: 'Қара жылқышылар', story: 'Жел сияқты шапқан атты әскер. Жылдамырақ ойлан.', level: 3, noise: 0.25, reward: 60 },
  { title: 'Көсем сайысы', story: 'Көшпенділердің көсемі сені сайысқа шақырады.', level: 3, noise: 0.1, reward: 70 },
  { title: 'Орда қақпасы', story: 'Ордаға жететін соңғы қақпа. Бір қателік жеткілікті.', level: 3, noise: 0, reward: 80 },
  { title: 'Қара Хан', story: 'Жайлауды тартып алған Қара Ханмен соңғы шайқас. Халық саған сенеді!', level: 3, noise: 0, reward: 150 }
];
export async function campaignWin(uid, stage) {
  const c = CAMP[stage - 1];
  if (!c) return null;
  const r = await sql.query('UPDATE users SET camp=$2, coins=coins+$3, chests=chests+1 WHERE id=$1 AND camp<$2 RETURNING camp', [uid, stage, c.reward]);
  if (!r.length) return { stage, first: false, coins: 0, ach: [] };
  const ach = [];
  for (const [k, s] of [['camp_3', 3], ['camp_5', 5], ['camp_7', 7], ['camp_10', 10]]) {
    if (stage >= s) {
      const x = await sql.query('INSERT INTO achievements (user_id,key) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING key', [uid, k]);
      if (x.length) ach.push(k);
    }
  }
  return { stage, first: true, coins: c.reward, ach, chest: true };
}


/* ---------- web push (VAPID keys derived from AUTH_SECRET, so no extra secret to manage) ---------- */
const b64u = (buf) => Buffer.from(buf).toString('base64url');
let _vapid = null;
export function vapidKeys() {
  if (_vapid) return _vapid;
  const seed = crypto.createHash('sha256').update('vapid:' + SECRET).digest();
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(seed);
  _vapid = { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(seed) };
  return _vapid;
}
/* notify every device of a user; never throws, gives up after ~1.5 s so it can be awaited safely */
export async function pushTo(uid, payload) {
  try {
    if (!uid || !SECRET) return;
    const subs = await sql.query('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id=$1 LIMIT 5', [uid]);
    if (!subs.length) return;
    const wp = (await import('web-push')).default;
    const v = vapidKeys();
    wp.setVapidDetails('mailto:admin@zhaylau-shaiqasy.vercel.app', v.publicKey, v.privateKey);
    const body = JSON.stringify(payload);
    await Promise.race([
      Promise.all(subs.map(s => wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 600, timeout: 1400 }).catch(async e => {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) await sql.query('DELETE FROM push_subs WHERE endpoint=$1', [s.endpoint]);
      }))),
      new Promise(r => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* push is best-effort */ }
}


/* ---------- season pass (monthly, UTC+5): points come from games played this month ---------- */
export const PASS_STEP = 100;
export const PASS = [
  { c: 20 }, { c: 30 }, { k: 1 }, { c: 40 }, { c: 50 }, { k: 1 }, { c: 60 }, { c: 70 }, { k: 1 }, { ps: 1, c: 200 },
  { c: 80 }, { c: 90 }, { k: 1 }, { c: 100 }, { c: 120 }, { k: 2 }, { c: 150 }, { c: 200 }, { k: 1 }, { bs: 1, c: 300, k: 2 },
];
function monthWin() {
  const n = dayInfo().n, d = new Date(n * 86400000);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const s = Date.UTC(y, m, 1), e = Date.UTC(y, m + 1, 1);
  return { key: 'pm' + y + '-' + String(m + 1).padStart(2, '0'), start: new Date(s - H5), end: new Date(e - H5) };
}
export async function passInfo(uid) {
  const w = monthWin();
  const pts = Number((await sql.query("SELECT COALESCE(sum(CASE result WHEN 'win' THEN 25 WHEN 'draw' THEN 15 ELSE 10 END),0)::int AS p FROM games WHERE user_id=$1 AND created_at >= $2 AND created_at < $3", [uid, w.start.toISOString(), w.end.toISOString()]))[0].p);
  const cl = new Set((await sql.query('SELECT key FROM claims WHERE user_id=$1 AND day=$2', [uid, w.key])).map(r => r.key));
  return { season: w.key, endsAt: w.end.toISOString(), pts, step: PASS_STEP, tiers: PASS.map((r, i) => ({ t: i + 1, need: (i + 1) * PASS_STEP, c: r.c || 0, k: r.k || 0, ps: !!r.ps, bs: !!r.bs, claimed: cl.has('t' + (i + 1)) })) };
}
export async function passClaim(uid, tier) {
  const i = Math.floor(Number(tier)) - 1, r = PASS[i];
  if (!r) return null;
  const w = monthWin(), info = await passInfo(uid);
  if (info.pts < (i + 1) * PASS_STEP || info.tiers[i].claimed) return null;
  const ins = await sql.query('INSERT INTO claims (user_id,day,key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key', [uid, w.key, 't' + (i + 1)]);
  if (!ins.length) return null;
  const out = { coins: r.c || 0, chests: r.k || 0 };
  const sk = (await sql.query('SELECT skins FROM users WHERE id=$1', [uid]))[0].skins || {};
  if (r.ps) {
    const free = Object.keys(PSKINS).filter(k => PSKINS[k].price > 0 && !(sk.pown || []).includes(k));
    if (free.length) { const k = free[crypto.randomInt(free.length)]; await sql.query("UPDATE users SET skins=jsonb_set(skins,'{pown}', COALESCE(skins->'pown','[]'::jsonb) || to_jsonb($2::text)) WHERE id=$1", [uid, k]); out.pskin = k; out.coins = 0; }
  }
  if (r.bs) {
    const free = Object.keys(SHOP).filter(k => SHOP[k] > 0 && !(sk.own || []).includes(k));
    if (free.length) { const k = free[crypto.randomInt(free.length)]; await sql.query("UPDATE users SET skins=jsonb_set(skins,'{own}', (skins->'own') || to_jsonb($2::text)) WHERE id=$1", [uid, k]); out.bskin = k; }
  }
  if (out.coins) await sql.query('UPDATE users SET coins=coins+$2 WHERE id=$1', [uid, out.coins]);
  if (out.chests) await giveChest(uid, out.chests);
  return out;
}
