/* =========================================================================
 * KokoService.gs — Penghubung terus ke Google Sheet e-Kokurikulum
 * (SpreadsheetApp.openById). Hanya BACA — e-PAJSK tidak mengubah data
 * e-Kokurikulum. Lajur dicari mengikut nama header (bukan kedudukan) supaya
 * tahan jika e-Kokurikulum menambah lajur.
 *
 * Data yang ditarik:
 *   MURID       -> senarai murid, tingkatan, kelas, unit PBB/KP/SP (+ jawatan jika diisi)
 *   KEHADIRAN_* -> bilangan perjumpaan dihadiri setiap murid (skor Kehadiran PAJSK)
 *   PENCAPAIAN  -> cadangan Pelibatan/Pencapaian (guru kelas sahkan sebelum simpan)
 *   PENGGUNA    -> senarai guru (import akaun)
 * ========================================================================= */

function bukaKoko() {
  const id = dapatTetapan(TET_ID_KOKO) || ID_EKOKURIKULUM_LALAI;
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Tidak dapat membuka Sheet e-Kokurikulum. Semak ID dalam menu Tetapan dan pastikan akaun Google yang men-deploy e-PAJSK mempunyai akses kepadanya.');
  }
}

/* Baca satu Sheet e-Kokurikulum -> {header:[HURUF BESAR], baris:[[...]]} atau null jika Sheet tiada. */
function bacaSheetKoko(ss, nama) {
  const sh = ss.getSheetByName(nama);
  if (!sh || sh.getLastRow() < 1) return null;
  const nilai = sh.getDataRange().getValues();
  const header = nilai.shift().map(h => banding(h));
  return { header, baris: nilai };
}

/* Cari indeks lajur: padanan boleh rentetan (sama penuh) atau RegExp. -1 jika tiada. */
function cariLajur(header, padanan) {
  for (let i = 0; i < header.length; i++) {
    if (padanan instanceof RegExp ? padanan.test(header[i]) : header[i] === padanan) return i;
  }
  return -1;
}

/* ------------------------- MURID ------------------------- */
function bacaMuridKoko() {
  const data = bacaSheetKoko(bukaKoko(), KOKO_SHEET_MURID);
  if (!data) throw new Error('Sheet "' + KOKO_SHEET_MURID + '" tiada dalam e-Kokurikulum.');
  const h = data.header;
  const idx = {
    kp: cariLajur(h, /^NO\.? ?KP$/),
    nama: cariLajur(h, /^NAMA/),
    ting: cariLajur(h, /^TINGKATAN$/),
    kelas: cariLajur(h, /^KELAS$/),
    unit: {
      PBB: cariLajur(h, /^(?!JAWATAN).*\(PBB\)/),
      KP: cariLajur(h, /^(?!JAWATAN).*\(KP\)/),
      SP: cariLajur(h, /^(?!JAWATAN).*\(SP\)/)
    },
    jaw: {
      PBB: cariLajur(h, /^JAWATAN.*PBB/),
      KP: cariLajur(h, /^JAWATAN.*KP/),
      SP: cariLajur(h, /^JAWATAN.*SP/)
    }
  };
  if (idx.kp < 0 || idx.nama < 0 || idx.ting < 0 || idx.kelas < 0) {
    throw new Error('Struktur Sheet MURID e-Kokurikulum tidak dikenali (lajur NO. KP / NAMA PENUH / TINGKATAN / KELAS diperlukan).');
  }
  const hasil = [];
  const dilihat = {};
  data.baris.forEach(b => {
    const nokp = normalKP(b[idx.kp]);
    const ting = nomborTingkatan(b[idx.ting]);
    const kelas = banding(b[idx.kelas]);
    if (nokp.length !== 12 || !ting || !kelas || dilihat[nokp]) return;
    dilihat[nokp] = true;
    const unit = {}, jawatan = {};
    SEMUA_ASPEK.forEach(a => {
      unit[a] = idx.unit[a] >= 0 ? banding(b[idx.unit[a]]) : '';
      jawatan[a] = idx.jaw[a] >= 0 ? banding(b[idx.jaw[a]]) : '';
    });
    hasil.push({ nokp, nama: banding(b[idx.nama]), tingkatan: ting, kelas, kunciKelas: ting + ' ' + kelas, unit, jawatan });
  });
  return hasil;
}

/* ------------------------- GURU ------------------------- */
function bacaGuruKoko() {
  const data = bacaSheetKoko(bukaKoko(), KOKO_SHEET_PENGGUNA);
  if (!data) throw new Error('Sheet "' + KOKO_SHEET_PENGGUNA + '" tiada dalam e-Kokurikulum.');
  const h = data.header;
  const iKp = cariLajur(h, /^NO\.? ?KP$/), iNama = cariLajur(h, /^NAMA/), iEmel = cariLajur(h, /^E-?MEL$/);
  if (iKp < 0 || iNama < 0) throw new Error('Struktur Sheet PENGGUNA e-Kokurikulum tidak dikenali.');
  const hasil = [];
  data.baris.forEach(b => {
    const nokp = normalKP(b[iKp]);
    const nama = banding(b[iNama]);
    if (nokp.length !== 12 || !nama) return;
    hasil.push({ nokp, nama, emel: iEmel >= 0 ? String(b[iEmel] || '').trim() : '' });
  });
  return hasil;
}

/* ------------------------- KEHADIRAN ------------------------- */
function adalahHadir(status) {
  const s = banding(status);
  return KOKO_STATUS_HADIR.indexOf(s) !== -1;
}

/* Hasil: { kira: {PBB:{nokp:bil}, KP:{...}, SP:{...}}, amaran: [..] }
   Satu perjumpaan = gabungan unik TARIKH + PERJUMPAAN; murid yang HADIR dikira sekali sahaja bagi setiap perjumpaan. */
function bacaKehadiranKoko(tahun) {
  const ss = bukaKoko();
  const kira = {}, amaran = [];
  SEMUA_ASPEK.forEach(aspek => {
    kira[aspek] = {};
    const data = bacaSheetKoko(ss, KOKO_SHEET_KEHADIRAN[aspek]);
    if (!data) { amaran.push('Sheet kehadiran ' + aspek + ' tiada dalam e-Kokurikulum.'); return; }
    const h = data.header;
    const iTarikh = cariLajur(h, 'TARIKH'), iPerj = cariLajur(h, 'PERJUMPAAN');
    const iKp = cariLajur(h, /^NO\.? ?_?KP$/), iStatus = cariLajur(h, 'STATUS');
    if (iKp < 0 || iStatus < 0) { amaran.push('Struktur Sheet kehadiran ' + aspek + ' tidak dikenali.'); return; }
    const sesi = {};
    data.baris.forEach(b => {
      if (!adalahHadir(b[iStatus])) return;
      const thn = iTarikh >= 0 ? tahunDaripadaTarikh(b[iTarikh]) : null;
      if (thn !== null && thn !== tahun) return;
      const nokp = normalKP(b[iKp]);
      if (!nokp) return;
      const kunciSesi = (iTarikh >= 0 ? String(nilaiSelSebagaiTeks(b[iTarikh])) : '') + '|' + (iPerj >= 0 ? banding(b[iPerj]) : '');
      (sesi[nokp] = sesi[nokp] || {})[kunciSesi] = true;
    });
    Object.keys(sesi).forEach(nokp => { kira[aspek][nokp] = Object.keys(sesi[nokp]).length; });
  });
  return { kira, amaran };
}

/* ------------------------- PENCAPAIAN (cadangan) ------------------------- */
const URUTAN_PERINGKAT = ['ANTARABANGSA', 'KEBANGSAAN', 'NEGERI', 'BAHAGIAN', 'DAERAH', 'ZON', 'SEKOLAH'];

function kodPeringkat(teks) {
  const s = banding(teks);
  for (let i = 0; i < URUTAN_PERINGKAT.length; i++) if (s.indexOf(URUTAN_PERINGKAT[i]) !== -1) return URUTAN_PERINGKAT[i];
  return '';
}

function kodKedudukan(teks) {
  const s = banding(teks);
  if (/NAIB\s*JOHAN|^2$|KEDUA|TEMPAT 2|KE-?2/.test(s)) return 'NAIB JOHAN';
  if (/JOHAN|^1$|PERTAMA|TEMPAT 1|KE-?1/.test(s)) return 'JOHAN';
  if (/KETIGA|^3$|TEMPAT 3|KE-?3/.test(s)) return 'KETIGA';
  if (/KEEMPAT|^4$|TEMPAT 4|KE-?4/.test(s)) return 'KEEMPAT';
  if (/KELIMA|^5$|TEMPAT 5|KE-?5/.test(s)) return 'KELIMA';
  return '';
}

/* Tukar peringkat/kedudukan e-Kokurikulum kepada label jadual PAJSK (kosong jika tiada padanan). */
function labelPelibatan(peringkat, ref) {
  const k = kodPeringkat(peringkat);
  if (!k) return '';
  if (k === 'SEKOLAH') return 'SEKOLAH';
  const akhir = (k === 'DAERAH' || k === 'ZON') ? 'ZON/DAERAH' : (k === 'BAHAGIAN' ? 'BAHAGIAN (SABAH/SARAWAK)' : k);
  const label = 'PELIBATAN 1 ' + akhir;
  return ref.peta.PELIBATAN && ref.peta.PELIBATAN[label] !== undefined ? label : '';
}

function labelPencapaian(peringkat, kedudukan, ref) {
  const k = kodPeringkat(peringkat), rank = kodKedudukan(kedudukan);
  if (!k || !rank) return '';
  const senarai = ref.peta.PENCAPAIAN || {};
  const calon = [];
  if (k === 'BAHAGIAN') calon.push(rank + ' BAHAGIAN (SABAH/SARAWAK)');
  else if (k === 'DAERAH' || k === 'ZON') calon.push(rank + ' ' + k, rank + ' ZON/DAERAH');
  else calon.push(rank + ' ' + k);
  return calon.find(c => senarai[c] !== undefined) || '';
}

/* Pencapaian e-Kokurikulum bagi seorang murid (padanan No. KP; jika No. KP kosong pada rekod,
   padanan nama penuh). Tapis ikut tahun pentaksiran. */
function bacaPencapaianKokoMurid(murid, tahun, ref) {
  const data = bacaSheetKoko(bukaKoko(), KOKO_SHEET_PENCAPAIAN);
  if (!data) return [];
  const h = data.header;
  const iTarikh = cariLajur(h, 'TARIKH'), iKp = cariLajur(h, /^NO\.? ?_?KP$/), iNama = cariLajur(h, /^NAMA/);
  const iPert = cariLajur(h, 'PERTANDINGAN'), iPering = cariLajur(h, 'PERINGKAT'), iCapai = cariLajur(h, 'PENCAPAIAN');
  const hasil = [];
  data.baris.forEach(b => {
    const kp = iKp >= 0 ? normalKP(b[iKp]) : '';
    const padan = kp ? kp === murid.NoKP : (iNama >= 0 && banding(b[iNama]) === banding(murid.Nama));
    if (!padan) return;
    const thn = iTarikh >= 0 ? tahunDaripadaTarikh(b[iTarikh]) : null;
    if (thn !== null && thn !== tahun) return;
    const pertandingan = banding(b[iPert]), peringkat = banding(b[iPering]), capai = banding(b[iCapai]);
    hasil.push({
      tarikh: iTarikh >= 0 ? String(nilaiSelSebagaiTeks(b[iTarikh])) : '',
      pertandingan, peringkat, pencapaian: capai,
      cadanganLibat: labelPelibatan(peringkat, ref),
      cadanganCapai: labelPencapaian(peringkat, capai, ref),
      aspekCadangan: tekaAspekPertandingan(pertandingan, murid)
    });
  });
  return hasil;
}

/* Teka aspek berdasarkan nama pertandingan vs nama unit murid (cth. "KEJOHANAN MEMANAH ..." <-> unit SP "MEMANAH"). */
function tekaAspekPertandingan(pertandingan, murid) {
  const kuat = (unit) => {
    const token = banding(unit).split(/[^A-Z0-9]+/).filter(t => t.length >= 4 && ['DAN', 'KELAB', 'PERSATUAN', 'PASUKAN'].indexOf(t) === -1);
    return token.some(t => pertandingan.indexOf(t) !== -1);
  };
  const urutan = [ASPEK_SP, ASPEK_KP, ASPEK_PBB];
  for (let i = 0; i < urutan.length; i++) {
    const u = urutan[i] === ASPEK_PBB ? murid.PBB_Unit : (urutan[i] === ASPEK_KP ? murid.KP_Unit : murid.SP_Unit);
    if (u && kuat(u)) return urutan[i];
  }
  return '';
}
