window.LDSocket = (() => {
  // Роль из URL: ?role=A или ?role=B. Если нет — старое поведение (общий холст).
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role');
  const validRole = (role === 'A' || role === 'B') ? role : null;

  // Подключаемся к серверу. Если роль есть — передаём её в query.
  const socket = validRole ? io({ query: { role: validRole } }) : io();

  // Небольшая диагностика в консоль, чтобы было видно в DevTools.
  if (validRole) {
    console.log('[LDSocket] роль:', validRole);
  } else {
    console.log('[LDSocket] роль не указана — режим общего холста');
  }

  return {
    socket,
    role: validRole,
    on: (event, handler) => socket.on(event, handler),
    emit: (event, payload) => socket.emit(event, payload),
  };
})();
