/* =========================================================================
 * SubjectService.gs — MODUL 3: MASTER MATA PELAJARAN
 * ========================================================================= */

const HEADER_SUBJECTS = ['KodSubjek', 'NamaSubjek', 'GuruMataPelajaran', 'KetuaPanitia', 'StatusAktif'];

function apiSenaraiSubjek(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  let senarai = bacaSheetSebagaiObjek(SHEET_SUBJECTS);
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) {
    senarai = senarai.filter(s => sesi.skopSubjek.includes(String(s.KodSubjek)));
  }
  return jaya({ senarai });
}

function apiSimpanSubjek(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim().toUpperCase();
  const namaSubjek = String(p.namaSubjek || '').trim();
  if (!kodSubjek || !namaSubjek) return ralat('Kod Subjek dan Nama Subjek wajib diisi.');

  const sediaAda = cariBarisMengikutId(SHEET_SUBJECTS, 'KodSubjek', kodSubjek);
  const objek = {
    KodSubjek: kodSubjek,
    NamaSubjek: namaSubjek,
    GuruMataPelajaran: String(p.guru || '').trim(),
    KetuaPanitia: String(p.ketuaPanitia || '').trim(),
    StatusAktif: p.statusAktif ? String(p.statusAktif).trim() : 'AKTIF'
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_SUBJECTS, sediaAda.__row, objek, HEADER_SUBJECTS);
    catatAudit(sesi, 'KEMASKINI', 'MATA_PELAJARAN', kodSubjek, JSON.stringify(sediaAda), JSON.stringify(objek), 'Kemaskini subjek: ' + namaSubjek);
  } else {
    tambahBaris(SHEET_SUBJECTS, objek, HEADER_SUBJECTS);
    catatAudit(sesi, 'TAMBAH', 'MATA_PELAJARAN', kodSubjek, '', JSON.stringify(objek), 'Tambah subjek: ' + namaSubjek);
  }
  return jaya({});
}
