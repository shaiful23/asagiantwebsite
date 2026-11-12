/* SMK Asajaya — skrip halaman pembungkus (halaman smkasajaya.my yang membungkus sistem
 * Google Apps Script dalam <iframe>).
 *
 * 1. SSO: bila Pusat SSO menghantar pengguna ke  https://smkasajaya.my/<halaman>?code=XXXX ,
 *    kod sekali guna itu diserahkan kepada sistem di dalam iframe, kemudian dibuang dari
 *    bar alamat. Tanpa ?code= langkah ini tidak berbuat apa-apa.
 * 2. Pemuat: paparan "Memuatkan…" menggantikan skrin putih sehingga sistem sedia.
 *
 * Cara guna: letak  <script src="/sso-wrap.js"></script>  SELEPAS tag <iframe>.
 */
(function () {
  var f = null;
  try { f = document.querySelector('iframe[src*="script.google.com/macros/"]'); } catch (e) { }

  // ---- 1. Teruskan kod log masuk ----
  try {
    var m = /[?&]code=([A-Za-z0-9_-]{20,100})(?:&|$)/.exec(location.search);
    if (m) {
      if (f) {
        var u = String(f.getAttribute('src')).split('#')[0];
        f.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 'code=' + m[1];
      }
      // Kod hanya sah sekali; jangan biarkan ia kekal di bar alamat / penanda buku.
      var q = location.search.replace(/([?&])code=[^&]*(&|$)/, function (_, a, b) { return b ? a : ''; });
      history.replaceState(null, '', location.pathname + q + location.hash);
    }
  } catch (e) { /* jangan ganggu halaman jika gagal */ }

  // ---- 2. Pemuat ----
  // Dipasang SELEPAS langkah 1, jadi peristiwa "load" yang ditunggu ialah muatan sebenar
  // (muatan pertama tanpa kod, jika ada, sudah dibatalkan oleh pertukaran src di atas).
  try {
    if (f && document.body) {
      var d = document.createElement('div');
      d.id = 'smkaPemuat';
      d.setAttribute('aria-live', 'polite');
      d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(160deg,#0b1f3a,#12306b);color:#fff;font:600 15px system-ui,-apple-system,Segoe UI,sans-serif;transition:opacity .35s ease';
      d.innerHTML = '<style>@keyframes smkaPusing{to{transform:rotate(360deg)}}</style>' +
        '<div style="width:46px;height:46px;border-radius:50%;border:4px solid rgba(255,255,255,.22);border-top-color:#f2b705;animation:smkaPusing .9s linear infinite"></div>' +
        '<div>Memuatkan…</div>';
      document.body.appendChild(d);
      var tutup = function () {
        if (!d.parentNode) return;
        d.style.opacity = '0';
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 380);
      };
      f.addEventListener('load', tutup);
      setTimeout(tutup, 10000);                    // jangan sekali-kali tersangkut
    }
  } catch (e) { /* pemuat tidak penting */ }
})();
