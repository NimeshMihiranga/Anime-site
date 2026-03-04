const API = '';
const ADMIN_CREDS = { phone:'94721584279', email:'mihirangamihiranga223@gmail.com', password:'Nimesh@123' };
let adminUser = null, seasonCount = 0;

window.addEventListener('DOMContentLoaded', () => {
  const sess = localStorage.getItem('av_admin_session');
  if (sess) { try { adminUser=JSON.parse(sess); showDash(); } catch { showLogin(); } }
  else showLogin();
});

function showLogin(){document.getElementById('adminLogin').classList.add('active');document.getElementById('adminDash').classList.remove('active');}
function showDash(){
  document.getElementById('adminLogin').classList.remove('active');
  document.getElementById('adminDash').classList.add('active');
  document.getElementById('adminName').textContent = adminUser?.username||'Admin';
  loadDashboard(); loadAdminAnime();
}

async function adminLogin() {
  const id=v('al_id'), pass=v('al_pass');
  if (!id||!pass) return showA('aErr','All fields required!');
  const isLocal=(id===ADMIN_CREDS.email||id===ADMIN_CREDS.phone)&&pass===ADMIN_CREDS.password;
  if (isLocal) {
    adminUser={username:'Admin',email:ADMIN_CREDS.email,role:'admin',token:'admin_local'};
    localStorage.setItem('av_admin_session',JSON.stringify(adminUser)); showDash(); return;
  }
  try {
    let r = await apiFetch('/api/auth/login','POST',{email:id,password:pass});
    if (r.success && r.user?.role==='admin') { adminUser=r.user; localStorage.setItem('av_admin_session',JSON.stringify(adminUser)); showDash(); }
    else showA('aErr','Invalid admin credentials.');
  } catch { showA('aErr','Server error.'); }
}
function adminLogout(){adminUser=null;localStorage.removeItem('av_admin_session');showLogin();}

async function apiFetch(path,method='GET',body=null) {
  const opts={method,headers:{'Content-Type':'application/json'}};
  if (adminUser?.token) opts.headers['Authorization']='Bearer '+adminUser.token;
  if (body) opts.body=JSON.stringify(body);
  const r=await fetch(API+path,opts); return r.json();
}

// SECTIONS
const secLabels={sDash:'DASH<span style="color:var(--yellow)">BOARD</span>',sUpload:'UPLOAD <span style="color:var(--yellow)">ANIME</span>',sAnime:'MANAGE <span style="color:var(--yellow)">ANIME</span>',sUsers:'<span style="color:var(--yellow)">USERS</span>',sRequests:'<span style="color:var(--yellow)">REQUESTS</span>',sComments:'<span style="color:var(--yellow)">COMMENTS</span>'};
function showSec(id) {
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.sbi').forEach(s=>s.classList.remove('active'));
  document.getElementById('secLabel').innerHTML = secLabels[id]||id;
  if(id==='sDash')loadDashboard();
  if(id==='sAnime')loadAdminAnime();
  if(id==='sUsers')loadUsers();
  if(id==='sRequests')loadRequests();
  if(id==='sComments')loadAllCmts();
  closeSB();
}
function toggleSB(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobOv').classList.toggle('show');}
function closeSB(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobOv').classList.remove('show');}

// DASHBOARD
async function loadDashboard() {
  try {
    const [ar,ur,rr]=await Promise.all([apiFetch('/api/anime'),apiFetch('/api/admin/users'),apiFetch('/api/requests')]);
    const animes=ar.anime||[], users=ur.users||[], reqs=rr.requests||[];
    const eps=animes.reduce((s,a)=>(a.seasons||[]).reduce((ss,se)=>ss+(se.episodes||[]).length,s),0);
    document.getElementById('dashStats').innerHTML=`
      <div class="scard"><div class="sc-icon">🎬</div><div class="sc-n">${animes.length}</div><div class="sc-l">Total Anime</div></div>
      <div class="scard"><div class="sc-icon">📺</div><div class="sc-n">${eps}</div><div class="sc-l">Episodes</div></div>
      <div class="scard"><div class="sc-icon">👥</div><div class="sc-n">${users.length}</div><div class="sc-l">Users</div></div>
      <div class="scard"><div class="sc-icon">📋</div><div class="sc-n">${reqs.length}</div><div class="sc-l">Requests</div></div>
    `;
    const recent=animes.slice(-6).reverse();
    document.getElementById('recentUploads').innerHTML = recent.length ? `
      <table><tr><th>Name</th><th>Category</th><th>Type</th><th>Episodes</th><th>Rating</th></tr>
      ${recent.map(a=>{const e=(a.seasons||[]).reduce((s,se)=>s+(se.episodes||[]).length,0);return`<tr>
        <td><strong>${a.name}</strong></td><td>${a.category||'—'}</td>
        <td><span class="badge badge-${(a.type||'series').toLowerCase()}">${a.type||'Series'}</span></td>
        <td>${e}</td><td style="color:var(--yellow)">★ ${a.avgRating?a.avgRating.toFixed(1):'—'}</td>
      </tr>`;}).join('')}
      </table>` : '<div class="empty-c">No anime yet</div>';
  } catch { document.getElementById('dashStats').innerHTML='<div class="empty-c">Failed to load</div>'; }
}

// ANIME TABLE
async function loadAdminAnime() {
  const el=document.getElementById('animeTable');
  el.innerHTML='<div class="loading-c"><i class="fas fa-spinner fa-spin"></i></div>';
  try {
    const r=await apiFetch('/api/anime');
    const a=r.anime||[];
    if (!a.length){el.innerHTML='<div class="empty-c">No anime uploaded yet</div>';return;}
    el.innerHTML=`<table><tr><th>Name</th><th>Category</th><th>Type</th><th>Eps</th><th>Rating</th><th>Uploader</th><th>Action</th></tr>
    ${a.map(x=>{const e=(x.seasons||[]).reduce((s,se)=>s+(se.episodes||[]).length,0);return`<tr>
      <td><strong>${x.name}</strong></td><td>${x.category||'—'}</td>
      <td><span class="badge badge-${(x.type||'series').toLowerCase()}">${x.type||'Series'}</span></td>
      <td>${e}</td><td style="color:var(--yellow)">★ ${x.avgRating?x.avgRating.toFixed(1):'—'}</td>
      <td style="color:var(--txt2)">${x.uploaderName||'—'}</td>
      <td><button class="btn btn-r" onclick="delAnime('${x._id}')"><i class="fas fa-trash"></i> Delete</button></td>
    </tr>`;}).join('')}</table>`;
  } catch { el.innerHTML='<div class="empty-c">Failed to load</div>'; }
}

async function delAnime(id) {
  if (!confirm('Delete this anime permanently?')) return;
  try { const r=await apiFetch('/api/anime/'+id,'DELETE'); if(r.success){toast('Deleted!','ok');loadAdminAnime();loadDashboard();} else toast('Failed.','err'); }
  catch { toast('Error','err'); }
}

// UPLOAD
function toggleMovieMode(){const t=document.getElementById('up_type').value;document.getElementById('seasonsArea').style.display=t==='Movie'?'none':'block';document.getElementById('movieArea').style.display=t==='Movie'?'block':'none';}
function prevImg(inpId,imgId){const url=document.getElementById(inpId).value.trim();const img=document.getElementById(imgId);if(url){img.src=url;img.style.display='block';img.onerror=()=>img.style.display='none';}else img.style.display='none';}

function addSeason() {
  const i=seasonCount++;
  const el=document.createElement('div');
  el.className='season-blk';el.id='sb_'+i;
  el.innerHTML=`
    <div class="sblk-hdr">
      <div class="sblk-name"><input type="text" value="Season ${i+1}" id="sname_${i}"></div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-b" style="font-size:.72rem" onclick="addEp(${i})"><i class="fas fa-plus"></i> Add Ep</button>
        <button class="btn btn-r" style="font-size:.72rem" onclick="document.getElementById('sb_${i}').remove()"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="ep-blks" id="epb_${i}"></div>
  `;
  document.getElementById('seasonsContainer').appendChild(el);
  addEp(i);
}

function addEp(si) {
  const builder=document.getElementById('epb_'+si);
  const ei=builder.children.length;
  const el=document.createElement('div');
  el.className='ep-blk';el.id=`ep_${si}_${ei}`;
  el.innerHTML=`
    <div class="ep-blk-hdr">
      <span>Episode ${ei+1}</span>
      <button class="btn btn-r" style="padding:4px 10px;font-size:.7rem" onclick="this.closest('.ep-blk').remove()"><i class="fas fa-times"></i></button>
    </div>
    <div class="ep-fields">
      <div class="ef"><label>Episode Name</label><input type="text" id="en_${si}_${ei}" placeholder="Episode title"></div>
      <div class="ef"><label>Video URL (YouTube / direct)</label><input type="url" id="ev_${si}_${ei}" placeholder="https://youtube.com/watch?v=..."></div>
      <div class="ef"><label>Download Link</label><input type="url" id="ed_${si}_${ei}" placeholder="https://drive.google.com/..."></div>
      <div class="ef full"><label>Short Description (max 3 lines)</label><textarea id="edes_${si}_${ei}" placeholder="Brief episode description..."></textarea></div>
    </div>
  `;
  builder.appendChild(el);
}

async function submitUpload() {
  const name=v('up_name'),category=v('up_cat'),type=document.getElementById('up_type').value;
  const description=v('up_desc'),cover=v('up_cover'),banner=v('up_banner'),uploaderName=v('up_uploader')||adminUser?.username||'Admin';
  if (!name||!description) return showA('upErr','Name and description required!');
  let seasons=[];
  if (type==='Movie') {
    const videoUrl=v('mv_video'),downloadLink=v('mv_dl');
    seasons=[{name:'Movie',episodes:[{name,description,videoUrl,downloadLink}]}];
  } else {
    document.querySelectorAll('.season-blk').forEach((sb,si)=>{
      const sid=sb.id.split('_')[1];
      const sname=document.getElementById('sname_'+sid)?.value||'Season '+(si+1);
      const episodes=[];
      sb.querySelectorAll('.ep-blk').forEach((eb,ei)=>{
        const ids=eb.id.split('_');const sI=ids[1],eI=ids[2];
        episodes.push({
          name:document.getElementById(`en_${sI}_${eI}`)?.value?.trim()||'Episode '+(ei+1),
          videoUrl:document.getElementById(`ev_${sI}_${eI}`)?.value?.trim()||'',
          downloadLink:document.getElementById(`ed_${sI}_${eI}`)?.value?.trim()||'',
          description:document.getElementById(`edes_${sI}_${eI}`)?.value?.trim()||''
        });
      });
      if(episodes.length) seasons.push({name:sname,episodes});
    });
    if (!seasons.length) return showA('upErr','Add at least one season with episodes!');
  }
  try {
    const r=await apiFetch('/api/anime','POST',{name,category,type,description,cover,banner,uploaderName,seasons});
    if (r.success) {
      showA('upOk','✓ Anime uploaded successfully!',false);
      ['up_name','up_desc','up_cover','up_banner','up_uploader','mv_video','mv_dl'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      document.getElementById('seasonsContainer').innerHTML='';
      seasonCount=0;
      document.getElementById('pCover').style.display='none';
      document.getElementById('pBanner').style.display='none';
      loadAdminAnime();loadDashboard();
    } else showA('upErr',r.message||'Upload failed.');
  } catch { showA('upErr','Server error. Check API.'); }
}

// USERS
async function loadUsers() {
  const el=document.getElementById('usersTable');
  el.innerHTML='<div class="loading-c"><i class="fas fa-spinner fa-spin"></i></div>';
  try {
    const r=await apiFetch('/api/admin/users');
    const users=r.users||[];
    if (!users.length){el.innerHTML='<div class="empty-c">No users yet</div>';return;}
    el.innerHTML=`<table><tr><th>Username</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Action</th></tr>
    ${users.map(u=>`<tr>
      <td><strong>${u.username||'—'}</strong></td>
      <td style="color:var(--txt2)">${u.email||'—'}</td>
      <td style="color:var(--txt2)">${u.phone||'—'}</td>
      <td><span class="badge badge-${u.role||'member'}">${u.role||'Member'}</span></td>
      <td style="color:var(--txt3)">${u.createdAt?new Date(u.createdAt).toLocaleDateString():'—'}</td>
      <td>
        ${u.role!=='admin'?`<button class="btn btn-g" onclick="setRole('${u._id}','admin')"><i class="fas fa-crown"></i> Make Admin</button>`:''}
        ${u.role==='admin'?`<button class="btn btn-r" onclick="setRole('${u._id}','member')"><i class="fas fa-user"></i> Remove Admin</button>`:''}
      </td>
    </tr>`).join('')}</table>`;
  } catch { el.innerHTML='<div class="empty-c">Failed to load</div>'; }
}

async function setRole(id,role) {
  if (!confirm(`Set role to ${role}?`)) return;
  try { const r=await apiFetch('/api/admin/users/'+id+'/role','PUT',{role}); if(r.success){toast('Role updated!','ok');loadUsers();} else toast('Failed.','err'); }
  catch { toast('Error','err'); }
}

// REQUESTS
async function loadRequests() {
  const el=document.getElementById('reqsContent');
  el.innerHTML='<div class="loading-c"><i class="fas fa-spinner fa-spin"></i></div>';
  try {
    const r=await apiFetch('/api/requests');
    const reqs=r.requests||[];
    if (!reqs.length){el.innerHTML='<div class="empty-c">No requests yet</div>';return;}
    el.innerHTML=reqs.map(rq=>`
      <div class="rcard">
        <div>
          <div class="rcard-name"><i class="fas fa-film" style="color:var(--yellow);margin-right:7px"></i>${rq.animeName||'Unknown'}</div>
          <div class="rcard-meta">By ${rq.username||'User'} &nbsp;·&nbsp; ${rq.createdAt?new Date(rq.createdAt).toLocaleDateString():''}</div>
          ${rq.info?`<div class="rcard-note">${rq.info}</div>`:''}
        </div>
        <button class="btn btn-r" onclick="delReq('${rq._id}')"><i class="fas fa-check"></i> Done</button>
      </div>`).join('');
  } catch { el.innerHTML='<div class="empty-c">Failed to load</div>'; }
}

async function delReq(id){
  try { const r=await apiFetch('/api/requests/'+id,'DELETE'); if(r.success){toast('Cleared!','ok');loadRequests();} }
  catch {}
}

// COMMENTS
async function loadAllCmts() {
  const el=document.getElementById('cmtsContent');
  el.innerHTML='<div class="loading-c"><i class="fas fa-spinner fa-spin"></i></div>';
  try {
    const r=await apiFetch('/api/admin/comments');
    const cmts=r.comments||[];
    if (!cmts.length){el.innerHTML='<div class="empty-c">No comments yet</div>';return;}
    el.innerHTML=cmts.map(c=>`
      <div class="ccard">
        <div class="cc-info">
          <div class="cc-user">${c.username||'User'} <span style="color:var(--txt3);font-size:.7rem;font-weight:400;letter-spacing:0;text-transform:none">on</span> ${c.animeName||'Unknown'}</div>
          <div class="cc-on">${c.createdAt?new Date(c.createdAt).toLocaleString():''}</div>
          <div class="cc-txt">${c.text}</div>
          ${c.rating?`<div class="cc-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5-c.rating)} ${c.rating}/5</div>`:''}
        </div>
        <button class="btn btn-r" onclick="delCmt('${c._id}')"><i class="fas fa-trash"></i></button>
      </div>`).join('');
  } catch { el.innerHTML='<div class="empty-c">Failed to load</div>'; }
}

async function delCmt(id){
  try { const r=await apiFetch('/api/comments/'+id,'DELETE'); if(r.success){toast('Deleted!','ok');loadAllCmts();} }
  catch {}
}

// HELPERS
function v(id){return document.getElementById(id)?.value?.trim()||'';}
function showA(id,msg,isErr=true){const e=document.getElementById(id);if(!e)return;e.textContent=msg;e.style.display='block';setTimeout(()=>e.style.display='none',4500);}
function toast(msg,type='ok'){
  const t=document.createElement('div');
  t.style.cssText=`background:var(--card2);border:1px solid var(--border);border-left:3px solid ${type==='ok'?'var(--yellow)':'var(--red)'};padding:11px 16px;font-family:Barlow Condensed,sans-serif;font-size:.85rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--txt);display:flex;align-items:center;gap:9px;animation:fadeIn .3s ease;`;
  t.innerHTML=`<i class="fas fa-${type==='ok'?'check':'exclamation-triangle'}" style="color:${type==='ok'?'var(--yellow)':'var(--red)'}"></i>${msg}`;
  document.getElementById('toastCont').appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(()=>t.remove(),400);},3000);
}
