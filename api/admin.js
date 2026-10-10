import { sql, send, sessionUid, needJson, ACH, SHOP, PSKINS, CAMP } from './_lib.js';

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

async function actor(req) {
  const uid = sessionUid(req);
  if (!uid) return null;
  const r = await sql.query("SELECT id, username, role FROM users WHERE id=$1 AND role IN ('creator','moderator') AND NOT banned", [uid]);
  return r[0] || null;
}
const logIt = (a, action, target, detail) =>
  sql.query('INSERT INTO admin_log (admin_name, action, target, detail) VALUES ($1,$2,$3,$4)', [a.username, action, String(target || ''), String(detail || '').slice(0, 200)]);

export default async function handler(req, res) {
  try {
    const me = await actor(req);
    if (!me) return send(res, 403, { error: 'Рұқсат жоқ' });
    const boss = me.role === 'creator';

    if (req.method === 'GET') {
      const view = String(req.query?.view || 'users');
      if (view === 'stats') {
        const one = async (q) => (await sql.query(q))[0];
        const u = await one(`SELECT count(*)::int AS total,
            count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS new24,
            count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new7,
            count(*) FILTER (WHERE last_seen > now() - interval '5 minutes')::int AS online,
            count(*) FILTER (WHERE last_seen > now() - interval '24 hours')::int AS dau,
            count(*) FILTER (WHERE banned)::int AS banned,
            count(*) FILTER (WHERE role='moderator')::int AS mods,
            COALESCE(sum(coins) FILTER (WHERE role<>'creator'),0)::bigint AS coins FROM users`);
        const g = await one(`SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS d1 FROM games`);
        const m = await one(`SELECT count(*) FILTER (WHERE status='active')::int AS active, count(*) FILTER (WHERE status='open')::int AS open,
            count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS d1 FROM matches`);
        const c = await one('SELECT count(*)::int AS n FROM clans');
        const top = await sql.query('SELECT username, rating FROM users WHERE NOT banned AND games>0 ORDER BY rating DESC LIMIT 3');
        const days = await sql.query(`SELECT to_char(d::date,'MM-DD') AS d, (SELECT count(*)::int FROM users WHERE created_at::date = d::date) AS reg,
            (SELECT count(*)::int FROM games WHERE created_at::date = d::date) AS games
            FROM generate_series(now() - interval '6 days', now(), interval '1 day') d`);
        return send(res, 200, { users: { ...u, coins: Number(u.coins) }, games: g, matches: m, clans: c.n, top, days, role: me.role });
      }
      if (view === 'clans') {
        const rows = await sql.query(`SELECT c.id, c.name, c.tag, c.emblem, c.created_at, (SELECT username FROM users WHERE id=c.owner_id) AS owner,
            (SELECT count(*)::int FROM clan_members WHERE clan_id=c.id) AS n FROM clans c ORDER BY n DESC, c.id LIMIT 100`);
        return send(res, 200, { rows, role: me.role });
      }
      if (view === 'matches') {
        const rows = await sql.query(`SELECT m.id, m.mode, m.status, m.tc, m.camp, m.updated_at, jsonb_array_length(m.moves)::int AS mv,
            (SELECT username FROM users WHERE id=m.white_id) AS w, (SELECT username FROM users WHERE id=m.black_id) AS b
            FROM matches m WHERE m.status IN ('active','open') AND m.updated_at > now() - interval '1 day' ORDER BY m.updated_at DESC LIMIT 60`);
        return send(res, 200, { rows, role: me.role });
      }
      if (view === 'log') {
        const rows = await sql.query('SELECT admin_name, action, target, detail, created_at FROM admin_log ORDER BY id DESC LIMIT 80');
        const notices = await sql.query('SELECT id, text, by_name, created_at FROM notices ORDER BY id DESC LIMIT 10');
        return send(res, 200, { rows, notices, role: me.role });
      }
      if (view === 'user') {
        const id = Math.floor(Number(req.query?.id));
        const u = (await sql.query(`SELECT id, username, role, banned, avatar, bio, games, wins, losses, draws, rating, xp, coins, camp, skins, title, created_at, last_seen,
            (SELECT c.name FROM clan_members m JOIN clans c ON c.id=m.clan_id WHERE m.user_id=users.id) AS clan FROM users WHERE id=$1`, [id]))[0];
        if (!u) return send(res, 404, { error: 'Табылмады' });
        const ach = (await sql.query('SELECT key FROM achievements WHERE user_id=$1', [id])).map(r => r.key);
        return send(res, 200, { user: u, ach, role: me.role, shop: Object.keys(SHOP), pshop: Object.keys(PSKINS), camps: CAMP.length });
      }
      const q = String(req.query?.q || '').trim().toLowerCase().replace(/[%_]/g, '');
      const flt = String(req.query?.f || '');
      const where = ["($1 = '' OR username_lc LIKE '%' || $1 || '%')"];
      if (flt === 'banned') where.push('banned');
      if (flt === 'staff') where.push("role IN ('creator','moderator')");
      if (flt === 'online') where.push("last_seen > now() - interval '5 minutes'");
      const rows = await sql.query(
        `SELECT id, username, avatar, role, banned, games, wins, rating, coins, last_seen, created_at FROM users WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, [q]);
      const tot = (await sql.query('SELECT count(*)::int AS n FROM users'))[0].n;
      return send(res, 200, { rows, total: tot, me: me.id, role: me.role });
    }

    if (req.method !== 'POST' || !needJson(req)) return send(res, 405, { error: 'method' });
    const b = req.body || {};
    const a = b.action;

    if (a === 'notice') {
      const text = clean(b.text, 280);
      if (!text) return send(res, 400, { error: 'Бос хабар' });
      await sql.query('INSERT INTO notices (text, by_name) VALUES ($1,$2)', [text, me.username]);
      await logIt(me, 'notice', '', text);
      return send(res, 200, { ok: true });
    }
    if (a === 'notice_clear') {
      await sql.query('DELETE FROM notices');
      await logIt(me, 'notice_clear', '', '');
      return send(res, 200, { ok: true });
    }
    if (a === 'clan_delete' || a === 'clan_kick') {
      if (!boss) return send(res, 403, { error: 'Тек Создатель' });
      const cid = Math.floor(Number(b.id));
      const c = (await sql.query('SELECT name FROM clans WHERE id=$1', [cid]))[0];
      if (!c) return send(res, 404, { error: 'Клан жоқ' });
      if (a === 'clan_delete') await sql.query('DELETE FROM clans WHERE id=$1', [cid]);
      else await sql.query('DELETE FROM clan_members WHERE user_id=$1 AND clan_id=$2', [Math.floor(Number(b.uid)), cid]);
      await logIt(me, a, c.name, a === 'clan_kick' ? 'uid ' + b.uid : '');
      return send(res, 200, { ok: true });
    }
    if (a === 'match_end') {
      if (!boss) return send(res, 403, { error: 'Тек Создатель' });
      const r = await sql.query("UPDATE matches SET status='done', reason='admin', ver=ver+1, updated_at=now() WHERE id=$1 AND status IN ('active','open') RETURNING id", [Math.floor(Number(b.id))]);
      await logIt(me, 'match_end', '#' + b.id, '');
      return send(res, r.length ? 200 : 404, r.length ? { ok: true } : { error: 'Ойын табылмады' });
    }

    const id = Math.floor(Number(b.id));
    if (!id) return send(res, 400, { error: 'id' });
    if (id === me.id && ['ban', 'delete', 'role'].includes(a)) return send(res, 400, { error: 'Өзіңе мұны істей алмайсың' });
    const t = (await sql.query('SELECT username, role, skins FROM users WHERE id=$1', [id]))[0];
    if (!t) return send(res, 404, { error: 'Табылмады' });
    if (t.role === 'creator' && id !== me.id) return send(res, 400, { error: 'Басқа Создательге тиіспеймін' });
    if (!boss && t.role === 'moderator') return send(res, 403, { error: 'Модераторға тиісуге болмайды' });

    if (a === 'ban') await sql.query('UPDATE users SET banned=true WHERE id=$1', [id]);
    else if (a === 'unban') await sql.query('UPDATE users SET banned=false WHERE id=$1', [id]);
    else if (!boss) return send(res, 403, { error: 'Тек Создатель' });
    else if (a === 'reset') {
      await sql.query('UPDATE users SET games=0,wins=0,losses=0,draws=0,captures=0,streak=0,best_streak=0,rating=1000,xp=0 WHERE id=$1', [id]);
      await sql.query("DELETE FROM achievements WHERE user_id=$1 AND key<>'creator'", [id]);
      await sql.query('DELETE FROM games WHERE user_id=$1', [id]);
    } else if (a === 'delete') await sql.query('DELETE FROM users WHERE id=$1', [id]);
    else if (a === 'role') {
      const role = b.role === 'moderator' ? 'moderator' : 'player';
      await sql.query("UPDATE users SET role=$1 WHERE id=$2 AND role<>'creator'", [role, id]);
      await logIt(me, 'role', t.username, role);
      return send(res, 200, { ok: true });
    } else if (a === 'coins') {
      const n = Math.max(-1000000, Math.min(1000000, Math.floor(Number(b.n))));
      if (!Number.isFinite(n) || !n) return send(res, 400, { error: 'Сан қате' });
      await sql.query('UPDATE users SET coins=GREATEST(0, coins+$1) WHERE id=$2', [n, id]);
      await logIt(me, 'coins', t.username, (n > 0 ? '+' : '') + n);
      return send(res, 200, { ok: true });
    } else if (a === 'rating') {
      const n = Math.floor(Number(b.n));
      if (!(n >= 100 && n <= 3500)) return send(res, 400, { error: 'Рейтинг 100–3500' });
      await sql.query('UPDATE users SET rating=$1 WHERE id=$2', [n, id]);
      await logIt(me, 'rating', t.username, String(n));
      return send(res, 200, { ok: true });
    } else if (a === 'give') {
      const k = String(b.key || '');
      if (Object.hasOwn(SHOP, k)) await sql.query("UPDATE users SET skins=jsonb_set(skins,'{own}', (COALESCE(skins->'own','[]'::jsonb) - $2) || to_jsonb($2::text)) WHERE id=$1", [id, k]);
      else if (Object.hasOwn(PSKINS, k)) await sql.query("UPDATE users SET skins=jsonb_set(skins,'{pown}', (COALESCE(skins->'pown','[]'::jsonb) - $2) || to_jsonb($2::text)) WHERE id=$1", [id, k]);
      else if (k === 'all_ach') await sql.query('INSERT INTO achievements (user_id,key) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [id, Object.keys(ACH)]);
      else if (k === 'camp') await sql.query('UPDATE users SET camp=GREATEST(camp,$2) WHERE id=$1', [id, CAMP.length]);
      else if (Object.hasOwn(ACH, k)) await sql.query('INSERT INTO achievements (user_id,key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, k]);
      else return send(res, 400, { error: 'Белгісіз сыйлық' });
      await logIt(me, 'give', t.username, k);
      return send(res, 200, { ok: true });
    } else if (a === 'bio_clear') {
      await sql.query("UPDATE users SET bio='', title='' WHERE id=$1", [id]);
    } else return send(res, 400, { error: 'action' });
    await logIt(me, a, t.username, '');
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
