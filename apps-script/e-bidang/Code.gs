/* =========================================================================
 * SISTEM E-BIDANG SAINS & MATEMATIK SMK ASAJAYA
 * -------------------------------------------------------------------------
 * Sistem pengurusan fail digital bagi Bidang Sains & Matematik (Panitia
 * Matematik, Sains, Kimia, Biologi, Fizik), termasuk Pesanan Radas & Bahan
 * Makmal (Sains/Kimia/Biologi/Fizik) yang diproses oleh peranan Pembantu
 * Makmal. Dihoskan dalam Google Apps Script, terikat pada satu Google Sheet
 * sebagai database. Backend modular (Config/Utils/Auth/User/Panitia/
 * Document/Drive/Meeting/Program/PesananMakmal/Dashboard/Audit Service)
 * menyajikan satu frontend SPA (Index.html) melalui doGet().
 *
 * CARA PASANG: rujuk README.md dalam folder ini.
 * ========================================================================= */

/* ============================ MENU ADMIN ============================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sistem E-Bidang')
    .addItem('1. Sediakan Sistem (Jalankan Sekali)', 'sediakanSistemEBidang')
    .addToUi();
}

/* Cipta semua Sheet + header + data lalai jika belum wujud.
   Selamat dijalankan berulang kali — tidak akan menimpa Sheet sedia ada. */
function sediakanSistemEBidang() {
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

  pastikanSheet(SHEET_USERS, HEADER_USERS,
    [['000000000000', cincangKataLaluan('000000'), ROLE_ADMIN, 'ADMIN CONTOH', '', 'YA', 'AKTIF']]);

  pastikanSheet(SHEET_PANITIA, HEADER_PANITIA,
    SENARAI_PANITIA.map(nama => [nama.toUpperCase(), nama, '', 'AKTIF']));

  pastikanSheet(SHEET_KATEGORI_DOKUMEN, HEADER_KATEGORI_DOKUMEN, kategoriDokumenLalai());
  pastikanSheet(SHEET_DOKUMEN, HEADER_DOKUMEN, []);
  pastikanSheet(SHEET_MESYUARAT, HEADER_MESYUARAT, []);
  pastikanSheet(SHEET_KEHADIRAN_MESYUARAT, HEADER_KEHADIRAN_MESYUARAT, []);
  pastikanSheet(SHEET_TINDAKAN_SUSULAN, HEADER_TINDAKAN_SUSULAN, []);
  pastikanSheet(SHEET_PROGRAM, HEADER_PROGRAM, []);
  pastikanSheet(SHEET_EVIDENS, HEADER_EVIDENS, []);
  pastikanSheet(SHEET_AUDIT_LOG, HEADER_AUDIT_LOG, []);
  pastikanSheet(SHEET_PESANAN_MAKMAL, HEADER_PESANAN_MAKMAL, []);
  pastikanSheet(SHEET_ITEM_PESANAN_MAKMAL, HEADER_ITEM_PESANAN_MAKMAL, []);

  SpreadsheetApp.getUi().alert(
    'Sistem sedia. Semua 12 Sheet (USERS, PANITIA, KATEGORI_DOKUMEN, DOKUMEN, MESYUARAT, ' +
    'KEHADIRAN_MESYUARAT, TINDAKAN_SUSULAN, PROGRAM, EVIDENS, AUDIT_LOG, PESANAN_MAKMAL, ' +
    'ITEM_PESANAN_MAKMAL) telah dicipta.\n\n' +
    'Log masuk kali pertama guna No. KP "000000000000" dan kata laluan "000000", kemudian ' +
    'tambah pengguna sebenar dalam menu Pengguna (kata laluan lalai = 6 digit terakhir No. KP, ' +
    'sistem akan paksa tukar kata laluan selepas log masuk pertama). Padam baris "ADMIN CONTOH" ' +
    'selepas admin sebenar ditambah. Tetapkan Ketua Panitia setiap panitia di menu Panitia. ' +
    'Tambah sekurang-kurangnya seorang pengguna berperanan "Pembantu Makmal" untuk memproses ' +
    'Pesanan Radas & Bahan daripada Panitia Sains/Kimia/Biologi/Fizik.'
  );
}

/* ============================== doGet ================================ */
function doGet(e) {
  const tpl = HtmlService.createTemplateFromFile('Index');
  return tpl.evaluate()
    .setTitle('Sistem E-Bidang Sains & Matematik - SMK Asajaya')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
