import { pickMove, analyzePly } from './engine.js';
onmessage = e => { const d = e.data;
  if (d.analyze) { const out = []; for (let k = 0; k < d.moves.length; k++) { out.push(analyzePly(d.moves, k)); postMessage({ id: d.id, progress: k + 1 }); } postMessage({ id: d.id, done: true, res: out }); return; } const b = d.b.slice(0, 64); b[64] = d.cs ? d.cs[0] : 0; b[65] = d.cs ? d.cs[1] : -1; postMessage({ id: d.id, m: pickMove(b, d.col, d.level, 0, d.persona || null) }); };
