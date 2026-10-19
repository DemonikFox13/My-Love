const config = require('./config');

const state = {
  strokes: [],
  texts: [],
  shapes: [],
  background: null,
  mutedSockets: new Set(),
};

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log('[socket] подключился', socket.id);

    socket.emit('history', state.strokes);
    socket.emit('texts-history', state.texts);
    socket.emit('shapes-history', state.shapes);
    socket.emit('set-background', state.background);

    socket.on('draw', (data) => {
      if (!data || !data.from || !data.to) return;
      state.strokes.push(data);
      if (state.strokes.length > config.MAX_STROKES_IN_MEMORY) {
        state.strokes.splice(0, state.strokes.length - config.MAX_STROKES_IN_MEMORY);
      }
      socket.broadcast.emit('draw', data);
      socket.broadcast.emit('partner-active', { type: 'draw' });
    });

    socket.on('draw-batch', (batch) => {
      if (!Array.isArray(batch) || !batch.length) return;
      const valid = batch.filter(s => s && (s.isPaw || (s.from && s.to)));
      if (!valid.length) return;
      // Постоянные лапки сохраняем в историю, временные — нет
      valid.forEach(item => {
        if (!item.isPaw || item.mode === 'permanent') {
          state.strokes.push(item);
        }
      });
      if (state.strokes.length > config.MAX_STROKES_IN_MEMORY) {
        state.strokes.splice(0, state.strokes.length - config.MAX_STROKES_IN_MEMORY);
      }
      socket.broadcast.emit('draw-batch', valid);
      socket.broadcast.emit('partner-active', { type: 'draw' });
    });

    // ЛАПКИ: только broadcast, в историю попадают ТОЛЬКО постоянные
    socket.on('paw', (data) => {
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
      if (data.mode === 'permanent') {
        state.strokes.push(data);
        if (state.strokes.length > config.MAX_STROKES_IN_MEMORY) {
          state.strokes.splice(0, state.strokes.length - config.MAX_STROKES_IN_MEMORY);
        }
      }
      socket.broadcast.emit('paw', data);
      socket.broadcast.emit('partner-active', { type: 'draw' });
    });

    socket.on('fill', (data) => {
      if (!data || typeof data.xPct !== 'number' || !data.color) return;
      socket.broadcast.emit('fill', data);
      socket.broadcast.emit('partner-active', { type: 'draw' });
    });

    socket.on('text-create', (data) => {
      if (!data || !data.id || !data.text) return;
      state.texts.push(data);
      socket.broadcast.emit('text-create', data);
      socket.broadcast.emit('partner-active', { type: 'draw' });
    });
    socket.on('text-update', (data) => {
      if (!data || !data.id) return;
      const idx = state.texts.findIndex(t => t.id === data.id);
      if (idx >= 0) state.texts[idx] = { ...state.texts[idx], ...data.changes };
      socket.broadcast.emit('text-update', data);
    });
    socket.on('text-delete', (data) => {
      if (!data || !data.id) return;
      state.texts = state.texts.filter(t => t.id !== data.id);
      socket.broadcast.emit('text-delete', data);
    });

    socket.on('shape-create', (data) => {
      if (!data || !data.id || !data.type) return;
      state.shapes.push(data);
      socket.broadcast.emit('shape-create', data);
      socket.broadcast.emit('partner-active', { type: 'draw' });
    });
    socket.on('shape-update', (data) => {
      if (!data || !data.id) return;
      const idx = state.shapes.findIndex(s => s.id === data.id);
      if (idx >= 0) state.shapes[idx] = { ...state.shapes[idx], ...data.changes };
      socket.broadcast.emit('shape-update', data);
    });
    socket.on('shape-delete', (data) => {
      if (!data || !data.id) return;
      state.shapes = state.shapes.filter(s => s.id !== data.id);
      socket.broadcast.emit('shape-delete', data);
    });

    socket.on('clear', () => {
      state.strokes = [];
      state.texts = [];
      state.shapes = [];
      io.emit('clear');
    });

    socket.on('mute-emoji', (payload) => {
      const on = !!(payload && payload.muted);
      if (on) state.mutedSockets.add(socket.id);
      else    state.mutedSockets.delete(socket.id);
    });

    socket.on('hearts', (payload) => {
      const emoji = payload && payload.emoji ? String(payload.emoji).slice(0, 8) : '❤️';
      const allSockets = io.sockets.sockets;
      const recipients = [];
      for (const [id, s] of allSockets.entries()) {
        if (id === socket.id) continue;
        if (state.mutedSockets.has(id)) continue;
        recipients.push(s);
      }
      const othersCount = allSockets.size - 1;
      if (othersCount > 0 && recipients.length === 0) {
        socket.emit('emoji-blocked');
        return;
      }
      recipients.forEach(s => s.emit('hearts', { emoji }));
      recipients.forEach(s => s.emit('partner-active', { type: 'hearts' }));
    });

    socket.on('set-background', (dataUrl) => {
      state.background = dataUrl;
      socket.broadcast.emit('set-background', dataUrl);
    });
    socket.on('clear-background', () => {
      state.background = null;
      socket.broadcast.emit('clear-background');
    });
    socket.on('disconnect', () => {
      state.mutedSockets.delete(socket.id);
      console.log('[socket] отключился', socket.id);
    });
  });
}

module.exports = { initSocket, state };
