/* =========================================================================
 * UserService.gs — Pengurusan Pengguna (ADMIN & KETUA_BIDANG sahaja).
 * Kata laluan lalai = 6 digit terakhir No. KP; pengguna baharu & pengguna
 * yang di-set semula kata laluan WAJIB tukar kata laluan semasa log masuk
 * seterusnya (MestiTukarPassword = YA).
 * ========================================================================= */

function apiSenaraiPengguna(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const senarai = bacaSheetSebagaiObjek(SHEET_USERS).map(u => ({
    nokp: u.NoKP, nama: u.NamaPenuh, peranan: u.Peranan, panitia: u.Panitia, emel: u.Emel || '',
    mestiTukarPassword: u.MestiTukarPassword, status: u.Status, __row: u.__row
  }));
  return jaya({ senarai });
}

/* Senarai ahli satu panitia (guru + ketua panitia) — boleh diakses semua peranan
   yang sah, tetapi KETUA_PANITIA/GURU hanya boleh minta panitia sendiri. */
function apiSenaraiAhliPanitia(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_USERS)
    .filter(u => String(u.Panitia) === String(p.panitia) && String(u.Status).toUpperCase() === 'AKTIF')
    .map(u => ({ nokp: u.NoKP, nama: u.NamaPenuh, peranan: u.Peranan }));
  return jaya({ senarai });
}

function apiSimpanPengguna(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const nokp = String(p.nokp || '').trim();
  const nama = String(p.nama || '').trim();
  const peranan = String(p.peranan || '').trim();
  const panitia = String(p.panitia || '').trim();
  const emel = String(p.emel || '').trim();
  if (!nokp || !nama || SEMUA_PERANAN.indexOf(peranan) === -1) return ralat('Data pengguna tidak lengkap/sah.');
  if ((peranan === ROLE_KETUA_PANITIA || peranan === ROLE_GURU) && SENARAI_PANITIA.indexOf(panitia) === -1) {
    return ralat('Sila pilih Panitia yang sah bagi peranan ' + peranan + '.');
  }
  if (emel && emel.indexOf('@') === -1) return ralat('Format e-mel tidak sah.');

  const sediaAda = cariBarisMengikutId(SHEET_USERS, 'NoKP', nokp);
  const objek = {
    NoKP: nokp,
    Password: sediaAda ? sediaAda.Password : cincangKataLaluan(kataLaluanLalaiDaripadaIC(nokp)),
    Peranan: peranan,
    NamaPenuh: nama,
    Panitia: (peranan === ROLE_KETUA_PANITIA || peranan === ROLE_GURU) ? panitia : '',
    MestiTukarPassword: sediaAda ? sediaAda.MestiTukarPassword : 'YA',
    Status: sediaAda ? sediaAda.Status : 'AKTIF',
    Emel: emel
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_USERS, sediaAda.__row, objek, HEADER_USERS);
    catatAudit(sesi, 'KEMASKINI', 'PENGGUNA', nokp, 'Kemaskini pengguna: ' + nama);
  } else {
    tambahBaris(SHEET_USERS, objek, HEADER_USERS);
    catatAudit(sesi, 'TAMBAH', 'PENGGUNA', nokp, 'Tambah pengguna baharu: ' + nama + ' (' + peranan + ')');
  }
  return jaya({});
}

function apiTetapSemulaPasswordPengguna(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const pengguna = cariBarisMengikutId(SHEET_USERS, 'NoKP', String(p.nokp || '').trim());
  if (!pengguna) return ralat('Pengguna tidak dijumpai.');

  pengguna.Password = cincangKataLaluan(kataLaluanLalaiDaripadaIC(pengguna.NoKP));
  pengguna.MestiTukarPassword = 'YA';
  kemaskiniBaris(SHEET_USERS, pengguna.__row, pengguna, HEADER_USERS);
  catatAudit(sesi, 'SET_SEMULA_PASSWORD', 'PENGGUNA', pengguna.NoKP, 'Set semula kata laluan kepada nilai lalai');
  return jaya({});
}

function apiTukarStatusPengguna(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const pengguna = cariBarisMengikutId(SHEET_USERS, 'NoKP', String(p.nokp || '').trim());
  if (!pengguna) return ralat('Pengguna tidak dijumpai.');
  if (pengguna.NoKP === sesi.nokp) return ralat('Anda tidak boleh menyahaktifkan akaun sendiri.');

  pengguna.Status = String(pengguna.Status).toUpperCase() === 'AKTIF' ? 'TIDAK_AKTIF' : 'AKTIF';
  kemaskiniBaris(SHEET_USERS, pengguna.__row, pengguna, HEADER_USERS);
  catatAudit(sesi, 'TUKAR_STATUS', 'PENGGUNA', pengguna.NoKP, 'Status ditukar kepada ' + pengguna.Status);
  return jaya({ status: pengguna.Status });
}
