window.LDShapesTool = (() => {
  const modal = document.getElementById('shapesModal');
  const title = document.getElementById('shTitle');
  const grid = document.getElementById('shGrid');
  const colorInput = document.getElementById('shColor');
  const colorVal = document.getElementById('shColorVal');
  const thickInput = document.getElementById('shThick');
  const thickVal = document.getElementById('shThickVal');
  const fillOn = document.getElementById('shFillOn');
  const fillRow = document.getElementById('shFillRow');
  const fillColor = document.getElementById('shFillColor');
  const fillColorVal = document.getElementById('shFillColorVal');
  const preview = document.getElementById('shPreview');
  const previewCtx = preview.getContext('2d');
  const cancelBtn = document.getElementById('shCancel');
  const okBtn = document.getElementById('shOk');
  const shapeBtn = document.getElementById('shapeBtn');

  let mode = 'new';
  let editingId = null;
  let selectedType = 'rect';
  let isShapesMode = false;

  function selectType(t) {
    selectedType = t;
    grid.querySelectorAll('.shape-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.shape === t);
    });
    redrawPreview();
  }

  function getSettings() {
    return {
      type: selectedType,
      color: colorInput.value,
      strokeWidth: +thickInput.value,
      fillOn: fillOn.checked,
      fillColor: fillColor.value,
    };
  }

  function applySettings(s) {
    selectType(s.type || 'rect');
    colorInput.value = s.color || '#000000';
    colorVal.textContent = colorInput.value;
    thickInput.value = s.strokeWidth || 4;
    thickVal.textContent = thickInput.value;
    fillOn.checked = !!s.fillOn;
    fillColor.value = s.fillColor || '#ffd54f';
    fillColorVal.textContent = fillColor.value;
    fillRow.style.display = fillOn.checked ? 'flex' : 'none';
    redrawPreview();
  }

  function resetDefaults() {
    applySettings({
      type: 'rect',
      color: '#000000',
      strokeWidth: 4,
      fillOn: false,
      fillColor: '#ffd54f',
    });
  }

  function drawPreviewShape(c, type, w, h, color, strokeWidth, fillOnF, fillColorV) {
    c.save();
    c.translate((preview.width - w) / 2, (preview.height - h) / 2);
    c.lineWidth = strokeWidth;
    c.strokeStyle = color;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (fillOnF) c.fillStyle = fillColorV;

    c.beginPath();
    switch (type) {
      case 'line': c.moveTo(0, h / 2); c.lineTo(w, h / 2); break;
      case 'rect': c.rect(0, 0, w, h); break;
      case 'circle': { const r = Math.min(w, h) / 2; c.arc(w / 2, h / 2, r, 0, Math.PI * 2); break; }
      case 'ellipse': c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
      case 'triangle': c.moveTo(w / 2, 0); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); break;
      case 'heart': {
        const k = h * 0.3;
        c.moveTo(w / 2, h * 0.3);
        c.bezierCurveTo(w / 2, 0, 0, 0, 0, k);
        c.bezierCurveTo(0, h * 0.55, w / 2, h * 0.75, w / 2, h);
        c.bezierCurveTo(w / 2, h * 0.75, w, h * 0.55, w, k);
        c.bezierCurveTo(w, 0, w / 2, 0, w / 2, h * 0.3);
        c.closePath(); break;
      }
      case 'star': {
        const cx = w / 2, cy = h / 2;
        const outer = Math.min(w, h) / 2;
        const inner = outer * 0.45;
        let rot = -Math.PI / 2;
        const step = Math.PI / 5;
        c.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        for (let i = 0; i < 5; i++) {
          rot += step; c.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
          rot += step; c.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        }
        c.closePath(); break;
      }
      case 'arrow': {
        const y = h / 2;
        const headSize = Math.min(w * 0.35, h);
        c.moveTo(0, y); c.lineTo(w, y);
        c.moveTo(w, y); c.lineTo(w - headSize, y - headSize / 2); c.lineTo(w - headSize, y + headSize / 2);
        c.closePath(); break;
      }
    }
    if (fillOnF) c.fill();
    c.stroke();
    c.restore();
  }

  function redrawPreview() {
    previewCtx.clearRect(0, 0, preview.width, preview.height);
    previewCtx.fillStyle = '#fff';
    previewCtx.fillRect(0, 0, preview.width, preview.height);

    const s = getSettings();
    const w = s.type === 'line' ? 200 : 100;
    const h = s.type === 'line' ? 20 : 100;
    drawPreviewShape(previewCtx, s.type, w, h, s.color, s.strokeWidth, s.fillOn, s.fillColor);
  }

  function openForNew() {
    mode = 'new';
    editingId = null;
    title.textContent = 'Новая фигура';
    resetDefaults();
    modal.classList.add('open');
  }

  function openForEdit(id) {
    const s = window.LDShapesCanvas.getAll().find(x => x.id === id);
    if (!s) return;
    mode = 'edit';
    editingId = id;
    title.textContent = 'Изменить фигуру';
    applySettings(s);
    modal.classList.add('open');
  }

  function close() { modal.classList.remove('open'); }

  function confirm() {
    const s = getSettings();
    const w = s.type === 'line' ? 220 : 130;
    const h = s.type === 'line' ? 20 : 130;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    if (mode === 'new') {
      const payload = {
        x: cx - w / 2, y: cy - h / 2,
        w, h, ...s,
      };
      window.LDShapesCanvas.add(payload);
    } else if (mode === 'edit' && editingId) {
      window.LDShapesCanvas.update(editingId, s);
    }
    close();
  }

  function setShapesMode(on) {
    isShapesMode = on;
    shapeBtn.classList.toggle('active', on);
    window.LDCanvas.setShapesMode(on);
    document.body.classList.toggle('shapes-mode', on);
    if (on) {
      document.body.classList.remove('text-mode');
      if (window.LDTextTool && window.LDTextTool.setTextMode) {
        window.LDTextTool.setTextMode(false);
      }
    }
    if (!on) {
      window.LDShapesCanvas.deselect();
    }
  }

  // Отмена — только закрывает модалку, режим остаётся включённым,
  // чтобы можно было сразу тапнуть по другой фигуре
  function cancel() {
    close();
  }

  function bindEvents() {
    shapeBtn.addEventListener('click', () => {
      if (!isShapesMode) setShapesMode(true);
      openForNew();
    });

    grid.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', () => selectType(btn.dataset.shape));
    });

    colorInput.addEventListener('input', () => {
      colorVal.textContent = colorInput.value;
      redrawPreview();
    });
    thickInput.addEventListener('input', () => {
      thickVal.textContent = thickInput.value;
      redrawPreview();
    });
    fillOn.addEventListener('change', () => {
      fillRow.style.display = fillOn.checked ? 'flex' : 'none';
      redrawPreview();
    });
    fillColor.addEventListener('input', () => {
      fillColorVal.textContent = fillColor.value;
      redrawPreview();
    });

    cancelBtn.addEventListener('click', cancel);
    okBtn.addEventListener('click', confirm);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) cancel();
    });

    const toolbar = document.getElementById('shapesToolbar');
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tt-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      const s = window.LDShapesCanvas.getSelected();
      if (!s && action !== 'deselect') return;

      switch (action) {
        case 'rotate-left':  window.LDShapesCanvas.rotate(-15); break;
        case 'rotate-right': window.LDShapesCanvas.rotate(15);  break;
        case 'mirror-h':     window.LDShapesCanvas.mirrorH();   break;
        case 'mirror-v':     window.LDShapesCanvas.mirrorV();   break;
        case 'duplicate':    window.LDShapesCanvas.duplicate(); break;
        case 'delete':       window.LDShapesCanvas.remove(s.id); break;
        case 'edit':         openForEdit(s.id);                 break;
        case 'deselect':     window.LDShapesCanvas.deselect();  break;
      }
    });
  }

  return { bindEvents, openForNew, openForEdit, close, setShapesMode };
})();
