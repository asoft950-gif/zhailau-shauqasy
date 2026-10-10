import { sql, send, sessionUid, needJson, AVATARS, ACH, levelOf, dailyFor, claimQuest, SHOP, PSKINS, unlockedPieceSkins, CAMP } from './_lib.js';

export default async function handler(req, res) {
  try {
    const uid = sessionUid(req);
    if (!uid) return send(res, 200, { user: null });
    const bn = await sql.query('SELECT banned FROM users WHERE id=$1', [uid]);
    if (!bn.length || bn[0].banned) return send(res, 200, { user: null });
    if (req.method === 'PATCH') {
      if (!needJson(req)) return send(res, 400, { error: 'json' });
      const b = req.body || {};
      if (b.avatar !== undefined && AVATARS.includes(b.avatar)) await sql.query('UPDATE users SET avatar=$1 WHERE id=$2', [b.avatar, uid]);
      if (b.claim) {
        const got = await claimQuest(uid, String(b.claim));
        if (got === null) return send(res, 400, { error: 'Алу мүмкін емес' });
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
      if (b.bio !== undefined) await sql.query('UPDATE users SET bio=$1 WHERE id=$2', [String(b.bio).slice(0, 140), uid]);
    }
    /* creator: unlimited coins, every skin, every campaign stage, every achievement (for testing) */
    const cr = await sql.query("UPDATE users SET coins=GREATEST(coins,900000000), camp=GREATEST(camp,$2), skins=jsonb_set(jsonb_set(skins,'{own}',$3::jsonb),'{pown}',$4::jsonb) WHERE id=$1 AND role='creator' AND NOT banned RETURNING id", [uid, CAMP.length, JSON.stringify(Object.keys(SHOP)), JSON.stringify(Object.keys(PSKINS))]);
    if (cr.length) await sql.query('INSERT INTO achievements (user_id,key) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [uid, Object.keys(ACH)]);
    const u = (await sql.query(
      `SELECT id, username, role, banned, avatar, bio, games, wins, losses, draws, captures, streak, best_streak, rating, xp, coins, skins, camp, created_at,
        (SELECT count(*)+1 FROM users x WHERE x.rating > users.rating) AS rank
       FROM users WHERE id=$1`, [uid]))[0];
    if (!u || u.banned) return send(res, 200, { user: null });
    if (u.role === 'creator') await sql.query("INSERT INTO achievements (user_id,key) VALUES ($1,'creator') ON CONFLICT DO NOTHING", [uid]);
    const ach = await sql.query('SELECT key, unlocked_at FROM achievements WHERE user_id=$1', [uid]);
    const hist = await sql.query('SELECT result, mode, side, moves, captures, lost, created_at FROM games WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10', [uid]);
    const daily = await dailyFor(uid);
    const medals = await sql.query('SELECT period_key, place FROM season_awards WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [uid]);
    const punlocked = await unlockedPieceSkins({ id: uid, role: u.role, skins: u.skins });
    send(res, 200, { campaign: CAMP, daily, medals, pshop: PSKINS, punlocked, shop: SHOP, user: { ...u, level: levelOf(u.xp), xpNext: Math.pow(levelOf(u.xp), 2) * 50 }, achievements: ach, history: hist, catalog: ACH });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
