import { sql, send, sessionUid, needJson, limited, dayInfo } from './_lib.js';
import { legal, applyMove, gameStatus, bestMove } from '../engine.js';
import { PUZZLES } from './_puzzles.js';

const REWARD = 40;
const dec = (s) => [...s].map(ch => ch === '.' ? null : { t: ch.toUpperCase(), c: ch === ch.toUpperCase() ? 'w' : 'b' });
const todays = () => { const d = dayInfo(); const i = d.n % PUZZLES.length; return { d, i, board: dec(PUZZLES[i]) }; };

function mate1(b, col) {
  const o = col === 'w' ? 'b' : 'w';
  for (const m of legal(b, col)) { const s = gameStatus(applyMove(b, m), o); if (s.over && s.winner === col) return m; }
  return null;
}
/* white's m1 forces mate with the next white move, whatever black replies */
function forced(b, m1) {
  const nb = applyMove(b, m1), s = gameStatus(nb, 'b');
  if (s.over) return s.winner === 'w';
  for (const r of s.moves) {
    const b2 = applyMove(nb, r);
    if (gameStatus(b2, 'w').over) return false;
    if (!mate1(b2, 'w')) return false;
  }
  return true;
}
const mvOf = (b, col, o) => {
  const f = Math.floor(Number(o && o.f)), t = Math.floor(Number(o && o.t));
  return gameStatus(b, col).moves.find(x => x.f === f && x.t === t) || null;
};

export default async function handler(req, res) {
  try {
    const { d, i, board } = todays();
    const uid = sessionUid(req);
    if (req.method === 'GET') {
      let solved = false;
      if (uid) solved = (await sql.query("SELECT 1 FROM claims WHERE user_id=$1 AND day=$2 AND key='puz'", [uid, d.key])).length > 0;
      return send(res, 200, { day: d.key, n: i + 1, board, solved, reward: REWARD });
    }
    if (req.method !== 'POST' || !needJson(req)) return send(res, 405, { error: 'method' });
    if (await limited(req, 'puz', 120, 600)) return send(res, 429, { error: 'Тым жиі' });
    const b = req.body || {};
    if (b.step === 1) {
      const m1 = mvOf(board, 'w', b.m1);
      if (!m1) return send(res, 400, { error: 'Мұндай жүріс жоқ' });
      if (!forced(board, m1)) return send(res, 200, { good: false });
      const nb = applyMove(board, m1), s = gameStatus(nb, 'b');
      if (s.over) return send(res, 200, { good: true, done: true });
      const r = bestMove(nb, 'b', 1) || s.moves[0];
      return send(res, 200, { good: true, reply: { f: r.f, t: r.t } });
    }
    if (b.step === 2) {
      const ms = Array.isArray(b.moves) ? b.moves : [];
      if (ms.length < 1 || ms.length > 3) return send(res, 400, { error: 'Қате' });
      const m1 = mvOf(board, 'w', ms[0]);
      if (!m1 || !forced(board, m1)) return send(res, 200, { good: false });
      let cur = applyMove(board, m1), st = gameStatus(cur, 'b');
      if (!st.over) {
        const r = mvOf(cur, 'b', ms[1]);
        if (!r) return send(res, 200, { good: false });
        cur = applyMove(cur, r);
        const m2 = mvOf(cur, 'w', ms[2]);
        if (!m2) return send(res, 200, { good: false });
        cur = applyMove(cur, m2);
        st = gameStatus(cur, 'b');
      }
      if (!(st.over && st.winner === 'w')) return send(res, 200, { good: false });
      let reward = 0;
      if (uid) {
        const c = await sql.query("INSERT INTO claims (user_id,day,key) VALUES ($1,$2,'puz') ON CONFLICT DO NOTHING RETURNING key", [uid, d.key]);
        if (c.length) {
          reward = REWARD;
          await sql.query('UPDATE users SET coins=coins+$1 WHERE id=$2', [REWARD, uid]);
          await sql.query("INSERT INTO achievements (user_id,key) VALUES ($1,'puzzle_1') ON CONFLICT DO NOTHING", [uid]);
        }
      }
      return send(res, 200, { good: true, reward });
    }
    send(res, 400, { error: 'action' });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
