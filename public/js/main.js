(() => {
  window.LDCanvas.resize();
  window.LDTextCanvas.resize();
  window.LDShapesCanvas.resize();
  window.LDTextCanvas.bindEvents();
  window.LDShapesCanvas.bindEvents();
  window.LDPaper.bindEvents();

  function applyIncomingStroke(s) {
    if (!s) return;
    if (s.isPaw) {
      if (s.mode === 'fade') {
        s.addedAt = Date.now();
        window.LDCanvas.addPaw(s);
      } else if (s.mode === 'timer') {
        const t = s.timer || (window.LDCanvas.state.paw && window.LDCanvas.state.paw.timer) || 5;
        window.LDCanvas.addPawTimer(s, t);
      } else {
        if (window.LDPaws && window.LDPaws.drawPaw) {
          window.LDPaws.drawPaw(window.LDCanvas.ctx, s);
        }
      }
      return;
    }
    if (s.isEraser && s.eraserFilter) {
      window.LDCanvas.eraseFiltered(s.from, s.to, s.width || 3, s.eraserFilter);
    } else {
      window.LDCanvas.drawSegment(s.from, s.to, s.color, s.width || 3, !!s.isEraser);
    }
  }

  function rebuildAll(actions) {
    window.LDCanvas.clearSilent();
    const shapes = [];
    const texts = [];
    for (const a of actions) {
      if (!a) continue;
      switch (a.type) {
        case 'clear':
          window.LDCanvas.clearSilent();
          shapes.length = 0; texts.length = 0;
          break;
        case 'strokes':
          for (const s of a.data) {
            if (s.isPaw) {
              if (s.mode === 'permanent' && window.LDPaws && window.LDPaws.drawPaw) {
                window.LDPaws.drawPaw(window.LDCanvas.ctx, s);
              }
              continue;
            }
            if (s.isEraser && s.eraserFilter) {
              window.LDCanvas.eraseFiltered(s.from, s.to, s.width || 3, s.eraserFilter);
            } else {
              window.LDCanvas.drawSegment(s.from, s.to, s.color, s.width || 3, !!s.isEraser);
            }
          }
          break;
        case 'fill':
          window.LDCanvas.applyFloodFillFromPercent(a.data.xPct, a.data.yPct, a.data.color);
          break;
        case 'shape-add': shapes.push(JSON.parse(JSON.stringify(a.data.shape))); break;
        case 'shape-update': { const s = shapes.find(x => x.id === a.data.id); if (s) Object.assign(s, a.data.changes); break; }
        case 'shape-delete': { const i = shapes.findIndex(x => x.id === a.data.id); if (i >= 0) shapes.splice(i, 1); break; }
        case 'text-add': texts.push(JSON.parse(JSON.stringify(a.data.text))); break;
        case 'text-update': { const t = texts.find(x => x.id === a.data.id); if (t) Object.assign(t, a.data.changes); break; }
        case 'text-delete': { const i = texts.findIndex(x => x.id === a.data.id); if (i >= 0) texts.splice(i, 1); break; }
      }
    }
    window.LDShapesCanvas.setAllSilent(shapes);
    window.LDTextCanvas.setAllSilent(texts);
  }

  window.LDHistory.setRebuildFn(rebuildAll);

  function updateUndoRedoButtons(canUndo, canRedo) {
    document.getElementById('undoBtn').disabled = !canUndo;
    // Разблокируем ↪, если на вершине истории лежит 'clear' — чтобы можно было восстановить холст
    const all = window.LDHistory ? window.LDHistory.getAll() : [];
    const last = all[all.length - 1];
    const hasClearOnTop = last && last.type === 'clear';
    document.getElementById('redoBtn').disabled = !(canRedo || hasClearOnTop);
  }
  window.LDHistory.setUpdateButtons(updateUndoRedoButtons);
  updateUndoRedoButtons(false, false);

  document.getElementById('undoBtn').addEventListener('click', () => {
    window.LDHistory.undo();
  });

  const redoBtn = document.getElementById('redoBtn');
  let redoTimer = null;
  let redoLongPressed = false;

  function redoStart() {
    redoLongPressed = false;
    clearTimeout(redoTimer);
    redoTimer = setTimeout(() => {
      redoLongPressed = true;
      const all = window.LDHistory.getAll();
      const last = all[all.length - 1];

      // Если на вершине clear — восстанавливаем холст
      if (last && last.type === 'clear') {
        window.LDHistory.undo();
        const strokes = [];
        for (const a of window.LDHistory.getAll()) {
          if (a.type === 'strokes') for (const s of a.data) strokes.push(s);
        }
        if (strokes.length) {
          try { window.LDSocket.emit('draw-batch', strokes); } catch(e) {}
        }
        if (window.LDEmojis) window.LDEmojis.showToast('Холст восстановлен', 'success');
        return;
      }

      // Иначе — redo с удалением новых действий
      const res = window.LDHistory.redo(true);
      if (res === true) {
        window.LDEmojis.showToast('Новое действие удалено, откат вперёд', 'success');
      }
    }, 500);
  }

  function redoEnd() { clearTimeout(redoTimer); }

  redoBtn.addEventListener('touchstart', redoStart, { passive: true });
  redoBtn.addEventListener('touchend', redoEnd);
  redoBtn.addEventListener('touchcancel', redoEnd);
  redoBtn.addEventListener('mousedown', redoStart);
  redoBtn.addEventListener('mouseup', redoEnd);
  redoBtn.addEventListener('mouseleave', redoEnd);

  redoBtn.addEventListener('click', (e) => {
    if (redoLongPressed) { e.preventDefault(); e.stopPropagation(); return; }

    const all = window.LDHistory.getAll();
    const last = all[all.length - 1];

    // Если на вершине clear — подсказываем зажать
    if (last && last.type === 'clear') {
      if (window.LDEmojis) window.LDEmojis.showToast('Зажмите ↪, чтобы восстановить холст', 'success');
      return;
    }

    const res = window.LDHistory.redo(false);
    if (res === 'blocked') {
      if (window.LDEmojis) window.LDEmojis.showToast('Зажмите ↪, чтобы удалить новое действие и вернуть старое', 'success');
    }
  });

  window.LDSocket.on('draw', applyIncomingStroke);
  window.LDSocket.on('paw', applyIncomingStroke);
  window.LDSocket.on('draw-batch', (batch) => {
    if (!Array.isArray(batch)) return;
    batch.forEach(applyIncomingStroke);
  });
  window.LDSocket.on('history', (strokes) => {
    strokes.forEach(applyIncomingStroke);
  });

  window.LDSocket.on('fill', ({ xPct, yPct, color }) => {
    window.LDCanvas.applyFloodFillFromPercent(xPct, yPct, color);
  });

  window.LDSocket.on('texts-history', (texts) => {
    if (!Array.isArray(texts)) return;
    window.LDTextCanvas.setAll(texts);
  });
  window.LDSocket.on('text-create', (data) => window.LDTextCanvas.add(data, true));
  window.LDSocket.on('text-update', ({ id, changes }) => window.LDTextCanvas.update(id, changes, true));
  window.LDSocket.on('text-delete', ({ id }) => {
    const all = window.LDTextCanvas.getAll().filter(t => t.id !== id);
    window.LDTextCanvas.setAllSilent(all);
  });

  window.LDSocket.on('shapes-history', (arr) => {
    if (!Array.isArray(arr)) return;
    window.LDShapesCanvas.setAll(arr);
  });
  window.LDSocket.on('shape-create', (data) => window.LDShapesCanvas.add(data, true));
  window.LDSocket.on('shape-update', ({ id, changes }) => window.LDShapesCanvas.update(id, changes, true));
  window.LDSocket.on('shape-delete', ({ id }) => {
    const all = window.LDShapesCanvas.getAll().filter(s => s.id !== id);
    window.LDShapesCanvas.setAllSilent(all);
  });

  window.LDSocket.on('clear', () => {
    window.LDCanvas.clearSilent();
    window.LDTextCanvas.clearAll();
    window.LDShapesCanvas.clearAll();
    window.LDCanvas.clearPaws();
    if (window.LDHistory) window.LDHistory.add({ type: 'clear', data: {} });
  });

  window.LDSocket.on('hearts', (payload) => {
    const emoji = payload && payload.emoji ? payload.emoji : '❤️';
    window.LDEmojis.spawn(emoji, 30);
  });

  window.LDSocket.on('set-background', (d) => window.LDBackground.setFromDataUrl(d));
  window.LDSocket.on('clear-background', () => window.LDBackground.setFromDataUrl(null));

  document.getElementById('clearBtn').addEventListener('click', () => {
    // 1. Локальная очистка — работает без интернета и без confirm()
    if (window.LDCanvas.exitSpecialModes) window.LDCanvas.exitSpecialModes();
    if (window.LDPresets && window.LDPresets.reset) window.LDPresets.reset();
    window.LDCanvas.clearSilent();
    window.LDTextCanvas.clearAll();
    window.LDShapesCanvas.clearAll();
    window.LDCanvas.clearPaws();
    // 2. Добавляем в историю как одно действие (чтобы ↪ мог отменить)
    if (window.LDHistory) window.LDHistory.add({ type: 'clear', data: {} });
    // 3. Отправляем партнёру (если есть сеть)
    try { window.LDSocket.emit('clear'); } catch(e) {}
  });

  const sizeSlider = document.getElementById('size');
  const sizeValueEl = document.getElementById('sizeValue');

  function syncSizeValue(v) {
    if (sizeValueEl) sizeValueEl.textContent = v;
  }

  sizeSlider.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    window.LDCanvas.setWidth(v);
    syncSizeValue(v);
  });

  if (sizeValueEl) {
    sizeValueEl.addEventListener('click', () => {
      const current = parseInt(sizeSlider.value, 10);
      const input = prompt('Толщина линии (1–40):', current);
      if (input === null) return;
      const num = parseInt(input, 10);
      if (isNaN(num)) return;
      let v = num;
      if (v < 1) v = 1;
      if (v > 40) v = 40;
      sizeSlider.value = v;
      window.LDCanvas.setWidth(v);
      syncSizeValue(v);
    });
  }

  syncSizeValue(parseInt(sizeSlider.value, 10) || 3);

  // === Чистый вид ===
  const cleanViewExit = document.getElementById('cleanViewExit');

  function enterCleanView() {
    const wasHandMode = document.body.classList.contains('hand-mode');
    document.querySelectorAll('.modal.open, .text-modal.open, .emoji-modal.open').forEach(el => el.classList.remove('open'));
    document.getElementById('palette').classList.remove('open');
    document.getElementById('presetsPanel').classList.remove('open');
    document.getElementById('toolsPanel').classList.remove('open');

    if (window.LDTools && window.LDTools.setActive && !wasHandMode) {
      window.LDTools.setActive('hand');
    }
    document.body.classList.add('clean-view');
  }

  function exitCleanView() {
    document.body.classList.remove('clean-view');
    if (window.LDTools && window.LDTools.setActive) {
      window.LDTools.setActive('brush');
    }
  }

  if (cleanViewExit) {
    cleanViewExit.addEventListener('click', (e) => {
      e.stopPropagation();
      exitCleanView();
    });
  }

  const topbarEl = document.getElementById('topbar');
  if (topbarEl && !document.getElementById('cleanViewEnter')) {
    const enterBtn = document.createElement('button');
    enterBtn.className = 'btn';
    enterBtn.id = 'cleanViewEnter';
    enterBtn.title = 'Чистый вид';
    enterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    enterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterCleanView();
    });
    topbarEl.appendChild(enterBtn);
  }

  // === Кнопка меню ===
  (function setupMenuToggle() {
    const menuBtn = document.getElementById('menuToggleBtn');
    const topbar = document.getElementById('topbar');
    if (!menuBtn || !topbar) return;

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opened = topbar.classList.toggle('open');
      menuBtn.classList.toggle('active', opened);
    });

    document.addEventListener('click', (e) => {
      if (!topbar.classList.contains('open')) return;
      // Не закрываем, если редактируется тулбар
      const tb = document.querySelector('.toolbar');
      if (tb && tb.classList.contains('editing')) return;
      if (topbar.contains(e.target)) return;
      if (e.target === menuBtn || menuBtn.contains(e.target)) return;
      topbar.classList.remove('open');
      menuBtn.classList.remove('active');
    });
  })();

  const privacyBtn = document.getElementById('privacyBtn');
  function updatePrivacyUI(isOnline) {
    if (isOnline) {
      privacyBtn.textContent = '🟢';
      privacyBtn.classList.remove('privacy-off');
    } else {
      privacyBtn.textContent = '🔒';
      privacyBtn.classList.add('privacy-off');
    }
  }
  privacyBtn.addEventListener('click', () => {
    const nowOnline = window.LDCanvas.toggleSending();
    window.LDTextCanvas.setSending(nowOnline);
    window.LDShapesCanvas.setSending(nowOnline);
    updatePrivacyUI(nowOnline);
  });
  updatePrivacyUI(true);

  window.LDPalette.init();
  window.LDCanvas.bindEvents();
  window.LDTools.bindEvents();
  window.LDEraserTool.bindEvents();
  window.LDEmojis.bindEvents();
  window.LDBackground.bindEvents();
  window.LDGallery.bindEvents();
  window.LDNotifications.bindEvents();
  window.LDTextTool.bindEvents();
  window.LDShapesTool.bindEvents();
  window.LDPresets.init();
  window.LDPaws.init();
  if (window.LDToolbarEditor) window.LDToolbarEditor.init();

  console.log('✅ Live Draw готов');
})();
