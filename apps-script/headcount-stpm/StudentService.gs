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
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) {
    // GURU / KETUA_PANITIA: hanya pelajar yang mengambil subjek dalam skop mereka
    const enrolments = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).filter(e => sesi.skopSubjek.includes(e.KodSubjek));
    const idDibenarkan = new Set(enrolments.map(e => e.ID_Pelajar));
    senarai = senarai.filter(s => idDibenarkan.has(s.ID_Pelajar));
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
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }

  const idBerdaftar = new Set(bacaSheetSebagaiObjek(SHEET_ENROLLMENTS)
    .filter(e => e.KodSubjek === kodSubjek && (!tahunSTPM || String(e.TahunSTPM) === tahunSTPM))
    .map(e => e.ID_Pelajar));
  const kelasSet = new Set(bacaSheetSebagaiObjek(SHEET_STUDENTS)
    .filter(s => idBerdaftar.has(s.ID_Pelajar) && String(s.Status).toUpperCase() === 'AKTIF')
    .map(s => s.Kelas));

  return jaya({ senarai: Array.from(kelasSet).filter(Boolean).sort() });
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
    .filter(e => e.KodSubjek === kodSubjek && String(e.TahunSTPM) === tahunSTPM).map(e => e.ID_Pelajar));

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
    e.ID_Pelajar === idPelajar && e.KodSubjek === kodSubjek && String(e.TahunSTPM) === tahunSTPM);
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
  const rekod = semua.find(e => e.ID_Pelajar === p.idPelajar && e.KodSubjek === p.kodSubjek && String(e.TahunSTPM) === String(p.tahunSTPM));
  if (!rekod) return ralat('Pendaftaran tidak dijumpai.');
  sh.deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'PENDAFTARAN', p.idPelajar + '-' + p.kodSubjek, '', '', 'Batal daftar');
  return jaya({});
}
