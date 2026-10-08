/* =========================================================================
 * MuetService.gs — MUET (800): rekod markah 4 komponen (800/1 Mendengar,
 * 800/2 Bertutur, 800/3 Membaca, 800/4 Menulis; 90 markah setiap satu,
 * jumlah 360) bagi Trial 1, Trial 2 dan Keputusan Sebenar, ETR (band
 * sasaran), GPMP kelas, GPS sekolah dan trend tahunan.
 *
 * Berbeza daripada headcount subjek STPM lain (gred A–F ikut BLD per
 * semester), jadi disimpan dalam Sheet MUET berasingan. Jumlah & band TIDAK
 * disimpan — dikira semula setiap kali dibaca daripada Sheet MUET_BAND, supaya
 * pindaan julat band terus berkuat kuasa pada semua rekod (MODUL 43).
 * Senarai calon = SEMUA pelajar AKTIF dalam kelas bagi Tahun STPM itu
 * (semua calon STPM menduduki MUET) — tiada pendaftaran subjek berasingan.
 * ========================================================================= */

const KOMPONEN_MUET = ['L', 'S', 'R', 'W'];
const SUMBER_MUET = ['T1', 'T2', 'A']; // Trial 1, Trial 2, Keputusan Sebenar (Actual)
const MARKAH_MAKS_KOMPONEN_MUET = 90;
const NILAI_BAND_RENDAH_MUET = 2.5;   // senarai "Band rendah": nilai band <= ini
const NILAI_BAND_TINGGI_MUET = 4.5;   // senarai "Band tinggi": nilai band >= ini

const HEADER_MUET = ['ID_Pelajar', 'TahunSTPM', 'ETR_Band',
  'T1_L', 'T1_S', 'T1_R', 'T1_W', 'T2_L', 'T2_S', 'T2_R', 'T2_W', 'A_L', 'A_S', 'A_R', 'A_W',
  'TidakHadir', 'KemaskiniOleh', 'KemaskiniPada'];
const HEADER_MUET_BAND = ['Band', 'MarkahMin', 'MarkahMax', 'NilaiBand'];
const HEADER_MUET_GPS = ['Tahun', 'GPS', 'Catatan'];

/* Sheets menukar "3.0" kepada nombor 3 secara senyap (sama seperti isu KodSubjek
   sebelum ini), jadi label band sentiasa dinormalkan: 3 -> "3.0", "5 +" -> "5+". */
function normalBandMUET(v) {
  const s = String(v === undefined || v === null ? '' : v).replace(/\s/g, '');
  if (!s) return '';
  if (s.indexOf('+') !== -1) return s;
  const n = Number(s);
  return isNaN(n) ? s : n.toFixed(1);
}

function dapatkanBandMUET() {
  return bacaSheetSebagaiObjek(SHEET_MUET_BAND)
    .map(b => ({ band: normalBandMUET(b.Band), min: Number(b.MarkahMin), max: Number(b.MarkahMax), nilai: Number(b.NilaiBand) }))
    .filter(b => b.band && !isNaN(b.min) && !isNaN(b.max) && !isNaN(b.nilai))
    .sort((a, b) => b.min - a.min);
}

/* Jumlah 4 komponen bagi satu sumber (T1/T2/A); null jika TIADA komponen diisi.
   Komponen kosong dikira 0 jika komponen lain sudah diisi (selaras kerangka asal). */
function jumlahMuet(rekod, sumber) {
  const isi = KOMPONEN_MUET.map(k => rekod[sumber + '_' + k]).filter(v => v !== '' && v !== null && v !== undefined);
  return isi.length ? isi.reduce((a, v) => a + Number(v), 0) : null;
}

function bandMuet(bands, jumlah) {
  if (jumlah === null) return null;
  return bands.find(b => jumlah >= b.min && jumlah <= b.max) || null;
}

function bolehAksesMuet(sesi) {
  return PERANAN_AKSES_PENUH.includes(sesi.peranan) || sesi.skopSubjek.indexOf(KOD_SUBJEK_MUET) !== -1;
}

/* Kelas yang boleh DIISI oleh pengguna ini: null = semua kelas; guru dengan
   tugasan MUET (Tab "Tugas Saya") dihadkan kepada kelas tugasannya sahaja. */
function kelasMuetDibenarkan(sesi, tahunSTPM) {
  if (PERANAN_AKSES_PENUH.includes(sesi.peranan)) return null;
  return kelasTugasanGuru(sesi.nokp, KOD_SUBJEK_MUET, tahunSTPM);
}

function pelajarMuet(tahunSTPM) {
  return bacaSheetSebagaiObjek(SHEET_STUDENTS).filter(s =>
    String(s.TahunSTPM) === String(tahunSTPM) && String(s.Status).toUpperCase() === 'AKTIF');
}

function petaRekodMuet(tahunSTPM) {
  const peta = {};
  bacaSheetSebagaiObjek(SHEET_MUET)
    .filter(r => String(r.TahunSTPM) === String(tahunSTPM))
    .forEach(r => { peta[String(r.ID_Pelajar)] = r; });
  return peta;
}

function bundar2(n) { return Number(n.toFixed(2)); }

/* Analisis sekumpulan calon bagi satu sumber. TH (Tidak Hadir) hanya dikecualikan
   bagi Keputusan Sebenar; calon tanpa markah dikira "belum" (tidak masuk GPMP). */
function analisisMuetKumpulan(senarai, bands, sumber) {
  const nilaiEtr = {};
  bands.forEach(b => { nilaiEtr[b.band] = b.nilai; });
  const taburan = {};
  bands.forEach(b => { taburan[b.band] = 0; });
  let jumlahNilai = 0, bilKeputusan = 0, capai = 0, tidakCapai = 0, belum = 0, tidakHadir = 0;
  const rendah = [], tinggi = [];

  senarai.forEach(({ pelajar, rekod }) => {
    if (sumber === 'A' && rekod.TidakHadir === 'YA') { tidakHadir++; return; }
    const jumlah = jumlahMuet(rekod, sumber);
    const b = bandMuet(bands, jumlah);
    if (!b) { belum++; return; }
    taburan[b.band]++;
    jumlahNilai += b.nilai;
    bilKeputusan++;
    const etr = nilaiEtr[normalBandMUET(rekod.ETR_Band)];
    if (etr !== undefined) { if (b.nilai >= etr) capai++; else tidakCapai++; }
    const ringkas = { nama: pelajar.Nama, kelas: pelajar.Kelas, band: b.band, jumlah };
    if (b.nilai <= NILAI_BAND_RENDAH_MUET) rendah.push(ringkas);
    if (b.nilai >= NILAI_BAND_TINGGI_MUET) tinggi.push(ringkas);
  });

  return {
    jumlahPelajar: senarai.length, bilKeputusan, belum, tidakHadir, taburan, capai, tidakCapai,
    gpmp: bilKeputusan ? bundar2(jumlahNilai / bilKeputusan) : null,
    rendah, tinggi
  };
}

/* ----------------------------- API ----------------------------- */

function apiMuetKelas(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!tahunSTPM) return ralat('Sila pilih Tahun STPM dahulu.');

  const dibenarkan = kelasMuetDibenarkan(sesi, tahunSTPM);
  const kiraan = {};
  pelajarMuet(tahunSTPM).forEach(s => { const k = String(s.Kelas); kiraan[k] = (kiraan[k] || 0) + 1; });
  const senarai = Object.keys(kiraan).filter(k => !dibenarkan || dibenarkan.indexOf(k.toUpperCase()) !== -1)
    .sort().map(k => ({ kelas: k, jumlah: kiraan[k] }));
  return jaya({ senarai });
}

function apiMuetRoster(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const kelas = String(p.kelas || '').trim();
  if (!tahunSTPM || !kelas) return ralat('Tahun STPM dan Kelas wajib dipilih.');
  const dibenarkan = kelasMuetDibenarkan(sesi, tahunSTPM);
  if (dibenarkan && dibenarkan.indexOf(kelas.toUpperCase()) === -1) return ralat('Kelas ini bukan dalam tugasan MUET anda.');

  const bands = dapatkanBandMUET();
  const petaRekod = petaRekodMuet(tahunSTPM);
  const kumpulan = pelajarMuet(tahunSTPM)
    .filter(s => String(s.Kelas).toUpperCase() === kelas.toUpperCase())
    .sort((a, b) => String(a.Nama).localeCompare(String(b.Nama)))
    .map(s => ({ pelajar: s, rekod: petaRekod[String(s.ID_Pelajar)] || {} }));

  const senarai = kumpulan.map(({ pelajar, rekod }) => {
    const baris = { ID_Pelajar: pelajar.ID_Pelajar, Nama: pelajar.Nama, ETR_Band: normalBandMUET(rekod.ETR_Band), TidakHadir: rekod.TidakHadir === 'YA' };
    SUMBER_MUET.forEach(sm => KOMPONEN_MUET.forEach(k => {
      const v = rekod[sm + '_' + k];
      baris[sm + '_' + k] = (v === undefined || v === null) ? '' : v;
    }));
    return baris;
  });

  const a = analisisMuetKumpulan(kumpulan, bands, 'A');
  return jaya({
    bands, senarai,
    ringkasan: { jumlah: kumpulan.length, hadir: kumpulan.length - a.tidakHadir, tidakHadir: a.tidakHadir, gpmp: a.gpmp }
  });
}

/* Simpan SEMUA calon satu kelas dalam SATU panggilan (corak sama seperti Isi ETR /
   Markah Ujian). Baris yang gagal disahkan dilangkau, disenaraikan dalam `ralat`. */
function apiMuetSimpanPukal(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const kelas = String(p.kelas || '').trim();
  const senarai = Array.isArray(p.senarai) ? p.senarai : [];
  if (!tahunSTPM || !kelas) return ralat('Tahun STPM dan Kelas wajib dipilih.');
  if (!senarai.length) return ralat('Tiada data untuk disimpan.');
  const dibenarkan = kelasMuetDibenarkan(sesi, tahunSTPM);
  if (dibenarkan && dibenarkan.indexOf(kelas.toUpperCase()) === -1) return ralat('Kelas ini bukan dalam tugasan MUET anda.');

  const pelajarKelas = {};
  pelajarMuet(tahunSTPM).filter(s => String(s.Kelas).toUpperCase() === kelas.toUpperCase())
    .forEach(s => { pelajarKelas[String(s.ID_Pelajar)] = s; });
  const bandSah = new Set(dapatkanBandMUET().map(b => b.band));
  const petaRekod = petaRekodMuet(tahunSTPM);
  const masa = formatTarikhMasa(new Date());
  const ralatSenarai = [];
  let disimpan = 0;

  senarai.forEach(item => {
    const id = String(item.idPelajar || '').trim();
    const pelajar = pelajarKelas[id];
    if (!pelajar) { ralatSenarai.push(id + ': bukan pelajar aktif kelas ini'); return; }
    const label = pelajar.Nama || id;

    const etr = normalBandMUET(item.ETR_Band);
    if (etr && !bandSah.has(etr)) { ralatSenarai.push(label + ': ETR "' + etr + '" bukan band sah'); return; }

    const sediaAda = petaRekod[id];
    const objek = sediaAda ? Object.assign({}, sediaAda) : { ID_Pelajar: id, TahunSTPM: tahunSTPM };
    objek.ETR_Band = etr;
    let gagal = '';
    SUMBER_MUET.forEach(sm => KOMPONEN_MUET.forEach(k => {
      const medan = sm + '_' + k;
      if (gagal || item[medan] === undefined) return;
      const mentah = String(item[medan]).trim();
      if (mentah === '') { objek[medan] = ''; return; }
      const n = Number(mentah);
      if (!Number.isInteger(n) || n < 0 || n > MARKAH_MAKS_KOMPONEN_MUET) { gagal = medan + ' mesti nombor bulat 0-' + MARKAH_MAKS_KOMPONEN_MUET; return; }
      objek[medan] = n;
    }));
    if (gagal) { ralatSenarai.push(label + ': ' + gagal); return; }
    objek.TidakHadir = item.TidakHadir ? 'YA' : '';
    objek.KemaskiniOleh = sesi.nama;
    objek.KemaskiniPada = masa;

    if (sediaAda) kemaskiniBaris(SHEET_MUET, sediaAda.__row, objek, HEADER_MUET);
    else tambahBaris(SHEET_MUET, objek, HEADER_MUET);
    disimpan++;
  });

  catatAudit(sesi, 'PUKAL', 'MUET', kelas + ' ' + tahunSTPM, '', disimpan + ' rekod',
    'Simpan pukal markah MUET (' + disimpan + ' calon, ' + ralatSenarai.length + ' ralat)');
  return jaya({ disimpan, ralat: ralatSenarai });
}

/* Analisis GPMP & ETR bagi SEMUA kelas satu Tahun STPM (paparan sahaja — guru MUET
   boleh lihat semua kelas walaupun hanya boleh mengisi kelas tugasan sendiri). */
function apiMuetAnalisis(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const sumber = SUMBER_MUET.indexOf(p.sumber) !== -1 ? p.sumber : 'A';
  if (!tahunSTPM) return ralat('Sila pilih Tahun STPM dahulu.');

  const bands = dapatkanBandMUET();
  const petaRekod = petaRekodMuet(tahunSTPM);
  const semua = pelajarMuet(tahunSTPM).map(s => ({ pelajar: s, rekod: petaRekod[String(s.ID_Pelajar)] || {} }));
  const ikutKelas = {};
  semua.forEach(x => { const k = String(x.pelajar.Kelas); (ikutKelas[k] = ikutKelas[k] || []).push(x); });

  const kelas = Object.keys(ikutKelas).sort().map(k => {
    const a = analisisMuetKumpulan(ikutKelas[k], bands, sumber);
    return { kelas: k, jumlahPelajar: a.jumlahPelajar, bilKeputusan: a.bilKeputusan, belum: a.belum, tidakHadir: a.tidakHadir,
      gpmp: a.gpmp, taburan: a.taburan, capai: a.capai, tidakCapai: a.tidakCapai };
  });
  const sekolah = analisisMuetKumpulan(semua, bands, sumber);
  const ikutNama = (x, y) => String(x.kelas).localeCompare(String(y.kelas)) || String(x.nama).localeCompare(String(y.nama));

  return jaya({
    sumber, bands: bands.map(b => b.band).reverse(), kelas,
    sekolah: { gps: sekolah.gpmp, bilKeputusan: sekolah.bilKeputusan, jumlahPelajar: sekolah.jumlahPelajar,
      belum: sekolah.belum, tidakHadir: sekolah.tidakHadir, capai: sekolah.capai, tidakCapai: sekolah.tidakCapai },
    rendah: sekolah.rendah.sort(ikutNama), tinggi: sekolah.tinggi.sort(ikutNama),
    ambangRendah: NILAI_BAND_RENDAH_MUET, ambangTinggi: NILAI_BAND_TINGGI_MUET
  });
}

/* Trend GPS tahunan: tahun yang ada rekod dalam sistem dikira terus daripada
   Keputusan Sebenar; tahun sebelum sistem digunakan diambil daripada Sheet
   MUET_GPS_SEJARAH (diisi Admin). Data sistem mengatasi data manual. */
function apiMuetTrend(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');

  const peta = {};
  bacaSheetSebagaiObjek(SHEET_MUET_GPS).forEach(r => {
    const tahun = String(r.Tahun).trim();
    const gps = Number(r.GPS);
    if (tahun && r.GPS !== '' && !isNaN(gps)) peta[tahun] = { tahun, gps: bundar2(gps), status: 'SELESAI', sumber: 'MANUAL', catatan: r.Catatan || '' };
  });

  const bands = dapatkanBandMUET();
  const rekodIkutTahun = {};
  bacaSheetSebagaiObjek(SHEET_MUET).forEach(r => { (rekodIkutTahun[String(r.TahunSTPM)] = rekodIkutTahun[String(r.TahunSTPM)] || {})[String(r.ID_Pelajar)] = r; });
  const pelajarIkutTahun = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => {
    const t = String(s.TahunSTPM);
    // Calon kohort yang sudah diarkib (TAMAT) tetap dikira dalam GPS tahun mereka.
    if (['AKTIF', 'TAMAT'].indexOf(String(s.Status).toUpperCase()) !== -1) (pelajarIkutTahun[t] = pelajarIkutTahun[t] || []).push(s);
  });

  Object.keys(rekodIkutTahun).forEach(tahun => {
    const senarai = (pelajarIkutTahun[tahun] || []).map(s => ({ pelajar: s, rekod: rekodIkutTahun[tahun][String(s.ID_Pelajar)] || {} }));
    const a = analisisMuetKumpulan(senarai, bands, 'A');
    if (!a.bilKeputusan && peta[tahun]) return; // tiada keputusan sebenar dalam sistem lagi — kekalkan nilai manual
    peta[tahun] = { tahun, gps: a.gpmp, status: a.belum === 0 && a.bilKeputusan > 0 ? 'SELESAI' : 'BELUM_LENGKAP', sumber: 'SISTEM',
      catatan: a.bilKeputusan + ' calon ada keputusan' + (a.belum ? ', ' + a.belum + ' belum diisi' : '') + (a.tidakHadir ? ', ' + a.tidakHadir + ' TH' : '') };
  });

  const senarai = Object.keys(peta).sort().map(t => peta[t]);
  let sebelum = null;
  senarai.forEach(r => {
    r.perubahan = (r.gps !== null && sebelum !== null) ? bundar2(r.gps - sebelum) : null;
    if (r.gps !== null) sebelum = r.gps;
  });
  const lengkap = senarai.filter(r => r.status === 'SELESAI' && r.gps !== null);
  const tertinggi = lengkap.reduce((m, r) => (!m || r.gps > m.gps ? r : m), null);
  const terendah = lengkap.reduce((m, r) => (!m || r.gps < m.gps ? r : m), null);
  const purata = lengkap.length ? bundar2(lengkap.reduce((j, r) => j + r.gps, 0) / lengkap.length) : null;

  return jaya({ senarai, tertinggi, terendah, purata, bilTahunLengkap: lengkap.length });
}

function apiMuetSimpanGpsSejarah(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const tahun = String(p.tahun || '').trim();
  const gps = Number(p.gps);
  if (!/^\d{4}$/.test(tahun)) return ralat('Tahun mesti 4 digit (cth. 2023).');
  if (String(p.gps).trim() === '' || isNaN(gps) || gps < 1 || gps > 6) return ralat('GPS mesti nombor antara 1.00 dan 6.00.');

  const objek = { Tahun: tahun, GPS: bundar2(gps), Catatan: String(p.catatan || '').trim() };
  const sediaAda = bacaSheetSebagaiObjek(SHEET_MUET_GPS).find(r => String(r.Tahun).trim() === tahun);
  if (sediaAda) kemaskiniBaris(SHEET_MUET_GPS, sediaAda.__row, objek, HEADER_MUET_GPS);
  else tambahBaris(SHEET_MUET_GPS, objek, HEADER_MUET_GPS);
  catatAudit(sesi, sediaAda ? 'KEMASKINI' : 'TAMBAH', 'MUET_GPS', tahun, sediaAda ? String(sediaAda.GPS) : '', String(objek.GPS), 'GPS MUET sejarah ' + tahun);
  return jaya({});
}

function apiMuetPadamGpsSejarah(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const tahun = String(p.tahun || '').trim();
  const rekod = bacaSheetSebagaiObjek(SHEET_MUET_GPS).find(r => String(r.Tahun).trim() === tahun);
  if (!rekod) return ralat('Rekod GPS tahun ' + tahun + ' tidak dijumpai.');
  dapatkanSheet(SHEET_MUET_GPS).deleteRow(rekod.__row);
  catatAudit(sesi, 'PADAM', 'MUET_GPS', tahun, String(rekod.GPS), '', 'Padam GPS MUET sejarah ' + tahun);
  return jaya({});
}
