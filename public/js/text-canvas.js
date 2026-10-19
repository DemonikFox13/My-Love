window.LDTextCanvas = (() => {
  const canvas = document.getElementById('textCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  let texts = [];
  let selectedId = null;
  let gesture = null;
  let pendingTap = null;
  let sendingEnabled = true;
  const guides = { v: [], h: [] };

  const toolbar = document.getElementById('textToolbar');

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function genId() { return 't-' + Date.now() + '-' + Math.floor(Math.random() * 9999); }

  function fontString(t) {
    return `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.size}px ${t.font}`;
  }

  function measure(t) {
    ctx.save();
    ctx.font = fontString(t);
    const m = ctx.measureText(t.text);
    ctx.restore();
    return { width: m.width, height: t.size * 1.2 };
  }

  function drawOne(t, isSelected) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate((t.rotation || 0) * Math.PI / 180);
    ctx.scale(t.mirrorH ? -1 : 1, t.mirrorV ? -1 : 1);
    ctx.font = fontString(t);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    if (t.shadow && t.shadow.on) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = t.shadow.blur || 0;
      ctx.shadowOffsetX = t.shadow.x || 0;
      ctx.shadowOffsetY = t.shadow.y || 0;
    }
    if (t.stroke && t.stroke.on) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.stroke.width || 2;
      ctx.strokeStyle = t.stroke.color || '#fff';
      ctx.strokeText(t.text, 0, 0);
    }
    ctx.fillStyle = t.color || '#000';
    ctx.fillText(t.text, 0, 0);
    if (t.underline) {
      const m = ctx.measureText(t.text);
      const uy = t.size + 2;
      ctx.beginPath();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, t.size / 20);
      ctx.moveTo(0, uy); ctx.lineTo(m.width, uy);
      ctx.stroke();
    }
    ctx.restore();

    if (isSelected) {
      const m = measure(t);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate((t.rotation || 0) * Math.PI / 180);
      const w = m.width, h = m.height;
      const lx = t.mirrorH ? -w : 0;
      const ly = t.mirrorV ? -h : 0;
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(lx - 4, ly - 4, w + 8, h + 8);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    texts.forEach(t => drawOne(t, t.id === selectedId));
    if (guides.v.length || guides.h.length) {
      ctx.save();
      ctx.strokeStyle = '#ff5c8a';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 5]);
      for (const x of guides.v) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, window.innerHeight); ctx.stroke(); }
      for (const y of guides.h) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(window.innerWidth, y); ctx.stroke(); }
      ctx.restore();
    }
  }

  function hitTest(px, py) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const dx = px - t.x, dy = py - t.y;
      const angle = -(t.rotation || 0) * Math.PI / 180;
      let lx = dx * Math.cos(angle) - dy * Math.sin(angle);
      let ly = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (t.mirrorH) lx = -lx;
      if (t.mirrorV) ly = -ly;
      const m = measure(t);
      if (lx >= 0 && lx <= m.width && ly >= 0 && ly <= m.height) return t;
    }
    return null;
  }

  function getSelected() { return texts.find(t => t.id === selectedId) || null; }
  function getAll() { return texts; }
  function selectText(id) { selectedId = id; toolbar.classList.add('open'); render(); }
  function deselect() {
    selectedId = null;
    toolbar.classList.remove('open');
    guides.v = []; guides.h = [];
    render();
  }
  function angularDiff(a, b) { return ((a - b + 540) % 360) - 180; }
  function posFromEvent(e) {
    const t = e.touches ? e.touches[0] : e;
    if (window.LDPaper) return window.LDPaper.screenToLocal(canvas, t.clientX, t.clientY);
    const rect = canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function touchToCanvas(touch) {
    if (window.LDPaper) return window.LDPaper.screenToLocal(canvas, touch.clientX, touch.clientY);
    const rect = canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function onStart(e) {
    if (!window.LDCanvas.state.textMode) return;
    e.preventDefault();
    const touches = e.touches || [];
    if (touches.length >= 2) {
      pendingTap = null;
      let target = getSelected();
      if (!target) { const p0 = touchToCanvas(touches[0]); target = hitTest(p0.x, p0.y); }
      if (!target) { const p1 = touchToCanvas(touches[1]); target = hitTest(p1.x, p1.y); }
      if (target) {
        selectText(target.id);
        const t1 = touches[0], t2 = touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
        gesture = {
          type: 'pinch', startDist: dist, startAngle: angle,
          startSize: target.size, startRotation: target.rotation || 0,
          hitId: target.id,
        };
      }
      return;
    }
    if (touches.length === 1 || e.type === 'mousedown') {
      const p = posFromEvent(e);
      const hit = hitTest(p.x, p.y);
      if (hit) {
        selectText(hit.id);
        gesture = {
          type: 'drag', startX: p.x, startY: p.y,
          offsetX: hit.x, offsetY: hit.y,
          hitId: hit.id,
        };
        pendingTap = null;
      } else {
        if (!gesture) pendingTap = { x: p.x, y: p.y };
      }
    }
  }

  function onMove(e) {
    if (!window.LDCanvas.state.textMode) return;
    if (!gesture) return;
    e.preventDefault();
    const touches = e.touches || [];

    if (gesture.type === 'drag' && (touches.length === 1 || e.type === 'mousemove')) {
      const p = posFromEvent(e);
      const dx = p.x - gesture.startX;
      const dy = p.y - gesture.startY;
      const target = texts.find(t => t.id === gesture.hitId);
      if (!target) return;

      const rawX = gesture.offsetX + dx;
      const rawY = gesture.offsetY + dy;
      const m = measure(target);

      let newX = rawX;
      let newY = rawY;
      guides.v = [];
      guides.h = [];

      if (window.LDSnap) {
        const snap = window.LDSnap.snapPosition(rawX, rawY, m.width, m.height, target.id);
        const snapDx = snap.x - rawX;
        const applyX = Math.abs(snapDx) < 0.5
          || Math.abs(dx) < 3
          || Math.sign(snapDx) === Math.sign(dx);
        if (applyX) {
          newX = snap.x;
          guides.v = snap.v;
        }
        const snapDy = snap.y - rawY;
        const applyY = Math.abs(snapDy) < 0.5
          || Math.abs(dy) < 3
          || Math.sign(snapDy) === Math.sign(dy);
        if (applyY) {
          newY = snap.y;
          guides.h = snap.h;
        }
      }

      target.x = newX;
      target.y = newY;
      render();
    } else if (gesture.type === 'pinch' && touches.length === 2) {
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
      const target = texts.find(t => t.id === gesture.hitId);
      if (!target) return;

      const scale = dist / gesture.startDist;
      let newSize = Math.max(8, Math.min(300, Math.round(gesture.startSize * scale)));

      if (window.LDSnap) {
        const approxH = newSize * 1.2;
        const sizeSnap = window.LDSnap.snapSize(0, approxH, target.id);
        const signH = Math.sign(newSize - gesture.startSize);
        const snapSignH = Math.sign(sizeSnap.h - approxH);
        if (sizeSnap.snappedH && (Math.abs(newSize - gesture.startSize) < 2 || signH === snapSignH || snapSignH === 0)) {
          newSize = Math.round(sizeSnap.h / 1.2);
        }
      }

      const dAngle = angle - gesture.startAngle;
      let newRotation = ((gesture.startRotation + dAngle) + 360) % 360;
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      for (const a of angles) {
        if (Math.abs(angularDiff(newRotation, a)) < 6) { newRotation = a; break; }
      }
      target.size = newSize;
      target.rotation = newRotation;
      render();
    }
  }

  function onEnd(e) {
    const touches = e.touches || [];
    if (gesture && gesture.type === 'drag' && (touches.length === 0 || e.type === 'mouseup')) {
      const target = texts.find(t => t.id === gesture.hitId);
      if (target) {
        const changes = { x: target.x, y: target.y };
        if (sendingEnabled) window.LDSocket.emit('text-update', { id: target.id, changes });
        if (window.LDHistory) window.LDHistory.add({ type: 'text-update', data: { id: target.id, changes } });
      }
      guides.v = []; guides.h = [];
      render();
      gesture = null;
    } else if (gesture && gesture.type === 'pinch' && touches.length < 2) {
      const target = texts.find(t => t.id === gesture.hitId);
      if (target) {
        const changes = { size: target.size, rotation: target.rotation };
        if (sendingEnabled) window.LDSocket.emit('text-update', { id: target.id, changes });
        if (window.LDHistory) window.LDHistory.add({ type: 'text-update', data: { id: target.id, changes } });
      }
      gesture = null;
    }
    if (pendingTap && touches.length === 0) {
      deselect();
      pendingTap = null;
    }
  }

  function bindEvents() {
    canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onEnd, { passive: false });
    window.addEventListener('resize', resize);
  }

  function add(data, silent) {
    const t = { id: data.id || genId(), rotation: 0, mirrorH: false, mirrorV: false, ...data };
    texts.push(t);
    if (silent === undefined) silent = false;
    if (!silent) {
      selectText(t.id);
      if (sendingEnabled) window.LDSocket.emit('text-create', t);
    } else {
      render();
    }
    if (window.LDHistory) window.LDHistory.add({ type: 'text-add', data: { text: JSON.parse(JSON.stringify(t)) } });
    return t;
  }
  function update(id, changes, silent) {
    const t = texts.find(x => x.id === id);
    if (!t) return;
    Object.assign(t, changes);
    render();
    if (!silent && sendingEnabled) window.LDSocket.emit('text-update', { id, changes });
    if (window.LDHistory) window.LDHistory.add({ type: 'text-update', data: { id, changes } });
  }
  function remove(id) {
    texts = texts.filter(t => t.id !== id);
    if (selectedId === id) deselect();
    render();
    if (sendingEnabled) window.LDSocket.emit('text-delete', { id });
    if (window.LDHistory) window.LDHistory.add({ type: 'text-delete', data: { id } });
  }
  function clearAll() { texts = []; deselect(); render(); }
  function setAll(arr) {
    texts = arr.map(t => ({ rotation: 0, mirrorH: false, mirrorV: false, ...t }));
    deselect(); render();
  }
  function setAllSilent(arr) {
    texts = arr.map(t => ({ rotation: 0, mirrorH: false, mirrorV: false, ...t }));
    selectedId = null;
    toolbar.classList.remove('open');
    guides.v = []; guides.h = [];
    render();
  }
  function rotate(delta) {
    const t = getSelected(); if (!t) return;
    update(t.id, { rotation: ((t.rotation || 0) + delta + 360) % 360 });
  }
  function mirrorH() { const t = getSelected(); if (!t) return; update(t.id, { mirrorH: !t.mirrorH }); }
  function mirrorV() { const t = getSelected(); if (!t) return; update(t.id, { mirrorV: !t.mirrorV }); }
  function duplicate() {
    const t = getSelected(); if (!t) return;
    const copy = { ...t, id: genId(), x: t.x + 30, y: t.y + 30 };
    texts.push(copy);
    render();
    if (sendingEnabled) window.LDSocket.emit('text-create', copy);
    if (window.LDHistory) window.LDHistory.add({ type: 'text-add', data: { text: JSON.parse(JSON.stringify(copy)) } });
    selectText(copy.id);
  }
  function setSending(on) { sendingEnabled = !!on; }

  return {
    canvas, ctx, dpr, resize, bindEvents, render,
    add, update, remove, clearAll, deselect,
    getSelected, getAll, setAll, setAllSilent,
    rotate, mirrorH, mirrorV, duplicate, setSending,
    measure,
  };
})();
