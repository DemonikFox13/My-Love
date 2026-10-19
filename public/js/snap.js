window.LDSnap = (() => {
  const POS_TOL = 14;    // допуск снапа по позиции
  const SIZE_TOL = 10;   // допуск снапа по размеру

  function getAllObjects() {
    const out = [];

    if (window.LDShapesCanvas && window.LDShapesCanvas.getAll) {
      for (const s of window.LDShapesCanvas.getAll()) {
        out.push({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, kind: 'shape' });
      }
    }
    if (window.LDTextCanvas && window.LDTextCanvas.getAll && window.LDTextCanvas.measure) {
      for (const t of window.LDTextCanvas.getAll()) {
        const m = window.LDTextCanvas.measure(t);
        out.push({ id: t.id, x: t.x, y: t.y, w: m.width, h: m.height, kind: 'text' });
      }
    }
    return out;
  }

  // Проверяет позицию x,y,w,h. Возвращает { x, y, v: [], h: [] }
  function snapPosition(x, y, w, h, skipId) {
    const objects = getAllObjects().filter(o => o.id !== skipId);

    // Кандидаты по вертикали (X): центр экрана + левые/центр/правые края всех объектов
    const candidatesX = [window.innerWidth / 2];
    const candidatesY = [window.innerHeight / 2];
    for (const o of objects) {
      candidatesX.push(o.x, o.x + o.w / 2, o.x + o.w);
      candidatesY.push(o.y, o.y + o.h / 2, o.y + o.h);
    }

    // Мои три «якоря» — лево/центр/право
    const myXs = [x, x + w / 2, x + w];
    const myYs = [y, y + h / 2, y + h];

    let bestDx = 0, bestDiffX = POS_TOL, bestV = null;
    for (const cand of candidatesX) {
      for (const my of myXs) {
        const d = cand - my;
        if (Math.abs(d) < bestDiffX) {
          bestDiffX = Math.abs(d);
          bestDx = d;
          bestV = cand;
        }
      }
    }

    let bestDy = 0, bestDiffY = POS_TOL, bestH = null;
    for (const cand of candidatesY) {
      for (const my of myYs) {
        const d = cand - my;
        if (Math.abs(d) < bestDiffY) {
          bestDiffY = Math.abs(d);
          bestDy = d;
          bestH = cand;
        }
      }
    }

    return {
      x: x + bestDx,
      y: y + bestDy,
      v: bestV !== null ? [bestV] : [],
      h: bestH !== null ? [bestH] : [],
    };
  }

  // Снап по размеру. Возвращает { w, h, snappedW, snappedH }
  function snapSize(w, h, skipId) {
    const objects = getAllObjects().filter(o => o.id !== skipId);

    let bestW = w, bestH = h;
    let bestWDiff = SIZE_TOL, bestHDiff = SIZE_TOL;
    for (const o of objects) {
      const dw = Math.abs(o.w - w);
      if (dw < bestWDiff) { bestWDiff = dw; bestW = o.w; }
      const dh = Math.abs(o.h - h);
      if (dh < bestHDiff) { bestHDiff = dh; bestH = o.h; }
    }

    return {
      w: bestW,
      h: bestH,
      snappedW: bestWDiff < SIZE_TOL,
      snappedH: bestHDiff < SIZE_TOL,
    };
  }

  return { snapPosition, snapSize, getAllObjects };
})();
