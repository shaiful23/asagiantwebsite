/* =========================================================================
 * GradeBoundaryService.gs — BLD (Jadual Penentuan Gred) KHUSUS SETIAP
 * SUBJEK x SEMESTER (S1/S2/S3 boleh ada julat markah berbeza untuk subjek
 * yang sama). Admin/Ketua Panitia tetapkan julat markah (0-100) bagi setiap
 * gred, per mata pelajaran PER SEMESTER, melalui UI sahaja (tiada hard-code).
 * Headcount (TOV, OTR1, AR1, OTR2, AR2, ETR, SEBENAR) menterjemah Markah ->
 * Gred menggunakan jadual ini (rujuk HeadcountService.gs & AnalysisService.gs).
 * ========================================================================= */

const HEADER_GRADE_BOUNDARIES = ['KodSubjek', 'Semester', 'Gred', 'MarkahMin', 'MarkahMax'];

function apiSenaraiBLD(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  let senarai = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES);
  if (p.kodSubjek) senarai = senarai.filter(b => String(b.KodSubjek) === String(p.kodSubjek));
  if (p.semester) senarai = senarai.filter(b => b.Semester === p.semester);
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) senarai = senarai.filter(b => sesi.skopSubjek.includes(String(b.KodSubjek)));

  senarai.sort((a, b) => String(a.KodSubjek).localeCompare(String(b.KodSubjek)) ||
    String(a.Semester).localeCompare(String(b.Semester)) || (Number(b.MarkahMin) - Number(a.MarkahMin)));
  return jaya({ senarai, senaraiGred: Object.keys(dapatkanGred()) });
}

function apiSimpanBLD(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_KETUA_PANITIA]));
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  const semester = String(p.semester || '').trim();
  const gred = String(p.gred || '').trim().toUpperCase();
  const markahMin = Number(p.markahMin);
  const markahMax = Number(p.markahMax);

  if (!kodSubjek || !gred) return ralat('Kod Subjek dan Gred wajib diisi.');
  if (SEMESTER_HEADCOUNT.indexOf(semester) === -1) return ralat('Semester tidak sah: ' + semester);
  if (isNaN(markahMin) || isNaN(markahMax) || markahMin < 0 || markahMax > 100 || markahMin > markahMax) {
    return ralat('Julat markah tidak sah — mesti antara 0-100 dan Markah Min <= Markah Max.');
  }
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }
  if (!cariBarisMengikutId(SHEET_SUBJECTS, 'KodSubjek', kodSubjek)) return ralat('Mata pelajaran tidak dijumpai.');
  const mapGred = dapatkanGred();
  if (!mapGred[gred]) return ralat('Gred "' + gred + '" tiada dalam Sheet GRADES. Tambah dahulu di sana.');

  const semua = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES);
  const bertindih = semua.find(b => String(b.KodSubjek) === kodSubjek && b.Semester === semester && String(b.Gred).toUpperCase() !== gred &&
    markahMin <= Number(b.MarkahMax) && markahMax >= Number(b.MarkahMin));
  if (bertindih) return ralat('Julat markah bertindih dengan gred ' + bertindih.Gred + ' (' + bertindih.MarkahMin + '-' + bertindih.MarkahMax + ') pada ' + semester + '.');

  const sediaAda = semua.find(b => String(b.KodSubjek) === kodSubjek && b.Semester === semester && String(b.Gred).toUpperCase() === gred);
  const objek = { KodSubjek: kodSubjek, Semester: semester, Gred: gred, MarkahMin: markahMin, MarkahMax: markahMax };

  if (sediaAda) {
    kemaskiniBaris(SHEET_GRADE_BOUNDARIES, sediaAda.__row, objek, HEADER_GRADE_BOUNDARIES);
    catatAudit(sesi, 'KEMASKINI', 'BLD', kodSubjek + '-' + semester + '-' + gred, sediaAda.MarkahMin + '-' + sediaAda.MarkahMax, markahMin + '-' + markahMax, '');
  } else {
    tambahBaris(SHEET_GRADE_BOUNDARIES, objek, HEADER_GRADE_BOUNDARIES);
    catatAudit(sesi, 'TAMBAH', 'BLD', kodSubjek + '-' + semester + '-' + gred, '', markahMin + '-' + markahMax, '');
  }
  return jaya({});
}

function apiPadamBLD(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_KETUA_PANITIA]));
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  const semester = String(p.semester || '').trim();
  const gred = String(p.gred || '').trim().toUpperCase();
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }

  const sh = dapatkanSheet(SHEET_GRADE_BOUNDARIES);
  const rekod = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES).find(b => String(b.KodSubjek) === kodSubjek && b.Semester === semester && String(b.Gred).toUpperCase() === gred);
  if (!rekod) return ralat('Rekod BLD tidak dijumpai.');
  sh.deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'BLD', kodSubjek + '-' + semester + '-' + gred, rekod.MarkahMin + '-' + rekod.MarkahMax, '', '');
  return jaya({});
}

/* Salin keseluruhan BLD satu (subjek, semester) ke (subjek, semester) lain — boleh
   subjek sama semester berbeza (cth. S1 -> S2), subjek berbeza semester sama, atau
   kedua-duanya berbeza. Memudahkan subjek/semester berkongsi julat markah yang sama. */
function apiSalinBLD(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_KETUA_PANITIA]));
  if (sesi.success === false) return sesi;

  const kodSumber = String(p.kodSubjekSumber || '').trim();
  const semSumber = String(p.semesterSumber || '').trim();
  const kodDestinasi = String(p.kodSubjekDestinasi || '').trim();
  const semDestinasi = String(p.semesterDestinasi || '').trim();

  if (!kodSumber || !semSumber || !kodDestinasi || !semDestinasi) return ralat('Subjek & semester sumber/destinasi wajib diisi.');
  if (kodSumber === kodDestinasi && semSumber === semDestinasi) return ralat('Sumber dan destinasi tidak boleh sama.');
  if (SEMESTER_HEADCOUNT.indexOf(semSumber) === -1 || SEMESTER_HEADCOUNT.indexOf(semDestinasi) === -1) {
    return ralat('Semester tidak sah.');
  }
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) &&
    (sesi.skopSubjek.indexOf(kodSumber) === -1 || sesi.skopSubjek.indexOf(kodDestinasi) === -1)) {
    return ralat('Anda tiada kebenaran untuk salah satu mata pelajaran ini.');
  }

  const semua = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES);
  const bldSumber = semua.filter(b => String(b.KodSubjek) === kodSumber && b.Semester === semSumber);
  if (!bldSumber.length) return ralat('BLD sumber (' + kodSumber + ' — ' + semSumber + ') belum ditetapkan.');

  const sh = dapatkanSheet(SHEET_GRADE_BOUNDARIES);
  semua.filter(b => String(b.KodSubjek) === kodDestinasi && b.Semester === semDestinasi)
    .sort((a, b) => b.__row - a.__row).forEach(b => sh.deleteRow(b.__row));
  bldSumber.forEach(b => tambahBaris(SHEET_GRADE_BOUNDARIES,
    { KodSubjek: kodDestinasi, Semester: semDestinasi, Gred: b.Gred, MarkahMin: b.MarkahMin, MarkahMax: b.MarkahMax }, HEADER_GRADE_BOUNDARIES));

  catatAudit(sesi, 'SALIN', 'BLD', kodSumber + '-' + semSumber + '->' + kodDestinasi + '-' + semDestinasi, '', '',
    'Salin BLD dari ' + kodSumber + ' (' + semSumber + ') ke ' + kodDestinasi + ' (' + semDestinasi + ')');
  return jaya({});
}
