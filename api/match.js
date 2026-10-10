import crypto from 'node:crypto';
import { sql, send, sessionUid, needJson, limited, applyResult, AI_RATING, CAMP, campaignWin } from './_lib.js';
import { startBoard, applyMove, gameStatus, pickMove } from '../engine.js';

const PC = 'QRBN';
const enc = (m) => m.f | (m.t << 6) | (m.promo ? (PC.indexOf(m.promo) + 1 || 1) << 12 : 0);
const dec = (c) => ({ f: c & 63, t: (c >> 6) & 63, promo: (c >> 12) ? PC[(c >> 12) - 1] || 'Q' : false });
const turnOf = (moves) => (moves.length % 2 ? 'b' : 'w');
const IDLE_MS = 120000;
const TCS = [0, 180, 300, 600];
const INC = { 180: 2, 300: 3, 600: 5 };
/* chess clock: remaining ms for both sides right now (only the side to move is ticking) */
function clockNow(m) {
  if (!m.tc) return null;
  let cw = m.cw, cb = m.cb;
  if (m.status === 'active') {
    const el = Math.max(0, Date.now() - new Date(m.turn_at).getTime());
    if (turnOf(m.moves) === 'w') cw -= el; else cb -= el;
  }
  return { cw: Math.max(0, cw), cb: Math.max(0, cb) };
}
/* if the side to move ran out of time, end the game (idempotent) */
async function flagCheck(m) {
  if (!m.tc || m.status !== 'active') return m;
  const c = clockNow(m), mover = turnOf(m.moves);
  if ((mover === 'w' ? c.cw : c.cb) > 0) return m;
  await finish(m, mover === 'w' ? 'b' : 'w', 'time');
  return await load(m.id);
}

function replay(moves) {
  let b = startBoard();
  const log = [];
  for (const c of moves) {
    const m = dec(c), a = b[m.f], v = b[m.t];
    log.push({ side: a.c, piece: a.t, cap: v ? v.t : (a.t === 'P' && (m.f & 7) !== (m.t & 7) ? 'P' : null), promo: m.promo });
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
    moves: m.moves, turn: turnOf(m.moves), ver: m.ver, tc: m.tc || 0, clock: clockNow(m), camp: m.camp || 0, chat: m.chat || [], cseq: cseqOf(m), you, award: (you && m.awards && m.awards[you]) || null,
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
  if (row.mode === 'ai' && row.camp && winner === 'w' && row.white_id) {
    const cr = await campaignWin(row.white_id, row.camp);
    if (cr) awards.w = { ...(awards.w || {}), camp: cr };
  }
  if (Object.keys(awards).length) await sql.query('UPDATE matches SET awards=$1::jsonb, ver=ver+1 WHERE id=$2', [JSON.stringify(awards), row.id]);
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
        const am = r[0] ? await flagCheck(r[0]) : null;
        return send(res, 200, { match: am && am.status !== 'done' ? await view(am, uid) : (am ? await view(am, uid) : null) });
      }
      if (req.query?.live) {
        const r = await sql.query("SELECT m.id, jsonb_array_length(m.moves) AS plies, w.username AS wn, b.username AS bn, w.rating AS wr, b.rating AS br FROM matches m JOIN users w ON w.id=m.white_id JOIN users b ON b.id=m.black_id WHERE m.mode='pvp' AND m.status='active' AND m.updated_at > now() - interval '3 minutes' ORDER BY m.updated_at DESC LIMIT 8");
        return send(res, 200, { live: r });
      }
      let m = await load(Number(req.query?.id));
      if (!m) return send(res, 404, { error: 'Ойын табылмады' });
      m = await flagCheck(m);
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
      let level = [1, 2, 3].includes(b.level) ? b.level : 3, camp = 0;
      if (b.camp) {
        camp = Math.floor(Number(b.camp));
        const done = (await sql.query('SELECT camp FROM users WHERE id=$1', [uid]))[0].camp;
        if (!CAMP[camp - 1] || camp > done + 1) return send(res, 400, { error: 'Бұл деңгей әлі ашылмаған' });
        level = CAMP[camp - 1].level;
      }
      const r = await sql.query("INSERT INTO matches (code,mode,level,white_id,status,camp) VALUES ($1,'ai',$2,$3,'active',$4) RETURNING *", [newCode() + crypto.randomBytes(2).toString('hex'), level, uid, camp]);
      return send(res, 200, { match: await view(r[0], uid), awards: null });
    }
    if (b.action === 'quick' || b.action === 'create') {
      if (await limited(req, 'newpvp', 40, 600)) return send(res, 429, { error: 'Тым жиі' });
      await cancelOwnOpen(uid);
      const tc = TCS.includes(Number(b.tc)) ? Number(b.tc) : 0;
      if (b.action === 'quick') {
        const j = await sql.query(
          `UPDATE matches SET black_id=$1, status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now(), cw=tc*1000, cb=tc*1000, turn_at=now()
           WHERE id = (SELECT id FROM matches WHERE status='open' AND is_public AND mode='pvp' AND tc=$2 AND white_id IS NOT NULL AND white_id<>$1 AND created_at > now() - interval '5 minutes' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
           AND status='open' RETURNING *`, [uid, tc]);
        if (j.length) return send(res, 200, { match: await view(j[0], uid) });
      }
      const pub = b.action === 'quick';
      const asBlack = !pub && Math.random() < .5;
      const r = await sql.query(
        `INSERT INTO matches (code,mode,white_id,black_id,is_public,status,tc) VALUES ($1,'pvp',$2,$3,$4,'open',$5) RETURNING *`,
        [newCode(), asBlack ? null : uid, asBlack ? uid : null, pub, tc]);
      return send(res, 200, { match: await view(r[0], uid) });
    }
    if (b.action === 'invite') {
      if (await limited(req, 'invite', 30, 600)) return send(res, 429, { error: 'Тым жиі' });
      const to = Number(b.to);
      const fr = await sql.query("SELECT 1 FROM friendships WHERE status='accepted' AND ((a=$1 AND b=$2) OR (a=$2 AND b=$1))", [uid, to]);
      if (!fr.length) return send(res, 403, { error: 'Алдымен дос болу керек' });
      await cancelOwnOpen(uid);
      const tc = TCS.includes(Number(b.tc)) ? Number(b.tc) : 0;
      const r = await sql.query("INSERT INTO matches (code,mode,white_id,is_public,status,invite_id,tc) VALUES ($1,'pvp',$2,false,'open',$3,$4) RETURNING *", [newCode(), uid, to, tc]);
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
      const r = await sql.query(`UPDATE matches SET ${seat}=$1, status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now(), cw=tc*1000, cb=tc*1000, turn_at=now() WHERE id=$2 AND status='open' RETURNING *`, [uid, m.id]);
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
      if (m.tc) {
        const fm = await flagCheck(m);
        if (fm.status !== 'active') return send(res, 200, { match: await view(fm, uid), awards: null });
      }
      if (turnOf(m.moves) !== seat) return send(res, 409, { error: 'Сіздің жүрісіңіз емес', match: await view(m, uid) });
      const { b: board } = replay(m.moves);
      const st = gameStatus(board, seat);
      const f = Math.floor(Number(b.f)), t = Math.floor(Number(b.t));
      const wantP = PC.includes(String(b.promo || '')) && b.promo ? b.promo : 'Q';
      const mv = st.moves.find(x => x.f === f && x.t === t && (!x.promo || x.promo === wantP));
      if (!mv) return send(res, 400, { error: 'Мұндай жүріс жоқ', match: await view(m, uid) });
      let moves = [...m.moves, enc(mv)];
      let nb = applyMove(board, mv);
      let after = gameStatus(nb, seat === 'w' ? 'b' : 'w');
      if (!after.over && m.mode === 'ai') {
        const bm = pickMove(nb, 'b', m.level, m.camp && CAMP[m.camp - 1] ? CAMP[m.camp - 1].noise : 0);
        if (bm) {
          moves.push(enc(bm));
          nb = applyMove(nb, bm);
          after = gameStatus(nb, 'w');
        }
      }
      let clk = null;
      if (m.tc) {
        const c = clockNow(m), left = (seat === 'w' ? c.cw : c.cb) + (INC[m.tc] || 0) * 1000;
        clk = seat === 'w' ? { cw: left, cb: c.cb } : { cw: c.cw, cb: left };
      }
      const upd = await sql.query(
        `UPDATE matches SET moves=$1::jsonb, ver=ver+1, updated_at=now(), seen_${seat}=now(), cw=COALESCE($4, cw), cb=COALESCE($5, cb), turn_at=now() WHERE id=$2 AND ver=$3 AND status='active' RETURNING *`,
        [JSON.stringify(moves), m.id, m.ver, clk && clk.cw, clk && clk.cb]);
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
