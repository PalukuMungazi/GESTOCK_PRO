const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const esc = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const uid = arr => arr.length ? Math.max(...arr.map(x=>Number(x.id)||0))+1 : 1;
// -----------------------------------------------------------------------------
// STOCKAGE CENTRAL : MySQL via PHP
// -----------------------------------------------------------------------------
// IMPORTANT : il n'y a plus de localStorage pour les données métier.
// Les données sont chargées depuis l'API PHP puis conservées seulement en mémoire
// pour afficher rapidement les pages. Toute modification est envoyée à MySQL.
const apiCache = {categories:[],suppliers:[],customers:[],products:[],purchases:[],sales:[],stockMovements:[],cashTransactions:[],users:[],auditLogs:[],settings:{},dashboardStats:{},analytics:{}};
const apiEntity = k => k === 'stockMovements' ? 'stockMovements' : k;
const store = {
  get(k){ return apiCache[k] ?? []; },
  set(k,v){ apiCache[k]=v; },
  clear(){ Object.keys(apiCache).forEach(k=>apiCache[k]=Array.isArray(apiCache[k])?[]:{}); }
};

async function apiGet(entity){
  const parts=String(entity).split('?'); const base=parts.shift(); const query=parts.length?'&'+parts.join('?'):'';
  const r=await fetch('api/data.php?entity='+encodeURIComponent(apiEntity(base))+query,{credentials:'same-origin'});
  const j=await r.json(); if(!r.ok||!j.success) throw new Error(j.message||'Erreur API');
  return j.data;
}
async function apiSave(entity,obj){
  const r=await fetch('api/data.php?entity='+encodeURIComponent(entity)+'&action=save',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
  const j=await r.json(); if(!r.ok||!j.success) throw new Error(j.message||'Erreur API'); return j;
}
async function apiDelete(entity,id){
  const r=await fetch('api/data.php?entity='+encodeURIComponent(entity)+'&action=delete',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const j=await r.json(); if(!r.ok||!j.success) throw new Error(j.message||'Erreur API'); return j;
}
async function loadAllData(){
  // Chaque module est chargé séparément.
  // Une erreur sur un rapport/statistique ne doit jamais empêcher la connexion.
  const entities=Object.keys(apiCache);
  for(const e of entities){
    try{
      apiCache[e]=await apiGet(e);
    }catch(err){
      console.error('Chargement API échoué pour '+e, err);
      // On conserve une valeur vide pour permettre à l'utilisateur d'entrer dans l'application.
      // Le module concerné pourra être rechargé plus tard.
      if(e==='settings') apiCache[e]={};
      else if(e==='dashboardStats') apiCache[e]={};
      else apiCache[e]=[];
    }
  }
}
async function refreshData(){ await loadAllData(); renderPageOnly(); }
function apiError(e){ console.error(e); toast(e.message||'Une erreur est survenue.'); }

const state = {
  page: location.hash.replace('#','') || 'dashboard',
  logged: false,
  search:'',
  modal:null,
  editId:null,
  deleteId:null,
  cart:[],
  customer:'Comptant',
  method:'Espèces',
  received:'',
  discount:0,
  saleRef:'',
  cat:'',
  view:null,
  reportType:'ventes',
  reportFrom:'',
  reportTo:'',
  currentUser:null,
  mobileMenu:false
};
const icons = {dashboard:'▦',notifications:'🔔',audit:'◷',products:'▣',categories:'◈',suppliers:'♧',customers:'♙',purchases:'↙',sales:'↗',pos:'▤',cash:'▤',stock:'⇅',reports:'▥',users:'♟',settings:'⚙',backup:'⬇',analytics:'◉'};
const rolePermissions = {
  'Administrateur':['*'],
  'Gérant':['dashboard','notifications','audit','products','categories','suppliers','customers','purchases','sales','pos','cash','stock','reports','analytics','settings'],
  'Caissier':['dashboard','notifications','customers','sales','pos','cash','reports','analytics'],
  'Gestionnaire de stock':['dashboard','notifications','products','categories','suppliers','purchases','stock','reports','analytics']
};
function canAccess(page){ const role=state.currentUser?.role_name||'Administrateur'; const p=rolePermissions[role]||[]; return p.includes('*')||p.includes(page); }
function allowedNavs(){ return [['dashboard','Tableau de bord'],['notifications','Notifications'],['audit','Journal d’activité'],['backup','Sauvegarde'],['products','Produits'],['categories','Catégories'],['suppliers','Fournisseurs'],['customers','Clients'],['purchases','Achats'],['sales','Ventes'],['pos','Point de Vente'],['cash','Caisse'],['stock','Mouvements de stock'],['reports','Rapports'],['analytics','Analyse'],['users','Utilisateurs'],['settings','Paramètres']].filter(([p])=>canAccess(p)); }

function toast(msg){
  const c=$('#toast-container'); c.className='toast-container';
  const d=document.createElement('div'); d.className='toast'; d.textContent=msg; c.appendChild(d);
  setTimeout(()=>d.remove(),2400);
}
function nav(page){state.page=page;state.search='';state.modal=null;state.editId=null;state.deleteId=null;state.mobileMenu=false;location.hash=page;render();}
window.addEventListener('hashchange',()=>{state.page=location.hash.replace('#','')||'dashboard';render();});

function statusBadge(v){
  const cls=v==='En stock'||v==='Actif'||v==='Payé'?'green':v==='Stock faible'||v==='Partiellement payé'?'yellow':v==='Rupture'||v==='Non payé'||v==='Inactif'?'red':'gray';
  return `<span class="badge badge-${cls}">${esc(v)}</span>`;
}
function modal(title,body,foot=''){
  return `<div class="modal-overlay" id="modal"><div class="modal"><div class="modal-head"><div class="modal-title">${title}</div><button class="icon-btn" data-action="close-modal">✕</button></div><div class="modal-body">${body}</div>${foot?`<div class="modal-foot">${foot}</div>`:''}</div></div>`;
}
function shell(content){
  const navs=allowedNavs();
  return `<div class="app-shell">
    <div class="mobile-sidebar-overlay ${state.mobileMenu?'show':''}" data-action="close-sidebar"></div>
    <aside class="sidebar ${state.mobileMenu?'mobile-open':''}">
      <div class="brand"><div class="brand-mark">G</div><div><div class="brand-name">GESTOCK PRO</div><div class="brand-sub">Gestion commerciale</div></div></div>
      <nav class="nav"><div class="nav-section">Menu principal</div>${navs.map(([p,l])=>`<button class="nav-item ${state.page===p?'active':''}" data-nav="${p}"><span class="nav-icon">${icons[p]}</span><span>${l}</span></button>`).join('')}</nav>
      <div class="sidebar-footer"><div class="profile"><div class="avatar">AS</div><div class="user-mini"><div style="font-size:12px;font-weight:600">${esc(state.currentUser?.name||'Utilisateur')}</div><div style="font-size:10px;color:#94a3b8">${esc(state.currentUser?.role_name||'')}</div></div></div></div>
    </aside>
    <main class="main">
      <header class="topbar"><button class="mobile-menu-btn" data-action="toggle-sidebar" aria-label="Ouvrir le menu" title="Menu">☰</button><div class="top-search"><span>⌕</span><input id="global-search" placeholder="Recherche rapide..." value="${esc(state.search)}"></div><div class="top-actions"><button class="icon-btn">◔</button><button class="icon-btn" data-nav="notifications" title="Notifications">🔔</button><div class="profile"><div class="avatar">AS</div><div><div style="font-size:12px;font-weight:600">${esc(state.currentUser?.name||'Utilisateur')}</div><div style="font-size:10px;color:#94a3b8">${esc(state.currentUser?.role_name||'')}</div></div></div><button class="btn btn-secondary" data-action="logout" title="Revenir à la page de connexion">Changer de compte</button></div></header>
      <div class="content">${content}</div>
    </main>
  </div>`;
}

function auditPage(){
  if(!canAccess('audit')) return `<div class="page">${pageHead('Accès refusé','Votre rôle ne permet pas de consulter le journal.')}</div>`;
  const logs=store.get('auditLogs')||[];
  const rows=logs.map(x=>`<tr><td>${esc(x.date||'')}</td><td><b>${esc(x.user||'Utilisateur')}</b></td><td>${esc(x.action||'')}</td><td>${esc(x.entity||'')}</td><td>${esc(x.description||'')}</td></tr>`).join('');
  return `<div class="page">${pageHead('Journal d’activité','Historique des opérations effectuées dans GESTOCK PRO',`<button class="btn btn-secondary" data-nav="dashboard">← Tableau de bord</button>`)}<div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><b>${logs.length} opération(s) récente(s)</b><span class="text-muted">Maximum 500 opérations affichées</span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Module</th><th>Description</th></tr></thead><tbody>${rows||`<tr><td colspan="5" class="text-muted">Aucune opération enregistrée.</td></tr>`}</tbody></table></div></div></div>`;
}
function backupPage(){
  if(!canAccess('backup')) return `<div class="page">${pageHead('Accès refusé','Votre rôle ne permet pas de gérer les sauvegardes.')}</div>`;
  return `<div class="page">${pageHead('Sauvegarde','Protégez les données de GESTOCK PRO avec une copie complète de MySQL')}
  <div class="card settings-section">
    <h3>💾 Sauvegarde de la base de données</h3>
    <p class="text-muted" style="font-size:12px;line-height:1.6">Cette sauvegarde contient la structure des tables et les données actuelles de GESTOCK PRO. Un fichier SQL sera téléchargé sur votre ordinateur.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-primary" data-action="download-backup">⬇ Télécharger la sauvegarde SQL</button><button class="btn btn-secondary" data-nav="settings">Paramètres</button></div>
    <div class="card" style="margin-top:18px;padding:14px;background:#f8fafc"><b style="font-size:12px">Conseil</b><div class="text-muted" style="font-size:11px;margin-top:4px">Conservez les fichiers de sauvegarde sur un support différent de l'ordinateur qui exécute WampServer.</div></div>
  </div></div>`;
}
function notificationsPage(){
  const products=store.get('products')||[];
  const customers=store.get('customers')||[];
  const low=products.filter(p=>Number(p.stock||0)<=Number(p.minStock||0));
  const out=products.filter(p=>Number(p.stock||0)<=0);
  const debts=customers.filter(c=>Number(c.balance||0)>0);
  const notifications=[];
  out.slice(0,20).forEach(p=>notifications.push({type:'Rupture de stock',text:`${p.name} est en rupture de stock.`,className:'red',action:'products'}));
  low.filter(p=>Number(p.stock||0)>0).slice(0,20).forEach(p=>notifications.push({type:'Stock faible',text:`${p.name} a atteint son seuil minimum.`,className:'yellow',action:'products'}));
  debts.slice(0,20).forEach(c=>notifications.push({type:'Créance client',text:`${c.name} a un solde de ${fmt(c.balance)}.`,className:'pink',action:'customers'}));
  if(!notifications.length) notifications.push({type:'Information',text:'Aucune alerte pour le moment.',className:'green',action:'dashboard'});
  return `<div class="page">${pageHead('Notifications','Alertes et informations importantes',`<button class="btn btn-secondary" data-nav="dashboard">← Tableau de bord</button>`)}<div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>${notifications.length} notification(s)</b><span class="text-muted">Actualisées depuis les données MySQL</span></div>${notifications.map(n=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f1f5f9"><div><span class="badge badge-${n.className}">${esc(n.type)}</span><div style="margin-top:5px">${esc(n.text)}</div></div><button class="btn btn-secondary" data-nav="${n.action}">Voir</button></div>`).join('')}</div></div>`;
}
function render(){
  if(!state.logged){renderLogin();return;}
  if(!canAccess(state.page)) state.page='dashboard';
  const pages={dashboard:dashboardPage,notifications:notificationsPage,audit:auditPage,backup:backupPage,products:productsPage,categories:categoriesPage,suppliers:suppliersPage,customers:customersPage,purchases:purchasesPage,sales:salesPage,pos:posPage,cash:cashPage,stock:stockPage,reports:reportsPage,analytics:analyticsPage,users:usersPage,settings:settingsPage};
  $('#app').innerHTML=shell((pages[state.page]||dashboardPage)());
  bindGlobal();
}
function bindGlobal(){
  $$('[data-nav]').forEach(b=>b.onclick=()=>nav(b.dataset.nav));
  // Sur mobile, le menu se referme automatiquement après une navigation.
  $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>{state.mobileMenu=false;}));
  const gs=$('#global-search'); if(gs){gs.oninput=e=>{state.search=e.target.value;renderPageOnly();};}
  // Les boutons data-action sont gérés par le gestionnaire global ci-dessous.
  // On évite ici d'ajouter un deuxième gestionnaire qui pourrait exécuter
  // deux fois une sauvegarde (et créer deux utilisateurs).
}
function renderPageOnly(){
  const pages={dashboard:dashboardPage,notifications:notificationsPage,audit:auditPage,backup:backupPage,products:productsPage,categories:categoriesPage,suppliers:suppliersPage,customers:customersPage,purchases:purchasesPage,sales:salesPage,pos:posPage,cash:cashPage,stock:stockPage,reports:reportsPage,analytics:analyticsPage,users:usersPage,settings:settingsPage};
  $('.content').innerHTML=(pages[state.page]||dashboardPage)(); bindGlobal();
}

async function printBusinessDocument(type,id){
  const r=await fetch(`api/document.php?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,{credentials:'same-origin'});
  const j=await r.json().catch(()=>({success:false,message:'Réponse serveur invalide.'}));
  if(!r.ok || !j.success) throw new Error(j.message||'Document introuvable.');
  const company=j.data?.settings||{};
  const d=j.data?.document||{};
  const money=v=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
  const escPrint=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const isSale=type==='sale';
  const title=isSale?(d.document_type||'REÇU DE VENTE'):'BON D’ACHAT';
  const date=isSale?d.sale_date:d.purchase_date;
  const party=isSale?d.customer_name:d.supplier_name;
  const partyLabel=isSale?'Client':'Fournisseur';
  const items=(d.items||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${escPrint(x.code||'')}</td><td>${escPrint(x.name||'')}</td><td class="num">${Number(x.quantity||0)}</td><td>${escPrint(x.unit||'')}</td><td class="num">${money(x.unit_price)}</td><td class="num">${money(x.total_price)}</td></tr>`).join('');
  const totals=isSale?`<tr><td colspan="6">Sous-total</td><td>${money(d.subtotal)}</td></tr><tr><td colspan="6">Remise</td><td>${money(d.discount)}</td></tr><tr><td colspan="6">TVA</td><td>${money(d.tva_amount)}</td></tr><tr class="grand"><td colspan="6">TOTAL</td><td>${money(d.total_amount)}</td></tr><tr><td colspan="6">Payé</td><td>${money(d.paid_amount)}</td></tr><tr><td colspan="6">Reste</td><td>${money(d.remaining_amount)}</td></tr>`:`<tr class="grand"><td colspan="6">TOTAL ACHAT</td><td>${money(d.total_amount)}</td></tr><tr><td colspan="6">Payé</td><td>${money(d.paid_amount)}</td></tr><tr><td colspan="6">Reste</td><td>${money(d.remaining_amount)}</td></tr>`;
  const win=window.open('','_blank','width=900,height=700');
  if(!win) throw new Error('La fenêtre d’impression a été bloquée par le navigateur. Autorisez les fenêtres contextuelles pour GESTOCK PRO.');
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escPrint(title)} - ${escPrint(d.reference)}</title><style>
  @page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;margin:0}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 18px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}.company{max-width:55%}.meta{text-align:right}.muted{color:#555}.box{border:1px solid #ccc;padding:10px;margin-bottom:14px}.row{display:flex;gap:20px}.col{flex:1}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #ccc;padding:7px}th{background:#f2f2f2;text-align:left}.num{text-align:right}.grand td{font-weight:700;font-size:13px}.footer{margin-top:25px;display:flex;justify-content:space-between}.thanks{text-align:center;margin-top:30px;font-weight:700}.no-print{margin-top:20px;padding:8px 12px} @media print{.no-print{display:none}}
  </style></head><body><div class="head"><div class="company"><h1>${escPrint(company.company||'GESTOCK PRO')}</h1><div>${escPrint(company.address||'')}</div><div>${escPrint(company.phone||'')}</div><div>${escPrint(company.email||'')}</div>${company.tax_number?`<div>N° fiscal : ${escPrint(company.tax_number)}</div>`:''}</div><div class="meta"><h2>${escPrint(title)}</h2><div><b>N° :</b> ${escPrint(d.reference)}</div><div><b>Date :</b> ${escPrint(date)}</div><div><b>Utilisateur :</b> ${escPrint(isSale?d.cashier:d.buyer)}</div></div></div><div class="box"><b>${partyLabel} :</b> ${escPrint(party||'—')} ${isSale&&d.customer_phone?`<span class="muted"> | ${escPrint(d.customer_phone)}</span>`:''}</div><table><thead><tr><th>#</th><th>Code</th><th>Produit</th><th>Qté</th><th>Unité</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${items||'<tr><td colspan="7">Aucun article.</td></tr>'}</tbody><tfoot>${totals}</tfoot></table>${d.notes?`<div class="box" style="margin-top:16px"><b>Notes :</b> ${escPrint(d.notes)}</div>`:''}<div class="footer"><div><b>Mode / statut :</b> ${escPrint(isSale?(d.payment_method||'').replaceAll('_',' '):d.status)}</div><div><b>Devise :</b> $</div></div>${isSale?'<div class="thanks">Merci pour votre achat !</div>':''}<button class="no-print" onclick="window.print()">Imprimer</button></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(),250);
}

async function handleAction(a,id){
  if(a==='print-sale'){try{await printBusinessDocument('sale',id);}catch(err){apiError(err);}return;}
  if(a==='print-purchase'){try{await printBusinessDocument('purchase',id);}catch(err){apiError(err);}return;}
  if(a==='view-customer-history'){state.modal='customer-history';state.view=id;renderPageOnly();return;}
  if(a==='view-supplier-history'){state.modal='supplier-history';state.view=id;renderPageOnly();return;}
  if(a==='print-customer-history'){printHistory('customer');return;}
  if(a==='print-supplier-history'){printHistory('supplier');return;}
  if(a==='logout'){
    try{await fetch('api/auth/logout.php',{method:'POST',credentials:'same-origin'});}catch(e){}
    state.logged=false; state.currentUser=null; render(); return;
  }
  if(a==='close-modal'){state.modal=null;renderPageOnly();return;}
  if(a==='reset'){toast('Les données sont maintenant gérées par MySQL. La réinitialisation de démonstration est désactivée.');return;}
  if(a==='nav'){ if(canAccess(id)) nav(id); else toast('Accès non autorisé pour votre rôle.'); }
}

function renderLogin(){
  $('#app').innerHTML=`<div class="login-page"><div class="card login-box"><div class="login-logo">G</div><div class="login-title">GESTOCK PRO</div><div class="login-sub">Gestion de stock, ventes et caisse</div><form id="login-form"><label class="form-label">Identifiant</label><input class="input" name="user" value="" autocomplete="username" required><label class="form-label" style="margin-top:12px">Mot de passe</label><input class="input" name="pass" type="password" value="" autocomplete="current-password" required><label style="display:flex;gap:8px;align-items:center;font-size:12px;color:#64748b;margin:12px 0"><input type="checkbox" checked> Se souvenir de moi</label><button class="btn btn-primary" style="width:100%;padding:11px">Se connecter</button></form><div id="login-error" style="text-align:center;margin-top:12px;font-size:12px;color:#dc2626"></div></div></div>`;
  $('#login-form').onsubmit=async e=>{
    e.preventDefault(); const f=e.currentTarget; const btn=f.querySelector('button'); btn.disabled=true; btn.textContent='Connexion...';
    $('#login-error').textContent='';
    try{
      const r=await fetch('api/auth/login.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:f.user.value,password:f.pass.value})});
      const j=await r.json(); if(!r.ok||!j.success) throw new Error(j.message||'Connexion refusée.');
      state.logged=true;
      try{ const mr=await fetch('api/auth/me.php',{credentials:'same-origin'}); const mj=await mr.json(); if(mr.ok&&mj.success) state.currentUser=mj.data.user; }catch(e){}
      await loadAllData(); nav('dashboard');
    }catch(err){$('#login-error').textContent=err.message||'Connexion impossible.'; btn.disabled=false; btn.textContent='Se connecter';}
  };
}

function pageHead(title,sub,actions=''){return `<div class="page-head"><div><h1 class="page-title">${title}</h1>${sub?`<div class="page-subtitle">${sub}</div>`:''}</div><div class="actions">${actions}</div></div>`;}
function searchRow(placeholder, extra=''){return `<div class="card search-row"><div class="searchbox"><span class="search-icon">⌕</span><input class="input page-search" placeholder="${placeholder}" value="${esc(state.search)}"></div>${extra}</div>`;}
function bindSearch(){const x=$('.page-search');if(x)x.oninput=e=>{state.search=e.target.value;renderPageOnly();};}

function dashboardPage(){
  // ---------------------------------------------------------------------------
  // MODULE 12 : TABLEAU DE BORD DYNAMIQUE
  // Tous les chiffres ci-dessous viennent maintenant de MySQL via apiCache.
  // ---------------------------------------------------------------------------
  const products=store.get('products')||[];
  const sales=store.get('sales')||[];
  const purchases=store.get('purchases')||[];
  const customers=store.get('customers')||[];
  const cashTx=store.get('cashTransactions')||[];
  const moves=store.get('stockMovements')||[];
  const stats=store.get('dashboardStats')||{};
  const today=new Date();
  const isoToday=stats.today||today.toLocaleDateString('en-CA');
  const monthPrefix=String(isoToday).slice(0,7);
  const dateOnly=v=>String(v||'').slice(0,10);
  const salesTodayCount=Number(stats.salesTodayCount??0);
  const revenueToday=Number(stats.revenueToday??0);
  const salesCount=salesTodayCount;
  const purchaseTotal=Number(stats.purchasesMonthTotal??0);
  const stockTotal=Number(stats.stockUnits??products.reduce((a,x)=>a+Number(x.stock||0),0));
  const low=products.filter(p=>p.status==='Stock faible'||Number(p.stock||0)<=Number(p.minStock||0));
  const out=products.filter(p=>p.status==='Rupture'||Number(p.stock||0)<=0);
  const receivables=Number(stats.receivables??customers.reduce((a,x)=>a+Number(x.balance||0),0));
  const cashBalance=Number(stats.cashBalance??(cashTx.length?Number(cashTx[0].solde||cashTx[0].balance_after||0):0));
  const kpis=[
    ['↗',"Chiffre d'affaires aujourd'hui",fmt(revenueToday),salesCount+' vente(s)','#dcfce7','#16a34a'],
    ['▣','Ventes aujourd’hui',String(salesCount),'transactions','#dbeafe','#2563eb'],
    ['↙','Achats du mois',fmt(purchaseTotal),purchases.filter(p=>String(p.date||'').slice(0,7)===monthPrefix).length+' commande(s)','#f3e8ff','#7c3aed'],
    ['▣','Unités en stock',String(stockTotal),products.length+' références','#cffafe','#0891b2'],
    ['⚠','Stock faible',String(low.length),'à surveiller','#fef9c3','#d97706'],
    ['×','Rupture de stock',String(out.length),'produits','#fee2e2','#ef4444'],
    ['♙','Créances clients',fmt(receivables),customers.filter(c=>Number(c.balance||0)>0).length+' client(s)','#fce7f3','#db2777'],
    ['▤','Solde de caisse',fmt(cashBalance),'Caisse principale','#dcfce7','#16a34a']
  ];
  const recentSales=[...sales].sort((a,b)=>dateOnly(b.date).localeCompare(dateOnly(a.date))).slice(0,5);
  const recentMoves=[...moves].slice(0,8);
  return `<div class="page">
    ${pageHead('Tableau de bord',today.toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'}),`
      <button class="btn btn-primary" data-nav="pos">＋ Nouvelle vente</button><button class="btn btn-blue" data-nav="purchases">＋ Nouvel achat</button><button class="btn btn-purple" data-action="open-product">＋ Ajouter produit</button><button class="btn" style="background:#d97706;color:#fff" data-nav="stock">＋ Entrée de stock</button>`)}
    <div class="grid kpi-grid">${kpis.map(k=>`<div class="card kpi"><div class="kpi-icon" style="background:${k[4]};color:${k[5]}">${k[0]}</div><div><div class="kpi-label">${k[1]}</div><div class="kpi-value">${k[2]}</div><div class="kpi-sub">${k[3]}</div></div></div>`).join('')}</div>
    <div class="grid two-col">
      <div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px">Évolution des 7 derniers jours</b>${statusBadge('Actif')}</div>${simpleChart()}</div>
      <div class="card card-pad"><b style="font-size:15px">Ventes vs Achats</b>${barChart()}</div>
    </div>
    <div class="grid half-col">
      <div class="card"><div style="padding:15px 18px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between"><b style="font-size:15px">Ventes récentes</b><button style="color:#16a34a;font-size:12px" data-nav="sales">Voir tout →</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Réf.</th><th>Client</th><th>Montant</th><th>Statut</th></tr></thead><tbody>${recentSales.map(s=>`<tr><td class="mono">${esc(s.ref)}</td><td>${esc(s.customer)}</td><td class="text-right"><b>${fmt(s.total)}</b></td><td>${statusBadge(s.status)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-muted">Aucune vente enregistrée.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div style="padding:15px 18px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between"><b style="font-size:15px">Alertes de stock</b><button style="color:#16a34a;font-size:12px" data-nav="products">Voir tout →</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Produit</th><th>Stock</th><th>Min</th><th>Statut</th></tr></thead><tbody>${low.slice(0,8).map(p=>`<tr><td>${esc(p.name)}</td><td class="text-center"><b>${p.stock}</b></td><td class="text-center text-muted">${p.minStock}</td><td>${statusBadge(p.status)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-muted">Aucune alerte de stock.</td></tr>'}</tbody></table></div></div>
    </div>
    <div class="card"><div style="padding:15px 18px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between"><b style="font-size:15px">Mouvements de stock récents</b><button style="color:#16a34a;font-size:12px" data-nav="stock">Voir tout →</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Quantité</th><th>Nouveau stock</th></tr></thead><tbody>${recentMoves.map(m=>`<tr><td class="text-muted">${esc(m.date)}</td><td>${esc(m.product)}</td><td>${statusBadge(m.type)}</td><td class="text-center" style="font-weight:600;color:${Number(m.qty)>0?'#16a34a':'#ef4444'}">${Number(m.qty)>0?'↑':'↓'} ${Math.abs(Number(m.qty||0))}</td><td class="text-right"><b>${m.newStock}</b></td></tr>`).join('')||'<tr><td colspan="5" class="text-muted">Aucun mouvement récent.</td></tr>'}</tbody></table></div></div>
  </div>`;
}
function salesChartDataDynamic(){
  const sales=store.get('sales')||[], purchases=store.get('purchases')||[];
  const days=[]; const base=new Date(); base.setHours(0,0,0,0); base.setDate(base.getDate()-6);
  for(let i=0;i<7;i++){
    const d=new Date(base); d.setDate(base.getDate()+i); const iso=d.toISOString().slice(0,10);
    const ventes=sales.filter(x=>String(x.date||'').slice(0,10)===iso).reduce((a,x)=>a+Number(x.total||0),0);
    const achats=purchases.filter(x=>String(x.date||'').slice(0,10)===iso).reduce((a,x)=>a+Number(x.total||0),0);
    days.push({day:d.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.',''),ventes,achats});
  }
  return days;
}
function simpleChart(){const d=salesChartDataDynamic();const max=Math.max(1,...d.map(x=>Math.max(x.ventes,x.achats)));return `<div class="chart">${d.map(x=>`<div class="bar-wrap"><div class="bars"><div class="bar green" style="height:${x.ventes/max*155}px" title="${fmt(x.ventes)}"></div><div class="bar blue" style="height:${x.achats/max*155}px" title="${fmt(x.achats)}"></div></div><div class="bar-label">${x.day}</div></div>`).join('')}</div><div style="font-size:11px;color:#64748b;text-align:center">▰ Ventes &nbsp;&nbsp; ▰ Achats</div>`;}
function barChart(){const d=salesChartDataDynamic().slice(-4),max=Math.max(1,...d.map(x=>Math.max(x.ventes,x.achats)));return `<div class="chart">${d.map(x=>`<div class="bar-wrap"><div class="bars"><div class="bar green" style="height:${x.ventes/max*155}px"></div><div class="bar blue" style="height:${x.achats/max*155}px"></div></div><div class="bar-label">${x.day}</div></div>`).join('')}</div>`;}

function productsPage(){
  let items=store.get('products');const cats=store.get('categories'),sups=store.get('suppliers');
  items=items.filter(p=>[p.name,p.code,p.category,p.supplier].join(' ').toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="page">${pageHead('Produits','Gestion du catalogue et du stock',`<button class="btn btn-primary" data-action="open-product">＋ Nouveau produit</button>`)}
  ${searchRow('Code, nom, catégorie...',`<select class="input select" id="product-status"><option value="">Tous les statuts</option><option>En stock</option><option>Stock faible</option><option>Rupture</option></select><select class="input select" id="product-cat"><option value="">Toutes les catégories</option>${cats.map(c=>`<option>${esc(c.name)}</option>`).join('')}</select>`)}
  <div class="card table-wrap"><table class="table"><thead><tr><th>Code</th><th>Produit</th><th>Catégorie</th><th>Prix achat</th><th>Prix vente</th><th>Stock</th><th>Min</th><th>Unité</th><th>Fournisseur</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${items.map(p=>`<tr><td class="mono">${p.code}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.category)}</td><td>${fmt(p.purchasePrice)}</td><td><b>${fmt(p.salePrice)}</b></td><td class="text-center"><b>${p.stock}</b></td><td class="text-center text-muted">${p.minStock}</td><td>${p.unit}</td><td>${esc(p.supplier)}</td><td>${statusBadge(p.status)}</td><td><div class="actions"><button class="icon-btn" title="Voir" data-action="view-product" data-id="${p.id}">◉</button><button class="icon-btn" title="Modifier" data-action="edit-product" data-id="${p.id}">✎</button><button class="icon-btn" title="Supprimer" data-action="delete-product" data-id="${p.id}">♲</button></div></td></tr>`).join('')}</tbody></table></div>
  ${state.modal==='product'?productModal():state.modal==='view-product'?productView():state.modal==='delete-product'?deleteModal('produit','products'):''}</div>`;
}

function productModal(){
 const p=state.editId?store.get('products').find(x=>x.id===state.editId):{};
 const cats=store.get('categories'),sups=store.get('suppliers');
 return modal(state.editId?'Modifier le produit':'Nouveau produit',`<form id="product-form"><div class="form-grid">
 ${field('Code produit','code',p.code||'',false,'PRD-XXX')}${field('Nom du produit','name',p.name||'',true,'Nom du produit')}
 ${field('Prix d’achat ($)','purchasePrice',p.purchasePrice||0)}${field('Prix de vente ($)','salePrice',p.salePrice||0)}
 ${field('Stock initial','stock',p.stock||0)}${field('Stock minimum','minStock',p.minStock||0)}
 ${field('TVA (%)','tva',p.tva||18)}${field('Unité','unit',p.unit||'Pcs')}
 <div class="form-field"><label class="form-label">Statut du produit</label><select class="input" name="dbStatus"><option ${p.dbStatus!=='Inactif'?'selected':''}>Actif</option><option ${p.dbStatus==='Inactif'?'selected':''}>Inactif</option></select></div>
 <div class="form-field"><label class="form-label">Catégorie</label><select class="input" name="category">${cats.map(c=>`<option ${p.category===c.name?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
 <div class="form-field"><label class="form-label">Fournisseur</label><select class="input" name="supplier"><option value="">Sélectionner...</option>${sups.map(s=>`<option ${p.supplier===s.name?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
 <div class="form-field full"><label class="form-label">Description</label><textarea class="input textarea" name="description">${esc(p.description||'')}</textarea></div></div></form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-product">Enregistrer</button>`);
}
function productView(){const p=store.get('products').find(x=>x.id===state.view);return modal('Détails du produit',`<div style="font-size:18px;font-weight:700;margin-bottom:12px">${esc(p.name)} ${statusBadge(p.status)}</div>${[['Code',p.code],['Catégorie',p.category],['Fournisseur',p.supplier],['Unité',p.unit],['Prix d’achat',fmt(p.purchasePrice)],['Prix de vente',fmt(p.salePrice)],['Stock actuel',p.stock],['Stock minimum',p.minStock]].map(x=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span class="text-muted">${x[0]}</span><b>${x[1]}</b></div>`).join('')}`,'<button class="btn btn-primary" data-action="close-modal">Fermer</button>');}
function field(label,name,value,full=false,placeholder=''){return `<div class="form-field ${full?'full':''}"><label class="form-label">${label}</label><input class="input" name="${name}" value="${esc(value)}" placeholder="${placeholder}"></div>`;}
function deleteModal(entity,key){return modal(`Supprimer le ${entity} ?`,`<p style="color:#64748b;font-size:13px">Cette action est irréversible. Le ${entity} sera définitivement supprimé.</p>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-danger" data-action="confirm-delete" data-key="${key}">Supprimer</button>`);}

function simpleCrudPage(type,title,fields,cols,rows,buttonLabel,searchPlaceholder){
 let items=store.get(type).filter(x=>fields.some(f=>String(x[f.key]??'').toLowerCase().includes(state.search.toLowerCase())));
 return `<div class="page">${pageHead(title,'Gestion et administration',`<button class="btn btn-primary" data-action="open-${type}">＋ ${buttonLabel}</button>`)}
 ${searchRow(searchPlaceholder||'Rechercher...', '')}
 <div class="card table-wrap"><table class="table"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${items.map(x=>`<tr>${fields.map(f=>`<td>${f.render?f.render(x):esc(x[f.key])}</td>`).join('')}<td><button class="icon-btn" data-action="edit-${type}" data-id="${x.id}">✎</button><button class="icon-btn" data-action="delete-${type}" data-id="${x.id}">♲</button></td></tr>`).join('')}</tbody></table></div>
 ${state.modal===type?(type==='users'?userModal():type==='categories'?categoryModal():type==='suppliers'?supplierModal():type==='customers'?customerModal():genericModal(type,title,fields)):state.modal==='delete-'+type?deleteModal(type.slice(0,-1)||type,type):''}</div>`;
}

function genericModal(type,title,fields){
 const item=state.editId?store.get(type).find(x=>x.id===state.editId):{};
 return modal(state.editId?'Modifier':'Nouveau',`<form id="generic-form"><div class="form-grid">${fields.map(f=>field(f.label,f.key,item[f.key]??'',f.full||false,f.placeholder||'')).join('')}</div></form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-${type}">Enregistrer</button>`);
}
function categoryModal(){
 const item=state.editId?store.get('categories').find(x=>x.id===state.editId):{};
 const status=item.status||'Actif';
 return modal(state.editId?'Modifier la catégorie':'Nouvelle catégorie',`<form id="category-form">
   <div class="form-grid">
     ${field('Nom de catégorie','name',item.name||'',false,'Ex. Boissons')}
     ${field('Description','description',item.description||'',true,'Description de la catégorie')}
     <div class="form-field"><label class="form-label">Statut</label><select class="input" name="status"><option value="Actif" ${status==='Actif'?'selected':''}>Actif</option><option value="Inactif" ${status==='Inactif'?'selected':''}>Inactif</option></select></div>
   </div>
 </form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-categories">Enregistrer</button>`);
}
function categoriesPage(){const f=[{key:'name',label:'Nom',render:x=>`<b>${esc(x.name)}</b>`},{key:'description',label:'Description'},{key:'products',label:'Produits',render:x=>x.products},{key:'status',label:'Statut',render:x=>statusBadge(x.status)}];return simpleCrudPage('categories','Catégories',f,['Nom','Description','Produits','Statut'],null,'Nouvelle catégorie','Nom de catégorie...');}
function suppliersPage(){
 const items=store.get('suppliers').filter(x=>[x.name,x.contact,x.phone,x.email,x.status].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 return `<div class="page">${pageHead('Fournisseurs','Gestion et administration',`<button class="btn btn-primary" data-action="open-suppliers">＋ Nouveau fournisseur</button>`)}
 ${searchRow('Nom, contact, téléphone...')}<div class="card table-wrap"><table class="table"><thead><tr><th>Fournisseur</th><th>Contact</th><th>Téléphone</th><th>Email</th><th>Achats</th><th>Total</th><th>Solde</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${items.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.contact||'')}</td><td>${esc(x.phone||'')}</td><td>${esc(x.email||'')}</td><td>${x.purchases||0}</td><td>${fmt(x.total)}</td><td style="color:${Number(x.balance)>0?'#ef4444':''}">${fmt(x.balance)}</td><td>${statusBadge(x.status)}</td><td><div class="actions"><button class="icon-btn" title="Historique du fournisseur" data-action="view-supplier-history" data-id="${x.id}">◉</button><button class="icon-btn" title="Modifier" data-action="edit-suppliers" data-id="${x.id}">✎</button><button class="icon-btn" title="Supprimer" data-action="delete-suppliers" data-id="${x.id}">♲</button></div></td></tr>`).join('')}</tbody></table></div>
 ${state.modal==='suppliers'?supplierModal():state.modal==='delete-suppliers'?deleteModal('fournisseur','suppliers'):state.modal==='supplier-history'?supplierHistoryModal():''}</div>`;
}
function supplierModal(){
 const item=state.editId?store.get('suppliers').find(x=>x.id===state.editId):{};
 const status=item.status||'Actif';
 return modal(state.editId?'Modifier le fournisseur':'Nouveau fournisseur',`<form id="supplier-form">
   <div class="form-grid">
     ${field('Nom du fournisseur','name',item.name||'',false,'Ex. ABC Distribution')}
     ${field('Contact','contact',item.contact||'',false,'Nom du responsable')}
     ${field('Téléphone','phone',item.phone||'',false,'Numéro de téléphone')}
     ${field('Email','email',item.email||'',false,'Adresse e-mail')}
     ${field('Adresse','address',item.address||'',true,'Adresse du fournisseur')}
     <div class="form-field"><label class="form-label">Statut</label><select class="input" name="status"><option value="Actif" ${status==='Actif'?'selected':''}>Actif</option><option value="Inactif" ${status==='Inactif'?'selected':''}>Inactif</option></select></div>
   </div>
 </form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-suppliers">Enregistrer</button>`);
}

function customersPage(){
 const items=store.get('customers').filter(x=>[x.code,x.name,x.phone,x.email,x.status].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 return `<div class="page">${pageHead('Clients','Gestion et administration',`<button class="btn btn-primary" data-action="open-customers">＋ Nouveau client</button>`)}
 ${searchRow('Code, nom, téléphone, email...')}
 <div class="card table-wrap"><table class="table"><thead><tr><th>Code</th><th>Client</th><th>Téléphone</th><th>Email</th><th>Achats</th><th>Payé</th><th>Solde</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${items.map(x=>`<tr><td class="mono">${esc(x.code||'')}</td><td><b>${esc(x.name)}</b></td><td>${esc(x.phone||'')}</td><td>${esc(x.email||'')}</td><td>${fmt(x.totalPurchases)}</td><td>${fmt(x.paid)}</td><td style="color:${Number(x.balance)>0?'#ef4444':''}">${fmt(x.balance)}</td><td>${statusBadge(x.status)}</td><td><div class="actions"><button class="icon-btn" title="Historique du client" data-action="view-customer-history" data-id="${x.id}">◉</button><button class="icon-btn" title="Modifier" data-action="edit-customers" data-id="${x.id}">✎</button><button class="icon-btn" title="Supprimer" data-action="delete-customers" data-id="${x.id}">♲</button></div></td></tr>`).join('')}</tbody></table></div>
 ${state.modal==='customers'?customerModal():state.modal==='delete-customers'?deleteModal('client','customers'):state.modal==='customer-history'?customerHistoryModal():''}</div>`;
}

function historyMoney(v){return fmt(Number(v)||0);}
function customerHistoryModal(){const c=store.get('customers').find(x=>x.id===state.view);if(!c)return '';const box=modal('Historique du client',`<div id="customer-history-content" class="text-muted" style="font-size:12px">Chargement de l’historique...</div>`,`<button class="btn btn-secondary" data-action="close-modal">Fermer</button><button class="btn btn-primary" data-action="print-customer-history">⎙ Imprimer</button>`);setTimeout(()=>loadHistoryIntoModal('customer',c.id),0);return box;}
function supplierHistoryModal(){const s=store.get('suppliers').find(x=>x.id===state.view);if(!s)return '';const box=modal('Historique du fournisseur',`<div id="supplier-history-content" class="text-muted" style="font-size:12px">Chargement de l’historique...</div>`,`<button class="btn btn-secondary" data-action="close-modal">Fermer</button><button class="btn btn-primary" data-action="print-supplier-history">⎙ Imprimer</button>`);setTimeout(()=>loadHistoryIntoModal('supplier',s.id),0);return box;}
async function loadHistoryIntoModal(type,id){const target=type==='customer'?'#customer-history-content':'#supplier-history-content';try{const r=await fetch(`api/history.php?type=${type}&id=${id}`,{credentials:'same-origin'});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Historique indisponible.');const d=j.data;const summary=d.summary||{};const rows=d.rows||[];$(target).innerHTML=`<div class="grid four-col" style="margin-bottom:14px">${[['Opérations',summary.operations||0],['Total',historyMoney(summary.total)],['Payé',historyMoney(summary.paid)],['Solde',historyMoney(summary.balance)]].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('')}</div><div class="card table-wrap"><table class="table"><thead><tr><th>Date</th><th>Référence</th><th>Type</th><th>Total</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${esc(x.date)}</td><td class="mono">${esc(x.reference)}</td><td>${esc(x.type)}</td><td>${historyMoney(x.total)}</td><td>${historyMoney(x.paid)}</td><td style="color:${Number(x.remaining)>0?'#ef4444':''}">${historyMoney(x.remaining)}</td><td>${statusBadge(x.status)}</td></tr>`).join(''):`<tr><td colspan="7" class="empty">Aucune opération trouvée.</td></tr>`}</tbody></table></div>`;state.historyData={type,id,data:d};}catch(err){$(target).innerHTML=`<div style="color:#dc2626">${esc(err.message)}</div>`;}}
function printHistory(type){const h=state.historyData;if(!h||h.type!==type)return toast('Veuillez attendre le chargement de l’historique.');const d=h.data,title=type==='customer'?'RELEVÉ CLIENT':'RELEVÉ FOURNISSEUR',entity=d.entity||{},rows=d.rows||[],company=d.settings||{};const win=window.open('','_blank','width=900,height=700');if(!win)return toast('Autorisez les fenêtres contextuelles pour imprimer.');const escP=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial;color:#111;font-size:12px}h1{font-size:21px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px}.box{border:1px solid #ccc;padding:10px;margin:15px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:7px}th{background:#f2f2f2;text-align:left}.num{text-align:right}.no-print{margin-top:18px;padding:8px 12px}@media print{.no-print{display:none}}</style></head><body><div class="head"><div><h1>${escP(company.company||'GESTOCK PRO')}</h1><div>${escP(company.address||'')}</div><div>${escP(company.phone||'')}</div><div>${escP(company.email||'')}</div></div><div><h2>${title}</h2><div>Date : ${escP(new Date().toLocaleString('fr-FR'))}</div></div></div><div class="box"><b>${type==='customer'?'Client':'Fournisseur'} :</b> ${escP(entity.name||'')}</div><table><thead><tr><th>Date</th><th>Référence</th><th>Type</th><th>Total</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escP(x.date)}</td><td>${escP(x.reference)}</td><td>${escP(x.type)}</td><td class="num">${escP(historyMoney(x.total))}</td><td class="num">${escP(historyMoney(x.paid))}</td><td class="num">${escP(historyMoney(x.remaining))}</td><td>${escP(x.status)}</td></tr>`).join('')}</tbody></table><div class="box"><b>Total :</b> ${escP(historyMoney(d.summary.total))} &nbsp; <b>Payé :</b> ${escP(historyMoney(d.summary.paid))} &nbsp; <b>Solde :</b> ${escP(historyMoney(d.summary.balance))}</div><button class="no-print" onclick="window.print()">Imprimer</button></body></html>`);win.document.close();win.focus();setTimeout(()=>win.print(),250);}

// Formulaire spécial des clients.
// Le code client est généré automatiquement par PHP/MySQL lors de l'ajout.
// Les colonnes Achats, Payé et Solde sont calculées à partir des ventes :
// elles ne doivent donc jamais être saisies manuellement dans ce formulaire.
function customerModal(){
 const item=state.editId?store.get('customers').find(x=>x.id===state.editId):{};
 const status=item.status||'Actif';
 return modal(state.editId?'Modifier le client':'Nouveau client',`<form id="customer-form">
   <div class="form-grid">
     ${field('Nom du client','name',item.name||'',false,'Nom complet du client')}
     ${field('Téléphone','phone',item.phone||'',false,'Numéro de téléphone')}
     ${field('Email','email',item.email||'',false,'Adresse e-mail')}
     ${field('Adresse','address',item.address||'',true,'Adresse du client')}
     <div class="form-field"><label class="form-label">Statut</label><select class="input" name="status"><option value="Actif" ${status==='Actif'?'selected':''}>Actif</option><option value="Inactif" ${status==='Inactif'?'selected':''}>Inactif</option></select></div>
   </div>
 </form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-customers">Enregistrer</button>`);
}
function usersPage(){ if(!canAccess('users')) return `<div class="page">${pageHead('Accès refusé','Votre rôle ne permet pas de gérer les utilisateurs.')}</div>`;const f=[{key:'name',label:'Nom',render:x=>`<b>${esc(x.name)}</b>`},{key:'email',label:'Email'},{key:'username',label:'Identifiant'},{key:'role',label:'Rôle',render:x=>statusBadge(x.role)},{key:'status',label:'Statut',render:x=>statusBadge(x.status)},{key:'lastLogin',label:'Dernière connexion'}];return simpleCrudPage('users','Utilisateurs',f,['Nom','Email','Identifiant','Rôle','Statut','Dernière connexion'],null,'Nouvel utilisateur','Nom, email, identifiant...');}

// Formulaire spécial des utilisateurs.
// Nous le séparons du formulaire générique parce qu'un utilisateur possède
// un mot de passe qui doit être envoyé à PHP pour être haché avant stockage.
function userModal(){
 const item=state.editId?store.get('users').find(x=>x.id===state.editId):{};
 const roles=['Administrateur','Caissier','Gérant','Gestionnaire de stock'];
 const role=item.role||'Administrateur';
 const status=item.status||'Actif';
 return modal(state.editId?'Modifier l’utilisateur':'Nouvel utilisateur',`<form id="user-form">
   <div class="form-grid">
     ${field('Nom','name',item.name||'')}
     ${field('Email','email',item.email||'')}
     ${field('Identifiant','username',item.username||'')}
     <div class="form-field"><label class="form-label">Mot de passe${state.editId?' <span style="font-weight:400;color:#94a3b8">(laisser vide pour conserver)</span>':''}</label><input class="input" name="password" type="password" value="" placeholder="${state.editId?'Nouveau mot de passe':'Mot de passe'}" ${state.editId?'':'required'} minlength="4"></div>
     <div class="form-field"><label class="form-label">Rôle</label><select class="input" name="role">${roles.map(r=>`<option value="${esc(r)}" ${r===role?'selected':''}>${esc(r)}</option>`).join('')}</select></div>
     <div class="form-field"><label class="form-label">Statut</label><select class="input" name="status"><option value="Actif" ${status==='Actif'?'selected':''}>Actif</option><option value="Inactif" ${status==='Inactif'?'selected':''}>Inactif</option></select></div>
   </div>
 </form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-user">Enregistrer</button>`);
}

function purchasesPage(){
 const items=store.get('purchases').filter(x=>[x.ref,x.supplier,x.status].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 return `<div class="page">${pageHead('Achats','Commandes et approvisionnements',`<button class="btn btn-primary" data-action="new-purchase">＋ Nouvel achat</button>`)}
 ${searchRow('Référence, fournisseur...')}<div class="card table-wrap"><table class="table"><thead><tr><th>Référence</th><th>Date</th><th>Fournisseur</th><th>Articles</th><th>Total</th><th>Payé</th><th>Reste</th><th>Statut</th><th>Utilisateur</th><th>Actions</th></tr></thead><tbody>${items.map(p=>`<tr><td class="mono">${p.ref}</td><td>${p.date}</td><td>${esc(p.supplier)}</td><td class="text-center">${p.items}</td><td><b>${fmt(p.total)}</b></td><td style="color:#16a34a">${fmt(p.paid)}</td><td style="color:${p.remaining?'#ef4444':'#94a3b8'}">${fmt(p.remaining)}</td><td>${statusBadge(p.status)}</td><td>${p.user}</td><td><div class="actions"><button class="icon-btn" title="Voir" data-action="view-purchase" data-id="${p.id}">◉</button><button class="btn btn-secondary" title="Imprimer le bon d’achat" data-action="print-purchase" data-id="${p.id}">⎙ Imprimer</button><button class="icon-btn" title="Modifier" data-purchase-action="edit" data-id="${p.id}">✎</button><button class="icon-btn" title="Supprimer" data-purchase-action="delete" data-id="${p.id}">♲</button></div></td></tr>`).join('')}</tbody></table></div>
 ${state.modal==='purchase'?purchaseModal():state.modal==='purchase-view'?purchaseView():state.modal==='purchase-delete'?purchaseDeleteModal():''}</div>`;
}
function purchaseModal(){
 const p=state.editId?store.get('purchases').find(x=>x.id===state.editId):null;
 const suppliers=store.get('suppliers'); const products=store.get('products');
 const selectedSupplier=p?p.supplier:(suppliers[0]?.name||'');
 const selectedProduct=p?(p.product||products[0]?.name):(products[0]?.name||'');
 const qty=p?(p.qty||1):10, price=p?(p.price||0):18500;
 const title=p?'Modifier achat':'Nouvel achat';
 return modal(title,`<form id="purchase-form"><div class="form-grid">${field('Référence','ref',p?p.ref:'')}${field('Date','date',p?p.date:new Date().toISOString().slice(0,10))}<div class="form-field full"><label class="form-label">Fournisseur</label><select class="input" name="supplier">${suppliers.map(s=>`<option ${s.name===selectedSupplier?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="form-field full"><label class="form-label">Produit</label><select class="input" name="product">${products.map(x=>`<option ${x.name===selectedProduct?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>${field('Quantité','qty',qty)}${field('Prix d’achat','price',price)}${field('Montant payé','paid',p?0:0)}</div><div class="card card-pad" style="margin-top:15px;background:#f8fafc"><b>Total : ${fmt(qty*price)}</b><div class="text-muted" style="font-size:11px;margin-top:4px">Pour une modification, le montant payé doit rester nul afin de préserver l’historique financier.</div></div></form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-purchase">${p?'Enregistrer les modifications':'Enregistrer l’achat'}</button>`);
}
function purchaseView(){const p=store.get('purchases').find(x=>x.id===state.view);if(!p)return '';return modal('Détails achat',`<div style="display:flex;justify-content:space-between;margin-bottom:10px"><b class="mono">${esc(p.ref)}</b>${statusBadge(p.status)}</div>${[['Fournisseur',p.supplier],['Date',p.date],['Articles',p.items],['Total',fmt(p.total)],['Payé',fmt(p.paid)],['Reste',fmt(p.remaining)],['Utilisateur',p.user]].map(x=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span class="text-muted">${x[0]}</span><b>${esc(String(x[1]))}</b></div>`).join('')}`,`<button class="btn btn-secondary" data-action="print-purchase" data-id="${p.id}">⎙ Imprimer</button><button class="btn btn-primary" data-action="close-modal">Fermer</button>`);}
function purchaseDeleteModal(){const p=store.get('purchases').find(x=>x.id===state.deleteId);return modal('Supprimer achat',`<p>Voulez-vous vraiment supprimer l’achat <b>${p?esc(p.ref):''}</b> ?</p><p class="text-muted" style="font-size:12px">Le stock sera automatiquement rétabli. Si l’achat possède déjà un paiement, la suppression sera refusée pour protéger l’historique financier.</p>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-danger" data-action="confirm-delete-purchase" data-id="${state.deleteId}">Supprimer</button>`);}

function salesPage(){
 const allSales=store.get('sales');
 const today=new Date();
 const todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 // Les indicateurs du haut correspondent uniquement aux ventes réalisées aujourd'hui.
 // Une vente annulée n'est pas comptabilisée.
 const todaySales=allSales.filter(s=>String(s.date||'').slice(0,10)===todayKey && String(s.status||'').toLowerCase()!=='annulé' && String(s.status||'').toLowerCase()!=='annule');
 const todayTotal=todaySales.reduce((sum,s)=>sum+Number(s.total||0),0);
 const todayCount=todaySales.length;
 const todayAverage=todayCount ? todayTotal/todayCount : 0;
 // La créance de la journée = somme des montants restant à payer sur les ventes d'aujourd'hui.
 const todayReceivable=todaySales.reduce((sum,s)=>sum+Number(s.remaining||0),0);
 const items=allSales.filter(x=>[x.ref,x.customer,x.status].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 return `<div class="page">${pageHead('Ventes','Historique des ventes',`<button class="btn btn-primary" data-nav="pos">＋ Nouvelle vente</button>`)}
 <div class="grid four-col">${[['Ventes aujourd’hui',fmt(todayTotal),'#16a34a'],['Nombre de ventes',String(todayCount),'#2563eb'],['Panier moyen',fmt(todayAverage),'#7c3aed'],['Créances',fmt(todayReceivable),'#ef4444']].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value" style="color:${x[2]}">${x[1]}</div></div>`).join('')}</div>
 ${searchRow('Référence, client...','<select class="input select" id="sales-status"><option value="">Tous les statuts</option><option>Payé</option><option>Partiellement payé</option><option>Non payé</option></select>')}
 <div class="card table-wrap"><table class="table"><thead><tr><th>Référence</th><th>Date</th><th>Client</th><th>Articles</th><th>Total</th><th>Payé</th><th>Reste</th><th>Mode</th><th>Statut</th><th>Caissier</th><th>Actions</th></tr></thead><tbody>${items.map(s=>`<tr><td class="mono">${s.ref}</td><td>${s.date}</td><td>${esc(s.customer)}</td><td class="text-center">${s.items}</td><td><b>${fmt(s.total)}</b></td><td style="color:#16a34a">${fmt(s.paid)}</td><td style="color:${s.remaining?'#ef4444':'#94a3b8'}">${fmt(s.remaining)}</td><td>${statusBadge(s.method)}</td><td>${statusBadge(s.status)}</td><td>${s.cashier}</td><td><button class="icon-btn" title="Voir" data-action="view-sale" data-id="${s.id}">◉</button><button class="icon-btn" title="Imprimer facture / reçu" data-action="print-sale" data-id="${s.id}">⎙</button></td></tr>`).join('')}</tbody></table></div>
 ${state.modal==='sale'?saleView():''}</div>`;
}
function saleView(){const s=store.get('sales').find(x=>x.id===state.view);return modal('Détails vente',`<div style="display:flex;justify-content:space-between;margin-bottom:10px"><b class="mono">${s.ref}</b>${statusBadge(s.status)}</div>${[['Client',s.customer],['Date',s.date],['Articles',s.items],['Total',fmt(s.total)],['Payé',fmt(s.paid)],['Reste',fmt(s.remaining)],['Mode de paiement',s.method],['Caissier',s.cashier]].map(x=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span class="text-muted">${x[0]}</span><b>${x[1]}</b></div>`).join('')}`,`<button class="btn btn-secondary" data-action="print-sale" data-id="${s.id}">⎙ Imprimer</button><button class="btn btn-primary" data-action="close-modal">Fermer</button>`);}

function posPage(){
 const products=store.get('products'), customers=store.get('customers');
 const cats=['Toutes',...new Set(products.map(p=>p.category))];
 const filtered=products.filter(p=>(p.name+' '+p.code).toLowerCase().includes(state.search.toLowerCase())&&(state.cat===''||state.cat==='Toutes'||p.category===state.cat));
 const subtotal=state.cart.reduce((a,c)=>a+c.price*c.qty,0),tva=subtotal*.18,total=subtotal-state.discount+tva,change=Number(state.received||0)-total;
 return `<div class="pos"><section class="pos-products"><div class="pos-head"><h1 style="font-size:18px;margin:0 0 12px">Point de Vente</h1><div class="searchbox"><span class="search-icon">⌕</span><input id="pos-search" class="input" placeholder="Rechercher un produit ou scanner un code..." value="${esc(state.search)}"></div><div class="cat-pills">${cats.map(c=>`<button class="pill ${state.cat===(c==='Toutes'?'':c)?'active':''}" data-action="pos-cat" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div></div><div class="product-grid">${filtered.map(p=>`<button class="card product-card" data-action="add-cart" data-id="${p.id}" ${p.stock===0?'disabled':''}><div class="product-emoji">📦</div><div class="product-name">${esc(p.name)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span class="product-price">${fmt(p.salePrice)}</span><span class="product-stock">🔢 ${p.stock}</span></div></button>`).join('')}</div></section>
 <aside class="pos-cart"><div class="cart-head"><span style="font-size:17px">🛒</span><b>Panier</b><span class="badge badge-green" style="margin-left:auto">${state.cart.length} article(s)</span></div><div style="padding:9px 14px;border-bottom:1px solid #f1f5f9"><select class="input" id="pos-customer"><option>Comptant</option>${customers.map(c=>`<option ${state.customer===c.name?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="cart-body">${state.cart.length?state.cart.map(c=>`<div class="card cart-item"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:12px">${esc(c.name)}</b><button data-action="remove-cart" data-id="${c.id}">✕</button></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><div class="qty"><button data-action="qty-minus" data-id="${c.id}">−</button><b>${c.qty}</b><button data-action="qty-plus" data-id="${c.id}">＋</button></div><span class="text-muted" style="font-size:11px">${fmt(c.price)}/u</span><b style="font-size:12px">${fmt(c.price*c.qty)}</b></div></div>`).join(''):'<div class="empty">🛒<br>Panier vide</div>'}</div>
 <div class="cart-foot"><div class="total-row"><span class="text-muted">Sous-total</span><b>${fmt(subtotal)}</b></div><div class="total-row"><span class="text-muted">Remise ($)</span><input id="pos-discount" type="number" class="input" style="width:100px;padding:5px;text-align:right" value="${state.discount}"></div><div class="total-row"><span class="text-muted">TVA (18%)</span><b>${fmt(tva)}</b></div><div class="total-row total-main"><span>TOTAL À PAYER</span><strong>${fmt(total)}</strong></div><div class="payment-grid">${['Espèces','Mobile Money','Carte bancaire','Virement'].map(m=>`<button class="payment-btn ${state.method===m?'active':''}" data-action="payment" data-method="${m}">${m}</button>`).join('')}</div><div class="grid half-col"><div><label class="form-label">Montant reçu</label><input id="pos-received" class="input" type="number" value="${state.received}" placeholder="0"></div><div><label class="form-label">Monnaie à rendre</label><div class="input" style="font-weight:700;color:${change>=0?'#16a34a':'#ef4444'}">${state.received?fmt(Math.max(0,change)):'—'}</div></div></div><button class="btn btn-primary" style="width:100%;margin-top:10px" data-action="validate-sale" ${!state.cart.length?'disabled':''}>✓ Valider la vente</button><div style="display:flex;gap:7px;margin-top:7px"><button class="btn btn-secondary" style="flex:1" data-action="hold-sale">Mettre en attente</button><button class="btn btn-secondary" style="flex:1;color:#ef4444" data-action="clear-cart">Annuler</button></div></div></aside>
 ${state.modal==='receipt'?receiptModal(total,tva,subtotal,change):''}</div>`;
}
function receiptModal(total,tva,subtotal,change){const ref=state.saleRef||('VTE-'+new Date().getFullYear()+'-'+String(Math.floor(Math.random()*900)+100));return modal('Reçu de vente',`<div class="card-pad" style="font-family:'JetBrains Mono',monospace;font-size:11px;border:1px dashed #cbd5e1"><div style="text-align:center"><b style="font-size:16px">GESTOCK PRO</b><div class="text-muted">123 Avenue Principale</div><div class="text-muted">Tél: +243 000 000 000</div></div><hr>${ref}<br>${new Date().toLocaleString('fr-FR')}<br>Client: ${esc(state.customer)}<hr>${state.cart.map(c=>`<div style="display:flex;justify-content:space-between"><span>${esc(c.name)}</span><span>${c.qty}×${fmt(c.price)}</span></div>`).join('')}<hr><div style="display:flex;justify-content:space-between"><span>Sous-total</span><span>${fmt(subtotal)}</span></div><div style="display:flex;justify-content:space-between"><span>TVA 18%</span><span>${fmt(tva)}</span></div><div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px"><span>TOTAL</span><span>${fmt(total)}</span></div><div style="display:flex;justify-content:space-between"><span>Reçu</span><span>${fmt(Number(state.received)||total)}</span></div><div style="display:flex;justify-content:space-between"><span>Monnaie</span><span>${fmt(Math.max(0,change))}</span></div><div style="text-align:center;color:#16a34a;margin-top:10px">Merci pour votre achat !</div></div>`,`<button class="btn btn-secondary" onclick="window.print()">⎙ Imprimer</button><button class="btn btn-primary" data-action="new-sale">Nouvelle vente</button>`);}

function cashPage(){
 const tx=store.get('cashTransactions');
 const balance=tx.length?Number(tx[0].solde||0):0;
 const today=new Date().toISOString().slice(0,10);
 const todayTx=tx.filter(x=>String(x.date||'').slice(0,10)===today);
 const entries=todayTx.reduce((a,x)=>a+Number(x.entree||0),0);
 const exits=todayTx.reduce((a,x)=>a+Number(x.sortie||0),0);
 return `<div class="page">${pageHead('Caisse','Gestion réelle des entrées, sorties et clôtures de caisse',`<button class="btn btn-primary" data-action="cash-in">＋ Nouvelle entrée</button><button class="btn btn-danger" data-action="cash-out">＋ Nouvelle sortie</button>`)}
 <div class="grid four-col">${[['Solde actuel',fmt(balance),'#16a34a'],['Entrées du jour',fmt(entries),'#2563eb'],['Sorties du jour',fmt(exits),'#ef4444'],['Ventes encaissées',fmt(todayTx.filter(x=>String(x.type).toLowerCase()==='vente').reduce((a,x)=>a+Number(x.entree||0),0)),'#7c3aed']].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value" style="color:${x[2]}">${x[1]}</div></div>`).join('')}</div>
 <div class="card table-wrap"><table class="table"><thead><tr><th>Date</th><th>Référence</th><th>Type</th><th>Description</th><th>Entrée</th><th>Sortie</th><th>Solde</th><th>Utilisateur</th><th>Actions</th></tr></thead><tbody>${tx.map(x=>{const manual=!x.sale_id&&!x.purchase_id;return `<tr><td>${x.date}</td><td class="mono">${x.ref}</td><td>${statusBadge(x.type)}</td><td>${esc(x.description)}</td><td style="color:#16a34a">${x.entree?fmt(x.entree):'—'}</td><td style="color:#ef4444">${x.sortie?fmt(x.sortie):'—'}</td><td><b>${fmt(x.solde)}</b></td><td>${esc(x.user)}</td><td>${manual?`<button type="button" class="icon-btn" title="Modifier" onclick="window.gestockEditCash(${Number(x.id)||0})">✎</button><button type="button" class="icon-btn" title="Supprimer" style="color:#ef4444" onclick="window.gestockDeleteCash(${Number(x.id)||0})">🗑</button>`:'<span class="text-muted" style="font-size:11px">Liée à une opération</span>'}</td></tr>`}).join('')}</tbody></table></div>
 <div class="card card-pad"><h3 style="margin-top:0">Clôture de caisse</h3><div class="grid three-col"><div><label class="form-label">Solde théorique</label><input class="input" value="${balance}" readonly></div><div><label class="form-label">Argent compté</label><input class="input" id="cash-count" type="number" value="${balance}"></div><div><label class="form-label">Écart</label><input class="input" id="cash-gap" value="0" readonly></div></div><button class="btn btn-primary" style="margin-top:12px" data-action="close-cash">Clôturer la caisse</button></div>
 ${state.modal==='cash-entry'?cashEntryModal(state.cashDirection||'ENTREE'):''}${state.modal==='cash-edit'?cashEditModal(store.get('cashTransactions').find(x=>Number(x.id)===Number(state.cashId))||{}):''}${state.modal==='cash-close'?cashCloseModal(balance):''}</div>`;
}
function cashEntryModal(direction){
 const title=direction==='SORTIE'?'Nouvelle sortie de caisse':'Nouvelle entrée de caisse';
 const typeLabel=direction==='SORTIE'?'Dépense / sortie':'Entrée';
 return modal(title,`<form id="cash-form"><input type="hidden" name="direction" value="${direction}"><div class="form-grid">${field('Montant','amount','',true)}${field('Description','description','',true)}${field('Mode de paiement','method','Espèces')} </div><p class="text-muted" style="font-size:11px;margin-top:10px">${typeLabel} enregistrée directement dans MySQL et prise en compte dans le solde de caisse.</p></form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-cash">Enregistrer</button>`);
}
function cashEditModal(item){
 const direction=item.direction==='SORTIE'?'SORTIE':'ENTREE';
 return modal('Modifier le mouvement de caisse',`<form id="cash-edit-form"><input type="hidden" name="id" value="${item.id}"><input type="hidden" name="direction" value="${direction}"><div class="form-grid">${field('Montant','amount',item.amount,true)}${field('Description','description',item.description||'',true)}${field('Mode de paiement','method',item.payment_method||'ESPECES')} </div><p class="text-muted" style="font-size:11px;margin-top:10px">La modification recalculera automatiquement les soldes des mouvements suivants.</p></form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="update-cash">Enregistrer les modifications</button>`);
}
window.gestockEditCash = function(id){
  const item=store.get('cashTransactions').find(x=>Number(x.id)===Number(id));
  if(!item){toast('Mouvement de caisse introuvable.');return;}
  state.cashId=Number(id);
  state.modal='cash-edit';
  renderPageOnly();
};

window.gestockDeleteCash = async function(id){
  if(!id){toast('Identifiant du mouvement invalide.');return;}
  if(!confirm('Supprimer ce mouvement de caisse ? Cette action recalculera le solde des mouvements suivants.')) return;
  try{
    const r=await fetch('api/data.php?entity=cash&action=deleteCash',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(id)})});
    const j=await r.json();
    if(!r.ok||!j.success) throw new Error(j.message||'Erreur lors de la suppression.');
    state.modal=null;
    toast('Mouvement de caisse supprimé.');
    await refreshData();
  }catch(err){apiError(err);}
};

window.gestockEditCash = function(id){
  const item=store.get('cashTransactions').find(x=>Number(x.id)===Number(id));
  if(!item){toast('Mouvement de caisse introuvable.');return;}
  state.cashId=Number(id);
  state.modal='cash-edit';
  renderPageOnly();
};

window.gestockDeleteCash = async function(id){
  if(!id){toast('Identifiant du mouvement invalide.');return;}
  if(!confirm('Supprimer ce mouvement de caisse ? Cette action recalculera le solde des mouvements suivants.')) return;
  try{
    const r=await fetch('api/data.php?entity=cash&action=deleteCash',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(id)})});
    const j=await r.json();
    if(!r.ok||!j.success) throw new Error(j.message||'Erreur lors de la suppression.');
    state.modal=null;
    toast('Mouvement de caisse supprimé.');
    await refreshData();
  }catch(err){apiError(err);}
};

function cashCloseModal(balance){
 return modal('Clôturer la caisse',`<form id="cash-close-form"><div class="form-grid">${field('Solde théorique','theoretical',balance,true)}${field('Argent compté','counted',balance,true)}${field('Observation','notes','',true)}</div><p class="text-muted" style="font-size:11px;margin-top:10px">L'écart sera calculé automatiquement et la clôture sera enregistrée dans MySQL.</p></form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-cash-close">Confirmer la clôture</button>`);
}
function stockEntryModal(){
 const products=store.get('products');
 return modal('Entrée / ajustement de stock',`<form id="stock-form"><div class="form-grid">${field('Produit','productId','',false,'select',products.map(p=>({value:p.id,label:p.name+' — stock actuel: '+p.stock}))) }${field('Quantité','quantity','1')} ${field('Motif','reason','Entrée manuelle de stock')}</div><p class="text-muted" style="font-size:11px;margin-top:10px">Une quantité positive augmente le stock. Une quantité négative permet un ajustement ou une sortie manuelle.</p></form>`,`<button class="btn btn-secondary" data-action="close-modal">Annuler</button><button class="btn btn-primary" data-action="save-stock">Enregistrer</button>`);
}
function stockPage(){
 const moves=store.get('stockMovements').filter(x=>[x.product,x.type,x.ref,x.reason].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 return `<div class="page">${pageHead('Mouvements de stock','Entrées, sorties, ventes, achats et ajustements',`<button class="btn btn-primary" data-action="stock-entry">＋ Entrée / ajustement</button>`)}${searchRow('Produit, type, référence...')}<div class="card table-wrap"><table class="table"><thead><tr><th>Date</th><th>Référence</th><th>Produit</th><th>Type</th><th>Quantité</th><th>Stock précédent</th><th>Nouveau stock</th><th>Motif</th><th>Utilisateur</th></tr></thead><tbody>${moves.map(m=>`<tr><td>${m.date}</td><td class="mono">${m.ref}</td><td>${esc(m.product)}</td><td>${statusBadge(m.type)}</td><td style="color:${m.qty>0?'#16a34a':'#ef4444'};font-weight:700">${m.qty>0?'+':''}${m.qty}</td><td>${m.prevStock}</td><td><b>${m.newStock}</b></td><td>${esc(m.reason)}</td><td>${m.user}</td></tr>`).join('')}</tbody></table></div>${state.modal==='stock-entry'?stockEntryModal():''}</div>`;
}
function reportDateValue(v){
  const s=String(v||'').slice(0,10);
  return s;
}
function inReportPeriod(v){
  const d=reportDateValue(v);
  if(state.reportFrom && d<state.reportFrom)return false;
  if(state.reportTo && d>state.reportTo)return false;
  return true;
}
function reportFilters(){
  return `<div class="card card-pad" style="margin-bottom:16px"><div class="form-grid">
    <div class="form-field"><label class="form-label">Rapport</label><select class="input" id="report-type">
      <option value="ventes" ${state.reportType==='ventes'?'selected':''}>Rapport des ventes</option>
      <option value="achats" ${state.reportType==='achats'?'selected':''}>Rapport des achats</option>
      <option value="stock" ${state.reportType==='stock'?'selected':''}>Rapport de stock</option>
      <option value="caisse" ${state.reportType==='caisse'?'selected':''}>Rapport de caisse</option>
      <option value="resultat" ${state.reportType==='resultat'?'selected':''}>Ventes / achats</option>
      <option value="clients" ${state.reportType==='clients'?'selected':''}>Rapport clients</option>
      <option value="fournisseurs" ${state.reportType==='fournisseurs'?'selected':''}>Rapport fournisseurs</option>
    </select></div>
    <div class="form-field"><label class="form-label">Du</label><input class="input" id="report-from" type="date" value="${esc(state.reportFrom)}"></div>
    <div class="form-field"><label class="form-label">Au</label><input class="input" id="report-to" type="date" value="${esc(state.reportTo)}"></div>
  </div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-secondary" data-action="report-reset">Réinitialiser</button><button class="btn btn-secondary" data-action="report-export">⇩ CSV</button><button class="btn btn-primary" data-action="report-pdf">⇩ PDF</button><button class="btn btn-secondary" onclick="window.print()">⎙ Imprimer</button></div></div>`;
}
function reportRows(){
 const sales=store.get('sales').filter(x=>inReportPeriod(x.date));
 const purchases=store.get('purchases').filter(x=>inReportPeriod(x.date));
 const stock=store.get('stockMovements').filter(x=>inReportPeriod(x.date));
 const cash=store.get('cashTransactions').filter(x=>inReportPeriod(x.date));
 if(state.reportType==='ventes'){
   const total=sales.reduce((a,x)=>a+Number(x.total),0), paid=sales.reduce((a,x)=>a+Number(x.paid),0), remaining=sales.reduce((a,x)=>a+Number(x.remaining),0);
   return `<div class="grid four-col">${[['Chiffre d’affaires',fmt(total)],['Nombre de ventes',sales.length],['Total encaissé',fmt(paid)],['Créances',fmt(remaining)]].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('')}</div><div class="card table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>Référence</th><th>Date</th><th>Client</th><th>Total</th><th>Payé</th><th>Reste</th><th>Mode</th><th>Statut</th></tr></thead><tbody>${sales.length?sales.map(x=>`<tr><td class="mono">${esc(x.ref)}</td><td>${esc(x.date)}</td><td>${esc(x.customer)}</td><td><b>${fmt(x.total)}</b></td><td>${fmt(x.paid)}</td><td>${fmt(x.remaining)}</td><td>${esc(x.method)}</td><td>${statusBadge(x.status)}</td></tr>`).join(''):`<tr><td colspan="8" class="empty">Aucune vente pour cette période.</td></tr>`}</tbody></table></div>`;
 }
 if(state.reportType==='achats'){
   const total=purchases.reduce((a,x)=>a+Number(x.total),0), paid=purchases.reduce((a,x)=>a+Number(x.paid),0), remaining=purchases.reduce((a,x)=>a+Number(x.remaining),0);
   return `<div class="grid four-col">${[['Total achats',fmt(total)],['Nombre d’achats',purchases.length],['Total payé',fmt(paid)],['Dettes fournisseurs',fmt(remaining)]].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('')}</div><div class="card table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>Référence</th><th>Date</th><th>Fournisseur</th><th>Total</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>${purchases.length?purchases.map(x=>`<tr><td class="mono">${esc(x.ref)}</td><td>${esc(x.date)}</td><td>${esc(x.supplier)}</td><td><b>${fmt(x.total)}</b></td><td>${fmt(x.paid)}</td><td>${fmt(x.remaining)}</td><td>${statusBadge(x.status)}</td></tr>`).join(''):`<tr><td colspan="7" class="empty">Aucun achat pour cette période.</td></tr>`}</tbody></table></div>`;
 }
 if(state.reportType==='stock'){
   const entries=stock.filter(x=>Number(x.qty)>0).reduce((a,x)=>a+Number(x.qty),0), sorties=Math.abs(stock.filter(x=>Number(x.qty)<0).reduce((a,x)=>a+Number(x.qty),0));
   return `<div class="grid four-col">${[['Mouvements',stock.length],['Entrées',entries],['Sorties',sorties],['Produits actuels',store.get('products').length]].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value">${typeof x[1]==='number'&&x[0]!=='Mouvements'&&x[0]!=='Produits actuels'?x[1]:x[1]}</div></div>`).join('')}</div><div class="card table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>Date</th><th>Référence</th><th>Produit</th><th>Type</th><th>Quantité</th><th>Stock avant</th><th>Stock après</th><th>Motif</th></tr></thead><tbody>${stock.length?stock.map(x=>`<tr><td>${esc(x.date)}</td><td class="mono">${esc(x.ref)}</td><td>${esc(x.product)}</td><td>${statusBadge(x.type)}</td><td style="font-weight:700;color:${Number(x.qty)>=0?'#16a34a':'#ef4444'}">${Number(x.qty)>0?'+':''}${x.qty}</td><td>${x.prevStock}</td><td><b>${x.newStock}</b></td><td>${esc(x.reason)}</td></tr>`).join(''):`<tr><td colspan="8" class="empty">Aucun mouvement pour cette période.</td></tr>`}</tbody></table></div>`;
 }
 if(state.reportType==='caisse'){
   const ent=cash.reduce((a,x)=>a+Number(x.entree),0), out=cash.reduce((a,x)=>a+Number(x.sortie),0), ventes=cash.filter(x=>String(x.type).toLowerCase()==='vente').reduce((a,x)=>a+Number(x.entree),0);
   return `<div class="grid four-col">${[['Entrées',fmt(ent)],['Sorties',fmt(out)],['Solde net',fmt(ent-out)],['Ventes encaissées',fmt(ventes)]].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('')}</div><div class="card table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>Date</th><th>Référence</th><th>Type</th><th>Description</th><th>Entrée</th><th>Sortie</th><th>Mode</th><th>Utilisateur</th></tr></thead><tbody>${cash.length?cash.map(x=>`<tr><td>${esc(x.date)}</td><td class="mono">${esc(x.reference||'')}</td><td>${esc(x.type)}</td><td>${esc(x.description)}</td><td style="color:#16a34a">${fmt(x.entree)}</td><td style="color:#ef4444">${fmt(x.sortie)}</td><td>${esc(x.payment_method||'')}</td><td>${esc(x.user)}</td></tr>`).join(''):`<tr><td colspan="8" class="empty">Aucun mouvement de caisse pour cette période.</td></tr>`}</tbody></table></div>`;
 }
 if(state.reportType==='resultat'){
   const salesTotal=sales.reduce((a,x)=>a+Number(x.total),0), purchasesTotal=purchases.reduce((a,x)=>a+Number(x.total),0), paid=sales.reduce((a,x)=>a+Number(x.paid),0);
   return `<div class="grid four-col">${[['Ventes',fmt(salesTotal)],['Achats',fmt(purchasesTotal)],['Écart ventes-achats',fmt(salesTotal-purchasesTotal)],['Ventes encaissées',fmt(paid)]].map(x=>`<div class="card report-stat"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('')}</div><div class="card card-pad" style="margin-top:16px"><b>Note</b><p class="text-muted" style="font-size:12px;margin:7px 0 0">L’écart ventes-achats est un indicateur brut. Il ne constitue pas encore le bénéfice net, car les charges, frais, taxes et le coût détaillé des produits vendus ne sont pas tous intégrés dans ce calcul.</p></div>`;
 }
 if(state.reportType==='clients'){
   const customers=store.get('customers');
   return `<div class="card table-wrap"><table class="table"><thead><tr><th>Code</th><th>Client</th><th>Téléphone</th><th>Total achats</th><th>Payé</th><th>Créance</th><th>Statut</th></tr></thead><tbody>${customers.length?customers.map(x=>`<tr><td class="mono">${esc(x.code)}</td><td><b>${esc(x.name)}</b></td><td>${esc(x.phone||'')}</td><td>${fmt(x.totalPurchases)}</td><td>${fmt(x.paid)}</td><td style="color:${Number(x.balance)>0?'#ef4444':''}">${fmt(x.balance)}</td><td>${statusBadge(x.status)}</td></tr>`).join(''):`<tr><td colspan="7" class="empty">Aucun client.</td></tr>`}</tbody></table></div>`;
 }
 const suppliers=store.get('suppliers');
 return `<div class="card table-wrap"><table class="table"><thead><tr><th>Fournisseur</th><th>Contact</th><th>Achats</th><th>Total</th><th>Solde dû</th><th>Statut</th></tr></thead><tbody>${suppliers.length?suppliers.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.contact||'')}</td><td>${x.purchases}</td><td>${fmt(x.total)}</td><td style="color:${Number(x.balance)>0?'#ef4444':''}">${fmt(x.balance)}</td><td>${statusBadge(x.status)}</td></tr>`).join(''):`<tr><td colspan="6" class="empty">Aucun fournisseur.</td></tr>`}</tbody></table></div>`;
}
function analyticsPage(){
  const a=store.get('analytics')||{};
  const days=Number(state.analyticsDays||30);
  const s=a.summary||{};
  const daily=a.daily||[];
  const top=a.topProducts||[];
  const topCustomers=a.topCustomers||[];
  const payments=a.paymentMethods||[];
  const max=Math.max(1,...daily.map(x=>Number(x.sales||0)));
  const maxProd=Math.max(1,...top.map(x=>Number(x.revenue||0)));
  const maxPay=Math.max(1,...payments.map(x=>Number(x.amount||0)));
  const kpis=[
    ['Chiffre d’affaires',fmt(s.revenue||0)],
    ['Nombre de ventes',String(s.salesCount||0)],
    ['Panier moyen',fmt(s.averageSale||0)],
    ['Marge estimée',fmt(s.estimatedMargin||0)],
    ['Achats',fmt(s.purchases||0)],
    ['Créances clients',fmt(s.receivables||0)],
    ['Unités vendues',String(Number(s.unitsSold||0).toLocaleString('fr-FR'))],
    ['Valeur du stock',fmt(s.stockValue||0)]
  ];
  return `<div class="page">${pageHead('Analyse et statistiques','Analyse détaillée de l’activité de GESTOCK PRO',`<button class="btn ${days===7?'btn-primary':'btn-secondary'}" data-action="analytics-period" data-days="7">7 jours</button><button class="btn ${days===30?'btn-primary':'btn-secondary'}" data-action="analytics-period" data-days="30">30 jours</button><button class="btn ${days===90?'btn-primary':'btn-secondary'}" data-action="analytics-period" data-days="90">90 jours</button><button class="btn ${days===365?'btn-primary':'btn-secondary'}" data-action="analytics-period" data-days="365">1 an</button>`)}
    <div class="grid kpi-grid">${kpis.map(k=>`<div class="card kpi"><div class="kpi-icon" style="background:#dbeafe;color:#2563eb">◉</div><div><div class="kpi-label">${k[0]}</div><div class="kpi-value">${k[1]}</div><div class="kpi-sub">Période : ${days} jour(s)</div></div></div>`).join('')}</div>
    <div class="grid two-col">
      <div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center"><b>Évolution du chiffre d’affaires</b><span class="text-muted" style="font-size:11px">Ventes par jour</span></div><div class="chart" style="align-items:end;margin-top:18px">${daily.map(x=>`<div class="bar-wrap"><div class="bars"><div class="bar green" style="height:${Math.max(3,Number(x.sales||0)/max*155)}px" title="${fmt(x.sales)}"></div></div><div class="bar-label">${esc(x.label)}</div></div>`).join('')}</div></div>
      <div class="card card-pad"><b>Modes de paiement</b><div style="margin-top:14px">${payments.map(x=>`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${esc(x.method)}</span><b>${fmt(x.amount)}</b></div><div style="height:8px;background:#eef2f7;border-radius:8px;margin-top:5px"><div style="height:8px;border-radius:8px;background:#2563eb;width:${Number(x.amount||0)/maxPay*100}%"></div></div></div>`).join('')||'<div class="text-muted">Aucun paiement sur la période.</div>'}</div></div>
    </div>
    <div class="grid two-col">
      <div class="card card-pad"><div style="display:flex;justify-content:space-between"><b>Produits les plus vendus</b><span class="text-muted" style="font-size:11px">Quantité et chiffre d’affaires</span></div><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Produit</th><th>Qté</th><th>CA</th><th>Marge estimée</th></tr></thead><tbody>${top.map(x=>`<tr><td><b>${esc(x.product)}</b></td><td>${x.quantity}</td><td>${fmt(x.revenue)}</td><td>${fmt(x.margin)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-muted">Aucune vente.</td></tr>'}</tbody></table></div></div>
      <div class="card card-pad"><b>Meilleurs clients</b><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Client</th><th>Ventes</th><th>Montant</th><th>Solde</th></tr></thead><tbody>${topCustomers.map(x=>`<tr><td><b>${esc(x.customer)}</b></td><td>${x.salesCount}</td><td>${fmt(x.amount)}</td><td>${fmt(x.balance)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-muted">Aucun client.</td></tr>'}</tbody></table></div></div>
    </div>
    <div class="card card-pad"><b>Lecture de la période</b><p class="text-muted" style="font-size:12px;line-height:1.7;margin-bottom:0">La marge affichée est une <b>estimation</b> basée sur le prix d’achat actuel des produits. Elle ne remplace pas une comptabilité complète avec les coûts historiques, charges et dépenses diverses.</p></div>
  </div>`;
}
function reportsPage(){
 const products=store.get('products');
 const stockValue=products.reduce((a,p)=>a+Number(p.purchasePrice)*Number(p.stock),0);
 return `<div class="page">${pageHead('Rapports','Analyse réelle des ventes, achats, stock et caisse',`<button class="btn btn-secondary" data-action="report-reset">Réinitialiser</button><button class="btn btn-secondary" data-action="report-export">⇩ CSV</button><button class="btn btn-primary" data-action="report-pdf">⇩ PDF</button>`)}${reportFilters()}<div class="card card-pad" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b>Valeur actuelle du stock</b><div class="text-muted" style="font-size:11px">Calculée au prix d’achat actuel.</div></div><b style="font-size:18px">${fmt(stockValue)}</b></div></div>${reportRows()}</div>`;
}
function getPreference(key, defaultValue){
  const raw=localStorage.getItem('gestock_pref_'+key);
  return raw===null?(defaultValue?'on':''):(raw==='1'?'on':'');
}
function setPreference(key, value){localStorage.setItem('gestock_pref_'+key,value?'1':'0');}
function settingsPage(){const x=store.get('settings')||{};return `<div class="page">${pageHead('Paramètres','Configuration de GESTOCK PRO')}</div><div class="page" style="padding-top:0"><div class="card settings-section"><h3>Informations de l'entreprise</h3><form id="settings-form"><div class="form-grid">${field('Nom de l’entreprise','company',x.company||'GESTOCK PRO',true)}${field('Téléphone','phone',x.phone||'+243 000 000 000')}${field('Email','email',x.email||'contact@gestock.pro')}${field('Adresse','address',x.address||'Goma, RDC')}${field('Devise','currency',(x.currency==='$'?'$':(x.currency||'$')))}${field('N° fiscal','tax',x.tax||'')}</div></form><button class="btn btn-primary" style="margin-top:15px" data-action="save-settings">Enregistrer</button></div><div class="card settings-section"><h3>Préférences</h3>${[['Notifications','Recevoir les alertes de stock et activités','notifications'],['Sauvegarde automatique','Préparer les données pour la future sauvegarde MySQL','autoBackup']].map((x,i)=>`<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9"><div><b style="font-size:13px">${x[0]}</b><div class="text-muted" style="font-size:11px">${x[1]}</div></div><button type="button" class="toggle ${getPreference(x[2],i===0)}" data-action="toggle-preference" data-preference="${x[2]}" aria-label="${x[0]}"></button></div>`).join('')}</div><div class="card settings-section"><h3>Développement</h3><p class="text-muted" style="font-size:12px">Les données métier de cette version sont enregistrées dans MySQL via PHP. Il n’y a plus de stockage local pour les clients, produits, ventes, achats, caisse et stock.</p></div></div>`;}

async function doGeneric(type){
 const form=$('#generic-form');
 if(!form)return;
 const obj={};
 new FormData(form).forEach((v,k)=>obj[k]=v);
 const wasEdit=!!state.editId;
 if(state.editId)obj.id=state.editId;
 try{
   await apiSave(type,obj);
   state.modal=null; state.editId=null;
   toast((wasEdit?'Modification':'Enregistrement')+' enregistré dans MySQL.');
   await refreshData();
 }catch(err){apiError(err);}
}

function openProduct(){state.modal='product';state.editId=null;renderPageOnly();}
// Gestion prioritaire des boutons Modifier/Supprimer d'un achat.
// Ce gestionnaire en capture garantit que les boutons restent fonctionnels
// même si un autre élément ou un gestionnaire de clic interfère.
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-purchase-action]');
  if(!b) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const id=Number(b.dataset.id)||0;
  const purchase=store.get('purchases').find(x=>Number(x.id)===id);
  if(!id || !purchase){ toast("Achat introuvable. Actualisez la page puis réessayez."); return; }
  if(b.dataset.purchaseAction==='edit'){
    state.modal='purchase'; state.editId=id; state.deleteId=null; renderPageOnly();
  }else if(b.dataset.purchaseAction==='delete'){
    state.modal='purchase-delete'; state.deleteId=id; state.editId=null; renderPageOnly();
  }
}, true);

document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]'); if(!b)return; const a=b.dataset.action,id=Number(b.dataset.id)||null;
 if(a==='toggle-sidebar'){state.mobileMenu=!state.mobileMenu;render();return;}
 if(a==='close-sidebar'){state.mobileMenu=false;render();return;}
 if(a==='logout'){
   try{await fetch('api/auth/logout.php',{method:'POST',credentials:'same-origin'});}catch(e){}
   state.logged=false; state.modal=null; state.editId=null; state.deleteId=null;
   location.hash=''; render();
   return;
 }
 if(a==='close-modal'){
   state.modal=null;
   state.editId=null;
   state.deleteId=null;
   state.view=null;
   renderPageOnly();
   return;
 }
 if(a==='print-sale'){try{await printBusinessDocument('sale',id);}catch(err){apiError(err);}return;}
 if(a==='print-purchase'){try{await printBusinessDocument('purchase',id);}catch(err){apiError(err);}return;}
 if(a==='view-customer-history'){state.modal='customer-history';state.view=id;renderPageOnly();return;}
 if(a==='view-supplier-history'){state.modal='supplier-history';state.view=id;renderPageOnly();return;}
 if(a==='print-customer-history'){printHistory('customer');return;}
 if(a==='print-supplier-history'){printHistory('supplier');return;}
 if(a==='open-product'){openProduct();return}
 if(a==='edit-product'){state.modal='product';state.editId=id;renderPageOnly();return}
 if(a==='view-product'){state.modal='view-product';state.view=id;renderPageOnly();return}
 if(a==='delete-product'){state.modal='delete-product';state.deleteId=id;renderPageOnly();return}
 if(a==='confirm-delete'){
   const type=b.dataset.key==='product'?'products':b.dataset.key;
   try{
     await apiDelete(type,state.deleteId);
     state.modal=null;state.deleteId=null;
     toast('Suppression effectuée dans MySQL.');
     await refreshData();
   }catch(err){apiError(err);}
   return;
 }
 if(a==='download-backup'){
   try{
     const r=await fetch('api/backup.php',{credentials:'same-origin'});
     if(!r.ok){const msg=await r.text(); throw new Error(msg||'Sauvegarde impossible.');}
     const blob=await r.blob();
     const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='gestock_pro_backup_'+new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')+'.sql'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
     toast('Sauvegarde SQL téléchargée.');
   }catch(err){apiError(err);}
   return;
 }
 if(a==='analytics-period'){state.analyticsDays=Number(b.dataset.days||30);try{apiCache.analytics=await apiGet('analytics?days='+state.analyticsDays);renderPageOnly();}catch(err){apiError(err);}return;}
 if(a==='toggle-preference'){
   const key=b.dataset.preference;
   const current=localStorage.getItem('gestock_pref_'+key);
   const defaultValue=(key==='notifications');
   const enabled=current===null?defaultValue:current==='1';
   setPreference(key,!enabled);
   renderPageOnly();
   toast((!enabled?'Activation':'Desactivation')+' de '+(key==='notifications'?'des notifications':'la sauvegarde automatique')+'.');
   return;
 }
 if(a==='save-settings'){const f=$('#settings-form');const d=Object.fromEntries(new FormData(f).entries());try{await apiSave('settings',d);toast('Paramètres enregistrés dans MySQL.');await refreshData();}catch(err){apiError(err);}return}
 if(a==='save-product'){const f=$('#product-form');if(!f)return;const data=Object.fromEntries(new FormData(f).entries());['purchasePrice','salePrice','stock','minStock','tva'].forEach(k=>data[k]=Number(data[k]||0));if(state.editId)data.id=state.editId;if(!String(data.name||'').trim()){toast('Le nom du produit est obligatoire.');return;}if(data.stock<0||data.minStock<0){toast('Le stock et le stock minimum ne peuvent pas être négatifs.');return;}try{await apiSave('products',data);state.modal=null;state.editId=null;toast('Produit enregistré dans MySQL.');await refreshData();}catch(err){apiError(err);}return}
 if(['open-categories','open-suppliers','open-customers','open-users'].includes(a)){state.modal=a.replace('open-','');state.editId=null;renderPageOnly();return}
 if(['edit-categories','edit-suppliers','edit-customers','edit-users'].includes(a)){const t=a.replace('edit-','');state.modal=t;state.editId=id;renderPageOnly();return}
 if(['delete-categories','delete-suppliers','delete-customers','delete-users','delete-product'].includes(a)){const t=a==='delete-product'?'products':a.replace('delete-','');state.modal='delete-'+(a==='delete-product'?'product':t);state.deleteId=id;renderPageOnly();return}
 if(a==='save-categories'){const f=$('#category-form');if(!f)return;const data=Object.fromEntries(new FormData(f).entries());if(state.editId)data.id=state.editId;if(!data.name.trim()){toast('Le nom de la catégorie est obligatoire.');return;}try{await apiSave('categories',data);state.modal=null;state.editId=null;toast('Catégorie enregistrée dans MySQL.');await refreshData();}catch(err){apiError(err);}return}
 if(a==='save-suppliers'){
   const form=$('#supplier-form'); if(!form)return;
   const data=Object.fromEntries(new FormData(form).entries());
   if(state.editId)data.id=state.editId;
   if(!String(data.name||'').trim()){toast('Le nom du fournisseur est obligatoire.');return;}
   try{await apiSave('suppliers',data);state.modal=null;state.editId=null;toast('Fournisseur enregistré dans MySQL.');await refreshData();}
   catch(err){apiError(err);}return;
 }
 if(a==='save-customers'){
    const form=$('#customer-form'); if(!form)return;
    const data=Object.fromEntries(new FormData(form).entries());
    if(state.editId)data.id=state.editId;
    if(!String(data.name||'').trim()){toast('Le nom du client est obligatoire.');return;}
    try{await apiSave('customers',data);state.modal=null;state.editId=null;toast('Client enregistré dans MySQL.');await refreshData();}
    catch(err){apiError(err);}
    return;
  }
 if(a==='save-user'){
   const form=$('#user-form'); if(!form)return;
   const data=Object.fromEntries(new FormData(form).entries());
   if(state.editId)data.id=state.editId;
   if(!state.editId && !data.password){toast('Le mot de passe est obligatoire pour un nouvel utilisateur.');return;}
   try{
     await apiSave('users',data);
     state.modal=null;state.editId=null;
     toast('Utilisateur enregistré dans MySQL.');
     await refreshData();
   }catch(err){apiError(err);}
   return;
 }
 if(a==='new-purchase'){state.modal='purchase';state.editId=null;renderPageOnly();return}
 if(a==='edit-purchase'){state.modal='purchase';state.editId=id;renderPageOnly();return}
 if(a==='delete-purchase'){state.modal='purchase-delete';state.deleteId=id;renderPageOnly();return}
 if(a==='confirm-delete-purchase'){
   try{await apiDelete('purchases',state.deleteId);state.modal=null;state.deleteId=null;toast('Achat supprimé et stock rétabli dans MySQL.');await refreshData();}catch(err){apiError(err);}return;
 }
 if(a==='save-purchase'){
   const f=$('#purchase-form'); if(!f)return;
   const d=Object.fromEntries(new FormData(f).entries());
   const qty=Number(d.qty||0), price=Number(d.price||0), paid=Number(d.paid||0);
   if(!d.supplier || !d.product || qty<=0 || price<0){toast('Veuillez renseigner le fournisseur, le produit, une quantité valide et un prix valide.');return;}
   const product=store.get('products').find(x=>x.name===d.product); if(!product){toast('Produit introuvable.');return;}
   try{
     const action=state.editId?'updatePurchase':'purchase';
     const payload={id:state.editId||0,ref:d.ref||'',date:d.date||'',supplier:d.supplier,itemsData:[{productId:product.id,qty,price}],paid,method:'Espèces'};
     const r=await fetch('api/data.php?entity=purchases&action='+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
     const j=await r.json(); if(!r.ok||!j.success)throw new Error(j.message||'Erreur API');
     const wasEdit=!!state.editId;state.modal=null;state.editId=null;toast(wasEdit?'Achat modifié dans MySQL.':'Achat enregistré dans MySQL et stock mis à jour.'); await refreshData();
   }catch(err){apiError(err);} return;
 }
 if(a==='view-sale'){state.modal='sale';state.view=id;renderPageOnly();return}
 if(a==='view-purchase'){state.modal='purchase-view';state.view=id;renderPageOnly();return}
 if(a==='cash-in'||a==='cash-out'){state.modal='cash-entry';state.cashDirection=a==='cash-out'?'SORTIE':'ENTREE';renderPageOnly();return}
 if(a==='edit-cash'){state.cashId=Number(el.dataset.id||0);state.modal='cash-edit';renderPageOnly();return}
 if(a==='delete-cash'){const id=Number(el.dataset.id||0);if(!id)return;if(!confirm('Supprimer ce mouvement de caisse ? Cette action recalculera le solde des mouvements suivants.'))return;try{const r=await fetch('api/data.php?entity=cash&action=deleteCash',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Erreur API');toast('Mouvement de caisse supprimé.');await refreshData();}catch(err){apiError(err);}return}
 if(a==='save-cash'){const f=$('#cash-form');if(!f)return;const d=Object.fromEntries(new FormData(f).entries());const amount=Number(d.amount||0);if(amount<=0){toast('Le montant doit être supérieur à zéro.');return;}try{const r=await fetch('api/data.php?entity=cash&action=cash',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Erreur API');state.modal=null;toast('Opération de caisse enregistrée dans MySQL.');await refreshData();}catch(err){apiError(err);}return}
 if(a==='update-cash'){const f=$('#cash-edit-form');if(!f)return;const d=Object.fromEntries(new FormData(f).entries());const amount=Number(d.amount||0);if(amount<=0){toast('Le montant doit être supérieur à zéro.');return;}try{const r=await fetch('api/data.php?entity=cash&action=updateCash',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Erreur API');state.modal=null;toast('Mouvement de caisse modifié.');await refreshData();}catch(err){apiError(err);}return}
 if(a==='close-cash'){state.modal='cash-close';renderPageOnly();return}
 if(a==='save-cash-close'){const f=$('#cash-close-form');if(!f)return;const d=Object.fromEntries(new FormData(f).entries());try{const r=await fetch('api/data.php?entity=cash&action=closeCash',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Erreur API');state.modal=null;toast('Caisse clôturée et enregistrée dans MySQL.');await refreshData();}catch(err){apiError(err);}return}
 if(a==='stock-entry'){state.modal='stock-entry';renderPageOnly();return}
 if(a==='save-stock'){
   const f=$('#stock-form'); if(!f)return;
   const d=Object.fromEntries(new FormData(f).entries());
   const quantity=Number(d.quantity||0); const productId=Number(d.productId||0);
   if(!productId || quantity===0){toast('Choisissez un produit et une quantité différente de zéro.');return;}
   try{
     const r=await fetch('api/data.php?entity=stock&action=stock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,quantity,reason:d.reason||'Ajustement de stock'})});
     const j=await r.json(); if(!r.ok||!j.success)throw new Error(j.message||'Erreur API');
     state.modal=null; toast('Mouvement de stock enregistré dans MySQL.'); await refreshData();
   }catch(err){apiError(err);} return;
 }
 if(a==='pos-cat'){state.cat=b.dataset.cat==='Toutes'?'':b.dataset.cat;renderPageOnly();return}
 if(a==='add-cart'){const p=store.get('products').find(x=>x.id===id);const ex=state.cart.find(x=>x.id===id);if(ex)ex.qty++;else state.cart.push({id:p.id,name:p.name,price:p.salePrice,qty:1});renderPageOnly();return}
 if(a==='qty-plus'){const x=state.cart.find(x=>x.id===id);if(x)x.qty++;renderPageOnly();return}
 if(a==='qty-minus'){const x=state.cart.find(x=>x.id===id);if(x){x.qty=Math.max(1,x.qty-1)}renderPageOnly();return}
 if(a==='remove-cart'){state.cart=state.cart.filter(x=>x.id!==id);renderPageOnly();return}
 if(a==='clear-cart'){state.cart=[];renderPageOnly();return}
 if(a==='payment'){state.method=b.dataset.method;renderPageOnly();return}
 if(a==='validate-sale'){
   if(!state.cart.length)return;
   const subtotal=state.cart.reduce((sum,c)=>sum+c.price*c.qty,0), discount=Number(state.discount||0), tva=state.cart.reduce((sum,c)=>{const p=store.get('products').find(x=>x.id===c.id);return sum+c.price*c.qty*((Number(p?.tva)||0)/100)},0), total=Math.max(0,subtotal-discount+tva), paid=Math.min(total,Math.max(0,Number(state.received||0)||total));
   try{
     const r=await fetch('api/data.php?entity=sales&action=sale',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:state.customer,items:state.cart.map(c=>({id:c.id,name:c.name,qty:c.qty,price:c.price})),discount,paid,method:state.method})});
     const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Erreur API');
     state.saleRef=j.data?.reference||'';state.modal='receipt';toast('Vente enregistrée dans MySQL et stock mis à jour.');await refreshData();renderPageOnly();
   }catch(err){apiError(err);}return;
 }
 if(a==='new-sale'){state.cart=[];state.received='';state.discount=0;state.modal=null;renderPageOnly();return}
 if(a==='report-reset'){state.reportType='ventes';state.reportFrom='';state.reportTo='';renderPageOnly();return}
 const buildReportExportRows=()=>{
   const rows=[]; const type=state.reportType;
   const sales=store.get('sales').filter(x=>inReportPeriod(x.date));
   const purchases=store.get('purchases').filter(x=>inReportPeriod(x.date));
   const stock=store.get('stockMovements').filter(x=>inReportPeriod(x.date));
   const cash=store.get('cashTransactions').filter(x=>inReportPeriod(x.date));
   let headers=[];
   if(type==='ventes'){headers=['Référence','Date','Client','Total','Payé','Reste','Mode','Statut']; rows.push(...sales.map(x=>[x.ref,x.date,x.customer,x.total,x.paid,x.remaining,x.method,x.status]));}
   else if(type==='achats'){headers=['Référence','Date','Fournisseur','Total','Payé','Reste','Statut']; rows.push(...purchases.map(x=>[x.ref,x.date,x.supplier,x.total,x.paid,x.remaining,x.status]));}
   else if(type==='stock'){headers=['Date','Référence','Produit','Type','Quantité','Stock avant','Stock après','Motif']; rows.push(...stock.map(x=>[x.date,x.ref,x.product,x.type,x.qty,x.prevStock,x.newStock,x.reason]));}
   else if(type==='caisse'){headers=['Date','Référence','Type','Description','Entrée','Sortie','Mode','Utilisateur']; rows.push(...cash.map(x=>[x.date,x.reference,x.type,x.description,x.entree,x.sortie,x.payment_method,x.user]));}
   else if(type==='resultat'){headers=['Indicateur','Montant']; const st=sales.reduce((a,x)=>a+Number(x.total),0),pt=purchases.reduce((a,x)=>a+Number(x.total),0),pa=sales.reduce((a,x)=>a+Number(x.paid),0); rows.push(['Ventes',st],['Achats',pt],['Écart ventes-achats',st-pt],['Ventes encaissées',pa]);}
   else if(type==='clients'){headers=['Client','Total achats','Payé','Créance']; store.get('customers').forEach(x=>rows.push([x.name,x.totalPurchases,x.paid,x.balance]));}
   else if(type==='fournisseurs'){headers=['Fournisseur','Total achats','Créance']; store.get('suppliers').forEach(x=>rows.push([x.name,x.total,x.balance]));}
   return {headers,rows};
 };
 if(a==='report-pdf'){
   const pack=buildReportExportRows();
   if(!pack.headers.length){toast('Ce rapport ne contient pas de données exportables.');return;}
   try{
     const r=await fetch('api/report-pdf.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Rapport '+state.reportType,from:state.reportFrom,to:state.reportTo,headers:pack.headers,rows:pack.rows})});
     if(!r.ok) throw new Error('Génération PDF impossible.');
     const blob=await r.blob(); const url=URL.createObjectURL(blob); const a2=document.createElement('a'); a2.href=url; a2.download='gestock-rapport-'+state.reportType+'.pdf'; document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('Rapport PDF exporté.');
   }catch(err){apiError(err);} return;
 }
 if(a==='report-export'){
   const rows=[];
   const type=state.reportType;
   const sales=store.get('sales').filter(x=>inReportPeriod(x.date));
   const purchases=store.get('purchases').filter(x=>inReportPeriod(x.date));
   const stock=store.get('stockMovements').filter(x=>inReportPeriod(x.date));
   const cash=store.get('cashTransactions').filter(x=>inReportPeriod(x.date));
   if(type==='ventes') rows.push(['Référence','Date','Client','Total','Payé','Reste','Mode','Statut'],...sales.map(x=>[x.ref,x.date,x.customer,x.total,x.paid,x.remaining,x.method,x.status]));
   else if(type==='achats') rows.push(['Référence','Date','Fournisseur','Total','Payé','Reste','Statut'],...purchases.map(x=>[x.ref,x.date,x.supplier,x.total,x.paid,x.remaining,x.status]));
   else if(type==='stock') rows.push(['Date','Référence','Produit','Type','Quantité','Stock avant','Stock après','Motif'],...stock.map(x=>[x.date,x.ref,x.product,x.type,x.qty,x.prevStock,x.newStock,x.reason]));
   else if(type==='caisse') rows.push(['Date','Référence','Type','Description','Entrée','Sortie','Mode','Utilisateur'],...cash.map(x=>[x.date,x.reference,x.type,x.description,x.entree,x.sortie,x.payment_method,x.user]));
   else { toast('L’export détaillé est disponible pour les rapports de ventes, achats, stock et caisse.'); return; }
   const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
   const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a2=document.createElement('a'); a2.href=url; a2.download='gestock-rapport-'+type+'.csv'; a2.click(); URL.revokeObjectURL(url); toast('Rapport exporté en CSV.'); return;
 }
 if(a==='hold-sale'){toast('Vente mise en attente (démo front-end).');return}
 if(a==='export-json'){const blob=new Blob([JSON.stringify({products:store.get('products'),customers:store.get('customers'),sales:store.get('sales')},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a2=document.createElement('a');a2.href=url;a2.download='gestock-export.json';a2.click();URL.revokeObjectURL(url);return}
});
document.addEventListener('change',e=>{
 if(e.target.id==='report-type'){state.reportType=e.target.value;renderPageOnly();}
 if(e.target.id==='report-from'){state.reportFrom=e.target.value;renderPageOnly();}
 if(e.target.id==='report-to'){state.reportTo=e.target.value;renderPageOnly();}
});
document.addEventListener('input',e=>{
 if(e.target.id==='pos-search'){state.search=e.target.value;renderPageOnly()}
 if(e.target.id==='pos-discount'){state.discount=Number(e.target.value||0);renderPageOnly()}
 if(e.target.id==='pos-received'){state.received=e.target.value;renderPageOnly()}
 if(e.target.id==='pos-customer'){state.customer=e.target.value}
 if(e.target.classList.contains('page-search')){state.search=e.target.value;renderPageOnly()}
});

// Initialisation de l application
render();
