import crypto from 'node:crypto';
import { pushTo, sql, send, sessionUid, needJson, limited, applyResult, AI_RATING, CAMP, campaignWin } from './_lib.js';
import { startBoard, applyMove, gameStatus, pickMove, posKey, evalB } from '../engine.js';

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
/* threefold repetition: did the position after the last move occur 3 times? */
function repeated3(moves) {
  let b = startBoard();
  const seen = new Map([[posKey(b, 'w'), 1]]);
  let last = '';
  for (let i = 0; i < moves.length; i++) {
    b = applyMove(b, dec(moves[i]));
    last = posKey(b, i % 2 ? 'w' : 'b');
    seen.set(last, (seen.get(last) || 0) + 1);
  }
  return (seen.get(last) || 0) >= 3;
}
/* fifty-move rule: 100 plies with no capture and no pawn move (pawn layout + piece count unchanged) */
const pawnSig = (b) => { let n = 0, s = ''; for (let i = 0; i < 64; i++) { const p = b[i]; if (p) { n++; if (p.t === 'P') s += i + p.c; } } return n + ':' + s; };
function fifty(moves) {
  if (moves.length < 100) return false;
  let b = startBoard();
  const sigs = [pawnSig(b)];
  for (const c of moves) { b = applyMove(b, dec(c)); sigs.push(pawnSig(b)); }
  const cur = sigs[sigs.length - 1];
  for (let k = sigs.length - 101; k < sigs.length - 1; k++) if (sigs[k] !== cur) return false;
  return true;
}
function sideStats(log, side) {
  const own = log.filter(x => x.side === side);
  const by = {};
  let caps = 0, promos = 0;
  for (const x of own) { if (x.cap) { caps++; by[x.piece] = (by[x.piece] || 0) + 1; } if (x.promo) promos++; }
  const lost = log.filter(x => x.side !== side && x.cap).length;
  return { moves: own.length, captures: caps, by_piece: by, promos, lost };
}
const sideOf = (m, uid) => (uid && (m.white_id === uid || m.white2_id === uid) ? 'w' : uid && (m.black_id === uid || m.black2_id === uid) ? 'b' : null);
/* team games (2v2): the two teammates alternate on their side's moves */
const moverId = (m) => {
  if (!m.team) return null;
  const ply = m.moves.length, white = ply % 2 === 0, second = Math.floor(ply / 2) % 2 === 1;
  return white ? (second ? m.white2_id : m.white_id) : (second ? m.black2_id : m.black_id);
};
const newCode = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();

async function who(id) {
  if (!id) return null;
  const r = await sql.query('SELECT id, username, avatar, role, rating, skins FROM users WHERE id=$1', [id]);
  return r[0] || null;
}
const cseqOf = (m) => { const c = m.chat || []; return c.length ? c[c.length - 1].n : 0; };
const watchersOf = async (id) => (await sql.query("SELECT count(*)::int AS n FROM watchers WHERE match_id=$1 AND seen > now() - interval '15 seconds'", [id]))[0].n;
async function view(m, uid) {
  const [w, b, w2, b2] = await Promise.all([who(m.white_id), who(m.black_id), m.team ? who(m.white2_id) : null, m.team ? who(m.black2_id) : null]);
  const you = sideOf(m, uid);
  let rematch = null;
  if (m.status === 'done' && m.rematch_id && !m.team) {
    const nm = (await sql.query("SELECT id, status, white_id, black_id FROM matches WHERE id=$1", [m.rematch_id]))[0];
    if (nm && nm.status === 'open') rematch = { id: nm.id, byYou: !!uid && (nm.white_id === uid || nm.black_id === uid) };
  }
  const pub = (u) => u && { id: u.id, name: u.username, avatar: u.avatar, role: u.role, rating: u.rating, skin: (u.skins && u.skins.piece) || 'beast' };
  return {
    id: m.id, code: m.code, mode: m.mode, level: m.level, status: m.status, winner: m.winner, reason: m.reason,
    moves: m.moves, turn: turnOf(m.moves), ver: m.ver, watchers: m.status === 'active' && m.mode === 'pvp' ? await watchersOf(m.id) : 0, tc: m.tc || 0, clock: clockNow(m), camp: m.camp || 0, chat: m.chat || [], cseq: cseqOf(m), you, award: (you && m.awards && m.awards[you]) || null,
    draw: m.draw_by || null, rematch, team: !!m.team, mover: moverId(m), myTurn: !!(m.team && uid && moverId(m) === uid), moverName: m.team ? (([w, b, w2, b2].find(x => x && x.id === moverId(m)) || {}).username || '') : '', white2: m.team ? (pub(w2) || { name: 'Күтілуде…', avatar: null }) : null, black2: m.team ? (pub(b2) || { name: 'Күтілуде…', avatar: null }) : null,
    white: pub(w) || { name: 'Күтілуде…', avatar: null },
    black: m.mode === 'ai' ? { name: (({ aggr: 'Қасқыр', def: 'Тасбақа', trick: 'Түлкі' })[m.persona] || 'Бот') + ' · ' + (['', 'жеңіл', 'орташа', 'қиын'][m.level] || ''), avatar: null, bot: true } : (pub(b) || { name: 'Күтілуде…', avatar: null })
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
  const rated = !row.team && (reason !== 'agreed' || row.moves.length >= 20) && (row.moves.length >= 8 || (row.mode === 'pvp' && ['timeout', 'time'].includes(reason) && row.moves.length >= 2));
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
  await sql.query("DELETE FROM matches WHERE status='open' AND (white_id=$1 OR (black_id=$1 AND NOT team))", [uid]);
  await sql.query("UPDATE matches SET white2_id=NULL WHERE status='open' AND team AND white2_id=$1", [uid]);
  await sql.query("UPDATE matches SET black_id=NULL WHERE status='open' AND team AND black_id=$1", [uid]);
  await sql.query("UPDATE matches SET black2_id=NULL WHERE status='open' AND team AND black2_id=$1", [uid]);
}

export default async function handler(req, res) {
  try {
    const uid = sessionUid(req);
    if (req.method === 'GET') {
      if (req.query?.active) {
        if (!uid) return send(res, 200, { match: null });
        const r = await sql.query("SELECT * FROM matches WHERE status IN ('active','open') AND (white_id=$1 OR black_id=$1 OR white2_id=$1 OR black2_id=$1) ORDER BY updated_at DESC LIMIT 1", [uid]);
        const am = r[0] ? await flagCheck(r[0]) : null;
        return send(res, 200, { match: am && am.status !== 'done' ? await view(am, uid) : (am ? await view(am, uid) : null) });
      }
      if (req.query?.live) {
        const r = await sql.query(`SELECT m.id, jsonb_array_length(m.moves)::int AS plies, m.tc, w.username AS wn, b.username AS bn, w.rating AS wr, b.rating AS br,
            (SELECT count(*)::int FROM watchers x WHERE x.match_id=m.id AND x.seen > now() - interval '15 seconds') AS wc
          FROM matches m JOIN users w ON w.id=m.white_id JOIN users b ON b.id=m.black_id
          WHERE m.mode='pvp' AND m.status='active' AND m.updated_at > now() - interval '3 minutes'
          ORDER BY (w.rating + b.rating) DESC, m.updated_at DESC LIMIT 8`);
        return send(res, 200, { live: r });
      }
      if (req.query?.recent) {
        const r = await sql.query(`SELECT m.id, jsonb_array_length(m.moves)::int AS plies, m.winner, m.reason, m.tc, w.username AS wn, b.username AS bn, w.rating AS wr, b.rating AS br, m.updated_at
          FROM matches m JOIN users w ON w.id=m.white_id JOIN users b ON b.id=m.black_id
          WHERE m.mode='pvp' AND m.status='done' AND jsonb_array_length(m.moves) >= 16 AND m.updated_at > now() - interval '3 days'
          ORDER BY (m.reason='mate') DESC, m.updated_at DESC LIMIT 6`);
        return send(res, 200, { recent: r });
      }
      let m = await load(Number(req.query?.id));
      if (!m) return send(res, 404, { error: 'Ойын табылмады' });
      m = await flagCheck(m);
      const seat = sideOf(m, uid);
      if (seat && m.status !== 'done') sql.query(`UPDATE matches SET seen_${seat}=now() WHERE id=$1`, [m.id]).catch(() => {});
      if (!seat && m.status === 'active' && m.mode === 'pvp') {
        const k = uid ? 'u' + uid : 'i' + crypto.createHash('sha1').update(String(req.headers['x-forwarded-for'] || '') + String(req.headers['user-agent'] || '')).digest('hex').slice(0, 12);
        await sql.query('INSERT INTO watchers (match_id,k,seen) VALUES ($1,$2,now()) ON CONFLICT (match_id,k) DO UPDATE SET seen=now()', [m.id, k]);
      }
      if (req.query?.v !== undefined && Number(req.query.v) === m.ver && Number(req.query.c || 0) === cseqOf(m)) return send(res, 200, { same: true, ver: m.ver, watchers: m.status === 'active' ? await watchersOf(m.id) : 0 });
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
      const side = sideOf(m, uid) || 'v';
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
      const persona = !camp && ['aggr', 'def', 'trick'].includes(b.persona) ? b.persona : null;
      const r = await sql.query("INSERT INTO matches (code,mode,level,white_id,status,camp,persona) VALUES ($1,'ai',$2,$3,'active',$4,$5) RETURNING *", [newCode() + crypto.randomBytes(2).toString('hex'), level, uid, camp, persona]);
      return send(res, 200, { match: await view(r[0], uid), awards: null });
    }
    if (b.action === 'quick' || b.action === 'create') {
      if (await limited(req, b.retry ? 'qretry' : 'newpvp', b.retry ? 160 : 40, 600)) return send(res, 429, { error: 'Тым жиі' });
      const tc = TCS.includes(Number(b.tc)) ? Number(b.tc) : 0;
      let own = null;
      if (b.action === 'quick') {
        own = (await sql.query("SELECT * FROM matches WHERE status='open' AND is_public AND mode='pvp' AND white_id=$1 AND tc=$2 AND created_at > now() - interval '5 minutes'", [uid, tc]))[0] || null;
      }
      if (!own) await cancelOwnOpen(uid);
      if (b.action === 'quick') {
        /* rating-aware pairing: the allowed rating gap grows the longer someone waits (150 + 25 per second, so ~2 min for anyone) */
        const waited = own ? Math.max(0, (Date.now() - new Date(own.created_at).getTime()) / 1000) : 0;
        const me = (await sql.query('SELECT rating FROM users WHERE id=$1', [uid]))[0].rating;
        const j = await sql.query(
          `UPDATE matches SET black_id=$1, status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now(), cw=tc*1000, cb=tc*1000, turn_at=now()
           WHERE id = (SELECT m.id FROM matches m JOIN users u ON u.id=m.white_id
             WHERE m.status='open' AND m.is_public AND m.mode='pvp' AND m.tc=$2 AND m.white_id<>$1 AND m.created_at > now() - interval '5 minutes'
               AND abs(u.rating - $3) <= 150 + 25 * GREATEST(EXTRACT(EPOCH FROM (now() - m.created_at)), $4::float)
             ORDER BY abs(u.rating - $3), m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED)
           AND status='open' RETURNING *`, [uid, tc, me, waited]);
        if (j.length) {
          if (own) await sql.query("DELETE FROM matches WHERE id=$1 AND status='open'", [own.id]);
          return send(res, 200, { match: await view(j[0], uid) });
        }
        if (own) return send(res, 200, { match: await view(own, uid), searching: true, gap: Math.round(150 + 25 * waited) });
      }
      const pub = b.action === 'quick';
      const asBlack = !pub && Math.random() < .5;
      const r = await sql.query(
        `INSERT INTO matches (code,mode,white_id,black_id,is_public,status,tc) VALUES ($1,'pvp',$2,$3,$4,'open',$5) RETURNING *`,
        [newCode(), asBlack ? null : uid, asBlack ? uid : null, pub, tc]);
      return send(res, 200, { match: await view(r[0], uid) });
    }
    if (b.action === 'team') {
      if (await limited(req, 'newteam', 20, 600)) return send(res, 429, { error: 'Тым жиі' });
      await cancelOwnOpen(uid);
      const tc = TCS.includes(Number(b.tc)) ? Number(b.tc) : 0;
      const r = await sql.query("INSERT INTO matches (code,mode,white_id,is_public,status,tc,team) VALUES ($1,'pvp',$2,false,'open',$3,true) RETURNING *", [newCode(), uid, tc]);
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
      const inv = await who(uid);
      await pushTo(to, { title: 'Жайлау Шайқасы', body: ((inv && inv.username) || 'Досың') + ' сені ойынға шақырды ♟️', url: '/?join=' + r[0].code, tag: 'invite' });
      return send(res, 200, { match: await view(r[0], uid) });
    }
    if (b.action === 'join') {
      if (await limited(req, 'join', 40, 600)) return send(res, 429, { error: 'Тым жиі' });
      const code = String(b.code || '').trim().toUpperCase();
      const m = (await sql.query('SELECT * FROM matches WHERE code=$1', [code]))[0];
      if (!m) return send(res, 404, { error: 'Мұндай код жоқ' });
      if (sideOf(m, uid)) return send(res, 200, { match: await view(m, uid) });
      if (m.status !== 'open') return send(res, 409, { error: 'Бұл ойын басталып кеткен' });
      await cancelOwnOpen(uid);
      if (m.team) {
        /* seats fill in order: teammate of the host, then the two opponents */
        const cur = await load(m.id);
        const seatT = ['white2_id', 'black_id', 'black2_id'].find(k => !cur[k]);
        if (!seatT) return send(res, 409, { error: 'Бөлме толы' });
        const u1 = await sql.query(`UPDATE matches SET ${seatT}=$1, ver=ver+1, updated_at=now() WHERE id=$2 AND status='open' AND ${seatT} IS NULL RETURNING *`, [uid, m.id]);
        if (!u1.length) return send(res, 409, { error: 'Орын бос емес, қайта көр' });
        const f = u1[0];
        if (f.white_id && f.white2_id && f.black_id && f.black2_id) {
          const a = await sql.query("UPDATE matches SET status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now(), cw=tc*1000, cb=tc*1000, turn_at=now() WHERE id=$1 AND status='open' RETURNING *", [m.id]);
          return send(res, 200, { match: await view(a[0] || f, uid) });
        }
        return send(res, 200, { match: await view(f, uid) });
      }
      const seat = m.white_id ? 'black_id' : 'white_id';
      const r = await sql.query(`UPDATE matches SET ${seat}=$1, status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now(), cw=tc*1000, cb=tc*1000, turn_at=now() WHERE id=$2 AND status='open' RETURNING *`, [uid, m.id]);
      if (!r.length) return send(res, 409, { error: 'Бұл ойын басталып кеткен' });
      return send(res, 200, { match: await view(r[0], uid) });
    }

    const m = await load(Number(b.id));
    if (!m) return send(res, 404, { error: 'Ойын табылмады' });
    const seat = sideOf(m, uid);
    if (!seat) return send(res, 403, { error: 'Бұл сіздің ойыныңыз емес' });

    if (b.action === 'cancel') {
      if (m.status === 'open') await cancelOwnOpen(uid);
      return send(res, 200, { ok: true });
    }
    if (b.action === 'rematch') {
      if (m.status !== 'done' || m.mode !== 'pvp' || m.team) return send(res, 400, { error: 'Реванш мүмкін емес' });
      if (await limited(req, 'rematch' + uid, 20, 300)) return send(res, 429, { error: 'Тым жиі' });
      let nm = m.rematch_id ? (await load(m.rematch_id)) : null;
      if (nm && nm.status === 'open') {
        if (nm.white_id === uid || nm.black_id === uid) return send(res, 200, { match: await view(nm, uid) });
        const seatK = nm.white_id ? 'black_id' : 'white_id';
        await cancelOwnOpen(uid);
        const r = await sql.query(`UPDATE matches SET ${seatK}=$1, status='active', ver=ver+1, updated_at=now(), seen_w=now(), seen_b=now(), cw=tc*1000, cb=tc*1000, turn_at=now() WHERE id=$2 AND status='open' AND ${seatK} IS NULL RETURNING *`, [uid, nm.id]);
        if (!r.length) return send(res, 409, { error: 'Реванш қол жетімсіз' });
        return send(res, 200, { match: await view(r[0], uid) });
      }
      await cancelOwnOpen(uid);
      const oppId = seat === 'w' ? m.black_id : m.white_id;
      /* colours swap: whoever was white is black now */
      const mineWhite = seat === 'b';
      const r = await sql.query("INSERT INTO matches (code,mode,white_id,black_id,is_public,status,tc,invite_id) VALUES ($1,'pvp',$2,$3,false,'open',$4,$5) RETURNING *",
        [newCode(), mineWhite ? uid : null, mineWhite ? null : uid, m.tc || 0, oppId]);
      const u = await sql.query("UPDATE matches SET rematch_id=$1, ver=ver+1 WHERE id=$2 AND rematch_id IS NULL RETURNING id", [r[0].id, m.id]);
      if (!u.length) { await sql.query("DELETE FROM matches WHERE id=$1", [r[0].id]); return send(res, 409, { error: 'Қарсылас бірінші ұсынды, қайта бас' }); }
      return send(res, 200, { match: await view(r[0], uid) });
    }
    if (m.status !== 'active') return send(res, 200, { match: await view(m, uid) });

    if (b.action === 'resign') {
      const f = await finish(m, seat === 'w' ? 'b' : 'w', 'resign');
      const m2 = await load(m.id);
      return send(res, 200, { match: await view(m2, uid), awards: f && f.awards[seat] || null });
    }
    if (b.action === 'draw_offer' || b.action === 'draw_accept' || b.action === 'draw_decline') {
      if (m.mode === 'ai' && b.action === 'draw_offer' && m.moves.length >= 2) {
        /* the bot (black) accepts only when it is not worse and the game has developed */
        if (await limited(req, 'draw' + uid, 30, 300)) return send(res, 429, { error: 'Тым жиі' });
        const ev = evalB(replay(m.moves).b);
        if (m.moves.length >= 30 && ev <= 60) {
          const f = await finish(m, null, 'agreed');
          return send(res, 200, { match: await view(await load(m.id), uid), awards: f && f.awards[seat] || null });
        }
        return send(res, 200, { match: await view(m, uid), declined: true });
      }
      if (m.mode !== 'pvp' || m.moves.length < 2) return send(res, 400, { error: 'Қазір ұсыну мүмкін емес' });
      if (await limited(req, 'draw' + uid, 30, 300)) return send(res, 429, { error: 'Тым жиі' });
      const opp = seat === 'w' ? 'b' : 'w';
      if (b.action === 'draw_decline') {
        await sql.query("UPDATE matches SET draw_by=NULL, ver=ver+1 WHERE id=$1 AND status='active' AND draw_by=$2", [m.id, opp]);
      } else if (b.action === 'draw_accept' || m.draw_by === opp) {
        if (m.draw_by !== opp) return send(res, 400, { error: 'Ұсыныс жоқ' });
        const f = await finish(m, null, 'agreed');
        return send(res, 200, { match: await view(await load(m.id), uid), awards: f && f.awards[seat] || null });
      } else {
        await sql.query("UPDATE matches SET draw_by=$2, ver=ver+1 WHERE id=$1 AND status='active' AND draw_by IS NULL", [m.id, seat]);
      }
      return send(res, 200, { match: await view(await load(m.id), uid) });
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
      if (turnOf(m.moves) !== seat || (m.team && moverId(m) !== uid)) return send(res, 409, { error: m.team && turnOf(m.moves) === seat ? 'Серіктесіңнің жүрісі' : 'Сіздің жүрісіңіз емес', match: await view(m, uid) });
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
        const bm = pickMove(nb, 'b', m.level, m.camp && CAMP[m.camp - 1] ? CAMP[m.camp - 1].noise : 0, m.persona || null);
        if (bm) {
          moves.push(enc(bm));
          nb = applyMove(nb, bm);
          after = gameStatus(nb, 'w');
        }
      }
      if (!after.over && repeated3(moves)) after = { over: true, winner: null, reason: 'repetition' };
      else if (!after.over && fifty(moves)) after = { over: true, winner: null, reason: 'fifty' };
      let clk = null;
      if (m.tc) {
        const c = clockNow(m), left = (seat === 'w' ? c.cw : c.cb) + (INC[m.tc] || 0) * 1000;
        clk = seat === 'w' ? { cw: left, cb: c.cb } : { cw: c.cw, cb: left };
      }
      const upd = await sql.query(
        `UPDATE matches SET moves=$1::jsonb, ver=ver+1, updated_at=now(), seen_${seat}=now(), draw_by=CASE WHEN draw_by='${seat}' THEN draw_by ELSE NULL END, cw=COALESCE($4, cw), cb=COALESCE($5, cb), turn_at=now() WHERE id=$2 AND ver=$3 AND status='active' RETURNING *`,
        [JSON.stringify(moves), m.id, m.ver, clk && clk.cw, clk && clk.cb]);
      if (!upd.length) return send(res, 409, { error: 'Синхрон бұзылды', match: await view(await load(m.id), uid) });
      if (m.mode === 'pvp' && !after.over) {
        const oppSide = seat === 'w' ? 'b' : 'w';
        const nextUid = m.team ? moverId({ ...upd[0] }) : (oppSide === 'w' ? m.white_id : m.black_id);
        const lastSeen = new Date(m['seen_' + oppSide]).getTime();
        if (nextUid && nextUid !== uid && Date.now() - lastSeen > 20000) {
          const me2 = await who(uid);
          await pushTo(nextUid, { title: 'Жайлау Шайқасы', body: ((me2 && me2.username) || 'Қарсылас') + ' жүріс жасады — сенің кезегің', url: '/', tag: 'turn' + m.id });
        }
      }
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
