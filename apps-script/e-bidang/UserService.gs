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
    nokp: u.NoKP, nama: u.NamaPenuh, peranan: u.Peranan, panitia: u.Panitia,
    panitiaSenarai: senaraiPanitiaDaripadaMedan(u.Panitia), emel: u.Emel || '',
    makmal: u.MakmalDijaga || '', makmalSenarai: senaraiDaripadaMedan(u.MakmalDijaga),
    jawatan: u.Jawatan || '', noTelefon: u.NoTelefon || '', kelayakanAkademik: u.KelayakanAkademik || '',
    opsyenPengkhususan: u.OpsyenPengkhususan || '', gredJawatan: u.GredJawatan || '',
    kelasDiajar: u.KelasDiajar || '', tahunMulaSubjekSemasa: u.TahunMulaSubjekSemasa || '',
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
    .filter(u => senaraiPanitiaDaripadaMedan(u.Panitia).indexOf(p.panitia) !== -1 && String(u.Status).toUpperCase() === 'AKTIF')
    .map(u => ({ nokp: u.NoKP, nama: u.NamaPenuh, peranan: u.Peranan }));
  return jaya({ senarai });
}

function apiSimpanPengguna(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const nokp = String(p.nokp || '').trim();
  const nama = String(p.nama || '').trim();
  const peranan = String(p.peranan || '').trim();
  const senaraiPanitiaInput = Array.isArray(p.panitia) ? p.panitia : senaraiPanitiaDaripadaMedan(p.panitia);
  const panitiaSah = senaraiPanitiaInput.map(s => String(s).trim()).filter(s => SENARAI_PANITIA.indexOf(s) !== -1);
  const senaraiMakmalInput = Array.isArray(p.makmal) ? p.makmal : senaraiDaripadaMedan(p.makmal);
  const makmalSah = senaraiMakmalInput.map(s => String(s).trim()).filter(s => SENARAI_MAKMAL.indexOf(s) !== -1);
  const emel = String(p.emel || '').trim();
  if (!nokp || !nama || SEMUA_PERANAN.indexOf(peranan) === -1) return ralat('Data pengguna tidak lengkap/sah.');
  if ((peranan === ROLE_KETUA_PANITIA || peranan === ROLE_GURU) && !panitiaSah.length) {
    return ralat('Sila pilih sekurang-kurangnya satu Panitia bagi peranan ' + peranan + '.');
  }
  if (peranan === ROLE_PEMBANTU_MAKMAL && !makmalSah.length) {
    return ralat('Sila pilih sekurang-kurangnya satu Makmal bagi peranan Pembantu Makmal.');
  }
  if (emel && emel.indexOf('@') === -1) return ralat('Format e-mel tidak sah.');

  const sediaAda = cariBarisMengikutId(SHEET_USERS, 'NoKP', nokp);
  // Medan profil (teks) — pilihan, boleh diisi oleh Admin di sini ATAU oleh pengguna sendiri
  // di menu "Profil Saya" (ProfilService.gs). Kekalkan nilai sedia ada jika tidak dihantar.
  const medanProfil = (nilaiBaharu, namaLajur) =>
    String(nilaiBaharu !== undefined ? nilaiBaharu : (sediaAda ? sediaAda[namaLajur] : '') || '').trim();

  const objek = {
    NoKP: nokp,
    Password: sediaAda ? sediaAda.Password : cincangKataLaluan(kataLaluanLalaiDaripadaIC(nokp)),
    Peranan: peranan,
    NamaPenuh: nama,
    Panitia: (peranan === ROLE_KETUA_PANITIA || peranan === ROLE_GURU) ? panitiaSah.join(', ') : '',
    MestiTukarPassword: sediaAda ? sediaAda.MestiTukarPassword : 'YA',
    Status: sediaAda ? sediaAda.Status : 'AKTIF',
    Emel: emel,
    MakmalDijaga: peranan === ROLE_PEMBANTU_MAKMAL ? makmalSah.join(', ') : '',
    // Gambar profil diurus sendiri oleh pengguna (apiMuatNaikGambarProfilSendiri) — kekalkan sahaja di sini.
    GambarProfilUrl: sediaAda ? sediaAda.GambarProfilUrl : '',
    GambarProfilFailId: sediaAda ? sediaAda.GambarProfilFailId : '',
    Jawatan: medanProfil(p.jawatan, 'Jawatan'),
    NoTelefon: medanProfil(p.noTelefon, 'NoTelefon'),
    KelayakanAkademik: medanProfil(p.kelayakanAkademik, 'KelayakanAkademik'),
    OpsyenPengkhususan: medanProfil(p.opsyenPengkhususan, 'OpsyenPengkhususan'),
    GredJawatan: medanProfil(p.gredJawatan, 'GredJawatan'),
    KelasDiajar: medanProfil(p.kelasDiajar, 'KelasDiajar'),
    TahunMulaSubjekSemasa: medanProfil(p.tahunMulaSubjekSemasa, 'TahunMulaSubjekSemasa')
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
