/* =========================================================================
 * Utils.gs — utiliti sheet, ID, tarikh. Semua service lain guna fungsi ini
 * supaya cara baca/tulis Sheet konsisten (rujuk MODUL 30: PRESTASI).
 * ========================================================================= */

/* ---------- Cache bacaan PER-PELAKSANAAN (MODUL 30: PRESTASI) ----------
   Satu panggilan API sering membaca Sheet yang sama berulang kali (cth. USERS,
   STUDENTS, GRADES). Nilai disimpan dalam memori untuk tempoh SATU pelaksanaan
   sahaja (global Apps Script ditetapkan semula setiap panggilan), dan dibuang
   serta-merta setiap kali Sheet itu ditulis — jadi tiada risiko data basi. */
let _ssAktif = null;
const _cacheBaca = {};
const _sheetDitulis = {}; // Sheet yang sudah ditulis dalam pelaksanaan ini — sentiasa dibaca terus
function _spreadsheet() { return _ssAktif || (_ssAktif = SpreadsheetApp.getActiveSpreadsheet()); }
function _sheetMentah(nama) {
  const sh = _spreadsheet().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak wujud. Buka menu Tetapan Sistem → "Semak & Kemaskini Struktur".');
  return sh;
}
function buangCacheBaca(nama) { if (nama) delete _cacheBaca[nama]; else Object.keys(_cacheBaca).forEach(k => delete _cacheBaca[k]); }

/* Untuk OPERASI TULIS (deleteRow/setValue dsb.) — cache Sheet itu dibuang, dan Sheet itu
   tidak dicache lagi bagi baki pelaksanaan (elak bacaan basi selepas deleteRow terus). */
function dapatkanSheet(nama) {
  buangCacheBaca(nama);
  _sheetDitulis[nama] = true;
  return _sheetMentah(nama);
}

/* Google Sheets format "Automatic" secara senyap tukar sel yang ditulis sebagai
   rentetan tarikh/masa (cth. KemaskiniPada = "2026-09-11 14:23:05" daripada
   formatTarikhMasa()) kepada objek Date sebenar apabila dibaca semula melalui
   getValues() — sama seperti KodSubjek bertukar kepada Number (rujuk pembetulan
   sebelum ini). Objek Date terbenam dalam respons google.script.run didapati
   menyebabkan keseluruhan respons klien jadi null (bukan ralat biasa) — jadi
   tukar SEMUA sel bertarikh kembali kepada rentetan di sini, satu tempat sahaja,
   sebelum data ini sampai ke mana-mana fungsi api*() yang memulangkannya ke UI. */
function nilaiSelSebagaiTeks(nilai) {
  if (nilai instanceof Date) {
    const adaMasa = nilai.getHours() || nilai.getMinutes() || nilai.getSeconds();
    return adaMasa ? formatTarikhMasa(nilai) : formatTarikh(nilai);
  }
  return nilai;
}

/* Baca keseluruhan sheet sebagai array objek {header: nilai}, satu panggilan getValues()
   (dicache per-pelaksanaan). Setiap panggilan memulangkan objek BAHARU (selamat diubah).
   __row dikira SEBELUM baris kosong ditapis, supaya sentiasa sama dengan nombor baris
   sebenar walaupun ada baris kosong di tengah Sheet. */
function bacaSheetSebagaiObjek(namaSheet) {
  let c = _sheetDitulis[namaSheet] ? null : _cacheBaca[namaSheet];
  if (!c) {
    const nilai = _sheetMentah(namaSheet).getDataRange().getValues();
    const header = nilai.shift() || [];
    c = {
      header,
      baris: nilai.map((baris, idx) => ({ baris: baris.map(nilaiSelSebagaiTeks), row: idx + 2 }))
        .filter(x => x.baris.some(sel => sel !== '' && sel !== null))
    };
    if (!_sheetDitulis[namaSheet]) _cacheBaca[namaSheet] = c;
  }
  return c.baris.map(x => {
    const obj = {};
    c.header.forEach((h, i) => { obj[h] = x.baris[i]; });
    obj.__row = x.row; // nombor baris sebenar dalam Sheet (1 = header)
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

function keTarikh(nilai) {
  if (nilai instanceof Date) return formatTarikh(nilai);
  return String(nilai || '').trim();
}

/* Format paparan "markah (gred)" konsisten untuk laporan/eksport CSV. */
function formatMarkahGred(markah, gred) {
  if (markah === '' || markah === undefined || markah === null) return gred || '';
  return gred ? (markah + ' (' + gred + ')') : String(markah);
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

/* ---------- Peta nama untuk paparan (nama guru & nama pelajar, bukan No. KP / ID) ---------- */
function petaPelajar() {
  const peta = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { peta[String(s.ID_Pelajar)] = s; });
  return peta;
}
function petaNamaGuru() {
  const peta = {};
  bacaSheetSebagaiObjek(SHEET_USERS).forEach(u => { peta[normalNoKP(u.NoKP)] = u.NamaPenuh; });
  return peta;
}
function petaNamaSubjek() {
  const peta = { [KOD_SUBJEK_MUET]: 'MUET' };
  bacaSheetSebagaiObjek(SHEET_SUBJECTS).forEach(s => { peta[String(s.KodSubjek)] = s.NamaSubjek; });
  return peta;
}
/* Tambah NamaPelajar, Kelas & NamaSubjek pada rekod yang ada ID_Pelajar / KodSubjek. */
function lampirNama(senarai) {
  const pel = petaPelajar(), sub = petaNamaSubjek();
  return senarai.map(r => Object.assign({}, r, {
    NamaPelajar: (pel[String(r.ID_Pelajar)] || {}).Nama || '', Kelas: (pel[String(r.ID_Pelajar)] || {}).Kelas || '',
    NamaSubjek: sub[String(r.KodSubjek)] || ''
  }));
}
