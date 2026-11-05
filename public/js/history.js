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

  function scheduleRebuild() {
    if (rebuildScheduled) return;
    rebuildScheduled = true;
    requestAnimationFrame(() => {
      if (rebuildFn) rebuildFn(undoStack.slice());
      rebuildScheduled = false;
    });
  }

  function add(action) {
    if (!action) return;
    undoStack.push(action);
    if (undoStack.length > MAX) undoStack.shift();
    redoStack.length = 0;
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

  function redo() {
    if (!redoStack.length) return false;
    const a = redoStack.pop();
    undoStack.push(a);
    scheduleRebuild();
    refresh();
    return true;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }
  function getAll() { return undoStack.slice(); }
  function getRedoAll() { return redoStack.slice(); }

  function reset() {
    undoStack = [];
    redoStack = [];
    refresh();
  }

  return {
    setRebuildFn, setUpdateButtons,
    add, undo, redo, canUndo, canRedo,
    getAll, getRedoAll, reset,
  };
})();
