import crypto from 'node:crypto';
import { sql, send, sessionUid, needJson, limited, applyResult, AI_RATING } from './_lib.js';
import { startBoard, applyMove, gameStatus, pickMove } from '../engine.js';

const enc = (m) => m.f | (m.t << 6) | (m.promo ? 1 << 12 : 0);
const dec = (c) => ({ f: c & 63, t: (c >> 6) & 63, promo: !!(c >> 12) });
const turnOf = (moves) => (moves.length % 2 ? 'b' : 'w');
const IDLE_MS = 120000;

function replay(moves) {
  let b = startBoard();
  const log = [];
  for (const c of moves) {
    const m = dec(c), a = b[m.f], v = b[m.t];
    log.push({ side: a.c, piece: a.t, cap: v ? v.t : null, promo: m.promo });
    b = applyMove(b, m);
  }
  return { b, log };
}
function sideStats(log, side) {
  const own = log.filter(x => x.side === side);
  const by = {};
  let caps = 0, promos = 0;
  for (const x of own) { if (x.cap) { caps++; by[x.piece] = (by[x.piece] || 0) + 1; } if (x.promo) promos++; }
  const lost = log.filter(x => x.side !== side && x.cap).length;
  return { moves: own.length, captures: caps, by_piece: by, promos, lost };
}
const newCode = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();

async function who(id) {
  if (!id) return null;
  const r = await sql.query('SELECT id, username, avatar, role, rating, skins FROM users WHERE id=$1', [id]);
  return r[0] || null;
}
const cseqOf = (m) => { const c = m.chat || []; return c.length ? c[c.length - 1].n : 0; };
async function view(m, uid) {
  const [w, b] = await Promise.all([who(m.white_id), who(m.black_id)]);
  const you = uid && m.white_id === uid ? 'w' : uid && m.black_id === uid ? 'b' : null;
  const pub = (u) => u && { id: u.id, name: u.username, avatar: u.avatar, role: u.role, rating: u.rating, skin: (u.skins && u.skins.piece) || 'beast' };
  return {
    id: m.id, code: m.code, mode: m.mode, level: m.level, status: m.status, winner: m.winner, reason: m.reason,
    moves: m.moves, turn: turnOf(m.moves), ver: m.ver, chat: m.chat || [], cseq: cseqOf(m), you, award: (you && m.awards && m.awards[you]) || null,
    white: pub(w) || { name: 'Күтілуде…', avatar: null },
    black: m.mode === 'ai' ? { name: ['', 'Бот · жеңіл', 'Бот · орташа', 'Бот · қиын'][m.level] || 'Бот', avatar: null, bot: true } : (pub(b) || { name: 'Күтілуде…', avatar: null })
  };
}

/* finish a match exactly once and hand out results */
async function finish(m, winner, reason) {
  const r = await sql.query(
    "UPDATE matches SET status='done', winner=$1, reason=$2, ver=ver+1, updated_at=now() WHERE id=$3 AND status='active' RETURNING *",
    [winner, reason, m.id]);
  if (!r.length) return null;
  const row = r[0];
  const { log } = replay(row.moves);
  const rated = row.moves.length >= 8;
  const awards = {};
  if (rated) {
    const res = (side) => (winner === null ? 'draw' : winner === side ? 'win' : 'loss');
    if (row.mode === 'ai') {
      if (row.white_id) awards.w = await applyResult(row.white_id, { ...sideStats(log, 'w'), result: res('w'), mode: 'ai', side: 'w' }, AI_RATING[row.level] || 1200);
    } else {
      const [w, b] = await Promise.all([who(row.white_id), who(row.black_id)]);
      if (w && b) {
        awards.w = await applyResult(w.id, { ...sideStats(log, 'w'), result: res('w'), mode: 'pvp', side: 'w' }, b.rating);
        awards.b = await applyResult(b.id, { ...sideStats(log, 'b'), result: res('b'), mode: 'pvp', side: 'b' }, w.rating);
      }
    }
  }
  if (rated) await sql.query('UPDATE matches SET awards=$1::jsonb, ver=ver+1 WHERE id=$2', [JSON.stringify(awards), row.id]);
  return { row, awards };
}

async function load(id) {
  const r = await sql.query('SELECT * FROM matches WHERE id=$1', [id]);
  return r[0] || null;
}
async function abandonOwnAi(uid) {
  const r = await sql.query("SELECT * FROM matches WHERE mode='ai' AND status='active' AND white_id=$1", [uid]);
  for (const m of r) await finish(m, 'b', 'abandoned');
}
async function cancelOwnOpen(uid) {
  await sql.query("DELETE FROM matches WHERE status='open' AND (white_id=$1 OR black_id=$1)", [uid]);
}

export default async function handler(req, res) {
  try {
    const uid = sessionUid(req);
    if (req.method === 'GET') {
      if (req.query?.active) {
        if (!uid) return send(res, 200, { match: null });
        const r = await sql.query("SELECT * FROM matches WHERE status IN ('active','open') AND (white_id=$1 OR black_id=$1) ORDER BY updated_at DESC LIMIT 1", [uid]);
        return send(res, 200, { match: r[0] ? await view(r[0], uid) : null });
      }
      if (req.query?.live) {
        const r = await sql.query("SELECT m.id, jsonb_array_length(m.moves) AS plies, w.username AS wn, b.username AS bn, w.rating AS wr, b.rating AS br FROM matches m JOIN users w ON w.id=m.white_id JOIN users b ON b.id=m.black_id WHERE m.mode='pvp' AND m.status='active' AND m.updated_at > now() - interval '3 minutes' ORDER BY m.updated_at DESC LIMIT 8");
        return send(res, 200, { live: r });
      }
      const m = await load(Number(req.query?.id));
      if (!m) return send(res, 404, { error: 'Ойын табылмады' });
      const seat = uid && m.white_id === uid ? 'w' : uid && m.black_id === uid ? 'b' : null;
      if (seat && m.status !== 'done') sql.query(`UPDATE matches SET seen_${seat}=now() WHERE id=$1`, [m.id]).catch(() => {});
      if (req.query?.v !== undefined && Number(req.query.v) === m.ver && Number(req.query.c || 0) === cseqOf(m)) return send(res, 200, { same: true, ver: m.ver });
      return send(res, 200, { match: await view(m, uid) });
    }
    if (req.method !== 'POST' || !needJson(req)) return send(res, 405, { error: 'method' });
    if (!uid) return send(res, 401, { error: 'Кіру керек' });
    const bn = await sql.query('SELECT banned FROM users WHERE id=$1', [uid]);
    if (!bn.length || bn[0].banned) return send(res, 403, { error: 'Аккаунт бұғатталған' });
    const b = req.body || {};

    if (b.action === 'emote') {
      if (await limited(req, 'emote' + uid, 25, 30)) return send(res, 429, { error: 'Тым жиі' });
      const m = await load(Number(b.id)), e = Number(b.e);
      if (!m || m.status !== 'active' || m.mode !== 'pvp' || !Number.isInteger(e) || e < 0 || e > 9) return send(res, 400, { error: 'Қате' });
      const side = m.white_id === uid ? 'w' : m.black_id === uid ? 'b' : 'v';
      if (side === 'v' && e < 6) return send(res, 403, { error: 'Көрермен тек реакция жібере алады' });
      const uname = side === 'v' ? ((await who(uid)) || {}).username || '' : '';
      await sql.query(
        "UPDATE matches SET chat = (CASE WHEN jsonb_array_length(chat) >= 20 THEN chat - 0 ELSE chat END) || jsonb_build_array(jsonb_build_object('n', COALESCE((chat->-1->>'n')::int, 0) + 1, 's', $2::text, 'e', $3::int, 'u', $4::text)) WHERE id=$1",
        [m.id, side, e, uname]);
      return send(res, 200, { ok: true });
    }
    if (b.action === 'ai') {
      if (await limited(req, 'newai', 40, 600)) return send(res, 429, { error: 'Тым жиі' });
      await abandonOwnAi(uid); await cancelOwnOpen(uid);
      const level = [1, 2, 3].includes(b.level) ? b.level : 3;
      const r = await sql.query("INSERT INTO matches (code,mode,level,white_id,status) VALUES ($1,'ai',$2,$3,'active') RETURNING *", [newCode() + crypto.randomBytes(2).toString('hex'), level, uid]);
      return send(res, 200, { match: await view(r[0], uid), awards: null });
    }
    if (b.action === 'quick' || b.action === 'create') {
      if (await limited(req, 'newpvp', 40, 600)) return send(res, 429, { error: 'Тым жиі' });
      await cancelOwnOpen(uid);
      if (b.action === 'quick') {
        const j = await sql.query(
          `UPDATE matches SET black_id=$1, status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now()
           WHERE id = (SELECT id FROM matches WHERE status='open' AND is_public AND mode='pvp' AND white_id IS NOT NULL AND white_id<>$1 AND created_at > now() - interval '5 minutes' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
           AND status='open' RETURNING *`, [uid]);
        if (j.length) return send(res, 200, { match: await view(j[0], uid) });
      }
      const pub = b.action === 'quick';
      const asBlack = !pub && Math.random() < .5;
      const r = await sql.query(
        `INSERT INTO matches (code,mode,white_id,black_id,is_public,status) VALUES ($1,'pvp',$2,$3,$4,'open') RETURNING *`,
        [newCode(), asBlack ? null : uid, asBlack ? uid : null, pub]);
      return send(res, 200, { match: await view(r[0], uid) });
    }
    if (b.action === 'invite') {
      if (await limited(req, 'invite', 30, 600)) return send(res, 429, { error: 'Тым жиі' });
      const to = Number(b.to);
      const fr = await sql.query("SELECT 1 FROM friendships WHERE status='accepted' AND ((a=$1 AND b=$2) OR (a=$2 AND b=$1))", [uid, to]);
      if (!fr.length) return send(res, 403, { error: 'Алдымен дос болу керек' });
      await cancelOwnOpen(uid);
      const r = await sql.query("INSERT INTO matches (code,mode,white_id,is_public,status,invite_id) VALUES ($1,'pvp',$2,false,'open',$3) RETURNING *", [newCode(), uid, to]);
      return send(res, 200, { match: await view(r[0], uid) });
    }
    if (b.action === 'join') {
      if (await limited(req, 'join', 40, 600)) return send(res, 429, { error: 'Тым жиі' });
      const code = String(b.code || '').trim().toUpperCase();
      const m = (await sql.query('SELECT * FROM matches WHERE code=$1', [code]))[0];
      if (!m) return send(res, 404, { error: 'Мұндай код жоқ' });
      if (m.white_id === uid || m.black_id === uid) return send(res, 200, { match: await view(m, uid) });
      if (m.status !== 'open') return send(res, 409, { error: 'Бұл ойын басталып кеткен' });
      await cancelOwnOpen(uid);
      const seat = m.white_id ? 'black_id' : 'white_id';
      const r = await sql.query(`UPDATE matches SET ${seat}=$1, status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now() WHERE id=$2 AND status='open' RETURNING *`, [uid, m.id]);
      if (!r.length) return send(res, 409, { error: 'Бұл ойын басталып кеткен' });
      return send(res, 200, { match: await view(r[0], uid) });
    }

    const m = await load(Number(b.id));
    if (!m) return send(res, 404, { error: 'Ойын табылмады' });
    const seat = m.white_id === uid ? 'w' : m.black_id === uid ? 'b' : null;
    if (!seat) return send(res, 403, { error: 'Бұл сіздің ойыныңыз емес' });

    if (b.action === 'cancel') {
      if (m.status === 'open') await sql.query("DELETE FROM matches WHERE id=$1 AND status='open'", [m.id]);
      return send(res, 200, { ok: true });
    }
    if (m.status !== 'active') return send(res, 200, { match: await view(m, uid) });

    if (b.action === 'resign') {
      const f = await finish(m, seat === 'w' ? 'b' : 'w', 'resign');
      const m2 = await load(m.id);
      return send(res, 200, { match: await view(m2, uid), awards: f && f.awards[seat] || null });
    }
    if (b.action === 'claim') {
      const opp = seat === 'w' ? 'b' : 'w';
      const seen = new Date(m[`seen_${opp}`]).getTime();
      if (turnOf(m.moves) !== opp || Date.now() - seen < IDLE_MS) return send(res, 400, { error: 'Әзірге күтіңіз' });
      const f = await finish(m, seat, 'timeout');
      const m2 = await load(m.id);
      return send(res, 200, { match: await view(m2, uid), awards: f && f.awards[seat] || null });
    }
    if (b.action === 'move') {
      if (turnOf(m.moves) !== seat) return send(res, 409, { error: 'Сіздің жүрісіңіз емес', match: await view(m, uid) });
      const { b: board } = replay(m.moves);
      const st = gameStatus(board, seat);
      const f = Math.floor(Number(b.f)), t = Math.floor(Number(b.t));
      const mv = st.moves.find(x => x.f === f && x.t === t);
      if (!mv) return send(res, 400, { error: 'Мұндай жүріс жоқ', match: await view(m, uid) });
      let moves = [...m.moves, enc(mv)];
      let nb = applyMove(board, mv);
      let after = gameStatus(nb, seat === 'w' ? 'b' : 'w');
      if (!after.over && m.mode === 'ai') {
        const bm = pickMove(nb, 'b', m.level);
        if (bm) {
          moves.push(enc(bm));
          nb = applyMove(nb, bm);
          after = gameStatus(nb, 'w');
        }
      }
      const upd = await sql.query(
        `UPDATE matches SET moves=$1::jsonb, ver=ver+1, updated_at=now(), seen_${seat}=now() WHERE id=$2 AND ver=$3 AND status='active' RETURNING *`,
        [JSON.stringify(moves), m.id, m.ver]);
      if (!upd.length) return send(res, 409, { error: 'Синхрон бұзылды', match: await view(await load(m.id), uid) });
      let awards = null;
      if (after.over) {
        const f2 = await finish(upd[0], after.winner, after.reason);
        awards = f2 && f2.awards[seat] || null;
      }
      return send(res, 200, { match: await view(await load(m.id), uid), awards });
    }
    send(res, 400, { error: 'action' });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
