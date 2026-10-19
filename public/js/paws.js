window.LDPaws = (() => {
  const PAW_TYPES = [
    { id: 'cat',   name: 'Кошка' },
    { id: 'dog',   name: 'Собака' },
    { id: 'bear',  name: 'Медведь' },
    { id: 'bunny', name: 'Кролик' },
    { id: 'bird',  name: 'Птица' },
    { id: 'frog',  name: 'Лягушка' },
  ];

  const modal = document.getElementById('pawsModal');
  const grid = document.getElementById('pawsGrid');
  const sizeInput = document.getElementById('pawsSize');
  const sizeVal = document.getElementById('pawsSizeVal');
  const colorInput = document.getElementById('pawsColor');
  const colorVal = document.getElementById('pawsColorVal');
  const closeBtn = document.getElementById('pawsClose');
  const btn = document.getElementById('pawsBtn');

  const modeFade = document.getElementById('pawModeFade');
  const modeTimer = document.getElementById('pawModeTimer');
  const modePermanent = document.getElementById('pawModePermanent');
  const timerRow = document.getElementById('pawTimerRow');
  const timerInput = document.getElementById('pawsTimer');

  let current = { type: 'cat', size: 40, color: '#000000', mode: 'fade', timer: 5 };
  let selectedType = 'cat';

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCat(ctx, s) {
    ell(ctx, 0, s * 0.10, s * 0.28, s * 0.20);
    const pr = s * 0.11;
    circle(ctx, -s * 0.30, -s * 0.30, pr);
    circle(ctx, -s * 0.11, -s * 0.42, pr);
    circle(ctx,  s * 0.11, -s * 0.42, pr);
    circle(ctx,  s * 0.30, -s * 0.30, pr);
    circle(ctx, -s * 0.38, -s * 0.10, s * 0.08);
    circle(ctx,  s * 0.38, -s * 0.10, s * 0.08);
  }

  function drawDog(ctx, s) {
    ell(ctx, 0, s * 0.12, s * 0.32, s * 0.24);
    const pr = s * 0.13;
    circle(ctx, -s * 0.30, -s * 0.28, pr);
    circle(ctx, -s * 0.11, -s * 0.42, pr);
    circle(ctx,  s * 0.11, -s * 0.42, pr);
    circle(ctx,  s * 0.30, -s * 0.28, pr);
  }

  function drawBear(ctx, s) {
    ell(ctx, 0, s * 0.14, s * 0.36, s * 0.26);
    const pr = s * 0.14;
    circle(ctx, -s * 0.36, -s * 0.20, pr);
    circle(ctx, -s * 0.22, -s * 0.40, pr);
    circle(ctx,  0,        -s * 0.48, pr);
    circle(ctx,  s * 0.22, -s * 0.40, pr);
    circle(ctx,  s * 0.36, -s * 0.20, pr);
  }

  function drawBunny(ctx, s) {
    ell(ctx, 0, s * 0.15, s * 0.22, s * 0.16);
    ell(ctx, -s * 0.34, -s * 0.30, s * 0.09, s * 0.16);
    ell(ctx, -s * 0.12, -s * 0.42, s * 0.09, s * 0.18);
    ell(ctx,  s * 0.12, -s * 0.42, s * 0.09, s * 0.18);
    ell(ctx,  s * 0.34, -s * 0.30, s * 0.09, s * 0.16);
  }

  function drawBird(ctx, s) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = s * 0.11;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.15);
    ctx.lineTo(-s * 0.30, -s * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s * 0.15);
    ctx.lineTo(0, -s * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s * 0.15);
    ctx.lineTo(s * 0.30, -s * 0.45);
    ctx.stroke();
    ctx.restore();
    circle(ctx, 0, s * 0.18, s * 0.10);
    circle(ctx, -s * 0.30, -s * 0.45, s * 0.06);
    circle(ctx, 0, -s * 0.55, s * 0.06);
    circle(ctx, s * 0.30, -s * 0.45, s * 0.06);
  }

  function drawFrog(ctx, s) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = s * 0.10;
    const tips = [
      { x: -s * 0.42, y: -s * 0.28 },
      { x: -s * 0.16, y: -s * 0.48 },
      { x:  s * 0.16, y: -s * 0.48 },
      { x:  s * 0.42, y: -s * 0.28 },
    ];
    tips.forEach(t => {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.10);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      circle(ctx, t.x, t.y, s * 0.09);
    });
    ctx.restore();
    ell(ctx, 0, s * 0.15, s * 0.24, s * 0.16);
  }

  function drawPaw(ctx, paw) {
    const { x, y, angle = 0, pawType = 'cat', size = 40, color = '#000' } = paw;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((angle + 90) * Math.PI / 180);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.translate(1.5, 1.5);
    switch (pawType) {
      case 'cat':   drawCat(ctx, size);   break;
      case 'dog':   drawDog(ctx, size);   break;
      case 'bear':  drawBear(ctx, size);  break;
      case 'bunny': drawBunny(ctx, size); break;
      case 'bird':  drawBird(ctx, size);  break;
      case 'frog':  drawFrog(ctx, size);  break;
    }
    ctx.restore();

    switch (pawType) {
      case 'cat':   drawCat(ctx, size);   break;
      case 'dog':   drawDog(ctx, size);   break;
      case 'bear':  drawBear(ctx, size);  break;
      case 'bunny': drawBunny(ctx, size); break;
      case 'bird':  drawBird(ctx, size);  break;
      case 'frog':  drawFrog(ctx, size);  break;
      default:      drawCat(ctx, size);
    }
    ctx.restore();
  }

  function makePreview(pawType, size) {
    const dim = 70;
    const c = document.createElement('canvas');
    c.width = dim;
    c.height = dim;
    const pctx = c.getContext('2d');
    drawPaw(pctx, {
      x: dim / 2,
      y: dim / 2 + size * 0.15,
      angle: -90,
      pawType,
      size,
      color: '#000',
    });
    return c;
  }

  function buildGrid() {
    grid.innerHTML = '';
    PAW_TYPES.forEach(p => {
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'paw-item' + (p.id === selectedType ? ' active' : '');
      wrap.dataset.id = p.id;

      wrap.appendChild(makePreview(p.id, 26));

      const name = document.createElement('span');
      name.className = 'paw-name';
      name.textContent = p.name;
      wrap.appendChild(name);

      wrap.addEventListener('click', () => {
        selectedType = p.id;
        current.type = p.id;
        if (window.LDCanvas.state.paw) window.LDCanvas.state.paw.type = p.id;
        buildGrid();
      });

      grid.appendChild(wrap);
    });
  }

  function openModal() {
    buildGrid();
    // синхронизируем UI с текущими настройками
    if (current.mode === 'fade') modeFade.checked = true;
    else if (current.mode === 'timer') modeTimer.checked = true;
    else modePermanent.checked = true;
    timerRow.style.display = current.mode === 'timer' ? 'block' : 'none';
    timerInput.value = current.timer;
    modal.classList.add('open');
  }
  function closeModal() {
    modal.classList.remove('open');
  }

  function activate() {
    if (window.LDTools && window.LDTools.setActive) {
      window.LDTools.setActive('paw');
    } else {
      window.LDCanvas.setTool('paw');
    }
    if (!window.LDCanvas.state.paw) {
      window.LDCanvas.state.paw = { type: current.type, size: current.size, mode: current.mode, timer: current.timer };
    }
    window.LDCanvas.state.paw.type = current.type;
    window.LDCanvas.state.paw.size = current.size;
    window.LDCanvas.state.paw.mode = current.mode;
    window.LDCanvas.state.paw.timer = current.timer;
    window.LDCanvas.state.color = current.color;

    if (btn) btn.classList.add('active');
  }

  function bindEvents() {
    btn.addEventListener('click', () => {
      activate();
      openModal();
    });
    if (closeBtn) closeBtn.addEventListener('click', () => {
      activate();
      closeModal();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        activate();
        closeModal();
      }
    });

    sizeInput.addEventListener('input', () => {
      const v = +sizeInput.value;
      sizeVal.textContent = v;
      current.size = v;
      if (window.LDCanvas.state.paw) window.LDCanvas.state.paw.size = v;
      buildGrid();
    });

    colorInput.addEventListener('input', () => {
      colorVal.textContent = colorInput.value;
      current.color = colorInput.value;
      window.LDCanvas.state.color = colorInput.value;
    });

    function updateMode() {
      let m = 'fade';
      if (modeTimer.checked) m = 'timer';
      else if (modePermanent.checked) m = 'permanent';
      current.mode = m;
      if (window.LDCanvas.state.paw) window.LDCanvas.state.paw.mode = m;
      timerRow.style.display = m === 'timer' ? 'block' : 'none';
      // При переключении режима очищаем предыдущий слой
      if (window.LDCanvas && window.LDCanvas.clearPaws) {
        window.LDCanvas.clearPaws();
      }
    }

    modeFade.addEventListener('change', updateMode);
    modeTimer.addEventListener('change', updateMode);
    modePermanent.addEventListener('change', updateMode);

    timerInput.addEventListener('input', () => {
      let v = parseInt(timerInput.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      if (v > 600) v = 600;
      current.timer = v;
      if (window.LDCanvas.state.paw) window.LDCanvas.state.paw.timer = v;
    });
  }

  function init() {
    window.LDCanvas.state.paw = { type: 'cat', size: 40, mode: 'fade', timer: 5 };
    bindEvents();
  }

  return { init, drawPaw, activate, PAW_TYPES };
})();
