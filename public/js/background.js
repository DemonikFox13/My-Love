window.LDBackground = (() => {
  const { bgCanvas, bgCtx } = window.LDCanvas;
  let backgroundImg = null;

  function redraw() {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    
    // Сбрасываем размер (очищает пиксели)
    bgCanvas.width = W * dpr;
    bgCanvas.height = H * dpr;
    bgCanvas.style.width = W + 'px';
    bgCanvas.style.height = H + 'px';
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, W, H);
    
    if (!backgroundImg) {
      bgCtx.fillStyle = '#ffffff';
      bgCtx.fillRect(0, 0, W, H);
    } else {
      const ir = backgroundImg.width / backgroundImg.height;
      const sr = W / H;
      let w, h, x, y;
      if (ir > sr) { w = W; h = W / ir; x = 0; y = (H - h) / 2; }
      else         { h = H; w = H * ir; y = 0; x = (W - w) / 2; }
      bgCtx.fillStyle = '#000';
      bgCtx.fillRect(0, 0, W, H);
      bgCtx.drawImage(backgroundImg, x, y, w, h);
    }
    
    // ГЛАВНЫЙ ХАК: заставляем WebView перерисоваться через мост
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.forceRedraw === 'function') {
        window.AndroidBridge.forceRedraw();
      }
    } catch(e) {}
    
    // Дополнительные трюки для обычных браузеров
    void bgCanvas.offsetHeight;
    bgCanvas.style.transform = 'translateZ(0)';
    setTimeout(() => { bgCanvas.style.transform = ''; }, 16);
  }

  function setFromDataUrl(dataUrl) {
    if (!dataUrl) { backgroundImg = null; redraw(); return; }
    const img = new Image();
    img.onload = () => { backgroundImg = img; redraw(); };
    img.src = dataUrl;
  }

  function compressFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1400;
          let w = img.width, h = img.height;
          if (Math.max(w, h) > MAX) {
            const k = MAX / Math.max(w, h);
            w = Math.round(w * k); h = Math.round(h * k);
          }
          const off = document.createElement('canvas');
          off.width = w; off.height = h;
          off.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(off.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function pickFile() {
    const input = document.getElementById('bgFile');
    const file = input.files[0];
    if (!file) return;
    const dataUrl = await compressFile(file);
    // 1. Сначала локально — работает даже без интернета
    setFromDataUrl(dataUrl);
    // 2. Потом синхронизация с партнёром (в фоне)
    try { window.LDSocket.emit('set-background', dataUrl); } catch(e) {}
    input.value = '';
  }

  // ЛОКАЛЬНАЯ очистка (работает всегда, даже офлайн)
  function clearBackgroundLocal() {
    setFromDataUrl(null);
  }

  // Очистка + синхронизация с партнёром (если есть интернет)
  function clearBackgroundLocalAndRemote() {
    clearBackgroundLocal();
    try { window.LDSocket.emit('clear-background'); } catch(e) {}
  }

  function bindEvents() {
    const bgBtn = document.getElementById('bgBtn');
    const bgFile = document.getElementById('bgFile');

    bgBtn.addEventListener('click', () => bgFile.click());
    bgFile.addEventListener('change', pickFile);

    let holdTimer = null;
    let longPressed = false;

    function holdStart() {
      longPressed = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        longPressed = true;
        if (confirm('Убрать фон у всех?')) {
          setTimeout(() => {
            clearBackgroundLocalAndRemote();
          }, 500);
        }
      }, 700);
    }

    function holdEnd() { clearTimeout(holdTimer); }

    bgBtn.addEventListener('touchstart', holdStart, { passive: true });
    bgBtn.addEventListener('touchend', holdEnd);
    bgBtn.addEventListener('touchcancel', holdEnd);
    bgBtn.addEventListener('mousedown', holdStart);
    bgBtn.addEventListener('mouseup', holdEnd);
    bgBtn.addEventListener('mouseleave', holdEnd);
  }

  function getImage() { return backgroundImg; }
  return { redraw, setFromDataUrl, bindEvents, getImage };
})();
