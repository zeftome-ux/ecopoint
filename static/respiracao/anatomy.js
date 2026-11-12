/* =====================================================================
   Anatomia procedural (SVG)
   Toda a geometria é função de d (contração do diafragma). A base dos
   pulmões é calculada a partir da própria curva do diafragma, então os
   dois nunca se separam.
   viewBox: 0 0 640 560 · eixo central x = 320
   ===================================================================== */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var W = 640;
  var APEX_Y = 106;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var f1 = function (n) { return Math.round(n * 10) / 10; };

  /* ---------- Diafragma: duas cúpulas, a direita anatômica mais alta ---------- */
  var DX0 = 124, DX1 = 516;
  function diaphragmY(x, d) {
    var t = clamp((x - DX0) / (DX1 - DX0), 0, 1);
    var edge = 452 + 10 * d;                // inserção nas costelas desce um pouco
    var H = 96 - 52 * d;                    // altura da cúpula: 96 → 44 (achata)
    var dome = Math.pow(Math.sin(Math.PI * t), 0.9);
    var tendon = 1 - 0.10 * Math.exp(-Math.pow((t - 0.52) / 0.11, 2)); // centro tendíneo
    var asym = 1 + 0.10 * (0.5 - t);
    return edge - H * dome * tendon * asym;
  }

  /* ---------- Transformação de expansão pulmonar ---------- */
  function lungScale(d) {
    var ref0 = diaphragmY(220, 0) - APEX_Y;
    var ref = diaphragmY(220, d) - APEX_Y;
    return { sy: ref / ref0, lat: 9 * d };
  }
  // side 'R' = pulmão direito anatômico = lado esquerdo da tela
  function mapX(side, x) { return side === 'R' ? x : W - x; }
  function makeP(side, sc) {
    return function (x, y) {
      var dx = (x - 300) * (1 + sc.lat / 160);     // expansão lateral (costelas)
      return [mapX(side, 300 + dx), APEX_Y + (y - APEX_Y) * sc.sy];
    };
  }

  function lungPath(side, d) {
    var lat = 9 * d;
    var m = function (x) { return f1(mapX(side, x)); };
    var notch = side === 'L';
    var xc = 140 - lat;
    var yc = diaphragmY(mapX(side, xc), d) + 4;
    var xm = notch ? 272 : 296;
    var s = 'M ' + m(262) + ' ' + APEX_Y +
      ' C ' + m(228) + ' 104 ' + m(188) + ' 134 ' + m(170 - lat * 0.6) + ' 190' +
      ' C ' + m(152 - lat) + ' 236 ' + m(140 - lat) + ' 296 ' + m(138 - lat) + ' 350' +
      ' C ' + m(137 - lat) + ' ' + f1(yc - 40) + ' ' + m(138 - lat) + ' ' + f1(yc - 14) + ' ' + m(xc) + ' ' + f1(yc);
    for (var x = xc + 6; x < xm; x += 6) {
      s += ' L ' + m(x) + ' ' + f1(diaphragmY(mapX(side, x), d) - 3);
    }
    var yb = diaphragmY(mapX(side, xm), d) - 3;
    s += ' L ' + m(xm) + ' ' + f1(yb);
    if (notch) {
      // incisura cardíaca do pulmão esquerdo
      s += ' C ' + m(262) + ' ' + f1(yb - 10) + ' ' + m(244) + ' ' + f1(yb - 40) + ' ' + m(250) + ' ' + f1(yb - 70) +
        ' C ' + m(254) + ' ' + f1(yb - 96) + ' ' + m(286) + ' 268 ' + m(290) + ' 240' +
        ' C ' + m(292) + ' 196 ' + m(290) + ' 130 ' + m(262) + ' ' + APEX_Y + ' Z';
    } else {
      s += ' C ' + m(304) + ' ' + f1(yb - 50) + ' ' + m(302) + ' 262 ' + m(292) + ' 236' +
        ' C ' + m(284) + ' 200 ' + m(290) + ' 130 ' + m(262) + ' ' + APEX_Y + ' Z';
    }
    return s;
  }

  /* ---------- Árvore brônquica (coordenadas da metade esquerda da tela) ---------- */
  var TREE = {
    R: {
      hilum: [282, 232],
      nodes: {
        u1: ['h', 252, 190], u2: ['u1', 236, 150], u3: ['u1', 212, 176],
        m1: ['h', 232, 246], m2: ['m1', 194, 238], m3: ['m1', 200, 282],
        l1: ['h', 266, 290], l2: ['l1', 236, 336], l3: ['l2', 206, 372],
        l4: ['l1', 256, 346], l5: ['l1', 178, 326]
      },
      tips: ['u2', 'u3', 'm2', 'm3', 'l3', 'l4', 'l5']
    },
    L: {
      hilum: [276, 240],
      nodes: {
        u1: ['h', 250, 196], u2: ['u1', 238, 152], u3: ['u1', 210, 184],
        m1: ['h', 232, 262], m2: ['m1', 196, 262], m3: ['m1', 212, 302],
        l1: ['h', 258, 300], l2: ['l1', 230, 340], l3: ['l2', 206, 370],
        l4: ['l2', 246, 352]
      },
      tips: ['u2', 'u3', 'm2', 'm3', 'l3', 'l4']
    }
  };
  var CARINA = [320, 192];
  var TOP = [320, -8];

  function treeGeometry(d) {
    var sc = lungScale(d);
    var out = { R: {}, L: {} };
    ['R', 'L'].forEach(function (side) {
      var P = makeP(side, sc);
      var t = TREE[side];
      var pts = { h: P(t.hilum[0], t.hilum[1]) };
      Object.keys(t.nodes).forEach(function (k) {
        var n = t.nodes[k]; pts[k] = P(n[1], n[2]);
      });
      out[side] = pts;
    });
    return out;
  }
  function depthOf(side, k) {
    var n = 0; var cur = k;
    while (cur !== 'h') { cur = TREE[side].nodes[cur][0]; n++; }
    return n;
  }
  /* rotas de partículas: boca → traqueia → carina → hilo → … → ponta */
  var ROUTES = [];
  ['R', 'L'].forEach(function (side) {
    TREE[side].tips.forEach(function (tip) {
      var chain = []; var cur = tip;
      while (cur !== 'h') { chain.unshift(cur); cur = TREE[side].nodes[cur][0]; }
      chain.unshift('h');
      ROUTES.push({ side: side, chain: chain });
    });
  });

  /* ---------- utilidades SVG ---------- */
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* =====================================================================
     Construção da cena
     ===================================================================== */
  function create(svg) {
    var defs = el('defs', {}, svg);
    var lg = el('linearGradient', { id: 'lungGrad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%', 'class': 'stop-lung-top' }, lg);
    el('stop', { offset: '100%', 'class': 'stop-lung-bottom' }, lg);
    var mg = el('linearGradient', { id: 'muscleGrad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%', 'class': 'stop-muscle-top' }, mg);
    el('stop', { offset: '100%', 'class': 'stop-muscle-bottom' }, mg);
    var mk = el('marker', { id: 'arrowHead', viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', 'class': 'fill-air' }, mk);
    var mkv = el('marker', { id: 'arrowVol', viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '4', markerHeight: '4', orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', 'class': 'fill-volume' }, mkv);

    // tronco
    el('path', {
      'class': 'torso',
      d: 'M 278 0 L 278 56 C 278 86 240 96 180 108 C 120 120 86 150 80 214 L 74 560 L 566 560 L 560 214 C 554 150 520 120 460 108 C 400 96 362 86 362 56 L 362 0 Z'
    }, svg);
    // clavículas
    el('path', { 'class': 'bone faint', d: 'M 306 128 C 270 118 220 110 176 116' }, svg);
    el('path', { 'class': 'bone faint', d: 'M 334 128 C 370 118 420 110 464 116' }, svg);

    var g = {};
    g.heart = el('path', { 'class': 'heart' }, svg);
    g.lungR = el('path', { 'class': 'lung' }, svg);
    g.lungL = el('path', { 'class': 'lung' }, svg);
    g.fissures = el('g', { 'class': 'fissure' }, svg);
    g.fis = [el('path', {}, g.fissures), el('path', {}, g.fissures), el('path', {}, g.fissures)];
    g.tree = el('g', { 'class': 'bronchi' }, svg);
    g.branches = [];
    ['R', 'L'].forEach(function (side) {
      Object.keys(TREE[side].nodes).forEach(function (k) {
        var depth = depthOf(side, k);
        var line = el('line', { 'stroke-width': Math.max(2.2, 8 - depth * 1.9) }, g.tree);
        g.branches.push({ side: side, k: k, parent: TREE[side].nodes[k][0], line: line });
      });
    });
    g.alv = el('g', { 'class': 'alveoli' }, svg);
    g.alveoli = [];
    ['R', 'L'].forEach(function (side) {
      TREE[side].tips.forEach(function (tip) {
        var grp = el('g', {}, g.alv);
        var cs = [el('circle', {}, grp), el('circle', {}, grp), el('circle', {}, grp)];
        g.alveoli.push({ side: side, k: tip, cs: cs });
      });
    });
    // brônquios principais + traqueia
    g.mainBronchi = el('path', { 'class': 'airway-wall' }, svg);
    g.mainLumen = el('path', { 'class': 'airway-lumen' }, svg);
    el('rect', { 'class': 'trachea', x: 307, y: 20, width: 26, height: 176, rx: 11 }, svg);
    el('rect', { 'class': 'trachea-lumen', x: 316, y: 22, width: 8, height: 172, rx: 4 }, svg);
    var rings = el('g', { 'class': 'rings' }, svg);
    for (var y = 34; y < 186; y += 12) el('line', { x1: 309, x2: 331, y1: y, y2: y }, rings);
    el('path', { 'class': 'larynx', d: 'M 304 6 C 304 18 306 24 309 28 L 331 28 C 334 24 336 18 336 6' }, svg);

    // costelas (por cima, translúcidas)
    g.ribs = el('g', { 'class': 'ribs' }, svg);
    g.ribPaths = [];
    for (var i = 0; i < 7; i++) {
      g.ribPaths.push([el('path', {}, g.ribs), el('path', {}, g.ribs)]);
    }
    el('rect', { 'class': 'sternum', x: 314, y: 134, width: 12, height: 170, rx: 6 }, svg);

    // diafragma
    g.diaphragm = el('path', { 'class': 'diaphragm' }, svg);
    g.tendon = el('path', { 'class': 'tendon' }, svg);
    g.fibers = el('g', { 'class': 'fibers' }, svg);
    g.fiberLines = [];
    for (var j = 0; j < 14; j++) g.fiberLines.push(el('line', {}, g.fibers));

    // setas do diafragma
    g.dArrows = el('g', { 'class': 'd-arrows' }, svg);
    g.dArrowPaths = [el('path', {}, g.dArrows), el('path', {}, g.dArrows)];

    // medidor de volume (colchete)
    g.vol = el('g', { 'class': 'vol-bracket' }, svg);
    g.volLine = el('line', { x1: 598, x2: 598, 'marker-start': 'url(#arrowVol)', 'marker-end': 'url(#arrowVol)' }, g.vol);
    g.volTop = el('line', { x1: 588, x2: 608, y1: APEX_Y, y2: APEX_Y }, g.vol);
    g.volBot = el('line', { x1: 588, x2: 608 }, g.vol);
    g.volGuide = el('line', { 'class': 'vol-guide', x1: 470 }, g.vol);
    g.volLabel = el('text', { x: 612, 'text-anchor': 'start' }, g.vol);
    g.volLabel.textContent = 'V';

    // rótulos
    var labels = el('g', { 'class': 'labels' }, svg);
    function label(text, x, y, lx, ly, anchor) {
      el('line', { x1: lx[0], y1: lx[1], x2: ly[0], y2: ly[1], 'class': 'leader' }, labels);
      var t = el('text', { x: x, y: y, 'text-anchor': anchor || 'start' }, labels);
      t.textContent = text;
      return t;
    }
    label('Traqueia', 346, 104, [344, 100], [336, 100]);
    label('Pulmão', 24, 258, [70, 254], [150, 254]);
    label('Costelas', 24, 182, [78, 178], [162, 196]);
    g.dLabel = el('text', { x: 24, 'class': 'strong' }, labels);
    g.dLabel.textContent = 'Diafragma';
    g.dLeader = el('line', { 'class': 'leader' }, labels);

    // fluxo de ar
    g.flowArrow = el('path', { 'class': 'flow-arrow', 'marker-end': 'url(#arrowHead)' }, svg);
    g.particles = el('g', { 'class': 'particles' }, svg);
    g.dots = [];
    var N = 54;
    for (var p = 0; p < N; p++) {
      var c = el('circle', { r: 3.2 }, g.particles);
      g.dots.push({ c: c, s: Math.random(), route: ROUTES[p % ROUTES.length], jitter: (Math.random() - 0.5) * 4 });
    }
    return g;
  }

  function pathFromPoints(pts) {
    return pts.map(function (p, i) { return (i ? 'L ' : 'M ') + f1(p[0]) + ' ' + f1(p[1]); }).join(' ');
  }

  function routePoints(route, geo) {
    var pts = [TOP, CARINA];
    route.chain.forEach(function (k) { pts.push(geo[route.side][k]); });
    return pts;
  }
  function pointOnPolyline(pts, s) {
    var lens = []; var total = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l); total += l;
    }
    var target = s * total;
    for (var j = 0; j < lens.length; j++) {
      if (target <= lens[j] || j === lens.length - 1) {
        var t = lens[j] ? clamp(target / lens[j], 0, 1) : 0;
        return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t];
      }
      target -= lens[j];
    }
    return pts[pts.length - 1];
  }

  /* =====================================================================
     Renderização por quadro
     opts: { flow: fluxo de ar −1..1 (+ entrando), move: velocidade do diafragma, dt, showFlow }
     ===================================================================== */
  function render(g, d, opts) {
    var sc = lungScale(d);
    var geo = treeGeometry(d);

    g.lungR.setAttribute('d', lungPath('R', d));
    g.lungL.setAttribute('d', lungPath('L', d));

    // fissuras
    var PR = makeP('R', sc), PL = makeP('L', sc);
    var a = PR(146, 270), b = PR(282, 250), c = PR(144, 328), e = PR(240, diaphragmY(240, d) - 8);
    var lf1 = PL(150, 222), lf2 = PL(250, diaphragmY(W - 250, d) - 8);
    e[1] = diaphragmY(e[0], d) - 6; lf2[1] = diaphragmY(lf2[0], d) - 6;
    g.fis[0].setAttribute('d', 'M ' + f1(a[0]) + ' ' + f1(a[1]) + ' Q ' + f1((a[0] + b[0]) / 2) + ' ' + f1(a[1] + 4) + ' ' + f1(b[0]) + ' ' + f1(b[1]));
    g.fis[1].setAttribute('d', 'M ' + f1(c[0]) + ' ' + f1(c[1]) + ' Q ' + f1(c[0] + 50) + ' ' + f1(c[1] + 10) + ' ' + f1(e[0]) + ' ' + f1(e[1]));
    g.fis[2].setAttribute('d', 'M ' + f1(lf1[0]) + ' ' + f1(lf1[1]) + ' Q ' + f1(lf1[0] - 30) + ' ' + f1((lf1[1] + lf2[1]) / 2) + ' ' + f1(lf2[0]) + ' ' + f1(lf2[1]));

    // coração apoiado no diafragma
    var hb = diaphragmY(340, d) - 2;
    var hx = 340;
    g.heart.setAttribute('d',
      'M ' + (hx - 40) + ' ' + f1(hb - 70) +
      ' C ' + (hx - 52) + ' ' + f1(hb - 30) + ' ' + (hx - 36) + ' ' + f1(hb) + ' ' + (hx + 4) + ' ' + f1(hb) +
      ' C ' + (hx + 44) + ' ' + f1(hb) + ' ' + (hx + 70) + ' ' + f1(hb - 18) + ' ' + (hx + 62) + ' ' + f1(hb - 56) +
      ' C ' + (hx + 54) + ' ' + f1(hb - 96) + ' ' + (hx + 8) + ' ' + f1(hb - 112) + ' ' + (hx - 18) + ' ' + f1(hb - 104) +
      ' C ' + (hx - 36) + ' ' + f1(hb - 98) + ' ' + (hx - 34) + ' ' + f1(hb - 84) + ' ' + (hx - 40) + ' ' + f1(hb - 70) + ' Z');

    // brônquios
    g.branches.forEach(function (br) {
      var p0 = geo[br.side][br.parent], p1 = geo[br.side][br.k];
      br.line.setAttribute('x1', f1(p0[0])); br.line.setAttribute('y1', f1(p0[1]));
      br.line.setAttribute('x2', f1(p1[0])); br.line.setAttribute('y2', f1(p1[1]));
    });
    var r = 5 + 2.6 * d;
    g.alveoli.forEach(function (al) {
      var p = geo[al.side][al.k];
      var offs = [[0, 0], [-r * 1.05, r * 0.7], [r * 1.05, r * 0.7]];
      al.cs.forEach(function (cc, i) {
        cc.setAttribute('cx', f1(p[0] + offs[i][0])); cc.setAttribute('cy', f1(p[1] + offs[i][1]));
        cc.setAttribute('r', f1(r * (i ? 0.8 : 1)));
      });
    });
    var hR = geo.R.h, hL = geo.L.h;
    var mb = 'M ' + f1(hR[0]) + ' ' + f1(hR[1]) + ' Q 312 200 ' + CARINA[0] + ' ' + (CARINA[1] - 6) + ' Q 330 202 ' + f1(hL[0]) + ' ' + f1(hL[1]);
    g.mainBronchi.setAttribute('d', mb);
    g.mainLumen.setAttribute('d', mb);

    // costelas: movimento em "alça de balde" — sobem e abrem na inspiração
    var out = 8 * d;
    g.ribPaths.forEach(function (pair, i) {
      var y0 = 150 + i * 32;
      var lift = 7 * d * (0.5 + i / 8);
      var reach = 150 + Math.min(i, 3) * 8 - Math.max(0, i - 4) * 10;
      pair.forEach(function (path, k) {
        var sx = k === 0 ? -1 : 1;
        var X = function (dx) { return f1(320 + sx * dx); };
        path.setAttribute('d', 'M ' + X(14) + ' ' + y0 +
          ' C ' + X(70) + ' ' + f1(y0 - 20 - lift) + ' ' + X(reach - 30 + out) + ' ' + f1(y0 - 8 - lift) + ' ' + X(reach + 22 + out) + ' ' + f1(y0 + 34 - lift * 0.6));
      });
    });

    // diafragma (faixa muscular)
    var top = [], bot = [];
    for (var x = DX0; x <= DX1; x += 8) {
      var t = (x - DX0) / (DX1 - DX0);
      var y = diaphragmY(x, d);
      top.push([x, y]);
      bot.push([x, y + 15 - 5 * Math.sin(Math.PI * t)]);
    }
    var dPath = pathFromPoints(top) + ' ' + bot.reverse().map(function (p) { return 'L ' + f1(p[0]) + ' ' + f1(p[1]); }).join(' ') + ' Z';
    g.diaphragm.setAttribute('d', dPath);
    var ten = [];
    for (var tx = 290; tx <= 392; tx += 6) ten.push([tx, diaphragmY(tx, d) + 4]);
    g.tendon.setAttribute('d', pathFromPoints(ten));
    g.fiberLines.forEach(function (ln, i) {
      var fx = DX0 + 18 + i * ((DX1 - DX0 - 36) / 13);
      if (fx > 286 && fx < 396) { ln.setAttribute('opacity', 0); return; }
      var fy = diaphragmY(fx, d);
      ln.setAttribute('opacity', 1);
      ln.setAttribute('x1', f1(fx)); ln.setAttribute('y1', f1(fy + 3));
      ln.setAttribute('x2', f1(fx + (fx < 320 ? -3 : 3))); ln.setAttribute('y2', f1(fy + 11));
    });
    // contração intensifica a cor do músculo
    g.diaphragm.style.setProperty('--contract', d.toFixed(3));

    // rótulo do diafragma
    var ly = diaphragmY(150, d);
    g.dLabel.setAttribute('y', f1(ly + 44));
    g.dLeader.setAttribute('x1', 98); g.dLeader.setAttribute('y1', f1(ly + 38));
    g.dLeader.setAttribute('x2', 150); g.dLeader.setAttribute('y2', f1(ly + 10));

    // setas de movimento do diafragma
    var mv = opts.move || 0;
    var dir = mv >= 0 ? 1 : -1;
    var mag = clamp(Math.abs(mv) * 1.6, 0, 1);
    [234, 420].forEach(function (ax, i) {
      var ay = diaphragmY(ax, d) + 38;
      var h = 9 * dir;
      g.dArrowPaths[i].setAttribute('d', 'M ' + (ax - 11) + ' ' + f1(ay - h) + ' L ' + ax + ' ' + f1(ay + h) + ' L ' + (ax + 11) + ' ' + f1(ay - h) +
        ' M ' + (ax - 11) + ' ' + f1(ay - h + 12 * dir) + ' L ' + ax + ' ' + f1(ay + h + 12 * dir) + ' L ' + (ax + 11) + ' ' + f1(ay - h + 12 * dir));
    });
    g.dArrows.style.opacity = mag.toFixed(3);

    var v = opts.flow || 0;   // + entrando · − saindo (∝ diferença de pressão)
    // colchete de volume
    var vb = diaphragmY(470, d) - 3;
    g.volLine.setAttribute('y1', APEX_Y + 4); g.volLine.setAttribute('y2', f1(vb - 4));
    g.volBot.setAttribute('y1', f1(vb)); g.volBot.setAttribute('y2', f1(vb));
    g.volGuide.setAttribute('y1', f1(vb)); g.volGuide.setAttribute('y2', f1(vb));
    g.volGuide.setAttribute('x2', 588);
    g.volLabel.setAttribute('y', f1((APEX_Y + vb) / 2 + 6));

    // seta de fluxo junto à entrada da traqueia
    var fm = opts.showFlow ? clamp(Math.abs(v) * 1.8, 0, 1) : 0;
    if (v >= 0) g.flowArrow.setAttribute('d', 'M 290 8 L 290 92');
    else g.flowArrow.setAttribute('d', 'M 290 92 L 290 8');
    g.flowArrow.style.opacity = fm.toFixed(3);

    // partículas de ar
    var dt = opts.dt || 0;
    var speed = clamp(v * 0.55, -0.8, 0.8);
    g.particles.style.display = opts.showFlow ? '' : 'none';
    g.dots.forEach(function (p) {
      p.s += speed * dt * (0.85 + (p.jitter + 2) * 0.05);
      if (p.s > 1) { p.s -= 1; p.route = ROUTES[(Math.random() * ROUTES.length) | 0]; }
      if (p.s < 0) { p.s += 1; p.route = ROUTES[(Math.random() * ROUTES.length) | 0]; }
      var pt = pointOnPolyline(routePoints(p.route, geo), p.s);
      var inTrachea = pt[1] < CARINA[1];
      p.c.setAttribute('cx', f1(pt[0] + (inTrachea ? p.jitter * 0.6 : p.jitter * 0.4)));
      p.c.setAttribute('cy', f1(pt[1]));
      var edgeFade = Math.min(1, p.s / 0.06) * Math.min(1, (1 - p.s) / 0.08);
      var act = 0.22 + 0.78 * clamp(Math.abs(v) * 2.5, 0, 1);
      p.c.setAttribute('opacity', (edgeFade * act).toFixed(3));
    });
  }

  global.BreathAnatomy = { create: create, render: render, diaphragmY: diaphragmY };
})(window);
