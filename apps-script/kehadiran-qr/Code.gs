/* =========================================================================
 * SISTEM KEHADIRAN GURU & MURID (IMBAS QR)
 * SMK Asajaya
 * -------------------------------------------------------------------------
 * Skrip ini dihoskan dalam Google Apps Script (terikat pada satu Google
 * Sheet). Ia bertindak sebagai API (dipanggil melalui JSONP dari halaman
 * pengimbas QR yang dihoskan di GitHub Pages, kerana Apps Script HtmlService
 * menyekat akses kamera getUserMedia()) dan juga menyajikan Portal Guru
 * (log masuk + dashboard) serta halaman Jana Kod QR untuk admin.
 *
 * CARA PASANG: rujuk README.md dalam folder ini.
 * ========================================================================= */

/* ------------------------- TETAPAN BOLEH UBAH ------------------------- */
const NAMA_SHEET_GURU = 'Guru';
const NAMA_SHEET_KELAS = 'Kelas';
const NAMA_SHEET_SLOT = 'SlotWaktu';
const NAMA_SHEET_JADUAL = 'JadualWaktu';
const NAMA_SHEET_MURID = 'Murid';
const NAMA_SHEET_LOG_GURU = 'LogKehadiranGuru';
const NAMA_SHEET_LOG_MURID = 'LogKehadiranMurid';

const TOLERANSI_LEWAT_MINIT = 10;      // lebih dari ini selepas Masa_Mula slot = LEWAT
const TEMPOH_SESI_SAAT = 6 * 60 * 60;  // sesi log masuk guru sah selama 6 jam

const HARI_MS = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];

const SENARAI_SUBJEK = [
  'BAHASA MELAYU', 'BAHASA INGGERIS', 'MATEMATIK', 'MATEMATIK TAMBAHAN',
  'SAINS', 'FIZIK', 'KIMIA', 'BIOLOGI', 'SAINS KOMPUTER',
  'SEJARAH', 'GEOGRAFI', 'PENDIDIKAN ISLAM', 'PENDIDIKAN MORAL',
  'PENDIDIKAN JASMANI & KESIHATAN', 'REKA BENTUK & TEKNOLOGI',
  'ASAS SAINS KOMPUTER', 'PENDIDIKAN SENI VISUAL', 'EKONOMI',
  'PERNIAGAAN', 'PRINSIP PERAKAUNAN', 'BAHASA ARAB', 'BAHASA CINA',
  'BAHASA IBAN', 'TASAWWUR ISLAM', 'SIVIK & KEWARGANEGARAAN', 'LAIN-LAIN'
];

const SENARAI_JENIS_GURU = ['GURU SUBJEK', 'GURU GANTI (RELIEF)', 'LAIN-LAIN'];

const SENARAI_STATUS_MURID = ['HADIR', 'TIDAK HADIR', 'LEWAT', 'SAKIT (MC)', 'CUTI/URUSAN RASMI', 'TANPA SEBAB'];

/* ============================ MENU ADMIN ============================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sistem Kehadiran QR')
    .addItem('1. Sediakan Sistem (Jalankan Sekali)', 'sediakanSistem')
    .addItem('2. Buka Halaman Jana & Cetak Kod QR', 'bukaHalamanJanaQR')
    .addToUi();
}

function bukaHalamanJanaQR() {
  const url = ScriptApp.getService().getUrl() + '?page=janaqr';
  const html = HtmlService.createHtmlOutput('<script>window.open("' + url + '","_blank");google.script.host.close();</script>');
  SpreadsheetApp.getUi().showModalDialog(html, 'Membuka...');
}

/* Cipta semua Sheet + header + data contoh jika belum wujud. Selamat
   dijalankan berulang kali — tidak akan menimpa data sedia ada. */
function sediakanSistem() {
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

  pastikanSheet(NAMA_SHEET_GURU,
    ['ID_Guru', 'Nama', 'NoKP', 'PIN', 'Subjek_Diajar', 'Status'],
    [['G001', 'CIKGU CONTOH', '900101011234', '1234', 'MATEMATIK, SAINS', 'AKTIF']]);

  pastikanSheet(NAMA_SHEET_KELAS,
    ['ID_Kelas', 'Nama_Kelas', 'Tingkatan', 'Guru_Kelas', 'Bilik_Utama', 'Kod_QR'],
    [['K001', '5 CEMERLANG', '5', 'CIKGU CONTOH', 'BILIK 5C', '5CEM']]);

  pastikanSheet(NAMA_SHEET_SLOT,
    ['Slot', 'Masa_Mula', 'Masa_Tamat'],
    [
      [1, '07:30', '08:00'], [2, '08:00', '08:30'], [3, '08:30', '09:00'],
      [4, '09:00', '09:30'], [5, '09:30', '10:00'], [6, '10:00', '10:30'],
      [7, '10:50', '11:20'], [8, '11:20', '11:50'], [9, '11:50', '12:20'],
      [10, '12:20', '12:50']
    ]);

  pastikanSheet(NAMA_SHEET_JADUAL,
    ['Hari', 'Slot', 'ID_Kelas', 'ID_Guru', 'Subjek'],
    [['ISNIN', 1, 'K001', 'G001', 'MATEMATIK']]);

  pastikanSheet(NAMA_SHEET_MURID,
    ['ID_Murid', 'Nama', 'NoKP', 'ID_Kelas', 'Status'],
    [['M001', 'MURID CONTOH', '070101011234', 'K001', 'AKTIF']]);

  pastikanSheet(NAMA_SHEET_LOG_GURU,
    ['ID_Log', 'Timestamp', 'Tarikh', 'Hari', 'Slot', 'ID_Guru', 'Nama_Guru', 'ID_Kelas', 'Nama_Kelas', 'Bilik', 'Subjek', 'Jenis', 'Status_Masa', 'Catatan']);

  pastikanSheet(NAMA_SHEET_LOG_MURID,
    ['Timestamp', 'ID_Log_Guru', 'ID_Murid', 'Nama_Murid', 'ID_Kelas', 'Status', 'Dicatat_Oleh']);

  SpreadsheetApp.getUi().alert('Sistem sedia. Sheet "Guru", "Kelas", "SlotWaktu", "JadualWaktu", "Murid" dan kedua-dua Log telah dicipta (dengan 1 baris data contoh setiap satu). Sila kemaskini data sebenar sekolah anda dalam Sheet berkenaan, kemudian padam baris contoh.');
}

/* ============================== doGet ================================ */
function doGet(e) {
  const p = e.parameter || {};
  if (p.apiAction) return kendalikanApi(e);

  const page = (p.page || 'portal').toLowerCase();
  let tpl;
  if (page === 'janaqr') {
    tpl = HtmlService.createTemplateFromFile('AdminQR');
  } else {
    tpl = HtmlService.createTemplateFromFile('PortalGuru');
    tpl.execUrl = ScriptApp.getService().getUrl();
  }
  return tpl.evaluate()
    .setTitle('Sistem Kehadiran QR - SMK Asajaya')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ============================ API (JSONP) ============================= */
function kendalikanApi(e) {
  const p = e.parameter || {};
  const callback = p.callback;
  let hasil;
  try {
    switch (p.apiAction) {
      case 'login': hasil = apiLogin(p); break;
      case 'semakSesi': hasil = apiSemakSesi(p); break;
      case 'cariKelasQR': hasil = apiCariKelasQR(p); break;
      case 'catatKehadiranGuru': hasil = apiCatatKehadiranGuru(p); break;
      case 'catatKehadiranMurid': hasil = apiCatatKehadiranMurid(p); break;
      case 'sejarahSayaHariIni': hasil = apiSejarahSayaHariIni(p); break;
      default: hasil = { success: false, message: 'apiAction tidak dikenali.' };
    }
  } catch (err) {
    hasil = { success: false, message: 'Ralat pelayan: ' + err.message };
  }
  return jsonpKeluar(hasil, callback);
}

function jsonpKeluar(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function includeFile(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

/* ------------------------- Utiliti Sheet ------------------------- */
function bacaSheetSebagaiObjek(namaSheet) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(namaSheet);
  if (!sh) throw new Error('Sheet "' + namaSheet + '" tidak wujud. Sila jalankan "Sediakan Sistem" dari menu dahulu.');
  const nilai = sh.getDataRange().getValues();
  const header = nilai.shift();
  return nilai.filter(baris => baris.some(sel => sel !== '')).map(baris => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = baris[i]; });
    return obj;
  });
}

function tambahBaris(namaSheet, objek, header) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(namaSheet);
  const baris = header.map(h => (objek[h] !== undefined ? objek[h] : ''));
  sh.appendRow(baris);
}

function formatMasa(tarikh) {
  return Utilities.formatDate(tarikh, Session.getScriptTimeZone() || 'Asia/Kuching', 'HH:mm');
}
function formatTarikh(tarikh) {
  return Utilities.formatDate(tarikh, Session.getScriptTimeZone() || 'Asia/Kuching', 'yyyy-MM-dd');
}
/* Google Sheets sering auto-tukar sel seperti "07:30" kepada nilai Date/Time
   sebenar (bukan teks). Fungsi ini menormalkan kedua-dua bentuk ke "HH:mm". */
function keHHmm(nilai) {
  if (nilai instanceof Date) return formatMasa(nilai);
  return String(nilai).trim();
}
/* Sama seperti keHHmm() tetapi untuk lajur Tarikh (Sheets kadang auto-tukar
   teks "2026-08-27" kepada nilai Date sebenar). */
function keTarikh(nilai) {
  if (nilai instanceof Date) return formatTarikh(nilai);
  return String(nilai).trim();
}

/* ------------------------- Sesi (CacheService) ------------------------- */
function ciptaSesi(guru) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sesi_' + token, JSON.stringify({
    idGuru: guru.ID_Guru, namaGuru: guru.Nama
  }), TEMPOH_SESI_SAAT);
  return token;
}
function sahkanSesi(token) {
  if (!token) return null;
  const mentah = CacheService.getScriptCache().get('sesi_' + token);
  return mentah ? JSON.parse(mentah) : null;
}

/* ============================ API: login ============================ */
function apiLogin(p) {
  const nokp = String(p.nokp || '').trim();
  const pin = String(p.pin || '').trim();
  if (!nokp || !pin) return { success: false, message: 'Sila isi No. KP dan PIN.' };

  const senaraiGuru = bacaSheetSebagaiObjek(NAMA_SHEET_GURU);
  const guru = senaraiGuru.find(g => String(g.NoKP).trim() === nokp && String(g.PIN).trim() === pin);
  if (!guru) return { success: false, message: 'No. KP atau PIN tidak sah.' };
  if (String(guru.Status).toUpperCase() !== 'AKTIF') return { success: false, message: 'Akaun guru ini tidak aktif. Sila hubungi admin.' };

  const token = ciptaSesi(guru);
  return { success: true, token, idGuru: guru.ID_Guru, namaGuru: guru.Nama };
}

function apiSemakSesi(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return { success: false, message: 'Sesi tamat tempoh. Sila log masuk semula.' };
  return { success: true, idGuru: sesi.idGuru, namaGuru: sesi.namaGuru };
}

/* ===================== API: cariKelasQR (selepas imbas) ===================== */
function apiCariKelasQR(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return { success: false, message: 'Sesi tamat tempoh. Sila log masuk semula.' };

  const kodMentah = String(p.kod || '').trim();
  // Format QR: KELAS:<kodkelas> atau KELAS:<kodkelas>|BILIK:<kodbilik>
  const bahagian = kodMentah.split('|');
  let kodKelas = '', bilikDariQR = '';
  bahagian.forEach(b => {
    const [kunci, nilai] = b.split(':');
    if (!kunci || nilai === undefined) return;
    const k = kunci.trim().toUpperCase();
    if (k === 'KELAS') kodKelas = nilai.trim();
    if (k === 'BILIK') bilikDariQR = nilai.trim();
  });
  if (!kodKelas) return { success: false, message: 'Kod QR tidak dikenali sistem.' };

  const senaraiKelas = bacaSheetSebagaiObjek(NAMA_SHEET_KELAS);
  const kelas = senaraiKelas.find(k => String(k.Kod_QR).trim().toUpperCase() === kodKelas.toUpperCase());
  if (!kelas) return { success: false, message: 'Kelas dengan kod "' + kodKelas + '" tidak dijumpai dalam sistem.' };

  const sekarang = new Date();
  const hari = HARI_MS[sekarang.getDay()];
  const masaSekarang = formatMasa(sekarang);

  const senaraiSlot = bacaSheetSebagaiObjek(NAMA_SHEET_SLOT);
  const slotSemasa = senaraiSlot.find(s => masaSekarang >= keHHmm(s.Masa_Mula) && masaSekarang <= keHHmm(s.Masa_Tamat));

  let jadualSemasa = null;
  if (slotSemasa) {
    const senaraiJadual = bacaSheetSebagaiObjek(NAMA_SHEET_JADUAL);
    const entri = senaraiJadual.find(j =>
      String(j.Hari).toUpperCase() === hari &&
      Number(j.Slot) === Number(slotSemasa.Slot) &&
      String(j.ID_Kelas) === String(kelas.ID_Kelas)
    );
    if (entri) {
      jadualSemasa = {
        subjek: entri.Subjek,
        idGuruDijadualkan: entri.ID_Guru,
        sepadanDenganGuruSemasa: String(entri.ID_Guru) === String(sesi.idGuru),
        slot: slotSemasa.Slot,
        masaMula: keHHmm(slotSemasa.Masa_Mula),
        masaTamat: keHHmm(slotSemasa.Masa_Tamat)
      };
    }
  }

  const senaraiGuru = bacaSheetSebagaiObjek(NAMA_SHEET_GURU);
  const guruSemasa = senaraiGuru.find(g => String(g.ID_Guru) === String(sesi.idGuru));
  const subjekGuru = guruSemasa && guruSemasa.Subjek_Diajar
    ? String(guruSemasa.Subjek_Diajar).split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return {
    success: true,
    idKelas: kelas.ID_Kelas,
    namaKelas: kelas.Nama_Kelas,
    bilik: bilikDariQR || kelas.Bilik_Utama,
    slotSemasa: slotSemasa ? { slot: slotSemasa.Slot, masaMula: keHHmm(slotSemasa.Masa_Mula), masaTamat: keHHmm(slotSemasa.Masa_Tamat) } : null,
    jadualSemasa,
    subjekGuru,
    senaraiSubjek: SENARAI_SUBJEK,
    senaraiJenisGuru: SENARAI_JENIS_GURU
  };
}

/* ================= API: catatKehadiranGuru ================= */
function apiCatatKehadiranGuru(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return { success: false, message: 'Sesi tamat tempoh. Sila log masuk semula.' };

  const idKelas = String(p.idKelas || '').trim();
  const subjek = String(p.subjek || '').trim();
  const jenis = String(p.jenis || '').trim();
  const bilik = String(p.bilik || '').trim();
  const catatan = String(p.catatan || '').trim();
  if (!idKelas || !subjek || !jenis) return { success: false, message: 'Data tidak lengkap.' };

  const senaraiKelas = bacaSheetSebagaiObjek(NAMA_SHEET_KELAS);
  const kelas = senaraiKelas.find(k => String(k.ID_Kelas) === idKelas);
  if (!kelas) return { success: false, message: 'Kelas tidak dijumpai.' };

  const sekarang = new Date();
  const hari = HARI_MS[sekarang.getDay()];
  const masaSekarang = formatMasa(sekarang);
  const tarikhIni = formatTarikh(sekarang);

  const senaraiSlot = bacaSheetSebagaiObjek(NAMA_SHEET_SLOT);
  const slotSemasa = senaraiSlot.find(s => masaSekarang >= keHHmm(s.Masa_Mula) && masaSekarang <= keHHmm(s.Masa_Tamat));
  const slotNombor = slotSemasa ? slotSemasa.Slot : '';

  // Elak rekod berganda: guru sama + kelas sama + tarikh sama + slot sama
  const logSediaAda = bacaSheetSebagaiObjek(NAMA_SHEET_LOG_GURU);
  const pendua = logSediaAda.find(l =>
    String(l.ID_Guru) === String(sesi.idGuru) &&
    String(l.ID_Kelas) === idKelas &&
    keTarikh(l.Tarikh) === tarikhIni &&
    String(l.Slot) === String(slotNombor)
  );
  if (pendua) {
    const senaraiMurid = dapatkanSenaraiMuridUntukKelas(idKelas);
    return {
      success: true, sudahDicatat: true, idLog: pendua.ID_Log,
      statusMasa: pendua.Status_Masa, senaraiMurid,
      message: 'Kehadiran anda untuk kelas & waktu ini telah dicatat sebelum ini.'
    };
  }

  let statusMasa = 'TIADA JADUAL';
  if (slotSemasa) {
    const masaMulaDate = new Date(sekarang);
    const [jam, minit] = keHHmm(slotSemasa.Masa_Mula).split(':').map(Number);
    masaMulaDate.setHours(jam, minit, 0, 0);
    const lewatMinit = (sekarang - masaMulaDate) / 60000;
    statusMasa = lewatMinit > TOLERANSI_LEWAT_MINIT ? 'LEWAT' : 'TEPAT MASA';
  }

  const idLog = 'LG-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  tambahBaris(NAMA_SHEET_LOG_GURU, {
    ID_Log: idLog, Timestamp: sekarang, Tarikh: tarikhIni, Hari: hari, Slot: slotNombor,
    ID_Guru: sesi.idGuru, Nama_Guru: sesi.namaGuru, ID_Kelas: idKelas, Nama_Kelas: kelas.Nama_Kelas,
    Bilik: bilik || kelas.Bilik_Utama, Subjek: subjek, Jenis: jenis, Status_Masa: statusMasa, Catatan: catatan
  }, ['ID_Log', 'Timestamp', 'Tarikh', 'Hari', 'Slot', 'ID_Guru', 'Nama_Guru', 'ID_Kelas', 'Nama_Kelas', 'Bilik', 'Subjek', 'Jenis', 'Status_Masa', 'Catatan']);

  const senaraiMurid = dapatkanSenaraiMuridUntukKelas(idKelas);
  return { success: true, sudahDicatat: false, idLog, statusMasa, senaraiMurid };
}

function dapatkanSenaraiMuridUntukKelas(idKelas) {
  const semuaMurid = bacaSheetSebagaiObjek(NAMA_SHEET_MURID);
  return semuaMurid
    .filter(m => String(m.ID_Kelas) === String(idKelas) && String(m.Status).toUpperCase() === 'AKTIF')
    .map(m => ({ idMurid: m.ID_Murid, nama: m.Nama }));
}

/* ================= API: catatKehadiranMurid ================= */
function apiCatatKehadiranMurid(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return { success: false, message: 'Sesi tamat tempoh. Sila log masuk semula.' };

  const idLog = String(p.idLog || '').trim();
  if (!idLog) return { success: false, message: 'ID log guru tiada.' };

  let dataMurid;
  try { dataMurid = JSON.parse(p.dataMurid || '[]'); } catch (err) { return { success: false, message: 'Data murid tidak sah.' }; }
  if (!Array.isArray(dataMurid) || !dataMurid.length) return { success: false, message: 'Tiada data murid untuk disimpan.' };

  const sekarang = new Date();
  const ringkasan = {};
  dataMurid.forEach(m => {
    tambahBaris(NAMA_SHEET_LOG_MURID, {
      Timestamp: sekarang, ID_Log_Guru: idLog, ID_Murid: m.idMurid, Nama_Murid: m.nama,
      ID_Kelas: p.idKelas || '', Status: m.status, Dicatat_Oleh: sesi.namaGuru
    }, ['Timestamp', 'ID_Log_Guru', 'ID_Murid', 'Nama_Murid', 'ID_Kelas', 'Status', 'Dicatat_Oleh']);
    ringkasan[m.status] = (ringkasan[m.status] || 0) + 1;
  });

  return { success: true, ringkasan, jumlah: dataMurid.length };
}

/* ================= API: sejarahSayaHariIni ================= */
function apiSejarahSayaHariIni(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return { success: false, message: 'Sesi tamat tempoh. Sila log masuk semula.' };

  const tarikhIni = formatTarikh(new Date());
  const log = bacaSheetSebagaiObjek(NAMA_SHEET_LOG_GURU)
    .filter(l => String(l.ID_Guru) === String(sesi.idGuru) && keTarikh(l.Tarikh) === tarikhIni)
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .map(l => ({ namaKelas: l.Nama_Kelas, subjek: l.Subjek, slot: l.Slot, statusMasa: l.Status_Masa, jenis: l.Jenis }));

  return { success: true, senarai: log };
}

/* ================= Dipanggil oleh AdminQR.html (google.script.run) ================= */
function dapatkanSenaraiKelasUntukQR() {
  return bacaSheetSebagaiObjek(NAMA_SHEET_KELAS).map(k => ({
    idKelas: k.ID_Kelas, namaKelas: k.Nama_Kelas, bilik: k.Bilik_Utama, kodQR: k.Kod_QR
  }));
}
