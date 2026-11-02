/* =========================================================================
 * AuthService.gs — Log masuk, sesi & tukar kata laluan sendiri.
 * Log masuk guna No. KP + kata laluan (lalai = 6 digit terakhir No. KP).
 * Sesi disimpan dalam CacheService (bukan Sheet); pengesahan kebenaran
 * sentiasa di server — jangan benarkan frontend sahaja menentukan akses.
 * ========================================================================= */

const HEADER_USERS = ['NoKP', 'Password', 'Peranan', 'NamaPenuh', 'Panitia', 'MestiTukarPassword', 'Status', 'Emel', 'MakmalDijaga',
  'GambarProfilUrl', 'GambarProfilFailId', 'Jawatan', 'NoTelefon', 'KelayakanAkademik', 'OpsyenPengkhususan', 'GredJawatan',
  'KelasDiajar', 'TahunMulaSubjekSemasa'];

/* ------------------------- KATA LALUAN ------------------------- */
function cincangKataLaluan(kataLaluan) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(kataLaluan));
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function kataLaluanLalaiDaripadaIC(nokp) {
  const digitSahaja = String(nokp || '').replace(/\D/g, '');
  return digitSahaja.slice(-6);
}

/* ------------------------- SESI ------------------------- */
function ciptaSesi(pengguna) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sesi_ebidang_' + token, JSON.stringify({
    nokp: pengguna.NoKP,
    nama: pengguna.NamaPenuh,
    peranan: pengguna.Peranan,
    panitia: senaraiPanitiaDaripadaMedan(pengguna.Panitia),
    makmal: senaraiDaripadaMedan(pengguna.MakmalDijaga),
    t: Date.now()
  }), TEMPOH_SESI_SAAT);
  return token;
}

/* Sesi gelangsar: setiap kali digunakan (paling kerap sekali setiap 10 minit),
   tempoh sesi dilanjutkan semula — guru aktif tidak terkeluar di tengah kerja. */
const MEMO_SESI = {};
function sahkanSesi(token) {
  if (!token) return null;
  if (MEMO_SESI[token]) return MEMO_SESI[token];
  const cache = CacheService.getScriptCache();
  const mentah = cache.get('sesi_ebidang_' + token);
  if (!mentah) return null;
  const sesi = JSON.parse(mentah);
  if (!sesi.t || Date.now() - sesi.t > 10 * 60 * 1000) {
    sesi.t = Date.now();
    try { cache.put('sesi_ebidang_' + token, JSON.stringify(sesi), TEMPOH_SESI_SAAT); } catch (e) { /* abaikan */ }
  }
  MEMO_SESI[token] = sesi;
  return sesi;
}

/* Pulangkan sesi jika sah DAN peranan dibenarkan; jika tidak, pulangkan objek ralat.
   Semua fungsi api*() service lain WAJIB panggil ini dahulu — server ialah punca kebenaran. */
function wajibPeranan(token, perananDibenarkan) {
  const sesi = sahkanSesi(token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  if (perananDibenarkan && perananDibenarkan.length && perananDibenarkan.indexOf(sesi.peranan) === -1) {
    return ralat('Anda tidak mempunyai kebenaran untuk tindakan ini.');
  }
  return sesi;
}

/* Sekat akses kepada panitia sendiri sahaja bagi KETUA_PANITIA/GURU (sesi.panitia
   ialah SENARAI — guru boleh mengajar > 1 mata pelajaran/panitia, cth. ['Kimia','Sains']).
   ADMIN & KETUA_BIDANG boleh akses semua panitia. */
function wajibAksesPanitia(sesi, panitia) {
  if (PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1) return true;
  return (sesi.panitia || []).indexOf(String(panitia || '')) !== -1;
}

/* Akses LIHAT sahaja: skop Bidang (SKOP_BIDANG) boleh dilihat semua guru bidang,
   tetapi hanya Admin/Ketua Bidang boleh mengurusnya (melalui wajibAksesPanitia). */
function bolehLihatPanitia(sesi, panitia) {
  if (String(panitia) === SKOP_BIDANG) {
    return PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1 || (sesi.panitia || []).length > 0;
  }
  return wajibAksesPanitia(sesi, panitia);
}

/* ------------------------- LOG MASUK / LOG KELUAR ------------------------- */
function apiLogin(p) {
  const nokp = String(p.nokp || '').trim();
  const kataLaluan = String(p.kataLaluan || '').trim();
  if (!nokp || !kataLaluan) return ralat('Sila isi No. KP dan kata laluan.');

  /* Had cubaan: selepas HAD_CUBAAN_LOGIN kali gagal, No. KP dikunci 10 minit. */
  const cache = CacheService.getScriptCache();
  const kunciGagal = 'gagal_ebidang_' + nokp.replace(/\D/g, '');
  const bilGagal = Number(cache.get(kunciGagal) || 0);
  if (bilGagal >= HAD_CUBAAN_LOGIN) {
    return ralat('Terlalu banyak cubaan log masuk gagal. Akaun dikunci sementara — cuba lagi selepas 10 minit.');
  }

  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS).find(u => samaId(String(u.NoKP).trim(), nokp));
  if (!pengguna || pengguna.Password !== cincangKataLaluan(kataLaluan)) {
    const bil = bilGagal + 1;
    cache.put(kunciGagal, String(bil), TEMPOH_KUNCI_LOGIN_SAAT);
    if (bil >= HAD_CUBAAN_LOGIN) {
      try { catatAudit({ nokp, nama: '-', peranan: '-' }, 'LOGIN_DIKUNCI', 'PENGGUNA', nokp, bil + ' cubaan log masuk gagal'); } catch (e) { /* abaikan */ }
      return ralat('Terlalu banyak cubaan log masuk gagal. Akaun dikunci sementara — cuba lagi selepas 10 minit.');
    }
    const baki = HAD_CUBAAN_LOGIN - bil;
    return ralat('No. KP atau kata laluan tidak sah.' + (baki <= 2 ? ' Baki ' + baki + ' cubaan sebelum dikunci.' : ''));
  }
  if (String(pengguna.Status).toUpperCase() !== 'AKTIF') return ralat('Akaun ini tidak aktif. Sila hubungi admin.');
  cache.remove(kunciGagal);

  const token = ciptaSesi(pengguna);
  catatAudit({ nokp: pengguna.NoKP, nama: pengguna.NamaPenuh, peranan: pengguna.Peranan }, 'LOGIN', 'PENGGUNA', pengguna.NoKP, 'Log masuk berjaya');
  return jaya({
    token,
    nokp: String(pengguna.NoKP),
    nama: pengguna.NamaPenuh,
    peranan: pengguna.Peranan,
    panitia: senaraiPanitiaDaripadaMedan(pengguna.Panitia),
    makmal: senaraiDaripadaMedan(pengguna.MakmalDijaga),
    mestiTukarPassword: String(pengguna.MestiTukarPassword).toUpperCase() === 'YA'
  });
}

function apiSemakSesi(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  return jaya({ nokp: String(sesi.nokp), nama: sesi.nama, peranan: sesi.peranan, panitia: sesi.panitia, makmal: sesi.makmal });
}

function apiLogout(p) {
  const sesi = sahkanSesi(p.token);
  if (sesi) CacheService.getScriptCache().remove('sesi_ebidang_' + p.token);
  delete MEMO_SESI[p.token];
  return jaya({});
}

/* ------------------------- TUKAR KATA LALUAN SENDIRI ------------------------- */
function apiTukarPasswordSendiri(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');

  const kataLaluanBaharu = String(p.kataLaluanBaharu || '').trim();
  const kataLaluanLama = String(p.kataLaluanLama || '').trim();
  if (kataLaluanBaharu.length < 6) return ralat('Kata laluan baharu mesti sekurang-kurangnya 6 aksara.');

  const pengguna = cariBarisMengikutId(SHEET_USERS, 'NoKP', sesi.nokp);
  if (!pengguna) return ralat('Akaun tidak dijumpai.');
  if (pengguna.Password !== cincangKataLaluan(kataLaluanLama)) return ralat('Kata laluan semasa tidak sah.');

  pengguna.Password = cincangKataLaluan(kataLaluanBaharu);
  pengguna.MestiTukarPassword = 'TIDAK';
  kemaskiniBaris(SHEET_USERS, pengguna.__row, pengguna, HEADER_USERS);
  catatAudit(sesi, 'TUKAR_PASSWORD', 'PENGGUNA', sesi.nokp, 'Tukar kata laluan sendiri');
  return jaya({});
}

/* ------------------------- BACAAN PANTAS ("SAMA") -------------------------
   Klien menyimpan hasil bacaan terakhir (localStorage) bersama cincangannya.
   Panggilan ini menjalankan fungsi bacaan berkenaan dan, jika hasilnya sama
   dengan cincangan klien, pulangkan { sama: true } sahaja — klien terus guna
   data simpanannya tanpa memuat turun semula (lebih pantas di rangkaian perlahan). */
const CORAK_BACAAN_PANTAS = /^api(Senarai|Checklist|Dashboard|Carta|Kalendar|Profil|Tetapan)[A-Za-z]*$/;

function apiBacaPantas(p) {
  const nama = String((p && p.fn) || '');
  if (!CORAK_BACAAN_PANTAS.test(nama) || typeof globalThis[nama] !== 'function') return ralat('Fungsi bacaan tidak sah.');
  const param = Object.assign({}, (p && p.param) || {}, { token: p.token });
  const hasil = globalThis[nama](param);
  if (!hasil || hasil.success === false) return hasil;
  const cincang = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(hasil)));
  if (p.hash && p.hash === cincang) return jaya({ sama: true, __hash: cincang });
  hasil.__hash = cincang;
  return hasil;
}
