/* =========================================================================
 * SISTEM E-BIDANG SAINS & MATEMATIK SMK ASAJAYA
 * -------------------------------------------------------------------------
 * Sistem pengurusan fail digital bagi Bidang Sains & Matematik (Panitia
 * Matematik, Sains, Kimia, Biologi, Fizik), termasuk Pesanan Radas & Bahan
 * Makmal (Sains/Kimia/Biologi/Fizik) yang diproses oleh peranan Pembantu
 * Makmal, penyegerakan tarikh Mesyuarat/Program ke Google Calendar, dan
 * notifikasi e-mel harian bagi tindakan/pesanan tertunggak. Dihoskan dalam
 * Google Apps Script, terikat pada satu Google Sheet sebagai database.
 * Backend modular (Config/Utils/Auth/User/Panitia/Document/Drive/Meeting/
 * Program/PesananMakmal/Calendar/Notifikasi/Dashboard/Audit Service)
 * menyajikan satu frontend SPA (Index.html) melalui doGet().
 *
 * CARA PASANG: rujuk README.md dalam folder ini.
 * ========================================================================= */

/* ============================ MENU ADMIN ============================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sistem E-Bidang')
    .addItem('1. Sediakan Sistem (Jalankan Sekali)', 'sediakanSistemEBidang')
    .addItem('2. Kemaskini Struktur (Emel & Kalendar)', 'kemaskiniStrukturSistem')
    .addItem('3. Aktifkan Notifikasi E-mel Harian', 'sediakanNotifikasiHarian')
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
    [['000000000000', cincangKataLaluan('000000'), ROLE_ADMIN, 'ADMIN CONTOH', '', 'YA', 'AKTIF', '', '',
      '', '', '', '', '', '', '', '', '']]);

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
  pastikanSheet(SHEET_PERANCANGAN_STRATEGIK, HEADER_PERANCANGAN_STRATEGIK, []);
  pastikanSheet(SHEET_PELAN_TAKTIKAL, HEADER_PELAN_TAKTIKAL, []);
  pastikanSheet(SHEET_PELAN_OPERASI, HEADER_PELAN_OPERASI, []);
  pastikanSheet(SHEET_AKTIVITI_TAHUNAN, HEADER_AKTIVITI_TAHUNAN, []);

  SpreadsheetApp.getUi().alert(
    'Sistem sedia. Semua 16 Sheet (USERS, PANITIA, KATEGORI_DOKUMEN, DOKUMEN, MESYUARAT, ' +
    'KEHADIRAN_MESYUARAT, TINDAKAN_SUSULAN, PROGRAM, EVIDENS, AUDIT_LOG, PESANAN_MAKMAL, ' +
    'ITEM_PESANAN_MAKMAL, PERANCANGAN_STRATEGIK, PELAN_TAKTIKAL, PELAN_OPERASI, AKTIVITI_TAHUNAN) telah dicipta.\n\n' +
    'Log masuk kali pertama guna No. KP "000000000000" dan kata laluan "000000", kemudian ' +
    'tambah pengguna sebenar dalam menu Pengguna (kata laluan lalai = 6 digit terakhir No. KP, ' +
    'sistem akan paksa tukar kata laluan selepas log masuk pertama). Padam baris "ADMIN CONTOH" ' +
    'selepas admin sebenar ditambah. Tetapkan Ketua Panitia setiap panitia di menu Panitia. ' +
    'Tambah sekurang-kurangnya seorang pengguna berperanan "Pembantu Makmal" bagi SETIAP Makmal ' +
    '(Makmal Sains 1-4) — setiap Pembantu Makmal ditetapkan kepada Makmal yang dijaganya sendiri ' +
    'di borang Pengguna, dan hanya akan menerima Pesanan Radas & Bahan bagi Makmal berkenaan. ' +
    'Peranan "Ketua Pembantu Makmal" (pilihan) boleh ditambah untuk melihat/memproses pesanan ' +
    'merentasi SEMUA Makmal. Jika mahu aktifkan notifikasi e-mel, isi lajur "Emel" bagi setiap ' +
    'pengguna (di menu Pengguna) kemudian jalankan "3. Aktifkan Notifikasi E-mel Harian". ' +
    'Setiap pengguna boleh lengkapkan profil sendiri (gambar, jawatan, kelayakan, dll.) di ' +
    'menu "Profil Saya" selepas log masuk — hasilnya dipaparkan di menu "Carta Organisasi".'
  );
}

/* Tambah lajur baharu (Emel pada USERS; EventIdKalendar pada MESYUARAT & PROGRAM)
   pada deployment SEDIA ADA yang dinaik taraf daripada versi sebelum ciri Emel/
   Kalendar wujud. Sheet baharu (dicipta oleh sediakanSistemEBidang di atas) sudah
   terus ada lajur ini — fungsi ini hanya diperlukan sekali sahaja selepas naik
   taraf kod, dan selamat dijalankan berulang kali (tiada kesan jika sudah terkini). */
function kemaskiniStrukturSistem() {
  const perubahan = [];
  if (tambahLajurJikaTiada(SHEET_USERS, 'Emel')) perubahan.push('USERS.Emel');
  if (tambahLajurJikaTiada(SHEET_MESYUARAT, 'EventIdKalendar')) perubahan.push('MESYUARAT.EventIdKalendar');
  if (tambahLajurJikaTiada(SHEET_PROGRAM, 'EventIdKalendar')) perubahan.push('PROGRAM.EventIdKalendar');
  if (tambahLajurJikaTiada(SHEET_USERS, 'MakmalDijaga')) perubahan.push('USERS.MakmalDijaga');
  if (tambahLajurJikaTiada(SHEET_PESANAN_MAKMAL, 'Makmal')) perubahan.push('PESANAN_MAKMAL.Makmal');
  if (tambahLajurJikaTiada(SHEET_PESANAN_MAKMAL, 'MasaMula')) perubahan.push('PESANAN_MAKMAL.MasaMula');
  if (tambahLajurJikaTiada(SHEET_PESANAN_MAKMAL, 'MasaTamat')) perubahan.push('PESANAN_MAKMAL.MasaTamat');
  if (tambahLajurJikaTiada(SHEET_MESYUARAT, 'MasaMula')) perubahan.push('MESYUARAT.MasaMula');
  if (tambahLajurJikaTiada(SHEET_MESYUARAT, 'MasaTamat')) perubahan.push('MESYUARAT.MasaTamat');
  if (tambahLajurJikaTiada(SHEET_PROGRAM, 'MasaMula')) perubahan.push('PROGRAM.MasaMula');
  if (tambahLajurJikaTiada(SHEET_PROGRAM, 'MasaTamat')) perubahan.push('PROGRAM.MasaTamat');
  ['GambarProfilUrl', 'GambarProfilFailId', 'Jawatan', 'NoTelefon', 'KelayakanAkademik',
    'OpsyenPengkhususan', 'GredJawatan', 'KelasDiajar', 'TahunMulaSubjekSemasa'].forEach(lajur => {
    if (tambahLajurJikaTiada(SHEET_USERS, lajur)) perubahan.push('USERS.' + lajur);
  });
  [
    [SHEET_PERANCANGAN_STRATEGIK, HEADER_PERANCANGAN_STRATEGIK],
    [SHEET_PELAN_TAKTIKAL, HEADER_PELAN_TAKTIKAL],
    [SHEET_PELAN_OPERASI, HEADER_PELAN_OPERASI],
    [SHEET_AKTIVITI_TAHUNAN, HEADER_AKTIVITI_TAHUNAN]
  ].forEach(([nama, header]) => {
    if (ciptaSheetBaharuJikaTiada(nama, header)) perubahan.push(nama + ' (Sheet baharu)');
  });

  SpreadsheetApp.getUi().alert(perubahan.length
    ? 'Struktur dikemaskini: ' + perubahan.join(', ') + '.\n\nIsi lajur Emel bagi setiap ' +
      'pengguna (menu Pengguna) untuk notifikasi e-mel; lajur EventIdKalendar diisi automatik ' +
      'oleh sistem apabila Mesyuarat/Program disimpan seterusnya. Tetapkan lajur MakmalDijaga ' +
      'bagi setiap Pembantu Makmal sedia ada (menu Pengguna) supaya penyaluran Pesanan Makmal ' +
      'mengikut Makmal berfungsi dengan betul; pesanan sedia ada tanpa nilai Makmal perlu ' +
      'disunting semula (oleh guru berkenaan) untuk mengisi Makmal, Masa Mula & Masa Tamat. ' +
      'Masa Mula/Tamat pada Mesyuarat & Program adalah PILIHAN — jika dibiarkan kosong, ' +
      'event Kalendar berkaitan kekal sehari penuh (all-day) seperti sebelum ini. Setiap ' +
      'pengguna boleh lengkapkan profil sendiri (gambar, jawatan, no. telefon, kelayakan, ' +
      'opsyen, gred jawatan, kelas diajar, tahun mula mengajar subjek semasa) di menu ' +
      '"Profil Saya" selepas log masuk — tiada tindakan admin diperlukan bagi lajur ini. ' +
      'Sheet baharu (jika ada) bagi menu "Perancangan Strategik" (PS/PT/PO & Carta Gantt) ' +
      'sedia digunakan serta-merta — tiada tindakan tambahan diperlukan.'
    : 'Tiada kemaskini diperlukan — struktur sudah terkini.');
}

/* Tetapkan pencetus terjadual (time-driven trigger) untuk hantarNotifikasiHarian()
   (NotifikasiService.gs) setiap hari lebih kurang jam 7 pagi. Jalankan SEKALI
   sahaja; selamat dijalankan berulang kali (pencetus lama bagi fungsi yang sama
   dipadam dahulu supaya tidak bertindan/berganda). */
function sediakanNotifikasiHarian() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'hantarNotifikasiHarian') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('hantarNotifikasiHarian').timeBased().everyDays(1).atHour(7).create();
  SpreadsheetApp.getUi().alert(
    'Notifikasi e-mel harian diaktifkan — akan dihantar automatik lebih kurang jam 7 pagi ' +
    'setiap hari kepada: (a) guru/ketua panitia yang mempunyai tindakan susulan tertunggak/ ' +
    'tamat tempoh, dan (b) Pembantu Makmal/Admin/Ketua Bidang jika ada Pesanan Makmal menunggu ' +
    'tindakan. Hanya pengguna dengan lajur Emel diisi akan menerima e-mel.'
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
