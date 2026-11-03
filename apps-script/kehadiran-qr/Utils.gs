/* =========================================================================
 * Utils.gs — utiliti Sheet, tarikh, cache, ID & audit.
 * ========================================================================= */

function jaya(data) { return Object.assign({ success: true }, data || {}); }
function ralat(mesej, kod) { return { success: false, message: mesej, kod: kod || '' }; }

/* ------------------------- MEMO PER-PELAKSANAAN ------------------------- */
let MEMO_SS = null;
const MEMO_SHEET = {};
const MEMO_DATA = {};

function dapatkanSpreadsheet() {
  if (!MEMO_SS) MEMO_SS = SpreadsheetApp.getActiveSpreadsheet();
  return MEMO_SS;
}
function dapatkanSheet(nama) {
  if (MEMO_SHEET[nama]) return MEMO_SHEET[nama];
  const sh = dapatkanSpreadsheet().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak wujud. Jalankan menu "Sediakan Sistem" dahulu.');
  MEMO_SHEET[nama] = sh;
  return sh;
}

/* Sheets tukar teks tarikh/masa kepada objek Date secara senyap — pulangkan
   semula sebagai teks supaya perbandingan & respons google.script.run selamat. */
function nilaiSelSebagaiTeks(nilai) {
  if (nilai instanceof Date) {
    if (nilai.getFullYear() < 1900) return formatMasa(nilai);
    const adaMasa = nilai.getHours() || nilai.getMinutes() || nilai.getSeconds();
    return adaMasa ? formatTarikhMasa(nilai) : formatTarikh(nilai);
  }
  return nilai;
}

function tukarNilaiKeObjek(nilai) {
  const header = (nilai.shift() || []).map(h => String(h).trim());
  const rekod = [];
  nilai.forEach((baris, i) => {
    if (!baris.some(s => s !== '' && s !== null)) return;
    const o = { __row: i + 2 };
    header.forEach((h, j) => { if (h) o[h] = nilaiSelSebagaiTeks(baris[j]); });
    rekod.push(o);
  });
  return rekod;
}

function bacaSheetSebagaiObjek(namaSheet) {
  if (!MEMO_DATA[namaSheet]) {
    MEMO_DATA[namaSheet] = tukarNilaiKeObjek(dapatkanSheet(namaSheet).getDataRange().getValues());
  }
  return MEMO_DATA[namaSheet].map(r => Object.assign({}, r));
}
function batalMemo(namaSheet) { delete MEMO_DATA[namaSheet]; }

function tambahBaris(namaSheet, objek) {
  tambahBanyakBaris(namaSheet, [objek]);
}
function tambahBanyakBaris(namaSheet, senarai) {
  if (!senarai.length) return;
  const header = HEADER_UNTUK(namaSheet);
  const sh = dapatkanSheet(namaSheet);
  const baris = senarai.map(o => header.map(h => (o[h] === undefined || o[h] === null) ? '' : o[h]));
  sh.getRange(sh.getLastRow() + 1, 1, baris.length, header.length).setValues(baris);
  batalMemo(namaSheet);
}
function kemaskiniBaris(namaSheet, objek) {
  const header = HEADER_UNTUK(namaSheet);
  dapatkanSheet(namaSheet).getRange(objek.__row, 1, 1, header.length)
    .setValues([header.map(h => (objek[h] === undefined || objek[h] === null) ? '' : objek[h])]);
  batalMemo(namaSheet);
}
/* Padam beberapa baris (nombor baris) — dari bawah ke atas supaya indeks tidak beralih. */
function padamBaris(namaSheet, senaraiNomborBaris) {
  const sh = dapatkanSheet(namaSheet);
  /* Kumpulkan baris berturutan → satu panggilan deleteRows (jauh lebih pantas). */
  const s = Array.from(new Set(senaraiNomborBaris)).sort((a, b) => b - a);
  let i = 0;
  while (i < s.length) {
    let akhir = s[i], mula = s[i];
    while (i + 1 < s.length && s[i + 1] === mula - 1) { i++; mula = s[i]; }
    if (akhir === mula) sh.deleteRow(mula); else sh.deleteRows(mula, akhir - mula + 1);
    i++;
  }
  batalMemo(namaSheet);
}
function HEADER_UNTUK(namaSheet) {
  const kunci = Object.keys(SHEET).find(k => SHEET[k] === namaSheet);
  if (!kunci || !HEADER[kunci]) throw new Error('Header tidak ditakrif untuk ' + namaSheet);
  return HEADER[kunci];
}

/* Tulis secara bersiri (elak dua guru menulis serentak merosakkan baris). */
/* Semua penulisan data melalui kunci skrip (satu penulis pada satu masa):
   • memo baca dikosongkan selepas kunci diperoleh — data dibaca SEMULA dari Sheet,
     jadi semakan "rekod sedia ada?" sentiasa melihat simpanan guru lain (tiada pendua);
   • ID_PERMINTAAN (dari klien) menjadikan simpanan idempoten — permintaan yang
     dihantar semula (rangkaian putus, klik dua kali, cuba semula automatik) tidak
     ditulis dua kali, sebaliknya hasil asal dipulangkan;
   • jika barisan menunggu terlalu panjang, pulangkan kod SIBUK (klien cuba semula). */
let ID_PERMINTAAN = '';
function denganKunci(fn) {
  const kunci = LockService.getScriptLock();
  if (!kunci.tryLock(28000)) return ralat('Sistem sedang memproses simpanan ramai guru serentak. Sila cuba lagi sebentar.', 'SIBUK');
  const id = ID_PERMINTAAN; ID_PERMINTAAN = '';   // sekali sahaja bagi setiap permintaan
  const cache = CacheService.getScriptCache(), kunciId = id ? 'idp_' + id : '';
  try {
    if (kunciId) { const ada = cache.get(kunciId); if (ada) { const h = JSON.parse(ada); h.ulangan = true; return h; } }
    Object.keys(MEMO_DATA).forEach(k => { delete MEMO_DATA[k]; });
    const hasil = fn();
    SpreadsheetApp.flush();
    if (kunciId && hasil && hasil.success) { try { const j = JSON.stringify(hasil); if (j.length < 90000) cache.put(kunciId, j, 1800); } catch (e) { /* abaikan */ } }
    return hasil;
  } finally { kunci.releaseLock(); }
}

/* ------------------------- TARIKH & MASA ------------------------- */
function formatTarikh(d) { return Utilities.formatDate(d, ZON_MASA, 'yyyy-MM-dd'); }
function formatMasa(d) { return Utilities.formatDate(d, ZON_MASA, 'HH:mm'); }
function formatTarikhMasa(d) { return Utilities.formatDate(d, ZON_MASA, 'yyyy-MM-dd HH:mm:ss'); }
function sekarang() { return new Date(); }
function tarikhHariIni() { return formatTarikh(sekarang()); }
function masaSekarang() { return formatMasa(sekarang()); }
function keTarikh(n) { return String(n instanceof Date ? formatTarikh(n) : n || '').trim().slice(0, 10); }
function keHHmm(n) {
  if (n instanceof Date) return formatMasa(n);
  const m = String(n || '').trim().match(/^(\d{1,2})[:.](\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : String(n || '').trim();
}
/* Hari (ISNIN..) bagi tarikh 'yyyy-MM-dd' — dikira tanpa zon masa (tengah hari UTC). */
function hariBagiTarikh(tarikh) {
  const [y, m, d] = keTarikh(tarikh).split('-').map(Number);
  return HARI_MS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}
function tambahHari(tarikh, n) {
  const [y, m, d] = keTarikh(tarikh).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n, 12));
  return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2);
}
function tarikhSah(t) { return /^\d{4}-\d{2}-\d{2}$/.test(String(t || '')); }
function minitDaripadaHHmm(hhmm) { const [h, m] = keHHmm(hhmm).split(':').map(Number); return h * 60 + m; }

/* ------------------------- TETAPAN ------------------------- */
let MEMO_TETAPAN = null;
function tetapan(kunci) {
  if (!MEMO_TETAPAN) {
    MEMO_TETAPAN = {};
    TETAPAN_LALAI.forEach(r => { MEMO_TETAPAN[r[0]] = r[1]; });
    try {
      bacaSheetSebagaiObjek(SHEET.TETAPAN).forEach(r => {
        if (r.Kunci) MEMO_TETAPAN[String(r.Kunci).trim()] = String(r.Nilai === undefined ? '' : r.Nilai).trim();
      });
    } catch (e) { /* Sheet belum wujud — guna lalai */ }
  }
  return MEMO_TETAPAN[kunci] === undefined ? '' : MEMO_TETAPAN[kunci];
}

/* ------------------------- CACHE BESAR (dipecah) -------------------------
   CacheService had 100KB setiap kunci — pecahkan JSON kepada kepingan. */
function simpanCacheBesar(kunci, objek, saat) {
  try {
    const teks = JSON.stringify(objek);
    const saiz = 90000;
    const bil = Math.ceil(teks.length / saiz);
    const peta = {};
    for (let i = 0; i < bil; i++) peta[kunci + '_' + i] = teks.substr(i * saiz, saiz);
    peta[kunci + '_n'] = String(bil);
    CacheService.getScriptCache().putAll(peta, saat || 600);
  } catch (e) { /* cache pilihan sahaja */ }
}
function bacaCacheBesar(kunci) {
  try {
    const c = CacheService.getScriptCache();
    const bil = Number(c.get(kunci + '_n') || 0);
    if (!bil) return null;
    const kunciKunci = [];
    for (let i = 0; i < bil; i++) kunciKunci.push(kunci + '_' + i);
    const keping = c.getAll(kunciKunci);
    let teks = '';
    for (let i = 0; i < bil; i++) { if (keping[kunciKunci[i]] === undefined) return null; teks += keping[kunciKunci[i]]; }
    return JSON.parse(teks);
  } catch (e) { return null; }
}
function padamCacheBesar(kunci) { try { CacheService.getScriptCache().remove(kunci + '_n'); } catch (e) { /* abaikan */ } }

/* ------------------------- ID, TEKS & AUDIT ------------------------- */
function janaId(prefiks) { return prefiks + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }
function digitSahaja(s) { return String(s || '').replace(/\D/g, ''); }
function samaNoKP(a, b) { const x = digitSahaja(a), y = digitSahaja(b); return !!x && x === y; }
function normalNama(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').replace(/[^A-Z0-9 @'/.-]/g, '').trim(); }
function normalKelas(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function senaraiDaripadaMedan(s) { return String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean); }
function bulatPeratus(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }

function catatAudit(sesi, tindakan, butiran) {
  try {
    /* appendRow adalah atomik — selamat walaupun ramai pengguna serentak tanpa kunci. */
    dapatkanSheet(SHEET.AUDIT).appendRow(["'" + formatTarikhMasa(sekarang()), sesi ? "'" + String(sesi.nokp || '') : '',
      sesi ? sesi.nama || '' : '', tindakan, String(butiran || '').slice(0, 1000)]);
    batalMemo(SHEET.AUDIT);
  } catch (e) { /* audit tidak boleh menggagalkan operasi utama */ }
}

/* Gambar Drive → URL lakaran kecil yang boleh dipaparkan dalam <img>.
   Fail Drive mesti dikongsi "Sesiapa yang mempunyai pautan". */
function urlGambar(nilai) {
  const s = String(nilai || '').trim();
  if (!s) return '';
  const m = s.match(/[-\w]{25,}/);
  if (/^https?:\/\//i.test(s) && !/drive\.google\.com|docs\.google\.com/i.test(s)) return s;
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[0] + '&sz=w400';
  return s;
}
