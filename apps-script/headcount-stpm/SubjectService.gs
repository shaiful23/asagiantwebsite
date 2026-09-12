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

/* Padam SEPENUHNYA rekod mata pelajaran — HANYA dibenarkan jika subjek tiada
   SEBARANG rekod pendaftaran/headcount/BLD (elak rekod "anak yatim" merentasi
   ENROLLMENTS, HEADCOUNT_S1/S2/S3 & GRADE_BOUNDARIES yang rujuk KodSubjek yang
   sudah tiada). Jika subjek sudah pernah dipakai, tukar Status kepada
   TIDAK_AKTIF sahaja (guna borang Kemaskini) — kekalkan rekod untuk sejarah. */
function apiPadamSubjek(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  const rekod = cariBarisMengikutId(SHEET_SUBJECTS, 'KodSubjek', kodSubjek);
  if (!rekod) return ralat('Mata pelajaran tidak dijumpai.');

  const adaEnrolmen = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).some(e => String(e.KodSubjek) === kodSubjek);
  const adaHeadcount = ['S1', 'S2', 'S3'].some(sem => bacaSheetSebagaiObjek(sheetHeadcount(sem)).some(h => String(h.KodSubjek) === kodSubjek));
  const adaBLD = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES).some(b => String(b.KodSubjek) === kodSubjek);
  if (adaEnrolmen || adaHeadcount || adaBLD) {
    return ralat('Mata pelajaran ini sudah mempunyai rekod pendaftaran/headcount/BLD — tidak boleh dipadam terus ' +
      '(elak kehilangan data). Tukar Status kepada TIDAK_AKTIF sebagai gantinya (borang Kemaskini di atas).');
  }

  const sh = dapatkanSheet(SHEET_SUBJECTS);
  sh.deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'MATA_PELAJARAN', kodSubjek, JSON.stringify(rekod), '', 'Padam subjek: ' + rekod.NamaSubjek);
  return jaya({});
}
