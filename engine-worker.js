import { pickMove } from './engine.js';
onmessage = e => { const d = e.data; postMessage({ id: d.id, m: pickMove(d.b, d.col, d.level) }); };
