/* =========================================================================
 * Utils.gs — utiliti Sheet, ID, tarikh, No. KP. Semua service lain guna
 * fungsi ini supaya cara baca/tulis Sheet konsisten.
 * ========================================================================= */

function dapatkanSheet(nama) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak wujud. Jalankan menu "Sediakan Sistem" dahulu.');
  return sh;
}

/* Sel bertarikh dibaca sebagai Date oleh getValues(); Date dalam respons google.script.run
   menyebabkan keseluruhan respons klien jadi null — tukar semua kepada rentetan di sini. */
function nilaiSelSebagaiTeks(nilai) {
  if (nilai instanceof Date) {
    const adaMasa = nilai.getHours() || nilai.getMinutes() || nilai.getSeconds();
    return adaMasa ? formatTarikhMasa(nilai) : formatTarikh(nilai);
  }
  return nilai;
}

function headerSebenarSheet(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
}

/* Baca keseluruhan Sheet sebagai array objek {header: nilai} (satu panggilan getValues). */
function bacaSheetSebagaiObjek(namaSheet) {
  const sh = dapatkanSheet(namaSheet);
  const nilai = sh.getDataRange().getValues();
  const header = nilai.shift() || [];
  const hasil = [];
  nilai.forEach((baris, idx) => {
    if (!baris.some(sel => sel !== '' && sel !== null)) return;
    const obj = {};
    header.forEach((h, i) => { obj[h] = nilaiSelSebagaiTeks(baris[i]); });
    obj.__row = idx + 2;
    hasil.push(obj);
  });
  return hasil;
}

function objekKeBaris(objek, header) {
  return header.map(h => (objek[h] !== undefined && objek[h] !== null ? objek[h] : ''));
}

function tambahBaris(namaSheet, objek) {
  const sh = dapatkanSheet(namaSheet);
  sh.appendRow(objekKeBaris(objek, headerSebenarSheet(sh)));
  return sh.getLastRow();
}

function kemaskiniBaris(namaSheet, nomborBaris, objek) {
  const sh = dapatkanSheet(namaSheet);
  const header = headerSebenarSheet(sh);
  sh.getRange(nomborBaris, 1, 1, header.length).setValues([objekKeBaris(objek, header)]);
}

function padamBaris(namaSheet, nomborBaris) {
  dapatkanSheet(namaSheet).deleteRow(nomborBaris);
}

function cariBarisMengikutId(namaSheet, medanId, nilaiId) {
  return bacaSheetSebagaiObjek(namaSheet).find(r => String(r[medanId]) === String(nilaiId)) || null;
}

/* Upsert banyak objek sekaligus (kunci = lajur unik). Objek sedia ada digabung (medan baharu
   menimpa); yang belum wujud ditambah. Tulis dalam sekelompok — jauh lebih pantas daripada
   satu-satu. Pulangkan {ditambah, dikemaskini}. */
function upsertBanyak(namaSheet, medanKunci, senaraiObjek) {
  if (!senaraiObjek.length) return { ditambah: 0, dikemaskini: 0 };
  const sh = dapatkanSheet(namaSheet);
  const header = headerSebenarSheet(sh);
  const idxKunci = header.indexOf(medanKunci);
  if (idxKunci === -1) throw new Error('Lajur kunci "' + medanKunci + '" tiada dalam ' + namaSheet);
  const lastRow = sh.getLastRow();
  const data = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, header.length).getValues() : [];
  const peta = {};
  data.forEach((b, i) => { peta[String(b[idxKunci])] = i; });

  const baharu = [];
  const diubah = {};
  senaraiObjek.forEach(o => {
    const k = String(o[medanKunci]);
    if (peta[k] !== undefined) {
      const baris = data[peta[k]];
      header.forEach((h, c) => { if (o[h] !== undefined && o[h] !== null) baris[c] = o[h]; });
      diubah[peta[k]] = true;
    } else {
      peta[k] = data.length + baharu.length;
      baharu.push(objekKeBaris(o, header));
    }
  });

  const idxDiubah = Object.keys(diubah).map(Number).sort((a, b) => a - b);
  if (idxDiubah.length > 40) {
    sh.getRange(2, 1, data.length, header.length).setValues(data);
  } else {
    idxDiubah.forEach(i => sh.getRange(i + 2, 1, 1, header.length).setValues([data[i]]));
  }
  if (baharu.length) sh.getRange(data.length + 2, 1, baharu.length, header.length).setValues(baharu);
  return { ditambah: baharu.length, dikemaskini: idxDiubah.length };
}

function kosongkanDataSheet(namaSheet) {
  const sh = dapatkanSheet(namaSheet);
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
}

function ciptaSheetJikaTiada(ss, nama, header, lajurTeks) {
  let sh = ss.getSheetByName(nama);
  if (sh) return sh;
  sh = ss.insertSheet(nama);
  sh.appendRow(header);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#e2e8f0');
  (lajurTeks || []).forEach(nm => {
    const c = header.indexOf(nm);
    if (c !== -1) sh.getRange(2, c + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  return sh;
}

/* ------------------------- ID, TARIKH ------------------------- */
function janaId(prefix) {
  return prefix + '-' + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function zonMasa() { return Session.getScriptTimeZone() || 'Asia/Kuching'; }
function formatTarikh(t) { return Utilities.formatDate(t, zonMasa(), 'yyyy-MM-dd'); }
function formatTarikhMasa(t) { return Utilities.formatDate(t, zonMasa(), 'yyyy-MM-dd HH:mm:ss'); }
function sekarangTeks() { return formatTarikhMasa(new Date()); }

/* Ambil tahun (nombor) daripada sel tarikh e-Kokurikulum (Date atau teks). null jika tidak dapat dibaca. */
function tahunDaripadaTarikh(nilai) {
  if (nilai instanceof Date) return nilai.getFullYear();
  const m = String(nilai || '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

/* ------------------------- NO. KP / TEKS ------------------------- */
/* No. KP boleh tersimpan sebagai nombor dalam Sheet (angka sifar di hadapan hilang, cth. 080101...)
   atau mengandungi '-'. Normalkan: digit sahaja, lapik sifar di kiri hingga 12 digit. */
function normalKP(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '';
  let s = (typeof nilai === 'number') ? String(Math.round(nilai)) : String(nilai);
  s = s.replace(/\D/g, '');
  if (!s) return '';
  if (s.length < 12 && s.length >= 9) s = ('000000000000' + s).slice(-12);
  return s;
}

function teksBersih(nilai) {
  const s = String(nilai === null || nilai === undefined ? '' : nilai).replace(/\s+/g, ' ').trim();
  return s.charAt(0) === '#' && /^#(N\/A|REF!|VALUE!|NAME\?|DIV\/0!|NULL!|NUM!)/.test(s) ? '' : s;
}

function banding(a) { return teksBersih(a).toUpperCase(); }

/* "TINGKATAN 3" / "3" / "T3" -> 3 ; tiada -> 0 */
function nomborTingkatan(nilai) {
  const m = String(nilai || '').match(/(\d)/);
  return m ? Number(m[1]) : 0;
}

function kunciKelasDaripada(tingkatan, kelas) {
  return nomborTingkatan(tingkatan) + ' ' + banding(kelas);
}

function paparKelas(kunci) {
  const m = String(kunci || '').match(/^(\d)\s+(.*)$/);
  return m ? 'Tingkatan ' + m[1] + ' ' + m[2].charAt(0) + m[2].slice(1).toLowerCase() : String(kunci || '');
}

/* Jantina daripada digit terakhir No. KP: ganjil = LELAKI, genap = PEREMPUAN. */
function jantinaDaripadaKP(kp) {
  const d = String(kp || '').replace(/\D/g, '');
  if (!d) return '';
  return Number(d.charAt(d.length - 1)) % 2 === 1 ? 'LELAKI' : 'PEREMPUAN';
}

function senaraiDaripadaMedan(nilai) {
  return String(nilai || '').split(',').map(s => s.trim()).filter(Boolean);
}

function nombor(nilai, lalai) {
  if (nilai === '' || nilai === null || nilai === undefined) return lalai === undefined ? 0 : lalai;
  const n = Number(nilai);
  return isNaN(n) ? (lalai === undefined ? 0 : lalai) : n;
}

function ralat(mesej) { return { success: false, message: mesej }; }
function jaya(data) { return Object.assign({ success: true }, data || {}); }

function includeFile(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

/* Jalankan fungsi dalam kunci skrip (elak dua penulisan serentak merosakkan Sheet). */
function denganKunci(fn) {
  const kunci = LockService.getScriptLock();
  kunci.waitLock(25000);
  try { return fn(); } finally { kunci.releaseLock(); }
}
