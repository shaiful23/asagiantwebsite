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
    .addItem('2. Kemaskini Struktur (Markah & Gred BLD)', 'kemaskiniStrukturMarkahGred')
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
  pastikanSheet(SHEET_GRADE_BOUNDARIES, HEADER_GRADE_BOUNDARIES, nilaiLalaiBLD());
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
    'Sistem sedia. Semua 15 Sheet (CONFIG, GRADES, GRADE_BOUNDARIES, USERS, STUDENTS, SUBJECTS, ' +
    'ENROLLMENTS, HEADCOUNT_S1/S2/S3, REPEAT_S1/S2, INTERVENTIONS, INTERVENTION_LOG, AUDIT_LOG) telah dicipta.\n\n' +
    'Sila kemaskini CONFIG/GRADES ikut keperluan sekolah, tetapkan BLD (julat markah->gred) SETIAP ' +
    'subjek sebenar di menu "Skema Gred (BLD)" dalam sistem (GRADE_BOUNDARIES baru ada contoh untuk ' +
    'subjek PA sahaja — WAJIB tetapkan untuk subjek lain sebelum guru mula key-in markah), tambah ' +
    'pengguna sebenar dalam USERS (padam baris ADMIN CONTOH selepas itu), dan padam baris CONTOH lain.'
  );
}

/* Migrasi struktur lama -> struktur baharu, selamat dijalankan berulang kali
   (bahagian yang sudah berstruktur baharu dilangkau):
   1) HEADCOUNT_S1/S2/S3: Gred sahaja -> Markah + Gred (Gred sedia ada dikekalkan).
   2) GRADE_BOUNDARIES (BLD): KodSubjek+Gred sahaja -> KodSubjek+Semester+Gred
      (BLD sedia ada, jika ada, diandaikan untuk Semester 1 — SEMAK/SALIN ke
      S2/S3 di menu "Skema Gred (BLD)" selepas ini, sebab setiap semester
      kini boleh ada julat markah berlainan). */
function kemaskiniStrukturMarkahGred() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  let shBLD = ss.getSheetByName(SHEET_GRADE_BOUNDARIES);
  let jumlahBLDDimigrasi = 0;
  if (!shBLD) {
    shBLD = ss.insertSheet(SHEET_GRADE_BOUNDARIES);
    shBLD.appendRow(HEADER_GRADE_BOUNDARIES);
    shBLD.setFrozenRows(1);
    shBLD.getRange(1, 1, 1, HEADER_GRADE_BOUNDARIES.length).setFontWeight('bold');
  } else {
    const dataBLD = shBLD.getDataRange().getValues();
    const headerBLD = dataBLD[0] || [];
    if (headerBLD.indexOf('Semester') === -1) {
      const indeksBLD = {};
      headerBLD.forEach((h, i) => { indeksBLD[h] = i; });
      const barisLamaBLD = dataBLD.slice(1).filter(b => b.some(sel => sel !== '' && sel !== null));
      const barisBaruBLD = barisLamaBLD.map(b => [
        b[indeksBLD.KodSubjek], 'S1', b[indeksBLD.Gred], b[indeksBLD.MarkahMin], b[indeksBLD.MarkahMax]
      ]);

      shBLD.clear();
      shBLD.appendRow(HEADER_GRADE_BOUNDARIES);
      shBLD.setFrozenRows(1);
      shBLD.getRange(1, 1, 1, HEADER_GRADE_BOUNDARIES.length).setFontWeight('bold');
      if (barisBaruBLD.length) shBLD.getRange(2, 1, barisBaruBLD.length, HEADER_GRADE_BOUNDARIES.length).setValues(barisBaruBLD);
      jumlahBLDDimigrasi = barisBaruBLD.length;
    }
  }

  const medanLama = ['TOV', 'OTR1', 'AR1', 'OTR2', 'AR2', 'ETR', 'SEBENAR'];
  let jumlahDimigrasi = 0;
  let jumlahDilangkau = 0;

  [SHEET_HEADCOUNT_S1, SHEET_HEADCOUNT_S2, SHEET_HEADCOUNT_S3].forEach(namaSheet => {
    let sh = ss.getSheetByName(namaSheet);
    if (!sh) {
      sh = ss.insertSheet(namaSheet);
      sh.appendRow(HEADER_HEADCOUNT);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADER_HEADCOUNT.length).setFontWeight('bold');
      return;
    }

    const dataSediaAda = sh.getDataRange().getValues();
    const headerSediaAda = dataSediaAda[0] || [];
    if (headerSediaAda.indexOf('TOV_Markah') !== -1) { jumlahDilangkau++; return; } // sudah struktur baharu

    const indeks = {};
    headerSediaAda.forEach((h, i) => { indeks[h] = i; });
    const barisData = dataSediaAda.slice(1).filter(b => b.some(sel => sel !== '' && sel !== null));

    const barisBaharu = barisData.map(b => {
      const objek = {
        ID_Pelajar: b[indeks.ID_Pelajar], KodSubjek: b[indeks.KodSubjek], TahunSTPM: b[indeks.TahunSTPM],
        Catatan: indeks.Catatan !== undefined ? b[indeks.Catatan] : '',
        KemaskiniOleh: indeks.KemaskiniOleh !== undefined ? b[indeks.KemaskiniOleh] : '',
        KemaskiniPada: indeks.KemaskiniPada !== undefined ? b[indeks.KemaskiniPada] : ''
      };
      medanLama.forEach(m => {
        objek[m + '_Markah'] = '';
        objek[m + '_Gred'] = indeks[m] !== undefined ? b[indeks[m]] : '';
      });
      return HEADER_HEADCOUNT.map(h => (objek[h] !== undefined ? objek[h] : ''));
    });

    sh.clear();
    sh.appendRow(HEADER_HEADCOUNT);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER_HEADCOUNT.length).setFontWeight('bold');
    if (barisBaharu.length) sh.getRange(2, 1, barisBaharu.length, HEADER_HEADCOUNT.length).setValues(barisBaharu);
    jumlahDimigrasi += barisBaharu.length;
  });

  ui.alert(
    'Migrasi selesai.\n\n' +
    '- Sheet GRADE_BOUNDARIES kini menyokong BLD berasingan bagi setiap Subjek x Semester (S1/S2/S3).' +
    (jumlahBLDDimigrasi
      ? (' ' + jumlahBLDDimigrasi + ' rekod BLD sedia ada dipindah dan diandaikan untuk Semester 1 (S1) — ' +
         'SILA SEMAK dan salin/laraskan untuk S2 & S3 di menu "Skema Gred (BLD)" dalam sistem sebelum guru key-in markah S2/S3.')
      : ' Tetapkan BLD SETIAP subjek x semester di menu "Skema Gred (BLD)" dalam sistem sebelum key-in markah.') + '\n\n' +
    '- ' + jumlahDimigrasi + ' rekod headcount sedia ada dipindah ke struktur baharu. Gred asal dikekalkan dalam lajur "..._Gred"; ' +
    'lajur "..._Markah" masih kosong (isi semula markah asal secara manual jika perlu).\n' +
    (jumlahDilangkau ? ('- ' + jumlahDilangkau + ' Sheet headcount dilangkau (sudah berstruktur baharu).') : '')
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
