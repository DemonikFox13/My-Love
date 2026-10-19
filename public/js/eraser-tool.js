
window.LDEraserTool = (() => {
  const modal = document.getElementById('eraserModal');
  const modeButtons = modal.querySelectorAll('.er-mode-btn');
  const list = document.getElementById('erColorList');
  const addBtn = document.getElementById('erAddColor');
  const pickBtn = document.getElementById('erPickFromCanvas');
  const colorInput = document.getElementById('erColorInput');
  const resetBtn = document.getElementById('erReset');
  const closeBtn = document.getElementById('erClose');

  let filter = { mode: 'all', colors: [] };

  function applyFilter() {
    window.LDCanvas.setEraserFilter({
      mode: filter.mode,
      colors: filter.colors.slice(),
    });
  }

  function render() {
    // Список цветов
    list.innerHTML = '';
    if (filter.mode === 'all') {
      const hint = document.createElement('p');
      hint.className = 'er-hint';
      hint.textContent = 'Ластик стирает всё. Переключи режим или добавь цвета ниже.';
      list.appendChild(hint);
    } else if (filter.colors.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'er-hint';
      hint.textContent = 'Список пуст — добавь хотя бы один цвет.';
      list.appendChild(hint);
    } else {
      filter.colors.forEach((hex, i) => {
        const chip = document.createElement('div');
        chip.className = 'er-chip';
        chip.style.background = hex;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'er-chip-x';
        x.textContent = '×';
        x.addEventListener('click', (e) => {
          e.stopPropagation();
          filter.colors.splice(i, 1);
          applyFilter();
          render();
        });
        chip.appendChild(x);
        list.appendChild(chip);
      });
    }
    // Кнопки режима
    modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === filter.mode));
  }

  function setMode(m) {
    filter.mode = m;
    applyFilter();
    render();
  }

  function addColor(hex) {
    if (!hex) return;
    if (filter.mode === 'all') filter.mode = 'erase-only';
    if (!filter.colors.includes(hex)) filter.colors.push(hex);
    applyFilter();
    render();
  }

  function openSettings() {
    modal.classList.add('open');
    render();
  }
  function closeSettings() {
    modal.classList.remove('open');
  }

  function reset() {
    filter = { mode: 'all', colors: [] };
    applyFilter();
    render();
  }

  function bindEvents() {
    modeButtons.forEach(b => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });

    addBtn.addEventListener('click', () => colorInput.click());
    colorInput.addEventListener('input', () => addColor(colorInput.value));

    pickBtn.addEventListener('click', () => {
      closeSettings();
      window.LDCanvas.startEraserColorPick((hex) => {
        addColor(hex);
        openSettings();
      });
    });

    resetBtn.addEventListener('click', reset);
    closeBtn.addEventListener('click', closeSettings);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSettings();
    });
  }

  return { bindEvents, openSettings, closeSettings };
})();
