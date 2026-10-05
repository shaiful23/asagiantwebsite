/* =========================================================================
 * SISTEM e-PAJSK SMK ASAJAYA
 * -------------------------------------------------------------------------
 * Pentaksiran Aktiviti Jasmani, Sukan dan Kokurikulum (PAJSK) — menggantikan
 * template Google Sheet "TEMPLATE PAJSK SMK ASAJAYA". Database = Google Sheet
 * ini; backend + frontend = Google Apps Script (satu Web App SPA).
 *
 * Peranan: ADMIN dan GURU_KELAS sahaja. Data murid, unit, kehadiran dan
 * pencapaian ditarik terus daripada Sheet e-Kokurikulum (KokoService.gs).
 * Termasuk Arkib Tahunan dan Naik Tingkatan (ArkibService.gs).
 *
 * CARA PASANG: rujuk README.md dalam folder ini.
 * ========================================================================= */

/* ============================ MENU ADMIN ============================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sistem e-PAJSK')
    .addItem('1. Sediakan Sistem (Jalankan Sekali)', 'sediakanSistemEPAJSK')
    .addItem('2. Tambah / Pulihkan Admin', 'tambahAdminMelaluiMenu')
    .addItem('3. Kira Semula Semua Markah', 'kiraSemulaMelaluiMenu')
    .addItem('4. Kosongkan Semua Cache', 'kosongkanCacheMelaluiMenu')
    .addItem('5. Pasang Auto-Segerak e-Kokurikulum', 'pasangPencetusAutoMelaluiMenu')
    .addToUi();
}

/* Cipta semua Sheet + header + data lalai jika belum wujud.
   Selamat dijalankan berulang kali — tidak akan menimpa Sheet sedia ada. */
function sediakanSistemEPAJSK() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baharu = [];
  const pastikan = (nama, header, lajurTeks, isi) => {
    const wujud = !!ss.getSheetByName(nama);
    const sh = ciptaSheetJikaTiada(ss, nama, header, lajurTeks);
    if (!wujud) {
      baharu.push(nama);
      if (isi && isi.length) sh.getRange(2, 1, isi.length, header.length).setValues(isi);
    }
    return sh;
  };

  pastikan(SHEET_PENGGUNA, HEADER_PENGGUNA, ['NoKP', 'Password']);
  pastikan(SHEET_MURID, HEADER_MURID, ['NoKP']);
  pastikan(SHEET_ASPEK, HEADER_ASPEK, ['Kunci', 'NoKP']);
  pastikan(SHEET_EKSTRA, HEADER_EKSTRA, ['NoKP']);
  pastikan(SHEET_RUMUSAN, HEADER_RUMUSAN, ['NoKP']);
  pastikan(SHEET_REFERENSI, HEADER_REFERENSI, ['KOD'], referensiLalai());
  pastikan(SHEET_TETAPAN, HEADER_TETAPAN, null, tetapanLalai());
  pastikan(SHEET_ARKIB, HEADER_ARKIB, null);
  pastikan(SHEET_AUDIT, HEADER_AUDIT, ['NoKP']);

  const lalai = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (lalai && ss.getSheets().length > 1 && lalai.getLastRow() === 0) ss.deleteSheet(lalai);
  [SHEET_PENGGUNA, SHEET_MURID, SHEET_ASPEK, SHEET_EKSTRA, SHEET_RUMUSAN, SHEET_REFERENSI, SHEET_TETAPAN, SHEET_ARKIB].forEach(tandaKotor);
  kosongkanCacheRujukan();

  const ui = SpreadsheetApp.getUi();
  ui.alert('Sistem sedia',
    (baharu.length ? 'Sheet baharu dicipta: ' + baharu.join(', ') + '.\n\n' : 'Semua Sheet sudah wujud.\n\n') +
    'Langkah seterusnya:\n' +
    '1. Tambah Admin pertama (kotak dialog akan muncul sebentar lagi jika belum ada Admin).\n' +
    '2. Deploy sebagai Web App (Execute as: Me, Who has access: Anyone).\n' +
    '3. Log masuk guna No. KP; kata laluan lalai = 6 digit terakhir No. KP (akan dipaksa tukar).\n' +
    '4. Menu Tetapan: semak Tahun Pentaksiran + ID Sheet e-Kokurikulum, kemudian Import Guru dan Segerak Murid.',
    ui.ButtonSet.OK);

  const adaAdmin = bacaSheetSebagaiObjek(SHEET_PENGGUNA).some(u => u.Peranan === ROLE_ADMIN && String(u.Status).toUpperCase() === 'AKTIF');
  if (!adaAdmin) tambahAdminMelaluiMenu();
}

/* Tambah (atau pulihkan) satu akaun Admin melalui dialog Sheet — tiada No. KP ditanam dalam kod. */
function tambahAdminMelaluiMenu() {
  const ui = SpreadsheetApp.getUi();
  const r1 = ui.prompt('Tambah Admin', 'No. Kad Pengenalan (12 digit, tanpa tanda "-"):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const nokp = normalKP(r1.getResponseText());
  if (nokp.length !== 12) { ui.alert('No. KP mesti 12 digit.'); return; }
  const r2 = ui.prompt('Tambah Admin', 'Nama penuh:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const nama = String(r2.getResponseText()).trim().toUpperCase();
  if (!nama) { ui.alert('Nama diperlukan.'); return; }

  const sedia = bacaSheetSebagaiObjek(SHEET_PENGGUNA).find(u => normalKP(u.NoKP) === nokp);
  const objek = {
    NoKP: nokp, Password: cincangKataLaluan(nokp, kataLaluanLalaiDaripadaIC(nokp)), Peranan: ROLE_ADMIN, NamaPenuh: nama,
    KelasDijaga: '', MestiTukarPassword: 'YA', Status: 'AKTIF', Emel: sedia ? sedia.Emel : ''
  };
  if (sedia) kemaskiniBaris(SHEET_PENGGUNA, sedia.__row, objek); else tambahBaris(SHEET_PENGGUNA, objek);
  CacheService.getScriptCache().remove('gagal_epajsk_' + nokp);
  ui.alert('Admin ' + nama + ' sedia. Kata laluan = 6 digit terakhir No. KP (" ' + kataLaluanLalaiDaripadaIC(nokp) + ' "), akan dipaksa tukar semasa log masuk pertama.');
}

function kiraSemulaMelaluiMenu() {
  const ui = SpreadsheetApp.getUi();
  const hasil = denganKunci(() => kiraSemulaSemua(null));
  if (hasil.success === false) { ui.alert(hasil.message); return; }
  ui.alert('Siap. ' + hasil.murid + ' murid dikira semula menggunakan jadual REFERENSI semasa.');
}

function kosongkanCacheMelaluiMenu() {
  [SHEET_PENGGUNA, SHEET_MURID, SHEET_ASPEK, SHEET_EKSTRA, SHEET_RUMUSAN, SHEET_REFERENSI, SHEET_TETAPAN, SHEET_ARKIB].forEach(tandaKotor);
  SpreadsheetApp.getUi().alert('Semua cache data dikosongkan. Data akan dibaca semula daripada Sheet pada permintaan seterusnya.');
}

/* Trigger ringkas: suntingan MANUAL dalam Sheet menaikkan versi cache Sheet berkenaan supaya sistem
   tidak memaparkan data lapuk. (Perubahan oleh sistem sendiri sudah menaikkan versi secara automatik.) */
function onEdit(e) {
  try { tandaKotor(e.range.getSheet().getName()); } catch (x) { /* abaikan */ }
}

/* ============================== doGet ================================ */
function doGet(e) {
  if (e && e.parameter && e.parameter.aksi === 'ping') return balasPing(e.parameter);
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.kodKiraan = kodKiraanUntukKlien();
  return tpl.evaluate()
    .setTitle('e-PAJSK - SMK Asajaya')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
