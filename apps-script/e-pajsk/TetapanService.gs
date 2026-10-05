/* =========================================================================
 * TetapanService.gs — Tetapan sistem (Sheet TETAPAN: KUNCI | NILAI) dan
 * jadual rujukan skor (Sheet REFERENSI) yang dicache seketika.
 * ========================================================================= */

const HEADER_TETAPAN = ['KUNCI', 'NILAI'];
const HEADER_REFERENSI = ['JENIS', 'KOD', 'NILAI', 'KETERANGAN'];
const CACHE_RUJUKAN = 'rujukan_epajsk_v1';

function tetapanLalai() {
  return [
    [TET_TAHUN, String(new Date().getFullYear())],
    [TET_KOD_SEKOLAH, ''],
    [TET_NAMA_SEKOLAH, 'SMK ASAJAYA'],
    [TET_ID_KOKO, ID_EKOKURIKULUM_LALAI],
    [TET_ID_FOLDER_ARKIB, '']
  ];
}

function bacaTetapan() {
  const peta = {};
  tetapanLalai().forEach(r => { peta[r[0]] = r[1]; });
  bacaSheetSebagaiObjek(SHEET_TETAPAN).forEach(r => { peta[r.KUNCI] = r.NILAI; });
  return peta;
}

function dapatTetapan(kunci) {
  const v = bacaTetapan()[kunci];
  return v === undefined || v === null ? '' : String(v);
}

function tulisTetapan(kunci, nilai) {
  const sh = dapatkanSheet(SHEET_TETAPAN);
  const sedia = bacaSheetSebagaiObjek(SHEET_TETAPAN).find(r => r.KUNCI === kunci);
  if (sedia) sh.getRange(sedia.__row, 2).setValue(nilai);
  else sh.appendRow([kunci, nilai]);
}

function tahunSemasa() {
  return Number(dapatTetapan(TET_TAHUN)) || new Date().getFullYear();
}

function apiTetapan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const t = bacaTetapan();
  return jaya({
    tahun: Number(t[TET_TAHUN]) || new Date().getFullYear(),
    kodSekolah: t[TET_KOD_SEKOLAH] || '',
    namaSekolah: t[TET_NAMA_SEKOLAH] || '',
    idKoko: sesi.peranan === ROLE_ADMIN ? (t[TET_ID_KOKO] || '') : ''
  });
}

function apiSimpanTetapan(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const tahun = Number(p.tahun);
  if (!tahun || tahun < 2000 || tahun > 2100) return ralat('Tahun pentaksiran tidak sah.');
  const idKoko = String(p.idKoko || '').trim();
  if (idKoko && !/^[\w-]{20,}$/.test(idKoko)) return ralat('ID Google Sheet e-Kokurikulum tidak sah.');
  if (idKoko) {
    try { SpreadsheetApp.openById(idKoko).getSheetByName(KOKO_SHEET_MURID); }
    catch (e) { return ralat('Tidak dapat membuka Sheet e-Kokurikulum dengan ID itu. Pastikan akaun yang men-deploy mempunyai akses.'); }
  }
  return denganKunci(() => {
    tulisTetapan(TET_TAHUN, String(tahun));
    tulisTetapan(TET_KOD_SEKOLAH, String(p.kodSekolah || '').trim());
    tulisTetapan(TET_NAMA_SEKOLAH, String(p.namaSekolah || '').trim());
    if (idKoko) tulisTetapan(TET_ID_KOKO, idKoko);
    catatAudit(sesi, 'KEMASKINI', 'TETAPAN', '', 'Tahun ' + tahun);
    return jaya({});
  });
}

/* ------------------------- RUJUKAN SKOR ------------------------- */
/* Hasil: { pilihan: {JENIS: [[kod, nilai], ...]}, peta: {JENIS: {kod: nilai}}, gred: [{gred,min,label,rumusan}] } */
function muatRujukan() {
  const cache = CacheService.getScriptCache();
  const tersimpan = cache.get(CACHE_RUJUKAN);
  if (tersimpan) return JSON.parse(tersimpan);

  const pilihan = {};
  const peta = {};
  const gred = [];
  bacaSheetSebagaiObjek(SHEET_REFERENSI).forEach(r => {
    const jenis = String(r.JENIS).trim();
    const kod = String(r.KOD).trim();
    if (!jenis || !kod) return;
    if (jenis === 'GRED') {
      const bahagian = String(r.KETERANGAN || '').split('||');
      gred.push({ gred: kod, min: nombor(r.NILAI), label: bahagian[0] || '', rumusan: bahagian[1] || '' });
      return;
    }
    const nilai = nombor(r.NILAI);
    (pilihan[jenis] = pilihan[jenis] || []).push([kod, nilai]);
    peta[jenis] = peta[jenis] || {};
    if (peta[jenis][kod] === undefined) peta[jenis][kod] = nilai;
  });
  gred.sort((a, b) => a.min - b.min);
  const hasil = { pilihan, peta, gred };
  try { cache.put(CACHE_RUJUKAN, JSON.stringify(hasil), 300); } catch (e) { /* terlalu besar? abaikan */ }
  return hasil;
}

function kosongkanCacheRujukan() {
  CacheService.getScriptCache().remove(CACHE_RUJUKAN);
}

function apiRujukan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  return jaya({ rujukan: muatRujukan() });
}

/* Admin: senarai penuh REFERENSI (untuk semakan di antara muka) */
function apiSenaraiRujukanPenuh(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  return jaya({ senarai: bacaSheetSebagaiObjek(SHEET_REFERENSI).map(r => ({ jenis: r.JENIS, kod: r.KOD, nilai: r.NILAI, keterangan: r.KETERANGAN })) });
}
