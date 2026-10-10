(()=>{
'use strict';
const $=s=>document.querySelector(s);
const el=(t,c,txt)=>{const e=document.createElement(t);if(c)e.className=c;if(txt!==undefined)e.textContent=txt;return e};
const AV=['P','N','B','R','Q','K'];
const AVN={P:'Қоян',N:'Жылқы',B:'Жылан',R:'Түйе',Q:'Бүркіт',K:'Батыр'};
let me=null,data=null,tab='profile';

async function api(path,opt){
  try{
    const o=Object.assign({credentials:'same-origin'},opt||{});
    if(o.body&&typeof o.body!=='string'){o.body=JSON.stringify(o.body);o.headers={'Content-Type':'application/json'}}
    const r=await fetch('/api/'+path,o);
    const ct=r.headers.get('content-type')||'';
    if(!ct.includes('json'))return{ok:false,status:r.status,error:'Сервер қолжетімсіз ('+r.status+')'};
    const j=await r.json();j.ok=r.ok;j.status=r.status;return j;
  }catch(e){return{ok:false,error:'Желіге қосылу мүмкін емес'}}
}
function icon(cv,t){ if(window.__icon)window.__icon(cv,t,'w') }
function avatarCanvas(t,cls){const c=el('canvas',cls);requestAnimationFrame(()=>icon(c,t));return c}

/* ---------- toasts ---------- */
function toast(icn,title,sub,action,ms){
  const box=$('#toasts'),t=el('div','toast');
  t.append(el('span','ic',icn));
  const w=el('div');w.append(el('b','',title));if(sub)w.append(el('small','',sub));t.append(w);
  if(action){const b=el('button','',action.label);b.onclick=()=>{t.remove();action.fn()};t.append(b)}
  box.append(t);setTimeout(()=>t.remove(),ms||4500);
}

/* ---------- overlay helper ---------- */
let lastFocus=null;
function openOv(){const o=$('#ov');lastFocus=document.activeElement;o.hidden=false;document.body.style.overflow='hidden';const f=o.querySelector('input,button.x');f&&f.focus()}
function closeOv(){$('#ov').hidden=true;document.body.style.overflow='';lastFocus&&lastFocus.focus&&lastFocus.focus()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#ov').hidden)closeOv()});

/* ---------- account button ---------- */
function renderBtn(){
  const b=$('#acct');b.textContent='';
  if(!me){b.className='acct out';b.textContent='Кіру / Тіркелу';return}
  b.className='acct';
  b.append(avatarCanvas(me.avatar));
  const w=el('span','nm',me.username);w.append(el('span','lv',(me.role==='creator'?'👑 Создатель · ':'')+'Деңгей '+me.level+' · '+me.rating));
  b.append(w);
}
async function refresh(){
  const r=await api('me');
  me=r.user||null;data=r.user?r:null;
  renderBtn();
  return r;
}

/* ---------- auth dialog ---------- */
function authView(mode){
  const d=$('#dlg');d.textContent='';
  const h=el('div','dh');h.append(el('h2','',mode==='login'?'Кіру':'Тіркелу'));
  const x=el('button','x','×');x.setAttribute('aria-label','Жабу');x.onclick=closeOv;h.append(x);d.append(h);
  const tb=el('div','tabs');tb.setAttribute('role','tablist');
  for(const [k,l] of [['login','Кіру'],['reg','Тіркелу']]){
    const b=el('button','',l);b.setAttribute('role','tab');b.setAttribute('aria-selected',(k==='login')===(mode==='login'));
    b.onclick=()=>authView(k==='login'?'login':'reg');tb.append(b);
  }
  d.append(tb);
  const f=el('form');f.noValidate=true;
  const u=el('div','fld');const ul=el('label','','Ойыншы аты');ul.htmlFor='fu';
  const ui=el('input');ui.id='fu';ui.autocomplete='username';ui.maxLength=20;ui.autocapitalize='none';ui.spellcheck=false;u.append(ul,ui);
  if(mode!=='login')u.append(el('small','','3–20 таңба: әріп, сан немесе _'));
  const p=el('div','fld');const pl=el('label','','Құпия сөз');pl.htmlFor='fp';
  const pi=el('input');pi.id='fp';pi.type='password';pi.autocomplete=mode==='login'?'current-password':'new-password';pi.maxLength=100;p.append(pl,pi);
  if(mode!=='login')p.append(el('small','','Кемінде 6 таңба'));
  f.append(u,p);
  let av='P';
  if(mode!=='login'){
    const g=el('div','fld');g.append(el('label','','Аватар таңда'));
    const pk=el('div','pick');
    AV.forEach(t=>{const b=el('button');b.type='button';b.setAttribute('aria-label',AVN[t]);b.setAttribute('aria-pressed',t===av);b.append(avatarCanvas(t));
      b.onclick=()=>{av=t;pk.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true')};pk.append(b)});
    g.append(pk);f.append(g);
  }
  const er=el('p','err');er.setAttribute('role','alert');
  const sb=el('button','btn wide',mode==='login'?'Кіру':'Тіркелу және бастау');sb.type='submit';
  f.append(er,sb);
  f.onsubmit=async e=>{
    e.preventDefault();er.textContent='';
    sb.disabled=true;
    const r=await api(mode==='login'?'login':'register',{method:'POST',body:{username:ui.value,password:pi.value,avatar:av}});
    sb.disabled=false;
    if(!r.ok){er.textContent=r.error||'Қате';return}
    await refresh();closeOv();
    toast('👋',mode==='login'?'Қош келдің, '+me.username+'!':'Тіркелдің, '+me.username+'!','Ботқа қарсы ойнап, жетістік жина');
  };
  d.append(f);
  openOv();ui.focus();
}

/* ---------- profile dialog ---------- */
function stat(v,l){const s=el('div','stat');s.append(el('b','',String(v)),el('span','',l));return s}
async function profileView(t){
  tab=t||tab;
  await refresh();
  if(!me){authView('login');return}
  const d=$('#dlg');d.textContent='';
  const h=el('div','dh');h.append(el('h2','','Профиль'));
  const x=el('button','x','×');x.setAttribute('aria-label','Жабу');x.onclick=closeOv;h.append(x);d.append(h);
  const tb=el('div','tabs');tb.setAttribute('role','tablist');
  const tl=[['profile','Профиль'],['ach','Жетістіктер'],['top','Рейтинг']];if(me.role==='creator')tl.push(['adm','Админ']);
  for(const [k,l] of tl){
    const b=el('button','',l);b.setAttribute('role','tab');b.setAttribute('aria-selected',k===tab);b.onclick=()=>profileView(k);tb.append(b);
  }
  d.append(tb);
  const body=el('div');d.append(body);
  if(tab==='profile')renderProfile(body);
  else if(tab==='ach')renderAch(body);
  else if(tab==='top')await renderTop(body);
  else await renderAdmin(body,'');
  openOv();
}
function renderProfile(b){
  const u=me;
  const ph=el('div','phead');
  const av=el('canvas','pav');requestAnimationFrame(()=>icon(av,u.avatar));
  const w=el('div');w.append(el('div','pname',u.username));
  if(u.role==='creator'){const bd=el('span','badge','👑 Создатель');w.append(bd)}
  w.append(el('p','pbio',u.bio||'Өзің туралы бірдеңе жаз…'));
  ph.append(av,w);b.append(ph);
  const base=Math.pow(u.level-1,2)*50,span=u.xpNext-base;
  const xp=el('div','xp');const bar=el('i');bar.style.width=Math.max(2,Math.min(100,(u.xp-base)/span*100))+'%';xp.append(bar);
  b.append(el('div','xpt','Деңгей '+u.level+' · '+u.xp+' / '+u.xpNext+' XP'),xp);
  const st=el('div','stats');
  st.append(stat(u.rating,'Рейтинг'),stat('#'+u.rank,'Орын'),stat(u.games,'Ойын'),stat(u.wins,'Жеңіс'),stat(u.losses,'Жеңіліс'),stat(u.draws,'Тең'),stat(u.captures,'Қағылған жау'),stat(u.streak,'Қатар жеңіс'),stat(u.best_streak,'Үздік қатар'));
  b.append(st);
  // edit
  const ed=el('details');ed.style.margin='0 0 14px';
  const sm=el('summary','','Профильді өзгерту');sm.style.cssText='font-weight:800;cursor:pointer;min-height:44px;display:flex;align-items:center';ed.append(sm);
  let sa=u.avatar;
  const pk=el('div','pick');
  AV.forEach(t=>{const bt=el('button');bt.type='button';bt.setAttribute('aria-label',AVN[t]);bt.setAttribute('aria-pressed',t===sa);bt.append(avatarCanvas(t));
    bt.onclick=()=>{sa=t;pk.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));bt.setAttribute('aria-pressed','true')};pk.append(bt)});
  const bf=el('div','fld');bf.style.marginTop='12px';const bl=el('label','','Өзің туралы (140 таңбаға дейін)');bl.htmlFor='fb';
  const bi=el('textarea');bi.id='fb';bi.rows=2;bi.maxLength=140;bi.value=u.bio||'';bf.append(bl,bi);
  const sv=el('button','btn','Сақтау');
  sv.onclick=async()=>{sv.disabled=true;const r=await api('me',{method:'PATCH',body:{avatar:sa,bio:bi.value}});sv.disabled=false;if(r.ok){await profileView('profile');toast('✅','Сақталды')}else toast('⚠️',r.error||'Қате')};
  ed.append(pk,bf,sv);b.append(ed);
  b.append(el('h2','','Соңғы ойындар'));
  const ul=el('ul','hist');
  if(!data.history.length){const li=el('li');li.append(el('span','','Әзірше ойын жоқ. Ботқа қарсы ойна!'));ul.append(li)}
  for(const g of data.history){
    const li=el('li');
    const rl={win:'Жеңіс',loss:'Жеңіліс',draw:'Тең'}[g.result];
    li.append(el('span',g.result,rl),el('span','',g.moves+' жүріс · '+g.captures+' жау · '+new Date(g.created_at).toLocaleDateString('kk-KZ')));
    ul.append(li);
  }
  b.append(ul);
  const lo=el('button','btn ghost wide','Шығу');lo.style.marginTop='16px';
  lo.onclick=async()=>{await api('logout',{method:'POST',body:{}});me=null;data=null;renderBtn();closeOv();toast('👋','Сау бол!')};
  b.append(lo);
}
function renderAch(b){
  const got=new Set(data.achievements.map(a=>a.key));
  const keys=Object.keys(data.catalog);
  b.append(el('p','xpt',got.size+' / '+keys.length+' ашылды'));
  const g=el('div','agrid');
  keys.sort((a,c)=>(got.has(c)?1:0)-(got.has(a)?1:0));
  for(const k of keys){
    const a=data.catalog[k],c=el('div','ach '+(got.has(k)?'got':'lock'));
    c.append(el('div','ic',got.has(k)?a.icon:'🔒'),el('b','',a.name),el('span','',a.desc));g.append(c);
  }
  b.append(g);
}
async function renderTop(b){
  const r=await api('leaderboard');
  if(!r.ok){b.append(el('p','err',r.error||'Қате'));return}
  if(!r.rows.length){b.append(el('p','xpt','Әзірше ешкім ойнаған жоқ. Бірінші бол!'));return}
  const t=el('table','lbt');
  r.rows.forEach((u,i)=>{
    const tr=el('tr',me&&u.username===me.username?'me':'');
    const nm=el('td');const w=el('div','u');w.append(avatarCanvas(u.avatar),el('span','',u.username+(u.role==='creator'?' 👑':'')));nm.append(w);
    tr.append(el('td','',String(i+1)),nm,el('td','',u.wins+'/'+u.games),el('td','r',String(u.rating)));t.append(tr);
  });
  b.append(t);
}

async function renderAdmin(b,q){
  b.textContent='';
  const sf=el('div','fld');const si=el('input');si.type='search';si.placeholder='Ойыншыны іздеу…';si.value=q;si.setAttribute('aria-label','Іздеу');sf.append(si);
  si.onkeydown=e=>{if(e.key==='Enter')renderAdmin(b,si.value)};
  b.append(sf);
  const r=await api('admin?q='+encodeURIComponent(q));
  if(!r.ok){b.append(el('p','err',r.error||'Қате'));return}
  b.append(el('p','xpt','Барлығы: '+r.total+' ойыншы'));
  const ul=el('ul','adm');
  for(const u of r.rows){
    const li=el('li',u.banned?'ban':'');
    const info=el('div','ai');info.append(el('b','',u.username+(u.role==='creator'?' 👑':'')+(u.banned?' · бұғатталған':'')),el('span','',u.games+' ойын · '+u.wins+' жеңіс · '+u.rating));
    li.append(info);
    if(u.role!=='creator'){
      const act=el('div','aa');
      const mk=(label,action,danger)=>{
        const bt=el('button','sm'+(danger?' dg':''),label);bt.type='button';let armed=false;
        bt.onclick=async()=>{
          if(danger&&!armed){armed=true;bt.textContent='Растау?';setTimeout(()=>{armed=false;bt.textContent=label},3000);return}
          bt.disabled=true;const x=await api('admin',{method:'POST',body:{id:u.id,action}});
          if(!x.ok){toast('⚠️',x.error||'Қате');bt.disabled=false;return}
          renderAdmin(b,si.value);
        };act.append(bt)};
      mk(u.banned?'Ашу':'Бұғаттау',u.banned?'unban':'ban',!u.banned);
      mk('Нөлдеу','reset',true);mk('Жою','delete',true);
      li.append(act);
    }
    ul.append(li);
  }
  b.append(ul);
}

/* ---------- game hook ---------- */
async function report(p){
  if(!me){
    toast('🏅','Жетістіктер мен рейтинг жиналмады','Кіріп алсаң, нәтиже сақталады',{label:'Кіру',fn:()=>authView('login')},7000);
    return;
  }
  const r=await api('game',{method:'POST',body:p});
  if(!r.ok){toast('⚠️',r.error||'Нәтиже сақталмады');return}
  const sign=r.dRating>=0?'+':'';
  toast(p.result==='win'?'🏆':p.result==='draw'?'🤝':'💪','+'+r.dXp+' XP · рейтинг '+sign+r.dRating,'Рейтинг: '+r.rating+(r.levelUp?' · Жаңа деңгей!':''));
  let delay=900;
  for(const k of r.newAchievements){
    const a=(data&&data.catalog&&data.catalog[k])||null;
    setTimeout(()=>{ if(a)toast(a.icon,'Жетістік: '+a.name,a.desc,null,5500) },delay);delay+=1100;
  }
  refresh();
  fetch('/api/leaderboard').then(r=>r.json()).then(j=>{
    const f=$('#foot');if(!f||!j.creators||!j.creators.length)return;
    f.textContent='Создатель: ';const b=el('b','','👑 '+j.creators.join(', '));f.append(b);
  }).catch(()=>{});
}

/* ---------- init ---------- */
function init(){
  $('#acct').onclick=()=>me?profileView('profile'):authView('login');
  $('#ov').addEventListener('pointerdown',e=>{if(e.target.id==='ov')closeOv()});
  window.Plat={report,isIn:()=>!!me,refresh};
  refresh();
}
init();
})();
