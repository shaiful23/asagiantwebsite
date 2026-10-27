/* =========================================================================
 * KokoService.gs — Penghubung terus ke Google Sheet e-Kokurikulum
 * (SpreadsheetApp.openById). Hanya BACA — e-PAJSK tidak mengubah data
 * e-Kokurikulum. Lajur dicari mengikut nama header (bukan kedudukan) supaya
 * tahan jika e-Kokurikulum menambah lajur.
 *
 * Data yang ditarik:
 *   MURID       -> senarai murid, tingkatan, kelas, unit PBB/KP/SP (+ jawatan jika diisi)
 *   KEHADIRAN_* -> bilangan perjumpaan dihadiri setiap murid (skor Kehadiran PAJSK)
 *   PENCAPAIAN  -> Pelibatan/Pencapaian diisi automatik ke unit berdaftar murid (UNIT_PAJSK; jika kosong, UNIT)
 *                  + cadangan untuk diisi secara manual
 *   PENGGUNA    -> senarai guru (import akaun)
 * ========================================================================= */

let _memoKoko = null;

function idKoko() { return dapatTetapan(TET_ID_KOKO) || ID_EKOKURIKULUM_LALAI; }

function bukaKoko() {
  if (_memoKoko) return _memoKoko;
  try {
    _memoKoko = cubaSemula(() => SpreadsheetApp.openById(idKoko()));
    return _memoKoko;
  } catch (e) {
    throw new Error('Tidak dapat membuka Sheet e-Kokurikulum. Semak ID dalam menu Tetapan dan pastikan akaun Google yang men-deploy e-PAJSK mempunyai akses kepadanya.');
  }
}

/* Masa kemas kini terakhir fail e-Kokurikulum (ms) daripada Drive — panggilan ringan untuk mengesan perubahan.
   0 jika tidak dapat dibaca (cache dilangkau). */
function masaKemaskiniKoko() {
  try { return cubaSemula(() => DriveApp.getFileById(idKoko()).getLastUpdated().getTime(), 2); } catch (e) { return 0; }
}

/* Baca hanya lajur yang diperlukan (lebih pantas daripada getDataRange untuk Sheet kehadiran yang besar). */
function bacaLajurSheet(sh, indeks, barisAkhir) {
  if (barisAkhir < 2) return [];
  return cubaSemula(() => sh.getRange(2, indeks + 1, barisAkhir - 1, 1).getValues()).map(r => r[0]);
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
  // Lajur UNITn_KATEGORI / UNITn_NAMA / UNITn_JAWATAN (n = 1, 2, ...)
  const slotUnit = [];
  h.forEach((nama, i) => {
    const m = String(nama).match(/^UNIT(\d+)_KATEGORI$/);
    if (!m) return;
    slotUnit.push({ kat: i, nama: cariLajur(h, 'UNIT' + m[1] + '_NAMA'), jaw: cariLajur(h, 'UNIT' + m[1] + '_JAWATAN') });
  });
  const hasil = [];
  data.baris.forEach(b => {
    const nokp = normalKP(b[iKp]);
    const nama = banding(b[iNama]);
    if (nokp.length !== 12 || !nama) return;
    const unitKgp = [];
    slotUnit.forEach(s => {
      if (s.nama < 0 || s.jaw < 0) return;
      const unit = banding(b[s.nama]), kat = banding(b[s.kat]), jaw = banding(b[s.jaw]);
      if (!unit || !KOKO_JAWATAN_KGP.test(jaw)) return;
      const aspek = SEMUA_ASPEK.find(a => KATA_KUNCI_KATEGORI[a].test(kat));
      if (aspek) unitKgp.push(kunciUnit(aspek, unit));
    });
    hasil.push({ nokp, nama, emel: iEmel >= 0 ? String(b[iEmel] || '').trim() : '', unitKgp });
  });
  return hasil;
}

/* ------------------------- KEHADIRAN ------------------------- */
function adalahHadir(status) {
  const s = banding(status);
  return KOKO_STATUS_HADIR.indexOf(s) !== -1;
}

/* Cari Sheet kehadiran bagi satu aspek. Nama dalam Config (KOKO_SHEET_KEHADIRAN) dicuba dahulu; jika tiada, cari
   mengikut kata kunci (cth. nama penuh "KEHADIRAN_PASUKAN_BADAN_BERUNIFORM" yang dipotong kepada 31 aksara dalam
   eksport .xlsx, atau nama yang sedikit berbeza). Padanan huruf besar/kecil tidak dipentingkan. */
const KATA_KUNCI_SHEET_KEHADIRAN = { PBB: /BERUNIF|PASUKAN/, KP: /KELAB|PERSATUAN/, SP: /SUKAN|PERMAINAN/ };

function cariSheetKehadiran(ss, aspek) {
  const tepat = ss.getSheetByName(KOKO_SHEET_KEHADIRAN[aspek]);
  if (tepat) return tepat;
  const calon = ss.getSheets().filter(sh => {
    const n = banding(sh.getName());
    return n.indexOf('KEHADIRAN') === 0 && KATA_KUNCI_SHEET_KEHADIRAN[aspek].test(n);
  });
  return calon.length ? calon[0] : null;
}

/* Hasil: { kira: {PBB:{nokp:bil}, KP:{...}, SP:{...}}, amaran: [..] }
   Satu perjumpaan = gabungan unik TARIKH + PERJUMPAAN; murid yang HADIR dikira sekali sahaja bagi setiap perjumpaan.
   Hanya 4 lajur dibaca daripada setiap Sheet kehadiran. */
function bacaKehadiranKoko(tahun) {
  const ss = bukaKoko();
  const kira = {}, amaran = [];
  SEMUA_ASPEK.forEach(aspek => {
    kira[aspek] = {};
    const sh = cariSheetKehadiran(ss, aspek);
    if (!sh) {
      const senarai = ss.getSheets().map(x => x.getName()).filter(n => /KEHADIRAN/i.test(n));
      amaran.push('Sheet kehadiran ' + aspek + ' tiada dalam e-Kokurikulum (dicari: "' + KOKO_SHEET_KEHADIRAN[aspek] + '"; Sheet kehadiran yang ada: ' + (senarai.join(', ') || 'tiada') + ').');
      return;
    }
    if (sh.getLastRow() < 1) return;
    const h = cubaSemula(() => sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]).map(x => banding(x));
    const iTarikh = cariLajur(h, 'TARIKH'), iPerj = cariLajur(h, 'PERJUMPAAN');
    const iKp = cariLajur(h, /^NO\.? ?_?KP$/), iStatus = cariLajur(h, 'STATUS');
    if (iKp < 0 || iStatus < 0) { amaran.push('Struktur Sheet kehadiran ' + aspek + ' tidak dikenali.'); return; }
    const akhir = sh.getLastRow();
    const lStatus = bacaLajurSheet(sh, iStatus, akhir), lKp = bacaLajurSheet(sh, iKp, akhir);
    const lTarikh = iTarikh >= 0 ? bacaLajurSheet(sh, iTarikh, akhir) : [], lPerj = iPerj >= 0 ? bacaLajurSheet(sh, iPerj, akhir) : [];
    const sesi = {};
    for (let i = 0; i < lStatus.length; i++) {
      if (!adalahHadir(lStatus[i])) continue;
      const thn = iTarikh >= 0 ? tahunDaripadaTarikh(lTarikh[i]) : null;
      if (thn !== null && thn !== tahun) continue;
      const nokp = normalKP(lKp[i]);
      if (!nokp) continue;
      const kunciSesi = (iTarikh >= 0 ? String(nilaiSelSebagaiTeks(lTarikh[i])) : '') + '|' + (iPerj >= 0 ? banding(lPerj[i]) : '');
      (sesi[nokp] = sesi[nokp] || {})[kunciSesi] = true;
    }
    Object.keys(sesi).forEach(nokp => { kira[aspek][nokp] = Object.keys(sesi[nokp]).length; });
  });
  return { kira, amaran };
}

/* Murid + kehadiran e-Kokurikulum yang sudah diproses, dicache mengikut masa kemas kini fail: jika fail
   e-Kokurikulum tidak berubah, segerak tidak perlu membaca apa-apa daripadanya. paksa=true abaikan cache. */
function bacaKokoRingkas(tahun, paksa) {
  const ts = masaKemaskiniKoko();
  const kunci = 'kokov2_' + ts + '_' + tahun;   // v2: nama Sheet kehadiran kini dicari mengikut kata kunci
  if (!paksa && ts) {
    const teks = cacheGetBesar(kunci);
    if (teks) { const o = JSON.parse(teks); o.ts = ts; o.dariCache = true; return o; }
  }
  const murid = bacaMuridKoko();
  const h = bacaKehadiranKoko(tahun);
  const hasil = { murid, kira: h.kira, amaran: h.amaran };
  if (ts && !h.amaran.length) cachePutBesar(kunci, JSON.stringify(hasil), 60 * 60);   // jangan cache hasil yang tidak lengkap
  hasil.ts = ts;
  hasil.dariCache = false;
  return hasil;
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
  // Peringkat lama dipadankan dengan yang baharu: ZON / DAERAH = ZON/DAERAH, BAHAGIAN = BAHAGIAN (SABAH/SARAWAK).
  if (k === 'BAHAGIAN') calon.push(rank + ' BAHAGIAN (SABAH/SARAWAK)', rank + ' BAHAGIAN');
  else if (k === 'DAERAH' || k === 'ZON') calon.push(rank + ' ZON/DAERAH', rank + ' ' + k, rank + (k === 'ZON' ? ' DAERAH' : ' ZON'));
  else calon.push(rank + ' ' + k);
  return calon.find(c => senarai[c] !== undefined) || '';
}

/* Kategori e-Kokurikulum (lajur KATEGORI) -> aspek PAJSK. '' jika tidak dikenali. */
function aspekDaripadaKategori(teks) {
  const s = banding(teks);
  if (!s) return '';
  if (/BERUNIFORM|BADAN BERUNIFORM|\bPBB\b/.test(s)) return ASPEK_PBB;
  if (/KELAB|PERSATUAN|\bKP\b/.test(s)) return ASPEK_KP;
  if (/SUKAN|PERMAINAN|\bSP\b/.test(s)) return ASPEK_SP;
  return '';
}

/* Banding nama unit tanpa peka huruf besar, ruang dan tanda baca ("&" = "DAN"). */
function samaUnit(a, b) {
  const n = (x) => banding(x).replace(/&/g, ' DAN ').replace(/[^A-Z0-9]+/g, '');
  const x = n(a), y = n(b);
  return !!x && x === y;
}

/* Unit pelibatan bagi satu rekod pencapaian: UNIT_PAJSK (unit berdaftar murid) jika ada; jika kosong (rekod lama)
   guna UNIT (unit yang merekod). */
function unitPelibatanKoko(r) { return r.unitPajsk || r.unit || ''; }

/* Tentukan aspek PAJSK bagi rekod pencapaian seorang murid -> {aspek, padan}.
   padan = unit pelibatan sama dengan unit berdaftar murid dalam e-PAJSK bagi aspek itu (boleh diisi automatik). */
function tentukanAspekPencapaian(r, murid) {
  const unit = unitPelibatanKoko(r);
  const unitMurid = (a) => murid[a + '_Unit'] || '';
  let aspek = aspekDaripadaKategori(r.kategori);
  if (aspek) return { aspek, padan: samaUnit(unit, unitMurid(aspek)) };
  aspek = SEMUA_ASPEK.find(a => samaUnit(unit, unitMurid(a))) || '';   // tiada kategori: cari aspek yang unitnya sama
  if (aspek) return { aspek, padan: true };
  return { aspek: tekaAspekPertandingan(r.pertandingan, murid), padan: false };
}

function bacaPencapaianKokoSemua() {
  const ts = masaKemaskiniKoko();
  const kunci = 'kokopencapaian2_' + ts;
  if (ts) { const teks = cacheGetBesar(kunci); if (teks) return JSON.parse(teks); }
  // getDataRange: semua lajur dibaca (A hingga lajur terakhir, termasuk Q UNIT_PAJSK dan R STATUS_UNIT_PAJSK);
  // lajur dicari ikut nama header, bukan kedudukan.
  const data = bacaSheetKoko(bukaKoko(), KOKO_SHEET_PENCAPAIAN);
  const hasil = [];
  if (data) {
    const h = data.header;
    const iId = cariLajur(h, 'ID'), iTarikh = cariLajur(h, 'TARIKH'), iKp = cariLajur(h, /^NO\.? ?_?KP$/), iNama = cariLajur(h, /^NAMA/);
    const iPert = cariLajur(h, 'PERTANDINGAN'), iPering = cariLajur(h, 'PERINGKAT'), iCapai = cariLajur(h, 'PENCAPAIAN');
    const iKat = cariLajur(h, 'KATEGORI'), iUnit = cariLajur(h, 'UNIT');
    const iUnitPajsk = cariLajur(h, /^UNIT[ _]PAJSK$/), iStatus = cariLajur(h, /^STATUS[ _]UNIT[ _]PAJSK$/);
    const dilihat = {};
    const sel = (b, i) => i >= 0 ? banding(b[i]) : '';
    data.baris.forEach((b, n) => {
      const pertandingan = sel(b, iPert);
      if (!pertandingan) return;
      // ID (lajur A) = kunci unik setiap baris; baris dengan ID yang sama hanya diambil sekali.
      const id = iId >= 0 && String(b[iId]).trim() ? String(b[iId]).trim() : 'BARIS' + (n + 2);
      if (dilihat[id]) return;
      dilihat[id] = true;
      hasil.push({
        id, kp: iKp >= 0 ? normalKP(b[iKp]) : '', nama: sel(b, iNama),
        tahun: iTarikh >= 0 ? tahunDaripadaTarikh(b[iTarikh]) : null, tarikh: iTarikh >= 0 ? String(nilaiSelSebagaiTeks(b[iTarikh])) : '',
        pertandingan, peringkat: sel(b, iPering), pencapaian: sel(b, iCapai),
        kategori: sel(b, iKat), unit: sel(b, iUnit), unitPajsk: sel(b, iUnitPajsk), statusUnit: sel(b, iStatus)
      });
    });
  }
  if (ts) cachePutBesar(kunci, JSON.stringify(hasil), 60 * 60);
  return hasil;
}

function padanMuridPencapaian(r, murid) {
  return r.kp ? r.kp === normalKP(murid.NoKP) : (!!r.nama && r.nama === banding(murid.Nama));
}

/* Pencapaian e-Kokurikulum bagi seorang murid (padanan No. KP; jika No. KP kosong pada rekod,
   padanan nama penuh). Tapis ikut tahun pentaksiran. */
function bacaPencapaianKokoMurid(murid, tahun, ref) {
  const hasil = [];
  bacaPencapaianKokoSemua().forEach(r => {
    if (!padanMuridPencapaian(r, murid)) return;
    if (r.tahun !== null && r.tahun !== tahun) return;
    const t = tentukanAspekPencapaian(r, murid);
    hasil.push({
      id: r.id, tarikh: r.tarikh, pertandingan: r.pertandingan, peringkat: r.peringkat, pencapaian: r.pencapaian,
      kategori: r.kategori, unitRekod: r.unit, unitPelibatan: unitPelibatanKoko(r), statusUnit: r.statusUnit,
      cadanganLibat: labelPelibatan(r.peringkat, ref),
      cadanganCapai: labelPencapaian(r.peringkat, r.pencapaian, ref),
      aspekCadangan: t.aspek, padanUnit: t.padan
    });
  });
  return hasil;
}

/* Kumpul pencapaian tahun semasa ikut No. KP -> {kp: [rekod]} (untuk segerak automatik). */
function petaPencapaianKokoTahun(tahun) {
  const peta = {};
  bacaPencapaianKokoSemua().forEach(r => {
    if (r.tahun !== tahun) return;
    const k = r.kp || ('NAMA:' + r.nama);
    (peta[k] = peta[k] || []).push(r);
  });
  return peta;
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
