/* =========================================================================
 * TetapanService.gs — Sheet TETAPAN (Kunci | Nilai | Keterangan).
 * Tetapan sistem yang boleh diubah oleh Admin/Ketua Bidang terus dari portal
 * (menu Tetapan) atau dalam Sheet: Google Calendar dua hala, peringatan,
 * masa lalai, dan nama Pengetua/PK Pentadbiran/Setiausaha untuk Carta
 * Organisasi. Jika Sheet TETAPAN belum wujud, nilai lalai di bawah digunakan.
 * ========================================================================= */

const HEADER_TETAPAN = ['Kunci', 'Nilai', 'Keterangan'];

function tetapanAwal() {
  return [
    ['CALENDAR_ID', '', 'ID Google Calendar khusus. Kosong = kalendar "E-Bidang Sains & Matematik" dicipta automatik.'],
    ['DUA_HALA', 'YA', 'YA = perubahan tarikh/masa/tempat yang dibuat terus di Google Calendar ditarik balik ke portal.'],
    ['JEMPUT_GURU', 'YA', 'YA = ahli panitia (yang ada Emel) dijemput ke event tanpa e-mel jemputan. TIDAK = kalendar bidang sahaja.'],
    ['SELANG_SYNC_MINIT', '15', 'Selang segerak automatik: 5, 10, 15 atau 30 minit (nilai lain = setiap jam).'],
    ['PERINGATAN_MINIT', '30', 'Peringatan pop-up sebelum event (minit). 0 = tiada peringatan.'],
    ['MASA_MULA_LALAI', '', 'Masa mula lalai (HH:mm) bagi aktiviti tanpa masa. Kosong = event sepanjang hari.'],
    ['MASA_TAMAT_LALAI', '', 'Masa tamat lalai (HH:mm) bagi aktiviti tanpa masa.'],
    ['TEMPAT_LALAI', '', 'Tempat lalai mesyuarat/PLC jika tidak diisi (cth. Bilik Mesyuarat Utama).'],
    ['PENGETUA', '', 'No. KP atau nama Pengetua (Penasihat dalam Carta Organisasi).'],
    ['PK_PENTADBIRAN', '', 'No. KP atau nama PK Pentadbiran (Penasihat Bersama).'],
    ['SETIAUSAHA_BIDANG', '', 'No. KP atau nama Setiausaha Bidang.']
  ];
}

const KUNCI_TETAPAN_SAH = tetapanAwal().map(t => t[0]);
let MEMO_TETAPAN = null;

/* Sel masa yang ditaip terus dalam Sheet (format Automatic) dibaca sebagai
   1899-12-30 HH:mm:ss — pulangkan HH:mm sahaja. */
function nilaiTetapanBersih(nilai) {
  const teks = String(nilai == null ? '' : nilai).trim();
  const padanan = teks.match(/^1899-12-3[01] (\d\d:\d\d)/);
  return padanan ? padanan[1] : teks;
}

function bacaTetapan() {
  if (MEMO_TETAPAN) return MEMO_TETAPAN;
  const hasil = {};
  tetapanAwal().forEach(t => { hasil[t[0]] = t[1]; });
  try {
    if (dapatkanSpreadsheet().getSheetByName(SHEET_TETAPAN)) {
      bacaSheetSebagaiObjek(SHEET_TETAPAN).forEach(r => {
        const kunci = String(r.Kunci || '').trim();
        if (kunci) hasil[kunci] = nilaiTetapanBersih(r.Nilai);
      });
    }
  } catch (e) { /* guna nilai lalai */ }
  MEMO_TETAPAN = hasil;
  return hasil;
}

function tetapan(kunci) { return String(bacaTetapan()[kunci] || '').trim(); }
function tetapanYa(kunci) { return tetapan(kunci).toUpperCase() === 'YA'; }
function tetapanNombor(kunci, lalai) {
  const n = Number(tetapan(kunci));
  return isNaN(n) || tetapan(kunci) === '' ? lalai : n;
}

/* Cipta Sheet TETAPAN dengan nilai lalai, atau tambah kunci baharu yang tiada. */
function pastikanSheetTetapan() {
  const ss = dapatkanSpreadsheet();
  let sh = ss.getSheetByName(SHEET_TETAPAN);
  let dicipta = false;
  if (!sh) {
    sh = ss.insertSheet(SHEET_TETAPAN);
    sh.getRange('A:C').setNumberFormat('@');
    sh.appendRow(HEADER_TETAPAN);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER_TETAPAN.length).setFontWeight('bold');
    sh.setColumnWidth(1, 190); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 520);
    dicipta = true;
  }
  const sediaAda = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]).trim()) : [];
  const baharu = tetapanAwal().filter(t => sediaAda.indexOf(t[0]) === -1);
  if (baharu.length) sh.getRange(sh.getLastRow() + 1, 1, baharu.length, 3).setValues(baharu);
  batalCacheSheet(SHEET_TETAPAN);
  MEMO_TETAPAN = null;
  return dicipta || baharu.length > 0;
}

function apiTetapan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const nilai = bacaTetapan();
  const keterangan = {};
  tetapanAwal().forEach(t => { keterangan[t[0]] = t[2]; });
  return jaya({
    senarai: KUNCI_TETAPAN_SAH.map(k => ({ kunci: k, nilai: nilai[k] || '', keterangan: keterangan[k] })),
    syncTerakhir: PropertiesService.getScriptProperties().getProperty('SYNC_TERAKHIR') || '',
    idKalendar: idKalendarTersimpan(),
    pencetusAktif: pencetusKalendarAktif()
  });
}

function apiSimpanTetapan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const input = p.nilai || {};
  const masa = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (input.MASA_MULA_LALAI && !masa.test(input.MASA_MULA_LALAI)) return ralat('Masa mula lalai mesti dalam format HH:mm.');
  if (input.MASA_TAMAT_LALAI && !masa.test(input.MASA_TAMAT_LALAI)) return ralat('Masa tamat lalai mesti dalam format HH:mm.');

  pastikanSheetTetapan();
  const lamaSelang = tetapan('SELANG_SYNC_MINIT');
  const lamaKalendar = tetapan('CALENDAR_ID');
  const sh = dapatkanSheet(SHEET_TETAPAN);
  const berubah = [];
  denganKunci(() => {
    const data = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues();
    Object.keys(input).forEach(kunci => {
      if (KUNCI_TETAPAN_SAH.indexOf(kunci) === -1) return;
      const nilai = String(input[kunci] == null ? '' : input[kunci]).trim();
      const idx = data.findIndex(r => String(r[0]).trim() === kunci);
      if (idx === -1) return;
      if (String(data[idx][1]).trim() === nilai) return;
      sh.getRange(idx + 2, 2).setNumberFormat('@').setValue(/^[=+@]/.test(nilai) ? "'" + nilai : nilai);
      berubah.push(kunci);
    });
  });
  batalCacheSheet(SHEET_TETAPAN);
  MEMO_TETAPAN = null;
  if (tetapan('CALENDAR_ID') !== lamaKalendar) MEMO_KALENDAR = null;
  if (tetapan('SELANG_SYNC_MINIT') !== lamaSelang && pencetusKalendarAktif()) pasangPencetusKalendar();
  if (berubah.length) catatAudit(sesi, 'KEMASKINI', 'TETAPAN', '-', 'Tetapan dikemaskini: ' + berubah.join(', '));
  return jaya({ berubah });
}
