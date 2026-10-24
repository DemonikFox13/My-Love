window.LDCanvas = (() => {
  const bgCanvas = document.getElementById('bgCanvas');
  const canvas   = document.getElementById('board');
  const previewCanvas = document.getElementById('previewCanvas');
  const pawsCanvas = document.getElementById('pawsCanvas');
  const bgCtx    = bgCanvas.getContext('2d');
  const ctx      = canvas.getContext('2d');
  const pctx     = previewCanvas ? previewCanvas.getContext('2d') : null;
  const pawsCtx  = pawsCanvas ? pawsCanvas.getContext('2d') : null;
  const dpr      = window.devicePixelRatio || 1;

  const TOL = 30;

  const state = {
    color: '#000000',
    lineWidth: 3,
    tool: 'brush',
    drawing: false,
    lastPoint: null,
    lineStart: null,
    lineEnd: null,
    textMode: false,
    shapesMode: false,
    eraserFilter: { mode: 'all', colors: [] },
    eraserPickCallback: null,
    paw: { type: 'cat', size: 40, mode: 'fade', timer: 5 },
    pawLast: null,
    pawSide: 'L',
  };

  const buffer = [];
  const historyBuffer = [];
  let sendingToPartner = true;

  const PAW_QUEUE_MAX = 5;
  const PAW_ALPHAS = [1.0, 0.78, 0.55, 0.33, 0.12];
  const PAW_QUEUE_TIMEOUT_MS = 8000;
  const pawsQueue = [];
  const timerPaws = [];

  function addPaw(paw) {
    if (!paw.addedAt) paw.addedAt = Date.now();
    pawsQueue.unshift(paw);
    while (pawsQueue.length > PAW_QUEUE_MAX) pawsQueue.pop();
    redrawPaws();
  }

  function addPawTimer(paw, seconds) {
    const entry = { paw, timeoutId: null };
    entry.timeoutId = setTimeout(() => {
      const idx = timerPaws.indexOf(entry);
      if (idx >= 0) timerPaws.splice(idx, 1);
      redrawPaws();
    }, seconds * 1000);
    timerPaws.push(entry);
    redrawPaws();
  }

  function redrawPaws() {
    if (!pawsCtx || !pawsCanvas) return;
    pawsCtx.setTransform(1, 0, 0, 1, 0, 0);
    pawsCtx.clearRect(0, 0, pawsCanvas.width, pawsCanvas.height);
    pawsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (let i = 0; i < pawsQueue.length; i++) {
      const paw = pawsQueue[i];
      const alpha = PAW_ALPHAS[i] !== undefined ? PAW_ALPHAS[i] : 0;
      if (alpha <= 0) continue;
      pawsCtx.globalAlpha = alpha;
      if (window.LDPaws && window.LDPaws.drawPaw) {
        window.LDPaws.drawPaw(pawsCtx, paw);
      }
    }
    for (let i = 0; i < timerPaws.length; i++) {
      pawsCtx.globalAlpha = 1;
      if (window.LDPaws && window.LDPaws.drawPaw) {
        window.LDPaws.drawPaw(pawsCtx, timerPaws[i].paw);
      }
    }
    pawsCtx.globalAlpha = 1;
  }

  setInterval(() => {
    if (pawsQueue.length === 0) return;
    const now = Date.now();
    let changed = false;
    for (let i = pawsQueue.length - 1; i >= 0; i--) {
      if (state.drawing && i === 0) { pawsQueue[i].addedAt = now; continue; }
      if (now - pawsQueue[i].addedAt >= PAW_QUEUE_TIMEOUT_MS) { pawsQueue.splice(i, 1); changed = true; }
    }
    if (changed) redrawPaws();
  }, 300);

  function clearPaws() {
    pawsQueue.length = 0;
    timerPaws.forEach(e => clearTimeout(e.timeoutId));
    timerPaws.length = 0;
    if (pawsCtx && pawsCanvas) {
      pawsCtx.setTransform(1, 0, 0, 1, 0, 0);
      pawsCtx.clearRect(0, 0, pawsCanvas.width, pawsCanvas.height);
    }
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx*dx + dy*dy;
    let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function erasePawsAlong(from, to, radius) {
    let changed = false;
    for (let i = pawsQueue.length - 1; i >= 0; i--) {
      const p = pawsQueue[i];
      if (distToSegment(p.x, p.y, from.x, from.y, to.x, to.y) < radius + p.size * 0.5) { pawsQueue.splice(i, 1); changed = true; }
    }
    for (let i = timerPaws.length - 1; i >= 0; i--) {
      const p = timerPaws[i].paw;
      if (distToSegment(p.x, p.y, from.x, from.y, to.x, to.y) < radius + p.size * 0.5) { clearTimeout(timerPaws[i].timeoutId); timerPaws.splice(i, 1); changed = true; }
    }
    if (changed) redrawPaws();
  }

  function drawPawPermanent(paw) {
    if (window.LDPaws && window.LDPaws.drawPaw) window.LDPaws.drawPaw(ctx, paw);
  }

  function commitPreset() {
    if (window.LDPresets && window.LDPresets.scheduleSnapshot) window.LDPresets.scheduleSnapshot();
  }

  function hexToRgb(hex) {
    const m = hex.replace('#','').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
  }
  function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    [bgCanvas, canvas, previewCanvas, pawsCanvas].forEach(c => {
      if (!c) return;
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
    });
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pctx) pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pawsCtx) pawsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    redrawPaws();
  }

  function getPos(e) {
    const t = e.touches ? e.touches[0] : e;
    if (window.LDPaper) return window.LDPaper.screenToLocal(canvas, t.clientX, t.clientY);
    const rect = canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  // Универсальная функция: понимает и пиксели, и проценты экрана (0..1)
  function getScreenCoords(p) {
    if (p.xPct !== undefined) return { x: p.xPct * window.innerWidth, y: p.yPct * window.innerHeight };
    return { x: p.x, y: p.y };
  }

  function drawSegment(from, to, color, width, isEraser) {
    const f = getScreenCoords(from); const t = getScreenCoords(to);
    ctx.save();
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color || '#000000';
    ctx.lineWidth = width || 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    ctx.restore();
  }

  function eraseFiltered(from, to, width, filter) {
    const f = getScreenCoords(from); const t = getScreenCoords(to);
    if (!filter || filter.mode === 'all' || (filter.colors.length === 0 && filter.mode !== 'erase-except')) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; ctx.lineWidth = width;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.restore();
      return;
    }
    const half = width / 2 + 2;
    const bx1 = Math.max(0, Math.floor((Math.min(f.x, t.x) - half) * dpr));
    const by1 = Math.max(0, Math.floor((Math.min(f.y, t.y) - half) * dpr));
    const bx2 = Math.min(canvas.width,  Math.ceil((Math.max(f.x, t.x) + half) * dpr));
    const by2 = Math.min(canvas.height, Math.ceil((Math.max(f.y, t.y) + half) * dpr));
    const w = bx2 - bx1, h = by2 - by1;
    if (w <= 0 || h <= 0) return;
    let img; try { img = ctx.getImageData(bx1, by1, w, h); } catch (e) { return; }
    const data = img.data;
    const lx1 = f.x * dpr, ly1 = f.y * dpr, lx2 = t.x * dpr, ly2 = t.y * dpr;
    const dx = lx2 - lx1, dy = ly2 - ly1, lenSq = dx*dx + dy*dy;
    const brushRadius = (width / 2) * dpr;
    const filterRgb = filter.colors.map(hexToRgb).filter(Boolean);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = bx1 + x, py = by1 + y;
        let tval = lenSq > 0 ? ((px - lx1) * dx + (py - ly1) * dy) / lenSq : 0;
        tval = Math.max(0, Math.min(1, tval));
        if (Math.hypot(px - (lx1 + tval * dx), py - (ly1 + tval * dy)) > brushRadius) continue;
        const idx = (y * w + x) * 4;
        if (data[idx + 3] < 10) continue;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        const matched = filterRgb.some(c => Math.abs(r - c.r) < TOL && Math.abs(g - c.g) < TOL && Math.abs(b - c.b) < TOL);
        if (filter.mode === 'erase-only' ? matched : !matched) data[idx + 3] = 0;
      }
    }
    ctx.putImageData(img, bx1, by1);
  }

  function drawLinePreview() {
    if (!pctx || !state.lineStart || !state.lineEnd) return;
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pctx.save(); pctx.strokeStyle = state.color; pctx.lineWidth = state.lineWidth; pctx.lineCap = 'round'; pctx.setLineDash([10, 6]);
    pctx.beginPath(); pctx.moveTo(state.lineStart.x, state.lineStart.y); pctx.lineTo(state.lineEnd.x, state.lineEnd.y); pctx.stroke(); pctx.restore();
  }
  function clearPreview() { if (pctx) pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); }

  function getPixelHex(x, y) {
    const px = Math.round(x * dpr), py = Math.round(y * dpr);
    if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) return null;
    try {
      const d = ctx.getImageData(px, py, 1, 1).data;
      if (d[3] > 10) return rgbToHex(d[0], d[1], d[2]);
      const bd = bgCtx.getImageData(px, py, 1, 1).data;
      return rgbToHex(bd[0], bd[1], bd[2]);
    } catch (e) { return null; }
  }

  function pickColor(x, y) {
    const hex = getPixelHex(x, y);
    if (!hex) return;
    state.color = hex;
    if (window.LDPalette && window.LDPalette.setFromHex) window.LDPalette.setFromHex(hex);
    state.tool = 'brush';
    if (window.LDTools && window.LDTools.setActive) window.LDTools.setActive('brush');
  }

  function floodFill(x, y, color) {
    const W = canvas.width, H = canvas.height;
    const px = Math.round(x * dpr), py = Math.round(y * dpr);
    if (px < 0 || px >= W || py < 0 || py >= H) return;
    const rgb = hexToRgb(color);
    if (!rgb) return;
    const fR = rgb.r, fG = rgb.g, fB = rgb.b, fA = 255;
    let imgData; try { imgData = ctx.getImageData(0, 0, W, H); } catch (e) { return; }
    const data = imgData.data;
    const startIdx = (py * W + px) * 4;
    const tR = data[startIdx], tG = data[startIdx+1], tB = data[startIdx+2], tA = data[startIdx+3];
    if (tR === fR && tG === fG && tB === fB && tA === fA) return;
    const visited = new Uint8Array(W * H);
    const stack = [px, py];
    let iter = 0;
    while (stack.length) {
      if (++iter > W * H * 2) break;
      const cy = stack.pop(), cx = stack.pop();
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
      const idx = cy * W + cx;
      if (visited[idx]) continue;
      visited[idx] = 1;
      const p = idx * 4;
      if (data[p] !== tR || data[p+1] !== tG || data[p+2] !== tB || data[p+3] !== tA) continue;
      data[p] = fR; data[p+1] = fG; data[p+2] = fB; data[p+3] = fA;
      stack.push(cx+1, cy, cx-1, cy, cx, cy+1, cx, cy-1);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function emitFill(x, y, color) {
    if (!sendingToPartner) return;
    window.LDSocket.emit('fill', { xPct: x / window.innerWidth, yPct: y / window.innerHeight, color });
  }

  function exitSpecialModes() {
    if (window.LDTextTool && window.LDTextTool.setTextMode) window.LDTextTool.setTextMode(false);
    if (window.LDShapesTool && window.LDShapesTool.setShapesMode) window.LDShapesTool.setShapesMode(false);
    state.textMode = false; state.shapesMode = false;
    document.body.classList.remove('text-mode', 'shapes-mode
cat > public/js/canvas.js << 'EOF'
window.LDCanvas = (() => {
  const bgCanvas = document.getElementById('bgCanvas');
  const canvas   = document.getElementById('board');
  const previewCanvas = document.getElementById('previewCanvas');
  const pawsCanvas = document.getElementById('pawsCanvas');
  const bgCtx    = bgCanvas.getContext('2d');
  const ctx      = canvas.getContext('2d');
  const pctx     = previewCanvas ? previewCanvas.getContext('2d') : null;
  const pawsCtx  = pawsCanvas ? pawsCanvas.getContext('2d') : null;
  const dpr      = window.devicePixelRatio || 1;

  const TOL = 30;

  const state = {
    color: '#000000',
    lineWidth: 3,
    tool: 'brush',
    drawing: false,
    lastPoint: null,
    lineStart: null,
    lineEnd: null,
    textMode: false,
    shapesMode: false,
    eraserFilter: { mode: 'all', colors: [] },
    eraserPickCallback: null,
    paw: { type: 'cat', size: 40, mode: 'fade', timer: 5 },
    pawLast: null,
    pawSide: 'L',
  };

  const buffer = [];
  const historyBuffer = [];
  let sendingToPartner = true;

  const PAW_QUEUE_MAX = 5;
  const PAW_ALPHAS = [1.0, 0.78, 0.55, 0.33, 0.12];
  const PAW_QUEUE_TIMEOUT_MS = 8000;
  const pawsQueue = [];
  const timerPaws = [];

  function addPaw(paw) {
    if (!paw.addedAt) paw.addedAt = Date.now();
    pawsQueue.unshift(paw);
    while (pawsQueue.length > PAW_QUEUE_MAX) pawsQueue.pop();
    redrawPaws();
  }

  function addPawTimer(paw, seconds) {
    const entry = { paw, timeoutId: null };
    entry.timeoutId = setTimeout(() => {
      const idx = timerPaws.indexOf(entry);
      if (idx >= 0) timerPaws.splice(idx, 1);
      redrawPaws();
    }, seconds * 1000);
    timerPaws.push(entry);
    redrawPaws();
  }

  function redrawPaws() {
    if (!pawsCtx || !pawsCanvas) return;
    pawsCtx.setTransform(1, 0, 0, 1, 0, 0);
    pawsCtx.clearRect(0, 0, pawsCanvas.width, pawsCanvas.height);
    pawsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (let i = 0; i < pawsQueue.length; i++) {
      const paw = pawsQueue[i];
      const alpha = PAW_ALPHAS[i] !== undefined ? PAW_ALPHAS[i] : 0;
      if (alpha <= 0) continue;
      pawsCtx.globalAlpha = alpha;
      if (window.LDPaws && window.LDPaws.drawPaw) {
        window.LDPaws.drawPaw(pawsCtx, paw);
      }
    }
    for (let i = 0; i < timerPaws.length; i++) {
      pawsCtx.globalAlpha = 1;
      if (window.LDPaws && window.LDPaws.drawPaw) {
        window.LDPaws.drawPaw(pawsCtx, timerPaws[i].paw);
      }
    }
    pawsCtx.globalAlpha = 1;
  }

  setInterval(() => {
    if (pawsQueue.length === 0) return;
    const now = Date.now();
    let changed = false;
    for (let i = pawsQueue.length - 1; i >= 0; i--) {
      if (state.drawing && i === 0) { pawsQueue[i].addedAt = now; continue; }
      if (now - pawsQueue[i].addedAt >= PAW_QUEUE_TIMEOUT_MS) { pawsQueue.splice(i, 1); changed = true; }
    }
    if (changed) redrawPaws();
  }, 300);

  function clearPaws() {
    pawsQueue.length = 0;
    timerPaws.forEach(e => clearTimeout(e.timeoutId));
    timerPaws.length = 0;
    if (pawsCtx && pawsCanvas) {
      pawsCtx.setTransform(1, 0, 0, 1, 0, 0);
      pawsCtx.clearRect(0, 0, pawsCanvas.width, pawsCanvas.height);
    }
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx*dx + dy*dy;
    let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function erasePawsAlong(from, to, radius) {
    let changed = false;
    for (let i = pawsQueue.length - 1; i >= 0; i--) {
      const p = pawsQueue[i];
      if (distToSegment(p.x, p.y, from.x, from.y, to.x, to.y) < radius + p.size * 0.5) { pawsQueue.splice(i, 1); changed = true; }
    }
    for (let i = timerPaws.length - 1; i >= 0; i--) {
      const p = timerPaws[i].paw;
      if (distToSegment(p.x, p.y, from.x, from.y, to.x, to.y) < radius + p.size * 0.5) { clearTimeout(timerPaws[i].timeoutId); timerPaws.splice(i, 1); changed = true; }
    }
    if (changed) redrawPaws();
  }

  function drawPawPermanent(paw) {
    if (window.LDPaws && window.LDPaws.drawPaw) window.LDPaws.drawPaw(ctx, paw);
  }

  function commitPreset() {
    if (window.LDPresets && window.LDPresets.scheduleSnapshot) window.LDPresets.scheduleSnapshot();
  }

  function hexToRgb(hex) {
    const m = hex.replace('#','').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
  }
  function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    [bgCanvas, canvas, previewCanvas, pawsCanvas].forEach(c => {
      if (!c) return;
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
    });
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pctx) pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pawsCtx) pawsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    redrawPaws();
  }

  function getPos(e) {
    const t = e.touches ? e.touches[0] : e;
    if (window.LDPaper) return window.LDPaper.screenToLocal(canvas, t.clientX, t.clientY);
    const rect = canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  // Универсальная функция: понимает и пиксели, и проценты экрана (0..1)
  function getScreenCoords(p) {
    if (p.xPct !== undefined) return { x: p.xPct * window.innerWidth, y: p.yPct * window.innerHeight };
    return { x: p.x, y: p.y };
  }

  function drawSegment(from, to, color, width, isEraser) {
    const f = getScreenCoords(from); const t = getScreenCoords(to);
    ctx.save();
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color || '#000000';
    ctx.lineWidth = width || 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    ctx.restore();
  }

  function eraseFiltered(from, to, width, filter) {
    const f = getScreenCoords(from); const t = getScreenCoords(to);
    if (!filter || filter.mode === 'all' || (filter.colors.length === 0 && filter.mode !== 'erase-except')) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; ctx.lineWidth = width;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.restore();
      return;
    }
    const half = width / 2 + 2;
    const bx1 = Math.max(0, Math.floor((Math.min(f.x, t.x) - half) * dpr));
    const by1 = Math.max(0, Math.floor((Math.min(f.y, t.y) - half) * dpr));
    const bx2 = Math.min(canvas.width,  Math.ceil((Math.max(f.x, t.x) + half) * dpr));
    const by2 = Math.min(canvas.height, Math.ceil((Math.max(f.y, t.y) + half) * dpr));
    const w = bx2 - bx1, h = by2 - by1;
    if (w <= 0 || h <= 0) return;
    let img; try { img = ctx.getImageData(bx1, by1, w, h); } catch (e) { return; }
    const data = img.data;
    const lx1 = f.x * dpr, ly1 = f.y * dpr, lx2 = t.x * dpr, ly2 = t.y * dpr;
    const dx = lx2 - lx1, dy = ly2 - ly1, lenSq = dx*dx + dy*dy;
    const brushRadius = (width / 2) * dpr;
    const filterRgb = filter.colors.map(hexToRgb).filter(Boolean);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = bx1 + x, py = by1 + y;
        let tval = lenSq > 0 ? ((px - lx1) * dx + (py - ly1) * dy) / lenSq : 0;
        tval = Math.max(0, Math.min(1, tval));
        if (Math.hypot(px - (lx1 + tval * dx), py - (ly1 + tval * dy)) > brushRadius) continue;
        const idx = (y * w + x) * 4;
        if (data[idx + 3] < 10) continue;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        const matched = filterRgb.some(c => Math.abs(r - c.r) < TOL && Math.abs(g - c.g) < TOL && Math.abs(b - c.b) < TOL);
        if (filter.mode === 'erase-only' ? matched : !matched) data[idx + 3] = 0;
      }
    }
    ctx.putImageData(img, bx1, by1);
  }

  function drawLinePreview() {
    if (!pctx || !state.lineStart || !state.lineEnd) return;
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pctx.save(); pctx.strokeStyle = state.color; pctx.lineWidth = state.lineWidth; pctx.lineCap = 'round'; pctx.setLineDash([10, 6]);
    pctx.beginPath(); pctx.moveTo(state.lineStart.x, state.lineStart.y); pctx.lineTo(state.lineEnd.x, state.lineEnd.y); pctx.stroke(); pctx.restore();
  }
  function clearPreview() { if (pctx) pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); }

  function getPixelHex(x, y) {
    const px = Math.round(x * dpr), py = Math.round(y * dpr);
    if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) return null;
    try {
      const d = ctx.getImageData(px, py, 1, 1).data;
      if (d[3] > 10) return rgbToHex(d[0], d[1], d[2]);
      const bd = bgCtx.getImageData(px, py, 1, 1).data;
      return rgbToHex(bd[0], bd[1], bd[2]);
    } catch (e) { return null; }
  }

  function pickColor(x, y) {
    const hex = getPixelHex(x, y);
    if (!hex) return;
    state.color = hex;
    if (window.LDPalette && window.LDPalette.setFromHex) window.LDPalette.setFromHex(hex);
    state.tool = 'brush';
    if (window.LDTools && window.LDTools.setActive) window.LDTools.setActive('brush');
  }

  function floodFill(x, y, color) {
    const W = canvas.width, H = canvas.height;
    const px = Math.round(x * dpr), py = Math.round(y * dpr);
    if (px < 0 || px >= W || py < 0 || py >= H) return;
    const rgb = hexToRgb(color);
    if (!rgb) return;
    const fR = rgb.r, fG = rgb.g, fB = rgb.b, fA = 255;
    let imgData; try { imgData = ctx.getImageData(0, 0, W, H); } catch (e) { return; }
    const data = imgData.data;
    const startIdx = (py * W + px) * 4;
    const tR = data[startIdx], tG = data[startIdx+1], tB = data[startIdx+2], tA = data[startIdx+3];
    if (tR === fR && tG === fG && tB === fB && tA === fA) return;
    const visited = new Uint8Array(W * H);
    const stack = [px, py];
    let iter = 0;
    while (stack.length) {
      if (++iter > W * H * 2) break;
      const cy = stack.pop(), cx = stack.pop();
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
      const idx = cy * W + cx;
      if (visited[idx]) continue;
      visited[idx] = 1;
      const p = idx * 4;
      if (data[p] !== tR || data[p+1] !== tG || data[p+2] !== tB || data[p+3] !== tA) continue;
      data[p] = fR; data[p+1] = fG; data[p+2] = fB; data[p+3] = fA;
      stack.push(cx+1, cy, cx-1, cy, cx, cy+1, cx, cy-1);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function emitFill(x, y, color) {
    if (!sendingToPartner) return;
    window.LDSocket.emit('fill', { xPct: x / window.innerWidth, yPct: y / window.innerHeight, color });
  }

  function exitSpecialModes() {
    if (window.LDTextTool && window.LDTextTool.setTextMode) window.LDTextTool.setTextMode(false);
    if (window.LDShapesTool && window.LDShapesTool.setShapesMode) window.LDShapesTool.setShapesMode(false);
    state.textMode = false; state.shapesMode = false;
    document.body.classList.remove('text-mode', 'shapes-mode');
  }

  function placePawsAlong(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return;
    const size = state.paw.size, stepDist = size * 1.2, gap = size * 0.55;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const nx = dx / len, ny = dy / len, perpX = -ny, perpY = nx;
    const mode = state.paw.mode || 'fade', timerSec = state.paw.timer || 5;
    let travelled = 0;
    while (travelled + stepDist <= len) {
      travelled += stepDist;
      const px = from.x + nx * travelled, py = from.y + ny * travelled;
      const sideMul = state.pawSide === 'L' ? -1 : 1;
      const paw = { isPaw: true, mode, timer: timerSec, x: px + perpX * gap * sideMul, y: py + perpY * gap * sideMul, angle, side: state.pawSide, pawType: state.paw.type, size, color: state.color, addedAt: Date.now() };
      if (mode === 'fade') addPaw(paw); else if (mode === 'timer') addPawTimer(paw, timerSec); else { drawPawPermanent(paw); historyBuffer.push(paw); }
      if (sendingToPartner) window.LDSocket.emit('paw', paw); else buffer.push(paw);
      state.pawSide = state.pawSide === 'L' ? 'R' : 'L';
    }
    state.pawLast = { x: from.x + nx * travelled, y: from.y + ny * travelled };
  }

  function start(e) {
    e.preventDefault();
    if (state.textMode || state.shapesMode || state.tool === 'hand') return;
    const p = getPos(e);
    const t = e.touches ? e.touches[0] : e;
    // Сохраняем координаты экрана для отправки
    state.lastScreenPoint = { xPct: t.clientX / window.innerWidth, yPct: t.clientY / window.innerHeight };
    
    if (state.eraserPickCallback) {
      const hex = getPixelHex(p.x, p.y); const cb = state.eraserPickCallback; state.eraserPickCallback = null; if (hex) cb(hex); return;
    }
    if (state.tool === 'paw') { state.drawing = true; state.pawLast = { x: p.x, y: p.y }; state.pawSide = 'L'; historyBuffer.length = 0; if (pawsQueue.length > 0) pawsQueue[0].addedAt = Date.now(); return; }
    if (state.tool === 'eyedropper') { pickColor(p.x, p.y); return; }
    if (state.tool === 'fill') { floodFill(p.x, p.y, state.color); emitFill(p.x, p.y, state.color); if (window.LDHistory) window.LDHistory.add({ type: 'fill', data: { xPct: t.clientX / window.innerWidth, yPct: t.clientY / window.innerHeight, color: state.color } }); commitPreset(); return; }
    if (state.tool === 'line') { state.drawing = true; state.lineStart = p; state.lineEnd = p; state.lastScreenPoint = { xPct: t.clientX / window.innerWidth, yPct: t.clientY / window.innerHeight }; return; }
    state.drawing = true; state.lastPoint = p; historyBuffer.length = 0;
  }

  function move(e) {
    e.preventDefault();
    if (!state.drawing) return;
    const p = getPos(e);
    const t = e.touches ? e.touches[0] : e;
    const currentScreenPoint = { xPct: t.clientX / window.innerWidth, yPct: t.clientY / window.innerHeight };

    if (state.tool === 'paw') { if (state.pawLast) placePawsAlong(state.pawLast, p); return; }
    if (state.tool === 'line') { state.lineEnd = p; drawLinePreview(); return; }

    const pctFrom = state.lastScreenPoint;
    const pctTo = currentScreenPoint;

    if (state.tool === 'eraser') {
      const seg = { from: pctFrom, to: pctTo, color: '#000', width: state.lineWidth, isEraser: true, eraserFilter: { mode: state.eraserFilter.mode, colors: state.eraserFilter.colors.slice() } };
      eraseFiltered(pctFrom, pctTo, state.lineWidth, state.eraserFilter);
      erasePawsAlong(state.lastPoint, p, state.lineWidth / 2 + 8);
      if (sendingToPartner) window.LDSocket.emit('draw', seg); else buffer.push(seg);
      historyBuffer.push(seg); state.lastPoint = p; state.lastScreenPoint = currentScreenPoint; return;
    }
    
    const segment = { from: pctFrom, to: pctTo, color: state.color, width: state.lineWidth, isEraser: false };
    drawSegment(pctFrom, pctTo, state.color, state.lineWidth, false);
    if (sendingToPartner) window.LDSocket.emit('draw', segment); else buffer.push(segment);
    historyBuffer.push(segment); state.lastPoint = p; state.lastScreenPoint = currentScreenPoint;
  }

  function end(e) {
    e.preventDefault();
    if (!state.drawing) return;
    let didDraw = false;
    if (state.tool === 'line' && state.lineStart && state.lineEnd) {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const endScreenPoint = { xPct: t.clientX / window.innerWidth, yPct: t.clientY / window.innerHeight };
      const dist = Math.hypot(state.lineEnd.x - state.lineStart.x, state.lineEnd.y - state.lineStart.y);
      if (dist > 5) {
        const pctFrom = state.lastScreenPoint;
        drawSegment(pctFrom, endScreenPoint, state.color, state.lineWidth, false);
        const seg = { from: pctFrom, to: endScreenPoint, color: state.color, width: state.lineWidth, isEraser: false };
        if (sendingToPartner) window.LDSocket.emit('draw', seg); else buffer.push(seg);
        if (window.LDHistory) window.LDHistory.add({ type: 'strokes', data: [seg] });
        didDraw = true;
      }
      clearPreview(); state.lineStart = null; state.lineEnd = null;
    } else if (state.tool === 'paw') {
      if (historyBuffer.length > 0) { if (window.LDHistory) window.LDHistory.add({ type: 'strokes', data: historyBuffer.slice() }); historyBuffer.length = 0; }
      didDraw = true;
    } else if (historyBuffer.length > 0) {
      if (window.LDHistory) window.LDHistory.add({ type: 'strokes', data: historyBuffer.slice() }); historyBuffer.length = 0; didDraw = true;
    }
    if (didDraw) commitPreset();
    state.drawing = false; state.lastPoint = null; state.pawLast = null; state.lastScreenPoint = null;
  }

  function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); clearPreview(); clearPaws(); }
  function clearSilent() { ctx.clearRect(0, 0, canvas.width, canvas.height); clearPreview(); clearPaws(); }
  function bindEvents() {
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end, { passive: false }); canvas.addEventListener('touchcancel', end, { passive: false });
    window.addEventListener('resize', () => { resize(); window.LDBackground.redraw(); });
  }
  function toggleSending() { sendingToPartner = !sendingToPartner; if (sendingToPartner && buffer.length) { window.LDSocket.emit('draw-batch', buffer.slice()); buffer.length = 0; } return sendingToPartner; }
  function setColor(c) { state.color = c; }
  function setEraser(on) { state.tool = on ? 'eraser' : 'brush'; if (on) { state.textMode = false; state.shapesMode = false; document.body.classList.remove('text-mode','shapes-mode'); } }
  function setTextMode(on) { state.textMode = !!on; if (on) state.shapesMode = false; }
  function setShapesMode(on) { state.shapesMode = !!on; if (on) state.textMode = false; }
  function setTool(t) { state.tool = t; clearPreview(); const allowed = ['brush','eraser','line','fill','eyedropper','hand','paw']; if (!allowed.includes(t)) state.tool = 'brush'; document.body.classList.toggle('hand-mode', t === 'hand'); }
  function setEraserFilter(f) { state.eraserFilter = f || { mode: 'all', colors: [] }; }
  function startEraserColorPick(cb) { state.eraserPickCallback = cb; state.textMode = false; state.shapesMode = false; document.body.classList.remove('text-mode','shapes-mode'); }
  function applyFloodFillFromPercent(xPct, yPct, color) { floodFill(xPct * window.innerWidth, yPct * window.innerHeight, color); }

  return {
    canvas, ctx, bgCanvas, bgCtx, dpr, state, resize, drawSegment, eraseFiltered, clear, clearSilent, bindEvents, toggleSending, isSending: () => sendingToPartner, getBufferLength: () => buffer.length,
    setColor, setEraser, setTextMode, setShapesMode, setTool, setEraserFilter, startEraserColorPick, applyFloodFillFromPercent,
    addPaw, addPawTimer, redrawPaws, clearPaws, exitSpecialModes, setWidth: (w) => { state.lineWidth = w; },
  };
})();
