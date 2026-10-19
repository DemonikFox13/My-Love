// Ловим ошибки
window.addEventListener('error', function (e) {
  var msg = e.message || 'unknown error';
  var file = (e.filename || '').split('/').pop();
  var line = e.lineno || 0;
  var div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c62828;color:#fff;padding:14px;z-index:999999;font-size:13px;font-family:monospace;line-height:1.4;word-break:break-all;';
  div.textContent = '❌ ' + msg + ' — ' + file + ':' + line;
  document.body.appendChild(div);
}, true);

// Ловим клики и показываем что произошло
window.addEventListener('load', function() {
  setTimeout(function() {
    var info = document.createElement('div');
    info.style.cssText = 'position:fixed;bottom:80px;left:10px;right:10px;background:#1565c0;color:#fff;padding:10px;z-index:999998;font-size:12px;font-family:monospace;line-height:1.4;word-break:break-all;border-radius:10px;max-height:140px;overflow:auto;';
    info.textContent = 'Диагностика запущена. Нажми 🖌 в тулбаре.';
    document.body.appendChild(info);
    window.__diagInfo = info;

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button, .btn, .tool-btn, .tt-btn');
      var text = '';
      if (btn) {
        text = 'КЛИК по: ' + (btn.id || btn.className || 'btn') + ' | текст: ' + (btn.textContent || '').trim().substring(0,10);
      } else {
        text = 'КЛИК по: ' + (e.target.id || e.target.className || e.target.tagName);
      }

      setTimeout(function() {
        var tp = document.getElementById('toolsPanel');
        var pp = document.getElementById('presetsPanel');
        var pm = document.getElementById('pawsModal');
        text += '\n toolsPanel: ' + (tp ? tp.className : 'нет');
        text += '\n presetsPanel: ' + (pp ? pp.className : 'нет');
        text += '\n pawsModal: ' + (pm ? pm.className : 'нет');
        info.textContent = text;
      }, 50);
    }, true);
  }, 800);
});
