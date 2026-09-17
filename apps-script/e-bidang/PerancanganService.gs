/* =========================================================================
 * PerancanganService.gs — Perancangan Strategik (PS), Pelan Taktikal (PT),
 * Pelan Operasi (PO), dan Carta Gantt aktiviti tahunan. Setiap rekod
 * mempunyai medan "Skop" — nama satu Panitia (SENARAI_PANITIA) ATAU
 * SKOP_BIDANG (peringkat Ketua Bidang, merentasi semua panitia).
 *
 * Melihat: sesiapa log masuk boleh lihat perancangan Bidang (SKOP_BIDANG,
 * dikongsi seluruh bidang) atau Panitia dalam senarai panitia sendiri.
 * Mengurus (tambah/sunting/padam): ADMIN/KETUA_BIDANG sahaja bagi skop
 * Bidang; ADMIN/KETUA_BIDANG/KETUA_PANITIA panitia berkenaan bagi skop
 * Panitia (sama seperti Mesyuarat/Program — rujuk PERANAN_URUS_PANITIA).
 * ========================================================================= */

const HEADER_PERANCANGAN_STRATEGIK = ['IDPS', 'Skop', 'TahunMula', 'TahunTamat', 'IsuStrategik',
  'MatlamatStrategik', 'Objektif', 'KPI', 'SasaranTOV', 'SasaranETR', 'Strategi', 'DiciptaOleh', 'TarikhDicipta'];
const HEADER_PELAN_TAKTIKAL = ['IDPT', 'Skop', 'Tahun', 'Program', 'Tanggungjawab', 'TempohHari',
  'KosSumber', 'KPI', 'Sasaran', 'PelanKontinjensi', 'DiciptaOleh', 'TarikhDicipta'];
const HEADER_PELAN_OPERASI = ['IDPO', 'Skop', 'NamaProgram', 'Objektif', 'KumpulanSasaran',
  'PegawaiBertanggungjawab', 'LangkahPratugas', 'LangkahPenyediaan', 'LangkahPelaksanaan',
  'LangkahPenilaian', 'DiciptaOleh', 'TarikhDicipta'];
const HEADER_AKTIVITI_TAHUNAN = ['IDAktiviti', 'Skop', 'Tahun', 'Aktiviti'].concat(BULAN_TAHUNAN).concat(['DiciptaOleh']);

function bolehLihatSkopPerancangan(sesi, skop) {
  return skop === SKOP_BIDANG || wajibAksesPanitia(sesi, skop);
}
function bolehUrusSkopPerancangan(sesi, skop) {
  if (skop === SKOP_BIDANG) return PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1;
  return PERANAN_URUS_PANITIA.indexOf(sesi.peranan) !== -1 && wajibAksesPanitia(sesi, skop);
}
function tahunSah(nilai) {
  return /^(19|20)\d{2}$/.test(String(nilai || '').trim());
}

/* ============================ PERANCANGAN STRATEGIK (PS) ============================ */
function apiSenaraiPS(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehLihatSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_PERANCANGAN_STRATEGIK)
    .filter(ps => String(ps.Skop) === String(p.skop))
    .sort((a, b) => String(b.TahunMula).localeCompare(String(a.TahunMula)));
  return jaya({ senarai });
}

function apiSimpanPS(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehUrusSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const isuStrategik = String(p.isuStrategik || '').trim();
  const matlamatStrategik = String(p.matlamatStrategik || '').trim();
  const objektif = String(p.objektif || '').trim();
  const kpi = String(p.kpi || '').trim();
  if (!isuStrategik || !matlamatStrategik || !objektif || !kpi) return ralat('Sila isi Isu Strategik, Matlamat Strategik, Objektif dan KPI.');
  if (!tahunSah(p.tahunMula) || !tahunSah(p.tahunTamat)) return ralat('Tahun Mula/Tamat tidak sah (format yyyy).');
  if (Number(p.tahunTamat) < Number(p.tahunMula)) return ralat('Tahun Tamat mesti sama atau selepas Tahun Mula.');

  const sediaAda = p.idPS ? cariBarisMengikutId(SHEET_PERANCANGAN_STRATEGIK, 'IDPS', p.idPS) : null;
  const objek = {
    IDPS: sediaAda ? sediaAda.IDPS : janaId('PS'),
    Skop: p.skop,
    TahunMula: String(p.tahunMula).trim(),
    TahunTamat: String(p.tahunTamat).trim(),
    IsuStrategik: isuStrategik,
    MatlamatStrategik: matlamatStrategik,
    Objektif: objektif,
    KPI: kpi,
    SasaranTOV: String(p.sasaranTOV || '').trim(),
    SasaranETR: String(p.sasaranETR || '').trim(),
    Strategi: String(p.strategi || '').trim(),
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama,
    TarikhDicipta: sediaAda ? sediaAda.TarikhDicipta : formatTarikhMasa(new Date())
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_PERANCANGAN_STRATEGIK, sediaAda.__row, objek, HEADER_PERANCANGAN_STRATEGIK);
    catatAudit(sesi, 'KEMASKINI', 'PERANCANGAN_STRATEGIK', objek.IDPS, 'Kemaskini PS: ' + p.skop);
  } else {
    tambahBaris(SHEET_PERANCANGAN_STRATEGIK, objek, HEADER_PERANCANGAN_STRATEGIK);
    catatAudit(sesi, 'TAMBAH', 'PERANCANGAN_STRATEGIK', objek.IDPS, 'Tambah PS: ' + p.skop);
  }
  return jaya({ idPS: objek.IDPS });
}

function apiPadamPS(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const ps = cariBarisMengikutId(SHEET_PERANCANGAN_STRATEGIK, 'IDPS', p.idPS);
  if (!ps) return ralat('Perancangan Strategik tidak dijumpai.');
  if (!bolehUrusSkopPerancangan(sesi, ps.Skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  padamBaris(SHEET_PERANCANGAN_STRATEGIK, ps.__row);
  catatAudit(sesi, 'PADAM', 'PERANCANGAN_STRATEGIK', ps.IDPS, 'Padam PS: ' + ps.Skop);
  return jaya({});
}

/* ============================ PELAN TAKTIKAL (PT) ============================ */
function apiSenaraiPT(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehLihatSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_PELAN_TAKTIKAL)
    .filter(pt => String(pt.Skop) === String(p.skop))
    .sort((a, b) => String(b.Tahun).localeCompare(String(a.Tahun)));
  return jaya({ senarai });
}

function apiSimpanPT(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehUrusSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const program = String(p.program || '').trim();
  const tanggungjawab = String(p.tanggungjawab || '').trim();
  const kpi = String(p.kpi || '').trim();
  if (!program || !tanggungjawab || !kpi) return ralat('Sila isi Program, Tanggungjawab dan KPI.');
  if (!tahunSah(p.tahun)) return ralat('Tahun tidak sah (format yyyy).');

  const sediaAda = p.idPT ? cariBarisMengikutId(SHEET_PELAN_TAKTIKAL, 'IDPT', p.idPT) : null;
  const objek = {
    IDPT: sediaAda ? sediaAda.IDPT : janaId('PT'),
    Skop: p.skop,
    Tahun: String(p.tahun).trim(),
    Program: program,
    Tanggungjawab: tanggungjawab,
    TempohHari: String(p.tempohHari || '').trim(),
    KosSumber: String(p.kosSumber || '').trim(),
    KPI: kpi,
    Sasaran: String(p.sasaran || '').trim(),
    PelanKontinjensi: String(p.pelanKontinjensi || '').trim(),
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama,
    TarikhDicipta: sediaAda ? sediaAda.TarikhDicipta : formatTarikhMasa(new Date())
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_PELAN_TAKTIKAL, sediaAda.__row, objek, HEADER_PELAN_TAKTIKAL);
    catatAudit(sesi, 'KEMASKINI', 'PELAN_TAKTIKAL', objek.IDPT, 'Kemaskini PT: ' + program);
  } else {
    tambahBaris(SHEET_PELAN_TAKTIKAL, objek, HEADER_PELAN_TAKTIKAL);
    catatAudit(sesi, 'TAMBAH', 'PELAN_TAKTIKAL', objek.IDPT, 'Tambah PT: ' + program);
  }
  return jaya({ idPT: objek.IDPT });
}

function apiPadamPT(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const pt = cariBarisMengikutId(SHEET_PELAN_TAKTIKAL, 'IDPT', p.idPT);
  if (!pt) return ralat('Pelan Taktikal tidak dijumpai.');
  if (!bolehUrusSkopPerancangan(sesi, pt.Skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  padamBaris(SHEET_PELAN_TAKTIKAL, pt.__row);
  catatAudit(sesi, 'PADAM', 'PELAN_TAKTIKAL', pt.IDPT, 'Padam PT: ' + pt.Program);
  return jaya({});
}

/* ============================ PELAN OPERASI (PO) ============================ */
function apiSenaraiPO(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehLihatSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_PELAN_OPERASI).filter(po => String(po.Skop) === String(p.skop));
  return jaya({ senarai });
}

function apiSimpanPO(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehUrusSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const namaProgram = String(p.namaProgram || '').trim();
  if (!namaProgram) return ralat('Sila isi Nama Program.');

  const sediaAda = p.idPO ? cariBarisMengikutId(SHEET_PELAN_OPERASI, 'IDPO', p.idPO) : null;
  const objek = {
    IDPO: sediaAda ? sediaAda.IDPO : janaId('PO'),
    Skop: p.skop,
    NamaProgram: namaProgram,
    Objektif: String(p.objektif || '').trim(),
    KumpulanSasaran: String(p.kumpulanSasaran || '').trim(),
    PegawaiBertanggungjawab: String(p.pegawaiBertanggungjawab || '').trim(),
    LangkahPratugas: String(p.langkahPratugas || '').trim(),
    LangkahPenyediaan: String(p.langkahPenyediaan || '').trim(),
    LangkahPelaksanaan: String(p.langkahPelaksanaan || '').trim(),
    LangkahPenilaian: String(p.langkahPenilaian || '').trim(),
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama,
    TarikhDicipta: sediaAda ? sediaAda.TarikhDicipta : formatTarikhMasa(new Date())
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_PELAN_OPERASI, sediaAda.__row, objek, HEADER_PELAN_OPERASI);
    catatAudit(sesi, 'KEMASKINI', 'PELAN_OPERASI', objek.IDPO, 'Kemaskini PO: ' + namaProgram);
  } else {
    tambahBaris(SHEET_PELAN_OPERASI, objek, HEADER_PELAN_OPERASI);
    catatAudit(sesi, 'TAMBAH', 'PELAN_OPERASI', objek.IDPO, 'Tambah PO: ' + namaProgram);
  }
  return jaya({ idPO: objek.IDPO });
}

function apiPadamPO(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const po = cariBarisMengikutId(SHEET_PELAN_OPERASI, 'IDPO', p.idPO);
  if (!po) return ralat('Pelan Operasi tidak dijumpai.');
  if (!bolehUrusSkopPerancangan(sesi, po.Skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  padamBaris(SHEET_PELAN_OPERASI, po.__row);
  catatAudit(sesi, 'PADAM', 'PELAN_OPERASI', po.IDPO, 'Padam PO: ' + po.NamaProgram);
  return jaya({});
}

/* ============================ CARTA GANTT (AKTIVITI TAHUNAN) ============================ */
function apiSenaraiAktivitiTahunan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehLihatSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_AKTIVITI_TAHUNAN)
    .filter(ak => String(ak.Skop) === String(p.skop) && (!p.tahun || String(ak.Tahun) === String(p.tahun)));
  return jaya({ senarai });
}

function apiSimpanAktivitiTahunan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehUrusSkopPerancangan(sesi, p.skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  const aktiviti = String(p.aktiviti || '').trim();
  if (!aktiviti) return ralat('Sila isi nama Aktiviti/Program.');
  if (!tahunSah(p.tahun)) return ralat('Tahun tidak sah (format yyyy).');

  const bulanTertanda = Array.isArray(p.bulan) ? p.bulan : [];
  const sediaAda = p.idAktiviti ? cariBarisMengikutId(SHEET_AKTIVITI_TAHUNAN, 'IDAktiviti', p.idAktiviti) : null;
  const objek = {
    IDAktiviti: sediaAda ? sediaAda.IDAktiviti : janaId('GANTT'),
    Skop: p.skop,
    Tahun: String(p.tahun).trim(),
    Aktiviti: aktiviti,
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama
  };
  BULAN_TAHUNAN.forEach(bulan => { objek[bulan] = bulanTertanda.indexOf(bulan) !== -1 ? 'YA' : 'TIDAK'; });

  if (sediaAda) {
    kemaskiniBaris(SHEET_AKTIVITI_TAHUNAN, sediaAda.__row, objek, HEADER_AKTIVITI_TAHUNAN);
    catatAudit(sesi, 'KEMASKINI', 'AKTIVITI_TAHUNAN', objek.IDAktiviti, 'Kemaskini Carta Gantt: ' + aktiviti);
  } else {
    tambahBaris(SHEET_AKTIVITI_TAHUNAN, objek, HEADER_AKTIVITI_TAHUNAN);
    catatAudit(sesi, 'TAMBAH', 'AKTIVITI_TAHUNAN', objek.IDAktiviti, 'Tambah Carta Gantt: ' + aktiviti);
  }
  return jaya({ idAktiviti: objek.IDAktiviti });
}

function apiPadamAktivitiTahunan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const ak = cariBarisMengikutId(SHEET_AKTIVITI_TAHUNAN, 'IDAktiviti', p.idAktiviti);
  if (!ak) return ralat('Aktiviti tidak dijumpai.');
  if (!bolehUrusSkopPerancangan(sesi, ak.Skop)) return ralat('Anda tidak mempunyai kebenaran untuk skop ini.');

  padamBaris(SHEET_AKTIVITI_TAHUNAN, ak.__row);
  catatAudit(sesi, 'PADAM', 'AKTIVITI_TAHUNAN', ak.IDAktiviti, 'Padam Carta Gantt: ' + ak.Aktiviti);
  return jaya({});
}
