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
    .addItem('4. Semak Pemasangan', 'semakPemasangan')
    .addToUi();
}

/* Semak semua fail kod wujud dan terkini (fungsi penanda daripada versi terbaharu setiap fail). */
function senaraiSemakPemasangan() {
  return {
    'Config.gs': ['VERSI_SKEMA'], 'Utils.gs': ['bacaSheetSebagaiObjek', 'upsertBanyak'], 'Migrasi.gs': ['selaraskanSkema', 'pastikanSkema'],
    'AuthService.gs': ['apiLogin', 'apiTukarPasswordSendiri'], 'AuditService.gs': ['apiSenaraiAudit'], 'TetapanService.gs': ['apiSimpanTetapan', 'dataTetapan'],
    'StafService.gs': ['apiAgihStafAuto'], 'AjkService.gs': ['apiSimpanAhliAjk'], 'MuridService.gs': ['apiSimpanMurid', 'apiKunciRumahMurid'],
    'AgihanService.gs': ['apiSimpanAgihan'], 'PortalService.gs': ['apiMula', 'apiPortalMurid'],
    'ArkibService.gs': ['apiPratontonNaik', 'apiJalankanNaik', 'apiBatalNaik', 'apiArkib', 'apiArkibKejohanan', 'apiMulaTahunBaharu'],
    'KejohananService.gs': ['apiKejohanan', 'apiJanaJadual', 'apiSimpanSenaraiMula', 'apiTetapkanFinalis', 'apiLaporanKejohanan']
  };
}
function hasilSemakPemasangan() {
  const g = globalThis, hilang = [];
  const senarai = senaraiSemakPemasangan();
  Object.keys(senarai).forEach(fail => {
    const tiada = senarai[fail].filter(n => n === 'VERSI_SKEMA' ? typeof VERSI_SKEMA === 'undefined' || VERSI_SKEMA < 5 : typeof g[n] !== 'function');
    if (tiada.length) hilang.push(fail + ' (tiada / versi lama: ' + tiada.join(', ') + ')');
  });
  ['Index', 'Css', 'JsTeras', 'JsPortal', 'JsAdmin', 'JsKejohanan', 'JsArkib', 'Logo'].forEach(h => {
    try { HtmlService.createHtmlOutputFromFile(h); } catch (e) { hilang.push(h + '.html (tiada)'); }
  });
  return hilang;
}
function semakPemasangan() {
  const hilang = hasilSemakPemasangan();
  const ui = SpreadsheetApp.getUi();
  ui.alert('Semak Pemasangan', hilang.length
    ? 'Fail berikut tiada atau belum dikemas kini:\n\n• ' + hilang.join('\n• ') + '\n\nSalin semula fail tersebut daripada versi terkini, simpan, kemudian Deploy → Manage deployments → Edit → Version: New version → Deploy.'
    : 'Semua fail kod lengkap dan terkini. ✅\n\nJika portal masih memaparkan ralat "... is not a function", Web App sedang menjalankan versi deployment lama: Deploy → Manage deployments → Edit (ikon pensel) → Version: New version → Deploy, kemudian muat semula portal.',
    ui.ButtonSet.OK);
}

/* Fungsi (bukan const global): Apps Script memuatkan fail mengikut susunan dalam projek, dan Code.gs
   biasanya dimuatkan SEBELUM Config.gs — const global yang merujuk Config.gs akan gagal semasa dimuatkan
   (ReferenceError) lalu menghalang onOpen() daripada membina menu. */
function semuaSheetData() {
  return [SHEET_STAF, SHEET_MURID, SHEET_RUMAH, SHEET_AJK, SHEET_AJK_AHLI, SHEET_TETAPAN, SHEET_ACARA, SHEET_PESERTA, SHEET_MATA_LAIN, SHEET_ARKIB_MURID, SHEET_SEJARAH_NAIK];
}

/* Cipta / selaraskan semua Sheet (lihat Migrasi.gs). Selamat dijalankan berulang kali —
   tidak menimpa data sedia ada. (Web App juga menjalankan penyelarasan ini secara automatik.) */
function sediakanSistemRumahSukan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ubah = selaraskanSkema();
  PropertiesService.getScriptProperties().setProperty('VERSI_SKEMA', String(VERSI_SKEMA));

  const lalai = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (lalai && ss.getSheets().length > 1 && lalai.getLastRow() === 0) ss.deleteSheet(lalai);
  semuaSheetData().forEach(tandaKotor);

  const ui = SpreadsheetApp.getUi();
  ui.alert('Sistem sedia',
    (ubah.length ? 'Dicipta / dikemas kini: ' + ubah.join('; ') + '.\n\n' : 'Semua Sheet sudah lengkap.\n\n') +
    'Langkah seterusnya:\n' +
    '1. Tambah Admin pertama (kotak dialog akan muncul jika belum ada Admin).\n' +
    '2. Deploy sebagai Web App (Execute as: Me, Who has access: Anyone).\n' +
    '3. Log masuk Portal Guru guna No. KP; kata laluan lalai = 6 digit terakhir No. KP (akan dipaksa tukar).\n' +
    '4. Semua kerja seterusnya (rumah sukan, guru, murid, agihan, kejohanan) dibuat terus di Web App.',
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
  semuaSheetData().forEach(tandaKotor);
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
