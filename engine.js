/* Zhailau Shaiqasy chess engine. Shared by the browser, the AI worker and the server (move validation + bot). */
const N_D=[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const K_D=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const B_D=[[1,1],[1,-1],[-1,1],[-1,-1]];
const R_D=[[1,0],[-1,0],[0,1],[0,-1]];
const VAL={P:100,N:320,B:330,R:500,Q:900,K:0};
function inb(r,c){return r>=0&&r<8&&c>=0&&c<8}
function opp(c){return c==='w'?'b':'w'}
function pseudo(b,i,out){
  const p=b[i],r=i>>3,c=i&7,col=p.c;
  const add=(to,promo)=>out.push({f:i,t:to,promo:!!promo});
  if(p.t==='P'){
    const d=col==='w'?-1:1,st=col==='w'?6:1,last=col==='w'?0:7,r1=r+d;
    if(inb(r1,c)&&!b[r1*8+c]){
      add(r1*8+c,r1===last);
      if(r===st&&!b[(r+2*d)*8+c])add((r+2*d)*8+c,false);
    }
    for(const dc of [-1,1]){
      const cc=c+dc;
      if(inb(r1,cc)){const q=b[r1*8+cc];if(q&&q.c!==col)add(r1*8+cc,r1===last)}
    }
  }else if(p.t==='N'||p.t==='K'){
    const D=p.t==='N'?N_D:K_D;
    for(const [dr,dc] of D){
      const rr=r+dr,cc=c+dc;
      if(!inb(rr,cc))continue;
      const q=b[rr*8+cc];
      if(!q||q.c!==col)add(rr*8+cc);
    }
  }else{
    const D=p.t==='B'?B_D:p.t==='R'?R_D:K_D;
    for(const [dr,dc] of D){
      let rr=r+dr,cc=c+dc;
      while(inb(rr,cc)){
        const q=b[rr*8+cc];
        if(!q)add(rr*8+cc);
        else{if(q.c!==col)add(rr*8+cc);break}
        rr+=dr;cc+=dc;
      }
    }
  }
}
function applyMove(b,m){
  const n=b.slice(),p=n[m.f];
  n[m.f]=null;
  n[m.t]=m.promo?{t:'Q',c:p.c,id:p.id}:p;
  return n;
}
function attacked(b,sq,by){
  const r=sq>>3,c=sq&7;
  const pr=by==='w'?r+1:r-1;
  for(const dc of [-1,1]){
    if(inb(pr,c+dc)){const q=b[pr*8+c+dc];if(q&&q.c===by&&q.t==='P')return true}
  }
  for(const [dr,dc] of N_D){
    if(inb(r+dr,c+dc)){const q=b[(r+dr)*8+c+dc];if(q&&q.c===by&&q.t==='N')return true}
  }
  for(const [dr,dc] of K_D){
    if(inb(r+dr,c+dc)){const q=b[(r+dr)*8+c+dc];if(q&&q.c===by&&q.t==='K')return true}
  }
  for(const [dr,dc] of R_D){
    let rr=r+dr,cc=c+dc;
    while(inb(rr,cc)){
      const q=b[rr*8+cc];
      if(q){if(q.c===by&&(q.t==='R'||q.t==='Q'))return true;break}
      rr+=dr;cc+=dc;
    }
  }
  for(const [dr,dc] of B_D){
    let rr=r+dr,cc=c+dc;
    while(inb(rr,cc)){
      const q=b[rr*8+cc];
      if(q){if(q.c===by&&(q.t==='B'||q.t==='Q'))return true;break}
      rr+=dr;cc+=dc;
    }
  }
  return false;
}
function kingSq(b,col){
  for(let i=0;i<64;i++){const p=b[i];if(p&&p.t==='K'&&p.c===col)return i}
  return -1;
}
function inChk(b,col){
  const k=kingSq(b,col);
  return k>=0&&attacked(b,k,opp(col));
}
function legal(b,col){
  const ps=[],out=[];
  for(let i=0;i<64;i++){const p=b[i];if(p&&p.c===col)pseudo(b,i,ps)}
  for(const m of ps){
    const n=applyMove(b,m);
    if(!inChk(n,col))out.push(m);
  }
  return out;
}
function evalB(b){
  let s=0;
  for(let i=0;i<64;i++){
    const p=b[i];
    if(!p)continue;
    const r=i>>3,c=i&7;
    let v=VAL[p.t];
    const cd=3.5-Math.abs(c-3.5),rd=3.5-Math.abs(r-3.5);
    if(p.t==='P'){const prog=p.c==='w'?6-r:r-1;v+=prog*9+cd*2}
    else if(p.t==='N'||p.t==='B')v+=(cd+rd)*5;
    else if(p.t==='Q')v+=(cd+rd)*1.5;
    else if(p.t==='K'){const home=p.c==='w'?7-r:r;v-=home*6}
    s+=p.c==='w'?v:-v;
  }
  return s;
}
function orderMoves(b,ms){
  const sc=m=>{
    const t=b[m.t],a=b[m.f];
    return (t?10*VAL[t.t]-VAL[a.t]:0)+(m.promo?800:0);
  };
  ms.sort((x,y)=>sc(y)-sc(x));
}
function qs(b,alpha,beta,col,qd){
  const stand=(col==='w'?1:-1)*evalB(b);
  if(stand>=beta)return beta;
  if(stand>alpha)alpha=stand;
  if(qd>=4)return alpha;
  const caps=legal(b,col).filter(m=>b[m.t]);
  orderMoves(b,caps);
  for(const m of caps){
    const sc=-qs(applyMove(b,m),-beta,-alpha,opp(col),qd+1);
    if(sc>=beta)return beta;
    if(sc>alpha)alpha=sc;
  }
  return alpha;
}
function nega(b,d,alpha,beta,col,ply){
  if(d===0)return qs(b,alpha,beta,col,0);
  const ms=legal(b,col);
  if(!ms.length)return inChk(b,col)?-30000+ply:0;
  orderMoves(b,ms);
  for(const m of ms){
    const sc=-nega(applyMove(b,m),d-1,-beta,-alpha,opp(col),ply+1);
    if(sc>=beta)return beta;
    if(sc>alpha)alpha=sc;
  }
  return alpha;
}
function bestMove(b,col,depth){
  const ms=legal(b,col);
  if(!ms.length)return null;
  for(let i=ms.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ms[i],ms[j]]=[ms[j],ms[i]]}
  orderMoves(b,ms);
  let best=ms[0],alpha=-Infinity;
  for(const m of ms){
    const sc=-nega(applyMove(b,m),depth-1,-Infinity,-alpha,opp(col),1);
    if(sc>alpha){alpha=sc;best=m}
  }
  return best;
}

export const ORDER = ['R','N','B','Q','K','B','N','R'];
export function startBoard() {
  const b = new Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    b[c] = { t: ORDER[c], c: 'b' }; b[8 + c] = { t: 'P', c: 'b' };
    b[48 + c] = { t: 'P', c: 'w' }; b[56 + c] = { t: ORDER[c], c: 'w' };
  }
  return b;
}
/* game state after the side `turn` is to move: legal moves, check, and result (winner 'w'|'b'|null) */
export function gameStatus(b, turn) {
  const moves = legal(b, turn);
  const checked = inChk(b, turn);
  const onlyK = b.every(p => !p || p.t === 'K');
  if (!moves.length) return { over: true, winner: checked ? opp(turn) : null, checked, moves, reason: checked ? 'mate' : 'stalemate' };
  if (onlyK) return { over: true, winner: null, checked, moves, reason: 'bare' };
  return { over: false, winner: null, checked, moves, reason: '' };
}
/* difficulty: 1 easy (shallow + mistakes), 2 medium, 3 hard */
export function pickMove(b, col, level, noise = 0) {
  const lv = level === 1 || level === 2 ? level : 3;
  if (noise > 0 && Math.random() < noise) { const ms = legal(b, col); if (ms.length) return ms[Math.floor(Math.random() * ms.length)]; }
  if (lv === 1) {
    const ms = legal(b, col);
    if (!ms.length) return null;
    if (Math.random() < 0.4) return ms[Math.floor(Math.random() * ms.length)];
    return bestMove(b, col, 1);
  }
  return bestMove(b, col, lv === 2 ? 2 : 3);
}
export { N_D, K_D, B_D, R_D, VAL, inb, opp, pseudo, applyMove, attacked, kingSq, inChk, legal, evalB, orderMoves, qs, nega, bestMove };
