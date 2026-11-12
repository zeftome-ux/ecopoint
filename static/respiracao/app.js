/* =====================================================================
   Interface: liga motor → anatomia → fórmula → gráfico → explicações.
   Um único snapshot do modelo por quadro alimenta todos os elementos.
   ===================================================================== */
(function () {
  'use strict';
  var M = window.BreathModel, A = window.BreathAnatomy;
  var $ = function (id) { return document.getElementById(id); };
  var engine = M.createEngine();
  var S = engine.state;
  var scene = A.create($('anatomy'));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var fmt = function (n) { return Math.round(n).toLocaleString('pt-BR'); };
  var signed = function (n, u) { var r = Math.round(n); return r === 0 ? '0 ' + u : (r > 0 ? '+' : '−') + fmt(Math.abs(r)) + ' ' + u; };
  function setText(el, t) { if (el.textContent !== t) el.textContent = t; }

  /* ---------------- textos das etapas ---------------- */
  var STEPS = {
    insp: [
      ['O diafragma contrai e desce', 'O diafragma se contrai e desce, aumentando o espaço disponível para os pulmões.'],
      ['O volume aumenta, a pressão diminui', 'Com o aumento do volume, a pressão interna diminui.'],
      ['O ar entra', 'Como a pressão interna fica menor que a pressão atmosférica, o ar entra nos pulmões até as pressões se igualarem.']
    ],
    exp: [
      ['O diafragma relaxa e sobe', 'O diafragma relaxa, sobe e volta à forma de cúpula.'],
      ['O volume diminui, a pressão aumenta', 'O volume pulmonar diminui e a pressão interna aumenta.'],
      ['O ar sai', 'Quando a pressão interna supera a pressão atmosférica, o ar sai dos pulmões.']
    ]
  };
  var stepEls = Array.prototype.slice.call(document.querySelectorAll('#steps li'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('#stepDots i'));
  var shownPhase = null;
  function fillSteps(phase) {
    STEPS[phase].forEach(function (st, i) {
      stepEls[i].querySelector('b').textContent = st[0];
      stepEls[i].querySelector('p').textContent = st[1];
    });
  }

  function stepIndex() {
    if (S.stage === 'hold') return 2;
    var p = S.phase === 'insp' ? S.d : 1 - S.d;
    var dp = Math.abs(engine.pressure() - M.PATM);
    if (S.mode === 'manual' && S.still > 0.25 && dp > 0.3) return 2;
    return p < 0.35 ? 0 : p < 0.75 ? 1 : 2;
  }

  /* ---------------- gráfico P × V ---------------- */
  var C = { x0: 44, x1: 300, y0: 164, y1: 14, vmin: 3990, vmax: 4058, pmin: 748, pmax: 772 };
  var sx = function (V) { return C.x0 + (V - C.vmin) / (C.vmax - C.vmin) * (C.x1 - C.x0); };
  var sy = function (P) { return C.y0 - (P - C.pmin) / (C.pmax - C.pmin) * (C.y0 - C.y1); };
  var chart = (function () {
    var svg = $('pvChart'), NS = 'http://www.w3.org/2000/svg';
    function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; }
    [751, 760, 769].forEach(function (P) {
      el('line', { 'class': 'grid', x1: C.x0, x2: C.x1, y1: sy(P), y2: sy(P) });
      el('text', { 'class': 'tick', x: C.x0 - 6, y: sy(P) + 3.5, 'text-anchor': 'end' }).textContent = P;
    });
    [4000, 4024, 4048].forEach(function (V) {
      el('line', { 'class': 'grid', x1: sx(V), x2: sx(V), y1: C.y1, y2: C.y0 });
      el('text', { 'class': 'tick', x: sx(V), y: C.y0 + 14, 'text-anchor': 'middle' }).textContent = fmt(V);
    });
    el('line', { 'class': 'axis', x1: C.x0, x2: C.x1, y1: C.y0, y2: C.y0 });
    el('line', { 'class': 'axis', x1: C.x0, x2: C.x0, y1: C.y1, y2: C.y0 });
    el('text', { 'class': 'title', x: C.x1, y: C.y0 + 30, 'text-anchor': 'end' }).textContent = 'Volume (mL)';
    el('text', { 'class': 'title', x: 4, y: 8 }).textContent = 'Pressão (mmHg)';
    el('text', { 'class': 'tick', x: C.x1, y: sy(760) - 5, 'text-anchor': 'end' }).textContent = 'ar externo';
    function curve(n) {
      var d = '';
      for (var V = C.vmin; V <= C.vmax; V += 2) d += (d ? ' L ' : 'M ') + sx(V).toFixed(1) + ' ' + sy(760 * n / V).toFixed(1);
      return d;
    }
    function range(n) { return 'M ' + sx(4000) + ' ' + sy(760 * n / 4000) + ' L ' + sx(4048) + ' ' + sy(760 * n / 4048); }
    var r1 = el('path', { 'class': 'range', d: range(4000) });
    var r2 = el('path', { 'class': 'range', d: range(4048) });
    var c1 = el('path', { 'class': 'curve', d: curve(4000) });
    var c2 = el('path', { 'class': 'curve', d: curve(4048) });
    var cur = el('path', { 'class': 'curve' });
    var gv = el('line', { 'class': 'guide-v' });
    var gp = el('line', { 'class': 'guide-p' });
    el('circle', { 'class': 'start', cx: sx(4000), cy: sy(760), r: 4.5 });
    var dot = el('circle', { 'class': 'dot', r: 7 });
    var vtag = el('text', { 'class': 'vtag', 'text-anchor': 'middle' });
    var ptag = el('text', { 'class': 'ptag', 'text-anchor': 'start' });
    return function (snap) {
      var x = sx(snap.V), y = sy(snap.P);
      var t = (snap.n - 4000) / 48;
      c1.style.opacity = (0.18 + 0.5 * (1 - t)).toFixed(2);
      c2.style.opacity = (0.18 + 0.5 * t).toFixed(2);
      r1.style.opacity = (0.25 * (1 - t)).toFixed(2);
      r2.style.opacity = (0.25 * t).toFixed(2);
      cur.setAttribute('d', (t > 0.02 && t < 0.98) ? curve(snap.n) : '');
      dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
      gv.setAttribute('x1', x.toFixed(1)); gv.setAttribute('x2', x.toFixed(1)); gv.setAttribute('y1', y.toFixed(1)); gv.setAttribute('y2', C.y0);
      gp.setAttribute('x1', C.x0); gp.setAttribute('x2', x.toFixed(1)); gp.setAttribute('y1', y.toFixed(1)); gp.setAttribute('y2', y.toFixed(1));
      vtag.setAttribute('x', x.toFixed(1)); vtag.setAttribute('y', (C.y0 - 6).toFixed(1));
      ptag.setAttribute('x', (x + 11).toFixed(1)); ptag.setAttribute('y', (y + 4).toFixed(1));
      setText(vtag, masks.V ? '?' : fmt(snap.V));
      setText(ptag, masks.P ? '?' : fmt(snap.P));
    };
  })();

  /* ---------------- máscaras do modo Experimente ---------------- */
  var masks = { P: false, V: false, flow: false };
  var maskTargets = {
    P: ['fP2', 'mP', 'chipP', 'fK', 'fK1', 'dP'],
    V: ['fV2', 'mV', 'fK', 'fK1', 'dV', 'fV1']
  };
  function setMask(list) {
    masks.P = list.indexOf('P') >= 0;
    masks.V = list.indexOf('V') >= 0;
    masks.flow = list.indexOf('flow') >= 0;
    var all = {};
    Object.keys(maskTargets).forEach(function (k) { maskTargets[k].forEach(function (id) { all[id] = all[id] || masks[k]; }); });
    Object.keys(all).forEach(function (id) { $(id).classList.toggle('masked', all[id]); });
    $('barP').style.visibility = masks.P ? 'hidden' : '';
    $('barV').style.visibility = masks.V ? 'hidden' : '';
    $('trendP').style.visibility = masks.P ? 'hidden' : '';
    $('trendV').style.visibility = masks.V ? 'hidden' : '';
    $('chipCmp').style.visibility = masks.P || masks.flow ? 'hidden' : '';
  }

  /* ---------------- controles ---------------- */
  var slider = $('dSlider');
  var dragging = false;
  function syncPlayButton() {
    $('playIco').setAttribute('d', S.playing ? 'M6 4.5h2.8v11H6zM11.2 4.5H14v11h-2.8z' : 'M6 4.5v11l9-5.5z');
    setText($('playLabel'), S.playing ? 'Pausar' : 'Reproduzir');
    $('btnPlay').setAttribute('aria-label', S.playing ? 'Pausar' : 'Reproduzir');
  }
  $('btnPlay').addEventListener('click', function () { S.playing ? engine.pause() : engine.play(); syncPlayButton(); });
  $('btnReset').addEventListener('click', function () {
    engine.reset();
    scene.dots.forEach(function (p) { p.s = Math.random(); });
    syncPlayButton();
  });
  $('btnSwitch').addEventListener('click', function () { engine.switchPhase(); syncPlayButton(); });
  Array.prototype.forEach.call(document.querySelectorAll('#speedSeg button'), function (b) {
    b.addEventListener('click', function () {
      engine.setSpeed(parseFloat(b.dataset.speed));
      Array.prototype.forEach.call(document.querySelectorAll('#speedSeg button'), function (o) { o.setAttribute('aria-checked', String(o === b)); });
    });
  });
  $('loopToggle').addEventListener('change', function (e) { engine.setLoop(e.target.checked); });
  slider.addEventListener('input', function () {
    engine.setManual(slider.value / 1000);
    syncPlayButton();
  });
  slider.addEventListener('pointerdown', function () { dragging = true; });
  window.addEventListener('pointerup', function () { dragging = false; });

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range' && e.key !== ' ') return;
    if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('btnPlay').click(); }
    else if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) $('btnReset').click();
  });

  /* ---------------- modos ---------------- */
  var mode = 'sim';
  var quiz = window.BreathQuiz.create({
    count: $('quizCount'), q: $('quizQ'), hint: $('quizHint'), opts: $('quizOpts'),
    fb: $('quizFb'), fbTitle: $('fbTitle'), fbText: $('fbText'), next: $('quizNext'), replay: $('quizReplay')
  }, {
    prepare: function (start) { engine.prepare(start); syncPlayButton(); },
    setMask: setMask,
    demo: function (start, phase) { engine.demo(start, phase); syncPlayButton(); },
    onProgress: function (i, n) { quizProgress = [i, n]; }
  });
  var quizProgress = [0, 5];
  function setMode(m) {
    mode = m;
    $('tabSim').setAttribute('aria-selected', String(m === 'sim'));
    $('tabQuiz').setAttribute('aria-selected', String(m === 'quiz'));
    $('explainPanel').hidden = m !== 'sim';
    $('quizPanel').hidden = m !== 'quiz';
    if (m === 'quiz') { quiz.start(); }
    else { quiz.stop(); engine.reset(); engine.play(); }
    syncPlayButton();
  }
  $('tabSim').addEventListener('click', function () { if (mode !== 'sim') setMode('sim'); });
  $('tabQuiz').addEventListener('click', function () { if (mode !== 'quiz') setMode('quiz'); });

  /* ---------------- renderização ---------------- */
  var prevSnap = null, trendP = 0, trendV = 0;
  var PEAK_V = Math.PI / (2 * S.durations.insp);   // velocidade máxima de d em 1×

  function render(dt) {
    var snap = M.snapshot(S.d, S.n);
    var dpNorm = -(snap.P - M.PATM) / 9;             // + = pressão abaixo da externa → ar entra
    var flow = Math.max(-1.2, Math.min(1.2, dpNorm));
    if (Math.abs(snap.P - M.PATM) < 0.05) flow = 0;

    A.render(scene, S.d, { flow: flow, move: S.velocity / PEAK_V, dt: dt, showFlow: !masks.flow });

    // tendência (setas ↑ ↓ ao lado de P2 e V2)
    if (prevSnap && dt > 0) {
      var k = 1 - Math.exp(-dt / 0.15);
      trendP += ((snap.P - prevSnap.P) / dt - trendP) * k;
      trendV += ((snap.V - prevSnap.V) / dt - trendV) * k;
    }
    prevSnap = snap;
    function trend(el, v, th) {
      var on = Math.abs(v) > th;
      el.classList.toggle('show', on);
      if (on) setText(el, v > 0 ? '↑' : '↓');
    }
    trend($('trendP'), trendP, 0.4);
    trend($('trendV'), trendV, 2);

    // fórmula
    setText($('fV1'), fmt(snap.n));
    setText($('fP2'), fmt(snap.P));
    setText($('fV2'), fmt(snap.V));
    setText($('fK1'), fmt(snap.product));
    setText($('fK'), fmt(snap.P * snap.V));
    var eq = Math.abs(snap.n - snap.Vr) > 0.5 && (S.stage === 'hold' || (S.mode === 'manual' && S.still > 0.25));
    var kn = $('fKnote');
    if (eq && !masks.flow) {
      setText(kn, flow > 0 ? 'ar entrando: V₁ cresce' : 'ar saindo: V₁ diminui');
      kn.className = 'k ' + (flow > 0 ? 'in' : 'out');
    } else { setText(kn, '= constante ='); kn.className = 'k'; }

    // comparação
    setText($('mV1'), fmt(snap.n));
    setText($('mV'), fmt(snap.V));
    setText($('mP'), fmt(snap.P));
    setText($('dV'), signed(snap.Vr - snap.nr, 'mL'));
    var dpR = snap.Pr - M.PATM;
    setText($('dP'), dpR === 0 ? 'igual à de fora' : signed(dpR, 'mmHg') + ' vs. fora');
    $('barV').style.width = ((snap.V - M.V1) / M.DV * 100).toFixed(2) + '%';
    var half = Math.min(1, Math.abs(snap.P - M.PATM) / 9.2) * 50;
    var bp = $('barP');
    bp.style.width = half.toFixed(2) + '%';
    bp.style.left = (snap.P < M.PATM ? 50 - half : 50).toFixed(2) + '%';
    slider.style.setProperty('--fill', (S.d * 100).toFixed(2) + '%');
    if (!dragging && S.mode !== 'manual') slider.value = Math.round(S.d * 1000);

    // chip da pressão interna
    setText($('chipP'), fmt(snap.P));
    var cmp = $('chipCmp');
    if (dpR < 0) { setText(cmp, 'menor que fora · o ar entra'); cmp.className = 'chip-cmp in'; }
    else if (dpR > 0) { setText(cmp, 'maior que fora · o ar sai'); cmp.className = 'chip-cmp out'; }
    else { setText(cmp, 'igual à de fora · ar parado'); cmp.className = 'chip-cmp'; }

    chart(snap);

    // fase, etapa, fluxo
    var phase = S.phase;
    if (phase !== shownPhase) { fillSteps(phase); shownPhase = phase; }
    var pill = $('phasePill');
    pill.dataset.phase = phase;
    setText($('phaseName'), phase === 'insp' ? 'Inspiração' : 'Expiração');
    $('phaseIco').setAttribute('d', phase === 'insp' ? 'M10 3v12m0 0-4.5-4.5M10 15l4.5-4.5' : 'M10 17V5m0 0L5.5 9.5M10 5l4.5 4.5');
    var tag = $('pausedTag');
    tag.hidden = S.playing;
    setText(tag, S.mode === 'manual' ? 'controle manual' : 'pausado');

    var si = stepIndex();
    stepEls.forEach(function (li, i) { li.classList.toggle('on', i === si); li.classList.toggle('done', i < si); });
    if (mode === 'sim') {
      dots.forEach(function (d, i) { d.classList.toggle('on', i <= si); });
      setText($('stepInfo'), 'Etapa ' + (si + 1) + ' de 3 · ' + STEPS[phase][si][0]);
    } else {
      dots.forEach(function (d, i) { d.classList.remove('on'); });
      setText($('stepInfo'), quizProgress[0] >= quizProgress[1] ? 'Resultado' : 'Pergunta ' + (quizProgress[0] + 1) + ' de ' + quizProgress[1]);
    }
    setText($('switchLabel'), phase === 'insp' ? 'Ir para expiração' : 'Ir para inspiração');

    var fs = $('flowState');
    if (masks.flow) { fs.dataset.flow = ''; setText($('flowText'), 'Fluxo de ar oculto'); }
    else if (flow > 0.04) { fs.dataset.flow = 'in'; setText($('flowText'), 'Ar entrando pela traqueia'); }
    else if (flow < -0.04) { fs.dataset.flow = 'out'; setText($('flowText'), 'Ar saindo pela traqueia'); }
    else { fs.dataset.flow = ''; setText($('flowText'), 'Ar parado: pressões iguais'); }
  }

  var last = performance.now();
  var wasPlaying = S.playing;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    engine.tick(dt);
    render(dt);
    if (wasPlaying !== S.playing) { syncPlayButton(); wasPlaying = S.playing; }
    requestAnimationFrame(frame);
  }

  fillSteps('insp'); shownPhase = 'insp';
  if (!reduceMotion) engine.play();
  syncPlayButton();
  render(0);
  requestAnimationFrame(frame);

  // interface de inspeção (testes automatizados e uso em sala)
  window.Respiracao = {
    engine: engine, model: M,
    snapshot: function () { return M.snapshot(S.d, S.n); },
    tick: function (dt) { engine.tick(dt); render(dt); }
  };
})();
