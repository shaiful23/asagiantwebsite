/* =========================================================================
 * AuthService.gs — MODUL 1: LOGIN & PENGGUNA
 * Login NoKP+PIN (selari dengan Sistem Kehadiran QR sedia ada), sesi disimpan
 * dalam CacheService (bukan Sheet), dan pengesahan kebenaran server-side
 * (rujuk MODUL 31: KESELAMATAN — jangan benarkan frontend sahaja menentukan akses).
 * ========================================================================= */

const HEADER_USERS = ['NoKP', 'PIN', 'Peranan', 'NamaPenuh', 'SkopSubjek', 'Status'];

function ciptaSesi(pengguna) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sesi_hcstpm_' + token, JSON.stringify({
    nokp: pengguna.NoKP,
    nama: pengguna.NamaPenuh,
    peranan: pengguna.Peranan,
    skopSubjek: pengguna.SkopSubjek ? String(pengguna.SkopSubjek).split(',').map(s => s.trim()).filter(Boolean) : []
  }), TEMPOH_SESI_SAAT);
  return token;
}

function sahkanSesi(token) {
  if (!token) return null;
  const mentah = CacheService.getScriptCache().get('sesi_hcstpm_' + token);
  return mentah ? JSON.parse(mentah) : null;
}

/* Pulangkan sesi jika sah DAN peranan dibenarkan; jika tidak, pulangkan objek ralat.
   Semua fungsi API service lain WAJIB panggil ini dahulu — server ialah punca kebenaran. */
function wajibPeranan(token, perananDibenarkan) {
  const sesi = sahkanSesi(token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  if (perananDibenarkan && perananDibenarkan.length && perananDibenarkan.indexOf(sesi.peranan) === -1) {
    return ralat('Anda tidak mempunyai kebenaran untuk tindakan ini.');
  }
  return sesi;
}

function apiLogin(p) {
  const nokp = String(p.nokp || '').trim();
  const pin = String(p.pin || '').trim();
  if (!nokp || !pin) return ralat('Sila isi No. KP dan PIN.');

  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS)
    .find(u => String(u.NoKP).trim() === nokp && String(u.PIN).trim() === pin);
  if (!pengguna) return ralat('No. KP atau PIN tidak sah.');
  if (String(pengguna.Status).toUpperCase() !== 'AKTIF') return ralat('Akaun ini tidak aktif. Sila hubungi admin.');

  const token = ciptaSesi(pengguna);
  catatAudit({ nokp: pengguna.NoKP, nama: pengguna.NamaPenuh, peranan: pengguna.Peranan }, 'LOGIN', 'PENGGUNA', pengguna.NoKP, '', '', 'Log masuk berjaya');
  return jaya({ token, nama: pengguna.NamaPenuh, peranan: pengguna.Peranan, skopSubjek: pengguna.SkopSubjek || '' });
}

function apiSemakSesi(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  return jaya({ nama: sesi.nama, peranan: sesi.peranan, skopSubjek: sesi.skopSubjek });
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
  const senarai = bacaSheetSebagaiObjek(SHEET_USERS).map(u => ({
    nokp: u.NoKP, nama: u.NamaPenuh, peranan: u.Peranan, skopSubjek: u.SkopSubjek, status: u.Status, __row: u.__row
  }));
  return jaya({ senarai });
}

function apiSimpanPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;

  const nokp = String(p.nokp || '').trim();
  const nama = String(p.nama || '').trim();
  const peranan = String(p.peranan || '').trim();
  if (!nokp || !nama || SEMUA_PERANAN.indexOf(peranan) === -1) return ralat('Data pengguna tidak lengkap/sah.');

  const sediaAda = cariBarisMengikutId(SHEET_USERS, 'NoKP', nokp);
  const objek = {
    NoKP: nokp,
    PIN: p.pin ? String(p.pin).trim() : (sediaAda ? sediaAda.PIN : '123456'),
    Peranan: peranan,
    NamaPenuh: nama,
    SkopSubjek: String(p.skopSubjek || '').trim(),
    Status: p.status ? String(p.status).trim() : 'AKTIF'
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_USERS, sediaAda.__row, objek, HEADER_USERS);
    catatAudit(sesi, 'KEMASKINI', 'PENGGUNA', nokp, JSON.stringify(sediaAda), JSON.stringify(objek), 'Kemaskini pengguna: ' + nama);
  } else {
    tambahBaris(SHEET_USERS, objek, HEADER_USERS);
    catatAudit(sesi, 'TAMBAH', 'PENGGUNA', nokp, '', JSON.stringify(objek), 'Tambah pengguna baharu: ' + nama);
  }
  return jaya({});
}
