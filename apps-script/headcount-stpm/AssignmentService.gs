/* =========================================================================
 * AssignmentService.gs — "TUGAS SAYA": penetapan SUBJEK + KELAS diajar bagi
 * setiap guru (lebih terperinci daripada SkopSubjek di USERS, yang hanya
 * peringkat subjek). Lapisan TAMBAHAN sahaja — tidak menggantikan SkopSubjek
 * (kebenaran sedia ada di seluruh sistem kekal rujuk SkopSubjek); tugasan di
 * sini dipakai untuk (a) paparan "Tugas Saya" bagi guru semak sendiri, dan
 * (b) tapis pilihan Kelas di Isi ETR/Markah Ujian JIKA guru ada tugasan
 * ditetapkan (fallback ke tingkah laku sedia ada — ikut pendaftaran+skopSubjek
 * — jika guru itu belum ada sebarang tugasan ditetapkan, supaya sekolah yang
 * belum guna ciri ini tidak terjejas).
 * ========================================================================= */

const HEADER_TEACHING_ASSIGNMENTS = ['ID_Tugasan', 'NoKP', 'KodSubjek', 'Kelas', 'TahunSTPM', 'StatusAktif'];

/* Senarai tugasan. PERANAN_AKSES_PENUH boleh lihat/tapis semua (ikut p.nokp/
   p.kodSubjek/p.tahunSTPM jika diisi, untuk panel urus); peranan lain HANYA
   nampak tugasan diri sendiri (p.nokp diabaikan — server tentukan, bukan client). */
function apiSenaraiTugasan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  let senarai = bacaSheetSebagaiObjek(SHEET_TEACHING_ASSIGNMENTS);
  if (PERANAN_AKSES_PENUH.includes(sesi.peranan)) {
    if (p.nokp) senarai = senarai.filter(t => String(t.NoKP) === String(p.nokp));
  } else {
    senarai = senarai.filter(t => String(t.NoKP) === String(sesi.nokp));
  }
  if (p.kodSubjek) senarai = senarai.filter(t => String(t.KodSubjek) === String(p.kodSubjek));
  if (p.tahunSTPM) senarai = senarai.filter(t => String(t.TahunSTPM) === String(p.tahunSTPM));

  return jaya({ senarai });
}

function apiSimpanTugasan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const nokp = String(p.nokp || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const kelas = String(p.kelas || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!nokp || !kodSubjek || !kelas || !tahunSTPM) return ralat('Guru (No. KP), Kod Subjek, Kelas dan Tahun STPM wajib diisi.');

  if (!cariBarisMengikutId(SHEET_USERS, 'NoKP', nokp)) return ralat('Pengguna (guru) tidak dijumpai — daftarkan di menu Pengguna dahulu.');
  if (!cariBarisMengikutId(SHEET_SUBJECTS, 'KodSubjek', kodSubjek)) return ralat('Mata pelajaran tidak dijumpai.');

  const semua = bacaSheetSebagaiObjek(SHEET_TEACHING_ASSIGNMENTS);
  const pendua = semua.find(t => String(t.NoKP) === nokp && String(t.KodSubjek) === kodSubjek &&
    String(t.Kelas).toUpperCase() === kelas.toUpperCase() && String(t.TahunSTPM) === tahunSTPM);
  if (pendua) return ralat('Tugasan ini sudah wujud (guru + subjek + kelas + tahun yang sama).');

  const objek = {
    ID_Tugasan: janaId('TGS'), NoKP: nokp, KodSubjek: kodSubjek, Kelas: kelas, TahunSTPM: tahunSTPM,
    StatusAktif: p.statusAktif ? String(p.statusAktif).trim() : 'AKTIF'
  };
  tambahBaris(SHEET_TEACHING_ASSIGNMENTS, objek, HEADER_TEACHING_ASSIGNMENTS);
  catatAudit(sesi, 'TAMBAH', 'TUGASAN', objek.ID_Tugasan, '', JSON.stringify(objek),
    'Tetapkan tugasan: ' + nokp + ' -> ' + kodSubjek + ' (' + kelas + ', ' + tahunSTPM + ')');
  return jaya({ idTugasan: objek.ID_Tugasan });
}

function apiPadamTugasan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const idTugasan = String(p.idTugasan || '').trim();
  const rekod = cariBarisMengikutId(SHEET_TEACHING_ASSIGNMENTS, 'ID_Tugasan', idTugasan);
  if (!rekod) return ralat('Tugasan tidak dijumpai.');

  const sh = dapatkanSheet(SHEET_TEACHING_ASSIGNMENTS);
  sh.deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'TUGASAN', idTugasan, JSON.stringify(rekod), '', 'Padam tugasan: ' + rekod.NoKP + ' / ' + rekod.KodSubjek + ' / ' + rekod.Kelas);
  return jaya({});
}

/* Kelas yang guru tertentu DITUGASKAN mengajar bagi SATU subjek (StatusAktif=AKTIF
   sahaja). Pulangkan null (bukan senarai kosong) jika guru itu LANGSUNG tiada
   tugasan ditetapkan untuk subjek ini — pemanggil (apiSenaraiKelasUntukSubjek)
   guna null sebagai isyarat "fallback ke tingkah laku lama (ikut pendaftaran)",
   supaya guru yang belum ada tugasan eksplisit tidak tersekat drpd kerja. */
function kelasTugasanGuru(nokp, kodSubjek, tahunSTPM) {
  const tugasan = bacaSheetSebagaiObjek(SHEET_TEACHING_ASSIGNMENTS)
    .filter(t => String(t.NoKP) === String(nokp) && String(t.KodSubjek) === String(kodSubjek) &&
      String(t.StatusAktif).toUpperCase() === 'AKTIF' && (!tahunSTPM || String(t.TahunSTPM) === String(tahunSTPM)));
  if (!tugasan.length) return null;
  return Array.from(new Set(tugasan.map(t => String(t.Kelas).toUpperCase())));
}
