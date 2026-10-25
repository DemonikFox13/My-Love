window.LDBackground = (() => {
  const { bgCanvas, bgCtx } = window.LDCanvas;
  let backgroundImg = null;
  let currentDataUrl = null;

  // bgCanvas СКРЫТ визуально. Он используется только для getImageData (пипетка/галерея).
  // Отображение фона идёт через <img id="bgImg">.
  bgCanvas.style.visibility = 'hidden';

  function replaceBgImg() {
    const oldImg = document.getElementById('bgImg');
    const newImg = document.createElement('img');
    newImg.id = 'bgImg';
    newImg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;pointer-events:none;';
    
    if (currentDataUrl) {
      newImg.src = currentDataUrl;
      newImg.style.background = '#000';
    } else {
      // Пустой фон: белый
      newImg.style.background = '#ffffff';
    }

    if (oldImg && oldImg.parentNode) {
      oldImg.parentNode.replaceChild(newImg, oldImg);
    } else {
      const paper = document.getElementById('paper');
      if (paper) paper.insertBefore(newImg, paper.firstChild);
    }
  }

  function redraw() {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // Данные для пипетки/галереи — на скрытом bgCanvas
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

    // Отображение — пересоздаём <img>. WebView это 100% перерисует.
    replaceBgImg();
  }

  function setFromDataUrl(dataUrl) {
    currentDataUrl = dataUrl;
    if (!dataUrl) {
      backgroundImg = null;
      redraw();
      return;
    }
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
    setFromDataUrl(dataUrl);
    try { window.LDSocket.emit('set-background', dataUrl); } catch(e) {}
    input.value = '';
  }

  function clearBackgroundLocalAndRemote() {
    setFromDataUrl(null);
    try { window.LDSocket.emit('clear-background'); } catch(e) {}
  }

  function bindEvents() {
    const bgBtn = document.getElementById('bgBtn');
    const bgFile = document.getElementById('bgFile');

    bgBtn.addEventListener('click', () => bgFile.click());
    bgFile.addEventListener('change', pickFile);

    let holdTimer = null;

    function holdStart() {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (confirm('Убрать фон у всех?')) {
          clearBackgroundLocalAndRemote();
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

  // Создаём bgImg при старте
  replaceBgImg();

  return { redraw, setFromDataUrl, bindEvents, getImage };
})();
