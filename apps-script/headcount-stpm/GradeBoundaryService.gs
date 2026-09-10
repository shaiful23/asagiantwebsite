/* =========================================================================
 * GradeBoundaryService.gs — BLD (Jadual Penentuan Gred) KHUSUS SETIAP SUBJEK
 * Admin/Ketua Panitia tetapkan julat markah (0-100) bagi setiap gred, per
 * mata pelajaran, melalui UI sahaja (tiada hard-code). Headcount (TOV, OTR1,
 * AR1, OTR2, AR2, ETR, SEBENAR) menterjemah Markah -> Gred menggunakan
 * jadual ini (rujuk HeadcountService.gs & AnalysisService.gs).
 * ========================================================================= */

const HEADER_GRADE_BOUNDARIES = ['KodSubjek', 'Gred', 'MarkahMin', 'MarkahMax'];

function apiSenaraiBLD(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  let senarai = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES);
  if (p.kodSubjek) senarai = senarai.filter(b => b.KodSubjek === p.kodSubjek);
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) senarai = senarai.filter(b => sesi.skopSubjek.includes(b.KodSubjek));

  senarai.sort((a, b) => String(a.KodSubjek).localeCompare(String(b.KodSubjek)) || (Number(b.MarkahMin) - Number(a.MarkahMin)));
  return jaya({ senarai, senaraiGred: Object.keys(dapatkanGred()) });
}

function apiSimpanBLD(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_KETUA_PANITIA]));
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  const gred = String(p.gred || '').trim().toUpperCase();
  const markahMin = Number(p.markahMin);
  const markahMax = Number(p.markahMax);

  if (!kodSubjek || !gred) return ralat('Kod Subjek dan Gred wajib diisi.');
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
  const bertindih = semua.find(b => b.KodSubjek === kodSubjek && String(b.Gred).toUpperCase() !== gred &&
    markahMin <= Number(b.MarkahMax) && markahMax >= Number(b.MarkahMin));
  if (bertindih) return ralat('Julat markah bertindih dengan gred ' + bertindih.Gred + ' (' + bertindih.MarkahMin + '-' + bertindih.MarkahMax + ').');

  const sediaAda = semua.find(b => b.KodSubjek === kodSubjek && String(b.Gred).toUpperCase() === gred);
  const objek = { KodSubjek: kodSubjek, Gred: gred, MarkahMin: markahMin, MarkahMax: markahMax };

  if (sediaAda) {
    kemaskiniBaris(SHEET_GRADE_BOUNDARIES, sediaAda.__row, objek, HEADER_GRADE_BOUNDARIES);
    catatAudit(sesi, 'KEMASKINI', 'BLD', kodSubjek + '-' + gred, sediaAda.MarkahMin + '-' + sediaAda.MarkahMax, markahMin + '-' + markahMax, '');
  } else {
    tambahBaris(SHEET_GRADE_BOUNDARIES, objek, HEADER_GRADE_BOUNDARIES);
    catatAudit(sesi, 'TAMBAH', 'BLD', kodSubjek + '-' + gred, '', markahMin + '-' + markahMax, '');
  }
  return jaya({});
}

function apiPadamBLD(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_KETUA_PANITIA]));
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  const gred = String(p.gred || '').trim().toUpperCase();
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }

  const sh = dapatkanSheet(SHEET_GRADE_BOUNDARIES);
  const rekod = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES).find(b => b.KodSubjek === kodSubjek && String(b.Gred).toUpperCase() === gred);
  if (!rekod) return ralat('Rekod BLD tidak dijumpai.');
  sh.deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'BLD', kodSubjek + '-' + gred, rekod.MarkahMin + '-' + rekod.MarkahMax, '', '');
  return jaya({});
}

/* Salin keseluruhan BLD satu subjek ke subjek lain (memudahkan subjek berkongsi julat sama). */
function apiSalinBLD(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_KETUA_PANITIA]));
  if (sesi.success === false) return sesi;

  const sumber = String(p.kodSubjekSumber || '').trim();
  const destinasi = String(p.kodSubjekDestinasi || '').trim();
  if (!sumber || !destinasi || sumber === destinasi) return ralat('Subjek sumber dan destinasi wajib diisi dan tidak boleh sama.');
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) &&
    (sesi.skopSubjek.indexOf(sumber) === -1 || sesi.skopSubjek.indexOf(destinasi) === -1)) {
    return ralat('Anda tiada kebenaran untuk salah satu mata pelajaran ini.');
  }

  const semua = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES);
  const bldSumber = semua.filter(b => b.KodSubjek === sumber);
  if (!bldSumber.length) return ralat('Subjek sumber belum mempunyai BLD.');

  const sh = dapatkanSheet(SHEET_GRADE_BOUNDARIES);
  semua.filter(b => b.KodSubjek === destinasi).sort((a, b) => b.__row - a.__row).forEach(b => sh.deleteRow(b.__row));
  bldSumber.forEach(b => tambahBaris(SHEET_GRADE_BOUNDARIES,
    { KodSubjek: destinasi, Gred: b.Gred, MarkahMin: b.MarkahMin, MarkahMax: b.MarkahMax }, HEADER_GRADE_BOUNDARIES));

  catatAudit(sesi, 'SALIN', 'BLD', sumber + '->' + destinasi, '', '', 'Salin BLD dari ' + sumber + ' ke ' + destinasi);
  return jaya({});
}
