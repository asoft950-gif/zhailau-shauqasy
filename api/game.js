import { sql, send, sessionUid, needJson, earned, levelOf } from './_lib.js';

const clampN = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

export default async function handler(req, res) {
  if (req.method !== 'POST' || !needJson(req)) return send(res, 405, { error: 'method' });
  try {
    const uid = sessionUid(req);
    if (!uid) return send(res, 401, { error: 'Кіру керек' });
    const b = req.body || {};
    if (!['win', 'loss', 'draw'].includes(b.result) || b.mode !== 'ai') return send(res, 400, { error: 'Қате деректер' });
    const side = b.side === 'b' ? 'b' : 'w';
    const moves = clampN(b.moves, 500), caps = clampN(b.captures, 30), lost = clampN(b.lost, 30), promos = clampN(b.promos, 8);
    if (moves < 4) return send(res, 400, { error: 'Ойын тым қысқа' });
    const bp = {};
    let sum = 0;
    for (const k of ['P', 'N', 'B', 'R', 'Q', 'K']) { bp[k] = clampN((b.byPiece || {})[k], 30); sum += bp[k]; }
    const capN = Math.min(caps, sum || caps);

    const u = (await sql.query('SELECT * FROM users WHERE id=$1', [uid]))[0];
    const win = b.result === 'win', draw = b.result === 'draw';
    const score = win ? 1 : draw ? .5 : 0;
    const exp = 1 / (1 + Math.pow(10, (1100 - u.rating) / 400));
    const dRating = Math.round(24 * (score - exp));
    const dXp = (win ? 30 : draw ? 15 : 8) + capN * 2;
    const streak = win ? u.streak + 1 : 0;
    const nu = {
      games: u.games + 1, wins: u.wins + (win ? 1 : 0), losses: u.losses + (b.result === 'loss' ? 1 : 0), draws: u.draws + (draw ? 1 : 0),
      captures: u.captures + capN, streak, best_streak: Math.max(u.best_streak, streak),
      rating: Math.max(100, u.rating + dRating), xp: u.xp + dXp
    };
    const had = new Set((await sql.query('SELECT key FROM achievements WHERE user_id=$1', [uid])).map(r => r.key));
    const newKeys = earned(nu, { result: b.result, moves, lost, by_piece: bp, promos }, had);
    const stm = [
      sql.query(`UPDATE users SET games=$1,wins=$2,losses=$3,draws=$4,captures=$5,streak=$6,best_streak=$7,rating=$8,xp=$9 WHERE id=$10`,
        [nu.games, nu.wins, nu.losses, nu.draws, nu.captures, nu.streak, nu.best_streak, nu.rating, nu.xp, uid]),
      sql.query(`INSERT INTO games (user_id,result,mode,side,moves,captures,lost,by_piece) VALUES ($1,$2,'ai',$3,$4,$5,$6,$7)`,
        [uid, b.result, side, moves, capN, lost, JSON.stringify(bp)])
    ];
    for (const k of newKeys) stm.push(sql.query('INSERT INTO achievements (user_id,key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, k]));
    await Promise.all(stm);
    send(res, 200, { dRating, dXp, rating: nu.rating, xp: nu.xp, level: levelOf(nu.xp), levelUp: levelOf(nu.xp) > levelOf(u.xp), newAchievements: newKeys });
  } catch (e) { console.error(e); send(res, 500, { error: 'Сервер қатесі' }); }
}
