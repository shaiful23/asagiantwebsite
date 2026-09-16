/* =========================================================================
 * Utils.gs — utiliti sheet, ID, tarikh. Semua service lain guna fungsi ini
 * supaya cara baca/tulis Sheet konsisten.
 * ========================================================================= */

function dapatkanSheet(nama) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak wujud. Jalankan menu "Sediakan Sistem" dahulu.');
  return sh;
}

/* Google Sheets format "Automatic" secara senyap tukar sel yang ditulis sebagai
   rentetan tarikh/masa kepada objek Date sebenar apabila dibaca semula melalui
   getValues(). Objek Date terbenam dalam respons google.script.run menyebabkan
   keseluruhan respons klien jadi null — jadi tukar SEMUA sel bertarikh kembali
   kepada rentetan di sini, satu tempat sahaja. */
function nilaiSelSebagaiTeks(nilai) {
  if (nilai instanceof Date) {
    const adaMasa = nilai.getHours() || nilai.getMinutes() || nilai.getSeconds();
    return adaMasa ? formatTarikhMasa(nilai) : formatTarikh(nilai);
  }
  return nilai;
}

/* Baca keseluruhan sheet sebagai array objek {header: nilai}, satu panggilan getValues(). */
function bacaSheetSebagaiObjek(namaSheet) {
  const sh = dapatkanSheet(namaSheet);
  const nilai = sh.getDataRange().getValues();
  const header = nilai.shift() || [];
  return nilai
    .filter(baris => baris.some(sel => sel !== '' && sel !== null))
    .map((baris, idx) => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = nilaiSelSebagaiTeks(baris[i]); });
      obj.__row = idx + 2; // nombor baris sebenar dalam Sheet (1 = header)
      return obj;
    });
}

function tambahBaris(namaSheet, objek, header) {
  const sh = dapatkanSheet(namaSheet);
  const baris = header.map(h => (objek[h] !== undefined && objek[h] !== null ? objek[h] : ''));
  sh.appendRow(baris);
  return sh.getLastRow();
}

/* Kemaskini satu baris (mengikut __row yang diperoleh dari bacaSheetSebagaiObjek). */
function kemaskiniBaris(namaSheet, nomborBaris, objek, header) {
  const sh = dapatkanSheet(namaSheet);
  const baris = header.map(h => (objek[h] !== undefined && objek[h] !== null ? objek[h] : ''));
  sh.getRange(nomborBaris, 1, 1, header.length).setValues([baris]);
}

function padamBaris(namaSheet, nomborBaris) {
  dapatkanSheet(namaSheet).deleteRow(nomborBaris);
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

/* Tambah satu lajur baharu pada penghujung Sheet sedia ada jika belum wujud
   (idempoten — selamat dijalankan berulang kali). Guna oleh fungsi migrasi
   struktur dalam Code.gs apabila menaik taraf deployment sedia ada. */
function tambahLajurJikaTiada(namaSheet, namaLajur) {
  const sh = dapatkanSheet(namaSheet);
  const lajurSemasa = Math.max(sh.getLastColumn(), 1);
  const header = sh.getRange(1, 1, 1, lajurSemasa).getValues()[0];
  if (header.indexOf(namaLajur) !== -1) return false;
  sh.getRange(1, lajurSemasa + 1).setValue(namaLajur).setFontWeight('bold');
  return true;
}

/* Lajur Panitia (USERS) boleh simpan lebih daripada satu panitia dipisah
   koma (cth. "Kimia, Sains") bagi guru yang mengajar > 1 mata pelajaran.
   Guna fungsi ini di mana-mana sahaja lajur itu dibaca — jangan baca terus. */
function senaraiPanitiaDaripadaMedan(nilai) {
  return String(nilai || '').split(',').map(s => s.trim()).filter(Boolean);
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
