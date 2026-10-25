window.LDBackground = (() => {
  const { bgCanvas, bgCtx } = window.LDCanvas;
  let backgroundImg = null;

  function redraw() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    const W = window.innerWidth, H = window.innerHeight;
    
    if (!backgroundImg) {
      bgCanvas.width = bgCanvas.width; // Сброс размера, чтобы WebView стер старый рисунок
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
  }

  function setFromDataUrl(dataUrl) {
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
    window.LDSocket.emit('set-background', dataUrl);
    input.value = '';
  }

  function clearBackgroundLocalAndRemote() {
    setFromDataUrl(null);
    window.LDSocket.emit('clear-background');
  }

  // НАШ КОСТЫЛЬ: Своё HTML-окно вместо системного
  function showCustomConfirm(message, onYes) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;padding:20px;border-radius:12px;text-align:center;max-width:80%;box-shadow:0 4px 15px rgba(0,0,0,0.2);';
    
    const text = document.createElement('p');
    text.innerText = message;
    text.style.cssText = 'margin:0 0 20px 0;font-size:16px;color:#333;font-weight:bold;';
    
    const btnYes = document.createElement('button');
    btnYes.innerText = 'Да';
    btnYes.style.cssText = 'margin-right:10px;padding:10px 20px;background:#ff4757;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;';
    
    const btnNo = document.createElement('button');
    btnNo.innerText = 'Отмена';
    btnNo.style.cssText = 'padding:10px 20px;background:#f1f2f6;color:#333;border:none;border-radius:8px;font-size:16px;cursor:pointer;';
    
    btnYes.onclick = () => {
      document.body.removeChild(overlay);
      onYes();
    };
    btnNo.onclick = () => {
      document.body.removeChild(overlay);
    };
    
    box.appendChild(text);
    box.appendChild(btnYes);
    box.appendChild(btnNo);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
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
        // Вместо системного confirm() используем наше окно
        showCustomConfirm('Убрать фон у всех?', () => {
          clearBackgroundLocalAndRemote();
        });
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
