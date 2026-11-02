window.LDHistory = (() => {
  const MAX = 500;
  let undoStack = [];
  let redoStack = [];
  let rebuildFn = null;
  let updateButtons = null;
  let rebuildScheduled = false;

  function setRebuildFn(fn) { rebuildFn = fn; }
  function setUpdateButtons(fn) { updateButtons = fn; }

  function refresh() {
    if (updateButtons) updateButtons(canUndo(), canRedo());
  }

  // Защита от зависаний при быстром клике
  function scheduleRebuild() {
    if (rebuildScheduled) return;
    rebuildScheduled = true;
    // Ждем 1 кадр (16мс), чтобы все быстрые клики слились в один пересчет
    requestAnimationFrame(() => {
      if (rebuildFn) rebuildFn(undoStack.slice());
      rebuildScheduled = false;
    });
  }

  function add(action) {
    if (!action) return;
    action._afterUndo = redoStack.length > 0;
    undoStack.push(action);
    if (undoStack.length > MAX) undoStack.shift();
    refresh();
  }

  function undo() {
    if (!undoStack.length) return false;
    const a = undoStack.pop();
    redoStack.push(a);
    scheduleRebuild();
    refresh();
    return true;
  }

  function redo(force) {
    if (!redoStack.length) return false;

    const hasAfterUndo = undoStack.length > 0 && undoStack[undoStack.length - 1]._afterUndo;

    if (hasAfterUndo) {
      if (!force) return 'blocked';
      while (undoStack.length && undoStack[undoStack.length - 1]._afterUndo) {
        undoStack.pop();
      }
    }

    const a = redoStack.pop();
    undoStack.push(a);
    scheduleRebuild();
    refresh();
    return true;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }
  function hasAfterUndoOnTop() {
    return undoStack.length > 0 && undoStack[undoStack.length - 1]._afterUndo;
  }

  function getAll() { return undoStack.slice(); }

  function reset() {
    undoStack = [];
    redoStack = [];
    refresh();
  }

  return {
    setRebuildFn, setUpdateButtons,
    add, undo, redo, canUndo, canRedo,
    hasAfterUndoOnTop,
    getAll, reset,
  };
})();
