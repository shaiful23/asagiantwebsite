/* =========================================================================
 * SISTEM HEADCOUNT STPM SMK ASAJAYA
 * -------------------------------------------------------------------------
 * Skrip ini dihoskan dalam Google Apps Script (terikat pada satu Google
 * Sheet yang bertindak sebagai database — MODUL 23). Backend modular
 * (Config/Utils/Auth/Student/Subject/Headcount/Analysis/Repeat/
 * Intervention/Dashboard/Report/Audit Service) menyajikan satu frontend
 * SPA (Index.html) melalui doGet().
 *
 * CARA PASANG: rujuk README.md dalam folder ini.
 * ========================================================================= */

/* ============================ MENU ADMIN ============================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sistem Headcount STPM')
    .addItem('1. Sediakan Sistem (Jalankan Sekali)', 'sediakanSistemHeadcountSTPM')
    .addToUi();
}

/* Cipta semua Sheet + header + data contoh/konfigurasi lalai jika belum wujud.
   Selamat dijalankan berulang kali — tidak akan menimpa Sheet sedia ada. */
function sediakanSistemHeadcountSTPM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const pastikanSheet = (nama, header, contoh) => {
    let sh = ss.getSheetByName(nama);
    if (!sh) {
      sh = ss.insertSheet(nama);
      sh.appendRow(header);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
      if (contoh && contoh.length) sh.getRange(2, 1, contoh.length, header.length).setValues(contoh);
    }
    return sh;
  };

  pastikanSheet(SHEET_CONFIG, ['Key', 'Value'], nilaiLalaiConfig());
  pastikanSheet(SHEET_GRADES, ['Gred', 'NilaiGred', 'Lulus'], nilaiLalaiGrades());
  pastikanSheet(SHEET_USERS, HEADER_USERS,
    [['000000000000', '123456', ROLE_ADMIN, 'ADMIN CONTOH', '', 'AKTIF']]);
  pastikanSheet(SHEET_STUDENTS, HEADER_STUDENTS,
    [['P001', '070101130001', 'PELAJAR CONTOH', 'LELAKI', '6A AKASIA', String(new Date().getFullYear()), 'AKTIF', '']]);
  pastikanSheet(SHEET_SUBJECTS, HEADER_SUBJECTS,
    [['PA', 'PENGAJIAN AM', '', '', 'AKTIF']]);
  pastikanSheet(SHEET_ENROLLMENTS, HEADER_ENROLLMENTS, [['P001', 'PA', String(new Date().getFullYear())]]);
  pastikanSheet(SHEET_HEADCOUNT_S1, HEADER_HEADCOUNT, []);
  pastikanSheet(SHEET_HEADCOUNT_S2, HEADER_HEADCOUNT, []);
  pastikanSheet(SHEET_HEADCOUNT_S3, HEADER_HEADCOUNT, []);
  pastikanSheet(SHEET_REPEAT_S1, HEADER_REPEAT, []);
  pastikanSheet(SHEET_REPEAT_S2, HEADER_REPEAT, []);
  pastikanSheet(SHEET_INTERVENTIONS, HEADER_INTERVENTIONS, []);
  pastikanSheet(SHEET_INTERVENTION_LOG, ['ID_Log', 'ID_Intervensi', 'Timestamp', 'Catatan_Perkembangan', 'Dicatat_Oleh'], []);
  pastikanSheet(SHEET_AUDIT_LOG, HEADER_AUDIT_LOG, []);

  SpreadsheetApp.getUi().alert(
    'Sistem sedia. Semua 14 Sheet (CONFIG, GRADES, USERS, STUDENTS, SUBJECTS, ENROLLMENTS, ' +
    'HEADCOUNT_S1/S2/S3, REPEAT_S1/S2, INTERVENTIONS, INTERVENTION_LOG, AUDIT_LOG) telah dicipta.\n\n' +
    'Sila kemaskini CONFIG/GRADES ikut keperluan sekolah, tambah pengguna sebenar dalam USERS ' +
    '(padam baris ADMIN CONTOH selepas itu), dan padam baris CONTOH lain yang tidak diperlukan.'
  );
}

/* ============================== doGet ================================ */
function doGet(e) {
  const tpl = HtmlService.createTemplateFromFile('Index');
  return tpl.evaluate()
    .setTitle('Sistem Headcount STPM - SMK Asajaya')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
