window.LDPresets = (() => {
  const MAX_RECENT = 5;
  const MAX_ALL = 50;
  const LS_KEY = 'ld_presets_v2';
  const DEBOUNCE_MS = 500;

  const ICONS = {
    brush: '🖌', eraser: '🩹', line: '╱',
    fill: '💧', eyedropper: '💉', hand: '✋'
  };
  const NAMES = {
    brush: 'Кисть', eraser: 'Ластик', line: 'Линия',
    fill: 'Заливка', eyedropper: 'Пипетка', hand: 'Рука'
  };

  let recent = [];    // последние 5
  let all = [];       // все с последней очистки (до 50)
  let locked = [];    // закреплённые (не удаляются при очистке)
  let snapshotTimer = null;
  let allOpen = false;

  const panel = document.getElementById('presetsPanel');
  const recentList = document.getElementById('recentList');
  const allList = document.getElementById('allList');
  const lockedList = document.getElementById('lockedList');
  const lockedSection = document.getElementById('lockedSection');
  const allSection = document.getElementById('allSection');
  const showAllBtn = document.getElementById('showAllBtn');
  const btn = document.getElementById('presetsBtn');
  const closeBtn = document.getElementById('presetsClose');

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      recent = Array.isArray(parsed.recent) ? parsed.recent : [];
      all = Array.isArray(parsed.all) ? parsed.all : [];
      locked = Array.isArray(parsed.locked) ? parsed.locked : [];
    } catch (e) {
      recent = []; all = []; locked = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ recent, all, locked }));
    } catch (e) {}
  }

  function getCurrentSnapshot() {
    const st = window.LDCanvas.state;
    return {
      tool: st.tool,
      color: st.color,
      lineWidth: st.lineWidth,
    };
  }

  function sameAs(a, b) {
    if (!a || !b) return false;
    return a.tool === b.tool
      && a.color === b.color
      && a.lineWidth === b.lineWidth;
  }

  function snapshot() {
    const snap = getCurrentSnapshot();

    // recent
    if (!recent.length || !sameAs(recent[0], snap)) {
      recent = recent.filter(p => !sameAs(p, snap));
      recent.unshift(snap);
      if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    }

    // all
    if (!all.some(p => sameAs(p, snap))) {
      all.unshift(snap);
      if (all.length > MAX_ALL) all.length = MAX_ALL;
    }

    save();
    render();
  }

  function scheduleSnapshot() {
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(snapshot, DEBOUNCE_MS);
  }

  function isLocked(snap) {
    return locked.some(p => sameAs(p, snap));
  }

  function toggleLock(snap) {
    if (isLocked(snap)) {
      locked = locked.filter(p => !sameAs(p, snap));
    } else {
      locked.unshift({ ...snap });
    }
    save();
    render();
  }

  // Вызывается при Очистке холста — НЕ трогает locked
  function reset() {
    recent = [];
    all = [];
    allOpen = false;
    save();
    render();
  }

  function apply(preset) {
    if (window.LDTools && window.LDTools.setActive) {
      window.LDTools.setActive(preset.tool);
    } else {
      window.LDCanvas.setTool(preset.tool);
    }
    window.LDCanvas.setColor(preset.color);
    window.LDCanvas.setWidth(preset.lineWidth);

    if (window.LDPalette && window.LDPalette.setFromHex) {
      window.LDPalette.setFromHex(preset.color);
    }
    const sizeInput = document.getElementById('size');
    if (sizeInput) sizeInput.value = preset.lineWidth;

    closePanel();
  }

  function makeCard(preset, options) {
    options = options || {};
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'preset-item';

    const iconEl = document.createElement('span');
    iconEl.className = 'preset-tool';
    iconEl.textContent = ICONS[preset.tool] || '🖌';

    const colorEl = document.createElement('span');
    colorEl.className = 'preset-color';
    colorEl.style.background = preset.color;

    const nameEl = document.createElement('span');
    nameEl.className = 'preset-name';
    nameEl.textContent = NAMES[preset.tool] || preset.tool;

    const sizeEl = document.createElement('span');
    sizeEl.className = 'preset-size';
    sizeEl.textContent = preset.lineWidth + ' px';

    item.appendChild(iconEl);
    item.appendChild(colorEl);
    item.appendChild(nameEl);
    item.appendChild(sizeEl);

    // Кнопка-замок (кроме секции "закреплённые" — там всегда 🔒)
    const lockBtn = document.createElement('span');
    lockBtn.className = 'preset-lock-icon';
    if (options.alwaysLocked) {
      lockBtn.textContent = '🔓';
      lockBtn.title = 'Открепить';
    } else {
      lockBtn.textContent = isLocked(preset) ? '🔓' : '🔒';
      lockBtn.title = isLocked(preset) ? 'Открепить' : 'Закрепить';
    }
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleLock(preset);
    });
    item.appendChild(lockBtn);

    item.addEventListener('click', () => apply(preset));
    return item;
  }

  function renderList(el, arr, options) {
    el.innerHTML = '';
    if (!arr.length) {
      const empty = document.createElement('p');
      empty.className = 'presets-empty';
      empty.textContent = options && options.emptyText ? options.emptyText : 'Пока пусто.';
      el.appendChild(empty);
      return;
    }
    arr.forEach(p => el.appendChild(makeCard(p, options)));
  }

  function render() {
    // Закреплённые
    if (locked.length) {
      lockedSection.style.display = 'block';
      renderList(lockedList, locked, { alwaysLocked: true });
    } else {
      lockedSection.style.display = 'none';
    }

    // Последние 5
    renderList(recentList, recent, {
      emptyText: 'Пока пусто. Нарисуйте что-нибудь — настройки появятся здесь.'
    });

    // Все (раскрывающийся список)
    if (allOpen) {
      allSection.style.display = 'block';
      renderList(allList, all, {
        emptyText: 'Пока ничего нет.'
      });
      showAllBtn.textContent = '📚 Скрыть список';
    } else {
      allSection.style.display = 'none';
      showAllBtn.textContent = '📚 Показать все с последней очистки (' + all.length + ')';
    }
  }

  function openPanel() {
    render();
    panel.classList.add('open');
    const pal = document.getElementById('palette');
    if (pal) pal.classList.remove('open');
  }
  function closePanel() {
    panel.classList.remove('open');
  }
  function togglePanel() {
    if (panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  function bindEvents() {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });
    if (closeBtn) closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target)) return;
      if (e.target === btn || btn.contains(e.target)) return;
      closePanel();
    });

    if (showAllBtn) {
      showAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        allOpen = !allOpen;
        render();
      });
    }
  }

  function init() {
    load();
    bindEvents();
    render();
  }

  return {
    init, scheduleSnapshot, snapshot, apply,
    openPanel, closePanel, reset,
  };
})();
