import { sql, send, sessionUid, needJson, AVATARS, ACH, levelOf, dailyFor, claimQuest, streakInfo, checkin, openChest, SHOP, PSKINS, unlockedPieceSkins, CAMP, hashPw, checkPw, clearSession } from './_lib.js';

export const BANNERS = ['grass', 'dusk', 'night', 'snow', 'sand', 'royal', 'fire', 'sea'];
const ONLINE_MS = 75000;
const notice = async () => (await sql.query("SELECT id, text, created_at FROM notices WHERE created_at > now() - interval '14 days' ORDER BY id DESC LIMIT 1"))[0] || null;

async function publicProfile(pid) {
  const u = (await sql.query(
    `SELECT id, username, role, avatar, bio, title, banner, showcase, hide_online, games, wins, losses, draws, captures, best_streak, rating, xp, last_seen, created_at, banned,
      (SELECT count(*)+1 FROM users x WHERE x.rating > users.rating AND NOT x.banned) AS rank FROM users WHERE id=$1`, [pid]))[0];
  if (!u || u.banned) return null;
  const ach = (await sql.query('SELECT key FROM achievements WHERE user_id=$1', [pid])).map(r => r.key);
  const clan = (await sql.query('SELECT c.id, c.name, c.tag, c.emblem FROM clan_members m JOIN clans c ON c.id=m.clan_id WHERE m.user_id=$1', [pid]))[0] || null;
  const medals = { 1: 0, 2: 0, 3: 0 };
  for (const m of await sql.query('SELECT place FROM season_awards WHERE user_id=$1', [pid])) if (medals[m.place] != null) medals[m.place]++;
  const recent = await sql.query('SELECT result, mode, moves, created_at FROM games WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5', [pid]);
  const own = new Set(ach);
  return {
    id: u.id, name: u.username, role: u.role, avatar: u.avatar, bio: u.bio, banner: u.banner,
    title: u.title && own.has(u.title) && ACH[u.title] ? u.title : '',
    showcase: (u.showcase || []).filter(k => own.has(k) && ACH[k]),
    level: levelOf(u.xp), xp: u.xp, rating: u.rating, rank: Number(u.rank), games: u.games, wins: u.wins, losses: u.losses, draws: u.draws, captures: u.captures, best_streak: u.best_streak,
    achCount: ach.length, clan, medals, recent, since: u.created_at,
    online: !u.hide_online && !!u.last_seen && Date.now() - new Date(u.last_seen).getTime() < ONLINE_MS,
  };
}

export default async function handler(req, res) {
  try {
    const uid = sessionUid(req);
    if (req.method === 'GET' && req.query && req.query.p !== undefined) {
      const pid = Math.floor(Number(req.query.p));
      const pr = Number.isInteger(pid) && pid > 0 ? await publicProfile(pid) : null;
      return pr ? send(res, 200, { profile: pr, catalog: ACH }) : send(res, 404, { error: 'Ойыншы табылмады' });
    }
    if (!uid) return send(res, 200, { user: null, notice: await notice() });
    const bn = await sql.query('SELECT banned FROM users WHERE id=$1', [uid]);
    if (!bn.length || bn[0].banned) return send(res, 200, { user: null, notice: await notice() });
    if (req.method === 'PATCH') {
      if (!needJson(req)) return send(res, 400, { error: 'json' });
      const b = req.body || {};
      if (b.avatar !== undefined && AVATARS.includes(b.avatar)) await sql.query('UPDATE users SET avatar=$1 WHERE id=$2', [b.avatar, uid]);
      if (b.claim) {
        const got = await claimQuest(uid, String(b.claim));
        if (got === null) return send(res, 400, { error: 'Алу мүмкін емес' });
      }
      if (b.checkin) {
        const c = await checkin(uid);
        if (!c) return send(res, 400, { error: 'Бүгін алынған' });
        b.__ci = c;
      }
      if (b.open) {
        const o = await openChest(uid);
        if (!o) return send(res, 400, { error: 'Сандық жоқ' });
        b.__open = o;
      }
      if (b.buy && Object.hasOwn(SHOP, b.buy)) {
        const r = await sql.query("UPDATE users SET coins=coins-$2, skins=jsonb_set(skins,'{own}', (skins->'own') || to_jsonb($3::text)) WHERE id=$1 AND coins>=$2 AND NOT ((skins->'own') @> to_jsonb($3::text)) RETURNING id", [uid, SHOP[b.buy], b.buy]);
        if (!r.length) return send(res, 400, { error: 'Сатып алу мүмкін емес' });
      }
      if (b.buyP && Object.hasOwn(PSKINS, b.buyP)) {
        const r = await sql.query("UPDATE users SET coins=coins-$2, skins=jsonb_set(skins,'{pown}', COALESCE(skins->'pown','[]'::jsonb) || to_jsonb($3::text)) WHERE id=$1 AND coins>=$2 AND NOT (COALESCE(skins->'pown','[]'::jsonb) @> to_jsonb($3::text)) RETURNING id", [uid, PSKINS[b.buyP].price, b.buyP]);
        if (!r.length) return send(res, 400, { error: 'Сатып алу мүмкін емес' });
      }
      if (b.equipP && Object.hasOwn(PSKINS, b.equipP)) {
        const uu = (await sql.query('SELECT id, role, skins FROM users WHERE id=$1', [uid]))[0];
        if (!(await unlockedPieceSkins(uu)).includes(b.equipP)) return send(res, 400, { error: 'Скин ашылмаған' });
        await sql.query("UPDATE users SET skins=jsonb_set(skins,'{piece}', to_jsonb($2::text)) WHERE id=$1", [uid, b.equipP]);
      }
      if (b.equip && Object.hasOwn(SHOP, b.equip)) {
        await sql.query("UPDATE users SET skins=jsonb_set(skins,'{board}', to_jsonb($2::text)) WHERE id=$1 AND (skins->'own') @> to_jsonb($2::text)", [uid, b.equip]);
      }
      if (b.banner !== undefined && BANNERS.includes(b.banner)) await sql.query('UPDATE users SET banner=$1 WHERE id=$2', [b.banner, uid]);
      if (b.hide_online !== undefined) await sql.query('UPDATE users SET hide_online=$1 WHERE id=$2', [!!b.hide_online, uid]);
      if (b.title !== undefined || b.showcase !== undefined) {
        const have = new Set((await sql.query('SELECT key FROM achievements WHERE user_id=$1', [uid])).map(r => r.key));
        if (b.title !== undefined) {
          const t = String(b.title);
          if (t === '' || (have.has(t) && ACH[t])) await sql.query('UPDATE users SET title=$1 WHERE id=$2', [t, uid]);
        }
        if (Array.isArray(b.showcase)) {
          const sc = [...new Set(b.showcase.map(String))].filter(k => have.has(k) && ACH[k]).slice(0, 3);
          await sql.query('UPDATE users SET showcase=$1::jsonb WHERE id=$2', [JSON.stringify(sc), uid]);
        }
      }
      if (b.pw) {
        const row = (await sql.query('SELECT pass_hash FROM users WHERE id=$1', [uid]))[0];
        const np = String(b.pw.new || '');
        if (!checkPw(String(b.pw.old || ''), row.pass_hash)) return send(res, 400, { error: 'Ескі құпия сөз қате' });
        if (np.length < 6 || np.length > 100) return send(res, 400, { error: 'Жаңа құпия сөз кемінде 6 таңба' });
        await sql.query('UPDATE users SET pass_hash=$1 WHERE id=$2', [hashPw(np), uid]);
      }
      if (b.del) {
        const row = (await sql.query('SELECT pass_hash, role FROM users WHERE id=$1', [uid]))[0];
        if (row.role === 'creator') return send(res, 400, { error: 'Создательді жою мүмкін емес' });
        if (!checkPw(String(b.del.pw || ''), row.pass_hash)) return send(res, 400, { error: 'Құпия сөз қате' });
        await sql.query('DELETE FROM users WHERE id=$1', [uid]);
        clearSession(res);
        return send(res, 200, { ok: true, deleted: true });
      }
      if (b.bio !== undefined) await sql.query('UPDATE users SET bio=$1 WHERE id=$2', [String(b.bio).slice(0, 140), uid]);
      req.__extra = { checkin: b.__ci, opened: b.__open };
    }
    /* creator: unlimited coins, every skin, every campaign stage, every achievement (for testing) */
    const cr = await sql.query("UPDATE users SET coins=GREATEST(coins,900000000), camp=GREATEST(camp,$2), skins=jsonb_set(jsonb_set(skins,'{own}',$3::jsonb),'{pown}',$4::jsonb) WHERE id=$1 AND role='creator' AND NOT banned RETURNING id", [uid, CAMP.length, JSON.stringify(Object.keys(SHOP)), JSON.stringify(Object.keys(PSKINS))]);
    if (cr.length) await sql.query('INSERT INTO achievements (user_id,key) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [uid, Object.keys(ACH)]);
    const u = (await sql.query(
      `SELECT id, username, role, banned, avatar, bio, games, wins, losses, draws, captures, streak, best_streak, rating, xp, coins, skins, camp, title, banner, showcase, hide_online, created_at,
        (SELECT count(*)+1 FROM users x WHERE x.rating > users.rating) AS rank
       FROM users WHERE id=$1`, [uid]))[0];
    if (!u || u.banned) return send(res, 200, { user: null });
    if (u.role === 'creator') await sql.query("INSERT INTO achievements (user_id,key) VALUES ($1,'creator') ON CONFLICT DO NOTHING", [uid]);
    const ach = await sql.query('SELECT key, unlocked_at FROM achievements WHERE user_id=$1', [uid]);
    const hist = await sql.query('SELECT result, mode, side, moves, captures, lost, created_at FROM games WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10', [uid]);
    const clan = (await sql.query('SELECT c.id, c.name, c.tag, c.emblem FROM clan_members m JOIN clans c ON c.id=m.clan_id WHERE m.user_id=$1', [uid]))[0] || null;
    const daily = await dailyFor(uid);
    const streak = await streakInfo(uid);
    const medals = await sql.query('SELECT period_key, place FROM season_awards WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [uid]);
    const punlocked = await unlockedPieceSkins({ id: uid, role: u.role, skins: u.skins });
    send(res, 200, { ...(req.__extra || {}), streak, clan, notice: await notice(), banners: BANNERS, campaign: CAMP, daily, medals, pshop: PSKINS, punlocked, shop: SHOP, user: { ...u, level: levelOf(u.xp), xpNext: Math.pow(levelOf(u.xp), 2) * 50 }, achievements: ach, history: hist, catalog: ACH });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
