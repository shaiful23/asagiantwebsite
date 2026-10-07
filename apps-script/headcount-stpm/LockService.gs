/* =========================================================================
 * LockService.gs — Tarikh Akhir (kunci) pengisian markah & Permohonan Buka
 * Semula. SATU tarikh akhir GLOBAL bagi setiap Semester (disimpan dalam
 * CONFIG, kunci 'tarikhAkhirS1'/'tarikhAkhirS2'/'tarikhAkhirS3', rentetan
 * ISO/"yyyy-MM-dd HH:mm:ss" — kosong = tiada kunci/tiada had). Selepas tarikh
 * akhir, peranan BUKAN PERANAN_AKSES_PENUH (GURU/KETUA_PANITIA/GURU_KELAS)
 * disekat drpd isi ETR/Markah Ujian (rujuk semakKunciMarkah(), dipanggil oleh
 * HeadcountService.gs sebelum sebarang simpan) — melainkan ada permohonan
 * buka semula yang DILULUSKAN khusus untuk guru+subjek+semester+tahun itu.
 * ========================================================================= */

const HEADER_UNLOCK_REQUESTS = ['ID_Permohonan', 'NoKP', 'NamaGuru', 'KodSubjek', 'Semester', 'TahunSTPM',
  'Sebab', 'TarikhMohon', 'Status', 'DiluluskanOleh', 'TarikhKeputusan', 'CatatanAdmin'];

function simpanNilaiKonfig(key, value) {
  const sediaAda = cariBarisMengikutId(SHEET_CONFIG, 'Key', key);
  if (sediaAda) {
    kemaskiniBaris(SHEET_CONFIG, sediaAda.__row, { Key: key, Value: value }, ['Key', 'Value']);
  } else {
    tambahBaris(SHEET_CONFIG, { Key: key, Value: value }, ['Key', 'Value']);
  }
}

/* Tetapan tarikh akhir SEMUA semester + masa pelayan semasa (client guna masa
   pelayan, bukan jam peranti sendiri, supaya countdown tepat tanpa kira jam
   peranti guru betul/salah). Boleh dipanggil mana-mana peranan log masuk. */
function apiDapatkanTetapanKunci(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const konfig = dapatkanKonfig();
  const tetapan = SEMESTER_HEADCOUNT.map(sem => ({ semester: sem, tarikhAkhir: konfig['tarikhAkhir' + sem] || '' }));
  return jaya({ tetapan, masaSekarang: formatTarikhMasa(new Date()) });
}

function apiSimpanTetapanKunci(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || '').trim();
  if (SEMESTER_HEADCOUNT.indexOf(semester) === -1) return ralat('Semester tidak sah.');
  const tarikhAkhir = String(p.tarikhAkhir || '').trim(); // '' = buka/tiada had

  simpanNilaiKonfig('tarikhAkhir' + semester, tarikhAkhir);
  catatAudit(sesi, 'KEMASKINI', 'TETAPAN_KUNCI', semester, '', tarikhAkhir || '(tiada had)',
    'Tetapkan tarikh akhir pengisian markah ' + semester + (tarikhAkhir ? (': ' + tarikhAkhir) : ' dibuka (tiada had)'));
  return jaya({});
}

/* Semak sama ada GURU/KETUA_PANITIA/GURU_KELAS masih dibenarkan isi/kemaskini
   markah bagi (kodSubjek, semester, tahunSTPM). PERANAN_AKSES_PENUH tidak
   pernah dikunci (mereka perlu boleh betulkan data pada bila-bila masa).
   Pulangkan null jika dibenarkan, atau mesej ralat (String) jika disekat. */
function semakKunciMarkah(sesi, kodSubjek, semester, tahunSTPM) {
  if (PERANAN_AKSES_PENUH.includes(sesi.peranan)) return null;

  const konfig = dapatkanKonfig();
  const tarikhAkhir = konfig['tarikhAkhir' + semester];
  if (!tarikhAkhir) return null; // tiada had ditetapkan

  const skrgMs = Date.now();
  const akhirMs = new Date(String(tarikhAkhir).replace(' ', 'T')).getTime();
  if (isNaN(akhirMs) || skrgMs <= akhirMs) return null; // belum lepas tarikh akhir

  const diluluskan = bacaSheetSebagaiObjek(SHEET_UNLOCK_REQUESTS).some(r =>
    String(r.NoKP) === String(sesi.nokp) && String(r.KodSubjek) === String(kodSubjek) &&
    String(r.Semester) === String(semester) && String(r.TahunSTPM) === String(tahunSTPM) &&
    String(r.Status).toUpperCase() === 'DILULUSKAN');
  if (diluluskan) return null;

  return 'Tarikh akhir pengisian markah ' + semester + ' (' + tarikhAkhir + ') telah LEPAS — sistem dikunci untuk subjek "' +
    kodSubjek + '". Sila hantar "Permohonan Buka Semula" (menu Kunci Markah) untuk mohon kebenaran Admin.';
}

/* Guru hantar permohonan buka semula bagi SATU subjek+semester+tahun (sebab wajib). */
function apiMohonBukaKunci(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (PERANAN_AKSES_PENUH.includes(sesi.peranan)) return ralat('Peranan pengurusan tidak dikunci — tiada keperluan mohon buka semula.');

  const kodSubjek = String(p.kodSubjek || '').trim();
  const semester = String(p.semester || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const sebab = String(p.sebab || '').trim();
  if (!kodSubjek || SEMESTER_HEADCOUNT.indexOf(semester) === -1 || !tahunSTPM || !sebab) {
    return ralat('Kod Subjek, Semester, Tahun STPM dan Sebab wajib diisi.');
  }
  if (sesi.skopSubjek.indexOf(kodSubjek) === -1) return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');

  const sediaMenunggu = bacaSheetSebagaiObjek(SHEET_UNLOCK_REQUESTS).some(r =>
    String(r.NoKP) === String(sesi.nokp) && String(r.KodSubjek) === kodSubjek &&
    String(r.Semester) === semester && String(r.TahunSTPM) === tahunSTPM && String(r.Status).toUpperCase() === 'MENUNGGU');
  if (sediaMenunggu) return ralat('Anda sudah ada permohonan MENUNGGU bagi subjek/semester/tahun ini — sila tunggu keputusan Admin.');

  const objek = {
    ID_Permohonan: janaId('UNL'), NoKP: sesi.nokp, NamaGuru: sesi.nama, KodSubjek: kodSubjek,
    Semester: semester, TahunSTPM: tahunSTPM, Sebab: sebab, TarikhMohon: formatTarikhMasa(new Date()),
    Status: 'MENUNGGU', DiluluskanOleh: '', TarikhKeputusan: '', CatatanAdmin: ''
  };
  tambahBaris(SHEET_UNLOCK_REQUESTS, objek, HEADER_UNLOCK_REQUESTS);
  catatAudit(sesi, 'TAMBAH', 'PERMOHONAN_KUNCI', objek.ID_Permohonan, '', JSON.stringify(objek),
    'Mohon buka semula kunci markah: ' + kodSubjek + ' ' + semester + ' (' + tahunSTPM + ')');
  return jaya({ idPermohonan: objek.ID_Permohonan });
}

/* PERANAN_AKSES_PENUH nampak SEMUA permohonan; guru lain hanya nampak permohonan
   sendiri (self-filtered di server — MODUL 31). */
function apiSenaraiPermohonanKunci(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  let senarai = bacaSheetSebagaiObjek(SHEET_UNLOCK_REQUESTS);
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) senarai = senarai.filter(r => String(r.NoKP) === String(sesi.nokp));
  if (p.status) senarai = senarai.filter(r => String(r.Status).toUpperCase() === String(p.status).toUpperCase());
  senarai.sort((a, b) => String(b.TarikhMohon).localeCompare(String(a.TarikhMohon)));
  return jaya({ senarai });
}

function apiLuluskanPermohonanKunci(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const idPermohonan = String(p.idPermohonan || '').trim();
  const keputusan = String(p.keputusan || '').trim().toUpperCase();
  if (['DILULUSKAN', 'DITOLAK'].indexOf(keputusan) === -1) return ralat('Keputusan mesti DILULUSKAN atau DITOLAK.');

  const rekod = cariBarisMengikutId(SHEET_UNLOCK_REQUESTS, 'ID_Permohonan', idPermohonan);
  if (!rekod) return ralat('Permohonan tidak dijumpai.');
  if (String(rekod.Status).toUpperCase() !== 'MENUNGGU') return ralat('Permohonan ini sudah diputuskan sebelum ini.');

  const objek = Object.assign({}, rekod, {
    Status: keputusan, DiluluskanOleh: sesi.nama, TarikhKeputusan: formatTarikhMasa(new Date()),
    CatatanAdmin: String(p.catatanAdmin || '').trim()
  });
  kemaskiniBaris(SHEET_UNLOCK_REQUESTS, rekod.__row, objek, HEADER_UNLOCK_REQUESTS);
  catatAudit(sesi, 'KEPUTUSAN', 'PERMOHONAN_KUNCI', idPermohonan, 'MENUNGGU', keputusan,
    keputusan + ' permohonan buka kunci: ' + rekod.NoKP + ' / ' + rekod.KodSubjek + ' ' + rekod.Semester);
  return jaya({});
}
