window.LDTextTool = (() => {
  const FONTS = [
    { name: 'Системный',       value: 'system-ui, sans-serif' },
    { name: 'Arial',           value: 'Arial, sans-serif' },
    { name: 'Georgia',         value: 'Georgia, serif' },
    { name: 'Times New Roman', value: "'Times New Roman', serif" },
    { name: 'Courier New',     value: "'Courier New', monospace" },
    { name: 'Impact',          value: 'Impact, sans-serif' },
    { name: 'Comic Sans',      value: "'Comic Sans MS', cursive" },
    { name: 'Verdana',         value: 'Verdana, sans-serif' },
  ];

  const modal = document.getElementById('textModal');
  const title = document.getElementById('tmTitle');
  const taText = document.getElementById('tmText');
  const colorInput = document.getElementById('tmColor');
  const colorVal = document.getElementById('tmColorVal');
  const sizeInput = document.getElementById('tmSize');
  const sizeVal = document.getElementById('tmSizeVal');
  const fontInput = document.getElementById('tmFont');
  const fontPickerBtn = document.getElementById('fontPickerBtn');
  const fontPickerLabel = document.getElementById('fontPickerLabel');
  const fontPickerList = document.getElementById('fontPickerList');
  const boldBtn = document.getElementById('tmBold');
  const italicBtn = document.getElementById('tmItalic');
  const underlineBtn = document.getElementById('tmUnderline');
  const shadowOn = document.getElementById('tmShadowOn');
  const shadowOpts = document.getElementById('tmShadowOpts');
  const shadowBlur = document.getElementById('tmShadowBlur');
  const shadowX = document.getElementById('tmShadowX');
  const shadowY = document.getElementById('tmShadowY');
  const strokeOn = document.getElementById('tmStrokeOn');
  const strokeOpts = document.getElementById('tmStrokeOpts');
  const strokeWidth = document.getElementById('tmStrokeWidth');
  const strokeColor = document.getElementById('tmStrokeColor');
  const preview = document.getElementById('tmPreview');
  const previewCtx = preview.getContext('2d');
  const cancelBtn = document.getElementById('tmCancel');
  const okBtn = document.getElementById('tmOk');
  const textBtn = document.getElementById('textBtn');

  let mode = 'new';
  let editingId = null;
  let placeAt = { x: 0, y: 0 };
  let isTextMode = false;

  function buildFontList() {
    fontPickerList.innerHTML = '';
    FONTS.forEach(f => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'font-picker-item';
      item.dataset.value = f.value;
      item.style.fontFamily = f.value;
      item.textContent = f.name + ' — Пример 123';
      item.addEventListener('click', () => {
        setFont(f.value, f.name);
        closeFontList();
      });
      fontPickerList.appendChild(item);
    });
  }

  function setFont(value, name) {
    fontInput.value = value;
    fontPickerLabel.textContent = name || value;
    fontPickerLabel.style.fontFamily = value;
    fontPickerList.querySelectorAll('.font-picker-item').forEach(el => {
      el.classList.toggle('active', el.dataset.value === value);
    });
    redrawPreview();
  }

  function openFontList() { fontPickerList.classList.add('open'); }
  function closeFontList() { fontPickerList.classList.remove('open'); }
  function toggleFontList() {
    if (fontPickerList.classList.contains('open')) closeFontList();
    else openFontList();
  }

  function getSettings() {
    return {
      text: taText.value,
      color: colorInput.value,
      size: +sizeInput.value,
      font: fontInput.value,
      bold: boldBtn.classList.contains('active'),
      italic: italicBtn.classList.contains('active'),
      underline: underlineBtn.classList.contains('active'),
      shadow: {
        on: shadowOn.checked,
        blur: +shadowBlur.value,
        x: +shadowX.value,
        y: +shadowY.value,
      },
      stroke: {
        on: strokeOn.checked,
        width: +strokeWidth.value,
        color: strokeColor.value,
      },
    };
  }

  function applySettings(s) {
    taText.value = s.text || '';
    colorInput.value = s.color || '#000000';
    colorVal.textContent = colorInput.value;
    sizeInput.value = s.size || 32;
    sizeVal.textContent = sizeInput.value;

    const fontVal = s.font || 'system-ui, sans-serif';
    const fontObj = FONTS.find(f => f.value === fontVal);
    setFont(fontVal, fontObj ? fontObj.name : fontVal);

    boldBtn.classList.toggle('active', !!s.bold);
    italicBtn.classList.toggle('active', !!s.italic);
    underlineBtn.classList.toggle('active', !!s.underline);
    shadowOn.checked = !!(s.shadow && s.shadow.on);
    if (s.shadow) {
      shadowBlur.value = s.shadow.blur || 4;
      shadowX.value = s.shadow.x || 2;
      shadowY.value = s.shadow.y || 2;
    }
    shadowOpts.style.display = shadowOn.checked ? 'grid' : 'none';
    strokeOn.checked = !!(s.stroke && s.stroke.on);
    if (s.stroke) {
      strokeWidth.value = s.stroke.width || 2;
      strokeColor.value = s.stroke.color || '#ffffff';
    }
    strokeOpts.style.display = strokeOn.checked ? 'grid' : 'none';
    redrawPreview();
  }

  function resetDefaults() {
    applySettings({
      text: '',
      color: colorInput.value || '#000000',
      size: 32,
      font: 'system-ui, sans-serif',
      bold: false, italic: false, underline: false,
      shadow: { on: false, blur: 4, x: 2, y: 2 },
      stroke: { on: false, width: 2, color: '#ffffff' },
    });
  }

  function redrawPreview() {
    previewCtx.clearRect(0, 0, preview.width, preview.height);
    previewCtx.fillStyle = '#fff';
    previewCtx.fillRect(0, 0, preview.width, preview.height);

    const s = getSettings();
    if (!s.text) return;

    const displaySize = Math.min(s.size, 48);
    previewCtx.save();
    previewCtx.font = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${displaySize}px ${s.font}`;
    previewCtx.textBaseline = 'top';
    previewCtx.textAlign = 'center';

    const cx = preview.width / 2;
    const cy = 16;

    if (s.shadow.on) {
      previewCtx.shadowColor = 'rgba(0,0,0,0.6)';
      previewCtx.shadowBlur = s.shadow.blur;
      previewCtx.shadowOffsetX = s.shadow.x;
      previewCtx.shadowOffsetY = s.shadow.y;
    }
    if (s.stroke.on) {
      previewCtx.lineJoin = 'round';
      previewCtx.lineWidth = s.stroke.width;
      previewCtx.strokeStyle = s.stroke.color;
      previewCtx.strokeText(s.text, cx, cy);
    }
    previewCtx.fillStyle = s.color;
    previewCtx.fillText(s.text, cx, cy);
    if (s.underline) {
      const m = previewCtx.measureText(s.text);
      previewCtx.beginPath();
      previewCtx.strokeStyle = s.color;
      previewCtx.lineWidth = Math.max(1, displaySize / 20);
      previewCtx.moveTo(cx - m.width / 2, cy + displaySize + 2);
      previewCtx.lineTo(cx + m.width / 2, cy + displaySize + 2);
      previewCtx.stroke();
    }
    previewCtx.restore();
  }

  function openForNew(x, y) {
    mode = 'new';
    editingId = null;
    placeAt = (typeof x === 'number' && typeof y === 'number')
      ? { x, y }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    title.textContent = 'Новый текст';
    resetDefaults();
    modal.classList.add('open');
    closeFontList();
    setTimeout(() => taText.focus(), 100);
  }

  function openForEdit(id) {
    const t = window.LDTextCanvas.getAll().find(x => x.id === id);
    if (!t) return;
    mode = 'edit';
    editingId = id;
    title.textContent = 'Редактировать текст';
    applySettings(t);
    modal.classList.add('open');
    closeFontList();
  }

  function close() {
    modal.classList.remove('open');
    closeFontList();
  }

  function confirm() {
    const s = getSettings();
    if (!s.text.trim()) {
      alert('Введите текст');
      return;
    }
    if (mode === 'new') {
      const approxWidth = s.size * s.text.length * 0.55;
      const payload = {
        x: placeAt.x - approxWidth / 2,
        y: placeAt.y - s.size / 2,
        ...s,
      };
      window.LDTextCanvas.add(payload);
    } else if (mode === 'edit' && editingId) {
      window.LDTextCanvas.update(editingId, s);
    }
    close();
  }

  function setTextMode(on) {
    isTextMode = on;
    textBtn.classList.toggle('active', on);
    window.LDCanvas.setTextMode(on);
    document.body.classList.toggle('text-mode', on);
    if (!on) {
      window.LDTextCanvas.deselect();
    }
  }

  // Отмена — только закрывает модалку, режим остаётся,
  // чтобы можно было тапнуть по другому тексту
  function cancel() {
    close();
  }

  function bindEvents() {
    textBtn.addEventListener('click', () => {
      if (!isTextMode) setTextMode(true);
      openForNew();
    });

    cancelBtn.addEventListener('click', cancel);
    okBtn.addEventListener('click', confirm);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) cancel();
    });

    colorInput.addEventListener('input', () => {
      colorVal.textContent = colorInput.value;
      redrawPreview();
    });
    sizeInput.addEventListener('input', () => {
      sizeVal.textContent = sizeInput.value;
      redrawPreview();
    });

    fontPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFontList();
    });
    document.addEventListener('click', (e) => {
      if (!fontPickerList.contains(e.target) && e.target !== fontPickerBtn) {
        closeFontList();
      }
    });

    boldBtn.addEventListener('click', () => { boldBtn.classList.toggle('active'); redrawPreview(); });
    italicBtn.addEventListener('click', () => { italicBtn.classList.toggle('active'); redrawPreview(); });
    underlineBtn.addEventListener('click', () => { underlineBtn.classList.toggle('active'); redrawPreview(); });

    shadowOn.addEventListener('change', () => {
      shadowOpts.style.display = shadowOn.checked ? 'grid' : 'none';
      redrawPreview();
    });
    [shadowBlur, shadowX, shadowY].forEach(el => el.addEventListener('input', redrawPreview));

    strokeOn.addEventListener('change', () => {
      strokeOpts.style.display = strokeOn.checked ? 'grid' : 'none';
      redrawPreview();
    });
    [strokeWidth, strokeColor].forEach(el => el.addEventListener('input', redrawPreview));

    taText.addEventListener('input', redrawPreview);

    const toolbar = document.getElementById('textToolbar');
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tt-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      const t = window.LDTextCanvas.getSelected();
      if (!t && action !== 'deselect') return;

      switch (action) {
        case 'rotate-left':  window.LDTextCanvas.rotate(-15); break;
        case 'rotate-right': window.LDTextCanvas.rotate(15);  break;
        case 'mirror-h':     window.LDTextCanvas.mirrorH();   break;
        case 'mirror-v':     window.LDTextCanvas.mirrorV();   break;
        case 'duplicate':    window.LDTextCanvas.duplicate(); break;
        case 'delete':       window.LDTextCanvas.remove(t.id); break;
        case 'edit':         openForEdit(t.id);               break;
        case 'deselect':     window.LDTextCanvas.deselect();  break;
      }
    });
  }

  buildFontList();

  return { bindEvents, openForNew, openForEdit, close, setTextMode };
})();
