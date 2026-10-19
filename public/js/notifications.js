window.LDNotifications = (() => {
  let enabled = false;
  const btn = document.getElementById('notifBtn');

  async function toggle() {
    if (!('Notification' in window)) {
      alert('Нет поддержки уведомлений');
      return;
    }
    if (Notification.permission === 'granted') {
      enabled = !enabled;
      btn.classList.toggle('active', enabled);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      enabled = true;
      btn.classList.add('active');
      new Notification('Уведомления включены ❤️');
    }
  }

  function notify(text) {
    if (!enabled) return;
    if (document.visibilityState === 'visible') return;
    new Notification('Live Draw', { body: text });
  }

  function bindEvents() {
    btn.addEventListener('click', toggle);
    window.LDSocket.on('partner-active', ({ type }) => {
      if (type === 'hearts') notify('Партнёр отправил сердечки ❤️');
      else notify('Партнёр что-то рисует ✏️');
    });
  }

  return { bindEvents };
})();
