import { pickMove } from './engine.js';
onmessage = e => { const d = e.data; const b = d.b.slice(0, 64); b[64] = d.cs ? d.cs[0] : 0; b[65] = d.cs ? d.cs[1] : -1; postMessage({ id: d.id, m: pickMove(b, d.col, d.level) }); };
