window.LDTools = (() => {
  const panel = document.getElementById('toolsPanel');
  const btn = document.getElementById('toolsBtn');
  const buttons = panel.querySelectorAll('.tool-btn');
  const pawsBtn = document.getElementById('pawsBtn');

  const SVGS = {
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3l6 6-9 9-3-3z" fill="currentColor" fill-opacity="0.18"/><path d="M6 15l-2 5 5-2z" fill="currentColor"/><path d="M9 12l3 3"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 15l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-5 5H9z" fill="currentColor" fill-opacity="0.15"/><path d="M4 15l8 8" stroke-linecap="round"/><path d="M12 23h9" stroke-linecap="round"/></svg>',
    line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="1.8" fill="currentColor"/><circle cx="19" cy="5" r="1.8" fill="currentColor"/></svg>',
    fill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3s7 7 7 12a7 7 0 1 1-14 0c0-5 7-12 7-12z" fill="currentColor" fill-opacity="0.25"/><path d="M7 13c2-1 3-1 5 0s3 1 5 0" stroke-linecap="round"/></svg>',
    eyedropper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 3l2 2a2 2 0 0 1 0 3l-6 6-4 1 1-4 6-6a2 2 0 0 1 3 0z" fill="currentColor" fill-opacity="0.18"/><path d="M12 15l-7 7H3v-2l7-7"/><circle cx="19" cy="5" r="0.8" fill="currentColor"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M17 12V8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2.5a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.4-1.8L8 15"/></svg>',
    paw: '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.5" cy="10" rx="1.9" ry="2.4"/><ellipse cx="11" cy="7.5" rx="1.9" ry="2.4"/><ellipse cx="15.5" cy="8.5" rx="1.9" ry="2.4"/><ellipse cx="19" cy="12.5" rx="1.7" ry="2.1"/><path d="M12 12.5c-2.6 0-5 1.6-5 4.5 0 1.7 1.2 2.7 2.8 2.7.9 0 1.4-.4 2.2-.4s1.3.4 2.2.4c1.6 0 2.8-1 2.8-2.7 0-2.9-2.4-4.5-5-4.5z"/></svg>',
  };

  let currentTool = 'brush';

  function setActive(tool) {
    if (!SVGS[tool]) tool = 'brush';
    currentTool = tool;

    buttons.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    window.LDCanvas.setTool(tool);

    btn.innerHTML = SVGS[tool];
    btn.classList.toggle('active', tool !== 'brush' && tool !== 'paw');

    if (pawsBtn) pawsBtn.classList.toggle('active', tool === 'paw');

    panel.classList.remove('open');

    if (window.LDCanvas && window.LDCanvas.exitSpecialModes) {
      window.LDCanvas.exitSpecialModes();
    }
  }

  function openPanel() { panel.classList.add('open'); }
  function closePanel() { panel.classList.remove('open'); }
  function togglePanel() {
    if (panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  function bindEvents() {
    // Стартовая иконка
    btn.innerHTML = SVGS.brush;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    buttons.forEach(b => {
      if (b.dataset.tool === 'eraser') return;
      if (b.dataset.tool === 'hand') return;
      b.addEventListener('click', () => setActive(b.dataset.tool));
    });

    // Ластик
    const eraserBtn = panel.querySelector('[data-tool="eraser"]');
    let pressTimer = null;
    let longPressed = false;

    function startPress() {
      longPressed = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        longPressed = true;
        if (window.LDEraserTool && window.LDEraserTool.openSettings) {
          window.LDEraserTool.openSettings();
        }
      }, 500);
    }
    function endPress() { clearTimeout(pressTimer); }

    eraserBtn.addEventListener('touchstart', startPress, { passive: true });
    eraserBtn.addEventListener('touchend', endPress);
    eraserBtn.addEventListener('touchcancel', endPress);
    eraserBtn.addEventListener('mousedown', startPress);
    eraserBtn.addEventListener('mouseup', endPress);
    eraserBtn.addEventListener('mouseleave', endPress);

    eraserBtn.addEventListener('click', (e) => {
      if (longPressed) { e.preventDefault(); e.stopPropagation(); return; }
      setActive('eraser');
    });

    // Рука
    const handBtn = panel.querySelector('[data-tool="hand"]');
    let handTimer = null;
    let handLong = false;

    function handStart() {
      handLong = false;
      clearTimeout(handTimer);
      handTimer = setTimeout(() => {
        handLong = true;
        if (window.LDPaper) window.LDPaper.reset();
        if (window.LDEmojis && window.LDEmojis.showToast) {
          window.LDEmojis.showToast('Вид сброшен', 'success');
        }
      }, 600);
    }
    function handEnd() { clearTimeout(handTimer); }

    handBtn.addEventListener('touchstart', handStart, { passive: true });
    handBtn.addEventListener('touchend', handEnd);
    handBtn.addEventListener('touchcancel', handEnd);
    handBtn.addEventListener('mousedown', handStart);
    handBtn.addEventListener('mouseup', handEnd);
    handBtn.addEventListener('mouseleave', handEnd);
    handBtn.addEventListener('click', (e) => {
      if (handLong) { e.preventDefault(); e.stopPropagation(); return; }
      setActive('hand');
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        closePanel();
      }
    });

    const canvas = document.getElementById('board');
    canvas.addEventListener('touchstart', closePanel, { passive: true });
    canvas.addEventListener('mousedown', closePanel);
  }

  return {
    bindEvents,
    setActive,
    getCurrent: () => currentTool,
  };
})();
