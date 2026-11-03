/* =========================================================================
 * e-KEHADIRAN SMK ASAJAYA — Kehadiran Guru & Murid (Imbas QR Kelas)
 * -------------------------------------------------------------------------
 * Google Sheets (database) + Google Apps Script (backend & SPA frontend).
 *
 * Fail:
 *   Config.gs                 pemalar, peranan, ambang amaran, tetapan lalai
 *   Utils.gs                  utiliti Sheet/tarikh/cache/audit
 *   SumberLuar.gs             e-Data & Enrolmen, e-Teach-In, IDME
 *   AuthService.gs            log masuk, sesi, peranan, tukar kata laluan
 *   KehadiranKelasService.gs  rekod harian GT/PGT, kunci 07:10, permohonan
 *   KehadiranSubjekService.gs imbas QR guru subjek / teach-in
 *   AmaranService.gs          amaran ponteng, intervensi, surat amaran
 *   DashboardService.gs       papan pemuka, analisis bulanan, profil
 *   AdminService.gs           permohonan, analisis, kod QR, pengguna
 *   Index/Gaya/Logo/App.html  SPA (identiti SMK Asajaya)
 *
 * Pengimbas kamera (kehadiranqrscanner.html) dihoskan di GitHub Pages kerana
 * Apps Script menyekat getUserMedia(); ia memanggil API JSONP di doGet().
 * ========================================================================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('e-Kehadiran')
    .addItem('1. Sediakan / Kemaskini Struktur Sistem', 'sediakanSistem')
    .addItem('2. Segar Semula Data Sistem Luar (cache)', 'segarSemulaSumberLuarMenu')
    .addItem('3. Jana Peta Kod Kelas e-Teach-In (untuk disemak)', 'janaPetaKodKelasMenu')
    .addSeparator()
    .addItem('Isi Data Contoh (percubaan sahaja)', 'isiDataContohMenu')
    .addToUi();
}

function onEdit() { try { segarSemulaSumberLuar(); } catch (e) { /* abaikan */ } }

function janaPetaKodKelasMenu() {
  const bil = janaPetaKodKelas();
  SpreadsheetApp.getUi().alert(bil + ' baris ditambah ke Sheet PETA_KOD_KELAS. Semak lajur Kelas (mesti sama seperti nama kelas penuh e-Data, cth. "2 AZARA") dan isi kod yang tiada padanan. Pemetaan dalam Sheet ini mengatasi pemetaan automatik.');
}

function segarSemulaSumberLuarMenu() {
  segarSemulaSumberLuar();
  SpreadsheetApp.getUi().alert('Cache data e-Data, e-Teach-In dan IDME telah dikosongkan. Data terkini akan dibaca semasa permintaan seterusnya.');
}

/* Cipta Sheet yang tiada + tambah lajur header yang tiada. Selamat diulang. */
function sediakanSistem(senyap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET).forEach(k => {
    const nama = SHEET[k], header = HEADER[k];
    let sh = ss.getSheetByName(nama);
    if (!sh) {
      sh = ss.insertSheet(nama);
      sh.getRange(1, 1, 1, header.length).setValues([header]);
    } else {
      const sedia = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
      const tiada = header.filter(h => sedia.indexOf(h) === -1);
      if (tiada.length) sh.getRange(1, sedia.filter(String).length + 1, 1, tiada.length).setValues([tiada]);
    }
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#0B1D6B').setFontColor('#FFFFFF');
    /* Lajur No. KP sebagai teks biasa — elak sifar hadapan hilang. */
    header.forEach((h, i) => { if (/^NoKP/.test(h)) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
  });

  const shTetapan = ss.getSheetByName(SHEET.TETAPAN);
  const kunciSedia = shTetapan.getLastRow() > 1 ? shTetapan.getRange(2, 1, shTetapan.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const baharu = TETAPAN_LALAI.filter(r => kunciSedia.indexOf(r[0]) === -1);
  if (baharu.length) shTetapan.getRange(shTetapan.getLastRow() + 1, 1, baharu.length, 3).setValues(baharu);

  const shSebab = ss.getSheetByName(SHEET.SEBAB);
  if (shSebab.getLastRow() < 2) shSebab.getRange(2, 1, SEBAB_SANDARAN.length, 4).setValues(SEBAB_SANDARAN);

  const shSlot = ss.getSheetByName(SHEET.SLOT);
  if (shSlot.getLastRow() < 2) {
    const slot = [[1, '07:30', '08:00'], [2, '08:00', '08:30'], [3, '08:30', '09:00'], [4, '09:00', '09:30'], [5, '09:30', '10:00'],
      [6, '10:20', '10:50'], [7, '10:50', '11:20'], [8, '11:20', '11:50'], [9, '11:50', '12:20'], [10, '12:20', '12:50'], [11, '12:50', '13:20']];
    shSlot.getRange(2, 2, slot.length, 2).setNumberFormat('@');
    shSlot.getRange(2, 1, slot.length, 3).setValues(slot);
  }
  if (!senyap) {
    SpreadsheetApp.getUi().alert('Struktur e-Kehadiran sedia.\n\n1) Isi Sheet GURU (No. KP, nama, peranan: ADMIN/GT/PGT/GMP/PRAKTIKAL/KAUNSELOR, kelas tingkatan).\n' +
      '2) Isi Sheet KELAS (nama kelas mesti sama seperti di e-Data, KodQR unik).\n3) Sambung sistem luar di Sheet TETAPAN (ID spreadsheet e-Data, e-Teach-In, IDME).\n' +
      '4) Deploy → Web app. Rujuk README untuk butiran.');
  }
}

/* ============================== doGet ============================== */
const API_JSONP = {
  semakSesi: apiSemakSesi,
  imbasKelas: apiImbasKelas,
  rekodKehadiranSubjek: apiRekodKehadiranSubjek
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.apiAction) {
    let hasil;
    try {
      const fn = API_JSONP[p.apiAction];
      hasil = fn ? laksanaApi(fn.name || 'apiJsonp', p, fn) : ralat('apiAction tidak dikenali.');
    } catch (err) {
      hasil = ralat('Ralat pelayan: ' + err.message);
    }
    const json = JSON.stringify(hasil);
    const cb = String(p.callback || '').replace(/[^\w.$]/g, '');
    return cb
      ? ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT)
      : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.execUrl = ScriptApp.getService().getUrl();
  return tpl.evaluate()
    .setTitle('e-Kehadiran — SMK Asajaya')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setFaviconUrl('https://smkasajaya.my/favicon.ico')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* Titik masuk tunggal klien SPA: google.script.run.jalankanApi('apiX', param).
   • hanya fungsi api* dibenarkan;
   • ralat tidak dijangka dipulangkan sebagai {success:false} (bukan pengecualian)
     supaya klien tidak tergantung;
   • idPermintaan klien → simpanan idempoten (lihat denganKunci). */
function jalankanApi(nama, p) { return laksanaApi(nama, p, typeof globalThis !== 'undefined' ? globalThis[nama] : null); }
function laksanaApi(nama, p, fn) {
  if (!/^api[A-Z]\w*$/.test(String(nama || '')) || typeof fn !== 'function') return ralat('Fungsi pelayan tidak dikenali: ' + nama);
  ID_PERMINTAAN = String((p && p.idPermintaan) || '').replace(/[^\w-]/g, '').slice(0, 64);
  try { return fn(p || {}); }
  catch (e) {
    const m = String(e && e.message || e);
    if (/lock|kunci|timed out|Service invoked too many times|too many simultaneous|Exceeded maximum execution/i.test(m)) return ralat('Pelayan sibuk seketika. Sila cuba lagi.', 'SIBUK');
    return ralat('Ralat pelayan: ' + m);
  } finally { ID_PERMINTAAN = ''; }
}

function include(nama) { return HtmlService.createHtmlOutputFromFile(nama).getContent(); }

/* ============================== DATA CONTOH ==============================
   Untuk mencuba sistem sebelum data sebenar dimasukkan. Hanya berjalan jika
   Sheet GURU masih kosong (tidak akan menimpa data sebenar). */
function isiDataContohMenu() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Isi data contoh?', 'Ini menambah guru, kelas, murid & jadual REKAAN untuk percubaan. Teruskan hanya pada salinan percubaan.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  ui.alert(isiDataContoh());
}

function isiDataContoh() {
  sediakanSistem(true);
  if (bacaSheetSebagaiObjek(SHEET.GURU).length) return 'Sheet GURU sudah berisi data — data contoh tidak diisi.';
  const kelas = [['5 ALPHA', '5', '5ALP', 'BILIK 5A'], ['5 BETA', '5', '5BET', 'BILIK 5B'], ['4 ALPHA', '4', '4ALP', 'BILIK 4A'], ['4 BETA', '4', '4BET', 'MAKMAL SAINS 1']];
  tambahBanyakBaris(SHEET.KELAS, kelas.map(k => ({ Kelas: k[0], Tingkatan: k[1], KodQR: k[2], Bilik: k[3] })));
  const guru = [
    ['800101135001', 'PENTADBIR SISTEM', 'ADMIN', ''],
    ['800202135002', 'CIKGU AMINAH BINTI ALI', 'GT, GMP', '5 ALPHA'],
    ['800303135003', 'CIKGU BONG KAH WEI', 'PGT, GMP', '5 ALPHA'],
    ['800404135004', 'CIKGU CHARLES ANAK JANTING', 'GT, GMP', '5 BETA'],
    ['800505135005', 'CIKGU DAYANG NURUL', 'GMP', ''],
    ['800606135006', 'CIKGU EMILY PRAKTIKAL', 'PRAKTIKAL', ''],
    ['800707135007', 'CIKGU FARID KAUNSELOR', 'KAUNSELOR', '']
  ];
  tambahBanyakBaris(SHEET.GURU, guru.map(g => ({ NoKP: "'" + g[0], Nama: g[1], Peranan: g[2], KelasTingkatan: g[3], Status: 'AKTIF' })));
  const namaDepan = ['AHMAD', 'SITI', 'MUHAMMAD', 'NUR', 'JOHN', 'MARY', 'LIM', 'TAN', 'ALIF', 'AISYAH', 'DANIEL', 'SARAH'];
  const murid = [];
  kelas.forEach((k, ki) => {
    for (let i = 0; i < 12; i++) {
      murid.push({ NoKP: "'" + ('0' + (8 + ki % 2)) + '0' + (101 + i) + '13' + ('000' + (ki * 100 + i + 1)).slice(-4),
        Nama: namaDepan[i] + ' ' + ['BIN', 'BINTI', 'ANAK'][i % 3] + ' CONTOH ' + (ki * 12 + i + 1), Kelas: k[0], Tingkatan: k[1],
        Jantina: i % 2 ? 'PEREMPUAN' : 'LELAKI', Alamat: 'KAMPUNG CONTOH, 94600 ASAJAYA, SARAWAK', NamaPenjaga: 'PENJAGA CONTOH ' + (i + 1),
        TelefonPenjaga: '01' + (2000000 + ki * 100 + i), Status: 'AKTIF' });
    }
  });
  tambahBanyakBaris(SHEET.MURID, murid);
  const jadual = [];
  ['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'].forEach((h, hi) => {
    jadual.push({ Hari: h, Slot: 1 + hi % 3, Kelas: '5 ALPHA', NoKPGuru: "'800202135002", NamaGuru: 'CIKGU AMINAH BINTI ALI', Subjek: 'MATEMATIK' });
    jadual.push({ Hari: h, Slot: 4, Kelas: '5 BETA', NoKPGuru: "'800202135002", NamaGuru: 'CIKGU AMINAH BINTI ALI', Subjek: 'MATEMATIK' });
    jadual.push({ Hari: h, Slot: 2 + hi % 2, Kelas: '4 ALPHA', NoKPGuru: "'800505135005", NamaGuru: 'CIKGU DAYANG NURUL', Subjek: 'SAINS' });
    jadual.push({ Hari: h, Slot: 6, Kelas: '5 ALPHA', NoKPGuru: "'800404135004", NamaGuru: 'CIKGU CHARLES ANAK JANTING', Subjek: 'SEJARAH' });
  });
  tambahBanyakBaris(SHEET.JADUAL, jadual);
  tambahBaris(SHEET.TEACHIN, { Tarikh: tarikhHariIni(), Slot: 6, Kelas: '5 ALPHA', NoKPGuruGanti: "'800202135002", NamaGuruGanti: 'CIKGU AMINAH BINTI ALI',
    NoKPGuruAsal: "'800404135004", NamaGuruAsal: 'CIKGU CHARLES ANAK JANTING', Subjek: 'SEJARAH', Catatan: 'Kursus' });
  segarSemulaSumberLuar();
  return 'Data contoh diisi. Log masuk contoh: Admin 800101135001, GT 800202135002 — kata laluan lalai = 6 digit terakhir No. KP.';
}
