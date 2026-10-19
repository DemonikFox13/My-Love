window.LDEmojis = (() => {
  const MAX_ON_SCREEN = 120;

  const modal = document.getElementById('emojiModal');
  const tabsEl = document.getElementById('emojiTabs');
  const gridEl = document.getElementById('emojiGrid');
  const closeBtn = document.getElementById('emojiClose');
  const heartBtn = document.getElementById('heartBtn');
  const muteBtn = document.getElementById('emojiMuteBtn');
  const container = document.getElementById('hearts');

  const CATEGORIES = [
    { name: 'Смайлы', emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍',
      '🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤗','🤭','🤔',
      '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴',
      '😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐'
    ]},
    { name: 'Любовь', emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗',
      '💖','💘','💝','💟','♥️','💋','💌','💐','🌹','🥰','😍','😘','💏','💑','👩‍❤️‍👨'
    ]},
    { name: 'Жесты', emojis: [
      '👍','👎','👌','✌️','🤞','🤟','🤘','👈','👉','👆','👇','☝️','✋','🤚','🖐️',
      '🖖','👋','🤙','💪','🙏','👏','🙌','🤝','👐','🤲','✊','👊','🤛','🤜','💅'
    ]},
    { name: 'Животные', emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
      '🐔','🐧','🐦','🦄','🐝','🦋','🐢','🐙','🦀','🐬','🐳','🐠','🐡','🦈','🐊'
    ]},
    { name: 'Еда', emojis: [
      '🍎','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🥝','🍅','🥑','🍕','🍔','🍟',
      '🌭','🍿','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍷','🍸','🍺','🥂','🍾','☕'
    ]},
    { name: 'Природа', emojis: [
      '🌸','💐','🌹','🌺','🌻','🌼','🌷','🌱','🌿','☘️','🍀','🎋','🍃','🌈','☀️',
      '⭐','🌙','⚡','🔥','❄️','☁️','🌊','🌍','🌕','🌛','💫','✨','🌟','💥','☄️'
    ]},
    { name: 'Разное', emojis: [
      '🎉','🎊','🎈','🎁','🎀','🎂','🎶','🎵','💯','💎','👑','🏆','🥇','🎯','🎨',
      '🎭','🎪','🎬','📸','🎮','🕹️','🎲','🧩','🎓','🎤','🎧','🎸','🎺','🥁','🎻'
    ]},
  ];

  let currentEmoji = '❤️';
  let currentCategory = 0;
  let muted = false;

  // === ТОСТ ===
  let toastEl = null;
  let toastTimer = null;
  function showToast(text, type) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.toggle('success', type === 'success');
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2200);
  }

  // === СЧЁТЧИК АКТИВНЫХ ЭМОДЗИ ===
  function activeCount() {
    return container.children.length;
  }

  // === СПАВН С ЛИМИТОМ ===
  function spawn(emoji, count) {
    const e = emoji || currentEmoji;
    const free = MAX_ON_SCREEN - activeCount();
    if (free <= 0) return;             // уже забито — не спавним
    const realCount = Math.min(count, free);

    for (let i = 0; i < realCount; i++) {
      const h = document.createElement('div');
      h.className = 'flying-heart';
      h.textContent = e;
      h.style.left = Math.random() * 100 + 'vw';
      h.style.fontSize = (24 + Math.random() * 40) + 'px';
      h.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
      h.style.animationDelay = (Math.random() * 0.8) + 's';
      container.appendChild(h);
      setTimeout(() => h.remove(), 6000);
    }
  }

  // === ОТПРАВКА ПАРТНЁРУ ===
  function send() {
    window.LDSocket.emit('hearts', { emoji: currentEmoji });
  }

  // === ПИКЕР ===
  function buildTabs() {
    tabsEl.innerHTML = '';
    CATEGORIES.forEach((cat, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'emoji-tab' + (i === currentCategory ? ' active' : '');
      b.textContent = cat.name;
      b.addEventListener('click', () => {
        currentCategory = i;
        buildTabs();
        buildGrid();
      });
      tabsEl.appendChild(b);
    });
  }

  function buildGrid() {
    gridEl.innerHTML = '';
    const cat = CATEGORIES[currentCategory];
    cat.emojis.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'emoji-btn' + (e === currentEmoji ? ' selected' : '');
      b.textContent = e;
      b.addEventListener('click', () => {
        currentEmoji = e;
        heartBtn.textContent = e;
        buildGrid();
      });
      gridEl.appendChild(b);
    });
    const sel = gridEl.querySelector('.emoji-btn.selected');
    if (sel) setTimeout(() => sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
  }

  function open() { buildTabs(); buildGrid(); modal.classList.add('open'); }
  function close() { modal.classList.remove('open'); }

  // === МЬЮТ ===
  function toggleMute() {
    muted = !muted;
    muteBtn.classList.toggle('muted', muted);
    muteBtn.title = muted
      ? 'Запрещено. Партнёр не может отправлять вам эмодзи'
      : 'Запретить партнёру отправлять эмодзи';
    window.LDSocket.emit('mute-emoji', { muted });
    showToast(
      muted ? 'Вы запретили партнёру отправлять эмодзи' : 'Запрет снят',
      muted ? '' : 'success'
    );
  }

  function bindEvents() {
    // === Кнопка эмодзи: тап = отправить, долгое = пикер ===
    let pressTimer = null;
    let longPressed = false;

    function startPress() {
      longPressed = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        longPressed = true;
        open();
      }, 500);
    }
    function endPress() { clearTimeout(pressTimer); }

    heartBtn.addEventListener('touchstart', startPress, { passive: true });
    heartBtn.addEventListener('touchend', endPress);
    heartBtn.addEventListener('touchcancel', endPress);
    heartBtn.addEventListener('mousedown', startPress);
    heartBtn.addEventListener('mouseup', endPress);
    heartBtn.addEventListener('mouseleave', endPress);

    heartBtn.addEventListener('click', (e) => {
      if (longPressed) { e.preventDefault(); e.stopPropagation(); return; }
      send();
    });

    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // === Мьют ===
    muteBtn.addEventListener('click', toggleMute);

    // === Эмодзи запрещены партнёром ===
    window.LDSocket.on('emoji-blocked', () => {
      showToast('Партнёр запретил отправку эмодзи');
    });
  }

  function getCurrent() { return currentEmoji; }

  return { spawn, send, bindEvents, open, close, getCurrent, showToast };
})();
