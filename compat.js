// 舊瀏覽器檢查（網頁版限定，tools/build-web.mjs 產生）
(function () {
  var ok = true;
  try { new RegExp('(?<=a)b'); } catch (e) { ok = false; }
  if (ok) return;
  function show() {
    var host = document.getElementById('main') || document.body;
    if (!host || document.getElementById('compat-card')) return;
    var card = document.createElement('div');
    card.id = 'compat-card';
    card.className = 'compat-card';
    card.setAttribute('role', 'alert');
    var b = document.createElement('b');
    b.textContent = '你的瀏覽器版本太舊，這個工具打不開。';
    card.appendChild(b);
    card.appendChild(document.createTextNode('iPhone 請到「設定 › 一般 › 軟體更新」更新到 iOS 16.4 以上；也可以改用電腦的 Chrome 或 Edge 打開。'));
    host.insertBefore(card, host.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
