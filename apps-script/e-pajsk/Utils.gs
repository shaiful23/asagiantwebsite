/* =========================================================================
 * Utils.gs — utiliti Sheet, ID, tarikh, No. KP. Semua service lain guna
 * fungsi ini supaya cara baca/tulis Sheet konsisten.
 * ========================================================================= */

/* ------------------------- SHEET & CACHE ------------------------- */
// Sheet dibaca SEKALI sahaja kemudian disimpan dalam CacheService (dipecah kepada cebisan kerana had 100KB sekunci).
// Setiap Sheet ada nombor VERSI; semua fungsi tulis menaikkan versi (tandaKotor) supaya salinan lama
// tidak digunakan lagi. Penyunting manual dalam Sheet ditangkap oleh onEdit() (Code.gs).
const TTL_CACHE_DATA = 30 * 60;     // 30 minit
const SAIZ_CEBIS_CACHE = 30000;     // aksara sebuah cebisan (selamat walau berbilang bait)
let _memoData = {};                 // rentetan JSON bagi Sheet dalam pelaksanaan semasa
let _memoHeader = {};               // header sebenar setiap Sheet dalam pelaksanaan semasa
let _memoSS = null;

function spreadsheetAktif() {
  if (!_memoSS) _memoSS = SpreadsheetApp.getActiveSpreadsheet();
  return _memoSS;
}

function dapatkanSheet(nama) {
  const sh = spreadsheetAktif().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak wujud. Jalankan menu "Sediakan Sistem" dahulu.');
  return sh;
}

/* Cuba semula operasi Sheets/Drive yang kadangkala gagal sementara (kuota, "Service error"). */
function cubaSemula(fn, kali) {
  const had = kali || 3;
  let ralatAkhir;
  for (let i = 0; i < had; i++) {
    try { return fn(); } catch (e) {
      ralatAkhir = e;
      if (/tidak wujud|not found|permission|akses|no access/i.test(String(e && e.message))) throw e;
      if (i < had - 1) Utilities.sleep(400 * (i + 1));
    }
  }
  throw ralatAkhir;
}

function versiSheet(nama) {
  const c = CacheService.getScriptCache();
  let v = c.get('ver_' + nama);
  if (!v) { v = Date.now() + '.' + Math.floor(Math.random() * 100000); c.put('ver_' + nama, v, 6 * 60 * 60); }
  return v;
}

function tandaKotor(nama) {
  delete _memoData[nama];
  CacheService.getScriptCache().put('ver_' + nama, Date.now() + '.' + Math.floor(Math.random() * 100000), 6 * 60 * 60);
}

function cachePutBesar(kunci, teks, ttl) {
  try {
    const c = CacheService.getScriptCache();
    const n = Math.ceil(teks.length / SAIZ_CEBIS_CACHE);
    const o = {};
    for (let i = 0; i < n; i++) o[kunci + '_' + i] = teks.substr(i * SAIZ_CEBIS_CACHE, SAIZ_CEBIS_CACHE);
    o[kunci + '_n'] = String(n);
    c.putAll(o, ttl || TTL_CACHE_DATA);
  } catch (e) { /* cache gagal/penuh: sistem tetap berfungsi tanpa cache */ }
}

function cacheGetBesar(kunci) {
  try {
    const c = CacheService.getScriptCache();
    const n = Number(c.get(kunci + '_n'));
    if (!n) return null;
    const kunciCebis = [];
    for (let i = 0; i < n; i++) kunciCebis.push(kunci + '_' + i);
    const got = c.getAll(kunciCebis);
    let teks = '';
    for (let i = 0; i < n; i++) {
      const bahagian = got[kunci + '_' + i];
      if (bahagian === undefined || bahagian === null) return null;
      teks += bahagian;
    }
    return teks;
  } catch (e) { return null; }
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
  const nama = sh.getName();
  if (!_memoHeader[nama]) _memoHeader[nama] = cubaSemula(() => sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]);
  return _memoHeader[nama];
}

/* Bentuk KOMPAK untuk cache: {h:[header], r:[[nilai..., nomborBaris]]} — jauh lebih kecil daripada array objek
   (nama medan tidak diulang setiap baris) sehingga lebih sedikit cebisan cache dan lebih pantas dibaca. */
function bacaSheetKompak(namaSheet) {
  const sh = dapatkanSheet(namaSheet);
  const nilai = cubaSemula(() => sh.getDataRange().getValues());
  const h = nilai.shift() || [];
  const r = [];
  nilai.forEach((baris, idx) => {
    if (!baris.some(sel => sel !== '' && sel !== null)) return;
    const b = new Array(h.length + 1);
    for (let i = 0; i < h.length; i++) b[i] = nilaiSelSebagaiTeks(baris[i]);
    b[h.length] = idx + 2;
    r.push(b);
  });
  return { h, r };
}

function kompakKeObjek(c) {
  const h = c.h, n = h.length;
  return c.r.map(b => {
    const o = {};
    for (let i = 0; i < n; i++) o[h[i]] = b[i];
    o.__row = b[n];
    return o;
  });
}

/* Baca terus daripada Sheet (tanpa cache) sebagai array objek — untuk Sheet kecil yang mesti sentiasa tepat. */
function bacaSheetMentah(namaSheet) {
  return kompakKeObjek(bacaSheetKompak(namaSheet));
}

/* Baca keseluruhan Sheet sebagai array objek {header: nilai}. Pulangkan SALINAN BARU setiap kali
   (pemanggil bebas mengubah objek). Sumber: memo pelaksanaan -> CacheService -> Sheet. */
function bacaSheetSebagaiObjek(namaSheet) {
  let teks = _memoData[namaSheet];
  if (teks === undefined) {
    const kunci = 'd_' + namaSheet + '_' + versiSheet(namaSheet);
    teks = cacheGetBesar(kunci);
    if (teks === null) {
      teks = JSON.stringify(bacaSheetKompak(namaSheet));
      cachePutBesar(kunci, teks);
    }
    _memoData[namaSheet] = teks;
  }
  return kompakKeObjek(JSON.parse(teks));
}

function objekKeBaris(objek, header) {
  return header.map(h => (objek[h] !== undefined && objek[h] !== null ? objek[h] : ''));
}

function samaKunci(a, b) {
  const x = String(a === undefined || a === null ? '' : a).trim(), y = String(b === undefined || b === null ? '' : b).trim();
  if (x === y) return true;
  return /^\d+$/.test(x.replace(/\D/g, '')) && x.replace(/\D/g, '') === y.replace(/\D/g, '') && x.replace(/\D/g, '') !== '';
}

function tambahBaris(namaSheet, objek) {
  const sh = dapatkanSheet(namaSheet);
  cubaSemula(() => sh.appendRow(objekKeBaris(objek, headerSebenarSheet(sh))));
  tandaKotor(namaSheet);
  return sh.getLastRow();
}

/* Kemaskini satu baris (nombor baris daripada bacaSheetSebagaiObjek). Kunci baris (lajur 1) disemak
   dahulu — jika baris telah beralih (cth. admin memadam baris secara manual) tulisan dibatalkan. */
function kemaskiniBaris(namaSheet, nomborBaris, objek) {
  const sh = dapatkanSheet(namaSheet);
  const header = headerSebenarSheet(sh);
  const kunciSemasa = sh.getRange(nomborBaris, 1).getValue();
  if (!samaKunci(kunciSemasa, objek[header[0]])) {
    tandaKotor(namaSheet);
    throw new Error('Data telah berubah dalam Sheet ' + namaSheet + '. Sila cuba semula.');
  }
  cubaSemula(() => sh.getRange(nomborBaris, 1, 1, header.length).setValues([objekKeBaris(objek, header)]));
  tandaKotor(namaSheet);
}

function padamBaris(namaSheet, nomborBaris, kunciDijangka) {
  const sh = dapatkanSheet(namaSheet);
  if (kunciDijangka !== undefined && !samaKunci(sh.getRange(nomborBaris, 1).getValue(), kunciDijangka)) {
    tandaKotor(namaSheet);
    throw new Error('Data telah berubah dalam Sheet ' + namaSheet + '. Sila cuba semula.');
  }
  sh.deleteRow(nomborBaris);
  tandaKotor(namaSheet);
}

function cariBarisMengikutId(namaSheet, medanId, nilaiId) {
  return bacaSheetSebagaiObjek(namaSheet).find(r => String(r[medanId]) === String(nilaiId)) || null;
}

/* Tampal salinan cache selepas penulisan (write-through) supaya bacaan seterusnya TIDAK perlu membaca semula
   seluruh Sheet. Jika tiada salinan cache, versi hanya dinaikkan. Dipanggil dalam kunci skrip. */
function tampalCache(namaSheet, medanKunci, header, item) {
  try {
    const ver = versiSheet(namaSheet);
    let teks = _memoData[namaSheet];
    if (teks === undefined) teks = cacheGetBesar('d_' + namaSheet + '_' + ver);
    if (teks === null || teks === undefined) { tandaKotor(namaSheet); return; }
    const c = JSON.parse(teks);
    if (c.h.join('\u0001') !== header.join('\u0001')) { tandaKotor(namaSheet); return; }   // struktur lajur berubah
    const n = header.length, iKunci = header.indexOf(medanKunci);
    const idx = {};
    c.r.forEach((b, i) => { idx[String(b[iKunci])] = i; });
    item.forEach(it => {
      const k = String(it.o[medanKunci]);
      let b;
      if (idx[k] !== undefined) b = c.r[idx[k]];
      else { b = new Array(n + 1).fill(''); c.r.push(b); idx[k] = c.r.length - 1; }
      for (let i = 0; i < n; i++) { const v = it.o[header[i]]; if (v !== undefined && v !== null) b[i] = v; }
      b[n] = it.row;
    });
    const versiBaharu = Date.now() + '.' + Math.floor(Math.random() * 100000);
    const teksBaharu = JSON.stringify(c);
    cachePutBesar('d_' + namaSheet + '_' + versiBaharu, teksBaharu);
    CacheService.getScriptCache().put('ver_' + namaSheet, versiBaharu, 6 * 60 * 60);
    _memoData[namaSheet] = teksBaharu;
  } catch (e) {
    tandaKotor(namaSheet);
  }
}

/* Upsert banyak objek (kunci = lajur unik). Hanya LAJUR KUNCI dibaca untuk mencari baris; baris sedia ada
   digabung (medan baharu menimpa), yang belum wujud ditambah dalam SATU tulisan. Kemaskini yang banyak
   dikelompokkan kepada blok bersebelahan supaya bilangan panggilan Sheets kecil. */
function upsertBanyak(namaSheet, medanKunci, senaraiObjek) {
  if (!senaraiObjek.length) return { ditambah: 0, dikemaskini: 0 };
  const sh = dapatkanSheet(namaSheet);
  const header = headerSebenarSheet(sh);
  const idxKunci = header.indexOf(medanKunci);
  if (idxKunci === -1) throw new Error('Lajur kunci "' + medanKunci + '" tiada dalam ' + namaSheet);

  // gabung pendua dalam senarai masukan (yang terkemudian menimpa)
  const tertib = [], mengikutKunci = {};
  senaraiObjek.forEach(o => {
    const k = String(o[medanKunci]);
    if (mengikutKunci[k]) Object.assign(mengikutKunci[k], o);
    else { mengikutKunci[k] = Object.assign({}, o); tertib.push(k); }
  });

  const last = sh.getLastRow();
  const kunciSedia = last > 1 ? cubaSemula(() => sh.getRange(2, idxKunci + 1, last - 1, 1).getValues()) : [];
  const baris = {};
  kunciSedia.forEach((r, i) => { baris[String(r[0])] = i + 2; });

  const kemaskini = [], baharu = [], itemCache = [];
  tertib.forEach(k => {
    if (baris[k] !== undefined) { kemaskini.push({ row: baris[k], o: mengikutKunci[k] }); itemCache.push({ o: mengikutKunci[k], row: baris[k] }); }
    else { itemCache.push({ o: mengikutKunci[k], row: last + 1 + baharu.length }); baharu.push(objekKeBaris(mengikutKunci[k], header)); }
  });

  const gabung = (semasa, o) => { header.forEach((h, c) => { if (o[h] !== undefined && o[h] !== null) semasa[c] = o[h]; }); return semasa; };
  kemaskini.sort((a, b) => a.row - b.row);
  if (kemaskini.length <= 12) {
    kemaskini.forEach(u => {
      const rg = sh.getRange(u.row, 1, 1, header.length);
      rg.setValues([gabung(cubaSemula(() => rg.getValues()[0]), u.o)]);
    });
  } else {
    let i = 0;
    while (i < kemaskini.length) {
      let j = i;
      while (j + 1 < kemaskini.length && kemaskini[j + 1].row - kemaskini[j].row <= 30) j++;
      const r0 = kemaskini[i].row, r1 = kemaskini[j].row;
      const rg = sh.getRange(r0, 1, r1 - r0 + 1, header.length);
      const blok = cubaSemula(() => rg.getValues());
      for (let k = i; k <= j; k++) gabung(blok[kemaskini[k].row - r0], kemaskini[k].o);
      rg.setValues(blok);
      i = j + 1;
    }
  }
  if (baharu.length) cubaSemula(() => sh.getRange(last + 1, 1, baharu.length, header.length).setValues(baharu));
  if (kemaskini.length || baharu.length) {
    if (itemCache.length > 400) tandaKotor(namaSheet); else tampalCache(namaSheet, medanKunci, header, itemCache);
  }
  return { ditambah: baharu.length, dikemaskini: kemaskini.length };
}

function kosongkanDataSheet(namaSheet) {
  const sh = dapatkanSheet(namaSheet);
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  tandaKotor(namaSheet);
}

/* Baca N baris TERAKHIR (selepas `langkau` baris dari bawah) tanpa memuatkan seluruh Sheet — untuk log audit.
   Pulangkan {jumlah, baris:[objek terbaharu dahulu]}. */
function bacaBarisAkhir(namaSheet, n, langkau) {
  const sh = dapatkanSheet(namaSheet);
  const header = headerSebenarSheet(sh);
  const last = sh.getLastRow();
  const jumlah = Math.max(0, last - 1);
  const akhir = last - (langkau || 0);
  const mula = Math.max(2, akhir - n + 1);
  if (akhir < 2) return { jumlah, baris: [] };
  const nilai = cubaSemula(() => sh.getRange(mula, 1, akhir - mula + 1, header.length).getValues());
  const baris = nilai.reverse().map(b => { const o = {}; header.forEach((h, i) => { o[h] = nilaiSelSebagaiTeks(b[i]); }); return o; });
  return { jumlah, baris };
}

/* Penomboran + carian di pelayan. param: {halaman, saiz, cari}. fnTeks(item) -> teks untuk carian. */
function halamanKan(senarai, param, fnTeks) {
  const cari = banding(param && param.cari || '');
  const tapis = cari ? senarai.filter(x => banding(fnTeks(x)).indexOf(cari) !== -1) : senarai;
  const saiz = Math.max(5, Math.min(100, Number(param && param.saiz) || 25));
  const jumlah = tapis.length;
  const jumlahHalaman = Math.max(1, Math.ceil(jumlah / saiz));
  const halaman = Math.max(1, Math.min(jumlahHalaman, Number(param && param.halaman) || 1));
  return { senarai: tapis.slice((halaman - 1) * saiz, halaman * saiz), jumlah, halaman, saiz, jumlahHalaman };
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

/* ---- Unit (aspek + nama unit) ---- */
function kunciUnit(aspek, unit) { return String(aspek || '') + '|' + banding(unit); }
function pecahKunciUnit(kunci) { const i = String(kunci || '').indexOf('|'); return i < 0 ? null : { aspek: kunci.substring(0, i), unit: kunci.substring(i + 1) }; }
// Nama unit boleh mengandungi koma (cth. "SAINS, TEKNOLOGI ... (STEM)") — senarai unit dipisah ';'.
function senaraiUnitDaripadaMedan(nilai) { return String(nilai || '').split(';').map(s => s.trim()).filter(s => s.indexOf('|') > 0); }

/* Tambah lajur baharu di hujung header jika belum wujud (migrasi automatik deployment sedia ada). */
function tambahLajurJikaTiada(namaSheet, namaLajur) {
  const sh = dapatkanSheet(namaSheet);
  const header = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  if (header.indexOf(namaLajur) !== -1) return false;
  const col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue(namaLajur).setFontWeight('bold');
  sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  delete _memoHeader[namaSheet];
  tandaKotor(namaSheet);
  return true;
}

/* Pastikan struktur Sheet terkini (dipanggil setiap permintaan; disemak sebenar paling kerap sekali / 6 jam). */
function pastikanStrukturTerkini() {
  const c = CacheService.getScriptCache();
  if (c.get('struktur_epajsk_v3')) return;
  LAJUR_PENGGUNA_UNIT.forEach(l => tambahLajurJikaTiada(SHEET_PENGGUNA, l));
  c.put('struktur_epajsk_v3', '1', 6 * 60 * 60);
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
  try { kunci.waitLock(25000); } catch (e) { return ralat('Sistem sedang sibuk (pengguna lain sedang menyimpan). Sila cuba sebentar lagi.'); }
  try {
    return fn();
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    return ralat(e && e.message ? e.message : String(e));
  } finally { kunci.releaseLock(); }
}
