const config = require('./config');

function makeCanvas() {
  return { strokes: [], texts: [], shapes: [], background: null };
}

const state = {
  canvases: { A: makeCanvas(), B: makeCanvas() },
  mutedSockets: new Set(),
};

function pushStroke(canvas, item) {
  if (!item) return;
  canvas.strokes.push(item);
  if (canvas.strokes.length > config.MAX_STROKES_IN_MEMORY) {
    canvas.strokes.splice(0, canvas.strokes.length - config.MAX_STROKES_IN_MEMORY);
  }
}

function initSocket(io) {
  io.on('connection', (socket) => {
    const role = socket.handshake.query.role;
    const isA = role === 'A';
    const isB = role === 'B';
    const hasRole = isA || isB;
    const myCanvas = hasRole ? state.canvases[role] : null;
    const partnerRole = isA ? 'B' : (isB ? 'A' : null);

    console.log('[socket] подключился', socket.id, 'role=', role || 'none');

    if (hasRole) {
      socket.emit('history', myCanvas.strokes);
      socket.emit('texts-history', myCanvas.texts);
      socket.emit('shapes-history', myCanvas.shapes);
      socket.emit('set-background', myCanvas.background);
      socket.emit('my-role', role);
    } else {
      socket.emit('history', state.canvases.A.strokes);
      socket.emit('texts-history', state.canvases.A.texts);
      socket.emit('shapes-history', state.canvases.A.shapes);
      socket.emit('set-background', state.canvases.A.background);
    }

    function broadcast(event, payload) {
      if (hasRole) {
        socket.to(partnerRole).emit(event, payload);
        socket.broadcast.emit(event, payload);
      } else {
        socket.broadcast.emit(event, payload);
      }
    }

    function broadcastPartnerActive(type) {
      if (hasRole) {
        socket.to(partnerRole).emit('partner-active', { type });
        socket.broadcast.emit('partner-active', { type });
      } else {
        socket.broadcast.emit('partner-active', { type });
      }
    }

    socket.on('draw', (data) => {
      if (!data || !data.from || !data.to) return;
      if (myCanvas) pushStroke(myCanvas, data);
      broadcast('draw', data);
      broadcastPartnerActive('draw');
    });

    socket.on('draw-batch', (batch) => {
      if (!Array.isArray(batch) || !batch.length) return;
      const valid = batch.filter(s => s && (s.isPaw || (s.from && s.to)));
      if (!valid.length) return;
      if (myCanvas) {
        valid.forEach(item => {
          if (!item.isPaw || item.mode === 'permanent') pushStroke(myCanvas, item);
        });
      }
      broadcast('draw-batch', valid);
      broadcastPartnerActive('draw');
    });

    socket.on('paw', (data) => {
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
      if (myCanvas && data.mode === 'permanent') pushStroke(myCanvas, data);
      broadcast('paw', data);
      broadcastPartnerActive('draw');
    });

    socket.on('fill', (data) => {
      if (!data || typeof data.xPct !== 'number' || !data.color) return;
      broadcast('fill', data);
      broadcastPartnerActive('draw');
    });

    socket.on('text-create', (data) => {
      if (!data || !data.id || !data.text) return;
      if (myCanvas) myCanvas.texts.push(data);
      broadcast('text-create', data);
      broadcastPartnerActive('draw');
    });
    socket.on('text-update', (data) => {
      if (!data || !data.id) return;
      if (myCanvas) {
        const idx = myCanvas.texts.findIndex(t => t.id === data.id);
        if (idx >= 0) myCanvas.texts[idx] = { ...myCanvas.texts[idx], ...data.changes };
      }
      broadcast('text-update', data);
    });
    socket.on('text-delete', (data) => {
      if (!data || !data.id) return;
      if (myCanvas) myCanvas.texts = myCanvas.texts.filter(t => t.id !== data.id);
      broadcast('text-delete', data);
    });

    socket.on('shape-create', (data) => {
      if (!data || !data.id || !data.type) return;
      if (myCanvas) myCanvas.shapes.push(data);
      broadcast('shape-create', data);
      broadcastPartnerActive('draw');
    });
    socket.on('shape-update', (data) => {
      if (!data || !data.id) return;
      if (myCanvas) {
        const idx = myCanvas.shapes.findIndex(s => s.id === data.id);
        if (idx >= 0) myCanvas.shapes[idx] = { ...myCanvas.shapes[idx], ...data.changes };
      }
      broadcast('shape-update', data);
    });
    socket.on('shape-delete', (data) => {
      if (!data || !data.id) return;
      if (myCanvas) myCanvas.shapes = myCanvas.shapes.filter(s => s.id !== data.id);
      broadcast('shape-delete', data);
    });

    socket.on('clear', () => {
      if (myCanvas) {
        myCanvas.strokes = [];
        myCanvas.texts = [];
        myCanvas.shapes = [];
        if (partnerRole) socket.to(partnerRole).emit('clear');
        socket.broadcast.emit('clear');
      } else {
        state.canvases.A = makeCanvas();
        state.canvases.B = makeCanvas();
        io.emit('clear');
      }
    });

    socket.on('clear_my_canvas', () => {
      if (myCanvas) {
        myCanvas.strokes = [];
        myCanvas.texts = [];
        myCanvas.shapes = [];
        if (partnerRole) socket.to(partnerRole).emit('clear');
        socket.broadcast.emit('clear');
      }
    });

    socket.on('drawing_start', () => {
      if (hasRole) socket.to(partnerRole).emit('partner_drawing_start');
    });
    socket.on('drawing_stop', () => {
      if (hasRole) socket.to(partnerRole).emit('partner_drawing_stop');
    });

    socket.on('overlay_on', () => {
      if (hasRole) socket.to(partnerRole).emit('partner_overlay_on');
    });
    socket.on('overlay_off', () => {
      if (hasRole) socket.to(partnerRole).emit('partner_overlay_off');
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
      if (myCanvas) myCanvas.background = dataUrl;
      broadcast('set-background', dataUrl);
    });
    socket.on('clear-background', () => {
      if (myCanvas) myCanvas.background = null;
      broadcast('clear-background');
    });

    socket.on('disconnect', () => {
      state.mutedSockets.delete(socket.id);
      console.log('[socket] отключился', socket.id, 'role=', role || 'none');
    });
  });
}

module.exports = { initSocket, state };
