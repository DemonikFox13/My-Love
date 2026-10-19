window.LDToolbarEditor = (() => {
  const STORAGE_KEY = 'ld_toolbar_order_v1';
  const toolbar = document.querySelector('.toolbar');
  const editBtn = document.getElementById('editToolbarBtn');
  if (!toolbar || !editBtn) return { init: () => {} };

  let editing = false;
  let dragEl = null;

  function getKey(el) {
    if (el.id) return 'id:' + el.id;
    if (el.classList && el.classList.contains('color-picker')) return 'k:color-picker';
    if (el.classList && el.classList.contains('slider-wrap')) return 'k:slider-wrap';
    return null;
  }

  function saveOrder() {
    try {
      const order = Array.from(toolbar.children).map(getKey).filter(Boolean);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (e) {}
  }

  function applyOrder() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const order = JSON.parse(raw);
      if (!Array.isArray(order) || !order.length) return;

      const map = {};
      Array.from(toolbar.children).forEach(c => {
        const k = getKey(c);
        if (k) map[k] = c;
      });

      order.forEach(key => {
        if (map[key]) {
          toolbar.appendChild(map[key]);
          delete map[key];
        }
      });
      Object.keys(map).forEach(k => toolbar.appendChild(map[k]));
    } catch (e) {}
  }

  function setEditing(on) {
    editing = !!on;
    toolbar.classList.toggle('editing', editing);
    editBtn.classList.toggle('active', editing);
  }

  function onDown(e) {
    if (!editing) return;
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
    const btn = e.target.closest('.toolbar > *');
    if (!btn) return;
    dragEl = btn;
    btn.classList.add('dragging');
    e.preventDefault();
    e.stopPropagation();
  }

  function onMove(e) {
    if (!editing || !dragEl) return;
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const x = t.clientX, y = t.clientY;
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    const target = el.closest('.toolbar > *');
    if (!target || target === dragEl) return;

    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    if (x < centerX) {
      toolbar.insertBefore(dragEl, target);
    } else {
      toolbar.insertBefore(dragEl, target.nextSibling);
    }
  }

  function onUp() {
    if (!dragEl) return;
    dragEl.classList.remove('dragging');
    dragEl = null;
    saveOrder();
  }

  function bindDrag() {
    toolbar.addEventListener('touchstart', onDown, { passive: false });
    toolbar.addEventListener('touchmove', onMove, { passive: false });
    toolbar.addEventListener('touchend', onUp);
    toolbar.addEventListener('touchcancel', onUp);
    toolbar.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // Блокируем клики по кнопкам тулбара в режиме редактирования
    toolbar.addEventListener('click', (e) => {
      if (editing) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  function init() {
    applyOrder();
    bindDrag();

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setEditing(!editing);
    });

    document.addEventListener('click', (e) => {
      if (!editing) return;
      if (toolbar.contains(e.target)) return;
      if (editBtn.contains(e.target)) return;
      const topbar = document.getElementById('topbar');
      if (topbar && topbar.contains(e.target)) return;
      setEditing(false);
    });
  }

  return { init };
})();
