window.LDGallery = (() => {
  const modal = document.getElementById('galleryModal');
  const grid  = document.getElementById('galleryGrid');

  function mergeLayers() {
    const src = window.LDCanvas.canvas;
    const bgImg = window.LDBackground.getImage();
    const dpr = window.LDCanvas.dpr;

    const merged = document.createElement('canvas');
    merged.width = src.width;
    merged.height = src.height;
    const mctx = merged.getContext('2d');

    if (bgImg) {
      const w = window.innerWidth * dpr;
      const h = window.innerHeight * dpr;
      const ir = bgImg.width / bgImg.height;
      const sr = w / h;
      let dw, dh, dx, dy;
      if (ir > sr) { dw = w; dh = w / ir; dx = 0; dy = (h - dh) / 2; }
      else         { dh = h; dw = h * ir; dy = 0; dx = (w - dw) / 2; }
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, merged.width, merged.height);
      mctx.drawImage(bgImg, dx, dy, dw, dh);
    } else {
      mctx.fillStyle = '#fff';
      mctx.fillRect(0, 0, merged.width, merged.height);
    }

    mctx.drawImage(src, 0, 0);
    // тексты
    mctx.drawImage(window.LDTextCanvas.canvas, 0, 0);
    return merged;
  }

  async function save() {
    // чтобы выделение не попало в картинку — временно снимаем выделение
    window.LDTextCanvas.deselect();
    const dataURL = mergeLayers().toDataURL('image/png');

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'love-draw-' + Date.now() + '.png';
    a.click();

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataURL })
      });
      await res.json();
    } catch (e) { console.error('[save]', e); }
  }

  async function loadList() {
    grid.innerHTML = '<p style="color:#fff">Загрузка…</p>';
    try {
      const res = await fetch('/api/gallery');
      const items = await res.json();
      if (!items.length) {
        grid.innerHTML = '<p style="color:#aaa">Пока пусто. Сохрани первый рисунок 💾</p>';
        return;
      }
      grid.innerHTML = '';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
          <img src="${item.url}" alt="">
          <div class="actions">
            <a href="${item.url}" download>⬇ Скачать</a>
            <button class="del" data-name="${item.name}">Удалить</button>
          </div>`;
        grid.appendChild(div);
      });
      grid.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Удалить?')) return;
          await fetch('/api/gallery/' + btn.dataset.name, { method: 'DELETE' });
          loadList();
        });
      });
    } catch (e) {
      grid.innerHTML = '<p style="color:#f66">Ошибка загрузки</p>';
    }
  }

  function bindEvents() {
    document.getElementById('saveBtn').addEventListener('click', save);
    document.getElementById('galleryBtn').addEventListener('click', () => {
      modal.classList.add('open');
      loadList();
    });
    document.getElementById('galleryClose').addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  return { bindEvents, save };
})();
