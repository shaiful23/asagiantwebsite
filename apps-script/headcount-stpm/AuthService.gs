/* =========================================================================
 * AuthService.gs — MODUL 1: LOGIN & PENGGUNA
 * Login NoKP+PIN (selari dengan Sistem Kehadiran QR sedia ada), sesi disimpan
 * dalam CacheService (bukan Sheet), dan pengesahan kebenaran server-side
 * (rujuk MODUL 31: KESELAMATAN — jangan benarkan frontend sahaja menentukan akses).
 * ========================================================================= */

const HEADER_USERS = ['NoKP', 'PIN', 'Peranan', 'NamaPenuh', 'SkopSubjek', 'Status', 'SkopKelas'];
const PANJANG_MIN_KATA_LALUAN = 8;

/* Lajur PIN kini menyimpan KATA LALUAN dalam 3 bentuk:
     kosong          -> kata laluan LALAI = 6 digit akhir No. KP, WAJIB tukar selepas log masuk
     'sha256:<hex>'  -> kata laluan peribadi (dicincang, bukan teks biasa)
     teks lain       -> PIN lama sebelum kemaskini ini; masih diterima SEKALI, kemudian WAJIB tukar
   No. KP 12 digit yang bermula dengan 0 disimpan Sheets sebagai nombor (0 hadapan
   hilang), jadi No. KP sentiasa dibandingkan selepas dinormalkan ke 12 digit. */
function normalNoKP(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\D/g, '').padStart(12, '0');
}

function kataLaluanLalai(nokp) {
  return normalNoKP(nokp).slice(-6);
}

function cincangKataLaluan(nokp, kataLaluan) {
  const bait = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalNoKP(nokp) + ':' + kataLaluan, Utilities.Charset.UTF_8);
  return 'sha256:' + bait.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function semakKataLaluan(pengguna, kataLaluan) {
  const disimpan = String(pengguna.PIN === undefined || pengguna.PIN === null ? '' : pengguna.PIN).trim();
  if (!disimpan) return { sah: kataLaluan === kataLaluanLalai(pengguna.NoKP), perluTukar: true };
  if (disimpan.indexOf('sha256:') === 0) return { sah: cincangKataLaluan(pengguna.NoKP, kataLaluan) === disimpan, perluTukar: false };
  return { sah: kataLaluan === disimpan, perluTukar: true };
}

function cariPengguna(nokp) {
  const sasaran = normalNoKP(nokp);
  return bacaSheetSebagaiObjek(SHEET_USERS).find(u => normalNoKP(u.NoKP) === sasaran) || null;
}

function simpanSesi(token, sesi) {
  CacheService.getScriptCache().put('sesi_hcstpm_' + token, JSON.stringify(sesi), TEMPOH_SESI_SAAT);
}

function ciptaSesi(pengguna, perluTukarKataLaluan) {
  const token = Utilities.getUuid();
  simpanSesi(token, {
    nokp: pengguna.NoKP,
    nama: pengguna.NamaPenuh,
    peranan: pengguna.Peranan,
    skopSubjek: pengguna.SkopSubjek ? String(pengguna.SkopSubjek).split(',').map(s => s.trim()).filter(Boolean) : [],
    // SkopKelas: kelas yang diselia (peranan GURU_KELAS) — kekosongan huruf besar/kecil
    // diseragamkan ke huruf besar supaya padanan konsisten dengan Kelas pelajar.
    skopKelas: pengguna.SkopKelas ? String(pengguna.SkopKelas).split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [],
    perluTukarKataLaluan: !!perluTukarKataLaluan
  });
  return token;
}

function sahkanSesi(token) {
  if (!token) return null;
  const mentah = CacheService.getScriptCache().get('sesi_hcstpm_' + token);
  return mentah ? JSON.parse(mentah) : null;
}

/* Pulangkan sesi jika sah DAN peranan dibenarkan; jika tidak, pulangkan objek ralat.
   Semua fungsi API service lain WAJIB panggil ini dahulu — server ialah punca kebenaran.
   Sesi yang masih guna kata laluan lalai/lama disekat drpd SEMUA API sehingga kata
   laluan ditukar (apiTukarKataLaluan tidak melalui fungsi ini). */
function wajibPeranan(token, perananDibenarkan) {
  const sesi = sahkanSesi(token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  if (sesi.perluTukarKataLaluan) return ralat('Sila tukar kata laluan anda dahulu sebelum meneruskan.');
  if (perananDibenarkan && perananDibenarkan.length && perananDibenarkan.indexOf(sesi.peranan) === -1) {
    return ralat('Anda tidak mempunyai kebenaran untuk tindakan ini.');
  }
  return sesi;
}

function apiLogin(p) {
  const nokp = String(p.nokp || '').trim();
  const kataLaluan = String(p.pin || '').trim();
  if (!nokp || !kataLaluan) return ralat('Sila isi No. KP dan Kata Laluan.');

  const pengguna = cariPengguna(nokp);
  const semakan = pengguna ? semakKataLaluan(pengguna, kataLaluan) : { sah: false };
  if (!semakan.sah) return ralat('No. KP atau Kata Laluan tidak sah.');
  if (String(pengguna.Status).toUpperCase() !== 'AKTIF') return ralat('Akaun ini tidak aktif. Sila hubungi admin.');

  const token = ciptaSesi(pengguna, semakan.perluTukar);
  catatAudit({ nokp: pengguna.NoKP, nama: pengguna.NamaPenuh, peranan: pengguna.Peranan }, 'LOGIN', 'PENGGUNA', pengguna.NoKP, '', '',
    semakan.perluTukar ? 'Log masuk (kata laluan lalai/lama — wajib tukar)' : 'Log masuk berjaya');
  return jaya({
    token, nama: pengguna.NamaPenuh, peranan: pengguna.Peranan, skopSubjek: pengguna.SkopSubjek || '',
    skopKelas: pengguna.SkopKelas || '', perluTukarKataLaluan: semakan.perluTukar
  });
}

function apiSemakSesi(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  return jaya({
    nama: sesi.nama, peranan: sesi.peranan, skopSubjek: sesi.skopSubjek, skopKelas: sesi.skopKelas || [],
    perluTukarKataLaluan: !!sesi.perluTukarKataLaluan
  });
}

/* Tukar kata laluan sendiri. Semasa tukar WAJIB (kali pertama / kata laluan lama),
   kata laluan semasa sudah disahkan ketika log masuk, jadi tidak diminta lagi;
   tukar secara sukarela pula wajib sertakan kata laluan semasa. */
function apiTukarKataLaluan(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');

  const pengguna = cariPengguna(sesi.nokp);
  if (!pengguna) return ralat('Akaun tidak dijumpai.');

  const baru = String(p.kataLaluanBaru || '');
  if (!sesi.perluTukarKataLaluan && !semakKataLaluan(pengguna, String(p.kataLaluanSemasa || '')).sah) {
    return ralat('Kata laluan semasa tidak betul.');
  }
  if (baru.length < PANJANG_MIN_KATA_LALUAN) return ralat('Kata laluan baharu mesti sekurang-kurangnya ' + PANJANG_MIN_KATA_LALUAN + ' aksara.');
  if (!/[A-Za-z]/.test(baru) || !/\d/.test(baru)) return ralat('Kata laluan baharu mesti mengandungi huruf DAN nombor.');
  if (semakKataLaluan(pengguna, baru).sah) return ralat('Kata laluan baharu mesti berbeza daripada kata laluan semasa.');

  kemaskiniBaris(SHEET_USERS, pengguna.__row, Object.assign({}, pengguna, { PIN: cincangKataLaluan(pengguna.NoKP, baru) }), HEADER_USERS);
  sesi.perluTukarKataLaluan = false;
  simpanSesi(p.token, sesi);
  catatAudit(sesi, 'TUKAR_KATA_LALUAN', 'PENGGUNA', pengguna.NoKP, '', '', 'Kata laluan ditukar oleh pengguna sendiri');
  return jaya({});
}

function apiLogout(p) {
  const sesi = sahkanSesi(p.token);
  if (sesi) CacheService.getScriptCache().remove('sesi_hcstpm_' + p.token);
  return jaya({});
}

/* ------------------------- PENGURUSAN PENGGUNA (ADMIN sahaja) ------------------------- */
function apiSenaraiPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const statusKataLaluan = u => {
    const pin = String(u.PIN === undefined || u.PIN === null ? '' : u.PIN).trim();
    return !pin ? 'LALAI' : (pin.indexOf('sha256:') === 0 ? 'PERIBADI' : 'LAMA');
  };
  const senarai = bacaSheetSebagaiObjek(SHEET_USERS).map(u => ({
    nokp: u.NoKP, nama: u.NamaPenuh, peranan: u.Peranan, skopSubjek: u.SkopSubjek, skopKelas: u.SkopKelas, status: u.Status,
    kataLaluan: statusKataLaluan(u), __row: u.__row
  }));
  return jaya({ senarai });
}

/* Kata laluan TIDAK ditetapkan oleh admin: pengguna baharu bermula dengan kata
   laluan lalai (6 digit akhir No. KP) dan dipaksa tukar selepas log masuk pertama.
   Kata laluan sedia ada dikekalkan semasa kemaskini maklumat lain. */
function apiSimpanPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;

  const nokp = String(p.nokp || '').trim();
  const nama = String(p.nama || '').trim();
  const peranan = String(p.peranan || '').trim();
  if (!nokp || !nama || SEMUA_PERANAN.indexOf(peranan) === -1) return ralat('Data pengguna tidak lengkap/sah.');
  if (nokp.replace(/\D/g, '').length !== 12) return ralat('No. KP mesti 12 digit.');

  const sediaAda = cariPengguna(nokp);
  const objek = {
    NoKP: nokp,
    PIN: sediaAda ? sediaAda.PIN : '',
    Peranan: peranan,
    NamaPenuh: nama,
    SkopSubjek: String(p.skopSubjek || '').trim(),
    SkopKelas: String(p.skopKelas || '').trim(),
    Status: p.status ? String(p.status).trim() : 'AKTIF'
  };
  const tanpaPIN = o => JSON.stringify(Object.assign({}, o, { PIN: undefined, __row: undefined }));

  if (sediaAda) {
    kemaskiniBaris(SHEET_USERS, sediaAda.__row, objek, HEADER_USERS);
    catatAudit(sesi, 'KEMASKINI', 'PENGGUNA', nokp, tanpaPIN(sediaAda), tanpaPIN(objek), 'Kemaskini pengguna: ' + nama);
  } else {
    tambahBaris(SHEET_USERS, objek, HEADER_USERS);
    catatAudit(sesi, 'TAMBAH', 'PENGGUNA', nokp, '', tanpaPIN(objek), 'Tambah pengguna baharu: ' + nama);
  }
  return jaya({ baharu: !sediaAda });
}

/* Set semula kata laluan seorang pengguna kepada lalai (6 digit akhir No. KP) —
   pengguna akan dipaksa tukar semula selepas log masuk seterusnya. */
function apiResetKataLaluan(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;

  const pengguna = cariPengguna(p.nokp);
  if (!pengguna) return ralat('Pengguna tidak dijumpai.');
  kemaskiniBaris(SHEET_USERS, pengguna.__row, Object.assign({}, pengguna, { PIN: '' }), HEADER_USERS);
  catatAudit(sesi, 'RESET_KATA_LALUAN', 'PENGGUNA', pengguna.NoKP, '', '', 'Kata laluan diset semula ke lalai: ' + pengguna.NamaPenuh);
  return jaya({});
}
