/* =========================================================================
 * SISTEM PENGURUSAN RUMAH SUKAN — SMK ASAJAYA
 * -------------------------------------------------------------------------
 * Database = Google Sheet ini; backend + frontend = Google Apps Script
 * (satu Web App SPA, Index.html) dengan DUA portal:
 *   - Portal Guru & Staf (guru + AKP; Admin ditanda dalam Sheet STAF)
 *   - Portal Murid
 * CARA PASANG: rujuk README.md dalam folder ini.
 * ========================================================================= */

/* ============================ MENU SHEET ============================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sistem Rumah Sukan')
    .addItem('1. Sediakan Sistem (Jalankan Sekali)', 'sediakanSistemRumahSukan')
    .addItem('2. Tambah / Pulihkan Admin', 'tambahAdminMelaluiMenu')
    .addItem('3. Kosongkan Semua Cache', 'kosongkanCacheMelaluiMenu')
    .addToUi();
}

const SEMUA_SHEET_DATA = [SHEET_STAF, SHEET_MURID, SHEET_RUMAH, SHEET_AJK, SHEET_AJK_AHLI, SHEET_TETAPAN];

/* Cipta semua Sheet + header + data lalai jika belum wujud.
   Selamat dijalankan berulang kali — tidak akan menimpa Sheet sedia ada. */
function sediakanSistemRumahSukan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baharu = [];
  const pastikan = (nama, header, isi) => {
    const wujud = !!ss.getSheetByName(nama);
    const sh = ciptaSheetJikaTiada(ss, nama, header, LAJUR_TEKS[nama]);
    if (!wujud) {
      baharu.push(nama);
      if (isi && isi.length) sh.getRange(2, 1, isi.length, header.length).setValues(isi);
    }
    return sh;
  };

  pastikan(SHEET_STAF, HEADER_STAF);
  pastikan(SHEET_MURID, HEADER_MURID);
  pastikan(SHEET_RUMAH, HEADER_RUMAH, RUMAH_LALAI);
  pastikan(SHEET_AJK, HEADER_AJK, [
    ['AJK-TEKNIK', 'AJK TEKNIK', 'Pengurusan padang, peralatan & balapan', 1],
    ['AJK-HADIAH', 'AJK HADIAH & PIALA', 'Penyediaan hadiah, pingat & piala', 2],
    ['AJK-PENGADIL', 'AJK PENGADIL & HAKIM', 'Pengadilan acara padang & balapan', 3],
    ['AJK-REKOD', 'AJK REKOD & KEPUTUSAN', 'Rekod & pengumuman keputusan', 4]
  ]);
  pastikan(SHEET_AJK_AHLI, HEADER_AJK_AHLI);
  pastikan(SHEET_TETAPAN, HEADER_TETAPAN, tetapanLalai());
  pastikan(SHEET_AUDIT, HEADER_AUDIT);

  const lalai = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (lalai && ss.getSheets().length > 1 && lalai.getLastRow() === 0) ss.deleteSheet(lalai);
  SEMUA_SHEET_DATA.forEach(tandaKotor);

  const ui = SpreadsheetApp.getUi();
  ui.alert('Sistem sedia',
    (baharu.length ? 'Sheet baharu dicipta: ' + baharu.join(', ') + '.\n\n' : 'Semua Sheet sudah wujud.\n\n') +
    'Langkah seterusnya:\n' +
    '1. Tambah Admin pertama (kotak dialog akan muncul jika belum ada Admin).\n' +
    '2. Deploy sebagai Web App (Execute as: Me, Who has access: Anyone).\n' +
    '3. Log masuk Portal Guru guna No. KP; kata laluan lalai = 6 digit terakhir No. KP (akan dipaksa tukar).\n' +
    '4. Tetapkan rumah sukan, import guru/staf & murid, tanda atlet, kemudian jalankan Agihan.',
    ui.ButtonSet.OK);

  const adaAdmin = bacaSheetSebagaiObjek(SHEET_STAF).some(u => ya(u.Admin) && aktif(u));
  if (!adaAdmin) tambahAdminMelaluiMenu();
}

/* Tambah (atau pulihkan) satu akaun Admin melalui dialog Sheet — tiada No. KP ditanam dalam kod. */
function tambahAdminMelaluiMenu() {
  const ui = SpreadsheetApp.getUi();
  const r1 = ui.prompt('Tambah Admin', 'No. Kad Pengenalan (12 digit, tanpa tanda "-"):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const nokp = normalKP(r1.getResponseText());
  if (nokp.length !== 12) { ui.alert('No. KP mesti 12 digit.'); return; }
  const sedia = bacaSheetSebagaiObjek(SHEET_STAF).find(u => normalKP(u.NoKP) === nokp);
  let nama = sedia ? sedia.NamaPenuh : '';
  if (!sedia) {
    const r2 = ui.prompt('Tambah Admin', 'Nama penuh:', ui.ButtonSet.OK_CANCEL);
    if (r2.getSelectedButton() !== ui.Button.OK) return;
    nama = banding(r2.getResponseText());
    if (!nama) { ui.alert('Nama diperlukan.'); return; }
  }
  const objek = Object.assign({}, sedia || { Kategori: 'GURU', Jantina: jantinaDaripadaKP(nokp), RumahId: '', PerananRumah: '' }, {
    NoKP: nokp, NamaPenuh: nama, Password: '', Admin: 'YA', MestiTukarPassword: 'YA', Status: 'AKTIF', Dikemaskini: sekarangTeks()
  });
  if (sedia) kemaskiniBaris(SHEET_STAF, sedia.__row, objek); else tambahBaris(SHEET_STAF, objek);
  CacheService.getScriptCache().remove(PREFIKS_CACHE + 'gagal_' + nokp);
  ui.alert('Admin ' + nama + ' sedia. Kata laluan = 6 digit terakhir No. KP ("' + kataLaluanLalaiDaripadaIC(nokp) + '"), akan dipaksa tukar semasa log masuk pertama.');
}

function kosongkanCacheMelaluiMenu() {
  SEMUA_SHEET_DATA.forEach(tandaKotor);
  SpreadsheetApp.getUi().alert('Semua cache data dikosongkan. Data akan dibaca semula daripada Sheet pada permintaan seterusnya.');
}

/* Trigger ringkas: suntingan MANUAL dalam Sheet menaikkan versi cache Sheet berkenaan. */
function onEdit(e) {
  try { tandaKotor(e.range.getSheet().getName()); } catch (x) { /* abaikan */ }
}

/* ============================== doGet ================================ */
/* ?portal=murid membuka terus tab Portal Murid pada skrin log masuk. */
function doGet(e) {
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.portalAwal = e && e.parameter && String(e.parameter.portal || '').toLowerCase() === 'murid' ? 'MURID' : 'STAF';
  tpl.logoSrc = 'data:image/png;base64,' + includeFile('Logo').replace(/\s+/g, '');
  return tpl.evaluate()
    .setTitle('Sistem Rumah Sukan - SMK Asajaya')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
