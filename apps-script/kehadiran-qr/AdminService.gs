/* =========================================================================
 * AdminService.gs — fungsi Pentadbir: permohonan buka akses rekod kehadiran
 * (lulus/tolak + analisis), kod QR kelas, pengguna & status sumber luar.
 * ========================================================================= */

function wajibAdmin(token) { return wajibSesi(token, { peranan: [PERANAN.ADMIN] }); }

function apiSenaraiPermohonan(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const status = String(p.status || '').toUpperCase();
  const senarai = bacaSheetSebagaiObjek(SHEET.PERMOHONAN).filter(x => !status || x.Status === status)
    .sort((a, b) => String(b.MasaMohon).localeCompare(String(a.MasaMohon))).slice(0, 500).map(ringkasPermohonan);
  return jaya({ senarai });
}

function apiProsesPermohonan(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const keputusan = String(p.keputusan || '').toUpperCase();
  if (['DILULUSKAN', 'DITOLAK'].indexOf(keputusan) === -1) return ralat('Keputusan tidak sah.');
  if (keputusan === 'DITOLAK' && String(p.catatan || '').trim().length < 5) return ralat('Sila nyatakan sebab permohonan ditolak.');
  return denganKunci(() => {
    const rekod = bacaSheetSebagaiObjek(SHEET.PERMOHONAN).find(x => x.IdPermohonan === p.id);
    if (!rekod) return ralat('Permohonan tidak dijumpai.');
    if (rekod.Status !== 'MENUNGGU') return ralat('Permohonan ini sudah diproses (' + rekod.Status + ').');
    const kini = sekarang();
    rekod.Status = keputusan;
    rekod.DiprosesOleh = sesi.nama;
    rekod.MasaProses = formatTarikhMasa(kini);
    rekod.CatatanAdmin = String(p.catatan || '').slice(0, 500);
    rekod.TamatAkses = keputusan === 'DILULUSKAN'
      ? formatTarikhMasa(new Date(kini.getTime() + (Number(tetapan('TEMPOH_BUKA_AKSES_MINIT')) || 120) * 60000)) : '';
    rekod.NoKPGuru = "'" + digitSahaja(rekod.NoKPGuru);
    kemaskiniBaris(SHEET.PERMOHONAN, rekod);
    catatAudit(sesi, 'PROSES_PERMOHONAN', rekod.IdPermohonan + ' ' + keputusan);
    return jaya({ status: keputusan, tamatAkses: rekod.TamatAkses });
  });
}

/* Analisis permohonan buka akses — rujukan admin (kekerapan, guru, kelas, masa). */
function apiAnalisisPermohonan(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const tahun = String(p.tahun || tarikhHariIni().slice(0, 4));
  const semua = bacaSheetSebagaiObjek(SHEET.PERMOHONAN).filter(x => String(x.MasaMohon).slice(0, 4) === tahun);
  const kira = (fn) => { const o = {}; semua.forEach(x => { const k = fn(x); o[k] = (o[k] || 0) + 1; }); return o; };
  const keSenarai = (o) => Object.keys(o).map(k => ({ label: k, bil: o[k] })).sort((a, b) => b.bil - a.bil);
  const perBulan = BULAN_MS.map((b, i) => {
    const kod = tahun + '-' + ('0' + (i + 1)).slice(-2);
    const s = semua.filter(x => String(x.MasaMohon).slice(0, 7) === kod);
    return { bulan: b.slice(0, 3), jumlah: s.length, lulus: s.filter(x => x.Status === 'DILULUSKAN').length, tolak: s.filter(x => x.Status === 'DITOLAK').length };
  });
  const perGuru = {};
  semua.forEach(x => { const k = x.NamaGuru; (perGuru[k] = perGuru[k] || { guru: k, kelas: x.Kelas, jumlah: 0, lulus: 0, tolak: 0, menunggu: 0 });
    perGuru[k].jumlah++; if (x.Status === 'DILULUSKAN') perGuru[k].lulus++; else if (x.Status === 'DITOLAK') perGuru[k].tolak++; else perGuru[k].menunggu++; });
  const masaProses = semua.filter(x => x.MasaProses).map(x => (new Date(String(x.MasaProses).replace(' ', 'T')) - new Date(String(x.MasaMohon).replace(' ', 'T'))) / 60000)
    .filter(n => !isNaN(n) && n >= 0);
  const rekodLewat = bacaSheetSebagaiObjek(SHEET.REKOD_KELAS).filter(r => keTarikh(r.Tarikh).slice(0, 4) === tahun);
  return jaya({
    tahun,
    kad: { jumlah: semua.length, lulus: semua.filter(x => x.Status === 'DILULUSKAN').length, tolak: semua.filter(x => x.Status === 'DITOLAK').length,
      menunggu: semua.filter(x => x.Status === 'MENUNGGU').length,
      purataMinitProses: masaProses.length ? Math.round(masaProses.reduce((s, n) => s + n, 0) / masaProses.length) : 0,
      peratusRekodSelepasKunci: bulatPeratus(rekodLewat.filter(r => r.SelepasKunci === 'YA').length, rekodLewat.length) },
    perBulan, perStatus: keSenarai(kira(x => x.Status)), perKelas: keSenarai(kira(x => x.Kelas)),
    perHari: HARI_MS.slice(1, 6).map(h => ({ label: h, bil: semua.filter(x => hariBagiTarikh(x.TarikhRekod) === h).length })),
    perGuru: Object.keys(perGuru).map(k => perGuru[k]).sort((a, b) => b.jumlah - a.jumlah),
    senarai: semua.sort((a, b) => String(b.MasaMohon).localeCompare(String(a.MasaMohon))).map(ringkasPermohonan)
  });
}

function apiSenaraiKelasQR(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  return jaya({ senarai: senaraiKelas().map(k => Object.assign(k, {
    kandunganQR: k.kodQR ? 'KELAS:' + k.kodQR + (k.bilik ? '|BILIK:' + k.bilik : '') : '', bilMurid: muridDalamKelas(k.kelas).length })) });
}

function apiSenaraiPengguna(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const akaun = {}; bacaSheetSebagaiObjek(SHEET.AKAUN).forEach(a => { akaun[digitSahaja(a.NoKP)] = a; });
  const guru = senaraiGuru().map(g => {
    const a = akaun[digitSahaja(g.NoKP)];
    return { nokp: digitSahaja(g.NoKP), nama: g.Nama, peranan: perananGuru(g), labelPeranan: perananGuru(g).map(x => LABEL_PERANAN[x] || x),
      kelasTingkatan: normalKelas(g.KelasTingkatan), status: g.Status || 'AKTIF',
      akaun: a ? (String(a.MestiTukarPassword).toUpperCase() === 'YA' ? 'BELUM TUKAR KATA LALUAN' : 'AKTIF') : 'BELUM LOG MASUK',
      logMasukTerakhir: a ? a.LogMasukTerakhir : '' };
  });
  let murid = [];
  try { murid = senaraiMurid(); } catch (e) { /* sumber luar rosak — status dipaparkan oleh apiStatusSumberLuar */ }
  const muridAktif = murid.filter(m => akaun[digitSahaja(m.NoKP)]).length;
  return jaya({ guru, ringkasan: { guru: guru.length, murid: murid.length, muridPernahLogMasuk: muridAktif,
    perPeranan: Object.keys(LABEL_PERANAN).filter(k => k !== 'MURID').map(k => ({ label: LABEL_PERANAN[k], bil: guru.filter(g => g.peranan.indexOf(k) !== -1).length })) } });
}

/* Pemetaan kod kelas e-Teach-In → kelas e-Data, untuk semakan admin. */
function ringkasanPetaKod() {
  try {
    const manual = {}; bacaSheetSebagaiObjek(SHEET.PETA_KOD).forEach(r => { if (r.Kod && r.Kelas) manual[normalKelas(r.Kod)] = true; });
    const peta = petaKodKelas();
    return { format: formatTeachIn(), senarai: Object.keys(peta).sort().map(k => ({ kod: k, kelas: peta[k], kaedah: manual[k] ? 'MANUAL' : 'AUTO' })),
      tanpaPeta: MEMO_LUAR.kodTanpaPeta || [] };
  } catch (e) { return { senarai: [], tanpaPeta: [], ralat: e.message }; }
}

/* Tulis pemetaan automatik ke Sheet PETA_KOD_KELAS (kod yang belum ada sahaja)
   supaya admin boleh menyemak & membetulkan. */
function janaPetaKodKelas() {
  sediakanSistem(true);
  segarSemulaSumberLuar();
  const sedia = {}; bacaSheetSebagaiObjek(SHEET.PETA_KOD).forEach(r => { sedia[normalKelas(r.Kod)] = true; });
  const peta = petaKodKelas(), baris = [];
  Object.keys(peta).sort().forEach(k => { if (!sedia[k]) baris.push({ Kod: k, Kelas: peta[k], Catatan: 'AUTO — sila semak' }); });
  (MEMO_LUAR.kodTanpaPeta || []).forEach(k => { if (!sedia[k]) baris.push({ Kod: k, Kelas: '', Catatan: 'TIADA PADANAN — isi nama kelas seperti di e-Data (cth. 6 ATAS 1)' }); });
  tambahBanyakBaris(SHEET.PETA_KOD, baris);
  segarSemulaSumberLuar();
  return baris.length;
}

function apiStatusSumberLuar(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  if (p.segar) segarSemulaSumberLuar();
  const uji = (nama, idKunci, fn) => {
    const id = tetapan(idKunci);
    try { const n = fn().length; return { nama, disambung: !!id, bil: n, ok: true, mesej: (id ? 'Disambung' : 'Sheet tempatan') + ' — ' + n + ' rekod' }; }
    catch (e) { return { nama, disambung: !!id, bil: 0, ok: false, mesej: e.message }; }
  };
  return jaya({ sumber: [
    uji('e-Data & Enrolmen (murid & gambar)', 'EDATA_SPREADSHEET_ID', senaraiMurid),
    uji('e-Teach-In — jadual waktu', 'TEACHIN_SPREADSHEET_ID', senaraiJadual),
    uji('e-Teach-In — guru ganti', 'TEACHIN_SPREADSHEET_ID', senaraiTeachIn),
    uji('IDME — sebab tidak hadir', 'IDME_SPREADSHEET_ID', senaraiSebab)
  ], peta: ringkasanPetaKod() });
}
