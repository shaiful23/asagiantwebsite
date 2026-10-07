/* =========================================================================
 * AuthService.gs — Log masuk, sesi & tukar kata laluan.
 * Log masuk guna No. KP + kata laluan. Kata laluan lalai = 6 digit terakhir
 * No. KP; pengguna WAJIB tukar kata laluan selepas log masuk pertama
 * (atau selepas di-set semula oleh Admin). Kata laluan disimpan sebagai hash
 * SHA-256 bergaram No. KP. Sesi dalam CacheService; kebenaran SENTIASA
 * disahkan di pelayan, bukan sekadar disembunyikan di frontend.
 * ========================================================================= */

const HEADER_PENGGUNA = ['NoKP', 'Password', 'Peranan', 'NamaPenuh', 'KelasDijaga', 'MestiTukarPassword', 'Status', 'Emel', 'UnitDijaga', 'UnitKoko'];

/* Unit yang dipimpin pengguna sebagai KGP (manual Admin + daripada e-Kokurikulum), tanpa pendua. */
function unitPengguna(u) {
  const s = {};
  senaraiUnitDaripadaMedan(u.UnitDijaga).concat(senaraiUnitDaripadaMedan(u.UnitKoko)).forEach(k => { s[k] = true; });
  return Object.keys(s).sort();
}

/* Boleh mengisi aspek unit ini? Admin: semua; lain-lain: hanya KGP unit tersebut. */
function bolehIsiUnit(sesi, aspek, unit) {
  if (sesi.peranan === ROLE_ADMIN) return true;
  return !!unit && (sesi.unit || []).indexOf(kunciUnit(aspek, unit)) !== -1;
}

/* ------------------------- KATA LALUAN ------------------------- */
function cincangKataLaluan(nokp, kataLaluan) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'epajsk:' + normalKP(nokp) + ':' + String(kataLaluan));
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function kataLaluanLalaiDaripadaIC(nokp) {
  return normalKP(nokp).slice(-6);
}

/* ------------------------- SESI ------------------------- */
function ciptaSesi(pengguna) {
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('sesi_epajsk_' + token, JSON.stringify({
    nokp: normalKP(pengguna.NoKP), nama: pengguna.NamaPenuh, peranan: pengguna.Peranan
  }), TEMPOH_SESI_SAAT);
  return token;
}

function sahkanSesi(token) {
  if (!token) return null;
  const mentah = CacheService.getScriptCache().get('sesi_epajsk_' + token);
  return mentah ? JSON.parse(mentah) : null;
}

/* Pulangkan sesi jika sah DAN peranan dibenarkan; jika tidak, objek ralat.
   Semua api*() WAJIB panggil ini dahulu. Peranan & status dibaca semula daripada
   Sheet supaya perubahan oleh Admin (nyahaktif / tukar peranan) berkuat kuasa serta-merta. */
function wajibPeranan(token, perananDibenarkan) {
  const sesi = sahkanSesi(token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  pastikanStrukturTerkini();
  const pengguna = bacaSheetSebagaiObjek(SHEET_PENGGUNA).find(u => normalKP(u.NoKP) === sesi.nokp);
  if (!pengguna || String(pengguna.Status).toUpperCase() !== 'AKTIF') return ralat('Akaun tidak aktif. Sila hubungi admin.');
  sesi.peranan = pengguna.Peranan;
  sesi.nama = pengguna.NamaPenuh;
  sesi.kelas = senaraiDaripadaMedan(pengguna.KelasDijaga);
  sesi.unit = unitPengguna(pengguna);
  if (perananDibenarkan && perananDibenarkan.length && perananDibenarkan.indexOf(sesi.peranan) === -1) {
    return ralat('Anda tidak mempunyai kebenaran untuk tindakan ini.');
  }
  return sesi;
}

/* ADMIN boleh semua kelas; GURU_KELAS hanya kelas yang ditetapkan kepadanya. */
function wajibAksesKelas(sesi, kunciKelas) {
  if (sesi.peranan === ROLE_ADMIN) return true;
  return (sesi.kelas || []).indexOf(String(kunciKelas || '')) !== -1;
}

/* ------------------------- LOG MASUK / KELUAR ------------------------- */
function apiLogin(p) {
  const nokp = normalKP(p.nokp);
  const kataLaluan = String(p.kataLaluan || '');
  if (!nokp || !kataLaluan) return ralat('Sila isi No. KP dan kata laluan.');

  const cache = CacheService.getScriptCache();
  const kunciGagal = 'gagal_epajsk_' + nokp;
  const bilGagal = Number(cache.get(kunciGagal)) || 0;
  if (bilGagal >= HAD_GAGAL_LOGIN) return ralat('Terlalu banyak cubaan gagal. Sila cuba semula selepas 10 minit.');

  const pengguna = bacaSheetSebagaiObjek(SHEET_PENGGUNA).find(u => normalKP(u.NoKP) === nokp);
  if (!pengguna || String(pengguna.Password) !== cincangKataLaluan(nokp, kataLaluan)) {
    cache.put(kunciGagal, String(bilGagal + 1), TEMPOH_KUNCI_LOGIN_SAAT);
    return ralat('No. KP atau kata laluan tidak sah.');
  }
  if (String(pengguna.Status).toUpperCase() !== 'AKTIF') return ralat('Akaun ini tidak aktif. Sila hubungi admin.');
  cache.remove(kunciGagal);

  const token = ciptaSesi(pengguna);
  catatAudit({ nokp, nama: pengguna.NamaPenuh, peranan: pengguna.Peranan }, 'LOGIN', 'PENGGUNA', nokp, 'Log masuk berjaya');
  return jaya({
    token,
    nama: pengguna.NamaPenuh,
    peranan: pengguna.Peranan,
    kelas: senaraiDaripadaMedan(pengguna.KelasDijaga),
    unit: unitPengguna(pengguna),
    mestiTukarPassword: String(pengguna.MestiTukarPassword).toUpperCase() === 'YA'
  });
}

function apiSemakSesi(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const pengguna = bacaSheetSebagaiObjek(SHEET_PENGGUNA).find(u => normalKP(u.NoKP) === sesi.nokp);
  return jaya({
    nama: sesi.nama, peranan: sesi.peranan, kelas: sesi.kelas,
    mestiTukarPassword: String(pengguna.MestiTukarPassword).toUpperCase() === 'YA'
  });
}

function apiLogout(p) {
  if (p && p.token) CacheService.getScriptCache().remove('sesi_epajsk_' + p.token);
  return jaya({});
}

/* ------------------------- TUKAR KATA LALUAN SENDIRI ------------------------- */
function apiTukarPasswordSendiri(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const baharu = String(p.kataLaluanBaharu || '');
  const lama = String(p.kataLaluanLama || '');
  if (baharu.length < 6) return ralat('Kata laluan baharu mesti sekurang-kurangnya 6 aksara.');
  if (baharu === kataLaluanLalaiDaripadaIC(sesi.nokp)) return ralat('Kata laluan baharu tidak boleh sama dengan kata laluan lalai (6 digit terakhir No. KP).');
  if (baharu === lama) return ralat('Kata laluan baharu mesti berbeza daripada kata laluan semasa.');

  return denganKunci(() => {
    const pengguna = bacaSheetSebagaiObjek(SHEET_PENGGUNA).find(u => normalKP(u.NoKP) === sesi.nokp);
    if (!pengguna) return ralat('Akaun tidak dijumpai.');
    if (String(pengguna.Password) !== cincangKataLaluan(sesi.nokp, lama)) return ralat('Kata laluan semasa tidak sah.');
    pengguna.Password = cincangKataLaluan(sesi.nokp, baharu);
    pengguna.MestiTukarPassword = 'TIDAK';
    kemaskiniBaris(SHEET_PENGGUNA, pengguna.__row, pengguna);
    catatAudit(sesi, 'TUKAR_PASSWORD', 'PENGGUNA', sesi.nokp, 'Tukar kata laluan sendiri');
    return jaya({});
  });
}
