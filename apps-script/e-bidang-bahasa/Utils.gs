/* =========================================================================
 * Utils.gs — utiliti sheet, ID, tarikh. Semua service lain guna fungsi ini
 * supaya cara baca/tulis Sheet konsisten.
 * ========================================================================= */

/* ------------------------- PRESTASI: MEMO & CACHE -------------------------
   Setiap panggilan api*() ialah satu pelaksanaan pelayan berasingan. Dalam satu
   pelaksanaan, Spreadsheet/Sheet/data yang sama sering dibaca berulang kali
   (cth. wajibAksesPanitia + cariBarisMengikutId + bacaSheetSebagaiObjek), jadi
   simpan dalam memo per-pelaksanaan. Sheet kecil yang kerap dibaca tetapi jarang
   berubah (USERS/PANITIA/KATEGORI_DOKUMEN) turut disimpan dalam CacheService
   merentasi panggilan; cache dipadam setiap kali sistem menulis ke Sheet itu, dan
   oleh onEdit() (Code.gs) apabila admin menyunting Sheet secara manual. */
let MEMO_SPREADSHEET = null;
const MEMO_SHEET = {};
const MEMO_DATA = {};
const TEMPOH_CACHE_SHEET_SAAT = 600;

function sheetBolehDicache(namaSheet) {
  return [SHEET_USERS, SHEET_PANITIA, SHEET_KATEGORI_DOKUMEN, SHEET_TETAPAN].indexOf(namaSheet) !== -1;
}
function kunciCacheSheet(namaSheet) { return 'sheet_ebahasa_' + namaSheet; }

function batalCacheSheet(namaSheet) {
  delete MEMO_DATA[namaSheet];
  if (sheetBolehDicache(namaSheet)) {
    try { CacheService.getScriptCache().remove(kunciCacheSheet(namaSheet)); } catch (e) { /* cache pilihan sahaja */ }
  }
}

function dapatkanSpreadsheet() {
  if (!MEMO_SPREADSHEET) MEMO_SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();
  return MEMO_SPREADSHEET;
}

function dapatkanSheet(nama) {
  if (MEMO_SHEET[nama]) return MEMO_SHEET[nama];
  const sh = dapatkanSpreadsheet().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak wujud. Jalankan menu "Sediakan Sistem" dahulu.');
  MEMO_SHEET[nama] = sh;
  return sh;
}

// Salinan cetek — pemanggil kerap mengubah objek baris sebelum kemaskiniBaris().
function salinRekod(rekod) { return rekod.map(r => Object.assign({}, r)); }

/* Google Sheets format "Automatic" secara senyap tukar sel yang ditulis sebagai
   rentetan tarikh/masa kepada objek Date sebenar apabila dibaca semula melalui
   getValues(). Objek Date terbenam dalam respons google.script.run menyebabkan
   keseluruhan respons klien jadi null — jadi tukar SEMUA sel bertarikh kembali
   kepada rentetan di sini, satu tempat sahaja. */
function nilaiSelSebagaiTeks(nilai) {
  if (nilai instanceof Date) {
    /* Sel masa sahaja (cth. 08:00) dibaca sebagai tarikh tahun 1899 — pulangkan HH:mm. */
    if (nilai.getFullYear() < 1900) return ('0' + nilai.getHours()).slice(-2) + ':' + ('0' + nilai.getMinutes()).slice(-2);
    const adaMasa = nilai.getHours() || nilai.getMinutes() || nilai.getSeconds();
    return adaMasa ? formatTarikhMasa(nilai) : formatTarikh(nilai);
  }
  return nilai;
}

/* Baca keseluruhan sheet sebagai array objek {header: nilai}, satu panggilan getValues(). */
function bacaSheetSebagaiObjek(namaSheet) {
  if (MEMO_DATA[namaSheet]) return salinRekod(MEMO_DATA[namaSheet]);

  const bolehCache = sheetBolehDicache(namaSheet);
  if (bolehCache) {
    try {
      const mentah = CacheService.getScriptCache().get(kunciCacheSheet(namaSheet));
      if (mentah) {
        MEMO_DATA[namaSheet] = JSON.parse(mentah);
        return salinRekod(MEMO_DATA[namaSheet]);
      }
    } catch (e) { /* baca terus daripada Sheet */ }
  }

  const sh = dapatkanSheet(namaSheet);
  const nilai = sh.getDataRange().getValues();
  const header = nilai.shift() || [];
  const rekod = [];
  nilai.forEach((baris, idx) => {
    if (!baris.some(sel => sel !== '' && sel !== null)) return;
    const obj = {};
    header.forEach((h, i) => { obj[h] = nilaiSelSebagaiTeks(baris[i]); });
    obj.__row = idx + 2; // nombor baris sebenar dalam Sheet (1 = header)
    rekod.push(obj);
  });

  MEMO_DATA[namaSheet] = rekod;
  if (bolehCache) {
    try {
      const json = JSON.stringify(rekod);
      if (json.length < 95000) CacheService.getScriptCache().put(kunciCacheSheet(namaSheet), json, TEMPOH_CACHE_SHEET_SAAT);
    } catch (e) { /* cache pilihan sahaja */ }
  }
  return salinRekod(rekod);
}

/* Baca baris 1 SEBENAR terus daripada Sheet (bukan andaian daripada pemalar
   HEADER_X di kod) — supaya susunan lajur yang ditulis SENTIASA sepadan dengan
   susunan yang dibaca semula oleh bacaSheetSebagaiObjek(), walaupun lajur
   pernah ditambah pada urutan/masa berbeza daripada senarai HEADER_X semasa
   (cth. migrasi tambahLajurJikaTiada() dijalankan berperingkat merentasi
   beberapa kemaskini kod). Parameter `header` (HEADER_X) dikekalkan pada
   tandatangan fungsi untuk keserasian panggilan sedia ada tetapi tidak lagi
   dipercayai untuk menentukan susunan lajur sebenar. */
function headerSebenarSheet(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
}

/* ------------------------- KESELAMATAN TULISAN -------------------------
   denganKunci(): semua tulisan ke Sheet melalui LockService supaya dua guru yang
   menyimpan serentak tidak menindih baris satu sama lain. Kunci boleh bersarang
   dalam satu pelaksanaan (kiraan KUNCI_DIPEGANG).
   selamatNilai(): teks bermula = + @ disimpan sebagai teks biasa (bukan formula)
   untuk menghalang suntikan formula daripada input borang. */
let KUNCI_DIPEGANG = 0;
let KUNCI_SKRIP = null;
function denganKunci(fn) {
  if (KUNCI_DIPEGANG > 0) return fn();
  if (!KUNCI_SKRIP) KUNCI_SKRIP = LockService.getScriptLock();
  if (!KUNCI_SKRIP.tryLock(25000)) throw new Error('Sistem sedang sibuk menyimpan data lain. Sila cuba sebentar lagi.');
  KUNCI_DIPEGANG++;
  try {
    return fn();
  } finally {
    KUNCI_DIPEGANG--;
    try { SpreadsheetApp.flush(); } catch (e) { /* abaikan */ }
    KUNCI_SKRIP.releaseLock();
  }
}

function selamatNilai(nilai) {
  if (typeof nilai !== 'string') return nilai;
  /* Formula (= + @) dan masa "HH:mm" disimpan sebagai teks biasa. */
  if (/^[=+@]/.test(nilai) || /^\d{1,2}:\d{2}$/.test(nilai)) return "'" + nilai;
  return nilai;
}

function barisDaripadaObjek(headerSebenar, objek) {
  return headerSebenar.map(h => (objek[h] !== undefined && objek[h] !== null ? selamatNilai(objek[h]) : ''));
}

/* Pastikan nombor baris masih menunjuk rekod yang sama (lajur pertama = ID).
   Jika baris telah beralih (cth. rekod lain dipadam serentak), cari semula. */
function samaId(a, b) {
  const x = String(a), y = String(b);
  if (x === y) return true;
  return /^\d+$/.test(x) && /^\d+$/.test(y) && Number(x) === Number(y);
}

function sahkanNomborBaris(sh, nomborBaris, nilaiId) {
  if (nilaiId === undefined || nilaiId === null || nilaiId === '') return nomborBaris;
  const semasa = nomborBaris <= sh.getLastRow() ? sh.getRange(nomborBaris, 1).getValue() : null;
  if (semasa !== null && samaId(semasa, nilaiId)) return nomborBaris;
  const lajurId = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  const idx = lajurId.findIndex(r => samaId(r[0], nilaiId));
  if (idx === -1) throw new Error('Rekod ini telah dipadam atau diubah oleh pengguna lain. Sila muat semula halaman.');
  return idx + 2;
}

function tambahBaris(namaSheet, objek, header) {
  const sh = dapatkanSheet(namaSheet);
  const nombor = denganKunci(() => {
    sh.appendRow(barisDaripadaObjek(headerSebenarSheet(sh), objek));
    return sh.getLastRow();
  });
  batalCacheSheet(namaSheet);
  return nombor;
}

/* Kemaskini satu baris (mengikut __row yang diperoleh dari bacaSheetSebagaiObjek). */
function kemaskiniBaris(namaSheet, nomborBaris, objek, header) {
  const sh = dapatkanSheet(namaSheet);
  denganKunci(() => {
    const headerSebenar = headerSebenarSheet(sh);
    const baris = sahkanNomborBaris(sh, nomborBaris, objek[headerSebenar[0]]);
    sh.getRange(baris, 1, 1, headerSebenar.length).setValues([barisDaripadaObjek(headerSebenar, objek)]);
  });
  batalCacheSheet(namaSheet);
}

/* Kemaskini lajur tertentu SAHAJA bagi satu rekod (digunakan oleh segerak
   kalendar automatik supaya tidak menimpa suntingan guru yang berlaku serentak). */
function kemaskiniMedan(namaSheet, rekod, senaraiMedan) {
  const sh = dapatkanSheet(namaSheet);
  denganKunci(() => {
    const headerSebenar = headerSebenarSheet(sh);
    const baris = sahkanNomborBaris(sh, rekod.__row, rekod[headerSebenar[0]]);
    senaraiMedan.forEach(medan => {
      const lajur = headerSebenar.indexOf(medan);
      if (lajur === -1) return;
      const nilai = rekod[medan] === undefined || rekod[medan] === null ? '' : selamatNilai(rekod[medan]);
      sh.getRange(baris, lajur + 1).setValue(nilai);
    });
  });
  batalCacheSheet(namaSheet);
}

function padamBaris(namaSheet, nomborBaris) {
  const sh = dapatkanSheet(namaSheet);
  const memo = MEMO_DATA[namaSheet];
  const rekod = memo ? memo.find(r => r.__row === nomborBaris) : null;
  denganKunci(() => {
    let baris = nomborBaris;
    if (rekod) baris = sahkanNomborBaris(sh, nomborBaris, rekod[headerSebenarSheet(sh)[0]]);
    sh.deleteRow(baris);
  });
  batalCacheSheet(namaSheet);
}

function cariBarisMengikutId(namaSheet, medanId, nilaiId) {
  const rekod = bacaSheetSebagaiObjek(namaSheet);
  return rekod.find(r => String(r[medanId]) === String(nilaiId)) || null;
}

function janaId(prefix) {
  return prefix + '-' + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function formatTarikh(tarikh) {
  return Utilities.formatDate(tarikh, Session.getScriptTimeZone() || 'Asia/Kuching', 'yyyy-MM-dd');
}

function formatTarikhMasa(tarikh) {
  return Utilities.formatDate(tarikh, Session.getScriptTimeZone() || 'Asia/Kuching', 'yyyy-MM-dd HH:mm:ss');
}

/* Tukar rentetan "yyyy-MM-dd" (format input tarikh HTML) kepada objek Date
   tempatan — guna oleh CalendarService.gs untuk cipta event sehari penuh. */
function keTarikhObjek(nilaiTarikh) {
  const bahagian = String(nilaiTarikh || '').trim().split('-');
  if (bahagian.length !== 3) return null;
  const tahun = Number(bahagian[0]), bulan = Number(bahagian[1]), hari = Number(bahagian[2]);
  if (!tahun || !bulan || !hari) return null;
  return new Date(tahun, bulan - 1, hari);
}

/* Gabungkan objek Date (tarikh sahaja, dari keTarikhObjek) dengan rentetan
   "HH:mm" (format input masa HTML) menjadi satu objek Date lengkap — guna
   oleh CalendarService.gs untuk cipta event Kalendar bermasa (bukan sehari
   penuh) bagi Mesyuarat/Program yang mengisi Masa Mula & Masa Tamat. */
function gabungTarikhMasa(tarikhObjek, masaHHmm) {
  const bahagian = String(masaHHmm || '').trim().split(':');
  const jam = Number(bahagian[0]) || 0, minit = Number(bahagian[1]) || 0;
  const hasil = new Date(tarikhObjek.getTime());
  hasil.setHours(jam, minit, 0, 0);
  return hasil;
}

/* Cipta satu Sheet BAHARU (modul baharu sepenuhnya, bukan lajur tambahan pada Sheet
   sedia ada) jika belum wujud — idempoten. Guna oleh kemaskiniStrukturSistem() di
   Code.gs supaya deployment sedia ada boleh naik taraf tanpa jalankan semula
   "Sediakan Sistem" (yang hanya cipta Sheet yang tiada, tidak menimpa data sedia ada,
   tetapi tidak semua admin ingat untuk menjalankannya semula selepas naik taraf kod). */
function ciptaSheetBaharuJikaTiada(namaSheet, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(namaSheet)) return false;
  const sh = ss.insertSheet(namaSheet);
  sh.appendRow(header);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  return true;
}

/* Tambah satu lajur baharu pada penghujung Sheet sedia ada jika belum wujud
   (idempoten — selamat dijalankan berulang kali). Guna oleh fungsi migrasi
   struktur dalam Code.gs apabila menaik taraf deployment sedia ada. */
function tambahLajurJikaTiada(namaSheet, namaLajur) {
  const sh = dapatkanSheet(namaSheet);
  const lajurSemasa = Math.max(sh.getLastColumn(), 1);
  const header = sh.getRange(1, 1, 1, lajurSemasa).getValues()[0];
  if (header.indexOf(namaLajur) !== -1) return false;
  sh.getRange(1, lajurSemasa + 1).setValue(namaLajur).setFontWeight('bold');
  batalCacheSheet(namaSheet);
  return true;
}

/* Pisah satu medan teks dipisah koma (cth. "Bahasa Melayu, Bahasa Inggeris") kepada senarai/array,
   trim & buang entri kosong. Corak umum bagi lajur "berbilang nilai" (cth.
   Panitia) — guna fungsi ini di mana-mana sahaja lajur sedemikian dibaca. */
function senaraiDaripadaMedan(nilai) {
  return String(nilai || '').split(',').map(s => s.trim()).filter(Boolean);
}

/* Lajur Panitia (USERS) boleh simpan lebih daripada satu panitia dipisah
   koma bagi guru yang mengajar > 1 mata pelajaran. */
function senaraiPanitiaDaripadaMedan(nilai) {
  return senaraiDaripadaMedan(nilai);
}

function ralat(mesej) {
  return { success: false, message: mesej };
}

function jaya(data) {
  return Object.assign({ success: true }, data || {});
}

function includeFile(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

/* Gabung fail HTML kecil (Gaya, Logo, App) ke dalam Index.html: <?!= include('App'); ?> */
function include(nama) {
  return includeFile(nama);
}

/* Papar mesej kepada admin: kotak dialog jika dijalankan dari menu Sheet; jika
   dijalankan terus dari editor Apps Script (tiada UI), tulis ke Log Pelaksanaan. */
function paparMesejAdmin(mesej) {
  try {
    SpreadsheetApp.getUi().alert(mesej);
  } catch (e) {
    console.log(mesej);
  }
}
