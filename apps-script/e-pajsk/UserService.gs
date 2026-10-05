/* =========================================================================
 * UserService.gs — Pengurusan pengguna (ADMIN sahaja). Peranan: ADMIN dan
 * GURU_KELAS. Kata laluan lalai = 6 digit terakhir No. KP dan pengguna baharu /
 * yang di-set semula WAJIB menukarnya semasa log masuk seterusnya.
 * ========================================================================= */

function apiSenaraiPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const senarai = bacaSheetSebagaiObjek(SHEET_PENGGUNA).map(u => ({
    nokp: normalKP(u.NoKP), nama: u.NamaPenuh, peranan: u.Peranan, emel: u.Emel || '',
    kelas: senaraiDaripadaMedan(u.KelasDijaga), status: u.Status,
    mestiTukarPassword: String(u.MestiTukarPassword).toUpperCase() === 'YA'
  }));
  return jaya({ senarai });
}

/* Senarai kelas (kunci + bilangan murid aktif) — untuk dropdown tetapan guru kelas / pilihan kelas. */
function apiSenaraiKelas(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const bil = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() !== 'AKTIF') return;
    bil[m.KunciKelas] = (bil[m.KunciKelas] || 0) + 1;
  });
  let kunci = Object.keys(bil).sort();
  if (sesi.peranan !== ROLE_ADMIN) kunci = kunci.filter(k => sesi.kelas.indexOf(k) !== -1);
  return jaya({ kelas: kunci.map(k => ({ kunci: k, nama: paparKelas(k), bilMurid: bil[k] })) });
}

function apiSimpanPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;

  const nokp = normalKP(p.nokp);
  const nama = String(p.nama || '').trim().toUpperCase();
  const peranan = String(p.peranan || '').trim();
  const emel = String(p.emel || '').trim();
  const status = String(p.status || 'AKTIF').toUpperCase() === 'AKTIF' ? 'AKTIF' : 'TIDAK AKTIF';
  const kelas = (Array.isArray(p.kelas) ? p.kelas : senaraiDaripadaMedan(p.kelas)).map(k => String(k).trim()).filter(Boolean);
  if (nokp.length !== 12) return ralat('No. KP mesti 12 digit.');
  if (!nama || SEMUA_PERANAN.indexOf(peranan) === -1) return ralat('Data pengguna tidak lengkap/sah.');
  if (emel && emel.indexOf('@') === -1) return ralat('Format e-mel tidak sah.');

  return denganKunci(() => {
    const semua = bacaSheetSebagaiObjek(SHEET_PENGGUNA);
    const sediaAda = semua.find(u => normalKP(u.NoKP) === nokp);
    if (sediaAda && sediaAda.Peranan === ROLE_ADMIN && (peranan !== ROLE_ADMIN || status !== 'AKTIF')) {
      const adminAktifLain = semua.filter(u => u.Peranan === ROLE_ADMIN && String(u.Status).toUpperCase() === 'AKTIF' && normalKP(u.NoKP) !== nokp);
      if (!adminAktifLain.length) return ralat('Mesti ada sekurang-kurangnya satu Admin aktif.');
    }
    const objek = {
      NoKP: nokp,
      Password: sediaAda ? sediaAda.Password : cincangKataLaluan(nokp, kataLaluanLalaiDaripadaIC(nokp)),
      Peranan: peranan,
      NamaPenuh: nama,
      KelasDijaga: peranan === ROLE_GURU_KELAS ? kelas.join(', ') : '',
      MestiTukarPassword: sediaAda ? sediaAda.MestiTukarPassword : 'YA',
      Status: status,
      Emel: emel
    };
    if (sediaAda) {
      kemaskiniBaris(SHEET_PENGGUNA, sediaAda.__row, objek);
      catatAudit(sesi, 'KEMASKINI', 'PENGGUNA', nokp, 'Kemaskini pengguna: ' + nama);
    } else {
      tambahBaris(SHEET_PENGGUNA, objek);
      catatAudit(sesi, 'TAMBAH', 'PENGGUNA', nokp, 'Tambah pengguna: ' + nama);
    }
    return jaya({});
  });
}

function apiResetPassword(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  return denganKunci(() => {
    const u = bacaSheetSebagaiObjek(SHEET_PENGGUNA).find(x => normalKP(x.NoKP) === nokp);
    if (!u) return ralat('Pengguna tidak dijumpai.');
    u.Password = cincangKataLaluan(nokp, kataLaluanLalaiDaripadaIC(nokp));
    u.MestiTukarPassword = 'YA';
    kemaskiniBaris(SHEET_PENGGUNA, u.__row, u);
    CacheService.getScriptCache().remove('gagal_epajsk_' + nokp);
    catatAudit(sesi, 'RESET_PASSWORD', 'PENGGUNA', nokp, 'Set semula kata laluan: ' + u.NamaPenuh);
    return jaya({});
  });
}

function apiPadamPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  if (nokp === sesi.nokp) return ralat('Anda tidak boleh memadam akaun sendiri.');
  return denganKunci(() => {
    const semua = bacaSheetSebagaiObjek(SHEET_PENGGUNA);
    const u = semua.find(x => normalKP(x.NoKP) === nokp);
    if (!u) return ralat('Pengguna tidak dijumpai.');
    if (u.Peranan === ROLE_ADMIN && !semua.some(x => x.Peranan === ROLE_ADMIN && String(x.Status).toUpperCase() === 'AKTIF' && normalKP(x.NoKP) !== nokp)) {
      return ralat('Mesti ada sekurang-kurangnya satu Admin aktif.');
    }
    padamBaris(SHEET_PENGGUNA, u.__row);
    catatAudit(sesi, 'PADAM', 'PENGGUNA', nokp, 'Padam pengguna: ' + u.NamaPenuh);
    return jaya({});
  });
}

/* Import guru daripada Sheet PENGGUNA e-Kokurikulum (hanya yang belum wujud). Semua diimport
   sebagai GURU_KELAS — Admin boleh naik taraf secara manual. Kata laluan e-Kokurikulum TIDAK disalin. */
function apiImportGuruKoko(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  let guruKoko;
  try { guruKoko = bacaGuruKoko(); } catch (e) { return ralat(e.message); }
  return denganKunci(() => {
    const sedia = {};
    bacaSheetSebagaiObjek(SHEET_PENGGUNA).forEach(u => { sedia[normalKP(u.NoKP)] = true; });
    const baharu = [];
    let langkau = 0;
    guruKoko.forEach(g => {
      if (sedia[g.nokp]) { langkau++; return; }
      sedia[g.nokp] = true;
      baharu.push({
        NoKP: g.nokp, Password: cincangKataLaluan(g.nokp, kataLaluanLalaiDaripadaIC(g.nokp)),
        Peranan: ROLE_GURU_KELAS, NamaPenuh: g.nama, KelasDijaga: '', MestiTukarPassword: 'YA', Status: 'AKTIF', Emel: g.emel
      });
    });
    upsertBanyak(SHEET_PENGGUNA, 'NoKP', baharu);
    catatAudit(sesi, 'IMPORT', 'PENGGUNA', '', 'Import guru e-Kokurikulum: ' + baharu.length + ' baharu, ' + langkau + ' sedia ada');
    return jaya({ ditambah: baharu.length, sediaAda: langkau });
  });
}
