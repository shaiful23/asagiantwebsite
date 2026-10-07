/* =========================================================================
 * AuthService.gs — Log masuk, sesi & tukar kata laluan (Portal Guru & Murid).
 * - Log masuk guna No. KP + kata laluan. Kata laluan lalai = 6 digit terakhir
 *   No. KP. Medan Password KOSONG dalam Sheet bermaksud "kata laluan lalai"
 *   (import pukal ribuan murid tidak perlu mengira hash satu per satu).
 * - Pengguna WAJIB tukar kata laluan selepas log masuk pertama / reset.
 * - Kata laluan disimpan sebagai hash SHA-256 bergaram No. KP.
 * - Sesi dalam CacheService; kebenaran SENTIASA disahkan di pelayan.
 * ========================================================================= */

/* ------------------------- KATA LALUAN ------------------------- */
function cincangKataLaluan(nokp, kataLaluan) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'rumahsukan:' + normalKP(nokp) + ':' + String(kataLaluan));
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function kataLaluanLalaiDaripadaIC(nokp) {
  return normalKP(nokp).slice(-6);
}

function kataLaluanSah(rekod, kataLaluan) {
  const simpan = String(rekod.Password || '');
  if (!simpan) return String(kataLaluan) === kataLaluanLalaiDaripadaIC(rekod.NoKP);
  return simpan === cincangKataLaluan(rekod.NoKP, kataLaluan);
}

function sheetBagiJenis(jenis) { return jenis === JENIS_MURID ? SHEET_MURID : SHEET_STAF; }

function cariAkaun(jenis, nokp) {
  return bacaSheetSebagaiObjek(sheetBagiJenis(jenis)).find(u => normalKP(u.NoKP) === nokp) || null;
}

function aktif(rekod) { return String(rekod.Status || 'AKTIF').toUpperCase() === 'AKTIF'; }
function ya(nilai) { return String(nilai || '').toUpperCase() === 'YA'; }

/* ------------------------- SESI ------------------------- */
function ciptaSesi(jenis, rekod) {
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(PREFIKS_CACHE + 'sesi_' + token, JSON.stringify({
    nokp: normalKP(rekod.NoKP), jenis
  }), TEMPOH_SESI_SAAT);
  return token;
}

/* Sahkan token dan baca semula rekod pengguna daripada Sheet (perubahan admin berkuat kuasa serta-merta).
   pilihan: { jenis: 'STAF'|'MURID', admin: true } */
function wajibSesi(token, pilihan) {
  const opsyen = pilihan || {};
  if (!token) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  const mentah = CacheService.getScriptCache().get(PREFIKS_CACHE + 'sesi_' + token);
  if (!mentah) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  const asas = JSON.parse(mentah);
  const rekod = cariAkaun(asas.jenis, asas.nokp);
  if (!rekod || !aktif(rekod)) return ralat('Akaun tidak aktif. Sila hubungi admin.');
  const sesi = {
    nokp: asas.nokp, jenis: asas.jenis, nama: rekod.NamaPenuh, rekod,
    admin: asas.jenis === JENIS_STAF && ya(rekod.Admin)
  };
  sesi.peranan = sesi.jenis === JENIS_MURID ? 'MURID' : (sesi.admin ? 'ADMIN' : (rekod.Kategori || 'GURU'));
  if (opsyen.jenis && opsyen.jenis !== sesi.jenis) return ralat('Anda tidak mempunyai kebenaran untuk tindakan ini.');
  if (opsyen.admin && !sesi.admin) return ralat('Fungsi ini untuk Admin sahaja.');
  return sesi;
}

function wajibAdmin(token) { return wajibSesi(token, { jenis: JENIS_STAF, admin: true }); }
function wajibStaf(token) { return wajibSesi(token, { jenis: JENIS_STAF }); }

/* ------------------------- LOG MASUK / KELUAR ------------------------- */
function apiLogin(p) {
  const nokp = normalKP(p.nokp);
  const kataLaluan = String(p.kataLaluan || '');
  const jenis = p.portal === JENIS_MURID ? JENIS_MURID : JENIS_STAF;
  if (!nokp || !kataLaluan) return ralat('Sila isi No. KP dan kata laluan.');

  const cache = CacheService.getScriptCache();
  const kunciGagal = PREFIKS_CACHE + 'gagal_' + nokp;
  const bilGagal = Number(cache.get(kunciGagal)) || 0;
  if (bilGagal >= HAD_GAGAL_LOGIN) return ralat('Terlalu banyak cubaan gagal. Sila cuba semula selepas 10 minit.');

  const rekod = cariAkaun(jenis, nokp);
  if (!rekod || !kataLaluanSah(rekod, kataLaluan)) {
    cache.put(kunciGagal, String(bilGagal + 1), TEMPOH_KUNCI_LOGIN_SAAT);
    // petunjuk "salah portal" hanya jika kata laluan betul bagi akaun portal satu lagi (tidak mendedahkan No. KP)
    const lain = !rekod && cariAkaun(jenis === JENIS_MURID ? JENIS_STAF : JENIS_MURID, nokp);
    if (lain && kataLaluanSah(lain, kataLaluan)) return ralat('No. KP ini didaftarkan dalam ' + (jenis === JENIS_MURID ? 'Portal Guru & Staf' : 'Portal Murid') + '. Sila tukar portal.');
    return ralat('No. KP atau kata laluan tidak sah.');
  }
  if (!aktif(rekod)) return ralat('Akaun ini tidak aktif. Sila hubungi admin.');
  cache.remove(kunciGagal);

  const token = ciptaSesi(jenis, rekod);
  const sesi = wajibSesi(token);
  catatAudit(sesi, 'LOGIN', jenis, nokp, 'Log masuk berjaya');
  return jaya(Object.assign({ token }, profilSesi(sesi)));
}

function profilSesi(sesi) {
  return {
    nama: sesi.nama, jenis: sesi.jenis, admin: sesi.admin, peranan: sesi.peranan,
    mestiTukarPassword: ya(sesi.rekod.MestiTukarPassword) || !String(sesi.rekod.Password || '')
  };
}

function apiSemakSesi(p) {
  const sesi = wajibSesi(p.token);
  if (sesi.success === false) return sesi;
  return jaya(profilSesi(sesi));
}

function apiLogout(p) {
  if (p && p.token) CacheService.getScriptCache().remove(PREFIKS_CACHE + 'sesi_' + p.token);
  return jaya({});
}

/* ------------------------- TUKAR KATA LALUAN SENDIRI ------------------------- */
function apiTukarPasswordSendiri(p) {
  const sesi = wajibSesi(p.token);
  if (sesi.success === false) return sesi;

  const baharu = String(p.kataLaluanBaharu || '');
  const lama = String(p.kataLaluanLama || '');
  if (baharu.length < 6) return ralat('Kata laluan baharu mesti sekurang-kurangnya 6 aksara.');
  if (baharu === kataLaluanLalaiDaripadaIC(sesi.nokp)) return ralat('Kata laluan baharu tidak boleh sama dengan kata laluan lalai (6 digit terakhir No. KP).');
  if (baharu === lama) return ralat('Kata laluan baharu mesti berbeza daripada kata laluan semasa.');

  return denganKunci(() => {
    const namaSheet = sheetBagiJenis(sesi.jenis);
    const rekod = cariAkaun(sesi.jenis, sesi.nokp);
    if (!rekod) return ralat('Akaun tidak dijumpai.');
    if (!kataLaluanSah(rekod, lama)) return ralat('Kata laluan semasa tidak sah.');
    rekod.Password = cincangKataLaluan(sesi.nokp, baharu);
    rekod.MestiTukarPassword = 'TIDAK';
    kemaskiniBaris(namaSheet, rekod.__row, rekod);
    catatAudit(sesi, 'TUKAR_PASSWORD', sesi.jenis, sesi.nokp, 'Tukar kata laluan sendiri');
    return jaya({});
  });
}

/* ------------------------- RESET KATA LALUAN (ADMIN) ------------------------- */
function apiResetPassword(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const jenis = p.jenis === JENIS_MURID ? JENIS_MURID : JENIS_STAF;
  const nokp = normalKP(p.nokp);
  return denganKunci(() => {
    const rekod = cariAkaun(jenis, nokp);
    if (!rekod) return ralat('Akaun tidak dijumpai.');
    rekod.Password = '';
    rekod.MestiTukarPassword = 'YA';
    kemaskiniBaris(sheetBagiJenis(jenis), rekod.__row, rekod);
    CacheService.getScriptCache().remove(PREFIKS_CACHE + 'gagal_' + nokp);
    catatAudit(sesi, 'RESET_PASSWORD', jenis, nokp, 'Reset kata laluan kepada lalai');
    return jaya({ mesej: 'Kata laluan ' + rekod.NamaPenuh + ' di-set semula kepada 6 digit terakhir No. KP.' });
  });
}
