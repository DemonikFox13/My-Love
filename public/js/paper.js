window.LDPaper = (() => {
  const paper = document.getElementById('paper');
  const overlay = document.getElementById('handOverlay');

  const MIN_SCALE = 0.4;
  const MAX_SCALE = 4;
  const MAX_EMPTY = 0.3;

  const state = { x: 0, y: 0, scale: 1 };

  function clamp() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pw = W * state.scale;
    const ph = H * state.scale;

    // Границы: сколько пустоты максимум по краям
    const mX = Math.min(W * MAX_EMPTY, pw);
    const mY = Math.min(H * MAX_EMPTY, ph);

    const xMin = mX - pw;
    const xMax = W - mX;
    const yMin = mY - ph;
    const yMax = H - mY;

    if (xMin <= xMax) state.x = Math.max(xMin, Math.min(xMax, state.x));
    else state.x = (W - pw) / 2;

    if (yMin <= yMax) state.y = Math.max(yMin, Math.min(yMax, state.y));
    else state.y = (H - ph) / 2;
  }

  function apply() {
    paper.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  }

  // Координаты: экран → внутренние CSS-координаты холста
  function screenToLocal(_canvas, clientX, clientY) {
    return {
      x: (clientX - state.x) / state.scale,
      y: (clientY - state.y) / state.scale,
    };
  }

  function reset() {
    state.x = 0;
    state.y = 0;
    state.scale = 1;
    apply();
  }

  function isHandMode() {
    return document.body.classList.contains('hand-mode');
  }

  const points = new Map();
  let gesture = null;

  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  function sync(e) {
    if (e.touches) {
      const ids = new Set();
      for (const t of e.touches) ids.add(t.identifier);
      for (const id of [...points.keys()]) {
        if (!ids.has(id)) points.delete(id);
      }
      for (const t of e.touches) {
        points.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    } else {
      if (e.type === 'mouseup' || e.type === 'mouseleave') {
        points.delete('mouse');
      } else {
        points.set('mouse', { x: e.clientX, y: e.clientY });
      }
    }
  }

  function beginGesture() {
    const pts = [...points.values()];
    if (pts.length === 1) {
      gesture = {
        type: 'pan',
        startTouch: { ...pts[0] },
        startX: state.x,
        startY: state.y,
      };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      gesture = {
        type: 'pinch',
        startDist: dist(a, b),
        startMid: mid(a, b),
        startScale: state.scale,
        startX: state.x,
        startY: state.y,
      };
    } else {
      gesture = null;
    }
  }

  function onDown(e) {
    if (!isHandMode()) return;
    e.preventDefault();
    sync(e);
    beginGesture();
  }

  function onMove(e) {
    if (!isHandMode()) return;
    if (!gesture) return;
    e.preventDefault();
    sync(e);

    const pts = [...points.values()];

    if (gesture.type === 'pan' && pts.length === 1) {
      const p = pts[0];
      state.x = gesture.startX + (p.x - gesture.startTouch.x);
      state.y = gesture.startY + (p.y - gesture.startTouch.y);
      clamp();
      apply();
    } else if (gesture.type === 'pinch' && pts.length >= 2) {
      const [a, b] = pts;
      const d = dist(a, b);
      const factor = d / gesture.startDist;
      let newScale = gesture.startScale * factor;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      // Точка фокуса в локальных координатах
      const localX = (gesture.startMid.x - gesture.startX) / gesture.startScale;
      const localY = (gesture.startMid.y - gesture.startY) / gesture.startScale;

      state.x = gesture.startMid.x - localX * newScale;
      state.y = gesture.startMid.y - localY * newScale;
      state.scale = newScale;
      clamp();
      apply();
    }
  }

  function onUp(e) {
    if (!isHandMode()) return;
    sync(e);
    const pts = [...points.values()];
    if (pts.length === 0) gesture = null;
    else beginGesture();
  }

  function bindEvents() {
    overlay.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    overlay.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: false });
    window.addEventListener('touchcancel', onUp, { passive: false });
  }

  return { apply, screenToLocal, reset, bindEvents, getState: () => ({ ...state }) };
})();
