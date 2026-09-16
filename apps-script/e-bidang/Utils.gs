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

function ralat(mesej) {
  return { success: false, message: mesej };
}

function jaya(data) {
  return Object.assign({ success: true }, data || {});
}

function includeFile(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}
