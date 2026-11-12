/* =====================================================================
   Modo "Experimente você mesmo"
   O aluno investiga com o controle do diafragma (valores ocultos),
   escolhe uma resposta e o sistema demonstra o resultado.
   ===================================================================== */
(function (global) {
  'use strict';

  var QUESTIONS = [
    {
      ask: 'O que acontece com o volume dos pulmões quando o diafragma desce?',
      hint: 'O volume está oculto. Mova o diafragma e observe os pulmões.',
      mask: ['V'], start: 0, demo: 'insp',
      options: ['Aumenta', 'Diminui', 'Não muda'], correct: 0,
      explain: 'Ao descer, o diafragma abre espaço no tórax. Os pulmões acompanham e o volume vai de 4.000 para 4.048 mL.'
    },
    {
      ask: 'O que acontece com a pressão interna quando o diafragma desce?',
      hint: 'A pressão está oculta. Pense: o mesmo ar em um espaço maior…',
      mask: ['P'], start: 0, demo: 'insp',
      options: ['Aumenta', 'Diminui', 'Não muda'], correct: 1,
      explain: 'O mesmo ar ocupa mais espaço, então a pressão cai: 760 × 4.000 ÷ 4.048 ≈ 751 mmHg.'
    },
    {
      ask: 'Dentro dos pulmões há 751 mmHg e fora há 760 mmHg. O que o ar faz?',
      hint: 'O fluxo de ar está oculto. Compare as duas pressões.',
      mask: ['flow'], start: 0, demo: 'insp',
      options: ['Entra nos pulmões', 'Sai dos pulmões', 'Fica parado'], correct: 0,
      explain: 'O ar sempre vai da pressão maior para a menor. Fora é maior (760 mmHg), então o ar entra.'
    },
    {
      ask: 'Quando o diafragma relaxa e sobe, o que acontece com a pressão interna?',
      hint: 'Comece com o diafragma contraído e mova-o para a esquerda.',
      mask: ['P'], start: 1, demo: 'exp',
      options: ['Aumenta', 'Diminui', 'Não muda'], correct: 0,
      explain: 'O volume volta a 4.000 mL. Menos espaço para o mesmo ar deixa a pressão maior (760 mmHg), e o ar sai.'
    },
    {
      ask: 'Desafio: se o volume dobrasse, de 4.000 para 8.000 mL, a pressão ficaria…',
      hint: 'Use a fórmula: P₂ = P₁ × V₁ ÷ V₂.',
      mask: [], start: 0, demo: null,
      options: ['Duas vezes maior', 'Igual', 'Pela metade'], correct: 2,
      explain: 'P₂ = 760 × 4.000 ÷ 8.000 = 380 mmHg. Volume vezes 2, pressão dividida por 2: é isso que “inversamente proporcional” quer dizer.'
    }
  ];

  function createQuiz(dom, hooks) {
    var i = 0, score = 0, answered = false;

    function renderQuestion() {
      var q = QUESTIONS[i];
      answered = false;
      dom.count.textContent = 'Pergunta ' + (i + 1) + ' de ' + QUESTIONS.length;
      dom.q.textContent = q.ask;
      dom.hint.textContent = q.hint;
      dom.hint.hidden = false;
      dom.fb.hidden = true;
      dom.next.hidden = true;
      dom.replay.hidden = true;
      dom.opts.innerHTML = '';
      q.options.forEach(function (text, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt';
        b.innerHTML = '<span class="k">' + 'ABC'[k] + '</span><span></span>';
        b.lastChild.textContent = text;
        b.addEventListener('click', function () { answer(k); });
        dom.opts.appendChild(b);
      });
      hooks.prepare(q.start);
      hooks.setMask(q.mask);
      hooks.onProgress(i, QUESTIONS.length);
    }

    function answer(k) {
      if (answered) return;
      answered = true;
      var q = QUESTIONS[i];
      var ok = k === q.correct;
      if (ok) score++;
      Array.prototype.forEach.call(dom.opts.children, function (b, j) {
        b.disabled = true;
        if (j === q.correct) b.classList.add('right');
        else if (j === k) b.classList.add('wrong');
        else b.classList.add('dim');
      });
      dom.hint.hidden = true;
      dom.fbTitle.textContent = ok ? 'Isso mesmo!' : 'Quase. Veja o que acontece:';
      dom.fbTitle.className = 'fb-title ' + (ok ? 'ok' : 'no');
      dom.fbText.textContent = q.explain;
      dom.fb.hidden = false;
      dom.next.hidden = false;
      dom.next.textContent = i === QUESTIONS.length - 1 ? 'Ver resultado' : 'Próxima pergunta';
      hooks.setMask([]);
      if (q.demo) { dom.replay.hidden = false; hooks.demo(q.start, q.demo); }
    }

    function finish() {
      hooks.setMask([]);
      dom.count.textContent = 'Resultado';
      dom.q.innerHTML = '';
      var s = document.createElement('span'); s.className = 'score';
      s.textContent = score + ' de ' + QUESTIONS.length;
      dom.q.appendChild(s);
      dom.hint.hidden = false;
      dom.hint.textContent = score === QUESTIONS.length
        ? 'Você entendeu a relação: quando o volume aumenta, a pressão diminui, e o ar entra.'
        : 'Revise na Simulação: observe o volume e a pressão andando em sentidos opostos.';
      dom.opts.innerHTML = '';
      dom.fb.hidden = true;
      dom.replay.hidden = true;
      dom.next.hidden = false;
      dom.next.textContent = 'Recomeçar';
      hooks.onProgress(QUESTIONS.length, QUESTIONS.length);
      i = QUESTIONS.length;
    }

    dom.next.addEventListener('click', function () {
      if (i >= QUESTIONS.length) { i = 0; score = 0; renderQuestion(); return; }
      i++;
      if (i >= QUESTIONS.length) finish(); else renderQuestion();
    });
    dom.replay.addEventListener('click', function () {
      var q = QUESTIONS[i]; if (q && q.demo) hooks.demo(q.start, q.demo);
    });

    return {
      start: function () { i = 0; score = 0; renderQuestion(); },
      stop: function () { hooks.setMask([]); },
      get index() { return i; },
      questions: QUESTIONS
    };
  }

  global.BreathQuiz = { create: createQuiz, QUESTIONS: QUESTIONS };
})(window);
