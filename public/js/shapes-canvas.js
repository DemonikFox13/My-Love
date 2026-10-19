window.LDShapesCanvas = (() => {
  const canvas = document.getElementById('shapesCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  let shapes = [];
  let selectedId = null;
  let gesture = null;
  let pendingTap = null;
  let sendingEnabled = true;
  const guides = { v: [], h: [] };

  const toolbar = document.getElementById('shapesToolbar');

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function genId() { return 's-' + Date.now() + '-' + Math.floor(Math.random() * 9999); }

  function drawShapePath(s, w, h) {
    ctx.beginPath();
    switch (s.type) {
      case 'line': ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); break;
      case 'rect': ctx.rect(0, 0, w, h); break;
      case 'circle': { const r = Math.min(w, h) / 2; ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); break; }
      case 'ellipse': ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
      case 'triangle': ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); break;
      case 'heart': {
        const k = h * 0.3;
        ctx.moveTo(w / 2, h * 0.3);
        ctx.bezierCurveTo(w / 2, 0, 0, 0, 0, k);
        ctx.bezierCurveTo(0, h * 0.55, w / 2, h * 0.75, w / 2, h);
        ctx.bezierCurveTo(w / 2, h * 0.75, w, h * 0.55, w, k);
        ctx.bezierCurveTo(w, 0, w / 2, 0, w / 2, h * 0.3);
        ctx.closePath(); break;
      }
      case 'star': {
        const cx = w / 2, cy = h / 2;
        const outer = Math.min(w, h) / 2;
        const inner = outer * 0.45;
        let rot = -Math.PI / 2;
        const step = Math.PI / 5;
        ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        for (let i = 0; i < 5; i++) {
          rot += step; ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
          rot += step; ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        }
        ctx.closePath(); break;
      }
      case 'arrow': {
        const y = h / 2;
        const headSize = Math.min(w * 0.35, h);
        ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.moveTo(w, y); ctx.lineTo(w - headSize, y - headSize / 2); ctx.lineTo(w - headSize, y + headSize / 2);
        ctx.closePath(); break;
      }
    }
  }

  function drawOne(s, isSelected) {
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate((s.rotation || 0) * Math.PI / 180);
    ctx.scale(s.mirrorH ? -1 : 1, s.mirrorV ? -1 : 1);
    ctx.translate(-s.w / 2, -s.h / 2);
    ctx.lineWidth = s.strokeWidth || 3;
    ctx.strokeStyle = s.color || '#000';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (s.fillOn) ctx.fillStyle = s.fillColor || '#ffd54f';
    drawShapePath(s, s.w, s.h);
    if (s.fillOn) ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (isSelected) {
      ctx.save();
      ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
      ctx.rotate((s.rotation || 0) * Math.PI / 180);
      const lx = -s.w / 2;
      const ly = -s.h / 2;
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(lx - 6, ly - 6, s.w + 12, s.h + 12);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach(s => drawOne(s, s.id === selectedId));
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
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      const dx = px - cx;
      const dy = py - cy;
      const angle = -(s.rotation || 0) * Math.PI / 180;
      let lx = dx * Math.cos(angle) - dy * Math.sin(angle);
      let ly = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (s.mirrorH) lx = -lx;
      if (s.mirrorV) ly = -ly;
      if (lx >= -s.w / 2 && lx <= s.w / 2 && ly >= -s.h / 2 && ly <= s.h / 2) return s;
    }
    return null;
  }

  function getSelected() { return shapes.find(s => s.id === selectedId) || null; }
  function getAll() { return shapes; }

  function selectShape(id) { selectedId = id; toolbar.classList.add('open'); render(); }
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
    if (!window.LDCanvas.state.shapesMode) return;
    e.preventDefault();
    const touches = e.touches || [];

    if (touches.length >= 2) {
      pendingTap = null;
      let target = getSelected();
      if (!target) { const p0 = touchToCanvas(touches[0]); target = hitTest(p0.x, p0.y); }
      if (!target) { const p1 = touchToCanvas(touches[1]); target = hitTest(p1.x, p1.y); }
      if (target) {
        selectShape(target.id);
        const t1 = touches[0], t2 = touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
        gesture = {
          type: 'pinch', startDist: dist, startAngle: angle,
          startW: target.w, startH: target.h,
          startRotation: target.rotation || 0,
          hitId: target.id,
        };
      }
      return;
    }

    if (touches.length === 1 || e.type === 'mousedown') {
      const p = posFromEvent(e);
      const hit = hitTest(p.x, p.y);
      if (hit) {
        selectShape(hit.id);
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
    if (!window.LDCanvas.state.shapesMode) return;
    if (!gesture) return;
    e.preventDefault();
    const touches = e.touches || [];

    if (gesture.type === 'drag' && (touches.length === 1 || e.type === 'mousemove')) {
      const p = posFromEvent(e);
      const dx = p.x - gesture.startX;
      const dy = p.y - gesture.startY;
      const target = shapes.find(s => s.id === gesture.hitId);
      if (!target) return;

      const rawX = gesture.offsetX + dx;
      const rawY = gesture.offsetY + dy;

      let newX = rawX;
      let newY = rawY;
      guides.v = [];
      guides.h = [];

      if (window.LDSnap) {
        const snap = window.LDSnap.snapPosition(rawX, rawY, target.w, target.h, target.id);

        const snapDx = snap.x - rawX;
        const moveX = dx;
        const applyX = Math.abs(snapDx) < 0.5
          || Math.abs(moveX) < 3
          || Math.sign(snapDx) === Math.sign(moveX);
        if (applyX) {
          newX = snap.x;
          guides.v = snap.v;
        }

        const snapDy = snap.y - rawY;
        const moveY = dy;
        const applyY = Math.abs(snapDy) < 0.5
          || Math.abs(moveY) < 3
          || Math.sign(snapDy) === Math.sign(moveY);
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
      const target = shapes.find(s => s.id === gesture.hitId);
      if (!target) return;

      const scale = dist / gesture.startDist;
      let newW = gesture.startW * scale;
      let newH = gesture.startH * scale;

      if (window.LDSnap) {
        const sizeSnap = window.LDSnap.snapSize(newW, newH, target.id);
        const signW = Math.sign(newW - gesture.startW);
        const snapSignW = Math.sign(sizeSnap.w - newW);
        if (sizeSnap.snappedW && (Math.abs(newW - gesture.startW) < 3 || signW === snapSignW || snapSignW === 0)) {
          newW = sizeSnap.w;
        }
        const signH = Math.sign(newH - gesture.startH);
        const snapSignH = Math.sign(sizeSnap.h - newH);
        if (sizeSnap.snappedH && (Math.abs(newH - gesture.startH) < 3 || signH === snapSignH || snapSignH === 0)) {
          newH = sizeSnap.h;
        }
      }

      target.w = Math.max(10, Math.min(2000, newW));
      target.h = Math.max(10, Math.min(2000, newH));

      const dAngle = angle - gesture.startAngle;
      let newRotation = ((gesture.startRotation + dAngle) + 360) % 360;
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      for (const a of angles) {
        if (Math.abs(angularDiff(newRotation, a)) < 6) { newRotation = a; break; }
      }
      target.rotation = newRotation;
      render();
    }
  }

  function onEnd(e) {
    const touches = e.touches || [];

    if (gesture && gesture.type === 'drag' && (touches.length === 0 || e.type === 'mouseup')) {
      const target = shapes.find(s => s.id === gesture.hitId);
      if (target) {
        if (sendingEnabled) {
          window.LDSocket.emit('shape-update', {
            id: target.id, changes: { x: target.x, y: target.y }
          });
        }
        if (window.LDHistory) {
          window.LDHistory.add({ type: 'shape-update', data: { id: target.id, changes: { x: target.x, y: target.y } } });
        }
      }
      guides.v = []; guides.h = [];
      render();
      gesture = null;
    } else if (gesture && gesture.type === 'pinch' && touches.length < 2) {
      const target = shapes.find(s => s.id === gesture.hitId);
      if (target) {
        const changes = { w: target.w, h: target.h, rotation: target.rotation };
        if (sendingEnabled) window.LDSocket.emit('shape-update', { id: target.id, changes });
        if (window.LDHistory) window.LDHistory.add({ type: 'shape-update', data: { id: target.id, changes } });
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
    const s = { id: data.id || genId(), rotation: 0, mirrorH: false, mirrorV: false, ...data };
    shapes.push(s);
    if (silent === undefined) silent = false;
    if (!silent) {
      selectShape(s.id);
      if (sendingEnabled) window.LDSocket.emit('shape-create', s);
    } else {
      render();
    }
    if (window.LDHistory) window.LDHistory.add({ type: 'shape-add', data: { shape: JSON.parse(JSON.stringify(s)) } });
    return s;
  }

  function update(id, changes, silent) {
    const s = shapes.find(x => x.id === id);
    if (!s) return;
    Object.assign(s, changes);
    render();
    if (!silent && sendingEnabled) window.LDSocket.emit('shape-update', { id, changes });
    if (window.LDHistory) window.LDHistory.add({ type: 'shape-update', data: { id, changes } });
  }

  function remove(id) {
    shapes = shapes.filter(s => s.id !== id);
    if (selectedId === id) deselect();
    render();
    if (sendingEnabled) window.LDSocket.emit('shape-delete', { id });
    if (window.LDHistory) window.LDHistory.add({ type: 'shape-delete', data: { id } });
  }
  function clearAll() { shapes = []; deselect(); render(); }
  function setAll(arr) {
    shapes = arr.map(s => ({ rotation: 0, mirrorH: false, mirrorV: false, ...s }));
    deselect(); render();
  }
  function setAllSilent(arr) {
    shapes = arr.map(s => ({ rotation: 0, mirrorH: false, mirrorV: false, ...s }));
    selectedId = null;
    toolbar.classList.remove('open');
    guides.v = []; guides.h = [];
    render();
  }
  function rotate(delta) {
    const s = getSelected(); if (!s) return;
    update(s.id, { rotation: ((s.rotation || 0) + delta + 360) % 360 });
  }
  function mirrorH() { const s = getSelected(); if (!s) return; update(s.id, { mirrorH: !s.mirrorH }); }
  function mirrorV() { const s = getSelected(); if (!s) return; update(s.id, { mirrorV: !s.mirrorV }); }
  function duplicate() {
    const s = getSelected(); if (!s) return;
    const copy = { ...s, id: genId(), x: s.x + 30, y: s.y + 30 };
    shapes.push(copy);
    render();
    if (sendingEnabled) window.LDSocket.emit('shape-create', copy);
    if (window.LDHistory) window.LDHistory.add({ type: 'shape-add', data: { shape: JSON.parse(JSON.stringify(copy)) } });
    selectShape(copy.id);
  }
  function setSending(on) { sendingEnabled = !!on; }

  return {
    canvas, ctx, dpr, resize, bindEvents, render,
    add, update, remove, clearAll, deselect,
    getSelected, getAll, setAll, setAllSilent,
    rotate, mirrorH, mirrorV, duplicate, setSending,
  };
})();
