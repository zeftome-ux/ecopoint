/* =====================================================================
   Modelo matemático — Lei de Boyle aplicada à respiração
   ---------------------------------------------------------------------
   Uma única variável de controle comanda tudo:
     d ∈ [0, 1]  → contração do diafragma (0 = relaxado/cúpula, 1 = contraído/achatado)
   A partir dela:
     V(d) = V1 + ΔV · d               (volume pulmonar, mL)
     P(V) = (P1 · V1) / V             (Lei de Boyle, T constante)
   Anatomia, fórmula, gráfico e explicações leem SEMPRE deste modelo.
   ===================================================================== */
(function (global) {
  'use strict';

  var P1 = 760;          // mmHg — pressão inicial (igual à atmosférica)
  var V1 = 4000;         // mL   — volume inicial
  var DV = 48;           // mL   — variação máxima didática (V2 = 4.048 mL)
  var PATM = 760;        // mmHg — pressão atmosférica
  var K = P1 * V1;       // 3.040.000 mmHg·mL — constante de Boyle

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  /* easeInOutSine: aceleração e desaceleração naturais, como um músculo */
  function ease(u) { return (1 - Math.cos(Math.PI * clamp(u, 0, 1))) / 2; }
  function easeInv(d) { return Math.acos(1 - 2 * clamp(d, 0, 1)) / Math.PI; }

  function volumeAt(d) { return V1 + DV * clamp(d, 0, 1); }
  function pressureAt(V) { return K / V; }

  /* n = quantidade de ar nos pulmões, medida como o volume que esse ar
     ocupa a 760 mmHg (estado 1 da Lei de Boyle: P1 = 760, V1 = n).
     Enquanto o diafragma se move, n é fixo  →  P2 = 760 · n / V2.
     Quando o diafragma para, o ar entra/sai até P2 = 760 (n → V2).      */
  function snapshot(d, n) {
    if (n == null) n = V1;
    var V = volumeAt(d);
    var P = PATM * n / V;
    return {
      d: d, n: n, V: V, P: P,
      Vr: Math.round(V), Pr: Math.round(P), nr: Math.round(n),
      product: PATM * n,          // = P2 · V2 exatamente
      vsAtm: P - PATM             // < 0 → ar entra · > 0 → ar sai
    };
  }

  /* ------------------------------------------------------------------
     Motor: cada fase tem dois estágios
       'move'  o diafragma se move (Boyle, n constante)
       'hold'  o ar termina de entrar/sair até a pressão igualar 760
     ------------------------------------------------------------------ */
  function createEngine() {
    var s = {
      d: 0, n: V1,
      phase: 'insp', stage: 'idle',   // 'move' | 'hold' | 'idle'
      u: 0, hu: 0, eqFrom: V1,
      playing: false, loop: true, once: false, speed: 1,
      durations: { insp: 3, exp: 4, hold: 1.1 },
      velocity: 0, still: 0,
      mode: 'auto'                    // 'auto' | 'manual'
    };
    function other(p) { return p === 'insp' ? 'exp' : 'insp'; }
    function startPhase(phase) {
      s.phase = phase; s.stage = 'move';
      s.u = phase === 'insp' ? easeInv(s.d) : easeInv(1 - s.d);
    }
    function startHold() { s.stage = 'hold'; s.hu = 0; s.eqFrom = s.n; }
    function applyU() { s.d = s.phase === 'insp' ? ease(s.u) : 1 - ease(s.u); }
    function pNow() { return PATM * s.n / volumeAt(s.d); }

    return {
      state: s,
      pressure: pNow,
      play: function () {
        s.mode = 'auto'; s.once = false; s.playing = true;
        if (s.stage === 'move' && s.u < 1) return;
        if (s.stage === 'hold' && s.hu < 1) return;
        if (Math.abs(s.n - volumeAt(s.d)) > 0.5) {      // ar ainda fora do equilíbrio
          s.phase = pNow() < PATM ? 'insp' : 'exp';
          startHold(); return;
        }
        startPhase(s.d >= 0.5 ? 'exp' : 'insp');
      },
      pause: function () { s.playing = false; s.once = false; },
      reset: function () {
        s.d = 0; s.n = V1; s.phase = 'insp'; s.stage = 'idle'; s.u = 0; s.hu = 0;
        s.playing = false; s.once = false; s.velocity = 0; s.mode = 'auto';
      },
      switchPhase: function () {
        startPhase(other(s.phase));
        s.mode = 'auto'; s.once = false; s.playing = true;
      },
      demo: function (start, phase) {        // começa em equilíbrio e toca uma fase
        s.d = clamp(start, 0, 1); s.n = volumeAt(s.d);
        startPhase(phase);
        s.mode = 'auto'; s.once = true; s.playing = true;
      },
      prepare: function (start) {            // posição de equilíbrio, parado
        s.d = clamp(start, 0, 1); s.n = volumeAt(s.d);
        s.stage = 'idle'; s.playing = false; s.once = false; s.mode = 'auto';
        s.phase = start >= 0.5 ? 'exp' : 'insp'; s.velocity = 0;
      },
      setManual: function (d) {
        s.mode = 'manual'; s.playing = false; s.once = false; s.stage = 'idle';
        s.d = clamp(d, 0, 1);
      },
      setSpeed: function (v) { s.speed = v; },
      setLoop: function (v) { s.loop = !!v; },
      tick: function (dt) {
        var prev = s.d;
        if (s.playing && s.stage === 'move') {
          s.u += (dt * s.speed) / s.durations[s.phase];
          if (s.u >= 1) { s.u = 1; applyU(); startHold(); }
          applyU();
        } else if (s.playing && s.stage === 'hold') {
          s.hu += (dt * s.speed) / s.durations.hold;
          var V = volumeAt(s.d);
          if (s.hu >= 1) {
            s.n = V;
            if (s.loop && !s.once) startPhase(other(s.phase));
            else { s.stage = 'idle'; s.playing = false; s.once = false; }
          } else {
            s.n = s.eqFrom + (V - s.eqFrom) * ease(s.hu);
          }
        }
        var inst = dt > 0 ? (s.d - prev) / dt : 0;
        var a = 1 - Math.exp(-dt / 0.12);
        s.velocity += (inst - s.velocity) * a;
        if (Math.abs(s.velocity) < 1e-4) s.velocity = 0;

        if (s.mode === 'manual') {
          s.still = Math.abs(inst) < 1e-3 ? s.still + dt : 0;
          if (s.still > 0.25) {               // diafragma parado: o ar equilibra a pressão
            var Vm = volumeAt(s.d);
            s.n += (Vm - s.n) * (1 - Math.exp(-dt * s.speed / 0.45));
            if (Math.abs(Vm - s.n) < 0.02) s.n = Vm;
          }
          var dp = pNow() - PATM;
          if (Math.abs(dp) > 0.05) s.phase = dp < 0 ? 'insp' : 'exp';
          else if (Math.abs(s.velocity) > 0.03) s.phase = s.velocity > 0 ? 'insp' : 'exp';
        }
      }
    };
  }

  global.BreathModel = {
    P1: P1, V1: V1, DV: DV, PATM: PATM, K: K,
    V2: V1 + DV, P2: Math.round(K / (V1 + DV)), P2exp: Math.round(PATM * (V1 + DV) / V1),
    clamp: clamp, ease: ease, easeInv: easeInv,
    volumeAt: volumeAt, pressureAt: pressureAt, snapshot: snapshot,
    createEngine: createEngine
  };
})(window);
