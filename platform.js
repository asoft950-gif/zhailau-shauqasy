(()=>{
'use strict';
const $=s=>document.querySelector(s);
const el=(t,c,txt)=>{const e=document.createElement(t);if(c)e.className=c;if(txt!==undefined)e.textContent=txt;return e};
const AV=['P','N','B','R','Q','K'];
const AVN={P:'Қоян',N:'Жылқы',B:'Піл',R:'Түйе',Q:'Бүркіт',K:'Батыр'};
let me=null,data=null,tab='profile',cupP='week',fr=null,beat=0;const seenInv=new Set();

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
  if(fr&&fr.incoming&&fr.incoming.length)b.append(el('i','dotb'));
  syncBeat();
}
async function beatNow(){
  if(!me||document.hidden)return;
  const r=await api('friends');
  if(!r.ok)return;
  const had=fr&&fr.incoming?fr.incoming.length:0;
  fr=r;
  if(r.incoming.length!==had)renderBtn();
  for(const iv of r.invites){
    if(seenInv.has(iv.id))continue;seenInv.add(iv.id);
    toast('⚔️',iv.from+' сені ойынға шақырды','Қосылу үшін басыңыз',{label:'Қосылу',fn:()=>window.__joinCode&&window.__joinCode(iv.code)},20000);
  }
}
function syncBeat(){
  if(me&&!beat){beatNow();beat=setInterval(beatNow,25000)}
  else if(!me&&beat){clearInterval(beat);beat=0;fr=null}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)beatNow()});
function showNotice(n){
  const old=document.getElementById('noticeBar');
  let seen='';try{seen=localStorage.getItem('nid')||''}catch(e){}
  if(!n||String(n.id)===seen){if(old)old.remove();return}
  if(old&&old.dataset.id===String(n.id))return;
  if(old)old.remove();
  const bar=el('div','noticebar');bar.id='noticeBar';bar.dataset.id=n.id;bar.setAttribute('role','status');
  bar.append(el('span','','📣'),el('span','nt',n.text));
  const x=el('button','x','×');x.setAttribute('aria-label','Жабу');x.onclick=()=>{try{localStorage.setItem('nid',String(n.id))}catch(e){}bar.remove()};bar.append(x);
  document.body.prepend(bar);
}
async function refresh(){
  const r=await api('me');
  me=r.user||null;data=r.user?r:null;
  renderBtn();showNotice(r.notice);
  return r;
}

/* ---------- auth dialog ---------- */
function authView(mode){
  const d=$('#dlg');d.textContent='';d.className='dlg';
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
    let gp=null;if(mode!=='login'){try{gp=JSON.parse(localStorage.getItem('gp')||'null')}catch(e){}}
    const r=await api(mode==='login'?'login':'register',{method:'POST',body:{username:ui.value,password:pi.value,avatar:av,guest:gp||undefined}});
    sb.disabled=false;
    if(!r.ok){er.textContent=r.error||'Қате';return}
    await refresh();closeOv();fireAuth('in');
    if(mode==='login')toast('👋','Қош келдің, '+me.username+'!','Ботқа қарсы ойнап, жетістік жина');
    else{
      try{localStorage.removeItem('gp')}catch(e){}
      toast('🎁','Тіркелдің, '+me.username+'!','+'+((r.gift&&r.gift.coins)||100)+' тиын және «Батырлар» скині сыйлыққа'+(r.gift&&r.gift.games?' · прогресің сақталды':''),null,7000);
    }
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
  const d=$('#dlg');d.textContent='';d.className='dlg big';
  const h=el('div','dh');h.append(el('h2','','Профиль'));
  const x=el('button','x','×');x.setAttribute('aria-label','Жабу');x.onclick=closeOv;h.append(x);d.append(h);
  const tb=el('div','tabs');tb.setAttribute('role','tablist');
  const tl=[['profile','Профиль'],['fr','Достар'],['clan','Клан'],['daily','Тапсырма'],['shop','Дүкен'],['cup','Турнир'],['ach','Жетістіктер'],['top','Рейтинг'],['set','Баптау']];if(me.role==='creator'||me.role==='moderator')tl.push(['adm','Админ']);
  for(const [k,l] of tl){
    const b=el('button','',l);b.setAttribute('role','tab');b.setAttribute('aria-selected',k===tab);b.onclick=()=>profileView(k);tb.append(b);
  }
  d.append(tb);
  const body=el('div');d.append(body);
  requestAnimationFrame(()=>{const s=tb.querySelector('[aria-selected="true"]');if(s)tb.scrollLeft=s.offsetLeft-tb.clientWidth/2+s.offsetWidth/2});
  if(tab==='profile')renderProfile(body);
  else if(tab==='ach')renderAch(body);
  else if(tab==='daily')renderDaily(body);
  else if(tab==='fr')await renderFriends(body);
  else if(tab==='clan')await renderClan(body);
  else if(tab==='shop')renderShop(body);
  else if(tab==='cup')await renderCup(body,cupP);
  else if(tab==='top')await renderTop(body);
  else if(tab==='set')renderSettings(body);
  else await renderAdmin(body);
  openOv();
}
const BN={grass:'Жайлау',dusk:'Кеш',night:'Түн',snow:'Қар',sand:'Құм',royal:'Патша',fire:'Алау',sea:'Теңіз'};
const ROLE={creator:'👑 Создатель',moderator:'🛡️ Модератор'};
const ago=iso=>{const m=Math.floor((Date.now()-new Date(iso))/6e4);return m<1?'жаңа':m<60?m+' мин бұрын':m<1440?Math.floor(m/60)+' сағ бұрын':Math.floor(m/1440)+' күн бұрын'};
function hero(u,cat,extra){
  const h=el('div','phero b-'+(u.banner||'grass'));
  const av=el('canvas','pav big');requestAnimationFrame(()=>icon(av,u.avatar));
  const w=el('div','hw');
  const nm=el('div','pname',u.name||u.username);
  w.append(nm);
  const tags=el('div','tags');
  if(ROLE[u.role])tags.append(el('span','badge',ROLE[u.role]));
  if(u.clan)tags.append(el('span','badge clanb',u.clan.emblem+' ['+u.clan.tag+'] '+u.clan.name));
  const tt=u.title&&cat[u.title];if(tt)tags.append(el('span','badge ttl',tt.icon+' '+tt.name));
  if(tags.children.length)w.append(tags);
  w.append(el('p','pbio',u.bio||'—'));
  h.append(av,w);
  const lvl=u.level,base=Math.pow(lvl-1,2)*50,next=Math.pow(lvl,2)*50;
  const xp=el('div','xp');const bar=el('i');bar.style.width=Math.max(2,Math.min(100,(u.xp-base)/(next-base)*100))+'%';xp.append(bar);
  const row=el('div','hx');row.append(el('b','','Деңгей '+lvl),el('span','',u.xp+' / '+next+' XP'));
  h.append(row,xp);
  if(extra)h.append(extra);
  return h;
}
function statsBlock(u){
  const wr=u.games?Math.round(u.wins/u.games*100):0;
  const g=el('div','stats s4');
  g.append(stat(u.rating,'Рейтинг'),stat('#'+u.rank,'Орын'),stat(u.games,'Ойын'),stat(wr+'%','Жеңіс үлесі'),stat(u.wins,'Жеңіс'),stat(u.losses,'Жеңіліс'),stat(u.draws,'Тең'),stat(u.best_streak,'Үздік серия'));
  const bar=el('div','wlbar');const tot=Math.max(1,u.wins+u.losses+u.draws);
  for(const [k,v] of [['w',u.wins],['d',u.draws],['l',u.losses]]){const i=el('i',k);i.style.width=(v/tot*100)+'%';bar.append(i)}
  const f=el('div');f.append(g,bar);return f;
}
function showcaseBlock(keys,cat){
  const wrap=el('div','showc');
  if(!keys.length){wrap.append(el('p','xpt','Таңдаулы жетістіктер жоқ'));return wrap}
  for(const k of keys){const a=cat[k];if(!a)continue;const c=el('div','ach got');c.append(el('div','ic',a.icon),el('b','',a.name),el('span','',a.desc));wrap.append(c)}
  return wrap;
}
function medalsLine(m){const t=(m[1]||0)+(m[2]||0)+(m[3]||0);return t?el('p','xpt','🏅 Медальдар: 🥇'+m[1]+' 🥈'+m[2]+' 🥉'+m[3]):null}
function histList(list,empty){
  const ul=el('ul','hist');
  if(!list.length){const li=el('li');li.append(el('span','',empty));ul.append(li)}
  for(const g of list){
    const li=el('li');const rl={win:'Жеңіс',loss:'Жеңіліс',draw:'Тең'}[g.result];
    li.append(el('span',g.result,rl+' · '+(g.mode==='pvp'?'онлайн':'бот')),el('span','',g.moves+' жүріс'+(g.captures!=null?' · '+g.captures+' жау':'')+' · '+new Date(g.created_at).toLocaleDateString('kk-KZ')));ul.append(li);
  }
  return ul;
}
function renderProfile(b){
  const u={...me,name:me.username};
  const clan=data.clan||null;u.clan=clan;
  const chips=el('div','chips');chips.append(el('span','chip','🪙 '+(me.coins>=1e8?'∞':me.coins)),el('span','chip','🏹 Жорық '+(me.camp||0)+'/10'),el('span','chip','🏆 '+data.achievements.length+'/'+Object.keys(data.catalog).length));
  b.append(hero(u,data.catalog,chips));
  b.append(statsBlock(u));
  const ml=medalsLine((()=>{const c={1:0,2:0,3:0};(data.medals||[]).forEach(m=>c[m.place]++);return c})());if(ml)b.append(ml);
  b.append(el('h2','','Таңдаулы жетістіктер'));
  b.append(showcaseBlock((me.showcase||[]).filter(k=>data.catalog[k]),data.catalog));
  const bt=el('button','btn ghost sm','Баптауға өту');bt.onclick=()=>profileView('set');b.append(bt);
  b.append(el('h2','','Соңғы ойындар'));
  b.append(histList(data.history,'Әзірше ойын жоқ. Ботқа қарсы ойна!'));
}
async function openUser(id,back){
  const d=$('#dlg');d.textContent='';d.className='dlg big';
  const h=el('div','dh');const bk=el('button','btn ghost sm','← Артқа');bk.onclick=()=>profileView(back||tab);h.append(bk,el('span'));
  const x=el('button','x','×');x.onclick=closeOv;h.append(x);d.append(h);
  const body=el('div');d.append(body);openOv();
  const r=await api('me?p='+id);
  if(!r.profile){body.append(el('p','err',r.error||'Қате'));return}
  const u=r.profile;const cat=r.catalog;
  const chips=el('div','chips');
  chips.append(el('span','chip',u.online?'🟢 онлайн':'⚪ '+(u.online===false?'офлайн':'')),el('span','chip','📅 '+new Date(u.since).toLocaleDateString('kk-KZ')),el('span','chip','🏆 '+u.achCount));
  body.append(hero(u,cat,chips));body.append(statsBlock(u));
  const ml=medalsLine(u.medals);if(ml)body.append(ml);
  body.append(el('h2','','Таңдаулы жетістіктер'));body.append(showcaseBlock(u.showcase,cat));
  body.append(el('h2','','Соңғы ойындар'));body.append(histList(u.recent,'Әзірше ойын жоқ'));
  if(me&&me.id!==u.id){
    const row=el('div','prow');
    const ad=el('button','btn','🤝 Дос қосу');ad.onclick=async()=>{ad.disabled=true;const x=await api('friends',{method:'POST',body:{action:'add',name:u.name}});if(x.ok)toast(x.state==='friends'?'🤝':'📨',x.state==='friends'?'Енді дос':'Сұраныс жіберілді',u.name);else toast('⚠️',x.error||'Қате')};
    row.append(ad);body.append(row);
  }
}
const lvOf=xp=>Math.floor(Math.sqrt(xp/50))+1;
function renderSettings(b){
  const u=me;let sa=u.avatar,sb=u.banner||'grass',st=u.title||'',sc=[...(u.showcase||[])];
  const got=data.achievements.map(a=>a.key).filter(k=>data.catalog[k]);
  b.append(el('h2','','Бейне'));
  const pk=el('div','pick');
  AV.forEach(t=>{const bt=el('button');bt.type='button';bt.setAttribute('aria-label',AVN[t]);bt.setAttribute('aria-pressed',t===sa);bt.append(avatarCanvas(t));
    bt.onclick=()=>{sa=t;pk.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));bt.setAttribute('aria-pressed','true')};pk.append(bt)});
  b.append(pk);
  b.append(el('h2','','Профиль фоны'));
  const bp=el('div','bpick');
  for(const k of data.banners){const x=el('button','bsw b-'+k,BN[k]||k);x.type='button';x.setAttribute('aria-pressed',k===sb);x.onclick=()=>{sb=k;bp.querySelectorAll('button').forEach(y=>y.setAttribute('aria-pressed',y===x))};bp.append(x)}
  b.append(bp);
  b.append(el('h2','','Атақ'));
  const ts=el('select');ts.setAttribute('aria-label','Атақ');
  const o0=el('option','','— атақсыз —');o0.value='';ts.append(o0);
  for(const k of got){const o=el('option','',data.catalog[k].icon+' '+data.catalog[k].name);o.value=k;ts.append(o)}
  ts.value=st;b.append(ts);
  b.append(el('h2','','Таңдаулы жетістіктер (3-ке дейін)'));
  const sp=el('div','spick');
  const paint=()=>{sp.textContent='';for(const k of got){const a=data.catalog[k];const x=el('button','sch'+(sc.includes(k)?' on':''),a.icon+' '+a.name);x.type='button';x.onclick=()=>{if(sc.includes(k))sc=sc.filter(y=>y!==k);else if(sc.length<3)sc.push(k);else toast('ℹ️','Ең көбі 3');paint()};sp.append(x)}};
  paint();b.append(sp);
  const bf=el('div','fld');const bl=el('label','','Өзің туралы (140 таңбаға дейін)');bl.htmlFor='fb';
  const bi=el('textarea');bi.id='fb';bi.rows=2;bi.maxLength=140;bi.value=u.bio||'';bf.append(bl,bi);b.append(bf);
  const ho=el('label','chk');const hc=el('input');hc.type='checkbox';hc.checked=!!u.hide_online;ho.append(hc,document.createTextNode(' Онлайн екенімді жасыру'));b.append(ho);
  const sv=el('button','btn','Сақтау');
  sv.onclick=async()=>{sv.disabled=true;const r=await api('me',{method:'PATCH',body:{avatar:sa,bio:bi.value,banner:sb,title:ts.value,showcase:sc,hide_online:hc.checked}});sv.disabled=false;if(r.ok){await profileView('profile');toast('✅','Сақталды')}else toast('⚠️',r.error||'Қате')};
  b.append(sv);
  b.append(el('h2','','Қауіпсіздік'));
  const pw=el('div','clform');
  const o=el('input');o.type='password';o.placeholder='Ескі құпия сөз';o.autocomplete='current-password';
  const n=el('input');n.type='password';n.placeholder='Жаңа құпия сөз (6+)';n.autocomplete='new-password';
  const pb=el('button','btn ghost','Құпия сөзді ауыстыру');
  pb.onclick=async()=>{pb.disabled=true;const r=await api('me',{method:'PATCH',body:{pw:{old:o.value,new:n.value}}});pb.disabled=false;if(r.ok){o.value=n.value='';toast('🔐','Құпия сөз ауыстырылды')}else toast('⚠️',r.error||'Қате')};
  pw.append(o,n,pb);b.append(pw);
  const lo=el('button','btn ghost wide','Шығу');lo.style.marginTop='14px';
  lo.onclick=async()=>{await api('logout',{method:'POST',body:{}});me=null;data=null;renderBtn();closeOv();fireAuth('out');toast('👋','Сау бол!')};
  b.append(lo);
  if(u.role!=='creator'){
    const dz=el('details','dz');dz.append(el('summary','','Аккаунтты жою'));
    const dp=el('input');dp.type='password';dp.placeholder='Құпия сөзді енгіз';
    const db=el('button','btn ghost danger','Мәңгілікке жою');let armed=0;
    db.onclick=async()=>{if(!armed){armed=1;db.textContent='Расымен жоясың ба?';setTimeout(()=>{armed=0;db.textContent='Мәңгілікке жою'},3000);return}
      const r=await api('me',{method:'PATCH',body:{del:{pw:dp.value}}});
      if(r.deleted){me=null;data=null;renderBtn();closeOv();fireAuth('out');toast('👋','Аккаунт жойылды')}else toast('⚠️',r.error||'Қате')};
    dz.append(dp,db);b.append(dz);
  }
}
async function renderFriends(b){
  const row=el('div','frow');
  const inp=el('input');inp.placeholder='Ойыншы есімі';inp.maxLength=20;inp.setAttribute('aria-label','Ойыншы есімі');
  const ad=el('button','btn','Дос қосу');
  const go=async()=>{
    const name=inp.value.trim();if(!name)return;
    ad.disabled=true;
    const r=await api('friends',{method:'POST',body:{action:'add',name}});
    ad.disabled=false;
    if(!r.ok){toast('⚠️',r.error||'Қате');return}
    toast(r.state==='friends'?'🤝':'📨',r.state==='friends'?r.name+' — енді досың':'Сұраныс жіберілді',r.name);
    await profileView('fr');
  };
  ad.onclick=go;inp.onkeydown=e=>{if(e.key==='Enter')go()};
  row.append(inp,ad);b.append(row);
  const r=await api('friends');
  if(!r.ok){b.append(el('p','err',r.error||'Қате'));return}
  fr=r;renderBtn();
  const act=async(a,id,msg)=>{const x=await api('friends',{method:'POST',body:{action:a,id}});if(x.ok){if(msg)toast('✅',msg);await profileView('fr')}else toast('⚠️',x.error||'Қате')};
  const mk=(u,sub)=>{const li=el('div','fitem');li.append(avatarCanvas(u.avatar,'fav'));const w=el('div','fn');const nb=el('b','link',u.name+(u.role==='creator'?' 👑':u.role==='moderator'?' 🛡️':''));nb.onclick=()=>openUser(u.id,'fr');w.append(nb,el('span','',sub));li.append(w);return li};
  if(r.incoming.length){
    b.append(el('h2','','Сұраныстар'));
    for(const u of r.incoming){
      const li=mk(u,'дос болғысы келеді');
      const y=el('button','btn sm','✓');y.setAttribute('aria-label','Қабылдау');y.onclick=()=>act('accept',u.id,u.name+' — енді досың');
      const n=el('button','btn ghost sm','✕');n.setAttribute('aria-label','Бас тарту');n.onclick=()=>act('decline',u.id);
      li.append(y,n);b.append(li);
    }
  }
  b.append(el('h2','','Достар ('+r.friends.length+')'));
  if(!r.friends.length)b.append(el('p','xpt','Әзірше дос жоқ. Жоғарыға есімін жазып қос, немесе онлайн ойыннан кейін «Дос болу» батырмасын бас.'));
  for(const u of r.friends){
    const li=mk(u,(u.playing?'🎮 ойнап жатыр':u.online?'🟢 онлайн':'⚪ офлайн')+' · '+u.rating);
    if(u.online&&!u.playing){const iv=el('button','btn sm','⚔');iv.title='Ойынға шақыру';iv.setAttribute('aria-label','Ойынға шақыру');
      iv.onclick=async()=>{iv.disabled=true;const x=await api('match',{method:'POST',body:{action:'invite',to:u.id,tc:(()=>{try{return +localStorage.tc||0}catch(e){return 0}})()}});if(x.match&&window.__openPvp){closeOv();window.__openPvp(x.match);toast('📨','Шақыру жіберілді',u.name)}else{toast('⚠️',x.error||'Қате');iv.disabled=false}};
      li.append(iv)}
    if(u.playing){const w=el('button','btn ghost sm','👁');w.title='Ойынын көру';w.setAttribute('aria-label','Көру');w.onclick=()=>{closeOv();window.__watch&&window.__watch(u.playing)};li.append(w)}
    let armed=0;const rm=el('button','btn ghost sm','✕');rm.setAttribute('aria-label','Достан шығару');
    rm.onclick=()=>{if(!armed){armed=1;rm.textContent='?';setTimeout(()=>{armed=0;rm.textContent='✕'},2500);return}act('remove',u.id,u.name+' достардан шығарылды')};
    li.append(rm);b.append(li);
  }
  if(r.outgoing.length){
    b.append(el('h2','','Жіберілген сұраныстар'));
    for(const u of r.outgoing){const li=mk(u,'жауап күтілуде');const c=el('button','btn ghost sm','✕');c.setAttribute('aria-label','Болдырмау');c.onclick=()=>act('cancel',u.id);li.append(c);b.append(li)}
  }
}
async function renderClan(b){
  const r=await api('clans');
  if(!r.ok){b.append(el('p','err',r.error||'Қате'));return}
  const again=()=>profileView('clan');
  const call=async(body,msg)=>{const x=await api('clans',{method:'POST',body});if(x.ok){if(msg)toast('🛡️',msg);if(typeof x.coins==='number'){me.coins=x.coins;renderBtn()}await again()}else toast('⚠️',x.error||'Қате');return x};
  const c=r.mine;
  if(!c){
    b.append(el('p','xpt','Клан — достардың тобы: ортақ чат және ортақ рейтинг. Ашу құны: 🪙 '+r.cost+' (сенде '+r.coins+'). Бар кланға қосылу тегін.'));
    const f=el('div','clform');
    const nm=el('input');nm.placeholder='Клан аты';nm.maxLength=20;nm.setAttribute('aria-label','Клан аты');
    const tg=el('input');tg.placeholder='ТЕГ';tg.maxLength=4;tg.setAttribute('aria-label','Клан тегі');
    const ds=el('input');ds.placeholder='Қысқаша сипаттама';ds.maxLength=120;ds.setAttribute('aria-label','Сипаттама');
    let emb=r.emblems[0];const eb=el('div','embs');
    for(const e of r.emblems){const x=el('button','emb'+(e===emb?' on':''),e);x.type='button';x.onclick=()=>{emb=e;eb.querySelectorAll('.emb').forEach(y=>y.classList.toggle('on',y===x))};eb.append(x)}
    const mkb=el('button','btn','Клан ашу · 🪙 '+r.cost);mkb.disabled=r.coins<r.cost;
    mkb.onclick=()=>{mkb.disabled=true;call({action:'create',name:nm.value,tag:tg.value,emblem:emb,descr:ds.value},'Клан ашылды!').then(x=>{if(!x.ok)mkb.disabled=false})};
    f.append(nm,tg,ds,eb,mkb);b.append(f);
    b.append(el('h2','','Үздік кландар'));
    if(!r.top.length)b.append(el('p','xpt','Әзірше клан жоқ. Бірінші боласың ба?'));
    r.top.forEach((k,i)=>{
      const li=el('div','fitem');li.append(el('span','cemb',k.emblem));
      const w=el('div','fn');w.append(el('b','','#'+(i+1)+' ['+k.tag+'] '+k.name),el('span','',k.n+'/'+k.max+' · күш '+k.power+(k.descr?' · '+k.descr:'')));li.append(w);
      if(k.n<k.max){const j=el('button','btn sm','Қосылу');j.onclick=()=>{j.disabled=true;call({action:'join',id:k.id},k.name+' кланына қосылдың')};li.append(j)}
      b.append(li);
    });
    return;
  }
  const hd=el('div','chead');hd.append(el('span','cemb big',c.emblem));
  const t=el('div','fn');t.append(el('b','','['+c.tag+'] '+c.name),el('span','',c.members.length+'/'+c.max+' ойыншы · күш '+c.power));hd.append(t);b.append(hd);
  if(c.descr)b.append(el('p','xpt',c.descr));
  b.append(el('h2','','Мүшелер'));
  for(const m of c.members){
    const li=el('div','fitem');li.append(avatarCanvas(m.avatar,'fav'));
    const w=el('div','fn');const mb=el('b','link',m.name+(m.role==='leader'?' 👑':''));mb.onclick=()=>openUser(m.id,'clan');w.append(mb,el('span','',(m.online?'🟢 ':'⚪ ')+m.rating));li.append(w);
    if(c.you==='leader'&&m.role!=='leader'){let armed=0;const k=el('button','btn ghost sm','✕');k.setAttribute('aria-label','Шығару');k.onclick=()=>{if(!armed){armed=1;k.textContent='?';setTimeout(()=>{armed=0;k.textContent='✕'},2500);return}call({action:'kick',id:m.id},m.name+' шығарылды')};li.append(k)}
    b.append(li);
  }
  b.append(el('h2','','Клан чаты'));
  const box=el('div','cchat');
  if(!c.msgs.length)box.append(el('p','xpt','Әзірше хабар жоқ.'));
  for(const m of c.msgs){const p=el('p','');p.append(el('b','',m.name+': '),document.createTextNode(m.text));box.append(p)}
  b.append(box);requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight});
  const row=el('div','frow');const inp=el('input');inp.placeholder='Хабар жаз…';inp.maxLength=200;inp.setAttribute('aria-label','Хабар');
  const sb=el('button','btn','↵');sb.setAttribute('aria-label','Жіберу');
  const say=async()=>{const text=inp.value.trim();if(!text)return;sb.disabled=true;const x=await api('clans',{method:'POST',body:{action:'say',text}});sb.disabled=false;if(x.ok)await again();else toast('⚠️',x.error||'Қате')};
  sb.onclick=say;inp.onkeydown=e=>{if(e.key==='Enter')say()};row.append(inp,sb);b.append(row);
  let armed=0;const lv=el('button','btn ghost',c.you==='leader'&&c.members.length===1?'Кланды жою':'Кланнан шығу');
  lv.onclick=()=>{if(!armed){armed=1;lv.textContent='Растау?';setTimeout(()=>{armed=0;lv.textContent=c.you==='leader'&&c.members.length===1?'Кланды жою':'Кланнан шығу'},2500);return}call({action:'leave'},'Кланнан шықтың')};
  b.append(lv);
}
function left(iso){const ms=new Date(iso)-Date.now();const h=Math.max(0,Math.floor(ms/3600e3)),m=Math.max(0,Math.floor(ms%3600e3/60e3));return h+' сағ '+m+' мин'}
async function patchMe(body){const r=await api('me',{method:'PATCH',body});return r}
function renderDaily(b){
  const dl=data.daily;
  b.append(el('p','coins','🪙 '+me.coins+' тиын'));
  b.append(el('p','xpt','Бүгінгі тапсырмалар · жаңарады: '+left(dl.nextAt)));
  const ul=el('div','qlist');
  for(const q of dl.quests){
    const c=el('div','quest'+(q.claimed?' done':''));
    const t=el('div','qt');t.append(el('b','',q.title),el('span','',q.progress+' / '+q.goal));
    const bar=el('div','qbar');const i=el('i');i.style.width=(q.progress/q.goal*100)+'%';bar.append(i);t.append(bar);
    const bt=el('button','btn',q.claimed?'✓':'🪙 +'+q.reward);
    bt.disabled=q.claimed||q.progress<q.goal;
    bt.onclick=async()=>{bt.disabled=true;const r=await patchMe({claim:q.key});if(r.ok!==false&&!r.error){toast('🪙','+'+q.reward+' тиын');await profileView('daily')}else toast('⚠️',r.error||'Қате')};
    c.append(t,bt);ul.append(c);
  }
  const all=dl.quests.every(q=>q.claimed);
  const bc=el('div','quest bonus'+(dl.bonus.claimed?' done':''));
  const bt=el('div','qt');bt.append(el('b','','🎁 Үш тапсырма бонусы'),el('span','',all?'Дайын!':'Үшеуін де ал'));
  const bb=el('button','btn',dl.bonus.claimed?'✓':'🪙 +'+dl.bonus.reward);bb.disabled=!all||dl.bonus.claimed;
  bb.onclick=async()=>{bb.disabled=true;const r=await patchMe({claim:'all'});if(!r.error){toast('🎁','+'+dl.bonus.reward+' тиын');await profileView('daily')}else toast('⚠️',r.error)};
  bc.append(bt,bb);ul.append(bc);
  b.append(ul);
  b.append(el('p','xpt','Тиын әр рейтингті ойыннан және жетістіктен беріледі.'));
}
const SKN={grass:['🌿','Жайлау'],night:['🌙','Түнгі дала'],snow:['❄️','Қысқы дала'],sand:['🏜️','Шөл'],royal:['👑','Хан кілемі']};
function renderShop(b){
  b.append(el('p','coins','🪙 '+me.coins+' тиын'));
  b.append(el('p','xpt','Тақта терілері'));
  const own=new Set(me.skins.own),cur=me.skins.board;
  const g=el('div','agrid');
  for(const k of Object.keys(data.shop)){
    const price=data.shop[k],has=own.has(k),c=el('div','ach got skin'+(cur===k?' on':''));
    c.append(el('div','ic',SKN[k][0]),el('b','',SKN[k][1]));
    const bt=el('button','btn',cur===k?'Қолданылуда':has?'Таңдау':'🪙 '+price);
    bt.disabled=cur===k||(!has&&me.coins<price);
    bt.onclick=async()=>{
      bt.disabled=true;
      const r=await patchMe(has?{equip:k}:{buy:k});
      if(r.error){toast('⚠️',r.error);bt.disabled=false;return}
      if(!has)await patchMe({equip:k});
      await refresh();fireAuth('skin');await profileView('shop');
    };
    c.append(bt);g.append(c);
  }
  b.append(g);
  renderPieceShop(b);
}
async function renderCup(b,period){
  const sg=el('div','seg');
  for(const [k,l] of [['week','Апталық'],['month','Айлық маусым']]){const x=el('button','',l);x.setAttribute('aria-pressed',k===period);x.onclick=()=>{cupP=k;profileView('cup')};sg.append(x)}
  b.append(sg);
  const r=await api('tournament?period='+period);
  if(!r.ok){b.append(el('p','err',r.error||'Қате'));return}
  b.append(el('p','xpt',(period==='week'?'Апталық турнир':'Айлық маусым')+' · аяқталуына: '+left(r.endsAt)));
  b.append(el('p','xpt','Тек адаммен ойындар: жеңіс +3, тең +1. Топ-3 сыйлық: 🥇'+r.prizes[0]+' 🥈'+r.prizes[1]+' 🥉'+r.prizes[2]+' 🪙 және медаль.'));
  if(r.lastChamp)b.append(el('p','xpt','Өткен чемпион: 🏆 '+r.lastChamp.username));
  if(r.me)b.append(el('p','coins','Сенің орның: #'+r.me.rank+' · '+r.me.points+' ұпай'));
  else b.append(el('p','xpt','Әзірше ұпайың жоқ: «Онлайн» режимінде ойна.'));
  if(!r.rows.length){b.append(el('p','xpt','Әзірше ешкім ұпай жинаған жоқ. Бірінші бол!'));return}
  const t=el('table','lbt');
  for(const u of r.rows){
    const tr=el('tr',me&&u.name===me.username?'me':'');
    const nm=el('td');const w=el('div','u');w.append(avatarCanvas(u.avatar),el('span','',u.name+(u.role==='creator'?' 👑':'')));nm.append(w);
    tr.append(el('td','',['🥇','🥈','🥉'][u.rank-1]||String(u.rank)),nm,el('td','',u.wins+'/'+u.games),el('td','r',String(u.points)));t.append(tr);
  }
  b.append(t);
}
const PSN={classic:['♟️','Классика'],beast:['🐇','Жайлау жануарлары'],heroes:['🛡️','Батырлар'],alien:['👽','Инопланетяндар'],space:['🚀','Ғарыш сарбаздары'],dark:['💀','Dark fantasy'],light:['🦄','Light fantasy']};
function renderPieceShop(b){
  b.append(el('p','xpt','Фигура скиндері: жетістікпен ашылады немесе тиынға сатып алынады'));
  const own=new Set(data.punlocked||[]),cur=me.skins.piece||'beast';
  const g=el('div','agrid');
  for(const k of Object.keys(data.pshop)){
    const it=data.pshop[k],has=own.has(k),c=el('div','ach got skin pskin'+(cur===k?' on':''));
    const cv=el('canvas','pprev');cv.width=cv.height=112;
    requestAnimationFrame(()=>{if(window.__iconSkin)window.__iconSkin(cv,k,'K','w')});
    const cv2=el('canvas','pprev');cv2.width=cv2.height=112;
    requestAnimationFrame(()=>{if(window.__iconSkin)window.__iconSkin(cv2,k,'Q','b')});
    const pv=el('div','pvrow');pv.append(cv,cv2);
    c.append(pv,el('b','',PSN[k][1]));
    const acs=(it.ach||[]).map(x=>data.catalog[x]).filter(Boolean);
    if(!has&&acs.length)c.append(el('span','',acs.map(x=>x.icon+' '+x.name).join(' немесе ')+' жетістігімен ашылады'));
    const bt=el('button','btn',cur===k?'Қолданылуда':has?'Таңдау':'🪙 '+it.price);
    bt.disabled=cur===k||(!has&&me.coins<it.price);
    bt.onclick=async()=>{
      bt.disabled=true;
      const r=await patchMe(has?{equipP:k}:{buyP:k});
      if(r.error){toast('⚠️',r.error);bt.disabled=false;return}
      if(!has){const r2=await patchMe({equipP:k});if(r2.error)toast('⚠️',r2.error)}
      await refresh();fireAuth('skin');await profileView('shop');
    };
    c.append(bt);g.append(c);
  }
  b.append(g);
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
    const nm=el('td');const w=el('div','u link');w.append(avatarCanvas(u.avatar),el('span','',u.username+(u.role==='creator'?' 👑':u.role==='moderator'?' 🛡️':'')));w.onclick=()=>openUser(u.id,'top');nm.append(w);
    tr.append(el('td','',String(i+1)),nm,el('td','',u.wins+'/'+u.games),el('td','r',String(u.rating)));t.append(tr);
  });
  b.append(t);
}

let admTab='stats',admQ='',admF='';
const fmt=n=>Number(n).toLocaleString('kk-KZ');
async function renderAdmin(b){
  b.textContent='';
  const boss=me.role==='creator';
  const sub=el('div','subtabs');
  const tl=[['stats','📊 Шолу'],['users','👥 Ойыншылар'],['clans','🛡️ Кландар'],['matches','♟️ Ойындар'],['log','📣 Хабар · Журнал']];
  for(const [k,l] of tl){const x=el('button','',l);x.setAttribute('aria-pressed',k===admTab);x.onclick=()=>{admTab=k;renderAdmin(b)};sub.append(x)}
  b.append(sub);
  const body=el('div','admbody');b.append(body);
  const again=()=>renderAdmin(b);
  const post=async(o,msg)=>{const x=await api('admin',{method:'POST',body:o});if(x.ok){if(msg)toast('✅',msg);return true}toast('⚠️',x.error||'Қате');return false};
  const armBtn=(label,fn,cls)=>{const bt=el('button','sm '+(cls||''),label);bt.type='button';let a=0;bt.onclick=async()=>{if(!a){a=1;bt.textContent='Растау?';setTimeout(()=>{a=0;bt.textContent=label},3000);return}bt.disabled=true;await fn();bt.disabled=false};return bt};
  if(admTab==='stats'){
    const r=await api('admin?view=stats');if(!r.users){body.append(el('p','err',r.error||'Қате'));return}
    const U=r.users;
    const g=el('div','stats s4');
    g.append(stat(fmt(U.total),'Ойыншы'),stat(U.online,'Қазір онлайн'),stat(U.dau,'24 сағатта кірген'),stat('+'+U.new24,'Жаңа (24 сағ)'),
      stat('+'+U.new7,'Жаңа (7 күн)'),stat(r.matches.active,'Белсенді ойын'),stat(r.games.d1,'Ойын (24 сағ)'),stat(fmt(r.games.total),'Барлық ойын'),
      stat(r.clans,'Клан'),stat(U.mods,'Модератор'),stat(U.banned,'Бұғатталған'),stat(fmt(U.coins),'Ойыншылардағы 🪙'));
    body.append(g);
    const mx=Math.max(1,...r.days.map(d=>Math.max(d.reg,d.games)));
    body.append(el('h2','','Соңғы 7 күн'));
    const ch=el('div','achart');
    for(const d of r.days){const c=el('div','col');const b1=el('i','g');b1.style.height=(d.games/mx*100)+'%';b1.title='Ойын: '+d.games;const b2=el('i','r');b2.style.height=(d.reg/mx*100)+'%';b2.title='Тіркелу: '+d.reg;const bars=el('div','bars');bars.append(b1,b2);c.append(bars,el('span','',d.d));ch.append(c)}
    body.append(ch,el('p','xpt','Жасыл — ойындар · сары — жаңа тіркелулер'));
    if(r.top.length)body.append(el('p','xpt','🏆 Үздік: '+r.top.map(t=>t.username+' '+t.rating).join(' · ')));
  }
  else if(admTab==='users'){
    const row=el('div','frow');const si=el('input');si.type='search';si.placeholder='Ойыншыны іздеу…';si.value=admQ;si.setAttribute('aria-label','Іздеу');
    const sel=el('select');sel.setAttribute('aria-label','Сүзгі');for(const [v,l] of [['','Барлығы'],['online','Онлайн'],['banned','Бұғатталған'],['staff','Команда']]){const o=el('option','',l);o.value=v;sel.append(o)}sel.value=admF;
    const go=()=>{admQ=si.value;admF=sel.value;again()};si.onkeydown=e=>{if(e.key==='Enter')go()};sel.onchange=go;
    row.append(si,sel);body.append(row);
    const r=await api('admin?view=users&q='+encodeURIComponent(admQ)+'&f='+admF);if(!r.rows){body.append(el('p','err',r.error||'Қате'));return}
    body.append(el('p','xpt','Барлығы: '+r.total+' · көрсетілді: '+r.rows.length));
    const ul=el('ul','adm');
    for(const u of r.rows){
      const li=el('li',u.banned?'ban':'');
      const top=el('div','atop');top.append(avatarCanvas(u.avatar,'fav'));
      const info=el('div','ai');info.append(el('b','',u.username+(ROLE[u.role]?' '+ROLE[u.role].split(' ')[0]:'')+(u.banned?' · бұғатталған':'')),el('span','',u.games+' ойын · '+u.wins+' жеңіс · '+u.rating+' · 🪙'+(u.coins>=1e8?'∞':fmt(u.coins))+(u.last_seen?' · '+ago(u.last_seen):'')));
      top.append(info);
      const more=el('button','btn sm','Ашу');more.onclick=()=>admUser(b,u.id);top.append(more);
      li.append(top);ul.append(li);
    }
    body.append(ul);
  }
  else if(admTab==='clans'){
    const r=await api('admin?view=clans');if(!r.rows){body.append(el('p','err',r.error||'Қате'));return}
    if(!r.rows.length)body.append(el('p','xpt','Клан жоқ'));
    const ul=el('ul','adm');
    for(const c of r.rows){const li=el('li');const t=el('div','atop');t.append(el('span','cemb',c.emblem));const i=el('div','ai');i.append(el('b','','['+c.tag+'] '+c.name),el('span','',c.n+' мүше · көшбасшы '+(c.owner||'—')+' · '+new Date(c.created_at).toLocaleDateString('kk-KZ')));t.append(i);
      if(boss)t.append(armBtn('Жою',async()=>{if(await post({action:'clan_delete',id:c.id},'Клан жойылды'))again()},'dg'));li.append(t);ul.append(li)}
    body.append(ul);
  }
  else if(admTab==='matches'){
    const r=await api('admin?view=matches');if(!r.rows){body.append(el('p','err',r.error||'Қате'));return}
    body.append(el('p','xpt','Белсенді және ашық ойындар (соңғы 24 сағат)'));
    if(!r.rows.length)body.append(el('p','xpt','Қазір ойын жоқ'));
    const ul=el('ul','adm');
    for(const m of r.rows){const li=el('li');const t=el('div','atop');const i=el('div','ai');
      i.append(el('b','','#'+m.id+' · '+(m.w||'?')+' ⚔ '+(m.b||(m.mode==='ai'?'бот':'—'))),el('span','',(m.mode==='ai'?(m.camp?'жорық '+m.camp:'бот'):'онлайн')+' · '+m.status+' · '+m.mv+' жүріс'+(m.tc?' · '+m.tc/60+' мин':'')+' · '+ago(m.updated_at)));t.append(i);
      if(boss)t.append(armBtn('Аяқтау',async()=>{if(await post({action:'match_end',id:m.id},'Ойын аяқталды'))again()},'dg'));
      li.append(t);ul.append(li)}
    body.append(ul);
  }
  else{
    const ta=el('textarea');ta.rows=2;ta.maxLength=280;ta.placeholder='Барлық ойыншыға хабарландыру…';ta.setAttribute('aria-label','Хабарландыру');
    const sb=el('button','btn','📣 Жіберу');sb.onclick=async()=>{if(!ta.value.trim())return;sb.disabled=true;if(await post({action:'notice',text:ta.value},'Хабарландыру жіберілді'))again();sb.disabled=false};
    body.append(el('h2','','Хабарландыру'),ta,sb);
    const r=await api('admin?view=log');if(!r.rows){body.append(el('p','err',r.error||'Қате'));return}
    if(r.notices.length){const nl=el('ul','hist');for(const n of r.notices){const li=el('li');li.append(el('span','',n.text),el('span','',n.by_name+' · '+ago(n.created_at)));nl.append(li)}body.append(nl);body.append(armBtn('Барлық хабарды өшіру',async()=>{if(await post({action:'notice_clear'},'Өшірілді'))again()},'dg'))}
    body.append(el('h2','','Әрекеттер журналы'));
    const ul=el('ul','hist');
    if(!r.rows.length){const li=el('li');li.append(el('span','','Бос'));ul.append(li)}
    for(const l of r.rows){const li=el('li');li.append(el('span','',l.admin_name+' · '+l.action+(l.target?' → '+l.target:'')+(l.detail?' ('+l.detail+')':'')),el('span','',ago(l.created_at)));ul.append(li)}
    body.append(ul);
  }
}
async function admUser(b,id){
  b.textContent='';
  const boss=me.role==='creator';
  const back=el('button','btn ghost sm','← Тізімге');back.onclick=()=>renderAdmin(b);b.append(back);
  const r=await api('admin?view=user&id='+id);if(!r.user){b.append(el('p','err',r.error||'Қате'));return}
  const u=r.user;const again=()=>admUser(b,id);
  const post=async(o,msg)=>{const x=await api('admin',{method:'POST',body:{id,...o}});if(x.ok){if(msg)toast('✅',msg);return true}toast('⚠️',x.error||'Қате');return false};
  const hd=el('div','atop');hd.append(avatarCanvas(u.avatar,'fav'));const i=el('div','ai');
  i.append(el('b','',u.username+(ROLE[u.role]?' · '+ROLE[u.role]:'')+(u.banned?' · бұғатталған':'')),el('span','','Деңгей '+lvOf(u.xp)+' · '+u.rating+' · 🪙'+(u.coins>=1e8?'∞':fmt(u.coins))+' · жорық '+u.camp+' · '+u.games+' ойын'+(u.clan?' · '+u.clan:'')));hd.append(i);
  const op=el('button','btn ghost sm','Профиль');op.onclick=()=>openUser(id,'adm');hd.append(op);b.append(hd);
  if(u.bio)b.append(el('p','pbio','«'+u.bio+'»'));
  b.append(el('p','xpt','Тіркелген: '+new Date(u.created_at).toLocaleDateString('kk-KZ')+(u.last_seen?' · соңғы кіру: '+ago(u.last_seen):'')+' · жетістік: '+r.ach.length));
  const act=el('div','aa');
  const mk=(label,fn,danger)=>{const bt=el('button','sm'+(danger?' dg':''),label);bt.type='button';let a=0;bt.onclick=async()=>{if(danger&&!a){a=1;bt.textContent='Растау?';setTimeout(()=>{a=0;bt.textContent=label},3000);return}bt.disabled=true;const ok=await fn();bt.disabled=false;if(ok)again()};act.append(bt)};
  if(u.role!=='creator'){
    mk(u.banned?'Бұғатты ашу':'Бұғаттау',()=>post({action:u.banned?'unban':'ban'},u.banned?'Ашылды':'Бұғатталды'),!u.banned);
    if(boss){
      mk(u.role==='moderator'?'Модераторлықты алу':'🛡️ Модератор ету',()=>post({action:'role',role:u.role==='moderator'?'player':'moderator'},'Рөл өзгерді'));
      mk('Профиль мәтінін тазалау',()=>post({action:'bio_clear'},'Тазаланды'));
      mk('Статистиканы нөлдеу',()=>post({action:'reset'},'Нөлденді'),true);
      mk('Аккаунтты жою',async()=>{if(await post({action:'delete'},'Жойылды')){renderAdmin(b)}return false},true);
    }
    b.append(act);
    if(boss){
      b.append(el('h2','','Тиын мен рейтинг'));
      const r1=el('div','frow');const ci=el('input');ci.type='number';ci.placeholder='± тиын';const cb=el('button','btn','🪙 Беру');cb.onclick=async()=>{if(await post({action:'coins',n:ci.value},'Тиын өзгерді'))again()};r1.append(ci,cb);b.append(r1);
      const r2=el('div','frow');const ri=el('input');ri.type='number';ri.placeholder='Рейтинг (100–3500)';ri.value=u.rating;const rb=el('button','btn','Қою');rb.onclick=async()=>{if(await post({action:'rating',n:ri.value},'Рейтинг өзгерді'))again()};r2.append(ri,rb);b.append(r2);
      b.append(el('h2','','Сыйлық беру'));
      const gv=el('div','spick');
      const own=new Set([...(u.skins.own||[]),...(u.skins.pown||[])]);
      const items=[...r.shop.filter(k=>k!=='grass').map(k=>[k,'🎨 '+(BN[k]||k)+' тақта']),...r.pshop.map(k=>[k,'♟️ '+k+' скин']),['camp','🏹 Бүкіл жорық'],['all_ach','🏆 Барлық жетістік']];
      for(const [k,l] of items){const x=el('button','sch'+(own.has(k)?' on':''),l);x.type='button';x.onclick=async()=>{if(await post({action:'give',key:k},'Берілді'))again()};gv.append(x)}
      b.append(gv);
    }
  } else b.append(el('p','xpt','Создательге әрекет жасауға болмайды.'));
}

/* ---------- game hooks ---------- */
const authCbs=[];
function fireAuth(st){for(const c of authCbs.slice()){try{c.fn(st)}catch(e){}if(c.once&&st==='in')authCbs.splice(authCbs.indexOf(c),1)}}
function showAward(r,result){
  const sign=r.dRating>=0?'+':'';
  toast(result==='win'?'🏆':result==='draw'?'🤝':'💪','+'+r.dXp+' XP · рейтинг '+sign+r.dRating,'Рейтинг: '+r.rating+(r.dCoins?' · +'+r.dCoins+' 🪙':'')+(r.levelUp?' · Жаңа деңгей!':''));
  let delay=900;
  for(const k of (r.newAchievements||[])){
    const a=(data&&data.catalog&&data.catalog[k])||null;
    setTimeout(()=>{ if(a){toast(a.icon,'Жетістік: '+a.name,a.desc,null,5500);window.__snd&&window.__snd('chime')} },delay);delay+=1100;
  }
  refresh();
}

/* ---------- init ---------- */
function init(){
  $('#acct').onclick=()=>me?profileView('profile'):authView('login');
  $('#ov').addEventListener('pointerdown',e=>{if(e.target.id==='ov')closeOv()});
  const ready=refresh();
  window.Plat={pskin:()=>(me&&me.skins&&me.skins.piece)||'beast',skin:()=>(me&&me.skins&&me.skins.board)||'grass',api,toast,showAward,refresh,ready,isIn:()=>!!me,login:()=>authView('login'),register:()=>authView('reg'),onAuth:(fn,once)=>authCbs.push({fn,once:!!once})};
}
init();
})();
