window.LDSocket = (() => {
  const socket = io();
  return {
    socket,
    on: (event, handler) => socket.on(event, handler),
    emit: (event, payload) => socket.emit(event, payload),
  };
})();
