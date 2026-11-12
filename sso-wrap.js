/* SMK Asajaya — skrip halaman pembungkus (halaman smkasajaya.my yang membungkus sistem
 * Google Apps Script dalam <iframe>).
 *
 * 1. Memuatkan sistem SEKALI sahaja: alamat sistem ditulis pada  data-src  dan skrip ini
 *    yang menetapkan  src  — terus bersama kod log masuk jika ada.
 * 2. SSO: bila Pusat SSO menghantar pengguna ke  https://smkasajaya.my/<halaman>?code=XXXX ,
 *    kod sekali guna itu diserahkan kepada sistem di dalam iframe, kemudian dibuang dari
 *    bar alamat.
 * 3. Pemuat: paparan "Memuatkan…" menggantikan skrin putih sehingga sistem sedia.
 *
 * Cara guna (halaman baharu):
 *     <iframe data-src="https://script.google.com/macros/s/…/exec"></iframe>
 *     <script src="/sso-wrap.js?v=2"></script>
 * Halaman lama yang masih menulis  src="…"  terus pada iframe tetap disokong.
 */
(function () {
  var f = null, asal = '', tangguh = false;
  try {
    f = document.querySelector('iframe[data-src*="script.google.com/macros/"]');
    if (f) { tangguh = true; asal = String(f.getAttribute('data-src')); }
    else {
      f = document.querySelector('iframe[src*="script.google.com/macros/"]');
      if (f) asal = String(f.getAttribute('src'));
    }
  } catch (e) { }

  // ---- Kod log masuk dari bar alamat ----
  var kod = '';
  try {
    var m = /[?&]code=([A-Za-z0-9_-]{20,100})(?:&|$)/.exec(location.search);
    if (m) {
      kod = m[1];
      // Kod hanya sah sekali; jangan biarkan ia kekal di bar alamat / penanda buku.
      var q = location.search.replace(/([?&])code=[^&]*(&|$)/, function (_, a, b) { return b ? a : ''; });
      history.replaceState(null, '', location.pathname + q + location.hash);
    }
  } catch (e) { /* jangan ganggu halaman jika gagal */ }

  // ---- Pemuat (dipasang sebelum src ditetapkan supaya "load" yang ditunggu ialah muatan sebenar) ----
  try {
    // Halaman yang sudah ada pemuat sendiri (#pemuat / #splash) tidak perlu satu lagi.
    if (f && document.body && !document.getElementById('pemuat') && !document.getElementById('splash')) {
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

  // ---- Tetapkan alamat sistem ----
  try {
    if (f && asal && (tangguh || kod)) {
      var u = asal.split('#')[0];
      if (kod) u += (u.indexOf('?') >= 0 ? '&' : '?') + 'code=' + kod;
      f.src = u;
    }
  } catch (e) {
    try { if (f && asal) f.src = asal; } catch (e2) { }
  }
})();
