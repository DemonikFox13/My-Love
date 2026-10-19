window.LDPalette = (() => {
  const BASE_COLORS = [
    '#000000', '#424242', '#757575', '#bdbdbd',
    '#ffffff', '#b71c1c', '#e53935', '#ff5252',
    '#ff8a80', '#e91e63', '#ff4081', '#f8bbd0',
    '#e65100', '#fb8c00', '#ffb74d', '#ffd54f',
    '#fff176', '#f9a825', '#33691e', '#43a047',
    '#8bc34a', '#c5e1a5', '#004d40', '#00897b',
    '#4dd0e1', '#1e88e5', '#0d47a1', '#7986cb',
    '#6a1b9a', '#9c27b0', '#ce93d8', '#795548',
    '#d7ccc8'
  ];

  const palette       = document.getElementById('palette');
  const colorPickerEl = document.getElementById('colorPicker');
  const preview       = document.getElementById('palettePreview');
  const closeBtn      = document.getElementById('paletteClose');
  const baseColorsEl  = document.getElementById('baseColors');

  const wheelView  = document.getElementById('wheelView');
  const squareView = document.getElementById('squareView');
  const modeBtns   = document.querySelectorAll('.mode-btn');

  const wheelCanvas = document.getElementById('wheelCanvas');
  const wheelCtx    = wheelCanvas.getContext('2d');
  const wheelCursor = document.getElementById('wheelCursor');

  const hueCanvas = document.getElementById('hueCanvas');
  const hueCtx    = hueCanvas.getContext('2d');
  const hueCursor = document.getElementById('hueCursor');

  const svCanvas = document.getElementById('svCanvas');
  const svCtx    = svCanvas.getContext('2d');
  const svCursor = document.getElementById('svCursor');

  const hSlider = document.getElementById('hSlider');
  const sSlider = document.getElementById('sSlider');
  const vSlider = document.getElementById('vSlider');
  const hVal = document.getElementById('hVal');
  const sVal = document.getElementById('sVal');
  const vVal = document.getElementById('vVal');

  const hexInput = document.getElementById('hexInput');

  const hsv = { h: 0, s: 0, v: 0 };
  let currentMode = 'wheel';
  let currentHex = '#000000';

  function exitSpecial() {
    if (window.LDCanvas && window.LDCanvas.exitSpecialModes) {
      window.LDCanvas.exitSpecialModes();
    }
  }

  function openPalette() {
    palette.classList.add('open');
    drawWheel();
    drawHue();
    drawSV();
    updateCursors();
    highlightBaseColor();
  }

  function closePalette() {
    palette.classList.remove('open');
  }

  function togglePalette() {
    if (palette.classList.contains('open')) closePalette();
    else openPalette();
  }

  // ==== Цветовые конверсии ====
  function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r1, g1, b1;
    if (h < 60)       [r1,g1,b1] = [c, x, 0];
    else if (h < 120) [r1,g1,b1] = [x, c, 0];
    else if (h < 180) [r1,g1,b1] = [0, c, x];
    else if (h < 240) [r1,g1,b1] = [0, x, c];
    else if (h < 300) [r1,g1,b1] = [x, 0, c];
    else              [r1,g1,b1] = [c, 0, x];
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    return { h, s, v };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  function hexToRgb(hex) {
    const m = hex.replace('#','').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
  }

  // ==== Отрисовка wheel / hue / sv ====
  function drawWheel() {
    const size = wheelCanvas.width;
    const R = size / 2;
    const img = wheelCtx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - R, dy = y - R;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const idx = (y * size + x) * 4;
        if (dist > R) { data[idx+3] = 0; continue; }
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        const sat = Math.min(1, dist / R) * 100;
        const { r, g, b } = hsvToRgb(angle, sat, 100);
        data[idx]   = r;
        data[idx+1] = g;
        data[idx+2] = b;
        data[idx+3] = dist > R - 1 ? Math.round(255 * (R - dist)) : 255;
      }
    }
    wheelCtx.putImageData(img, 0, 0);
  }

  function drawHue() {
    const w = hueCanvas.width, h = hueCanvas.height;
    const img = hueCtx.createImageData(w, h);
    const data = img.data;
    for (let x = 0; x < w; x++) {
      const hue = (x / w) * 360;
      const { r, g, b } = hsvToRgb(hue, 100, 100);
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        data[idx]   = r;
        data[idx+1] = g;
        data[idx+2] = b;
        data[idx+3] = 255;
      }
    }
    hueCtx.putImageData(img, 0, 0);
  }

  function drawSV() {
    const w = svCanvas.width, h = svCanvas.height;
    const img = svCtx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (x / w) * 100;
        const v = 100 - (y / h) * 100;
        const { r, g, b } = hsvToRgb(hsv.h, s, v);
        const idx = (y * w + x) * 4;
        data[idx]   = r;
        data[idx+1] = g;
        data[idx+2] = b;
        data[idx+3] = 255;
      }
    }
    svCtx.putImageData(img, 0, 0);
  }

  function syncAll(fromSlider) {
    hSlider.value = Math.round(hsv.h);
    sSlider.value = Math.round(hsv.s);
    vSlider.value = Math.round(hsv.v);
    hVal.textContent = Math.round(hsv.h);
    sVal.textContent = Math.round(hsv.s);
    vVal.textContent = Math.round(hsv.v);

    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const hex = rgbToHex(r, g, b);
    currentHex = hex;
    preview.style.background = hex;
    hexInput.value = hex;
    colorPickerEl.style.setProperty('--current-color', hex);

    window.LDCanvas.setColor(hex);

    updateCursors();
    highlightBaseColor();
    if (currentMode === 'square' && !fromSlider) {
      drawSV();
    }
  }

  function updateCursors() {
    const wSize = wheelCanvas.width;
    const wR = wSize / 2;
    const dist = (hsv.s / 100) * wR;
    const ang = hsv.h * Math.PI / 180;
    wheelCursor.style.left = (wR + Math.cos(ang) * dist) + 'px';
    wheelCursor.style.top  = (wR + Math.sin(ang) * dist) + 'px';

    const hueX = (hsv.h / 360) * hueCanvas.width;
    hueCursor.style.left = hueX + 'px';
    hueCursor.style.top  = (hueCanvas.height / 2) + 'px';

    const svX = (hsv.s / 100) * svCanvas.width;
    const svY = (1 - hsv.v / 100) * svCanvas.height;
    svCursor.style.left = svX + 'px';
    svCursor.style.top  = svY + 'px';
  }

  // ==== Сетка базовых цветов ====
  function buildBaseColors() {
    baseColorsEl.innerHTML = '';
    BASE_COLORS.forEach(hex => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'base-color';
      b.dataset.hex = hex;
      b.style.background = hex;
      b.title = hex;
      b.addEventListener('click', () => {
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        const h = rgbToHsv(rgb.r, rgb.g, rgb.b);
        hsv.h = h.h; hsv.s = h.s; hsv.v = h.v;
        drawSV();
        syncAll();
        exitSpecial();
        // НЕ закрываем палитру — чтобы можно было выбрать подряд несколько
        // Но пользователь жаловался, что закрывается только по кнопке палитры.
        // Пусть закрывается при выборе — так удобнее.
        closePalette();
      });
      baseColorsEl.appendChild(b);
    });
  }

  function highlightBaseColor() {
    baseColorsEl.querySelectorAll('.base-color').forEach(b => {
      b.classList.toggle('selected', b.dataset.hex.toLowerCase() === currentHex.toLowerCase());
    });
  }

  // ==== Wheel ====
  function pickWheel(e) {
    e.preventDefault();
    const rect = wheelCanvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    const R = rect.width / 2;
    const dx = x - R, dy = y - R;
    const dist = Math.min(Math.sqrt(dx*dx + dy*dy), R);
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    hsv.h = angle;
    hsv.s = (dist / R) * 100;
    hsv.v = 100;
    syncAll();
    drawSV();
    exitSpecial();
  }
  let wheelDrag = false;
  wheelCanvas.addEventListener('mousedown', (e) => { wheelDrag = true; pickWheel(e); });
  window.addEventListener('mousemove', (e) => { if (wheelDrag) pickWheel(e); });
  window.addEventListener('mouseup', () => { wheelDrag = false; });
  wheelCanvas.addEventListener('touchstart', (e) => { wheelDrag = true; pickWheel(e); }, { passive: false });
  wheelCanvas.addEventListener('touchmove',  (e) => { if (wheelDrag) pickWheel(e); }, { passive: false });
  wheelCanvas.addEventListener('touchend',   () => { wheelDrag = false; });

  // ==== Hue ====
  function pickHue(e) {
    e.preventDefault();
    const rect = hueCanvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = Math.max(0, Math.min(rect.width, t.clientX - rect.left));
    hsv.h = (x / rect.width) * 360;
    drawSV();
    syncAll();
    exitSpecial();
  }
  let hueDrag = false;
  hueCanvas.addEventListener('mousedown', (e) => { hueDrag = true; pickHue(e); });
  window.addEventListener('mousemove', (e) => { if (hueDrag) pickHue(e); });
  window.addEventListener('mouseup', () => { hueDrag = false; });
  hueCanvas.addEventListener('touchstart', (e) => { hueDrag = true; pickHue(e); }, { passive: false });
  hueCanvas.addEventListener('touchmove',  (e) => { if (hueDrag) pickHue(e); }, { passive: false });
  hueCanvas.addEventListener('touchend',   () => { hueDrag = false; });

  // ==== SV ====
  function pickSV(e) {
    e.preventDefault();
    const rect = svCanvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = Math.max(0, Math.min(rect.width, t.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, t.clientY - rect.top));
    hsv.s = (x / rect.width) * 100;
    hsv.v = 100 - (y / rect.height) * 100;
    syncAll();
    exitSpecial();
  }
  let svDrag = false;
  svCanvas.addEventListener('mousedown', (e) => { svDrag = true; pickSV(e); });
  window.addEventListener('mousemove', (e) => { if (svDrag) pickSV(e); });
  window.addEventListener('mouseup', () => { svDrag = false; });
  svCanvas.addEventListener('touchstart', (e) => { svDrag = true; pickSV(e); }, { passive: false });
  svCanvas.addEventListener('touchmove',  (e) => { if (svDrag) pickSV(e); }, { passive: false });
  svCanvas.addEventListener('touchend',   () => { svDrag = false; });

  // ==== Слайдеры ====
  hSlider.addEventListener('input', () => {
    hsv.h = +hSlider.value;
    drawSV();
    syncAll(true);
  });
  sSlider.addEventListener('input', () => { hsv.s = +sSlider.value; syncAll(true); });
  vSlider.addEventListener('input', () => { hsv.v = +vSlider.value; syncAll(true); });

  // ==== Переключение режимов ====
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      if (currentMode === 'wheel') {
        wheelView.style.display = 'flex';
        squareView.style.display = 'none';
      } else {
        wheelView.style.display = 'none';
        squareView.style.display = 'flex';
        drawHue();
        drawSV();
      }
      setTimeout(updateCursors, 0);
    });
  });

  // ==== HEX + кнопка OK ====
  document.getElementById('applyHex').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rgb = hexToRgb(hexInput.value.trim());
    if (!rgb) { alert('Неверный HEX-код'); return; }
    const h = rgbToHsv(rgb.r, rgb.g, rgb.b);
    hsv.h = h.h; hsv.s = h.s; hsv.v = h.v;
    drawSV();
    syncAll();
    exitSpecial();
    closePalette();   // ← ГЛАВНОЕ: закрываем палитру после применения
  });

  // ==== Открытие / закрытие ====
  colorPickerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePalette();
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePalette();
  });

  // Клик вне палитры — закрыть
  document.addEventListener('click', (e) => {
    if (!palette.classList.contains('open')) return;
    if (palette.contains(e.target)) return;
    if (e.target === colorPickerEl || colorPickerEl.contains(e.target)) return;
    closePalette();
  });

  // ==== setFromHex (пипетка) ====
  function setFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const h = rgbToHsv(rgb.r, rgb.g, rgb.b);
    hsv.h = h.h; hsv.s = h.s; hsv.v = h.v;
    drawSV();
    syncAll();
  }

  function init() {
    buildBaseColors();
    drawWheel();
    drawHue();
    drawSV();
    hsv.h = 0; hsv.s = 0; hsv.v = 0;
    syncAll();
  }

  return { init, setFromHex };
})();
