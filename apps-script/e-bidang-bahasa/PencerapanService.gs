/* =========================================================================
 * PencerapanService.gs — Pencerapan PdP (pemerhatian pengajaran guru) &
 * Semakan Buku Latihan Murid. Lihat: sesiapa dalam panitia berkenaan (+
 * akses penuh). Urus: ADMIN/KETUA_BIDANG/KETUA_PANITIA panitia berkenaan
 * (sama seperti Mesyuarat/Program — rujuk PERANAN_URUS_PANITIA).
 * ========================================================================= */

const HEADER_PENCERAPAN_PDP = ['IDPencerapan', 'Panitia', 'GuruDipercNoKP', 'Pencerap', 'TarikhPencerapan',
  'MataPelajaran', 'Tingkatan', 'Instrumen', 'Skor', 'Catatan', 'FailBorangUrl', 'FailBorangId', 'DiciptaOleh'];
const HEADER_SEMAKAN_BUKU_LATIHAN = ['IDSemakan', 'Panitia', 'TingkatanKelas', 'BilanganKe', 'TarikhSemakan',
  'Pemeriksa', 'Catatan', 'FailLaporanUrl', 'FailLaporanId', 'DiciptaOleh'];

/* ============================ PENCERAPAN PdP ============================ */
function apiSenaraiPencerapan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_PENCERAPAN_PDP)
    .filter(pc => String(pc.Panitia) === String(p.panitia))
    .sort((a, b) => String(b.TarikhPencerapan).localeCompare(String(a.TarikhPencerapan)));
  return jaya({ senarai });
}

function apiSimpanPencerapan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const guruDipercNoKP = String(p.guruDipercNoKP || '').trim();
  const pencerap = String(p.pencerap || '').trim();
  const tarikhPencerapan = String(p.tarikhPencerapan || '').trim();
  if (!guruDipercNoKP || !pencerap || !tarikhPencerapan) return ralat('Sila isi Guru Diperc, Pencerap dan Tarikh Pencerapan.');

  const sediaAda = p.idPencerapan ? cariBarisMengikutId(SHEET_PENCERAPAN_PDP, 'IDPencerapan', p.idPencerapan) : null;
  const objek = {
    IDPencerapan: sediaAda ? sediaAda.IDPencerapan : janaId('PC'),
    Panitia: p.panitia,
    GuruDipercNoKP: guruDipercNoKP,
    Pencerap: pencerap,
    TarikhPencerapan: tarikhPencerapan,
    MataPelajaran: String(p.mataPelajaran || '').trim(),
    Tingkatan: String(p.tingkatan || '').trim(),
    Instrumen: String(p.instrumen || '').trim(),
    Skor: String(p.skor || '').trim(),
    Catatan: String(p.catatan || '').trim(),
    FailBorangUrl: sediaAda ? sediaAda.FailBorangUrl : '',
    FailBorangId: sediaAda ? sediaAda.FailBorangId : '',
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_PENCERAPAN_PDP, sediaAda.__row, objek, HEADER_PENCERAPAN_PDP);
    catatAudit(sesi, 'KEMASKINI', 'PENCERAPAN_PDP', objek.IDPencerapan, 'Kemaskini pencerapan PdP: ' + p.panitia);
  } else {
    tambahBaris(SHEET_PENCERAPAN_PDP, objek, HEADER_PENCERAPAN_PDP);
    catatAudit(sesi, 'TAMBAH', 'PENCERAPAN_PDP', objek.IDPencerapan, 'Tambah pencerapan PdP: ' + p.panitia);
  }
  return jaya({ idPencerapan: objek.IDPencerapan });
}

function apiMuatNaikBorangPencerapan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  const pencerapan = cariBarisMengikutId(SHEET_PENCERAPAN_PDP, 'IDPencerapan', p.idPencerapan);
  if (!pencerapan) return ralat('Rekod pencerapan tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, pencerapan.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');
  if (!p.namaFail || !p.dataBase64) return ralat('Sila pilih fail borang untuk dimuat naik.');

  if (pencerapan.FailBorangId) padamFailDrive(pencerapan.FailBorangId);
  const failDrive = muatNaikFailKeDrive(pencerapan.Panitia, 'Pencerapan PdP', p.namaFail, p.dataBase64, p.jenisMime);
  pencerapan.FailBorangUrl = failDrive.url;
  pencerapan.FailBorangId = failDrive.fileId;
  kemaskiniBaris(SHEET_PENCERAPAN_PDP, pencerapan.__row, pencerapan, HEADER_PENCERAPAN_PDP);
  catatAudit(sesi, 'MUAT_NAIK', 'PENCERAPAN_PDP', pencerapan.IDPencerapan, 'Muat naik borang pencerapan PdP');
  return jaya({ failBorangUrl: failDrive.url });
}

function apiPadamPencerapan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  const pencerapan = cariBarisMengikutId(SHEET_PENCERAPAN_PDP, 'IDPencerapan', p.idPencerapan);
  if (!pencerapan) return ralat('Rekod pencerapan tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, pencerapan.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  padamFailDrive(pencerapan.FailBorangId);
  padamBaris(SHEET_PENCERAPAN_PDP, pencerapan.__row);
  catatAudit(sesi, 'PADAM', 'PENCERAPAN_PDP', pencerapan.IDPencerapan, 'Padam pencerapan PdP: ' + pencerapan.Panitia);
  return jaya({});
}

/* ============================ SEMAKAN BUKU LATIHAN ============================ */
function apiSenaraiSemakanBuku(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_SEMAKAN_BUKU_LATIHAN)
    .filter(sm => String(sm.Panitia) === String(p.panitia))
    .sort((a, b) => String(b.TarikhSemakan).localeCompare(String(a.TarikhSemakan)));
  return jaya({ senarai });
}

function apiSimpanSemakanBuku(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const tingkatanKelas = String(p.tingkatanKelas || '').trim();
  const pemeriksa = String(p.pemeriksa || '').trim();
  const tarikhSemakan = String(p.tarikhSemakan || '').trim();
  if (!tingkatanKelas || !pemeriksa || !tarikhSemakan) return ralat('Sila isi Tingkatan/Kelas, Pemeriksa dan Tarikh Semakan.');

  const sediaAda = p.idSemakan ? cariBarisMengikutId(SHEET_SEMAKAN_BUKU_LATIHAN, 'IDSemakan', p.idSemakan) : null;
  const objek = {
    IDSemakan: sediaAda ? sediaAda.IDSemakan : janaId('SBL'),
    Panitia: p.panitia,
    TingkatanKelas: tingkatanKelas,
    BilanganKe: String(p.bilanganKe || '').trim(),
    TarikhSemakan: tarikhSemakan,
    Pemeriksa: pemeriksa,
    Catatan: String(p.catatan || '').trim(),
    FailLaporanUrl: sediaAda ? sediaAda.FailLaporanUrl : '',
    FailLaporanId: sediaAda ? sediaAda.FailLaporanId : '',
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_SEMAKAN_BUKU_LATIHAN, sediaAda.__row, objek, HEADER_SEMAKAN_BUKU_LATIHAN);
    catatAudit(sesi, 'KEMASKINI', 'SEMAKAN_BUKU_LATIHAN', objek.IDSemakan, 'Kemaskini semakan buku latihan: ' + p.panitia);
  } else {
    tambahBaris(SHEET_SEMAKAN_BUKU_LATIHAN, objek, HEADER_SEMAKAN_BUKU_LATIHAN);
    catatAudit(sesi, 'TAMBAH', 'SEMAKAN_BUKU_LATIHAN', objek.IDSemakan, 'Tambah semakan buku latihan: ' + p.panitia);
  }
  return jaya({ idSemakan: objek.IDSemakan });
}

function apiMuatNaikLaporanSemakanBuku(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  const semakan = cariBarisMengikutId(SHEET_SEMAKAN_BUKU_LATIHAN, 'IDSemakan', p.idSemakan);
  if (!semakan) return ralat('Rekod semakan tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, semakan.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');
  if (!p.namaFail || !p.dataBase64) return ralat('Sila pilih fail laporan untuk dimuat naik.');

  if (semakan.FailLaporanId) padamFailDrive(semakan.FailLaporanId);
  const failDrive = muatNaikFailKeDrive(semakan.Panitia, 'Semakan Buku Latihan', p.namaFail, p.dataBase64, p.jenisMime);
  semakan.FailLaporanUrl = failDrive.url;
  semakan.FailLaporanId = failDrive.fileId;
  kemaskiniBaris(SHEET_SEMAKAN_BUKU_LATIHAN, semakan.__row, semakan, HEADER_SEMAKAN_BUKU_LATIHAN);
  catatAudit(sesi, 'MUAT_NAIK', 'SEMAKAN_BUKU_LATIHAN', semakan.IDSemakan, 'Muat naik laporan semakan buku latihan');
  return jaya({ failLaporanUrl: failDrive.url });
}

function apiPadamSemakanBuku(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  const semakan = cariBarisMengikutId(SHEET_SEMAKAN_BUKU_LATIHAN, 'IDSemakan', p.idSemakan);
  if (!semakan) return ralat('Rekod semakan tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, semakan.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  padamFailDrive(semakan.FailLaporanId);
  padamBaris(SHEET_SEMAKAN_BUKU_LATIHAN, semakan.__row);
  catatAudit(sesi, 'PADAM', 'SEMAKAN_BUKU_LATIHAN', semakan.IDSemakan, 'Padam semakan buku latihan: ' + semakan.Panitia);
  return jaya({});
}
