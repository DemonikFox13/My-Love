window.LDHistory = (() => {
  const MAX = 500;
  let undoStack = [];
  let redoStack = [];
  let rebuildFn = null;
  let updateButtons = null;

  function setRebuildFn(fn) { rebuildFn = fn; }
  function setUpdateButtons(fn) { updateButtons = fn; }

  function refresh() {
    if (updateButtons) updateButtons(canUndo(), canRedo());
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
    if (rebuildFn) rebuildFn(undoStack.slice());
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
    if (rebuildFn) rebuildFn(undoStack.slice());
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
