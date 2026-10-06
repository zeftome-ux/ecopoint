'use strict';

/* ============================================================
   EcoPoint — front-end (SPA sem build)
   ============================================================ */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n, d = 0) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const parseDate = s => new Date(String(s).replace(' ', 'T'));
const fDate = s => parseDate(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const fDateLong = s => parseDate(s.length === 10 ? s + 'T12:00' : s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fDateTime = s => parseDate(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const today = () => new Date().toLocaleDateString('sv-SE');
const initials = n => String(n || '?').split(' ').filter(w => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const avatar = (u, size = '') => `<span class="avatar ${size}" style="--c:${esc(u.avatar_color || '#16a34a')}">${esc(initials(u.name || u.student_name))}</span>`;
const plural = (n, s, p) => `${num(n)} ${n === 1 ? s : p}`;

function timeAgo(s) {
  const diff = (Date.now() - parseDate(s)) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return fDate(s);
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } },
};

const S = { token: store.get('ep_token'), user: null, seq: 0 };

/* ---------------- Ícones ---------------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chart: '<path d="M3 3v18h18M7 15v2M11 11v6M15 7v10M19 12v5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  log: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------------- API ---------------- */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique se o EcoPoint está rodando.');
  }
  let data = {};
  try { data = await res.json(); } catch { }
  if (res.status === 401 && S.user) { logout(true); throw new Error(data.error || 'Sessão expirada.'); }
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

/* ---------------- UI utilitários ---------------- */
function toast(msg, type = 'success', ms = 3800) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'warn' ? '🔎' : '✅'}</span><span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => { el.style.transition = '.3s'; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, ms);
}

function confetti(n = 70) {
  const colors = ['#22c55e', '#0d9488', '#facc15', '#38bdf8', '#f472b6', '#a78bfa'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    c.style.animationDelay = Math.random() * .4 + 's';
    document.body.append(c);
    setTimeout(() => c.remove(), 4200);
  }
}

function modal({ title, body, submit = 'Salvar', onSubmit, wide, danger, cancel = 'Cancelar' }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><form class="modal ${wide ? 'wide' : ''}" novalidate>
    <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>
    ${onSubmit ? `<div class="modal-foot"><button type="button" class="btn ghost" data-close>${cancel}</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" type="submit">${submit}</button></div>` : ''}
  </form></div>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $$('[data-close]', root).forEach(b => b.onclick = close);
  $('.modal-backdrop', root).addEventListener('mousedown', e => { if (e.target.classList.contains('modal-backdrop')) close(); });
  const form = $('form', root);
  form.onsubmit = async e => {
    e.preventDefault();
    if (!onSubmit) return;
    const btn = $('[type=submit]', form);
    btn.disabled = true;
    try {
      const r = await onSubmit(formData(form), form);
      if (r !== false) close();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  };
  setTimeout(() => $('input:not([type=hidden]), select, textarea', form)?.focus(), 50);
  return { close, form };
}

function confirmBox(title, text, { submit = 'Confirmar', danger } = {}) {
  return new Promise(resolve => {
    let ok = false;
    const m = modal({ title, body: `<p class="muted">${text}</p>`, submit, danger, onSubmit: () => { ok = true; } });
    const obs = new MutationObserver(() => { if (!$('#modal-root').children.length) { obs.disconnect(); resolve(ok); } });
    obs.observe($('#modal-root'), { childList: true });
    void m;
  });
}

function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
  $$('input[type=checkbox]', form).forEach(c => { o[c.name] = c.checked ? 1 : 0; });
  return o;
}

function field({ name, label, type = 'text', value = '', options, required, step, min, max, hint, full, placeholder }) {
  if (type === 'checkbox') return `<label class="check ${full ? 'full' : ''}"><input type="checkbox" name="${name}" ${value ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  let input;
  const attrs = `name="${name}" ${required ? 'required' : ''} ${placeholder ? `placeholder="${esc(placeholder)}"` : ''}`;
  if (type === 'select') {
    input = `<select ${attrs}>${options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else if (type === 'textarea') {
    input = `<textarea ${attrs}>${esc(value)}</textarea>`;
  } else {
    input = `<input type="${type}" ${attrs} value="${esc(value ?? '')}" ${step ? `step="${step}"` : ''} ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}>`;
  }
  return `<label class="field ${full ? 'full' : ''}"><span>${esc(label)}${required ? ' *' : ''}</span>${input}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

const emptyState = (e, t) => `<div class="empty"><div class="e">${e}</div><div>${esc(t)}</div></div>`;
const skeleton = () => `<div class="skeleton"><div class="sk" style="height:160px"></div><div class="grid g3"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div><div class="sk" style="height:240px"></div></div>`;

function tabs(items, active, attr = 'data-tab') {
  return `<div class="tabs">${items.map(([v, l]) => `<button type="button" ${attr}="${v}" class="${v === active ? 'active' : ''}">${l}</button>`).join('')}</div>`;
}

/* ---------------- Gráficos ---------------- */
function barChart(series, { height = 160, labelEvery = 1 } = {}) {
  const max = Math.max(1, ...series.map(s => s.value));
  return `<div class="bars" style="--h:${height}px">${series.map((s, i) => `
    <div class="bar-col" title="${esc(s.title || `${s.label}: ${s.value}`)}">
      <div class="bar ${s.value ? '' : 'zero'}" style="height:${Math.max(2, s.value / max * 100)}%">${s.value ? `<span class="bar-val">${num(s.value)}</span>` : ''}</div>
      <span class="bar-lbl">${i % labelEvery === 0 ? esc(s.label) : ''}</span>
    </div>`).join('')}</div>`;
}

function hbars(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="hbars">${items.map(i => `<div class="hbar">
    <div class="top"><span>${i.label}</span><span class="muted">${i.display ?? num(i.value)}</span></div>
    <div class="track"><i style="width:${i.value / max * 100}%;background:${i.color || 'linear-gradient(90deg,#22c55e,#0d9488)'}"></i></div>
  </div>`).join('')}</div>`;
}

function donut(items, center, sub) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const stops = items.map(i => { const s = acc; acc += i.value / total * 100; return `${i.color} ${s}% ${acc}%`; }).join(',');
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops || 'var(--border) 0 100%'})"><div class="c">${center}<small>${sub}</small></div></div>
    <div class="legend">${items.map(i => `<div><i style="background:${i.color}"></i>${i.label}<b>${Math.round(i.value / total * 100)}%</b></div>`).join('')}</div></div>`;
}

function impactCards(imp, compact) {
  const cards = [
    ['♻️', `${num(imp.items)}`, 'itens reciclados'],
    ['⚖️', `${num(imp.kg, 1)} kg`, 'de resíduos desviados do lixo'],
    ['🌍', `${num(imp.co2, 1)} kg`, 'de CO₂ evitados'],
    ['💧', `${num(imp.water)} L`, 'de água preservados'],
    ['⚡', `${num(imp.energy, 1)} kWh`, 'de energia economizada'],
    ['🌳', `${num(imp.trees, 1)}`, 'árvores/ano equivalentes'],
  ];
  return `<div class="grid ${compact ? 'g3' : 'g3'}">${cards.map(([e, v, l]) => `<div class="impact"><div class="ico">${e}</div><div><div class="v">${v}</div><div class="l">${l}</div></div></div>`).join('')}</div>`;
}

/* ---------------- QR ---------------- */
function qrSvg(text) {
  if (!window.qrcode) return null;
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

let scanner = null;
async function startScanner(elId, onCode) {
  if (!window.Html5Qrcode) { toast('Leitor de QR indisponível (sem internet para carregar a biblioteca). Use a matrícula.', 'error'); return false; }
  stopScanner();
  const sc = new Html5Qrcode(elId);
  scanner = sc;
  let done = false;
  try {
    await sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 } }, text => {
      if (done) return;
      done = true;
      stopScanner();
      onCode(text);
    }, () => { });
    return true;
  } catch (e) {
    scanner = null;
    const insecure = !window.isSecureContext;
    toast(insecure ? 'O navegador só libera a câmera em https ou localhost. Use "Ler de imagem" ou a matrícula.' : 'Não foi possível abrir a câmera: ' + (e?.message || e), 'error', 6000);
    return false;
  }
}
function stopScanner() {
  if (!scanner) return;
  const sc = scanner;
  scanner = null;
  sc.stop().then(() => sc.clear()).catch(() => { });
}
async function scanImageFile(file) {
  if (!window.Html5Qrcode) throw new Error('Leitor de QR indisponível.');
  const reader = new Html5Qrcode('qr-file-reader');
  try { return await reader.scanFile(file, false); }
  catch { throw new Error('Não encontrei um QR Code nessa imagem.'); }
  finally { try { reader.clear(); } catch { } }
}

/* ---------------- Navegação ---------------- */
const NAV = {
  student: [['dashboard', 'Início', 'home'], ['qrcode', 'Meu QR Code', 'qr'], ['rewards', 'Recompensas', 'gift'], ['ranking', 'Ranking', 'trophy'], ['challenges', 'Desafios e conquistas', 'target'], ['history', 'Histórico', 'clock']],
  staff: [['validate', 'Validar entrega', 'scan'], ['today', 'Entregas do dia', 'list'], ['redemptions', 'Retirada de prêmios', 'gift'], ['ranking', 'Ranking', 'trophy']],
  admin: [['overview', 'Visão geral', 'chart'], ['fraud', 'Antifraude', 'shield'], ['validate', 'Validar entrega', 'scan'], ['today', 'Entregas do dia', 'list'], ['materials', 'Materiais e pontos', 'box'], ['rewards-admin', 'Recompensas', 'gift'], ['challenges-admin', 'Desafios', 'target'], ['users', 'Usuários e turmas', 'users'], ['redemptions', 'Resgates', 'coins'], ['ranking', 'Ranking', 'trophy'], ['audit', 'Auditoria', 'log']],
};
const ROLE_LABEL = { student: 'Aluno', staff: 'Funcionário', admin: 'Administrador' };

function logout(expired) {
  if (!expired && S.token) api('/api/logout', { method: 'POST' }).catch(() => { });
  S.token = null; S.user = null; store.set('ep_token', null);
  stopScanner();
  $('#modal-root').innerHTML = '';
  history.replaceState(null, '', '#/');
  render();
  if (expired) toast('Sua sessão expirou. Entre novamente.', 'warn');
}

function renderShell() {
  const u = S.user;
  $('#app').innerHTML = `<div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="brand-logo">${icon('leaf')}</span><span>Eco<b>Point</b></span></div>
      <div class="side-user">${avatar(u)}<div><div class="name">${esc(u.name)}</div><div class="role">${ROLE_LABEL[u.role]}${u.class_name ? ' · ' + esc(u.class_name) : ''}</div></div></div>
      <nav class="nav">${NAV[u.role].map(([k, l, i]) => `<a href="#/${k}" data-page="${k}">${icon(i)}<span>${l}</span></a>`).join('')}</nav>
      <div class="side-foot"><div class="nav"><a href="#" id="logout">${icon('logout')}<span>Sair</span></a></div></div>
    </aside>
    <div class="backdrop" id="backdrop"></div>
    <div class="content">
      <header class="topbar"><button class="icon-btn menu-btn" id="menu" aria-label="Menu">${icon('menu')}</button><h1 id="page-title"></h1><div id="top-extra"></div></header>
      <main id="main"></main>
    </div></div>`;
  const side = $('#sidebar'), back = $('#backdrop');
  const toggle = open => { side.classList.toggle('open', open); back.classList.toggle('open', open); };
  $('#menu').onclick = () => toggle(true);
  back.onclick = () => toggle(false);
  $$('.nav a[data-page]').forEach(a => a.addEventListener('click', () => toggle(false)));
  $('#logout').onclick = e => { e.preventDefault(); logout(); };
}

async function render() {
  stopScanner();
  if (!S.user) return renderLogin();
  const nav = NAV[S.user.role];
  let page = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!nav.find(n => n[0] === page)) { page = nav[0][0]; history.replaceState(null, '', '#/' + page); }
  if (!$('.shell')) renderShell();
  $$('.nav a[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  const title = nav.find(n => n[0] === page)[1];
  $('#page-title').textContent = title;
  $('#top-extra').innerHTML = '';
  document.title = `${title} · EcoPoint`;
  const main = $('#main');
  const el = document.createElement('div');
  el.innerHTML = skeleton();
  main.replaceChildren(el);
  window.scrollTo(0, 0);
  try { await VIEWS[page](el); }
  catch (err) {
    if (el.isConnected) el.innerHTML = `<div class="card">${emptyState('😕', err.message)}<div class="row" style="justify-content:center"><button class="btn" onclick="render()">${icon('refresh')} Tentar de novo</button></div></div>`;
  }
  refreshBadges();
}

async function refreshBadges() {
  if (S.user?.role !== 'admin') return;
  try {
    const d = await api('/api/admin/fraud');
    const n = d.pending.length + d.alerts.filter(a => !a.delivery_id).length;
    const a = $('.nav a[data-page="fraud"]');
    if (!a) return;
    $('.count', a)?.remove();
    if (n) a.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`);
  } catch { }
}

/* ============================================================
   LOGIN
   ============================================================ */
function renderLogin() {
  document.title = 'EcoPoint — Reciclagem que vale pontos';
  $('#app').innerHTML = `<div class="login">
    <section class="login-hero">
      <span class="floaty" style="right:8%;top:14%">🧴</span><span class="floaty" style="right:22%;top:46%;animation-delay:-2s">🥫</span><span class="floaty" style="right:6%;bottom:12%;animation-delay:-4s">📦</span>
      <div class="brand"><span class="brand-logo">${icon('leaf')}</span><span>Eco<b>Point</b></span></div>
      <div>
        <h1>Reciclar na escola agora vale <span>pontos</span>.</h1>
        <p class="lead">Traga seus recicláveis, valide com seu QR Code e troque pontos por brindes, privilégios e benefícios.</p>
      </div>
      <div class="steps">
        <div class="step"><div class="n">🧴</div><b>1. Entregue</b><span>Leve PET, latas, papel e papelão.</span></div>
        <div class="step"><div class="n">📱</div><b>2. Valide</b><span>O funcionário lê seu QR Code.</span></div>
        <div class="step"><div class="n">🎁</div><b>3. Troque</b><span>Use os pontos em recompensas.</span></div>
      </div>
      <div class="mat-pills"><span>🧴 PET +1</span><span>🥫 Lata +2</span><span>📄 Papel +1</span><span>📦 Papelão +3</span></div>
    </section>
    <section class="login-panel">
      <form class="login-card" id="login-form">
        <div><h2>Entrar</h2><p class="muted">Use seu e-mail ou número de matrícula.</p></div>
        ${field({ name: 'email', label: 'E-mail ou matrícula', placeholder: 'voce@escola.com', required: true })}
        ${field({ name: 'password', label: 'Senha', type: 'password', placeholder: '••••••', required: true })}
        <button class="btn primary lg block" type="submit">Entrar</button>
        <div class="demo"><p>Contas de demonstração · senha <b>123456</b></p>
          <div class="demo-btns">
            <button type="button" data-demo="aluno@ecopoint.com"><span>🎒</span>Aluno</button>
            <button type="button" data-demo="funcionario@ecopoint.com"><span>👷</span>Funcionário</button>
            <button type="button" data-demo="admin@ecopoint.com"><span>🏫</span>Admin</button>
          </div>
        </div>
      </form>
    </section></div>`;
  const form = $('#login-form');
  const doLogin = async (email, password) => {
    const btn = $('[type=submit]', form);
    btn.disabled = true; btn.textContent = 'Entrando...';
    try {
      const r = await api('/api/login', { method: 'POST', body: { email, password } });
      S.token = r.token; store.set('ep_token', r.token);
      S.user = (await api('/api/me')).user;
      history.replaceState(null, '', '#/');
      render();
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Entrar'; }
  };
  form.onsubmit = e => { e.preventDefault(); const d = formData(form); doLogin(d.email, d.password); };
  $$('[data-demo]').forEach(b => b.onclick = () => {
    form.email.value = b.dataset.demo; form.password.value = '123456';
    doLogin(b.dataset.demo, '123456');
  });
}

/* ============================================================
   VIEWS
   ============================================================ */
const VIEWS = {};

const txIcon = t => ({ delivery: '♻️', bonus: '🎯', redemption: '🎁', refund: '↩️', adjust: '🛠️' }[t] || '•');
const txLabel = t => ({ delivery: 'Entrega', bonus: 'Bônus de desafio', redemption: 'Resgate', refund: 'Estorno', adjust: 'Ajuste' }[t] || t);
const statusBadge = s => ({
  approved: '<span class="badge green">Aprovada</span>', pending: '<span class="badge amber">Em revisão</span>', rejected: '<span class="badge red">Recusada</span>',
  delivered: '<span class="badge green">Retirado</span>', cancelled: '<span class="badge gray">Cancelado</span>',
}[s] || s);
const redemptionPending = '<span class="badge amber">Aguardando retirada</span>';

function txRow(t) {
  return `<div class="li"><div class="emoji-box">${txIcon(t.type)}</div><div class="grow"><div class="title">${esc(t.description || txLabel(t.type))}</div>
    <div class="meta">${txLabel(t.type)} · ${timeAgo(t.created_at)}</div></div><div class="pts ${t.points >= 0 ? 'pos' : 'neg'}">${t.points > 0 ? '+' : ''}${num(t.points)}</div></div>`;
}

function challengeCard(ch, showProgress = true) {
  const pct = Math.min(100, Math.round((ch.progress || 0) * 100 / ch.target));
  const daysLeft = Math.ceil((parseDate(ch.end_date + 'T23:59') - Date.now()) / 86400000);
  return `<div class="card challenge ${ch.completed ? 'done' : ''}"><div class="emoji-box">${ch.icon}</div><div class="grow" style="flex:1;min-width:0">
    <div class="row between"><b>${esc(ch.title)}</b>${ch.completed ? '<span class="badge green">✓ Concluído</span>' : `<span class="badge blue">+${ch.bonus} pts</span>`}</div>
    <p class="small muted" style="margin:4px 0 10px">${esc(ch.description || '')}</p>
    ${showProgress ? `<div class="progress"><i style="width:${pct}%"></i></div>
    <div class="row between small muted" style="margin-top:6px"><span><b style="color:var(--text)">${num(Math.min(ch.progress, ch.target))}</b> / ${num(ch.target)} ${ch.material_name ? esc(ch.material_name.toLowerCase()) : 'itens'}</span>
    <span>${ch.state === 'upcoming' ? 'Começa em ' + fDateLong(ch.start_date) : ch.state === 'ended' ? 'Encerrado' : daysLeft <= 1 ? 'Último dia!' : `${daysLeft} dias restantes`}</span></div>` : ''}
  </div></div>`;
}

/* ---------------- Aluno: dashboard ---------------- */
VIEWS.dashboard = async el => {
  const d = await api('/api/student/dashboard');
  const first = S.user.name.split(' ')[0];
  const lv = d.level;
  const days = d.series.map(s => ({ label: parseDate(s.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit' }), value: s.value, title: `${fDate(s.date + 'T12:00')}: ${s.value} pts` }));
  el.innerHTML = `<div class="stack">
    <section class="hero"><div class="hero-grid">
      <div><div class="hello">Olá, ${esc(first)}! 👋</div><div class="balance">${num(d.balance)}<small>pontos</small></div>
        <p style="opacity:.9">disponíveis para trocar · ${num(d.earned)} conquistados no total</p>
        <div class="row" style="margin-top:16px"><a class="btn" href="#/qrcode">${icon('qr')} Mostrar meu QR</a><a class="btn" href="#/rewards">${icon('gift')} Trocar pontos</a></div></div>
      <div class="level-box"><div class="lv"><span class="emoji">${lv.icon}</span><div><div style="font-size:12px;opacity:.85;font-weight:600">Seu nível</div>${lv.name}</div></div>
        <div class="progress"><i style="width:${lv.progress}%"></i></div>
        <div class="small" style="opacity:.9">${lv.next_name ? `Faltam <b>${lv.next_min - d.earned} pts</b> para <b>${lv.next_name}</b>` : 'Nível máximo alcançado! 🎉'}</div></div>
    </div></section>

    <div class="grid g4">
      <div class="card stat"><div class="label"><span class="stat-icon">📈</span>Últimos 30 dias</div><div class="value">+${num(d.month)}</div><div class="hint">pontos ganhos</div></div>
      <div class="card stat"><div class="label"><span class="stat-icon">🏆</span>Ranking geral</div><div class="value">${d.rank ? d.rank + 'º' : '—'}</div><div class="hint">de ${d.rank_total} alunos</div></div>
      <div class="card stat"><div class="label"><span class="stat-icon">🏫</span>${esc(d.class_name || 'Turma')}</div><div class="value">${d.class_rank ? d.class_rank + 'º' : '—'}</div><div class="hint">de ${d.class_total} turmas</div></div>
      <div class="card stat"><div class="label"><span class="stat-icon">🏅</span>Conquistas</div><div class="value">${d.achievements_count}<span class="muted" style="font-size:18px">/${d.achievements_total}</span></div><div class="hint">${d.achievements.map(a => a.icon).join(' ') || 'nenhuma ainda'}</div></div>
    </div>

    <div class="card"><div class="card-head"><div><h3>🌎 Seu impacto ambiental</h3><div class="sub">Estimativas com base no que você já reciclou</div></div></div>${impactCards(d.impact)}</div>

    <div class="grid g2">
      <div class="card"><div class="card-head"><h3>Pontos nos últimos 14 dias</h3></div>${barChart(days, { height: 150 })}</div>
      <div class="card"><div class="card-head"><h3>O que você mais recicla</h3></div>
        ${d.materials.length ? hbars(d.materials.map(m => ({ label: `${m.icon} ${esc(m.name)}`, value: m.qty, display: `${num(m.qty)} un · ${num(m.pts)} pts`, color: m.color }))) : emptyState('🧺', 'Faça sua primeira entrega!')}</div>
    </div>

    <div class="grid g2">
      <div class="card"><div class="card-head"><h3>🎯 Desafios ativos</h3><a href="#/challenges" class="small">Ver todos</a></div>
        <div class="stack">${d.challenges.map(ch => challengeCard({ ...ch, state: 'active' })).join('') || emptyState('🎯', 'Nenhum desafio ativo agora.')}</div></div>
      <div class="card"><div class="card-head"><h3>Atividade recente</h3><a href="#/history" class="small">Histórico completo</a></div>
        <div class="list">${d.recent.map(txRow).join('') || emptyState('🕐', 'Nenhuma atividade ainda.')}</div></div>
    </div>
  </div>`;
};

/* ---------------- Aluno: QR ---------------- */
VIEWS.qrcode = async el => {
  const d = await api('/api/student/qr');
  const svg = qrSvg(d.qr_payload);
  el.innerHTML = `<div class="qr-card">
      ${avatar(S.user, 'lg')}
      <h2 style="margin-top:10px">${esc(d.name)}</h2>
      <p class="muted">${esc(d.class_name || '')} · Matrícula ${esc(d.registration)}</p>
      <div class="qr-box">${svg || `<div class="empty"><div class="e">📵</div>Sem internet para gerar a imagem do QR.<br>Informe sua matrícula ao funcionário.</div>`}</div>
      <div class="muted small">Matrícula</div><div class="code-big">${esc(d.registration)}</div>
      <p class="small muted" style="margin-top:14px">Mostre este código ao funcionário no ponto de coleta. Ele é pessoal: não compartilhe. Se perder, peça à coordenação para gerar um novo.</p>
      <div class="row" style="justify-content:center;margin-top:16px"><button class="btn soft" onclick="window.print()">${icon('print')} Imprimir carteirinha</button></div>
    </div>`;
};

/* ---------------- Aluno: recompensas ---------------- */
VIEWS.rewards = async el => {
  const d = await api('/api/rewards');
  const cats = ['Todas', ...new Set(d.rewards.map(r => r.category))];
  let cat = 'Todas';
  const draw = () => {
    const list = d.rewards.filter(r => cat === 'Todas' || r.category === cat);
    el.innerHTML = `<div class="stack">
      <div class="card row between"><div class="row"><span class="stat-icon" style="width:48px;height:48px;font-size:24px">💰</span><div><div class="muted small" style="font-weight:600">Seu saldo</div><div style="font-size:28px;font-weight:800">${num(d.balance)} pts</div></div></div>
        ${tabs(cats.map(c => [c, c]), cat, 'data-cat')}</div>
      <div class="rewards">${list.map(r => {
        const can = d.balance >= r.cost, out = r.stock !== null && r.stock <= 0;
        return `<div class="card reward"><div class="art">${r.icon}</div><div class="row between"><span class="chip">${esc(r.category)}</span>${r.stock !== null ? `<span class="small muted">${out ? 'Esgotado' : r.stock + ' em estoque'}</span>` : '<span class="small muted">Ilimitado</span>'}</div>
          <h4>${esc(r.name)}</h4><p class="desc">${esc(r.description || '')}</p>
          <div class="row between"><span class="cost">${num(r.cost)} pts</span>
          <button class="btn ${can && !out ? 'primary' : ''} sm" data-redeem="${r.id}" ${can && !out ? '' : 'disabled'}>${out ? 'Esgotado' : can ? 'Trocar' : 'Bloqueado'}</button></div>
          ${!can && !out ? `<div class="need">Faltam ${num(r.cost - d.balance)} pts</div><div class="progress" style="height:6px"><i style="width:${Math.round(d.balance * 100 / r.cost)}%"></i></div>` : ''}
        </div>`;
      }).join('')}</div>
      <div class="card"><div class="card-head"><h3>Meus resgates</h3><span class="sub">Apresente o código na coordenação para retirar</span></div>
        <div class="list">${d.redemptions.map(r => `<div class="li"><div class="emoji-box">${r.icon}</div><div class="grow"><div class="title">${esc(r.name)}</div>
          <div class="meta">Código <b style="font-family:monospace;color:var(--text)">${esc(r.code)}</b> · ${fDateTime(r.created_at)} · ${num(r.cost)} pts</div></div>
          ${r.status === 'pending' ? `${redemptionPending}<button class="btn sm ghost" data-cancel="${r.id}">Cancelar</button>` : statusBadge(r.status)}</div>`).join('') || emptyState('🎁', 'Você ainda não trocou pontos.')}</div></div>
    </div>`;
    $$('[data-cat]', el).forEach(b => b.onclick = () => { cat = b.dataset.cat; draw(); });
    $$('[data-redeem]', el).forEach(b => b.onclick = () => {
      const r = d.rewards.find(x => x.id == b.dataset.redeem);
      modal({
        title: 'Confirmar troca', submit: `Trocar por ${r.cost} pts`,
        body: `<div style="text-align:center"><div style="font-size:56px">${r.icon}</div><h3 style="margin:8px 0">${esc(r.name)}</h3>
          <p class="muted">Seu saldo vai de <b>${num(d.balance)}</b> para <b>${num(d.balance - r.cost)}</b> pontos.</p></div>`,
        onSubmit: async () => {
          const res = await api(`/api/rewards/${r.id}/redeem`, { method: 'POST' });
          confetti();
          setTimeout(() => modal({
            title: 'Troca realizada! 🎉',
            body: `<div style="text-align:center"><div style="font-size:56px">${r.icon}</div><p class="muted" style="margin:8px 0">Apresente este código na coordenação para retirar:</p>
              <div class="code-big" style="font-size:34px;margin:10px 0">${esc(res.code)}</div>
              ${res.achievements.map(a => `<div class="callout green" style="justify-content:center">${a.icon} Nova conquista: <b>${esc(a.name)}</b></div>`).join('')}
              <button type="button" class="btn primary block mt" data-close>Ok!</button></div>`,
          }), 10);
          VIEWS.rewards(el);
        },
      });
    });
    $$('[data-cancel]', el).forEach(b => b.onclick = async () => {
      if (!await confirmBox('Cancelar resgate?', 'Os pontos voltam para o seu saldo.', { submit: 'Cancelar resgate', danger: true })) return;
      try { await api(`/api/student/redemptions/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Resgate cancelado e pontos devolvidos.'); VIEWS.rewards(el); }
      catch (e) { toast(e.message, 'error'); }
    });
  };
  draw();
};

/* ---------------- Ranking ---------------- */
VIEWS.ranking = async el => {
  let mode = 'students', period = '30d', classId = '';
  const draw = async () => {
    const d = await api(`/api/ranking?period=${period}${classId ? '&class_id=' + classId : ''}`);
    const meId = S.user.id;
    const periods = [['7d', '7 dias'], ['30d', '30 dias'], ['month', 'Este mês'], ['all', 'Sempre']];
    let body;
    if (mode === 'students') {
      const s = d.students;
      const top = s.slice(0, 3);
      const order = [top[1], top[0], top[2]];
      body = `${top.length >= 3 && top[0].points > 0 ? `<div class="podium">${order.map((p, i) => `<div class="pod ${i === 1 ? 'p1' : ''}">
          <div class="medal">${['🥈', '🥇', '🥉'][i]}</div>${avatar(p)}<div class="nm">${esc(p.name)}</div><div class="small muted">${esc(p.class_name || '')}</div><div class="pt">${num(p.points)} pts</div></div>`).join('')}</div>` : ''}
        <div class="card"><div class="list">${s.map((p, i) => `<div class="li ${p.id === meId ? 'me' : ''}"><div class="rank-n">${i + 1}</div>${avatar(p, 'sm')}
          <div class="grow"><div class="title">${esc(p.name)} ${p.id === meId ? '<span class="badge green">você</span>' : ''}</div><div class="meta">${esc(p.class_name || '')} · ${p.level}</div></div>
          <div class="pts">${num(p.points)} pts</div></div>`).join('') || emptyState('🏁', 'Nenhum aluno nesta turma.')}</div></div>`;
    } else {
      const c = d.classes;
      const max = Math.max(1, ...c.map(x => x.points));
      body = `<div class="grid g3">${c.map((x, i) => `<div class="card ${S.user.class_id === x.id ? 'challenge done' : ''}" style="display:block">
          <div class="row between"><span style="font-size:28px">${['🥇', '🥈', '🥉'][i] || `<b class="muted">${i + 1}º</b>`}</span>${S.user.class_id === x.id ? '<span class="badge green">sua turma</span>' : `<span class="chip">${esc(x.shift || '')}</span>`}</div>
          <h3 style="margin:10px 0 2px">${esc(x.name)}</h3><div class="muted small">${x.students} alunos</div>
          <div style="font-size:30px;font-weight:800;margin-top:10px">${num(x.points)} <span class="muted" style="font-size:15px">pts</span></div>
          <div class="progress" style="margin:8px 0"><i style="width:${x.points * 100 / max}%"></i></div>
          <div class="row between small muted"><span>Média: <b style="color:var(--text)">${num(x.average, 1)}</b> pts/aluno</span><span>${num(x.items)} itens</span></div></div>`).join('')}</div>`;
    }
    el.innerHTML = `<div class="toolbar">${tabs([['students', '👤 Individual'], ['classes', '🏫 Por turma']], mode, 'data-mode')}<div class="grow"></div>
      ${mode === 'students' ? `<select class="input" id="cls"><option value="">Todas as turmas</option>${d.class_list.map(c => `<option value="${c.id}" ${String(c.id) === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
      ${tabs(periods, period, 'data-period')}</div>${body}`;
    $$('[data-mode]', el).forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    $$('[data-period]', el).forEach(b => b.onclick = () => { period = b.dataset.period; draw(); });
    const cls = $('#cls', el);
    if (cls) cls.onchange = () => { classId = cls.value; draw(); };
  };
  await draw();
};

/* ---------------- Aluno: desafios e conquistas ---------------- */
VIEWS.challenges = async el => {
  const d = await api('/api/challenges');
  const groups = [['active', '🔥 Em andamento'], ['upcoming', '🗓️ Em breve'], ['ended', '📁 Encerrados']];
  const earned = d.achievements.filter(a => a.earned_at).length;
  el.innerHTML = `<div class="stack">
    ${groups.map(([k, t]) => {
      const list = d.challenges.filter(c => c.state === k);
      return list.length ? `<div><h3 class="mb">${t}</h3><div class="grid g2">${list.map(c => challengeCard(c)).join('')}</div></div>` : '';
    }).join('')}
    <div class="card"><div class="card-head"><div><h3>🏅 Conquistas</h3><div class="sub">${earned} de ${d.achievements.length} desbloqueadas</div></div></div>
      <div class="ach-grid">${d.achievements.map(a => {
        const cur = d.metrics[a.metric] || 0;
        return `<div class="ach ${a.earned_at ? '' : 'locked'}"><div class="e">${a.icon}</div><b>${esc(a.name)}</b><span>${esc(a.description)}</span>
          ${a.earned_at ? `<span class="badge green">${fDate(a.earned_at)}</span>` : `<div class="progress"><i style="width:${Math.min(100, cur * 100 / a.threshold)}%"></i></div><span>${num(Math.min(cur, a.threshold))}/${num(a.threshold)}</span>`}</div>`;
      }).join('')}</div></div>
  </div>`;
};

/* ---------------- Aluno: histórico ---------------- */
VIEWS.history = async el => {
  const d = await api('/api/student/history');
  let tab = 'deliveries';
  const draw = () => {
    const content = tab === 'deliveries'
      ? d.deliveries.map(x => `<div class="li"><div class="emoji-box">${x.items[0]?.icon || '♻️'}</div><div class="grow">
          <div class="title">${x.items.map(i => `${i.quantity}× ${esc(i.name)}`).join(', ')}</div>
          <div class="meta">${fDateTime(x.created_at)} · validado por ${esc(x.staff_name)} · ${x.method === 'qr' ? 'QR Code' : 'matrícula'}</div></div>
          ${x.status !== 'approved' ? statusBadge(x.status) : ''}<div class="pts ${x.status === 'approved' ? 'pos' : ''}">${x.status === 'rejected' ? '0' : '+' + num(x.total_points)}</div></div>`).join('')
      : d.transactions.map(txRow).join('');
    el.innerHTML = `<div class="toolbar">${tabs([['deliveries', '♻️ Entregas'], ['tx', '💰 Extrato de pontos']], tab)}<div class="grow"></div><span class="chip">Saldo: <b>${num(d.balance)} pts</b></span></div>
      <div class="card"><div class="list">${content || emptyState('🕐', 'Nada por aqui ainda.')}</div></div>`;
    $$('[data-tab]', el).forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
  };
  draw();
};

/* ---------------- Funcionário: validar entrega ---------------- */
VIEWS.validate = async el => {
  const { materials } = await api('/api/materials');
  let student = null, method = 'manual', qrToken = null;
  const qty = {};

  const identify = async code => {
    try {
      const r = await api('/api/staff/lookup?code=' + encodeURIComponent(code));
      if (r.matches) return chooseMatch(r.matches);
      student = r.student; method = r.method; qrToken = r.qr_token || null;
      Object.keys(qty).forEach(k => delete qty[k]);
      if (!student.active) toast('Atenção: este aluno está desativado.', 'warn');
      drawItems();
    } catch (e) { toast(e.message, 'error'); }
  };

  const chooseMatch = list => {
    const m = modal({
      title: 'Selecione o aluno', body: `<div class="list">${list.map(s => `<div class="li" style="cursor:pointer" data-pick="${s.id}">${avatar(s, 'sm')}<div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">${esc(s.class_name || '')} · Matr. ${esc(s.registration)}</div></div>${icon('check')}</div>`).join('')}</div>`,
    });
    $$('[data-pick]', m.form).forEach(li => li.onclick = () => { m.close(); identify(list.find(s => s.id == li.dataset.pick).registration); });
  };

  const drawIdentify = () => {
    student = null;
    el.innerHTML = `<div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-head"><div><h3>1. Identifique o aluno</h3><div class="sub">Leia o QR Code da carteirinha ou do celular do aluno</div></div></div>
        <div id="reader" class="hidden"></div>
        <div class="scan-placeholder" id="scan-ph"><div><div class="e">📷</div><p>Toque em <b>Abrir câmera</b> para ler o QR Code</p></div></div>
        <div class="row mt" style="justify-content:center">
          <button class="btn primary" id="cam">${icon('camera')} Abrir câmera</button>
          <label class="btn">${icon('image')} Ler de imagem<input type="file" accept="image/*" id="qrfile" hidden></label>
        </div>
        <div class="or">ou</div>
        <form id="manual" class="row"><input class="input" name="code" style="flex:1" placeholder="Matrícula, e-mail ou nome do aluno" autocomplete="off"><button class="btn">${icon('search')} Buscar</button></form>
        <p class="small muted mt">💡 Teste rápido: digite <b>2026001</b> (aluna de demonstração).</p>
      </div>
      <div class="card"><div class="card-head"><h3>Tabela de pontos</h3></div>
        <div class="list">${materials.map(m => `<div class="li"><div class="emoji-box">${m.icon}</div><div class="grow"><div class="title">${esc(m.name)}</div><div class="meta">por ${esc(m.unit)} · máx. ${m.max_per_day}/dia por aluno</div></div><span class="badge green">+${m.points} pt${m.points > 1 ? 's' : ''}</span></div>`).join('')}</div>
        <div class="callout blue mt small">🛡️ Entregas fora do padrão (volume alto, muitos pontos no dia, repetição) vão automaticamente para revisão da coordenação.</div>
      </div></div>`;
    $('#cam', el).onclick = async () => {
      if (scanner) { stopScanner(); $('#reader', el).classList.add('hidden'); $('#scan-ph', el).classList.remove('hidden'); $('#cam', el).innerHTML = `${icon('camera')} Abrir câmera`; return; }
      $('#reader', el).classList.remove('hidden'); $('#scan-ph', el).classList.add('hidden');
      const ok = await startScanner('reader', code => identify(code));
      if (ok) $('#cam', el).innerHTML = `${icon('x')} Fechar câmera`;
      else { $('#reader', el).classList.add('hidden'); $('#scan-ph', el).classList.remove('hidden'); }
    };
    $('#qrfile', el).onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { identify(await scanImageFile(f)); } catch (err) { toast(err.message, 'error'); }
      e.target.value = '';
    };
    $('#manual', el).onsubmit = e => { e.preventDefault(); const c = e.target.code.value.trim(); if (c) identify(c); };
  };

  const totals = () => {
    let pts = 0, items = 0;
    materials.forEach(m => { const q = qty[m.id] || 0; pts += q * m.points; items += q; });
    return { pts, items };
  };

  const drawItems = () => {
    stopScanner();
    el.innerHTML = `<div class="stack">
      <div class="student-banner">${avatar(student, 'lg')}<div class="grow"><div class="row"><h3>${esc(student.name)}</h3>${method === 'qr' ? '<span class="badge green">✓ QR verificado</span>' : '<span class="badge amber">Identificação manual</span>'}</div>
        <div class="muted small">${esc(student.class_name || '')} · Matrícula ${esc(student.registration)}</div>
        <div class="small" style="margin-top:4px">Saldo <b>${num(student.balance)} pts</b> · Hoje: ${plural(student.today_deliveries, 'entrega', 'entregas')}, ${num(student.today_points)} pts</div></div>
        <button class="btn ghost" id="change">${icon('refresh')} Trocar aluno</button></div>
      <div class="card"><div class="card-head"><div><h3>2. Conte os materiais recebidos</h3><div class="sub">Confira se os itens estão limpos e separados corretamente</div></div></div>
        <div class="mat-grid">${materials.map(m => `<div class="mat" data-m="${m.id}"><div class="top"><span class="e">${m.icon}</span><div><div class="nm">${esc(m.name)}</div><div class="u">${esc(m.unit)} · +${m.points} pt${m.points > 1 ? 's' : ''}</div></div></div>
          <div class="stepper"><button type="button" data-dec aria-label="Menos">−</button><input type="number" min="0" max="500" value="0" inputmode="numeric" aria-label="Quantidade de ${esc(m.name)}"><button type="button" data-inc aria-label="Mais">+</button></div></div>`).join('')}</div>
        <div class="total-bar"><div><div class="t">Total da entrega</div><div class="v" id="tot">0 pts</div></div><div class="t" id="tot-items">0 itens</div>
          <button class="btn primary lg" id="confirm" disabled>${icon('check')} Validar entrega</button></div>
      </div></div>`;
    const update = () => {
      const t = totals();
      $('#tot', el).textContent = `+${num(t.pts)} pts`;
      $('#tot-items', el).textContent = plural(t.items, 'item', 'itens');
      $('#confirm', el).disabled = !t.items;
      $$('.mat', el).forEach(c => c.classList.toggle('on', (qty[c.dataset.m] || 0) > 0));
    };
    $$('.mat', el).forEach(card => {
      const id = card.dataset.m, input = $('input', card);
      const set = v => { v = Math.max(0, Math.min(500, parseInt(v) || 0)); qty[id] = v; input.value = v; update(); };
      $('[data-inc]', card).onclick = () => set((qty[id] || 0) + 1);
      $('[data-dec]', card).onclick = () => set((qty[id] || 0) - 1);
      input.oninput = () => set(input.value);
      input.onfocus = () => input.select();
    });
    $('#change', el).onclick = drawIdentify;
    $('#confirm', el).onclick = async () => {
      const btn = $('#confirm', el);
      btn.disabled = true;
      try {
        const items = Object.entries(qty).filter(([, q]) => q > 0).map(([material_id, quantity]) => ({ material_id: +material_id, quantity }));
        const r = await api('/api/staff/deliveries', { method: 'POST', body: { student_id: student.id, method, qr_token: qrToken, items } });
        drawResult(r);
      } catch (e) { toast(e.message, 'error', 6000); btn.disabled = false; }
    };
  };

  const drawResult = r => {
    const ok = r.status === 'approved';
    if (ok) confetti(r.challenges.length || r.achievements.length ? 110 : 50);
    el.innerHTML = `<div class="card result" style="max-width:560px;margin:0 auto">
      <div class="big">${ok ? '🎉' : '🔎'}</div>
      <h2>${ok ? `+${num(r.points)} pontos para ${esc(r.student.split(' ')[0])}!` : 'Entrega enviada para revisão'}</h2>
      <p class="muted" style="margin:8px 0 16px">${ok ? `${plural(r.items, 'item registrado', 'itens registrados')}. Novo saldo: <b>${num(r.balance)} pts</b>.` : `Os ${num(r.points)} pontos ficam retidos até a coordenação aprovar.`}</p>
      ${!ok ? `<div class="callout amber" style="text-align:left">⚠️<div><b>Motivos do sistema antifraude:</b><br>${r.flags.map(esc).join('<br>')}</div></div>` : ''}
      <div class="stack" style="gap:8px;margin-top:10px">
        ${r.challenges.map(c => `<div class="callout green">${c.icon}<div>Desafio concluído: <b>${esc(c.title)}</b> (+${c.bonus} pts bônus)</div></div>`).join('')}
        ${r.achievements.map(a => `<div class="callout blue">${a.icon}<div>Nova conquista: <b>${esc(a.name)}</b></div></div>`).join('')}
      </div>
      <button class="btn primary lg mt" id="again">${icon('scan')} Nova entrega</button></div>`;
    $('#again', el).onclick = drawIdentify;
  };

  drawIdentify();
};

/* ---------------- Funcionário: entregas do dia ---------------- */
VIEWS.today = async el => {
  let day = today(), mine = S.user.role === 'staff' ? '1' : '0';
  const draw = async () => {
    const d = await api(`/api/staff/deliveries?date=${day}&mine=${mine}`);
    const s = d.summary;
    el.innerHTML = `<div class="toolbar"><input type="date" class="input" id="day" value="${day}" max="${today()}">
        ${S.user.role === 'staff' ? tabs([['1', 'Minhas validações'], ['0', 'Toda a escola']], mine, 'data-mine') : ''}<div class="grow"></div>
        <a class="btn primary" href="#/validate">${icon('plus')} Nova entrega</a></div>
      <div class="grid g4 mb">
        <div class="card stat"><div class="label">Entregas</div><div class="value">${s.count}</div></div>
        <div class="card stat"><div class="label">Itens aprovados</div><div class="value">${num(s.items)}</div></div>
        <div class="card stat"><div class="label">Pontos distribuídos</div><div class="value">${num(s.points)}</div></div>
        <div class="card stat"><div class="label">Em revisão</div><div class="value" style="color:${s.pending ? 'var(--amber)' : 'inherit'}">${s.pending}</div></div>
      </div>
      <div class="card">${d.deliveries.length ? `<div class="table-wrap"><table><thead><tr><th>Hora</th><th>Aluno</th><th>Materiais</th><th>Validação</th><th>Status</th><th class="right">Pontos</th></tr></thead><tbody>
        ${d.deliveries.map(x => `<tr><td class="nowrap">${parseDate(x.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
          <td><div class="cell-user">${avatar({ name: x.student_name }, 'sm')}<div><b>${esc(x.student_name)}</b><span>${esc(x.class_name || '')} · ${esc(x.registration)}</span></div></div></td>
          <td>${x.items.map(i => `<span class="chip">${i.icon} ${i.quantity}</span>`).join(' ')}</td>
          <td class="small">${x.method === 'qr' ? '📱 QR' : '⌨️ Manual'}<br><span class="muted">${esc(x.staff_name)}</span></td>
          <td>${statusBadge(x.status)}</td><td class="right pts">${x.status === 'rejected' ? '—' : '+' + x.total_points}</td></tr>`).join('')}
        </tbody></table></div>` : emptyState('📭', 'Nenhuma entrega neste dia.')}</div>`;
    $('#day', el).onchange = e => { day = e.target.value || today(); draw(); };
    $$('[data-mine]', el).forEach(b => b.onclick = () => { mine = b.dataset.mine; draw(); });
  };
  await draw();
};

/* ---------------- Funcionário/Admin: retirada de prêmios ---------------- */
VIEWS.redemptions = async el => {
  let status = 'pending', code = '';
  const draw = async () => {
    const d = await api(`/api/staff/redemptions?status=${status}&code=${encodeURIComponent(code)}`);
    el.innerHTML = `<div class="toolbar"><form id="f" class="row grow"><input class="input" name="code" value="${esc(code)}" placeholder="Código do resgate (ex.: EP-1A2B3C)" style="flex:1;min-width:200px;text-transform:uppercase"><button class="btn">${icon('search')} Buscar</button></form>
      ${tabs([['pending', 'Pendentes'], ['delivered', 'Retirados'], ['cancelled', 'Cancelados'], ['all', 'Todos']], status, 'data-st')}</div>
      <div class="card">${d.redemptions.length ? `<div class="list">${d.redemptions.map(r => `<div class="li"><div class="emoji-box">${r.icon}</div>
        <div class="grow"><div class="title">${esc(r.reward_name)} <span class="chip" style="font-family:monospace">${esc(r.code)}</span></div>
        <div class="meta">${esc(r.student_name)} · ${esc(r.class_name || '')} · ${fDateTime(r.created_at)} · ${num(r.cost)} pts${r.handled_by_name ? ' · por ' + esc(r.handled_by_name) : ''}</div></div>
        ${r.status === 'pending' ? `<div class="actions"><button class="btn sm ghost" data-cancel="${r.id}">Cancelar</button><button class="btn sm primary" data-deliver="${r.id}">${icon('check')} Entregar</button></div>` : statusBadge(r.status)}
        </div>`).join('')}</div>` : emptyState('🎁', code ? 'Nenhum resgate com esse código.' : 'Nenhum resgate aqui.')}</div>`;
    $('#f', el).onsubmit = e => { e.preventDefault(); code = e.target.code.value.trim(); draw(); };
    $$('[data-st]', el).forEach(b => b.onclick = () => { status = b.dataset.st; code = ''; draw(); });
    $$('[data-deliver]', el).forEach(b => b.onclick = async () => {
      try { await api(`/api/staff/redemptions/${b.dataset.deliver}/deliver`, { method: 'POST' }); toast('Prêmio entregue ao aluno!'); draw(); } catch (e) { toast(e.message, 'error'); }
    });
    $$('[data-cancel]', el).forEach(b => b.onclick = async () => {
      if (!await confirmBox('Cancelar resgate?', 'Os pontos serão devolvidos ao aluno e o estoque reposto.', { submit: 'Cancelar resgate', danger: true })) return;
      try { await api(`/api/staff/redemptions/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Resgate cancelado e pontos estornados.'); draw(); } catch (e) { toast(e.message, 'error'); }
    });
  };
  await draw();
};

/* ---------------- Admin: visão geral ---------------- */
VIEWS.overview = async el => {
  const d = await api('/api/admin/overview');
  const mi = d.month_impact.items, pi = d.prev_month_items;
  const delta = pi ? Math.round((mi - pi) * 100 / pi) : null;
  const series = d.series.map(s => ({ label: parseDate(s.date + 'T12:00').getDate(), value: s.value, title: `${fDate(s.date + 'T12:00')}: ${s.value} itens` }));
  el.innerHTML = `<div class="stack">
    ${d.pending_reviews || d.open_alerts ? `<a href="#/fraud" class="callout amber" style="text-decoration:none">🛡️<div><b>${plural(d.pending_reviews, 'entrega aguarda', 'entregas aguardam')} revisão</b> e há ${plural(d.open_alerts, 'alerta antifraude aberto', 'alertas antifraude abertos')}. Clique para revisar.</div></a>` : ''}
    <div class="grid g4">
      <div class="card stat"><div class="label"><span class="stat-icon">♻️</span>Itens (30 dias)</div><div class="value">${num(mi)}</div><div class="hint">${delta === null ? '' : `<span class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}%</span> vs. 30 dias anteriores`}</div></div>
      <div class="card stat"><div class="label"><span class="stat-icon">👩‍🎓</span>Alunos participando</div><div class="value">${d.active_students_month}<span class="muted" style="font-size:17px">/${d.students}</span></div><div class="hint">${Math.round(d.active_students_month * 100 / Math.max(1, d.students))}% de engajamento em 30 dias</div></div>
      <div class="card stat"><div class="label"><span class="stat-icon">💰</span>Pontos distribuídos</div><div class="value">${num(d.points_distributed)}</div><div class="hint">${num(d.points_redeemed)} já trocados por recompensas</div></div>
      <div class="card stat"><div class="label"><span class="stat-icon">🎁</span>Resgates pendentes</div><div class="value">${d.redemptions_pending}</div><div class="hint"><a href="#/redemptions">Ver retiradas</a></div></div>
    </div>
    <div class="card"><div class="card-head"><div><h3>🌎 Impacto ambiental da escola</h3><div class="sub">Acumulado desde o início · ${num(d.deliveries)} entregas aprovadas</div></div></div>${impactCards(d.impact)}</div>
    <div class="grid g3">
      <div class="card span2"><div class="card-head"><h3>Itens recebidos por dia</h3><span class="sub">últimos 30 dias</span></div>${barChart(series, { height: 170, labelEvery: 3 })}</div>
      <div class="card"><div class="card-head"><h3>Por material</h3></div>${donut(d.materials.filter(m => m.qty).map(m => ({ label: `${m.icon} ${esc(m.name)}`, value: m.qty, color: m.color })), num(d.impact.items), 'itens')}</div>
    </div>
    <div class="grid g3">
      <div class="card"><div class="card-head"><h3>🏫 Turmas (30 dias)</h3><a class="small" href="#/ranking">Ranking</a></div>${hbars(d.classes.map(c => ({ label: esc(c.name), value: c.points, display: `${num(c.points)} pts` })))}</div>
      <div class="card"><div class="card-head"><h3>⭐ Destaques (30 dias)</h3></div><div class="list">${d.top_students.map((s, i) => `<div class="li"><div class="rank-n">${['🥇', '🥈', '🥉'][i] || i + 1}</div>${avatar(s, 'sm')}<div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">${esc(s.class_name || '')}</div></div><div class="pts pos">${num(s.points)}</div></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><h3>🎁 Recompensas mais trocadas</h3></div>${d.rewards.length ? hbars(d.rewards.map(r => ({ label: `${r.icon} ${esc(r.name)}`, value: r.qty, color: 'linear-gradient(90deg,#a78bfa,#7c3aed)' }))) : emptyState('🎁', 'Nenhum resgate ainda.')}</div>
    </div>
    <div class="card"><div class="card-head"><h3>Últimas entregas</h3><a class="small" href="#/today">Ver entregas do dia</a></div>
      <div class="table-wrap"><table><thead><tr><th>Quando</th><th>Aluno</th><th>Validado por</th><th>Itens</th><th>Status</th><th class="right">Pontos</th></tr></thead><tbody>
      ${d.recent.map(r => `<tr><td class="nowrap">${timeAgo(r.created_at)}</td><td>${esc(r.student_name)}</td><td>${esc(r.staff_name)}</td><td>${r.total_items}</td><td>${statusBadge(r.status)}</td><td class="right pts">+${r.total_points}</td></tr>`).join('')}
      </tbody></table></div></div>
  </div>`;
};

/* ---------------- Admin: materiais ---------------- */
VIEWS.materials = async el => {
  const { materials } = await api('/api/materials');
  el.innerHTML = `<div class="toolbar"><p class="muted grow">Defina quanto vale cada material, o limite diário por aluno (antifraude) e os fatores de impacto ambiental.</p>
      <button class="btn primary" id="new">${icon('plus')} Novo material</button></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Material</th><th>Pontos</th><th>Limite/dia</th><th>Peso</th><th>CO₂ evitado</th><th>Água</th><th>Status</th><th></th></tr></thead><tbody>
    ${materials.map(m => `<tr class="${m.active ? '' : 'inactive'}"><td><div class="cell-user"><div class="emoji-box" style="border-left:4px solid ${esc(m.color)}">${m.icon}</div><div><b>${esc(m.name)}</b><span>por ${esc(m.unit)}</span></div></div></td>
      <td><span class="badge green">+${m.points}</span></td><td>${m.max_per_day}</td><td>${num(m.weight_kg, 3)} kg</td><td>${num(m.co2_kg, 2)} kg</td><td>${num(m.water_l, 1)} L</td>
      <td>${m.active ? '<span class="badge green">Ativo</span>' : '<span class="badge gray">Inativo</span>'}</td>
      <td class="right"><button class="btn sm" data-edit="${m.id}">${icon('edit')} Editar</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const form = (m = {}) => modal({
    title: m.id ? 'Editar material' : 'Novo material', wide: true,
    body: `<div class="form-grid">
      ${field({ name: 'name', label: 'Nome', value: m.name, required: true })}
      ${field({ name: 'icon', label: 'Ícone (emoji)', value: m.icon || '♻️' })}
      ${field({ name: 'unit', label: 'Unidade de contagem', value: m.unit || 'unidade', hint: 'Ex.: garrafa, lata, caixa, maço' })}
      ${field({ name: 'points', label: 'Pontos por unidade', type: 'number', min: 0, value: m.points ?? 1, required: true })}
      ${field({ name: 'max_per_day', label: 'Limite por aluno/dia', type: 'number', min: 1, value: m.max_per_day ?? 20, hint: 'Acima disso a entrega vai para revisão' })}
      ${field({ name: 'color', label: 'Cor nos gráficos', type: 'color', value: m.color || '#16a34a' })}
      ${field({ name: 'weight_kg', label: 'Peso médio (kg)', type: 'number', step: '0.001', min: 0, value: m.weight_kg ?? 0.05 })}
      ${field({ name: 'co2_kg', label: 'CO₂ evitado (kg/un.)', type: 'number', step: '0.001', min: 0, value: m.co2_kg ?? 0.05 })}
      ${field({ name: 'water_l', label: 'Água preservada (L/un.)', type: 'number', step: '0.1', min: 0, value: m.water_l ?? 1 })}
      ${field({ name: 'energy_kwh', label: 'Energia economizada (kWh/un.)', type: 'number', step: '0.01', min: 0, value: m.energy_kwh ?? 0.1 })}
      ${field({ name: 'active', label: 'Material ativo (aceito nas entregas)', type: 'checkbox', value: m.id ? m.active : 1, full: true })}</div>`,
    onSubmit: async data => {
      await api(m.id ? `/api/admin/materials/${m.id}` : '/api/admin/materials', { method: m.id ? 'PUT' : 'POST', body: data });
      toast('Material salvo!'); VIEWS.materials(el);
    },
  });
  $('#new', el).onclick = () => form();
  $$('[data-edit]', el).forEach(b => b.onclick = () => form(materials.find(m => m.id == b.dataset.edit)));
};

/* ---------------- Admin: recompensas ---------------- */
VIEWS['rewards-admin'] = async el => {
  const { rewards } = await api('/api/admin/rewards');
  el.innerHTML = `<div class="toolbar"><p class="muted grow">Brindes, privilégios e benefícios que os alunos podem trocar pelos pontos.</p><button class="btn primary" id="new">${icon('plus')} Nova recompensa</button></div>
    <div class="rewards">${rewards.map(r => `<div class="card reward" style="${r.active ? '' : 'opacity:.55'}"><div class="art">${r.icon}</div>
      <div class="row between"><span class="chip">${esc(r.category)}</span>${r.active ? '' : '<span class="badge gray">Inativa</span>'}</div>
      <h4>${esc(r.name)}</h4><p class="desc">${esc(r.description || '')}</p>
      <div class="row between small muted"><span>Estoque: <b style="color:var(--text)">${r.stock === null ? '∞' : r.stock}</b></span><span>${r.redeemed} resgates</span></div>
      <div class="row between"><span class="cost">${num(r.cost)} pts</span><button class="btn sm" data-edit="${r.id}">${icon('edit')} Editar</button></div></div>`).join('')}</div>`;
  const form = (r = {}) => modal({
    title: r.id ? 'Editar recompensa' : 'Nova recompensa', wide: true,
    body: `<div class="form-grid">
      ${field({ name: 'name', label: 'Nome', value: r.name, required: true, full: true })}
      ${field({ name: 'description', label: 'Descrição', type: 'textarea', value: r.description, full: true })}
      ${field({ name: 'icon', label: 'Ícone (emoji)', value: r.icon || '🎁' })}
      ${field({ name: 'category', label: 'Categoria', type: 'select', value: r.category || 'Brinde', options: ['Brinde', 'Privilégio', 'Benefício', 'Experiência'].map(v => ({ value: v, label: v })) })}
      ${field({ name: 'cost', label: 'Custo em pontos', type: 'number', min: 1, value: r.cost ?? 20, required: true })}
      ${field({ name: 'stock', label: 'Estoque', type: 'number', min: 0, value: r.stock ?? '', hint: 'Deixe vazio para ilimitado' })}
      ${field({ name: 'active', label: 'Disponível para troca', type: 'checkbox', value: r.id ? r.active : 1, full: true })}</div>`,
    onSubmit: async data => {
      await api(r.id ? `/api/admin/rewards/${r.id}` : '/api/admin/rewards', { method: r.id ? 'PUT' : 'POST', body: data });
      toast('Recompensa salva!'); VIEWS['rewards-admin'](el);
    },
  });
  $('#new', el).onclick = () => form();
  $$('[data-edit]', el).forEach(b => b.onclick = () => form(rewards.find(r => r.id == b.dataset.edit)));
};

/* ---------------- Admin: desafios ---------------- */
VIEWS['challenges-admin'] = async el => {
  const [{ challenges }, { materials }] = await Promise.all([api('/api/admin/challenges'), api('/api/materials')]);
  const t = today();
  const state = c => c.start_date > t ? '<span class="badge blue">Em breve</span>' : c.end_date < t ? '<span class="badge gray">Encerrado</span>' : '<span class="badge green">Ativo</span>';
  el.innerHTML = `<div class="toolbar"><p class="muted grow">Desafios dão pontos bônus quando o aluno atinge a meta dentro do período.</p><button class="btn primary" id="new">${icon('plus')} Novo desafio</button></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Desafio</th><th>Meta</th><th>Bônus</th><th>Período</th><th>Concluíram</th><th>Status</th><th></th></tr></thead><tbody>
    ${challenges.map(c => `<tr class="${c.active ? '' : 'inactive'}"><td><div class="cell-user"><div class="emoji-box">${c.icon}</div><div><b>${esc(c.title)}</b><span>${esc(c.description || '')}</span></div></div></td>
      <td class="nowrap">${c.target} ${esc(c.material_name || 'itens (qualquer)')}</td><td><span class="badge blue">+${c.bonus}</span></td>
      <td class="nowrap small">${fDateLong(c.start_date)} → ${fDateLong(c.end_date)}</td><td>${c.completions} alunos</td><td>${c.active ? state(c) : '<span class="badge gray">Inativo</span>'}</td>
      <td class="right"><button class="btn sm" data-edit="${c.id}">${icon('edit')} Editar</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const form = (c = {}) => modal({
    title: c.id ? 'Editar desafio' : 'Novo desafio', wide: true,
    body: `<div class="form-grid">
      ${field({ name: 'title', label: 'Título', value: c.title, required: true })}
      ${field({ name: 'icon', label: 'Ícone (emoji)', value: c.icon || '🎯' })}
      ${field({ name: 'description', label: 'Descrição', type: 'textarea', value: c.description, full: true })}
      ${field({ name: 'material_id', label: 'Material', type: 'select', value: c.material_id ?? '', options: [{ value: '', label: 'Qualquer material' }, ...materials.map(m => ({ value: m.id, label: `${m.icon} ${m.name}` }))] })}
      ${field({ name: 'target', label: 'Meta (quantidade de itens)', type: 'number', min: 1, value: c.target ?? 10, required: true })}
      ${field({ name: 'bonus', label: 'Pontos bônus', type: 'number', min: 0, value: c.bonus ?? 10, required: true })}
      <div></div>
      ${field({ name: 'start_date', label: 'Início', type: 'date', value: c.start_date || t, required: true })}
      ${field({ name: 'end_date', label: 'Término', type: 'date', value: c.end_date || '', required: true })}
      ${field({ name: 'active', label: 'Desafio ativo', type: 'checkbox', value: c.id ? c.active : 1, full: true })}</div>`,
    onSubmit: async data => {
      await api(c.id ? `/api/admin/challenges/${c.id}` : '/api/admin/challenges', { method: c.id ? 'PUT' : 'POST', body: data });
      toast('Desafio salvo!'); VIEWS['challenges-admin'](el);
    },
  });
  $('#new', el).onclick = () => form();
  $$('[data-edit]', el).forEach(b => b.onclick = () => form(challenges.find(c => c.id == b.dataset.edit)));
};

/* ---------------- Admin: usuários ---------------- */
VIEWS.users = async el => {
  let role = 'student', q = '', classId = '';
  const { classes } = await api('/api/classes');
  const classOpts = [{ value: '', label: '— sem turma —' }, ...classes.map(c => ({ value: c.id, label: c.name }))];
  const draw = async () => {
    const { users } = await api(`/api/admin/users?role=${role}&q=${encodeURIComponent(q)}&class_id=${classId}`);
    el.innerHTML = `<div class="toolbar">${tabs([['student', '🎒 Alunos'], ['staff', '👷 Funcionários'], ['admin', '🏫 Admins']], role, 'data-role')}
      <form id="sf" class="row grow"><input class="input" name="q" value="${esc(q)}" placeholder="Buscar por nome, e-mail ou matrícula" style="flex:1;min-width:180px"></form>
      ${role === 'student' ? `<select class="input" id="cls"><option value="">Todas as turmas</option>${classes.map(c => `<option value="${c.id}" ${String(c.id) === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
      <button class="btn" id="new-class">${icon('plus')} Turma</button><button class="btn primary" id="new">${icon('plus')} Usuário</button></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Usuário</th>${role === 'student' ? '<th>Turma</th><th>Matrícula</th><th class="right">Saldo</th><th class="right">Total</th>' : '<th>E-mail</th>'}<th>Status</th><th></th></tr></thead><tbody>
      ${users.map(u => `<tr class="${u.active ? '' : 'inactive'}"><td><div class="cell-user">${avatar(u, 'sm')}<div><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div></div></td>
        ${role === 'student' ? `<td>${esc(u.class_name || '—')}</td><td>${esc(u.registration || '')}</td><td class="right pts">${num(u.balance)}</td><td class="right muted">${num(u.earned)}</td>` : `<td>${esc(u.email)}</td>`}
        <td>${u.active ? '<span class="badge green">Ativo</span>' : '<span class="badge gray">Inativo</span>'}</td>
        <td><div class="actions">${role === 'student' ? `<button class="btn sm" data-adjust="${u.id}" title="Ajustar pontos">💰</button><button class="btn sm" data-qr="${u.id}" title="Gerar novo QR Code">${icon('refresh')}</button>` : ''}<button class="btn sm" data-edit="${u.id}">${icon('edit')} Editar</button></div></td></tr>`).join('')}
      </tbody></table></div>${users.length ? '' : emptyState('🔍', 'Nenhum usuário encontrado.')}</div>`;
    $$('[data-role]', el).forEach(b => b.onclick = () => { role = b.dataset.role; classId = ''; draw(); });
    $('#sf', el).onsubmit = e => { e.preventDefault(); q = e.target.q.value.trim(); draw(); };
    const cls = $('#cls', el);
    if (cls) cls.onchange = () => { classId = cls.value; draw(); };
    $('#new', el).onclick = () => form({ role });
    $$('[data-edit]', el).forEach(b => b.onclick = () => form(users.find(u => u.id == b.dataset.edit)));
    $('#new-class', el).onclick = () => modal({
      title: 'Nova turma', body: `<div class="form-grid">${field({ name: 'name', label: 'Nome da turma', placeholder: 'Ex.: 9º Ano B', required: true })}${field({ name: 'shift', label: 'Turno', type: 'select', options: ['Manhã', 'Tarde', 'Noite', 'Integral'].map(v => ({ value: v, label: v })) })}</div>`,
      onSubmit: async data => { await api('/api/admin/classes', { method: 'POST', body: data }); toast('Turma criada!'); VIEWS.users(el); },
    });
    $$('[data-qr]', el).forEach(b => b.onclick = async () => {
      const u = users.find(x => x.id == b.dataset.qr);
      if (!await confirmBox('Gerar novo QR Code?', `O QR Code atual de <b>${esc(u.name)}</b> deixará de funcionar imediatamente. Use quando o aluno perder a carteirinha ou houver suspeita de uso indevido.`, { submit: 'Gerar novo QR' })) return;
      try { await api(`/api/admin/users/${u.id}/reset-qr`, { method: 'POST' }); toast('Novo QR Code gerado. O anterior foi invalidado.'); } catch (e) { toast(e.message, 'error'); }
    });
    $$('[data-adjust]', el).forEach(b => b.onclick = () => {
      const u = users.find(x => x.id == b.dataset.adjust);
      modal({
        title: `Ajustar pontos — ${u.name}`, submit: 'Aplicar ajuste',
        body: `<p class="muted mb">Saldo atual: <b>${num(u.balance)} pts</b>. Use valores negativos para remover pontos. Todo ajuste fica registrado na auditoria.</p>
          <div class="form-grid">${field({ name: 'points', label: 'Pontos (+/−)', type: 'number', value: 5, required: true })}${field({ name: 'reason', label: 'Motivo', placeholder: 'Ex.: ajuda no mutirão de limpeza', required: true })}</div>`,
        onSubmit: async data => { const r = await api(`/api/admin/users/${u.id}/adjust`, { method: 'POST', body: data }); toast(`Ajuste aplicado. Novo saldo: ${r.balance} pts`); draw(); },
      });
    });
  };
  const form = (u = {}) => modal({
    title: u.id ? 'Editar usuário' : 'Novo usuário', wide: true,
    body: `<div class="form-grid">
      ${field({ name: 'name', label: 'Nome completo', value: u.name, required: true })}
      ${field({ name: 'email', label: 'E-mail', type: 'email', value: u.email, required: true })}
      ${field({ name: 'role', label: 'Perfil', type: 'select', value: u.role || 'student', options: [{ value: 'student', label: 'Aluno' }, { value: 'staff', label: 'Funcionário' }, { value: 'admin', label: 'Administrador' }] })}
      ${field({ name: 'class_id', label: 'Turma (alunos)', type: 'select', value: u.class_id ?? '', options: classOpts })}
      ${field({ name: 'password', label: u.id ? 'Nova senha' : 'Senha', type: 'password', placeholder: u.id ? 'Deixe vazio para manter' : 'Padrão: 123456', hint: 'Mínimo 6 caracteres' })}
      ${u.id ? field({ name: 'active', label: 'Usuário ativo', type: 'checkbox', value: u.active }) : ''}</div>`,
    onSubmit: async data => {
      if (!data.password) delete data.password;
      const r = await api(u.id ? `/api/admin/users/${u.id}` : '/api/admin/users', { method: u.id ? 'PUT' : 'POST', body: data });
      toast(u.id ? 'Usuário atualizado!' : `Usuário criado!${r.registration ? ' Matrícula ' + r.registration : ''}`);
      draw();
    },
  });
  await draw();
};

/* ---------------- Admin: antifraude ---------------- */
VIEWS.fraud = async el => {
  let showAll = false;
  const draw = async () => {
    const d = await api('/api/admin/fraud' + (showAll ? '?resolved=all' : ''));
    const sev = { high: '<span class="badge red">Alta</span>', medium: '<span class="badge amber">Média</span>', low: '<span class="badge gray">Baixa</span>' };
    const typeLbl = { review: '🔎 Revisão', duplicate: '⏱️ Duplicidade', login: '🔐 Login', staff: '👷 Funcionário' };
    el.innerHTML = `<div class="stack">
      <div class="card"><div class="card-head"><div><h3>🔎 Entregas aguardando revisão</h3><div class="sub">Os pontos só são creditados depois da aprovação</div></div><span class="badge ${d.pending.length ? 'amber' : 'green'}">${d.pending.length} pendentes</span></div>
        ${d.pending.length ? `<div class="list">${d.pending.map(p => `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${avatar({ name: p.student_name }, 'sm')}
          <div class="grow" style="min-width:220px"><div class="title">${esc(p.student_name)} <span class="muted small">· ${esc(p.class_name || '')} · validado por ${esc(p.staff_name)} (${p.method === 'qr' ? 'QR' : 'manual'}) · ${fDateTime(p.created_at)}</span></div>
            <div class="row" style="margin:6px 0">${p.items.map(i => `<span class="chip">${i.icon} ${i.quantity}× ${esc(i.name)}</span>`).join('')}<b class="pts">${p.total_points} pts</b></div>
            <div class="callout amber small" style="padding:8px 12px">⚠️ ${esc(p.flag_reason)}</div></div>
          <div class="actions"><button class="btn sm danger" data-rev="${p.id}" data-act="reject">${icon('x')} Recusar</button><button class="btn sm primary" data-rev="${p.id}" data-act="approve">${icon('check')} Aprovar</button></div></div>`).join('')}</div>`
        : emptyState('✅', 'Nenhuma entrega suspeita no momento.')}</div>

      <div class="grid g2" style="align-items:start">
        <div class="card"><div class="card-head"><h3>🚨 Alertas</h3><label class="check small"><input type="checkbox" id="all" ${showAll ? 'checked' : ''}> Mostrar resolvidos</label></div>
          <div class="list">${d.alerts.map(a => `<div class="li" style="align-items:flex-start"><div class="grow"><div class="row" style="gap:6px">${sev[a.severity]}<span class="chip">${typeLbl[a.type] || a.type}</span><span class="meta">${timeAgo(a.created_at)}</span></div>
            <div style="margin-top:6px;font-size:14px">${esc(a.message)}</div>
            <div class="meta">${a.student_name ? 'Aluno: ' + esc(a.student_name) : ''}${a.staff_name ? ' · Funcionário: ' + esc(a.staff_name) : ''}${a.resolved ? ' · ✓ resolvido por ' + esc(a.resolved_by_name || '') : ''}</div></div>
            ${a.resolved ? '' : `<button class="btn sm" data-resolve="${a.id}">${icon('check')} Resolver</button>`}</div>`).join('') || emptyState('🛡️', 'Nenhum alerta aberto.')}</div></div>

        <div class="stack">
          <div class="card"><div class="card-head"><h3>⚙️ Regras antifraude</h3></div>
            <form id="settings">${d.settings.map(s => `<div class="setting-row"><label for="s-${s.key}">${esc(s.label)}</label><input id="s-${s.key}" type="number" min="0" name="${s.key}" value="${s.value}"></div>`).join('')}
            <button class="btn primary block mt">Salvar regras</button></form></div>
          <div class="card"><div class="card-head"><h3>👷 Validações por funcionário</h3><span class="sub">últimos 30 dias</span></div>
            <div class="table-wrap"><table><thead><tr><th>Funcionário</th><th class="right">Total</th><th class="right">Manuais</th><th class="right">Revisão</th><th class="right">Recusadas</th></tr></thead><tbody>
            ${d.staff.map(s => `<tr><td>${esc(s.name)}</td><td class="right">${s.total}</td><td class="right">${s.manual || 0}</td><td class="right">${s.pending || 0}</td><td class="right">${s.rejected || 0}</td></tr>`).join('')}</tbody></table></div></div>
        </div>
      </div>

      <div class="card"><div class="card-head"><h3>Como o EcoPoint evita fraudes</h3></div><div class="grid g2">
        ${[['📱', 'QR Code pessoal e revogável', 'Cada aluno tem um token único. Se a carteirinha for perdida, a coordenação gera outro e o antigo para de funcionar.'],
           ['⏱️', 'Bloqueio de duplicidade', 'O mesmo aluno não pode receber duas entregas em sequência num intervalo curto (clique duplo, reenvio).'],
           ['📦', 'Limites por material e por dia', 'Quantidades acima do normal, ou pontos demais no dia, seguram os pontos até a coordenação revisar.'],
           ['🤝', 'Detecção de conluio', 'Muitas entregas do mesmo par funcionário–aluno, ou validações rápidas demais de um funcionário, geram alerta.'],
           ['🔐', 'Login protegido', 'Senhas com hash PBKDF2 e bloqueio temporário após várias tentativas erradas.'],
           ['📝', 'Auditoria completa', 'Toda validação, resgate, ajuste de pontos e alteração de regra fica registrada com usuário, data e IP.']]
          .map(([e, t, x]) => `<div class="rule"><span class="e">${e}</span><div><b>${t}</b><div class="small muted">${x}</div></div></div>`).join('')}
      </div></div>
    </div>`;
    $$('[data-rev]', el).forEach(b => b.onclick = async () => {
      const approve = b.dataset.act === 'approve';
      if (!await confirmBox(approve ? 'Aprovar entrega?' : 'Recusar entrega?', approve ? 'Os pontos serão creditados ao aluno.' : 'A entrega será marcada como recusada e nenhum ponto será creditado.', { submit: approve ? 'Aprovar' : 'Recusar', danger: !approve })) return;
      try { await api(`/api/admin/deliveries/${b.dataset.rev}/${b.dataset.act}`, { method: 'POST' }); toast(approve ? 'Entrega aprovada e pontos creditados.' : 'Entrega recusada.'); draw(); refreshBadges(); }
      catch (e) { toast(e.message, 'error'); }
    });
    $$('[data-resolve]', el).forEach(b => b.onclick = async () => {
      try { await api(`/api/admin/alerts/${b.dataset.resolve}/resolve`, { method: 'POST' }); toast('Alerta resolvido.'); draw(); refreshBadges(); } catch (e) { toast(e.message, 'error'); }
    });
    $('#all', el).onchange = e => { showAll = e.target.checked; draw(); };
    $('#settings', el).onsubmit = async e => {
      e.preventDefault();
      try { await api('/api/admin/settings', { method: 'PUT', body: formData(e.target) }); toast('Regras atualizadas!'); } catch (err) { toast(err.message, 'error'); }
    };
  };
  await draw();
};

/* ---------------- Admin: auditoria ---------------- */
VIEWS.audit = async el => {
  const { log } = await api('/api/admin/audit');
  const labels = {
    login: '🔐 Login', delivery: '♻️ Entrega', delivery_blocked: '⛔ Entrega bloqueada', delivery_approved: '✅ Entrega aprovada', delivery_rejected: '❌ Entrega recusada',
    redeem: '🎁 Resgate', redemption_deliver: '📦 Prêmio entregue', redemption_cancel: '↩️ Resgate cancelado', points_adjust: '💰 Ajuste de pontos',
    qr_reset: '🔄 QR regenerado', settings_update: '⚙️ Regras alteradas', user_create: '👤 Usuário criado', user_update: '👤 Usuário editado',
    material_create: '📦 Material criado', material_update: '📦 Material editado', reward_create: '🎁 Recompensa criada', reward_update: '🎁 Recompensa editada',
    challenge_create: '🎯 Desafio criado', challenge_update: '🎯 Desafio editado', alert_resolve: '🛡️ Alerta resolvido', class_create: '🏫 Turma criada', seed: '🌱 Dados iniciais',
  };
  el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Registro de auditoria</h3><div class="sub">Últimas 300 ações no sistema</div></div></div>
    <div class="table-wrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Detalhes</th><th>IP</th></tr></thead><tbody>
    ${log.map(l => `<tr><td class="nowrap small">${fDateTime(l.created_at)}</td><td class="nowrap">${esc(l.user_name || '—')} <span class="muted small">${ROLE_LABEL[l.role] || ''}</span></td>
      <td class="nowrap">${labels[l.action] || esc(l.action)}</td><td class="small" style="max-width:420px">${esc(l.details || '')}</td><td class="small muted">${esc(l.ip || '')}</td></tr>`).join('')}
    </tbody></table></div></div>`;
};

/* ---------------- Boot ---------------- */
window.addEventListener('hashchange', render);
(async function boot() {
  if (S.token) {
    try { S.user = (await api('/api/me')).user; }
    catch { S.token = null; store.set('ep_token', null); }
  }
  render();
})();
