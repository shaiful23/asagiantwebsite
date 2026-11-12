/* SSO SMK Asajaya — teruskan kod log masuk sekali guna kepada sistem.
 *
 * Halaman di smkasajaya.my membungkus sistem Google Apps Script dalam <iframe>.
 * Bila Pusat SSO menghantar pengguna ke  https://smkasajaya.my/<halaman>?code=XXXX ,
 * skrip ini menyerahkan kod itu kepada sistem di dalam iframe, kemudian membuang
 * kod dari bar alamat. Tanpa ?code= skrip ini tidak berbuat apa-apa.
 *
 * Cara guna: letak  <script src="/sso-wrap.js"></script>  SELEPAS tag <iframe>.
 */
(function () {
  try {
    var m = /[?&]code=([A-Za-z0-9_-]{20,100})(?:&|$)/.exec(location.search);
    if (!m) return;
    var f = document.querySelector('iframe[src*="script.google.com/macros/"]');
    if (f) {
      var u = String(f.getAttribute('src')).split('#')[0];
      f.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 'code=' + m[1];
    }
    // Kod hanya sah sekali dan selama 90 saat; jangan biarkan ia kekal di bar alamat / penanda buku.
    var q = location.search.replace(/([?&])code=[^&]*(&|$)/, function (_, a, b) { return b ? a : ''; });
    history.replaceState(null, '', location.pathname + q + location.hash);
  } catch (e) { /* jangan ganggu halaman jika gagal */ }
})();
