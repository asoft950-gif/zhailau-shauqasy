/* Piece skins. Local space: tile = 100 units, feet at (0,0), up is -y, figure faces right.
   Every skin supplies pal{w,b} and draw{P,N,B,R,Q,K}; all take (ctx, palette, o) like the original animals. */
export function makeSkins(K){
const {E,Fill,RR,Tube,mixc,lit,drk,TAU}=K;
const poly=(c,pts,fill,P,lw,y0,y1)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();Fill(c,fill,P,lw,y0,y1)};
const crv=(c,fn,fill,P,lw,y0,y1)=>{c.beginPath();fn(c);c.closePath();Fill(c,fill,P,lw,y0,y1)};
function eyes(c,x,y,gap,r,o,col,P){
  for(const s of(gap?[-1,1]:[0])){
    const ex=x+s*gap;
    if(o.mood==='dead'){c.strokeStyle=P.line;c.lineWidth=1.8;c.beginPath();c.moveTo(ex-r,y-r);c.lineTo(ex+r,y+r);c.moveTo(ex+r,y-r);c.lineTo(ex-r,y+r);c.stroke()}
    else if(o.blink){c.strokeStyle=P.line;c.lineWidth=1.8;c.beginPath();c.moveTo(ex-r,y);c.lineTo(ex+r,y);c.stroke()}
    else{c.fillStyle=o.mood==='angry'?'#ff3b30':(col||'#111');c.beginPath();c.ellipse(ex,y,r,r*1.15,0,0,TAU);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(ex+r*.3,y-r*.3,r*.35,0,TAU);c.fill()}
  }
}
const glow=(c,x,y,r,col,a)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(255,255,255,0)');c.save();c.globalAlpha=(a===undefined?.7:a)*c.globalAlpha;c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore()};
const wrap=fn=>(c,P,o)=>{
  const bob=o.moving?-Math.abs(Math.sin(o.ph*1.6))*2.5:Math.sin(o.t*2.4+o.id)*-.7;
  c.save();c.translate((o.strike||0)*9,bob);c.rotate(-(o.rear||0)*.28+(o.strike||0)*.06);fn(c,P,o);c.restore();
};
const SKINTONE='#F0C4A0';

/* ============ CLASSIC (Staunton) ============ */
function base(c,P,w){
  E(c,0,-2.5,w,5.5,P.dark,P,0,2);
  RR(c,-w*.78,-13,w*1.56,10,4,P.main,P,2);
  E(c,0,-12.5,w*.78,3.4,P.light,P,0,1.6,false);
}
function stem(c,P,y0,y1,w0,w1){
  crv(c,c=>{c.moveTo(-w0,y0);c.quadraticCurveTo(-w1*1.05,(y0+y1)/2,-w1,y1);c.lineTo(w1,y1);c.quadraticCurveTo(w1*1.05,(y0+y1)/2,w0,y0)},P.main,P,2.2,y1,y0);
}
function collar(c,P,y,w){E(c,0,y,w,3.6,P.main,P,0,2,false);E(c,0,y-1.6,w*.85,2,P.light,P,0,0,false)}
const CL={
  P(c,P,o){base(c,P,19);stem(c,P,-12,-36,9,5);collar(c,P,-36,11);E(c,0,-48,9.5,9.5,P.main,P)},
  R(c,P,o){
    base(c,P,23);stem(c,P,-12,-52,15,11.5);
    collar(c,P,-52,17);
    RR(c,-16,-72,32,18,3,P.main,P);
    for(const x of[-14,-4.6,4.6]){c.fillStyle=P.dark;c.fillRect(x,-76,9.4,6);c.strokeStyle=P.line;c.lineWidth=1.6;c.strokeRect(x,-76,9.4,6)}
    c.fillStyle=P.dark;c.fillRect(-16,-72,32,3);
    RR(c,-16,-72,32,18,3,null,P,2.2);
  },
  B(c,P,o){
    base(c,P,21);stem(c,P,-12,-52,11,6);collar(c,P,-50,12);
    E(c,0,-67,10.5,15,P.main,P);
    c.strokeStyle=P.line;c.lineWidth=2.6;c.beginPath();c.moveTo(-3,-76);c.lineTo(5,-62);c.stroke();
    E(c,0,-84,4.2,4.2,P.accent,P);
  },
  N(c,P,o){
    base(c,P,22);
    crv(c,c=>{
      c.moveTo(-15,-12);c.quadraticCurveTo(-17,-40,-9,-58);c.quadraticCurveTo(-12,-72,-2,-84);
      c.lineTo(2,-92);c.lineTo(8,-84);c.quadraticCurveTo(22,-80,30,-62);
      c.quadraticCurveTo(32,-56,26,-54);c.quadraticCurveTo(16,-56,10,-52);
      c.quadraticCurveTo(18,-34,17,-12);
    },P.main,P,2.4,-92,-12);
    crv(c,c=>{c.moveTo(-9,-58);c.quadraticCurveTo(-12,-72,-2,-84);c.lineTo(2,-92);c.quadraticCurveTo(-8,-76,-4,-58)},P.dark,P,1.6);
    c.fillStyle=o.mood==='dead'?P.line:'#111';c.beginPath();c.arc(12,-72,2.2,0,TAU);c.fill();
    c.fillStyle=P.line;c.beginPath();c.arc(27,-60,1.4,0,TAU);c.fill();
  },
  Q(c,P,o){
    base(c,P,23);stem(c,P,-12,-62,14,8);collar(c,P,-58,12);
    E(c,0,-66,12,8,P.main,P);
    crv(c,c=>{c.moveTo(-13,-70);c.lineTo(-15,-86);c.lineTo(-7,-78);c.lineTo(0,-90);c.lineTo(7,-78);c.lineTo(15,-86);c.lineTo(13,-70);c.quadraticCurveTo(0,-64,-13,-70)},P.accent,P,2,-90,-64);
    for(const [x,y] of[[-15,-88],[0,-92],[15,-88]])E(c,x,y,3.2,3.2,P.light,P,0,1.4);
  },
  K(c,P,o){
    base(c,P,23);stem(c,P,-12,-64,14,9);collar(c,P,-60,12.5);
    E(c,0,-67,12,8,P.main,P);
    RR(c,-8,-82,16,14,5,P.main,P);
    RR(c,-2.6,-100,5.2,22,1.5,P.accent,P,1.8);RR(c,-9,-94,18,5.2,1.5,P.accent,P,1.8);
  }
};
const classic={name:'Классика',desc:'Дәстүрлі шахмат фигуралары',
  pal:{w:{main:'#EFE3C8',light:'#FFF8E6',dark:'#B9A57E',line:'#3b2f1c',accent:'#D9A82B'},
       b:{main:'#45424F',light:'#7A7788',dark:'#23212B',line:'#08080D',accent:'#D9A82B'}},
  draw:{},sc:{P:.98,N:.9,B:.9,R:.92,Q:.86,K:.82},names:{P:'Пешка',N:'Ат',B:'Піл',R:'Тура',Q:'Ханша',K:'Патша'}};
for(const k in CL)classic.draw[k]=wrap(CL[k]);

/* ============ shared: humanoid + horse builders ============ */
function human(c,P,o,g){
  const s=g.s||1,L=g.legs||P.dark,B=g.body||P.main,sk=g.skin||SKINTONE;
  c.save();c.scale(s,s);
  if(g.back)g.back(c,P,o);
  RR(c,-9.5,-26,8,26,3,L,P,2);RR(c,1.5,-26,8,26,3,L,P,2);
  RR(c,-11.5,-7,12,7,3,g.boots||drk(L),P,2);RR(c,0,-7,12,7,3,g.boots||drk(L),P,2);
  // off arm (behind torso)
  Tube(c,()=>{c.beginPath();c.moveTo(-12,-52);c.quadraticCurveTo(-19,-44,-17,-34)},6,g.sleeve||B,P);
  crv(c,c=>{c.moveTo(-13.5,-25);c.lineTo(13.5,-25);c.lineTo(12,-54);c.quadraticCurveTo(0,-59,-12,-54)},B,P,2.2,-58,-24);
  RR(c,-13.5,-33,27,5.5,2,g.belt||P.dark,P,1.8);
  if(g.chest)g.chest(c,P,o);
  E(c,-17,-33,3.6,3.6,sk,P,0,1.6,false);
  if(g.off){c.save();c.translate(-17,-34);g.off(c,P,o);c.restore()}
  // weapon arm
  const sw=o.strike||0;
  Tube(c,()=>{c.beginPath();c.moveTo(12,-52);c.quadraticCurveTo(20,-46,19+sw*3,-37)},6,g.sleeve||B,P);
  E(c,19+sw*3,-37,3.6,3.6,sk,P,0,1.6,false);
  if(g.weapon){c.save();c.translate(19+sw*3,-37);c.rotate(-.12+sw*.95);g.weapon(c,P,o);c.restore()}
  // head
  RR(c,-3.2,-62,6.4,7,2,sk,P,1.6);
  E(c,0,-67,9.4,10.2,sk,P,0,2.2);
  eyes(c,1.2,-67.5,3.8,1.9,o,g.eye,P);
  if(o.mood!=='dead'){c.strokeStyle=P.line;c.lineWidth=1.3;c.beginPath();c.moveTo(-1.5,-61.5);c.quadraticCurveTo(1.5,-60,4.2,-61.5);c.stroke()}
  if(g.head){c.save();c.translate(0,-67);g.head(c,P,o);c.restore()}
  if(g.front)g.front(c,P,o);
  c.restore();
}
function horse(c,P,o,g){
  const k=o.moving?Math.sin(o.ph)*6:0,coat=g.coat,mane=g.mane||P.dark;
  if(g.back)g.back(c,P,o);
  // tail
  Tube(c,()=>{c.beginPath();c.moveTo(-24,-42);c.quadraticCurveTo(-40,-40,-37,-14+k*.3)},6,mane,P);
  const leg=(x,dx,col)=>{
    Tube(c,()=>{c.beginPath();c.moveTo(x,-32);c.lineTo(x+dx,-15);c.lineTo(x+dx*1.2,-4)},6.5,col,P);
    RR(c,x+dx*1.2-4,-6,8,6,2,g.hoof||P.line,P,1.6);
  };
  leg(-15,k*.4,drk(coat));leg(9,-k*.4,drk(coat));
  E(c,0,-40,26,14,coat,P);
  if(g.saddle){E(c,-2,-52,11,4.6,g.saddle,P,0,1.8)}
  leg(-6,-k*.4,coat);leg(17,k*.4,coat);
  // neck + head
  c.beginPath();
  c.moveTo(12,-46);c.quadraticCurveTo(14,-66,22,-80);c.quadraticCurveTo(30,-86,36,-76);
  c.quadraticCurveTo(46,-68,46,-60);c.quadraticCurveTo(44,-55,38,-58);c.quadraticCurveTo(32,-60,28,-62);
  c.quadraticCurveTo(30,-50,26,-38);c.closePath();Fill(c,coat,P,2.4,-86,-36);
  // mane
  Tube(c,()=>{c.beginPath();c.moveTo(18,-80);c.quadraticCurveTo(10,-66,12,-48)},5.5,mane,P);
  if(g.horn){poly(c,[[27,-82],[31,-82],[34,-104]],g.horn,P,1.6);}
  E(c,26,-80,2.6,4.2,coat,P,.4,1.6,false);
  // eye
  if(o.mood==='dead'){c.strokeStyle=P.line;c.lineWidth=1.6;c.beginPath();c.moveTo(30,-74);c.lineTo(35,-69);c.moveTo(35,-74);c.lineTo(30,-69);c.stroke()}
  else{c.fillStyle=o.mood==='angry'?'#ff3b30':(g.eye||'#111');c.beginPath();c.arc(33,-72,2.1,0,TAU);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(33.7,-72.8,.8,0,TAU);c.fill()}
  c.fillStyle=P.line;c.beginPath();c.arc(44,-60,1.3,0,TAU);c.fill();
  if(g.front)g.front(c,P,o);
  if(g.rider){c.save();c.translate(-3,-52);c.scale(.62,.62);human(c,P,o,g.rider);c.restore()}
}

/* ============ HEROES: Kazakh batyrs ============ */
const HP={w:{main:'#C8372D',light:'#F07A5E',dark:'#8E1F1A',line:'#2E0B09',accent:'#F5C94A'},
          b:{main:'#2F63B8',light:'#79A5E8',dark:'#1B3C78',line:'#08142B',accent:'#E7EEF7'}};
const borik=(c,P,col)=>{ // fur hat
  crv(c,c=>{c.moveTo(-10,-5);c.quadraticCurveTo(-12,-18,0,-19);c.quadraticCurveTo(12,-18,10,-5);c.quadraticCurveTo(0,-8,-10,-5)},col||P.accent,P,2,-19,-5);
  E(c,0,-5,11,3.6,'#5A3A22',P,0,1.8,false);
};
const helmet=(c,P,tall,plume)=>{
  crv(c,c=>{c.moveTo(-10,-3);c.quadraticCurveTo(-11,-14-tall,0,-17-tall);c.quadraticCurveTo(11,-14-tall,10,-3);c.lineTo(-10,-3)},STEEL_(P),P,2.2,-17-tall,-3);
  RR(c,-10.5,-6,21,3.6,1.5,P.accent,P,1.6);
  if(plume){Tube(c,()=>{c.beginPath();c.moveTo(0,-17-tall);c.quadraticCurveTo(-8,-26-tall,-14,-16-tall)},4,plume,P)}
  poly(c,[[-1.6,-3],[1.6,-3],[1.4,6],[-1.4,6]],STEEL_(P),P,1.3);
};
const STEEL_=P=>'#C5CEDA';
const sword=(c,P,len,col)=>{
  poly(c,[[-2,-4],[2,-4],[2,-len],[0,-len-5],[-2,-len]],col||'#E6EDF5',P,1.6,0,-len);
  RR(c,-6.5,-6,13,3,1.4,P.accent,P,1.4);RR(c,-1.7,-1,3.4,8,1.4,P.dark,P,1.2);
};
const spear=(c,P,len)=>{
  c.strokeStyle=P.line;c.lineWidth=5;c.beginPath();c.moveTo(0,10);c.lineTo(0,-len);c.stroke();
  c.strokeStyle='#8B5A2B';c.lineWidth=2.8;c.beginPath();c.moveTo(0,10);c.lineTo(0,-len);c.stroke();
  poly(c,[[-3.6,-len],[0,-len-14],[3.6,-len]],'#E6EDF5',P,1.4);
  poly(c,[[0,-len+6],[12,-len+10],[0,-len+16]],P.accent,P,1.2);
};
const bow=(c,P)=>{
  Tube(c,()=>{c.beginPath();c.moveTo(0,-20);c.quadraticCurveTo(14,0,0,20)},3,'#7A4A22',P);
  c.strokeStyle='#EEE';c.lineWidth=1;c.beginPath();c.moveTo(0,-20);c.lineTo(0,20);c.stroke();
};
const roundShield=(c,P,r,col)=>{
  E(c,-4,0,r,r,col||P.accent,P,0,2.2);E(c,-4,0,r*.62,r*.62,P.main,P,0,1.6,false);E(c,-4,0,r*.22,r*.22,STEEL_(P),P,0,1.4);
};
const HEROES={name:'Батырлар',desc:'Дала жауынгерлері',pal:HP,sc:{P:.95,N:.88,B:1,R:1,Q:1,K:1},names:{P:'Жас жауынгер',N:'Атты сарбаз',B:'Бақсы',R:'Қорғаншы',Q:'Батыр ару',K:'Хан'},draw:{
  P:(c,P,o)=>human(c,P,o,{s:.9,body:P.main,legs:'#4B3A2A',head:(c,P)=>helmet(c,P,0),weapon:(c,P)=>sword(c,P,22),off:(c,P)=>roundShield(c,P,10),chest:(c,P)=>{RR(c,-8,-48,16,4,1.5,P.accent,P,1.2)}}),
  N:(c,P,o)=>horse(c,P,o,{coat:'#9A6B3F',mane:'#2A1A0E',saddle:P.main,rider:{s:1,body:P.main,legs:'#4B3A2A',head:(c,P)=>borik(c,P),weapon:(c,P)=>spear(c,P,34),eye:'#111'},front:(c,P)=>{Orn_(c,P)}}),
  B:(c,P,o)=>human(c,P,o,{s:.96,body:mixc(P.main,'#FFFFFF',.15),legs:P.dark,skin:SKINTONE,
    head:(c,P)=>{borik(c,P,'#EDE3CF');Tube(c,()=>{c.beginPath();c.moveTo(4,-16);c.quadraticCurveTo(12,-28,6,-34)},3,P.accent,P);},
    weapon:(c,P)=>{Tube(c,()=>{c.beginPath();c.moveTo(0,12);c.lineTo(0,-34)},3.2,'#7A4A22',P);E(c,0,-38,5,5,P.accent,P,0,1.6);glow(c,0,-38,13,'#FFF3B0',.5)},
    chest:(c,P)=>{RR(c,-13.5,-45,27,3.4,1.4,P.accent,P,1.2)},
    back:(c,P)=>{crv(c,c=>{c.moveTo(-14,-56);c.lineTo(-20,-6);c.lineTo(20,-6);c.lineTo(14,-56)},P.dark,P,2)}}),
  R:(c,P,o)=>human(c,P,o,{s:1,body:'#8C97A3',legs:'#4B3A2A',sleeve:'#6C7782',head:(c,P)=>helmet(c,P,6),weapon:(c,P)=>{c.strokeStyle=P.line;c.lineWidth=5;c.beginPath();c.moveTo(0,10);c.lineTo(0,-30);c.stroke();E(c,0,-34,7,7,'#9AA6B2',P,0,2)},
    off:(c,P)=>{RR(c,-12,-24,18,48,5,P.main,P,2.4);RR(c,-9,-20,12,40,3,P.accent,P,1.4,false);E(c,-3,0,3.2,3.2,'#EEE',P,0,1.2)},
    chest:(c,P)=>{for(const y of[-48,-42])RR(c,-12,y,24,3.4,1.4,'#AAB4BF',P,1.2)}}),
  Q:(c,P,o)=>human(c,P,o,{s:.98,body:P.main,legs:P.dark,
    head:(c,P)=>{ // saukele
      crv(c,c=>{c.moveTo(-10,-4);c.quadraticCurveTo(-11,-14,-4,-22);c.lineTo(0,-40);c.lineTo(4,-22);c.quadraticCurveTo(11,-14,10,-4);c.quadraticCurveTo(0,-8,-10,-4)},'#F4F0E4',P,2.2,-40,-4);
      RR(c,-10.5,-8,21,4.2,1.6,P.accent,P,1.6);
      E(c,0,-42,2.6,2.6,P.accent,P,0,1.2);
      for(const x of[-6,0,6])E(c,x,-1,1.6,1.6,P.accent,P,0,0);
    },
    weapon:(c,P)=>sword(c,P,26),off:(c,P)=>roundShield(c,P,9),
    back:(c,P)=>{crv(c,c=>{c.moveTo(-15,-56);c.quadraticCurveTo(-26,-30,-22,-4);c.lineTo(22,-4);c.quadraticCurveTo(26,-30,15,-56)},mixc(P.main,'#000',.18),P,2)},
    chest:(c,P)=>{Orn_(c,P)}}),
  K:(c,P,o)=>human(c,P,o,{s:1.08,body:mixc(P.main,'#000',.1),legs:P.dark,
    head:(c,P)=>{borik(c,P,P.accent);poly(c,[[-3,-19],[0,-27],[3,-19]],'#FFF3B0',P,1.2)},
    weapon:(c,P)=>spear(c,P,40),
    back:(c,P)=>{crv(c,c=>{c.moveTo(-14,-58);c.quadraticCurveTo(-30,-34,-26,-3);c.lineTo(26,-3);c.quadraticCurveTo(30,-34,14,-58)},P.accent,P,2.2,-58,-3)},
    chest:(c,P)=>{Orn_(c,P);E(c,0,-44,4,4,P.accent,P,0,1.4)},
    off:(c,P)=>roundShield(c,P,10,P.accent)})
}};
function Orn_(c,P){ // little gold ornament band on the chest
  c.save();c.fillStyle=P.accent;
  for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*5,-44);c.quadraticCurveTo(i*5+2,-41,i*5+4,-41);c.quadraticCurveTo(i*5+2,-41,i*5,-38);c.quadraticCurveTo(i*5-2,-41,i*5-4,-41);c.quadraticCurveTo(i*5-2,-41,i*5,-44);c.fill()}
  c.restore();
}
for(const k in HEROES.draw)HEROES.draw[k]=wrap(HEROES.draw[k]);


/* ============ ALIENS ============ */
const AP={w:{main:'#7BE06B',light:'#CBFFB5',dark:'#2F9A3C',line:'#0B2E12',accent:'#FF4FD8'},
          b:{main:'#B66CF0',light:'#E6C4FF',dark:'#6A2FB0',line:'#1D0838',accent:'#44F0FF'}};
const bigEye=(c,x,y,rx,ry,o,P,col)=>{
  if(o.mood==='dead'){c.strokeStyle=P.line;c.lineWidth=2;c.beginPath();c.moveTo(x-rx*.6,y-ry*.6);c.lineTo(x+rx*.6,y+ry*.6);c.moveTo(x+rx*.6,y-ry*.6);c.lineTo(x-rx*.6,y+ry*.6);c.stroke();return}
  E(c,x,y,rx,ry,o.blink?null:(col||'#FFFFFF'),P,0,1.8);
  if(o.blink)return;
  E(c,x+rx*.2,y,rx*.5,ry*.62,o.mood==='angry'?'#ff3b30':'#111',P,0,0,false);
  c.fillStyle='#fff';c.beginPath();c.arc(x+rx*.4,y-ry*.3,rx*.18,0,TAU);c.fill();
};
const tent=(c,P,x,y,dx,dy,w,col)=>Tube(c,()=>{c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+dx*.9,y+dy*.3,x+dx,y+dy)},w,col,P);
const spikes=(c,P,n,w,h,col)=>{for(let i=0;i<n;i++){const x=(i-(n-1)/2)*w;poly(c,[[x-w*.42,0],[x,-h*(i%2?.75:1)],[x+w*.42,0]],col,P,1.6)}};
const ALIEN={name:'Инопланетяндар',pal:AP,sc:{P:1.1,N:.92,B:.98,R:1,Q:.96,K:.92},names:{P:'Жасыл көз',N:'Үшаяқ',B:'Ақылгөй',R:'Сауытты',Q:'Медуза ханшасы',K:'Ми-патша'},draw:{
  P(c,P,o){
    for(const x of[-8,8])E(c,x,-3,6,3.6,P.dark,P,0,1.8);
    E(c,0,-19,16,17,P.main,P);
    E(c,0,-9,10,7,P.light,P,0,0,false);    bigEye(c,2,-23,8.5,9.5,o,P);
    Tube(c,()=>{c.beginPath();c.moveTo(-3,-36);c.quadraticCurveTo(-8,-46,-4,-50)},2.4,P.dark,P);E(c,-4,-52,3.2,3.2,P.accent,P,0,1.4);glow(c,-4,-52,9,P.accent,.55);
  },
  N(c,P,o){
    const k=o.moving?Math.sin(o.ph)*5:0;
    for(const [x,dx] of[[-14,-12+k],[0,0-k],[14,12+k]]){Tube(c,()=>{c.beginPath();c.moveTo(x*.5,-38);c.quadraticCurveTo(x+dx*.6,-34,x+dx,-4)},5,P.dark,P);E(c,x+dx,-3,5,2.8,P.line,P,0,1.2,false)}
    E(c,0,-46,19,12,P.main,P);E(c,-3,-42,12,6,P.light,P,0,0,false);
    Tube(c,()=>{c.beginPath();c.moveTo(10,-50);c.quadraticCurveTo(24,-62,22,-82)},8,P.main,P);
    E(c,26,-88,11,8.5,P.main,P,-.15);
    bigEye(c,30,-91,4.6,5.2,o,P,P.accent);bigEye(c,22,-91,3.8,4.4,o,P,P.accent);
    Tube(c,()=>{c.beginPath();c.moveTo(24,-95);c.quadraticCurveTo(22,-104,28,-108)},2,P.dark,P);E(c,28,-109,2.6,2.6,P.accent,P,0,1.2);
    c.strokeStyle=P.line;c.lineWidth=1.6;c.beginPath();c.moveTo(29,-84);c.quadraticCurveTo(33,-82,36,-85);c.stroke();
  },
  B(c,P,o){
    crv(c,c=>{c.moveTo(-10,-2);c.quadraticCurveTo(-8,-30,-5,-48);c.lineTo(5,-48);c.quadraticCurveTo(8,-30,10,-2);c.quadraticCurveTo(0,2,-10,-2)},P.dark,P,2.2,-50,0);
    Tube(c,()=>{c.beginPath();c.moveTo(-5,-44);c.quadraticCurveTo(-18,-34,-14,-24)},3.4,P.main,P);
    Tube(c,()=>{c.beginPath();c.moveTo(5,-44);c.quadraticCurveTo(18,-38,20,-30)},3.4,P.main,P);
    E(c,20,-32,6,6,P.accent,P,0,1.6);glow(c,20,-32,20,P.accent,.55);
    E(c,0,-48,6,3,P.accent,P,0,1.4);
    E(c,0,-70,14,18,P.main,P);E(c,-4,-77,7,6,P.light,P,0,0,false);
    for(const s of[-1,1]){c.save();c.translate(s*6.5,-68);c.rotate(s*-.45);bigEye(c,0,0,4.8,7,o,P,'#101018');c.restore()}
  },
  R(c,P,o){
    for(const [x,dx] of[[-18,-6],[-8,-4],[8,4],[18,6]]){Tube(c,()=>{c.beginPath();c.moveTo(x,-14);c.lineTo(x+dx,-3)},4,P.line,P)}
    crv(c,c=>{c.moveTo(-28,-12);c.quadraticCurveTo(-30,-52,0,-54);c.quadraticCurveTo(30,-52,28,-12);c.quadraticCurveTo(0,-6,-28,-12)},P.dark,P,2.4,-54,-6);
    for(const x of[-14,0,14]){c.strokeStyle=P.line;c.lineWidth=1.6;c.beginPath();c.moveTo(x*1.05,-52);c.quadraticCurveTo(x*1.2,-32,x,-10);c.stroke()}
    crv(c,c=>{c.moveTo(-20,-36);c.quadraticCurveTo(0,-56,20,-36);c.quadraticCurveTo(0,-44,-20,-36)},P.light,P,0);
    E(c,20,-22,10,9,P.main,P);bigEye(c,24,-25,3.6,4.2,o,P,P.accent);bigEye(c,17,-25,3,3.6,o,P,P.accent);
    poly(c,[[-4,-52],[0,-70],[4,-52]],P.accent,P,1.6,-70,-52);
  },
  Q(c,P,o){
    const w=Math.sin(o.t*3+o.id)*2;
    for(let i=0;i<5;i++){const x=-14+i*7;tent(c,P,x,-48,(i-2)*5+w,44,3.4,i%2?P.main:P.light)}
    crv(c,c=>{c.moveTo(-22,-46);c.quadraticCurveTo(-24,-84,0,-84);c.quadraticCurveTo(24,-84,22,-46);c.quadraticCurveTo(0,-38,-22,-46)},P.main,P,2.4,-84,-40);
    for(const [x,y] of[[-12,-72],[-4,-78],[8,-74],[14,-64]])E(c,x,y,2.4,2.4,P.accent,P,0,0,false);
    bigEye(c,-6,-60,5.2,6.4,o,P);bigEye(c,8,-60,5.2,6.4,o,P);
    c.save();c.translate(0,-84);spikes(c,P,5,6,12,P.accent);c.restore();
  },
  K(c,P,o){
    crv(c,c=>{c.moveTo(-16,-6);c.quadraticCurveTo(-26,-34,-12,-46);c.lineTo(12,-46);c.quadraticCurveTo(26,-34,16,-6);c.quadraticCurveTo(0,0,-16,-6)},P.accent,P,2.2,-46,0);
    E(c,0,-30,10,13,P.main,P);
    Tube(c,()=>{c.beginPath();c.moveTo(-9,-36);c.quadraticCurveTo(-18,-28,-14,-18)},3.4,P.main,P);Tube(c,()=>{c.beginPath();c.moveTo(9,-36);c.quadraticCurveTo(18,-28,14,-18)},3.4,P.main,P);
    E(c,0,-64,18,17,P.main,P);
    c.strokeStyle=P.dark;c.lineWidth=1.6;
    for(const [a,b,d,e] of[[-12,-72,-2,-70],[-2,-70,-6,-62],[4,-76,10,-68],[10,-68,2,-62],[-8,-58,-14,-64]]){c.beginPath();c.moveTo(a,b);c.quadraticCurveTo((a+d)/2,(b+e)/2-4,d,e);c.stroke()}
    bigEye(c,-8,-60,4.6,5.4,o,P,P.accent);bigEye(c,8,-60,4.6,5.4,o,P,P.accent);bigEye(c,0,-68,3.6,4.4,o,P,P.accent);
    c.save();c.translate(0,-80);spikes(c,P,5,7,15,P.accent);c.restore();
    E(c,0,-96,3,3,P.light,P,0,1.2);
  }}};
for(const k in ALIEN.draw)ALIEN.draw[k]=wrap(ALIEN.draw[k]);

/* ============ SPACE SOLDIERS ============ */
const SP={w:{main:'#EDEFF3',light:'#FFFFFF',dark:'#9AA3B2',line:'#1A2230',accent:'#FF8A1F'},
          b:{main:'#3B4658',light:'#7A8BA6',dark:'#1C2330',line:'#05080D',accent:'#35E0FF'}};
const visor=(c,P,o,w,h,extra)=>{
  E(c,0,0,12,13,P.main,P,0,2.2);
  crv(c,c=>{c.ellipse(2.4,-.5,w||8.4,h||6.4,0,0,TAU)},o.mood==='angry'?'#ff3b30':P.accent,P,1.8,-6,6);
  glow(c,2.4,-.5,12,P.accent,.35);
  c.fillStyle='rgba(255,255,255,.65)';c.beginPath();c.ellipse(-.4,-3,3,1.4,-.5,0,TAU);c.fill();
  if(o.mood==='dead'){c.strokeStyle=P.line;c.lineWidth=1.8;c.beginPath();c.moveTo(0,-3);c.lineTo(5,2);c.moveTo(5,-3);c.lineTo(0,2);c.stroke()}
  if(extra)extra(c,P);
};
const rifle=(len,col)=>(c,P)=>{
  RR(c,-3,-6,len,7,2,col||P.dark,P,1.8);RR(c,len-6,-4,10,3,1,P.line,P,1.2);RR(c,-6,-3,5,10,2,P.dark,P,1.4);
  c.fillStyle=P.accent;c.fillRect(6,-4.6,5,1.6);
  c.save();c.rotate(Math.PI/2);c.restore();
};
const blaster=(c,P)=>{c.save();c.rotate(-Math.PI/2+.2);c.translate(-4,0);rifle(30)(c,P);c.restore()};
const jet=(c,P,o)=>{RR(c,-20,-56,9,28,3,P.dark,P,2);const f=6+Math.sin(o.t*30)*2;crv(c,c=>{c.moveTo(-19,-28);c.lineTo(-15,-28+f*3);c.lineTo(-11,-28)},P.accent,P,0);glow(c,-15,-22,14,P.accent,.5)};
const SPACE={name:'Ғарыш сарбаздары',pal:SP,sc:{P:1.02,N:.92,B:1.04,R:1,Q:1.02,K:1},names:{P:'Десантшы',N:'Мех',B:'Снайпер',R:'Ауыр сарбаз',Q:'Командир',K:'Адмирал'},draw:{
  P:(c,P,o)=>human(c,P,o,{s:.9,body:P.main,legs:P.dark,boots:P.line,head:(c,P,o)=>visor(c,P,o),weapon:blaster,back:(c,P)=>{RR(c,-19,-54,8,24,3,P.dark,P,1.8)},chest:(c,P)=>{RR(c,-4,-50,8,6,2,P.accent,P,1.2)}}),
  N(c,P,o){ // mech walker
    const k=o.moving?Math.sin(o.ph)*5:0;
    for(const [x,dx] of[[-9,-k],[11,k]]){
      Tube(c,()=>{c.beginPath();c.moveTo(x,-42);c.lineTo(x+10,-26);c.lineTo(x+dx,-6)},7,P.dark,P);
      RR(c,x+dx-8,-8,18,8,3,P.main,P,2);E(c,x+10,-26,4.4,4.4,P.accent,P,0,1.4);
    }
    RR(c,-20,-62,40,26,8,P.main,P,2.4);
    crv(c,c=>{c.ellipse(4,-70,15,12,0,Math.PI,0)},P.main,P,2.2,-82,-60);
    crv(c,c=>{c.ellipse(8,-71,8,6,0,Math.PI,0)},o.mood==='angry'?'#ff3b30':P.accent,P,1.6);glow(c,8,-72,14,P.accent,.4);
    RR(c,10,-56,26,8,3,P.dark,P,2);RR(c,34,-58,12,12,3,P.line,P,1.6);
    RR(c,-18,-58,10,5,2,P.accent,P,1.2);
  },
  B:(c,P,o)=>human(c,P,o,{s:.98,body:P.main,legs:P.dark,boots:P.line,head:(c,P,o)=>visor(c,P,o,9,3.6,(c,P)=>{c.fillStyle=P.line;c.fillRect(-12,-12,24,3)}),weapon:(c,P)=>{c.save();c.rotate(-Math.PI/2);c.translate(-8,0);rifle(46,P.line)(c,P);c.restore()},back:(c,P)=>{crv(c,c=>{c.moveTo(-14,-56);c.lineTo(-22,-8);c.lineTo(20,-8);c.lineTo(14,-56)},P.dark,P,2)}}),
  R:(c,P,o)=>human(c,P,o,{s:1.12,body:P.main,legs:P.dark,boots:P.line,sleeve:P.dark,head:(c,P,o)=>visor(c,P,o,8,5),
    weapon:(c,P)=>{c.save();c.rotate(-Math.PI/2);c.translate(-8,0);RR(c,-4,-8,30,14,4,P.dark,P,2);RR(c,24,-6,16,10,2,P.line,P,1.6);c.fillStyle=P.accent;c.fillRect(8,-5,10,3);c.restore()},
    off:(c,P)=>{RR(c,-10,-26,16,50,6,P.dark,P,2.4);RR(c,-7,-22,10,42,3,P.accent,P,1.2,false)},
    chest:(c,P)=>{RR(c,-11,-52,22,10,3,P.dark,P,1.6);RR(c,-4,-50,8,6,2,P.accent,P,1)},back:(c,P)=>{RR(c,-20,-56,9,28,3,P.dark,P,2)}}),
  Q:(c,P,o)=>human(c,P,o,{s:.98,body:P.main,legs:P.dark,boots:P.line,head:(c,P,o)=>{visor(c,P,o);poly(c,[[-3,-12],[1,-22],[6,-12]],P.accent,P,1.4)},weapon:blaster,back:jet,chest:(c,P)=>{RR(c,-12,-50,24,3,1,P.accent,P,1)}}),
  K:(c,P,o)=>human(c,P,o,{s:1.06,body:P.main,legs:P.dark,boots:P.line,
    head:(c,P,o)=>{visor(c,P,o,8,5.6);crv(c,c=>{c.moveTo(-11,-7);c.quadraticCurveTo(-8,-18,0,-17);c.quadraticCurveTo(8,-18,11,-7)},P.accent,P,1.8)},
    weapon:(c,P)=>{RR(c,-2,-4,4,9,1.4,P.dark,P,1.4);poly(c,[[-2.4,-4],[0,-34],[2.4,-4]],'#FFFFFF',P,1.2);glow(c,0,-20,18,P.accent,.6)},
    back:(c,P)=>{crv(c,c=>{c.moveTo(-14,-58);c.quadraticCurveTo(-30,-32,-26,-4);c.lineTo(26,-4);c.quadraticCurveTo(30,-32,14,-58)},P.accent,P,2.2,-58,-4)},
    chest:(c,P)=>{for(const x of[-12,12])E(c,x,-54,5,3.6,P.accent,P,0,1.4,false);E(c,0,-44,3.6,3.6,P.accent,P,0,1.2)}})
}};
for(const k in SPACE.draw)SPACE.draw[k]=wrap(SPACE.draw[k]);

/* ============ DARK FANTASY ============ */
const DP={w:{main:'#DDD5C2',light:'#FFF7E2',dark:'#8E8570',line:'#1C1410',accent:'#E3342B'},
          b:{main:'#51307A',light:'#9366CC',dark:'#27133F',line:'#08030F',accent:'#82FF52'}};
const skull=(c,P,o)=>{ // head replacement drawn at head centre
  E(c,0,0,11,12,'#EDE6D3',P,0,2.2);RR(c,-6,8,12,7,2,'#DCD4BE',P,1.8);
  for(const s of[-1,1]){E(c,s*4.4,-1,3.4,4,P.line,P,0,0);if(o.mood!=='dead'&&!o.blink){E(c,s*4.4,-1,1.5,1.9,o.mood==='angry'?'#ff3b30':P.accent,P,0,0,false);glow(c,s*4.4,-1,7,P.accent,.5)}}
  poly(c,[[-1.4,4],[0,1],[1.4,4]],P.line,P,0);
  c.strokeStyle=P.line;c.lineWidth=1.2;for(const x of[-3,0,3]){c.beginPath();c.moveTo(x,9);c.lineTo(x,14);c.stroke()}
};
const flameTo=(c,P,x,y,s,col)=>{crv(c,c=>{c.moveTo(x-4*s,y);c.quadraticCurveTo(x-5*s,y-8*s,x,y-18*s);c.quadraticCurveTo(x+5*s,y-8*s,x+4*s,y);c.quadraticCurveTo(x,y+3*s,x-4*s,y)},col,P,0);glow(c,x,y-7*s,12*s,col,.45)};
const wings=(c,P,col,sp)=>{for(const s of[-1,1]){crv(c,c=>{c.moveTo(s*8,-52);c.quadraticCurveTo(s*(26+sp),-84,s*(40+sp),-66);c.quadraticCurveTo(s*30,-64,s*34,-52);c.quadraticCurveTo(s*24,-54,s*26,-42);c.quadraticCurveTo(s*14,-46,s*8,-30)},col,P,2.2,-84,-30)}};
const horns=(c,P,col,sz)=>{for(const s of[-1,1])crv(c,c=>{c.moveTo(s*6,-8);c.quadraticCurveTo(s*(12+sz),-14,s*(10+sz),-26-sz);c.quadraticCurveTo(s*8,-16,s*3,-9)},col,P,1.6)};
const DARK={name:'Dark fantasy',pal:DP,sc:{P:1,N:.92,B:1.04,R:1,Q:1.02,K:1.02},names:{P:'Қаңқа',N:'Түнгі ат',B:'Некромант',R:'Горгулья',Q:'Вампир ханшасы',K:'Өлім рыцары'},draw:{
  P:(c,P,o)=>human(c,P,o,{s:.92,body:'#6B5F52',legs:'#3A322A',skin:'#EDE6D3',boots:'#2A221C',
    head:(c,P,o)=>skull(c,P,o),
    chest:(c,P)=>{c.strokeStyle='#EDE6D3';c.lineWidth=2.2;for(const y of[-50,-45,-40]){c.beginPath();c.moveTo(-8,y);c.quadraticCurveTo(0,y+3,8,y);c.stroke()}},
    weapon:(c,P)=>sword(c,P,22,'#9A8F82'),off:(c,P)=>roundShield(c,P,9,'#5A4A3A')}),
  N(c,P,o){horse(c,P,o,{coat:mixc(P.main,'#000000',.55),mane:P.accent,hoof:P.line,eye:P.accent,
    front:(c,P)=>{flameTo(c,P,16,-76,1.1,P.accent);flameTo(c,P,10,-70,.8,P.accent);flameTo(c,P,-36,-26,1.2,P.accent)}})},
  B:(c,P,o)=>human(c,P,o,{s:1,body:mixc(P.main,'#000',.35),legs:mixc(P.main,'#000',.45),skin:'#BDB6A6',sleeve:mixc(P.main,'#000',.2),
    back:(c,P)=>{crv(c,c=>{c.moveTo(-14,-56);c.lineTo(-21,-4);c.lineTo(21,-4);c.lineTo(14,-56)},mixc(P.main,'#000',.5),P,2.2)},
    head:(c,P,o)=>{crv(c,c=>{c.moveTo(-12,8);c.quadraticCurveTo(-15,-14,0,-18);c.quadraticCurveTo(15,-14,12,8);c.quadraticCurveTo(10,-6,0,-8);c.quadraticCurveTo(-10,-6,-12,8)},mixc(P.main,'#000',.35),P,2.2);
      c.fillStyle='#1b1020';c.beginPath();c.ellipse(1,-1,8,8,0,0,TAU);c.fill();
      if(o.mood!=='dead')for(const s of[-1,1]){c.fillStyle=o.mood==='angry'?'#ff3b30':P.accent;c.beginPath();c.arc(1+s*3.6,-1,1.7,0,TAU);c.fill();glow(c,1+s*3.6,-1,6,P.accent,.6)}},
    weapon:(c,P)=>{Tube(c,()=>{c.beginPath();c.moveTo(0,14);c.lineTo(0,-34)},3.2,'#4A3626',P);E(c,0,-40,6,6.4,'#EDE6D3',P,0,1.8);E(c,-2,-41,1.5,1.8,P.line,P,0,0);E(c,2,-41,1.5,1.8,P.line,P,0,0);glow(c,0,-40,18,P.accent,.55)}}),
  R(c,P,o){ // gargoyle golem
    const st=mixc(P.dark,'#7A7A86',.55);
    c.save();wings(c,P,mixc(st,'#000',.25),-6);c.restore();
    for(const x of[-11,11])RR(c,x-7,-24,14,24,4,st,P,2.2);
    crv(c,c=>{c.moveTo(-20,-22);c.lineTo(-17,-60);c.quadraticCurveTo(0,-68,17,-60);c.lineTo(20,-22)},st,P,2.4,-66,-20);
    c.strokeStyle=P.accent;c.lineWidth=2;c.beginPath();c.moveTo(-6,-56);c.lineTo(-2,-46);c.lineTo(-7,-38);c.moveTo(5,-52);c.lineTo(9,-42);c.stroke();glow(c,0,-46,16,P.accent,.35);
    for(const s of[-1,1]){Tube(c,()=>{c.beginPath();c.moveTo(s*17,-58);c.quadraticCurveTo(s*30,-44,s*26,-26)},9,st,P);poly(c,[[s*22,-24],[s*26,-14],[s*30,-24]],'#EEE',P,1.2)}
    c.save();c.translate(0,-66);horns(c,P,'#D9D2C2',2);E(c,0,0,12,11,st,P);
    if(o.mood!=='dead')for(const s of[-1,1]){E(c,s*5,-1,2.6,2,o.mood==='angry'?'#ff3b30':P.accent,P,0,0,false);glow(c,s*5,-1,8,P.accent,.6)}
    poly(c,[[-6,5],[-3,8],[0,5],[3,8],[6,5],[0,9]],'#EEE',P,1);c.restore();
  },
  Q:(c,P,o)=>human(c,P,o,{s:.98,body:P.main,legs:P.dark,skin:'#E8D8D4',eye:'#B3122A',
    back:(c,P)=>{wings(c,P,mixc(P.main,'#000',.45),0)},
    head:(c,P,o)=>{crv(c,c=>{c.moveTo(-11,-4);c.quadraticCurveTo(-12,-14,0,-14);c.quadraticCurveTo(12,-14,11,-4);c.quadraticCurveTo(0,-7,-11,-4)},'#1a0e22',P,2);
      c.save();c.translate(0,-10);horns(c,P,'#C9B7D8',1);c.restore();E(c,0,-14,2.6,2.6,P.accent,P,0,1.2)},
    weapon:(c,P)=>{Tube(c,()=>{c.beginPath();c.moveTo(0,12);c.lineTo(0,-30)},3,'#2A1A33',P);E(c,0,-35,5.4,5.4,P.accent,P,0,1.6);glow(c,0,-35,16,P.accent,.6)},
    chest:(c,P)=>{poly(c,[[-12,-52],[0,-40],[12,-52]],P.dark,P,1.4)}}),
  K:(c,P,o)=>human(c,P,o,{s:1.1,body:'#2A2A33',legs:'#1D1D25',boots:'#101014',sleeve:'#343440',
    back:(c,P)=>{crv(c,c=>{c.moveTo(-14,-58);c.quadraticCurveTo(-30,-32,-24,-2);c.lineTo(-12,-8);c.lineTo(-6,-2);c.lineTo(2,-8);c.lineTo(10,-2);c.lineTo(16,-8);c.lineTo(24,-2);c.quadraticCurveTo(30,-32,14,-58)},P.main,P,2.2,-58,-2)},
    head:(c,P,o)=>{crv(c,c=>{c.moveTo(-11,6);c.lineTo(-12,-8);c.quadraticCurveTo(0,-20,12,-8);c.lineTo(11,6);c.lineTo(0,2)},'#2F2F3A',P,2.2,-16,6);
      c.save();c.translate(0,-9);horns(c,P,'#9A8F82',3);c.restore();
      if(o.mood!=='dead'){c.fillStyle=o.mood==='angry'?'#ff3b30':P.accent;c.fillRect(-7,-2,14,3);glow(c,0,-1,14,P.accent,.55)}},
    weapon:(c,P)=>{poly(c,[[-3,-4],[3,-4],[3,-40],[0,-48],[-3,-40]],'#B9C0CC',P,1.6,0,-48);flameTo(c,P,0,-38,1.2,P.accent);RR(c,-8,-6,16,3.6,1.4,'#6A5A4A',P,1.4);RR(c,-1.8,-2,3.6,9,1.4,'#3A2A1E',P,1.2)},
    chest:(c,P)=>{for(const x of[-13,13])poly(c,[[x-4,-54],[x,-64],[x+4,-54]],'#2F2F3A',P,1.4)}})
}};
for(const k in DARK.draw)DARK.draw[k]=wrap(DARK.draw[k]);

/* ============ LIGHT FANTASY ============ */
const LP={w:{main:'#FFF6E2',light:'#FFFFFF',dark:'#D9BE7A',line:'#5C4A28',accent:'#F5B93A'},
          b:{main:'#BFDCF7',light:'#F0F8FF',dark:'#6FA3D6',line:'#1F3F66',accent:'#58D6FF'}};
const halo=(c,P,x,y,r)=>{c.save();c.strokeStyle=P.accent;c.lineWidth=2.6;c.beginPath();c.ellipse(x,y,r,r*.34,0,0,TAU);c.stroke();c.restore();glow(c,x,y,r*1.5,P.accent,.35)};
const staffOrb=(c,P,len)=>{Tube(c,()=>{c.beginPath();c.moveTo(0,14);c.lineTo(0,-len)},3.2,'#B8924A',P);E(c,0,-len-5,6,6,P.accent,P,0,1.6);glow(c,0,-len-5,20,P.accent,.6)};
const fairy=(c,P,col,s)=>{for(const k of[-1,1]){crv(c,c=>{c.moveTo(k*8,-54);c.quadraticCurveTo(k*38*s,-90,k*34*s,-52);c.quadraticCurveTo(k*28*s,-44,k*8,-46)},col,P,1.6);crv(c,c=>{c.moveTo(k*8,-46);c.quadraticCurveTo(k*30*s,-40,k*24*s,-22);c.quadraticCurveTo(k*12,-30,k*8,-40)},col,P,1.6)}};
const LIGHT={name:'Light fantasy',pal:LP,sc:{P:1,N:.92,B:1.04,R:1,Q:1.02,K:1.02},names:{P:'Жас эльф',N:'Бір мүйізді',B:'Нұр абызы',R:'Хрусталь сақшы',Q:'Эльф ханшасы',K:'Нұр патшасы'},draw:{
  P:(c,P,o)=>human(c,P,o,{s:.9,body:P.dark,legs:P.main,skin:'#F6D6B8',boots:'#8A6A3A',
    head:(c,P)=>{crv(c,c=>{c.moveTo(-10,-3);c.quadraticCurveTo(-8,-16,6,-18);c.quadraticCurveTo(14,-12,10,-3);c.quadraticCurveTo(0,-8,-10,-3)},'#4F9A3E',P,2);poly(c,[[8,-14],[18,-24],[10,-8]],'#4F9A3E',P,1.4);
      for(const s of[-1,1])poly(c,[[s*9,-2],[s*17,-6],[s*10,3]],'#F6D6B8',P,1.4)},
    weapon:(c,P)=>{c.save();c.rotate(.25);bow(c,P);c.restore()},chest:(c,P)=>{RR(c,-9,-48,18,4,1.5,P.accent,P,1.2)}}),
  N(c,P,o){horse(c,P,o,{coat:'#FFFFFF',mane:P.accent,hoof:P.dark,horn:P.accent,eye:'#3A66B0',
    front:(c,P)=>{E(c,-26,-70,3,3,P.accent,P,0,0,false);E(c,28,-96,2.2,2.2,P.light,P,0,0,false);glow(c,32,-100,16,P.accent,.5)}})},
  B:(c,P,o)=>human(c,P,o,{s:1,body:P.main,legs:P.dark,skin:'#F6D6B8',sleeve:P.main,
    back:(c,P)=>{crv(c,c=>{c.moveTo(-13,-56);c.lineTo(-20,-4);c.lineTo(20,-4);c.lineTo(13,-56)},P.light,P,2.2)},
    head:(c,P)=>{halo(c,P,0,-15,12);crv(c,c=>{c.moveTo(-11,6);c.quadraticCurveTo(-13,-10,0,-11);c.quadraticCurveTo(13,-10,11,6);c.quadraticCurveTo(7,-4,0,-5);c.quadraticCurveTo(-7,-4,-11,6)},P.light,P,2)},
    weapon:(c,P)=>staffOrb(c,P,34),chest:(c,P)=>{RR(c,-13.5,-45,27,3.4,1.4,P.accent,P,1.2)}}),
  R(c,P,o){ // crystal guardian
    for(const x of[-11,11])RR(c,x-7,-22,14,22,4,P.main,P,2.2);
    crv(c,c=>{c.moveTo(-19,-20);c.lineTo(-15,-56);c.lineTo(15,-56);c.lineTo(19,-20)},P.main,P,2.4,-58,-18);
    RR(c,-19,-30,38,5,2,P.accent,P,1.6);
    for(const s of[-1,1]){Tube(c,()=>{c.beginPath();c.moveTo(s*16,-52);c.quadraticCurveTo(s*28,-42,s*24,-26)},8,P.main,P);poly(c,[[s*18,-60],[s*24,-72],[s*30,-58],[s*24,-52]],P.accent,P,1.6)}
    poly(c,[[-9,-60],[0,-92],[9,-60],[0,-52]],mixc(P.accent,'#FFFFFF',.35),P,2.2,-92,-52);glow(c,0,-72,26,P.accent,.55);
    c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.moveTo(-2,-80);c.lineTo(2,-82);c.lineTo(0,-64);c.fill();
    if(o.mood==='dead'){c.strokeStyle=P.line;c.lineWidth=2;c.beginPath();c.moveTo(-6,-46);c.lineTo(-1,-41);c.moveTo(-1,-46);c.lineTo(-6,-41);c.stroke()}
    else{E(c,-5,-44,2.6,3.2,o.mood==='angry'?'#ff3b30':P.accent,P,0,1.2);E(c,5,-44,2.6,3.2,o.mood==='angry'?'#ff3b30':P.accent,P,0,1.2)}
  },
  Q:(c,P,o)=>human(c,P,o,{s:.98,body:P.main,legs:P.dark,skin:'#F6D6B8',eye:'#3A66B0',
    back:(c,P)=>{fairy(c,P,'rgba(255,255,255,.7)',1)},
    head:(c,P)=>{Tube(c,()=>{c.beginPath();c.moveTo(-11,-6);c.quadraticCurveTo(0,-12,11,-6)},3,P.accent,P);poly(c,[[-3,-10],[0,-20],[3,-10]],P.accent,P,1.2);E(c,0,-21,2.6,2.6,P.light,P,0,1.2);
      Tube(c,()=>{c.beginPath();c.moveTo(-9,2);c.quadraticCurveTo(-18,18,-12,34)},4,'#F2D58A',P)},
    weapon:(c,P)=>{Tube(c,()=>{c.beginPath();c.moveTo(0,12);c.lineTo(0,-26)},2.8,'#B8924A',P);star(c,P,0,-32,7);glow(c,0,-32,18,P.accent,.55)},
    chest:(c,P)=>{RR(c,-12,-50,24,3,1,P.accent,P,1)}}),
  K:(c,P,o)=>human(c,P,o,{s:1.08,body:'#F3D26A',legs:P.main,boots:P.dark,sleeve:'#F3D26A',
    back:(c,P)=>{crv(c,c=>{c.moveTo(-14,-58);c.quadraticCurveTo(-30,-32,-26,-3);c.lineTo(26,-3);c.quadraticCurveTo(30,-32,14,-58)},'#FFFFFF',P,2.2,-58,-3)},
    head:(c,P)=>{halo(c,P,0,-18,13);crv(c,c=>{c.moveTo(-10,-6);c.lineTo(-11,-18);c.lineTo(-5,-12);c.lineTo(0,-22);c.lineTo(5,-12);c.lineTo(11,-18);c.lineTo(10,-6)},'#F5C94A',P,2,-22,-6);E(c,0,-17,1.8,1.8,'#E3342B',P,0,0,false)},
    weapon:(c,P)=>{sword(c,P,34,'#FFFFFF');glow(c,0,-24,22,P.accent,.55)},off:(c,P)=>roundShield(c,P,10,'#F5C94A'),
    chest:(c,P)=>{E(c,0,-44,4,4,P.accent,P,0,1.4);for(const x of[-12,12])E(c,x,-54,5,3.6,'#FFFFFF',P,0,1.4,false)}})
}};
function star(c,P,x,y,r){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}c.closePath();c.fillStyle=P.accent;c.fill();c.lineWidth=1.5;c.strokeStyle=P.line;c.stroke()}
for(const k in LIGHT.draw)LIGHT.draw[k]=wrap(LIGHT.draw[k]);


/* ============ ROYAL KNIGHTS (hand-painted raster sprites: 4 walk + 4 attack frames per side) ============ */
const RK_META={Kr:[156,121,58.8,121.8],Ku:[150,120,55.0,121.4],Kd:[122,121,58.0,121.8],Qr:[152,126,68.9,125.6],Qu:[141,127,59.6,126.8],Qd:[126,128,57.1,127.7],Br:[158,121,58.4,123.1],Bu:[102,131,51.2,131.0],Bd:[109,122,52.5,121.8],Nr:[167,137,63.0,137.8],Nu:[109,140,39.9,139.9],Nd:[104,137,46.6,137.3],Rr:[151,120,65.5,121.0],Ru:[121,121,54.2,121.4],Rd:[129,124,62.2,125.2],Pr:[163,126,58.0,127.3],Pu:[129,126,44.5,126.8],Pd:[121,128,54.2,127.7]};
const RK_U=160/(534*0.42); /* local units per atlas pixel (frame = 1.6 tiles) */
const RK_IMG={};
const RK_DIR={r:'right',u:'up',d:'down'};
function rkImg(t,d){
  const k=t+(d||'r');let e=RK_IMG[k];if(e)return e;
  e=RK_IMG[k]={img:new Image(),ok:false};
  e.img.onload=()=>{e.ok=true;const f=globalThis.__skinReady;if(f)f()};
  e.img.src='skins/knights/'+t+'_'+RK_DIR[d||'r']+'.webp';
  return e;
}
function rkFrame(o){
  const s=o.strike||0,r=o.rear||0;
  if(s<-.3)return 4;
  if(s>.3)return s<.55?5:s<.8?6:7;
  if(r>.45)return r>.7?5:4;
  if(o.moving)return Math.floor(o.ph>0?o.ph*1.1:(o.t||0)*9)%4;
  if(o.mood==='angry')return 6;
  return 0;
}
const rkDraw=t=>(c,P,o)=>{
  const dr=o.dir||'r',e=rkImg(t,dr),m=RK_META[t+dr],[mw,mh,max,may]=m;
  if(!e.ok){c.save();c.globalAlpha*=.35;c.fillStyle=P.main;c.beginPath();c.ellipse(0,-30,16,28,0,0,TAU);c.fill();c.restore();return}
  const fr=rkFrame(o),col=fr%4,row=(P.team==='b'?2:0)+(fr>=4?1:0);
  const bob=o.moving?-Math.abs(Math.sin((o.ph||0)*1.6))*1.5:Math.sin(o.t*2.2+o.id)*-.6;
  const dead=o.mood==='dead';
  c.save();
  if(dead)c.translate(0,5);
  c.drawImage(e.img,col*mw,row*mh,mw,mh,-max*RK_U,-may*RK_U+2+bob,mw*RK_U,mh*RK_U);
  c.restore();
};
const RKP={
  w:{main:'#C9D3E3',light:'#F4F7FC',dark:'#6C7A93',line:'#1F2A44',accent:'#3A62C8',team:'w'},
  b:{main:'#8A2B33',light:'#C9565E',dark:'#3A1218',line:'#1E0A0D',accent:'#D1453B',team:'b'}
};
const KNIGHTS={dirs:true,pending:t=>!rkImg(t,'d').ok,name:'Корольдік гвардия',desc:'Күміс және обсидиан рыцарьлары',pal:RKP,sc:{P:1,N:1,B:1,R:1,Q:1,K:1},
  names:{P:'Жаяу рыцарь',N:'Салт атты',B:'Сиқыршы',R:'Мұнара сақшысы',Q:'Патшайым',K:'Патша'},
  draw:{P:rkDraw('P'),N:rkDraw('N'),B:rkDraw('B'),R:rkDraw('R'),Q:rkDraw('Q'),K:rkDraw('K')}};

const T={classic,heroes:HEROES,alien:ALIEN,space:SPACE,dark:DARK,light:LIGHT,knights:KNIGHTS};
T.__kit={poly,crv,eyes,glow,wrap,human,horse,SKINTONE,STEEL_,sword};
return T;
}
