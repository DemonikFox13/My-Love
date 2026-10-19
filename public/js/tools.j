window.LDTools = (() => {
  const panel = document.getElementById('toolsPanel');
  const btn = document.getElementById('toolsBtn');
  const buttons = panel.querySelectorAll('.tool-btn');
  const pawsBtn = document.getElementById('pawsBtn');

  const ICONS = {
    brush: '🖌',
    eraser: '🩹',
    line: '╱',
    fill: '💧',
    eyedropper: '💉',
    hand: '✋',
    paw: '🐾',
  };

  let currentTool = 'brush';

  function setActive(tool) {
    if (!ICONS[tool]) tool = 'brush';
    currentTool = tool;

    buttons.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    window.LDCanvas.setTool(tool);

    btn.textContent = ICONS[tool];
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
        window.LDEraserTool.openSettings();
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
        window.LDPaper.reset();
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
