const API = '';
let currentUser = null, currentAnime = null, currentEp = null, currentSeason = 0;
let heroIdx = 0, heroTimer = null, allAnime = [], currentRating = 0, playerAnimeId = null;

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const l = document.getElementById('loader');
    l.style.opacity = '0'; l.style.transition = 'opacity .5s';
    setTimeout(() => l.style.display = 'none', 500);
  }, 1100);
  const sess = localStorage.getItem('av_session');
  if (sess) { try { currentUser = JSON.parse(sess); initHome(); } catch { showPage('pageSignup'); } }
  else showPage('pageSignup');
  document.addEventListener('click', e => {
    if (!e.target.closest('.nav-prof') && !e.target.closest('.pmenu')) document.querySelectorAll('.pmenu').forEach(m => m.classList.remove('show'));
    if (!e.target.closest('.nav-search')) hideSDrop();
  });
});

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ===== AUTH =====
async function handleSignup() {
  const username = v('su_user'), email = v('su_email'), phone = v('su_phone'), password = v('su_pass');
  if (!username || !email || !phone || !password) return showA('suErr','All fields required!');
  if (password.length < 6) return showA('suErr','Password min 6 characters.');
  try {
    const res = await api('/api/auth/signup','POST',{username,email,phone,password});
    if (res.success) { showA('suOk','✓ Account created! Redirecting...',false); setTimeout(()=>showPage('pageLogin'),1500); }
    else showA('suErr', res.message||'Signup failed.');
  } catch { showA('suErr','Server error. Try again.'); }
}

async function handleLogin() {
  const email = v('li_email'), password = v('li_pass');
  if (!email || !password) return showA('liErr','Email and password required!');
  try {
    const res = await api('/api/auth/login','POST',{email,password});
    if (res.success) { currentUser = res.user; localStorage.setItem('av_session', JSON.stringify(currentUser)); initHome(); }
    else showA('liErr', res.message||'Invalid credentials.');
  } catch { showA('liErr','Server error. Try again.'); }
}

function handleLogout() {
  currentUser = null; localStorage.removeItem('av_session');
  allAnime = []; clearInterval(heroTimer); showPage('pageSignup');
}

// ===== HOME =====
async function initHome() {
  updateProfUI(); showPage('pageHome');
  await loadAnime();
  buildStats(); buildHero();
  renderFilmsSection(); renderSeriesSection(); renderListGrid(allAnime);
}

function updateProfUI() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';
  ['1','2','3'].forEach(n => {
    const nm = document.getElementById('pmN'+n), em = document.getElementById('pmE'+n),
          rl = document.getElementById('pmR'+n), ad = document.getElementById('pmAdm'+n);
    if (nm) nm.textContent = currentUser.username||'User';
    if (em) em.textContent = currentUser.email||'';
    if (rl) { rl.textContent = isAdmin ? 'Admin' : 'Member'; rl.className = 'pm-role'+(isAdmin?' ar':''); }
    if (ad) ad.style.display = isAdmin ? 'flex' : 'none';
  });
  const cr = document.getElementById('crownH');
  if (cr) cr.style.display = isAdmin ? 'flex' : 'none';
}

async function api(path, method='GET', body=null) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (currentUser?.token) opts.headers['Authorization'] = 'Bearer ' + currentUser.token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

async function loadAnime() {
  try { const r = await api('/api/anime'); if (r.success) allAnime = r.anime||[]; }
  catch { allAnime = []; }
}

// ===== STATS =====
function buildStats() {
  const totalEps = allAnime.reduce((s,a)=>(a.seasons||[]).reduce((ss,se)=>ss+(se.episodes||[]).length,s),0);
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-box"><div class="sbn">${allAnime.length}</div><div class="sbl">Total Anime</div></div>
    <div class="stat-box"><div class="sbn">${totalEps}</div><div class="sbl">Episodes</div></div>
    <div class="stat-box"><div class="sbn">${allAnime.filter(a=>a.type==='Movie').length}</div><div class="sbl">Movies</div></div>
    <div class="stat-box"><div class="sbn">${allAnime.filter(a=>a.type!=='Movie').length}</div><div class="sbl">Series</div></div>
  `;
}

// ===== HERO =====
function buildHero() {
  const featured = allAnime.slice(0, 6);
  const slides = document.getElementById('heroSlides');
  const inds = document.getElementById('heroInds');
  if (!featured.length) { document.getElementById('heroSection').style.display='none'; return; }
  slides.innerHTML = featured.map(a => {
    const totalEps = (a.seasons||[]).reduce((s,se)=>s+(se.episodes||[]).length,0);
    return `
      <div class="hero-slide">
        <div class="hbg" style="background-image:url('${a.banner||a.cover||''}')"></div>
        <div class="hov"></div><div class="hov2"></div>
        <div class="hcontent">
          <div class="h-tags">
            <span class="htag">${a.category||'Anime'}</span>
            ${a.type==='Movie'?'<span class="htag">MOVIE</span>':'<span class="htag sub">'+totalEps+' EPS</span>'}
          </div>
          <div class="h-title">${a.name}</div>
          <div class="h-desc">${a.description||''}</div>
          <div class="h-btns">
            <button class="btn-hwatch" onclick="openAnime('${a._id}')"><i class="fas fa-play"></i> Watch Now</button>
            <button class="btn-hinfo" onclick="openAnime('${a._id}')"><i class="fas fa-info-circle"></i> Details</button>
          </div>
        </div>
      </div>`;
  }).join('');
  inds.innerHTML = featured.map((_,i)=>`<div class="hind${i===0?' active':''}" onclick="goHero(${i})"></div>`).join('');
  heroIdx = 0; clearInterval(heroTimer);
  heroTimer = setInterval(()=>heroNav(1), 5500);
}
function heroNav(d) { const n=Math.min(allAnime.length,6); heroIdx=(heroIdx+d+n)%n; goHero(heroIdx); }
function goHero(i) { heroIdx=i; document.getElementById('heroSlides').style.transform=`translateX(-${i*100}%)`; document.querySelectorAll('.hind').forEach((d,j)=>d.classList.toggle('active',j===i)); }

// ===== FILM/SERIES SECTIONS =====
function renderFilmsSection() {
  const el = document.getElementById('filmsScroll');
  const items = allAnime.slice(0, 12);
  el.innerHTML = items.length ? items.map(a=>acardHTML(a)).join('') : '<div style="color:var(--txt2);padding:20px">No anime yet.</div>';
}
function renderSeriesSection() {
  const el = document.getElementById('seriesScroll');
  const items = allAnime.filter(a=>a.type!=='Movie').slice(0,12);
  el.innerHTML = items.length ? items.map(a=>acardHTML(a)).join('') : '<div style="color:var(--txt2);padding:20px">No series yet.</div>';
}

function acardHTML(a) {
  const eps = (a.seasons||[]).reduce((s,se)=>s+(se.episodes||[]).length,0);
  const yr = a.createdAt ? new Date(a.createdAt).getFullYear() : '';
  return `
    <div class="acard" onclick="openAnime('${a._id}')">
      <div class="acard-img-w">
        <img class="acard-img" src="${a.cover||''}" alt="${a.name}" loading="lazy" onerror="this.style.background='#222';this.src=''">
        ${yr?`<div class="acard-yr">${yr}</div>`:''}
        <div class="acard-type${a.type==='Movie'?' movie':''}">${a.type||'Series'}</div>
        <div class="acard-ov">
          <div class="acard-play"><i class="fas fa-play"></i></div>
          <div class="acard-eps">${eps} Episodes</div>
        </div>
      </div>
      <div class="acard-info">
        <div class="acard-title">${a.name}</div>
        <div class="acard-meta">
          ${a.avgRating?`<span class="acard-rating"><i class="fas fa-star"></i> ${a.avgRating.toFixed(1)}</span>`:''}
          <span>${a.category||'Anime'}</span>
        </div>
      </div>
    </div>`;
}

function scrollSec(id, dir) {
  const el = document.getElementById(id);
  el.scrollBy({ left: dir * 500, behavior: 'smooth' });
}

// ===== LIST GRID (list style like image bottom section) =====
function renderListGrid(list) {
  const el = document.getElementById('listGrid');
  const no = document.getElementById('noRes');
  if (!list.length) { el.innerHTML=''; no.style.display='block'; return; }
  no.style.display='none';
  el.innerHTML = list.map(a=>{
    const desc = a.description||'';
    return `
      <div class="lcard" onclick="openAnime('${a._id}')">
        <img class="lcard-img" src="${a.cover||''}" alt="${a.name}" loading="lazy" onerror="this.style.background='#222';this.src=''">
        <div class="lcard-info">
          <div class="lcard-title">${a.name}</div>
          <div class="lcard-desc">${desc}</div>
          <div class="lcard-watch">Watch Now <i class="fas fa-arrow-right"></i></div>
        </div>
      </div>`;
  }).join('');
}

// ===== FILTER =====
function filterCat(cat, el) {
  document.querySelectorAll('[data-cat]').forEach(b=>b.classList.remove('active'));
  if (el) document.querySelectorAll(`[data-cat="${cat}"]`).forEach(b=>b.classList.add('active'));
  const filtered = cat==='All' ? allAnime : allAnime.filter(a=>a.category===cat||a.type===cat);
  const titleEl = document.getElementById('allTitle');
  if (titleEl) titleEl.innerHTML = cat==='All'?'NEW <span>RELEASES</span>':`<span>${cat}</span>`;
  renderListGrid(filtered);
  renderFilmsSection(); renderSeriesSection();
  showPage('pageHome');
}

// ===== SEARCH =====
function handleSearch(q) {
  if (!q.trim()) { hideSDrop(); return; }
  const r = allAnime.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  const d = document.getElementById('sdrop');
  d.innerHTML = r.length ? r.map(a=>`
    <div class="sitem" onclick="openAnime('${a._id}')">
      <img src="${a.cover||''}" alt="${a.name}" onerror="this.style.background='#222';this.src=''">
      <div><div class="sitem-n">${a.name}</div><div class="sitem-c">${a.category||'Anime'} · ${a.type||'Series'}</div></div>
    </div>`).join('') : '<div style="padding:14px;color:var(--txt2);font-size:.85rem">No results found</div>';
  showSDrop();
}
function showSDrop(){document.getElementById('sdrop').classList.add('show');}
function hideSDrop(){document.getElementById('sdrop').classList.remove('show');}

// ===== ANIME DETAIL =====
async function openAnime(id) {
  showPage('pageAnime'); updateProfUI();
  const c = document.getElementById('animeDetailContent');
  c.innerHTML = '<div style="text-align:center;padding:80px;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:2rem"></i></div>';
  try {
    const r = await api('/api/anime/'+id);
    if (!r.success) throw new Error();
    currentAnime = r.anime; currentSeason = 0; renderAnimeDetail();
  } catch { c.innerHTML='<div style="text-align:center;padding:80px;color:#ff6b6b">Failed to load anime.</div>'; }
}

function renderAnimeDetail() {
  const a = currentAnime;
  const c = document.getElementById('animeDetailContent');
  const seasons = a.seasons||[];
  const isMovie = a.type==='Movie';
  const totalEps = seasons.reduce((s,se)=>s+(se.episodes||[]).length,0);
  const avg = a.avgRating?a.avgRating.toFixed(1):'—';

  c.innerHTML = `
    <div class="anime-hero">
      <div class="ah-bg" style="background-image:url('${a.banner||a.cover||''}')"></div>
      <div class="ah-ov"></div><div class="ah-ov2"></div>
      <div class="ah-cnt">
        <div class="ah-poster"><img src="${a.cover||''}" alt="${a.name}" onerror="this.style.background='#222'"></div>
        <div class="ah-info">
          <div class="ah-cats">
            <span class="ah-cat">${a.category||'Anime'}</span>
            ${a.type==='Movie'?'<span class="ah-cat">MOVIE</span>':'<span class="ah-cat outline">SERIES</span>'}
          </div>
          <div class="ah-title">${a.name}</div>
          <div class="ah-meta">
            ${avg!=='—'?`<span class="rating"><i class="fas fa-star"></i> ${avg}</span>`:''}
            <span><i class="fas fa-film"></i> ${totalEps} Episodes</span>
            <span><i class="fas fa-user"></i> ${a.uploaderName||'AniVerse'}</span>
          </div>
          <div class="ah-desc">${a.description||''}</div>
          <div class="ah-actions">
            <button class="btn-watch-now" onclick="playEp(0,0)"><i class="fas fa-play"></i> Watch Now</button>
            <button class="btn-outline" onclick="openDonate()"><i class="fas fa-heart"></i> Support</button>
          </div>
        </div>
      </div>
    </div>
    <div class="ep-section">
      <div class="sec-hdr" style="margin-bottom:14px">
        <div class="sec-title">SEASONS <span>&amp; EPISODES</span></div>
      </div>
      ${!isMovie&&seasons.length>1?`<div class="season-bar" id="seasonBar">${seasons.map((s,i)=>`<button class="stab${i===0?' active':''}" onclick="selSeason(${i},this)">${s.name||'Season '+(i+1)}</button>`).join('')}</div>`:'' }
      <div class="ep-grid" id="epGrid">${renderEpList(seasons[0],0)}</div>
    </div>
    <div class="ep-section" style="padding-top:0">
      <div class="sec-hdr" style="margin-bottom:14px">
        <div class="sec-title">COMMENTS <span>&amp; RATINGS</span></div>
      </div>
      <div class="cmt-form">
        <textarea class="cmt-inp" id="cmtInp" placeholder="Write your comment or review..."></textarea>
        <div class="cmt-form-bot">
          <div class="stars" id="ratingStars">${[1,2,3,4,5].map(n=>`<i class="fas fa-star" onclick="setRating(${n})"></i>`).join('')}</div>
          <button class="btn-postcmt" onclick="submitCmt()">Post Comment</button>
        </div>
      </div>
      <div class="cmt-list" id="cmtList"></div>
    </div>
  `;
  currentRating = 0;
  loadCmts(a._id);
}

function renderEpList(season, sIdx) {
  if (!season||!season.episodes||!season.episodes.length) return '<div style="padding:20px;color:var(--txt2)">No episodes yet.</div>';
  return season.episodes.map((ep,eIdx)=>`
    <div class="ep-item" id="epi_${sIdx}_${eIdx}" onclick="playEp(${sIdx},${eIdx})">
      <div class="ep-num">EP${eIdx+1}</div>
      <div class="ep-inf">
        <div class="ep-n">${ep.name||'Episode '+(eIdx+1)}</div>
        <div class="ep-d">${ep.description||''}</div>
      </div>
      ${ep.downloadLink?`<button class="btn-epdl" onclick="event.stopPropagation();dlLink('${ep.downloadLink}')"><i class="fas fa-download"></i> DL</button>`:''}
    </div>`).join('');
}

function selSeason(i, el) {
  currentSeason=i;
  document.querySelectorAll('#seasonBar .stab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('epGrid').innerHTML = renderEpList(currentAnime.seasons[i],i);
}

// ===== PLAYER =====
function playEp(sIdx, eIdx) {
  if (!currentAnime) return;
  const seasons=currentAnime.seasons||[], season=seasons[sIdx];
  if (!season||!season.episodes) return;
  const ep=season.episodes[eIdx]; if (!ep) return;
  playerAnimeId=currentAnime._id; currentEp={sIdx,eIdx,ep,season};
  showPage('pagePlayer'); updateProfUI();
  const hasPrev = eIdx>0||sIdx>0;
  const hasNext = eIdx<season.episodes.length-1||sIdx<seasons.length-1;
  const videoHTML = ep.videoUrl ? (
    ep.videoUrl.includes('youtube')||ep.videoUrl.includes('youtu.be') ?
    `<iframe src="${ytEmbed(ep.videoUrl)}" allowfullscreen allow="autoplay;encrypted-media"></iframe>` :
    `<video controls src="${ep.videoUrl}" style="width:100%;aspect-ratio:16/9"></video>`
  ) : `<div style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;color:var(--txt2);flex-direction:column;gap:12px;background:#111"><i class="fas fa-video-slash" style="font-size:3rem;opacity:.3"></i><div style="font-family:Barlow Condensed;letter-spacing:2px;text-transform:uppercase">No Video Available</div></div>`;

  document.getElementById('playerContent').innerHTML = `
    <div class="video-box">${videoHTML}</div>
    <div class="player-info">
      <div>
        <div class="pi-title">${ep.name||'Episode '+(eIdx+1)}</div>
        <div class="pi-sub">${currentAnime.name} · ${season.name||'Season '+(sIdx+1)}</div>
      </div>
      <div class="pi-actions">
        ${hasPrev?`<button class="btn-epnav" onclick="navEp(${sIdx},${eIdx},-1)"><i class="fas fa-step-backward"></i> Prev</button>`:''}
        ${hasNext?`<button class="btn-epnav" onclick="navEp(${sIdx},${eIdx},1)">Next <i class="fas fa-step-forward"></i></button>`:''}
        ${ep.downloadLink?`<button class="btn-dl-main" onclick="dlLink('${ep.downloadLink}')"><i class="fas fa-download"></i> Download</button>`:''}
      </div>
    </div>
    <div class="cmts">
      <div class="cmts-title">COMMENTS <span>&amp; RATINGS</span></div>
      <div class="cmt-form">
        <textarea class="cmt-inp" id="cmtInpP" placeholder="Write your comment..."></textarea>
        <div class="cmt-form-bot">
          <div class="stars" id="ratingStarsP">${[1,2,3,4,5].map(n=>`<i class="fas fa-star" onclick="setRatingP(${n})"></i>`).join('')}</div>
          <button class="btn-postcmt" onclick="submitCmtP()">Post</button>
        </div>
      </div>
      <div class="cmt-list" id="cmtListP"></div>
    </div>
  `;
  document.getElementById('playerBack').onclick = () => openAnime(currentAnime._id);
  currentRating=0; loadCmtsP(currentAnime._id);
}

function navEp(sIdx,eIdx,d) {
  const seasons=currentAnime.seasons; let ns=sIdx,ne=eIdx+d;
  if (ne<0&&sIdx>0){ns=sIdx-1;ne=seasons[ns].episodes.length-1;}
  else if (ne>=seasons[sIdx].episodes.length&&sIdx<seasons.length-1){ns=sIdx+1;ne=0;}
  if (ns>=0&&ns<seasons.length&&ne>=0&&ne<seasons[ns].episodes.length) playEp(ns,ne);
}

function ytEmbed(url) { const m=url.match(/(?:v=|youtu\.be\/)([^&?/]+)/); return m?`https://www.youtube.com/embed/${m[1]}?autoplay=1`:url; }
function dlLink(url) { window.open(url,'_blank'); }

// ===== COMMENTS =====
async function loadCmts(id) {
  try { const r=await api('/api/comments/'+id); if(r.success) renderCmts(r.comments,'cmtList',id); }
  catch {}
}
async function loadCmtsP(id) {
  try { const r=await api('/api/comments/'+id); if(r.success) renderCmts(r.comments,'cmtListP',id); }
  catch {}
}

function renderCmts(cmts, listId, animeId) {
  const el=document.getElementById(listId); if(!el) return;
  if (!cmts||!cmts.length) { el.innerHTML='<div style="color:var(--txt2);text-align:center;padding:24px;font-family:Barlow Condensed;letter-spacing:1px;text-transform:uppercase">No comments yet. Be first!</div>'; return; }
  el.innerHTML = cmts.map(c=>buildCmt(c,animeId)).join('');
}

function buildCmt(c, animeId) {
  const isAdmin = c.userRole==='admin';
  const stars = c.rating ? '★'.repeat(c.rating)+'☆'.repeat(5-c.rating) : '';
  const canDel = currentUser&&(currentUser.role==='admin'||currentUser._id===c.userId);
  const replies = (c.replies||[]).map(r=>{
    const ra=r.userRole==='admin';
    return `<div class="cmt-card${ra?' admin-cmt':''}">
      <div class="cmt-head">
        <div class="cmt-av${ra?' adm':''}">${(r.username||'U')[0].toUpperCase()}</div>
        <div class="cmt-user">${r.username||'User'}</div>
        ${ra?'<span class="cmt-albl">Admin</span>':''}
        <div class="cmt-time">${timeAgo(r.createdAt)}</div>
      </div>
      <div class="cmt-txt">${r.text}</div>
    </div>`;
  }).join('');
  return `<div class="cmt-card${isAdmin?' admin-cmt':''}" id="cmt_${c._id}">
    <div class="cmt-head">
      <div class="cmt-av${isAdmin?' adm':''}">${(c.username||'U')[0].toUpperCase()}</div>
      <div class="cmt-user">${c.username||'User'}</div>
      ${isAdmin?'<span class="cmt-albl">Admin</span>':''}
      ${stars?`<span class="cmt-stars-s">${stars}</span>`:''}
      <div class="cmt-time">${timeAgo(c.createdAt)}</div>
    </div>
    <div class="cmt-txt">${c.text}</div>
    <div class="cmt-ftr">
      <button class="cbt" onclick="toggleRF('rf_${c._id}')"><i class="fas fa-reply"></i> Reply</button>
      ${canDel?`<button class="cbt del" onclick="delCmt('${c._id}','${animeId}')"><i class="fas fa-trash"></i> Delete</button>`:''}
    </div>
    <div class="reply-form" id="rf_${c._id}">
      <textarea class="reply-inp" id="ri_${c._id}" placeholder="Write a reply..."></textarea>
      <button class="reply-sub" onclick="submitReply('${c._id}','${animeId}')">Reply →</button>
    </div>
    ${replies?`<div class="replies">${replies}</div>`:''}
  </div>`;
}

function toggleRF(id){const f=document.getElementById(id);if(f)f.classList.toggle('show');}

async function submitCmt() {
  if (!currentUser) return toast('Please login first','err');
  const text=document.getElementById('cmtInp')?.value?.trim();
  if (!text) return toast('Write something first!','err');
  try {
    const r=await api('/api/comments','POST',{animeId:currentAnime._id,text,rating:currentRating});
    if(r.success){document.getElementById('cmtInp').value='';setRating(0);loadCmts(currentAnime._id);toast('Comment posted!','ok');}
  } catch { toast('Failed to post','err'); }
}
async function submitCmtP() {
  if (!currentUser) return toast('Please login first','err');
  const text=document.getElementById('cmtInpP')?.value?.trim();
  if (!text) return toast('Write something first!','err');
  try {
    const r=await api('/api/comments','POST',{animeId:playerAnimeId,text,rating:currentRating});
    if(r.success){document.getElementById('cmtInpP').value='';setRatingP(0);loadCmtsP(playerAnimeId);toast('Comment posted!','ok');}
  } catch { toast('Failed to post','err'); }
}
async function submitReply(cmtId,animeId) {
  if (!currentUser) return toast('Please login first','err');
  const text=document.getElementById('ri_'+cmtId)?.value?.trim();
  if (!text) return;
  try { const r=await api('/api/comments/'+cmtId+'/reply','POST',{text}); if(r.success){loadCmts(animeId);loadCmtsP(animeId);toast('Reply posted!','ok');} }
  catch {}
}
async function delCmt(id,animeId) {
  if (!confirm('Delete comment?')) return;
  try { const r=await api('/api/comments/'+id,'DELETE'); if(r.success){loadCmts(animeId);loadCmtsP(animeId);toast('Deleted','ok');} }
  catch {}
}
function setRating(n){currentRating=n;document.querySelectorAll('#ratingStars i').forEach((s,i)=>s.classList.toggle('on',i<n));}
function setRatingP(n){currentRating=n;document.querySelectorAll('#ratingStarsP i').forEach((s,i)=>s.classList.toggle('on',i<n));}

// ===== REQUEST =====
async function submitRequest() {
  if (!currentUser) return toast('Please login first','err');
  const name=v('req_name'); if (!name) return toast('Enter anime name','err');
  try {
    const r=await api('/api/requests','POST',{animeName:name,info:v('req_info')});
    if(r.success){showA('reqOk','✓ Request submitted!',false);document.getElementById('req_name').value='';document.getElementById('req_info').value='';setTimeout(()=>closeModal('reqModal'),2000);}
  } catch { toast('Failed to submit','err'); }
}

// ===== UTILS =====
function openDonate(){window.open('https://wa.me/94621584279?text=Hi%2C+I+want+to+donate+to+AniVerse!','_blank');}
function goAdmin(){if(currentUser?.role==='admin')window.location.href='admin.html';else toast('Admin access only!','err');}
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
window.addEventListener('click',e=>{if(e.target.classList.contains('modal-bg'))e.target.classList.remove('show');});
function togglePM(id){const m=document.getElementById(id);const was=m.classList.contains('show');document.querySelectorAll('.pmenu').forEach(x=>x.classList.remove('show'));if(!was)m.classList.add('show');}
function openMobDrawer(){document.getElementById('mobDrawer').classList.add('open');document.getElementById('mobOv').classList.add('show');}
function closeMobDrawer(){document.getElementById('mobDrawer').classList.remove('open');document.getElementById('mobOv').classList.remove('show');}
function v(id){return document.getElementById(id)?.value?.trim()||'';}
function showA(id,msg,isErr=true){const e=document.getElementById(id);if(!e)return;e.textContent=msg;e.style.display='block';setTimeout(()=>e.style.display='none',4500);}
function toast(msg,type='ok'){
  const t=document.createElement('div');t.className='toast'+(type==='err'?' err':'');
  t.innerHTML=`<i class="fas fa-${type==='ok'?'check':'exclamation-triangle'} ${type==='ok'?'ok-i':'err-i'}"></i>${msg}`;
  document.getElementById('toastCont').appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(()=>t.remove(),400);},3200);
}
function timeAgo(d){if(!d)return'';const diff=Math.floor((new Date()-new Date(d))/1000);if(diff<60)return'just now';if(diff<3600)return Math.floor(diff/60)+'m ago';if(diff<86400)return Math.floor(diff/3600)+'h ago';return Math.floor(diff/86400)+'d ago';}
