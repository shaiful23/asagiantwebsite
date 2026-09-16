/* =========================================================================
 * AuthService.gs — Log masuk, sesi & tukar kata laluan sendiri.
 * Log masuk guna No. KP + kata laluan (lalai = 6 digit terakhir No. KP).
 * Sesi disimpan dalam CacheService (bukan Sheet); pengesahan kebenaran
 * sentiasa di server — jangan benarkan frontend sahaja menentukan akses.
 * ========================================================================= */

const HEADER_USERS = ['NoKP', 'Password', 'Peranan', 'NamaPenuh', 'Panitia', 'MestiTukarPassword', 'Status', 'Emel'];

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
    panitia: pengguna.Panitia || ''
  }), TEMPOH_SESI_SAAT);
  return token;
}

function sahkanSesi(token) {
  if (!token) return null;
  const mentah = CacheService.getScriptCache().get('sesi_ebidang_' + token);
  return mentah ? JSON.parse(mentah) : null;
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

/* Sekat akses kepada data panitia sendiri sahaja bagi KETUA_PANITIA/GURU.
   ADMIN & KETUA_BIDANG boleh akses semua panitia. */
function wajibAksesPanitia(sesi, panitia) {
  if (PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1) return true;
  return String(sesi.panitia || '') === String(panitia || '');
}

/* ------------------------- LOG MASUK / LOG KELUAR ------------------------- */
function apiLogin(p) {
  const nokp = String(p.nokp || '').trim();
  const kataLaluan = String(p.kataLaluan || '').trim();
  if (!nokp || !kataLaluan) return ralat('Sila isi No. KP dan kata laluan.');

  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS).find(u => String(u.NoKP).trim() === nokp);
  if (!pengguna || pengguna.Password !== cincangKataLaluan(kataLaluan)) return ralat('No. KP atau kata laluan tidak sah.');
  if (String(pengguna.Status).toUpperCase() !== 'AKTIF') return ralat('Akaun ini tidak aktif. Sila hubungi admin.');

  const token = ciptaSesi(pengguna);
  catatAudit({ nokp: pengguna.NoKP, nama: pengguna.NamaPenuh, peranan: pengguna.Peranan }, 'LOGIN', 'PENGGUNA', pengguna.NoKP, 'Log masuk berjaya');
  return jaya({
    token,
    nama: pengguna.NamaPenuh,
    peranan: pengguna.Peranan,
    panitia: pengguna.Panitia || '',
    mestiTukarPassword: String(pengguna.MestiTukarPassword).toUpperCase() === 'YA'
  });
}

function apiSemakSesi(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  return jaya({ nama: sesi.nama, peranan: sesi.peranan, panitia: sesi.panitia });
}

function apiLogout(p) {
  const sesi = sahkanSesi(p.token);
  if (sesi) CacheService.getScriptCache().remove('sesi_ebidang_' + p.token);
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
