/* =========================================================================
 * StudentService.gs — MODUL 2: MASTER PELAJAR, MODUL 4: PENDAFTARAN PELAJAR
 * ========================================================================= */

const HEADER_STUDENTS = ['ID_Pelajar', 'NoKP', 'Nama', 'Jantina', 'Kelas', 'TahunSTPM', 'Status', 'Catatan'];
const HEADER_ENROLLMENTS = ['ID_Pelajar', 'KodSubjek', 'TahunSTPM'];

/* Senarai batch/kohort (Tahun STPM) sedia ada — untuk pemilih "Tahun STPM" global
   di UI, supaya beberapa batch (cth. calon 2026 & 2027) boleh wujud serentak
   tanpa data bercampur di dashboard/laporan. */
function apiSenaraiTahunSTPM(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const tahunSet = new Set(bacaSheetSebagaiObjek(SHEET_STUDENTS).map(s => String(s.TahunSTPM).trim()).filter(Boolean));
  const senarai = Array.from(tahunSet).sort((a, b) => b.localeCompare(a));
  const konfig = dapatkanKonfig();
  return jaya({ senarai, tahunAktif: konfig.tahunSTPMAktif || '' });
}

/* Status TAMAT (pelajar diarkibkan selepas tamat belajar — rujuk apiArkibkanPelajar)
   disembunyikan DARIPADA senarai lalai (p.status / p.termasukArkib tidak diisi),
   supaya halaman "Pelajar" harian tidak bercampur dengan kohort yang sudah tamat.
   Guna p.status='TAMAT' (menu "Arkib") atau p.termasukArkib=true untuk lihat semua. */
function apiSenaraiPelajar(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  let senarai = bacaSheetSebagaiObjek(SHEET_STUDENTS);
  if (p.kelas) senarai = senarai.filter(s => String(s.Kelas).toUpperCase() === String(p.kelas).toUpperCase());
  if (p.tahunSTPM) senarai = senarai.filter(s => String(s.TahunSTPM) === String(p.tahunSTPM));
  if (p.carian) {
    const kunci = String(p.carian).toLowerCase();
    senarai = senarai.filter(s => String(s.Nama).toLowerCase().includes(kunci) || String(s.NoKP).includes(kunci) || String(s.ID_Pelajar).toLowerCase().includes(kunci));
  }
  if (p.status) {
    senarai = senarai.filter(s => String(s.Status).toUpperCase() === String(p.status).toUpperCase());
  } else if (!p.termasukArkib) {
    senarai = senarai.filter(s => String(s.Status).toUpperCase() !== 'TAMAT');
  }
  if (!aksesPenuh(sesi)) {
    // Guru Tingkatan: pelajar dalam kelas jagaan; semua peranan: pelajar yang mengambil
    // subjek dalam skop (subjek diajar / unit diketuai).
    const enrolments = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).filter(e => sesi.skopSubjek.includes(String(e.KodSubjek)));
    const idDibenarkan = new Set(enrolments.map(e => e.ID_Pelajar));
    senarai = senarai.filter(s => idDibenarkan.has(s.ID_Pelajar) || kelasJagaan(sesi, s.Kelas));
  }
  return jaya({ senarai });
}

function apiSimpanPelajar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const nama = String(p.nama || '').trim();
  const kelas = String(p.kelas || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!nama || !kelas || !tahunSTPM) return ralat('Nama, Kelas dan Tahun STPM wajib diisi.');

  let idPelajar = String(p.idPelajar || '').trim();
  const sediaAda = idPelajar ? cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar) : null;

  if (!sediaAda) {
    idPelajar = idPelajar || janaId('P');
    if (cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar)) return ralat('ID Pelajar "' + idPelajar + '" sudah wujud (mesti unik).');
  }

  const objek = {
    ID_Pelajar: idPelajar,
    NoKP: String(p.nokp || '').trim(),
    Nama: nama,
    Jantina: String(p.jantina || '').trim(),
    Kelas: kelas,
    TahunSTPM: tahunSTPM,
    Status: p.status ? String(p.status).trim() : 'AKTIF',
    Catatan: String(p.catatan || '').trim()
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_STUDENTS, sediaAda.__row, objek, HEADER_STUDENTS);
    catatAudit(sesi, 'KEMASKINI', 'PELAJAR', idPelajar, JSON.stringify(sediaAda), JSON.stringify(objek), 'Kemaskini pelajar: ' + nama);
  } else {
    tambahBaris(SHEET_STUDENTS, objek, HEADER_STUDENTS);
    catatAudit(sesi, 'TAMBAH', 'PELAJAR', idPelajar, '', JSON.stringify(objek), 'Tambah pelajar: ' + nama);
  }
  return jaya({ idPelajar });
}

function apiNyahaktifPelajar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const rekod = cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', p.idPelajar);
  if (!rekod) return ralat('Pelajar tidak dijumpai.');
  const objek = Object.assign({}, rekod, { Status: 'TIDAK_AKTIF' });
  kemaskiniBaris(SHEET_STUDENTS, rekod.__row, objek, HEADER_STUDENTS);
  catatAudit(sesi, 'NYAHAKTIF', 'PELAJAR', p.idPelajar, rekod.Status, 'TIDAK_AKTIF', 'Nyahaktif pelajar: ' + rekod.Nama);
  return jaya({});
}

/* Padam SEPENUHNYA rekod pelajar (bukan sekadar nyahaktif) — HANYA dibenarkan
   jika pelajar tiada SEBARANG rekod pendaftaran/headcount (elak rekod "anak
   yatim" merentasi ENROLLMENTS & HEADCOUNT_S1/S2/S3 yang rujuk ID_Pelajar
   yang sudah tiada). Jika pelajar sudah ada sejarah akademik, guna
   "Nyahaktifkan" — kekalkan rekod untuk audit/laporan sejarah. */
function apiPadamPelajar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const rekod = cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar);
  if (!rekod) return ralat('Pelajar tidak dijumpai.');

  const adaEnrolmen = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).some(e => e.ID_Pelajar === idPelajar);
  const adaHeadcount = ['S1', 'S2', 'S3'].some(sem => bacaSheetSebagaiObjek(sheetHeadcount(sem)).some(h => h.ID_Pelajar === idPelajar));
  if (adaEnrolmen || adaHeadcount) {
    return ralat('Pelajar ini sudah mempunyai rekod pendaftaran subjek dan/atau headcount — tidak boleh dipadam terus ' +
      '(elak kehilangan data). Sila guna butang "Nyahaktifkan" (kemaskini Status) sebagai gantinya.');
  }

  const sh = dapatkanSheet(SHEET_STUDENTS);
  sh.deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'PELAJAR', idPelajar, JSON.stringify(rekod), '', 'Padam pelajar: ' + rekod.Nama);
  return jaya({});
}

/* ======================= ARKIB (pelajar tamat belajar selepas Semester 3) =======================
   Status 'TAMAT' — rekod KEKAL (headcount/intervensi/ulangan sejarah tidak disentuh),
   hanya disembunyikan daripada senarai Pelajar harian (rujuk apiSenaraiPelajar di atas)
   dan dipaparkan berasingan di menu "Arkib". */
function apiArkibkanPelajar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const rekod = cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', p.idPelajar);
  if (!rekod) return ralat('Pelajar tidak dijumpai.');
  const objek = Object.assign({}, rekod, { Status: 'TAMAT' });
  kemaskiniBaris(SHEET_STUDENTS, rekod.__row, objek, HEADER_STUDENTS);
  catatAudit(sesi, 'ARKIB', 'PELAJAR', p.idPelajar, rekod.Status, 'TAMAT', 'Arkibkan pelajar (tamat belajar): ' + rekod.Nama);
  return jaya({});
}

/* Arkibkan SEMUA pelajar AKTIF bagi satu Tahun STPM sekali gus — dipakai selepas
   satu kohort selesai Semester 3 (cth. selepas keputusan STPM sebenar diumumkan). */
function apiArkibkanKohort(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!tahunSTPM) return ralat('Tahun STPM wajib dinyatakan.');

  const sasaran = bacaSheetSebagaiObjek(SHEET_STUDENTS)
    .filter(s => String(s.TahunSTPM) === tahunSTPM && String(s.Status).toUpperCase() === 'AKTIF');
  sasaran.forEach(s => kemaskiniBaris(SHEET_STUDENTS, s.__row, Object.assign({}, s, { Status: 'TAMAT' }), HEADER_STUDENTS));

  catatAudit(sesi, 'ARKIB_KOHORT', 'PELAJAR', tahunSTPM, '', sasaran.length + ' pelajar',
    'Arkibkan kohort Tahun STPM ' + tahunSTPM + ' (tamat belajar)');
  return jaya({ bilangan: sasaran.length });
}

/* Terbalikkan arkib (silap arkibkan) — pulihkan Status kepada AKTIF. */
function apiNyahArkibPelajar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const rekod = cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', p.idPelajar);
  if (!rekod) return ralat('Pelajar tidak dijumpai.');
  const objek = Object.assign({}, rekod, { Status: 'AKTIF' });
  kemaskiniBaris(SHEET_STUDENTS, rekod.__row, objek, HEADER_STUDENTS);
  catatAudit(sesi, 'NYAH_ARKIB', 'PELAJAR', p.idPelajar, 'TAMAT', 'AKTIF', 'Nyah-arkib pelajar: ' + rekod.Nama);
  return jaya({});
}

/* ======================= TUKAR KELAS (dengan auto-tukar subjek) =======================
   Kelas ditukar; pendaftaran subjek SEDIA ADA pelajar (ENROLLMENTS, Tahun STPM sama)
   DIGANTIKAN SEPENUHNYA dengan set subjek yang diambil oleh pelajar LAIN dalam kelas
   BAHARU (anggap satu kelas = satu aliran/set subjek sama, cth. kelas Sains/Sastera).
   Rekod HEADCOUNT/INTERVENSI/ULANGAN sejarah bagi subjek lama TIDAK disentuh (kekal
   untuk rujukan), hanya ENROLLMENTS (pendaftaran semasa) yang diganti.
   Peranan: ADMIN (semua kelas), atau GURU_TINGKATAN — tetapi HANYA bagi pelajar
   yang KELAS SEMASA dia dalam SkopKelas (kelas jagaan) guru itu. */
function apiTukarKelasPelajar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_GURU_TINGKATAN]));
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const kelasBaharu = String(p.kelasBaharu || '').trim();
  if (!idPelajar || !kelasBaharu) return ralat('ID Pelajar dan Kelas Baharu wajib diisi.');

  const rekod = cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar);
  if (!rekod) return ralat('Pelajar tidak dijumpai.');

  if (!aksesPenuh(sesi) && !kelasJagaan(sesi, rekod.Kelas)) {
    return ralat('Anda hanya boleh urus pelajar dalam kelas jagaan anda (Guru Tingkatan).');
  }
  if (String(rekod.Kelas).toUpperCase() === kelasBaharu.toUpperCase()) return ralat('Pelajar sudah berada dalam kelas ini.');

  const kelasLama = rekod.Kelas;
  const tahunSTPM = String(rekod.TahunSTPM);

  kemaskiniBaris(SHEET_STUDENTS, rekod.__row, Object.assign({}, rekod, { Kelas: kelasBaharu }), HEADER_STUDENTS);

  const shEnrol = dapatkanSheet(SHEET_ENROLLMENTS);
  const semuaEnrolmen = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS);
  const enrolmenLama = semuaEnrolmen.filter(e => e.ID_Pelajar === idPelajar && String(e.TahunSTPM) === tahunSTPM);
  enrolmenLama.sort((a, b) => b.__row - a.__row).forEach(e => shEnrol.deleteRow(e.__row));

  const idPelajarKelasBaharu = new Set(bacaSheetSebagaiObjek(SHEET_STUDENTS)
    .filter(s => s.ID_Pelajar !== idPelajar && String(s.Kelas).toUpperCase() === kelasBaharu.toUpperCase() && String(s.TahunSTPM) === tahunSTPM)
    .map(s => s.ID_Pelajar));
  const kodSubjekKelasBaharu = Array.from(new Set(semuaEnrolmen
    .filter(e => idPelajarKelasBaharu.has(e.ID_Pelajar))
    .map(e => String(e.KodSubjek))));
  kodSubjekKelasBaharu.forEach(kod => tambahBaris(SHEET_ENROLLMENTS, { ID_Pelajar: idPelajar, KodSubjek: kod, TahunSTPM: tahunSTPM }, HEADER_ENROLLMENTS));

  catatAudit(sesi, 'TUKAR_KELAS', 'PELAJAR', idPelajar,
    'Kelas=' + kelasLama + '; Subjek=' + enrolmenLama.map(e => e.KodSubjek).join(','),
    'Kelas=' + kelasBaharu + '; Subjek=' + kodSubjekKelasBaharu.join(','),
    p.sebab || ('Tukar kelas ' + kelasLama + ' -> ' + kelasBaharu));

  return jaya({ kelasLama, kelasBaharu, bilSubjekLama: enrolmenLama.length, bilSubjekBaharu: kodSubjekKelasBaharu.length });
}

/* ======================= IMPORT PUKAL PELAJAR BAHARU =======================
   p.senarai = [{idPelajar?, nokp, nama, jantina, kelas, tahunSTPM, catatan?}, ...].
   Baris yang gagal (medan wajib kosong, No.KP/ID bertindih dengan rekod sedia ada
   ATAU dalam senarai yang sama) DILANGKAU (bukan gagalkan keseluruhan import) —
   disenaraikan dalam `ralat` untuk semakan admin. */
function apiImportPelajarPukal(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const senarai = Array.isArray(p.senarai) ? p.senarai : [];
  if (!senarai.length) return ralat('Tiada data pelajar untuk diimport.');

  const sediaAda = bacaSheetSebagaiObjek(SHEET_STUDENTS);
  const idSet = new Set(sediaAda.map(s => s.ID_Pelajar));
  const nokpSet = new Set(sediaAda.map(s => String(s.NoKP)).filter(Boolean));

  let ditambah = 0;
  const ralatSenarai = [];

  senarai.forEach((item, idx) => {
    const label = 'Baris ' + (idx + 1);
    const nama = String(item.nama || '').trim();
    const kelas = String(item.kelas || '').trim();
    const tahunSTPM = String(item.tahunSTPM || '').trim();
    const nokp = String(item.nokp || '').trim();
    if (!nama || !kelas || !tahunSTPM) { ralatSenarai.push(label + ' (' + (nama || '-') + '): Nama/Kelas/Tahun STPM wajib diisi.'); return; }
    if (nokp && nokpSet.has(nokp)) { ralatSenarai.push(label + ' (' + nama + '): No. KP "' + nokp + '" sudah wujud — dilangkau.'); return; }

    let idPelajar = String(item.idPelajar || '').trim();
    if (idPelajar && idSet.has(idPelajar)) { ralatSenarai.push(label + ' (' + nama + '): ID Pelajar "' + idPelajar + '" sudah wujud — dilangkau.'); return; }
    if (!idPelajar) { do { idPelajar = janaId('P'); } while (idSet.has(idPelajar)); }

    tambahBaris(SHEET_STUDENTS, {
      ID_Pelajar: idPelajar, NoKP: nokp, Nama: nama,
      Jantina: String(item.jantina || '').trim(), Kelas: kelas, TahunSTPM: tahunSTPM,
      Status: 'AKTIF', Catatan: String(item.catatan || '').trim()
    }, HEADER_STUDENTS);

    idSet.add(idPelajar);
    if (nokp) nokpSet.add(nokp);
    ditambah++;
  });

  catatAudit(sesi, 'IMPORT_PUKAL', 'PELAJAR', '-', '', ditambah + ' pelajar',
    'Import pukal pelajar baharu (' + ditambah + ' berjaya, ' + ralatSenarai.length + ' ralat)');
  return jaya({ ditambah, ralat: ralatSenarai });
}

/* Senarai KELAS yang ada pelajar berdaftar bagi SATU mata pelajaran (+ tahun STPM
   jika dinyatakan) — dipakai untuk pemilih "Kelas yang diajar" bagi guru di
   Headcount (Isi ETR) & tab Markah Ujian, supaya guru hanya nampak kelas sebenar
   dia ajar bagi subjek tersebut (bukan semua kelas sekolah). */
function apiSenaraiKelasUntukSubjek(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!kodSubjek) return ralat('Kod Subjek wajib diisi.');
  if (!bolehAksesSubjek(sesi, kodSubjek)) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }

  /* Diagnostik: kira setiap peringkat penapisan berasingan supaya, jika senarai
     akhir kosong, punca sebenar boleh dikenal pasti terus (bukan teka) — cth.
     tiada pendaftaran langsung, ATAU pendaftaran wujud tetapi Tahun STPM tidak
     padan, ATAU pelajar berdaftar tetapi status bukan AKTIF. */
  const semuaEnrolmen = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS);
  const enrolmenSubjek = semuaEnrolmen.filter(e => String(e.KodSubjek) === kodSubjek);
  const enrolmenSubjekTahun = enrolmenSubjek.filter(e => !tahunSTPM || String(e.TahunSTPM) === tahunSTPM);
  const idBerdaftar = new Set(enrolmenSubjekTahun.map(e => e.ID_Pelajar));

  const semuaPelajar = bacaSheetSebagaiObjek(SHEET_STUDENTS);
  const pelajarBerdaftar = semuaPelajar.filter(s => idBerdaftar.has(s.ID_Pelajar));
  const pelajarAktif = pelajarBerdaftar.filter(s => String(s.Status).toUpperCase() === 'AKTIF');
  let kelasSet = new Set(pelajarAktif.map(s => s.Kelas));

  /* Jika guru ini ada tugasan EKSPLISIT ditetapkan (Tab "Tugas Saya") untuk subjek
     ini, sempitkan senarai kepada kelas yang ditugaskan sahaja (walaupun kelas lain
     ada pelajar berdaftar subjek sama) — tugasan eksplisit lebih tepat daripada
     tekaan ikut pendaftaran. Guru TANPA tugasan ditetapkan terus guna senarai ikut
     pendaftaran seperti sedia ada (keserasian ke belakang). */
  let disempitkanTugasan = false;
  if (!aksesPenuh(sesi) && !ketuaUnitBagi(sesi, kodSubjek)) {
    const semuaKelas = Array.from(kelasSet);
    let kelasAjar = sesi.skopSubjek.indexOf(kodSubjek) !== -1 ? semuaKelas : [];
    const kelasTugasan = kelasAjar.length ? kelasTugasanGuru(sesi.nokp, kodSubjek, tahunSTPM) : null;
    if (kelasTugasan) {
      disempitkanTugasan = true;
      kelasAjar = kelasAjar.filter(k => kelasTugasan.indexOf(String(k).toUpperCase()) !== -1);
    }
    // Guru Tingkatan: tambah kelas jagaan (semua subjek dalam kelas itu).
    kelasSet = new Set(kelasAjar.concat(semuaKelas.filter(k => kelasJagaan(sesi, k))));
  }

  return jaya({
    senarai: Array.from(kelasSet).filter(Boolean).sort(),
    diagnostik: {
      jumlahEnrolmenSubjek: enrolmenSubjek.length,
      jumlahEnrolmenSubjekTahun: enrolmenSubjekTahun.length,
      jumlahPelajarBerdaftar: pelajarBerdaftar.length,
      jumlahPelajarAktif: pelajarAktif.length,
      tahunDiguna: tahunSTPM || '(Semua Tahun)',
      contohTahunEnrolmenSubjek: enrolmenSubjek.slice(0, 5).map(e => String(e.TahunSTPM)),
      disempitkanTugasan: disempitkanTugasan
    }
  });
}

/* Senarai KELAS sekolah sebenar (daripada STUDENTS terus, BUKAN daripada
   ENROLLMENTS) — dipakai untuk pemilih Kelas semasa PENDAFTARAN pukal, sebab
   pada ketika ini pelajar mungkin belum berdaftar ke mana-mana subjek lagi
   (ayam-telur dengan apiSenaraiKelasUntukSubjek). */
function apiSenaraiKelasSekolah(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const kelasSet = new Set(bacaSheetSebagaiObjek(SHEET_STUDENTS)
    .filter(s => String(s.Status).toUpperCase() === 'AKTIF' && (!tahunSTPM || String(s.TahunSTPM) === tahunSTPM))
    .map(s => s.Kelas));
  return jaya({ senarai: Array.from(kelasSet).filter(Boolean).sort() });
}

/* ------------------------- MODUL 4: PENDAFTARAN PELAJAR-SUBJEK ------------------------- */
function apiSenaraiPendaftaran(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  let senarai = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS);
  if (p.idPelajar) senarai = senarai.filter(e => e.ID_Pelajar === p.idPelajar);
  return jaya({ senarai });
}

/* Daftarkan SEMUA pelajar aktif dalam satu Kelas (+ Tahun STPM) ke satu Subjek
   sekali gus — cara paling praktikal untuk sekolah (satu kelas ambil subjek
   sama), berbanding daftar seorang demi seorang. Pelajar yang sudah berdaftar
   dilangkau (bukan ralat) supaya boleh dijalankan berulang kali dengan selamat. */
function apiDaftarSubjekPukal(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  const kelas = String(p.kelas || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!kodSubjek || !kelas || !tahunSTPM) return ralat('Kod Subjek, Kelas dan Tahun STPM wajib diisi.');
  if (!cariBarisMengikutId(SHEET_SUBJECTS, 'KodSubjek', kodSubjek)) return ralat('Mata pelajaran tidak dijumpai.');

  const pelajarKelas = bacaSheetSebagaiObjek(SHEET_STUDENTS).filter(s =>
    String(s.Status).toUpperCase() === 'AKTIF' && String(s.Kelas).toUpperCase() === kelas.toUpperCase() && String(s.TahunSTPM) === tahunSTPM);
  if (!pelajarKelas.length) return ralat('Tiada pelajar aktif dalam kelas "' + kelas + '" bagi Tahun STPM ' + tahunSTPM + '.');

  const enrolSediaAda = new Set(bacaSheetSebagaiObjek(SHEET_ENROLLMENTS)
    .filter(e => String(e.KodSubjek) === kodSubjek && String(e.TahunSTPM) === tahunSTPM).map(e => e.ID_Pelajar));

  let bilBaharu = 0;
  pelajarKelas.forEach(s => {
    if (enrolSediaAda.has(s.ID_Pelajar)) return;
    tambahBaris(SHEET_ENROLLMENTS, { ID_Pelajar: s.ID_Pelajar, KodSubjek: kodSubjek, TahunSTPM: tahunSTPM }, HEADER_ENROLLMENTS);
    bilBaharu++;
  });

  catatAudit(sesi, 'TAMBAH', 'PENDAFTARAN_PUKAL', kodSubjek + '-' + kelas, '',
    bilBaharu + ' drpd ' + pelajarKelas.length + ' pelajar', 'Daftar pukal kelas ' + kelas + ' ke subjek ' + kodSubjek);
  return jaya({ bilBaharu, jumlahKelas: pelajarKelas.length });
}

function apiDaftarSubjek(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!idPelajar || !kodSubjek || !tahunSTPM) return ralat('ID Pelajar, Kod Subjek dan Tahun STPM wajib diisi.');
  if (!cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar)) return ralat('Pelajar tidak dijumpai.');
  if (!cariBarisMengikutId(SHEET_SUBJECTS, 'KodSubjek', kodSubjek)) return ralat('Mata pelajaran tidak dijumpai.');

  const sediaAda = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).find(e =>
    e.ID_Pelajar === idPelajar && String(e.KodSubjek) === kodSubjek && String(e.TahunSTPM) === tahunSTPM);
  if (sediaAda) return ralat('Pelajar ini sudah berdaftar untuk subjek & tahun STPM tersebut.');

  tambahBaris(SHEET_ENROLLMENTS, { ID_Pelajar: idPelajar, KodSubjek: kodSubjek, TahunSTPM: tahunSTPM }, HEADER_ENROLLMENTS);
  catatAudit(sesi, 'TAMBAH', 'PENDAFTARAN', idPelajar + '-' + kodSubjek, '', '', 'Daftar ' + idPelajar + ' ke subjek ' + kodSubjek);
  return jaya({});
}

function apiBatalDaftarSubjek(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const sh = dapatkanSheet(SHEET_ENROLLMENTS);
  const semua = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS);
  const rekod = semua.find(e => e.ID_Pelajar === p.idPelajar && String(e.KodSubjek) === String(p.kodSubjek) && String(e.TahunSTPM) === String(p.tahunSTPM));
  if (!rekod) return ralat('Pendaftaran tidak dijumpai.');
  sh.deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'PENDAFTARAN', p.idPelajar + '-' + p.kodSubjek, '', '', 'Batal daftar');
  return jaya({});
}
