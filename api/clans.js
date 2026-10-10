import { sql, send, sessionUid, needJson, limited } from './_lib.js';

const COST = 100, MAX = 20, ONLINE_MS = 75000;
const EMB = ['🛡️', '⚔️', '🦅', '🐺', '🐎', '🏹', '👑', '🔥', '🌙', '🦁', '🐉', '⭐'];
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

async function detail(cid, uid) {
  const c = (await sql.query('SELECT id, name, tag, emblem, descr, owner_id FROM clans WHERE id=$1', [cid]))[0];
  if (!c) return null;
  const rows = await sql.query(
    `SELECT u.id, u.username, u.avatar, u.rating, u.role AS urole, u.last_seen, u.hide_online, m.role
     FROM clan_members m JOIN users u ON u.id=m.user_id WHERE m.clan_id=$1 AND NOT u.banned ORDER BY (m.role='leader') DESC, u.rating DESC`, [cid]);
  const now = Date.now();
  const members = rows.map(r => ({ id: r.id, name: r.username, avatar: r.avatar, rating: r.rating, role: r.role, online: !r.hide_online && !!r.last_seen && now - new Date(r.last_seen).getTime() < ONLINE_MS }));
  const msgs = await sql.query(
    `SELECT g.id, u.username, g.text, g.created_at FROM clan_msgs g JOIN users u ON u.id=g.user_id WHERE g.clan_id=$1 ORDER BY g.id DESC LIMIT 30`, [cid]);
  return {
    id: c.id, name: c.name, tag: c.tag, emblem: c.emblem, descr: c.descr, max: MAX,
    power: members.reduce((a, m) => a + m.rating, 0), members,
    you: (members.find(m => m.id === uid) || {}).role || null,
    msgs: msgs.reverse().map(m => ({ id: m.id, name: m.username, text: m.text, t: m.created_at })),
  };
}

export default async function handler(req, res) {
  try {
    const uid = sessionUid(req);
    if (!uid) return send(res, 401, { error: 'Кіру керек' });
    const me = (await sql.query('SELECT banned, coins FROM users WHERE id=$1', [uid]))[0];
    if (!me || me.banned) return send(res, 403, { error: 'Аккаунт бұғатталған' });
    const mem = (await sql.query('SELECT clan_id, role FROM clan_members WHERE user_id=$1', [uid]))[0] || null;

    if (req.method === 'POST') {
      if (!needJson(req)) return send(res, 400, { error: 'json' });
      if (await limited(req, 'clan', 120, 600)) return send(res, 429, { error: 'Тым жиі' });
      const b = req.body || {};
      const a = b.action;
      if (a === 'create') {
        if (mem) return send(res, 400, { error: 'Алдымен қазіргі кландан шық' });
        const name = clean(b.name, 20), tag = clean(b.tag, 4).toUpperCase().replace(/[^A-ZА-ЯӘІҢҒҮҰҚӨҺ0-9]/g, '');
        if (name.length < 3) return send(res, 400, { error: 'Аты кемінде 3 әріп' });
        if (tag.length < 2) return send(res, 400, { error: 'Тег 2–4 әріп немесе сан' });
        const emblem = EMB.includes(b.emblem) ? b.emblem : EMB[0];
        const descr = clean(b.descr, 120);
        if ((await sql.query('SELECT 1 FROM clans WHERE name_lc=$1', [name.toLowerCase()])).length) return send(res, 400, { error: 'Бұл ат бос емес' });
        const pay = await sql.query('UPDATE users SET coins=coins-$1 WHERE id=$2 AND coins>=$1 RETURNING coins', [COST, uid]);
        if (!pay.length) return send(res, 400, { error: 'Клан ашуға ' + COST + ' тиын керек' });
        let cid;
        try {
          const r = await sql.query('INSERT INTO clans (name,name_lc,tag,emblem,descr,owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [name, name.toLowerCase(), tag, emblem, descr, uid]);
          cid = r[0].id;
          const j = await sql.query("INSERT INTO clan_members (user_id,clan_id,role) VALUES ($1,$2,'leader') ON CONFLICT DO NOTHING RETURNING user_id", [uid, cid]);
          if (!j.length) throw new Error('already');
        } catch (e) {
          if (cid) await sql.query('DELETE FROM clans WHERE id=$1', [cid]);
          await sql.query('UPDATE users SET coins=coins+$1 WHERE id=$2', [COST, uid]);
          return send(res, 400, { error: 'Клан құру мүмкін болмады' });
        }
        return send(res, 200, { ok: true, coins: pay[0].coins, clan: await detail(cid, uid) });
      }
      if (a === 'join') {
        if (mem) return send(res, 400, { error: 'Алдымен қазіргі кландан шық' });
        const cid = Number(b.id);
        if (!Number.isInteger(cid)) return send(res, 400, { error: 'Қате' });
        if (!(await sql.query('SELECT 1 FROM clans WHERE id=$1', [cid])).length) return send(res, 404, { error: 'Клан жоқ' });
        const n = (await sql.query('SELECT count(*)::int AS n FROM clan_members WHERE clan_id=$1', [cid]))[0].n;
        if (n >= MAX) return send(res, 400, { error: 'Клан толы' });
        await sql.query("INSERT INTO clan_members (user_id,clan_id,role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING", [uid, cid]);
        return send(res, 200, { ok: true, clan: await detail(cid, uid) });
      }
      if (!mem) return send(res, 400, { error: 'Сен кланда жоқсың' });
      const cid = mem.clan_id;
      if (a === 'leave') {
        await sql.query('DELETE FROM clan_members WHERE user_id=$1', [uid]);
        if (mem.role === 'leader') {
          const nx = await sql.query('SELECT user_id FROM clan_members WHERE clan_id=$1 ORDER BY joined_at LIMIT 1', [cid]);
          if (nx.length) {
            await sql.query("UPDATE clan_members SET role='leader' WHERE user_id=$1", [nx[0].user_id]);
            await sql.query('UPDATE clans SET owner_id=$1 WHERE id=$2', [nx[0].user_id, cid]);
          } else await sql.query('DELETE FROM clans WHERE id=$1', [cid]);
        }
        return send(res, 200, { ok: true });
      }
      if (a === 'say') {
        const text = clean(b.text, 200);
        if (!text) return send(res, 400, { error: 'Бос хабар' });
        if (await limited(req, 'clansay', 30, 60)) return send(res, 429, { error: 'Тым жиі' });
        await sql.query('INSERT INTO clan_msgs (clan_id,user_id,text) VALUES ($1,$2,$3)', [cid, uid, text]);
        await sql.query('DELETE FROM clan_msgs WHERE clan_id=$1 AND id <= COALESCE((SELECT id FROM clan_msgs WHERE clan_id=$1 ORDER BY id DESC OFFSET 100 LIMIT 1), 0)', [cid]);
        return send(res, 200, { ok: true, clan: await detail(cid, uid) });
      }
      if (mem.role !== 'leader') return send(res, 403, { error: 'Тек көшбасшы жасай алады' });
      if (a === 'kick') {
        const id = Number(b.id);
        if (!Number.isInteger(id) || id === uid) return send(res, 400, { error: 'Қате' });
        await sql.query('DELETE FROM clan_members WHERE user_id=$1 AND clan_id=$2', [id, cid]);
        return send(res, 200, { ok: true, clan: await detail(cid, uid) });
      }
      if (a === 'edit') {
        const descr = clean(b.descr, 120), emblem = EMB.includes(b.emblem) ? b.emblem : null;
        await sql.query('UPDATE clans SET descr=$1, emblem=COALESCE($2, emblem) WHERE id=$3', [descr, emblem, cid]);
        return send(res, 200, { ok: true, clan: await detail(cid, uid) });
      }
      return send(res, 400, { error: 'Қате' });
    }

    if (req.method !== 'GET') return send(res, 405, { error: 'method' });
    await sql.query('UPDATE users SET last_seen=now() WHERE id=$1', [uid]);
    const top = await sql.query(
      `SELECT c.id, c.name, c.tag, c.emblem, c.descr, count(*)::int AS n, COALESCE(sum(u.rating),0)::int AS power
       FROM clans c JOIN clan_members m ON m.clan_id=c.id JOIN users u ON u.id=m.user_id AND NOT u.banned
       GROUP BY c.id ORDER BY power DESC, c.id LIMIT 20`);
    return send(res, 200, { ok: true, cost: COST, emblems: EMB, coins: me.coins, mine: mem ? await detail(mem.clan_id, uid) : null,
      top: top.map(c => ({ id: c.id, name: c.name, tag: c.tag, emblem: c.emblem, descr: c.descr, n: c.n, max: MAX, power: c.power })) });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
