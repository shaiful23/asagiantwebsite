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
 *
 * Kebenaran: semua guru MUET (SkopSubjek 800) boleh MELIHAT markah semua kelas,
 * tetapi hanya boleh MENGISI markah kelas yang ditetapkan kepada mereka (tab
 * "Penetapan Guru", disimpan dalam TEACHING_ASSIGNMENTS dengan KodSubjek 800).
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

/* Kelas yang boleh DIISI oleh pengguna ini: null = semua kelas (peranan akses penuh).
   Guru MUET hanya boleh mengisi kelas yang ditetapkan kepadanya — tiada penetapan
   bermakna senarai kosong (paparan sahaja), BUKAN semua kelas. */
function kelasMuetDibenarkan(sesi, tahunSTPM) {
  if (PERANAN_AKSES_PENUH.includes(sesi.peranan)) return null;
  return kelasTugasanGuru(sesi.nokp, KOD_SUBJEK_MUET, tahunSTPM) || [];
}

function bolehIsiKelasMuet(dibenarkan, kelas) {
  return !dibenarkan || dibenarkan.indexOf(String(kelas).toUpperCase()) !== -1;
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
  // Semua kelas dipulangkan (semua guru MUET boleh lihat); bolehIsi menandakan kelas sendiri.
  const senarai = Object.keys(kiraan).sort().map(k => ({ kelas: k, jumlah: kiraan[k], bolehIsi: bolehIsiKelasMuet(dibenarkan, k) }));
  return jaya({ senarai, aksesPenuh: !dibenarkan, kelasSaya: dibenarkan || [] });
}

function apiMuetRoster(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const kelas = String(p.kelas || '').trim();
  if (!tahunSTPM || !kelas) return ralat('Tahun STPM dan Kelas wajib dipilih.');
  const bolehIsi = bolehIsiKelasMuet(kelasMuetDibenarkan(sesi, tahunSTPM), kelas);

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
    bands, senarai, bolehIsi,
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
  if (!bolehIsiKelasMuet(kelasMuetDibenarkan(sesi, tahunSTPM), kelas)) {
    return ralat('Anda hanya boleh mengisi markah MUET bagi kelas yang ditetapkan kepada anda. Kelas ' + kelas + ' adalah paparan sahaja.');
  }

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

/* ------------------- Penetapan guru MUET (kelas yang diajar) -------------------
   Disimpan dalam TEACHING_ASSIGNMENTS (KodSubjek 800) supaya turut kelihatan di menu
   "Tugas Saya". Tidak melalui apiSimpanTugasan kerana MUET tiada dalam Sheet SUBJECTS. */

function guruMuet() {
  return bacaSheetSebagaiObjek(SHEET_USERS).filter(u => String(u.Status).toUpperCase() === 'AKTIF' &&
    String(u.SkopSubjek || '').split(',').map(x => x.trim()).indexOf(KOD_SUBJEK_MUET) !== -1);
}

function tugasanMuet(tahunSTPM) {
  return bacaSheetSebagaiObjek(SHEET_TEACHING_ASSIGNMENTS).filter(t =>
    String(t.KodSubjek) === KOD_SUBJEK_MUET && String(t.TahunSTPM) === String(tahunSTPM));
}

/* Nama kelas asal (ikut STUDENTS), dikunci huruf besar untuk padanan. */
function petaKelasMuet(tahunSTPM) {
  const peta = {};
  pelajarMuet(tahunSTPM).forEach(s => { peta[String(s.Kelas).toUpperCase()] = String(s.Kelas); });
  return peta;
}

function apiMuetPenetapanGuru(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!tahunSTPM) return ralat('Sila pilih Tahun STPM dahulu.');

  const petaKelas = petaKelasMuet(tahunSTPM);
  const tugasan = tugasanMuet(tahunSTPM).filter(t => String(t.StatusAktif).toUpperCase() === 'AKTIF');
  const guru = guruMuet().map(u => {
    const nokp = normalNoKP(u.NoKP);
    const kelas = Array.from(new Set(tugasan.filter(t => normalNoKP(t.NoKP) === nokp).map(t => String(t.Kelas).toUpperCase())));
    return { nokp, nama: u.NamaPenuh, peranan: u.Peranan, kelas };
  }).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));

  const ditetapkan = new Set();
  guru.forEach(g => g.kelas.forEach(k => ditetapkan.add(k)));
  const kelas = Object.keys(petaKelas).sort().map(k => ({ kunci: k, nama: petaKelas[k] }));
  return jaya({ guru, kelas, tanpaGuru: kelas.filter(k => !ditetapkan.has(k.kunci)).map(k => k.nama) });
}

/* Ganti SEMUA kelas MUET seorang guru bagi satu Tahun STPM dengan senarai baharu. */
function apiMuetSimpanPenetapanGuru(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const nokp = normalNoKP(p.nokp);
  const diminta = Array.isArray(p.kelas) ? p.kelas.map(k => String(k).trim().toUpperCase()).filter(Boolean) : [];
  if (!tahunSTPM) return ralat('Sila pilih Tahun STPM dahulu.');

  const guru = guruMuet().find(u => normalNoKP(u.NoKP) === nokp);
  if (!guru) return ralat('Guru ini tidak aktif atau tiada kod ' + KOD_SUBJEK_MUET + ' dalam Skop Subjek (menu Pengguna).');
  const petaKelas = petaKelasMuet(tahunSTPM);
  const tidakSah = diminta.filter(k => !petaKelas[k]);
  if (tidakSah.length) return ralat('Kelas tidak dijumpai bagi Tahun STPM ' + tahunSTPM + ': ' + tidakSah.join(', '));
  const baru = new Set(diminta);

  const sediaAda = tugasanMuet(tahunSTPM).filter(t => normalNoKP(t.NoKP) === nokp);
  const dikekal = {}; // kelas -> baris sedia ada yang dikekalkan (satu sahaja; pendua dipadam)
  // Kemas kini dahulu (nombor baris masih sah), kemudian padam dari bawah ke atas, kemudian tambah.
  sediaAda.forEach(t => {
    const k = String(t.Kelas).toUpperCase();
    if (!baru.has(k) || dikekal[k]) return;
    dikekal[k] = t;
    if (String(t.StatusAktif).toUpperCase() !== 'AKTIF') {
      kemaskiniBaris(SHEET_TEACHING_ASSIGNMENTS, t.__row, Object.assign({}, t, { StatusAktif: 'AKTIF' }), HEADER_TEACHING_ASSIGNMENTS);
    }
  });
  const dipadam = sediaAda.filter(t => dikekal[String(t.Kelas).toUpperCase()] !== t).sort((a, b) => b.__row - a.__row);
  if (dipadam.length) {
    const sh = dapatkanSheet(SHEET_TEACHING_ASSIGNMENTS);
    dipadam.forEach(t => sh.deleteRow(t.__row));
  }
  Array.from(baru).filter(k => !dikekal[k]).forEach(k => tambahBaris(SHEET_TEACHING_ASSIGNMENTS, {
    ID_Tugasan: janaId('TGS'), NoKP: nokp, KodSubjek: KOD_SUBJEK_MUET, Kelas: petaKelas[k], TahunSTPM: tahunSTPM, StatusAktif: 'AKTIF'
  }, HEADER_TEACHING_ASSIGNMENTS));

  const sebelum = sediaAda.map(t => t.Kelas).join(', ');
  const selepas = Array.from(baru).map(k => petaKelas[k]).join(', ');
  catatAudit(sesi, 'KEMASKINI', 'TUGASAN', nokp, sebelum, selepas,
    'Penetapan kelas MUET ' + guru.NamaPenuh + ' (' + tahunSTPM + '): ' + (selepas || 'tiada kelas'));
  return jaya({ kelas: Array.from(baru) });
}

/* ----------------------------- Slip keputusan MUET ----------------------------- */

/* Padanan band MUET (format 2021) dengan tahap CEFR — dipaparkan pada slip sahaja.
   Band yang tiada dalam senarai ini (jika MUET_BAND diubah) dipaparkan tanpa CEFR. */
const CEFR_BAND_MUET = {
  '5+': ['C1+', 'Proficient User'], '5.0': ['C1', 'Proficient User'],
  '4.5': ['B2', 'Independent User'], '4.0': ['B2', 'Independent User'],
  '3.5': ['B1', 'Independent User'], '3.0': ['B1', 'Independent User'],
  '2.5': ['A2', 'Basic User'], '2.0': ['A2', 'Basic User'], '1.0': ['A1', 'Basic User']
};
const KUNCI_TETAPAN_SLIP_MUET = ['namaPenuhSekolah', 'alamatSekolah', 'namaPengetua', 'namaPKT6'];

function tetapanSlipMuet() {
  const k = dapatkanKonfig();
  const ringkas = String(k.schoolName || 'SMK ASAJAYA').trim();
  return {
    namaPenuhSekolah: String(k.namaPenuhSekolah || '').trim() || ringkas.replace(/^SMK\s+/i, 'SEKOLAH MENENGAH KEBANGSAAN '),
    alamatSekolah: String(k.alamatSekolah || '').trim(),
    namaPengetua: String(k.namaPengetua || '').trim(),
    namaPKT6: String(k.namaPKT6 || '').trim()
  };
}

/* Kedudukan bersaing (1, 2, 2, 4): calon dengan jumlah sama berkongsi kedudukan. */
function petaKedudukan(senarai) {
  const peta = {};
  senarai.forEach(x => { peta[x.id] = 1 + senarai.filter(y => y.jumlah > x.jumlah).length; });
  return peta;
}

function apiMuetTetapanSlip(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');
  return jaya({ tetapan: tetapanSlipMuet() });
}

function apiMuetSimpanTetapanSlip(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const lama = tetapanSlipMuet();
  for (const kunci of KUNCI_TETAPAN_SLIP_MUET) {
    if (String(p[kunci] || '').trim().length > 200) return ralat('Teks terlalu panjang (maksimum 200 aksara).');
  }
  KUNCI_TETAPAN_SLIP_MUET.forEach(kunci => simpanNilaiKonfig(kunci, String(p[kunci] || '').trim()));
  catatAudit(sesi, 'KEMASKINI', 'CONFIG', 'SLIP_MUET', JSON.stringify(lama), JSON.stringify(tetapanSlipMuet()), 'Tetapan slip MUET');
  return jaya({ tetapan: tetapanSlipMuet() });
}

/* Data slip MUET bagi satu sumber (T1/T2/A) — satu kelas, atau seorang calon jika
   idPelajar diisi. Semua guru MUET boleh menjana slip bagi mana-mana kelas (paparan).
   Calon tanpa markah (atau TH bagi Keputusan Sebenar) dilangkau & disenaraikan. */
function apiMuetSlip(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehAksesMuet(sesi)) return ralat('Anda tiada kebenaran untuk MUET.');
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const kelas = String(p.kelas || '').trim();
  const sumber = String(p.sumber || '');
  const idPelajar = String(p.idPelajar || '').trim();
  if (!tahunSTPM || !kelas) return ralat('Tahun STPM dan Kelas wajib dipilih.');
  if (SUMBER_MUET.indexOf(sumber) === -1) return ralat('Sila pilih MUET Trial 1, Trial 2 atau Keputusan Sebenar.');

  const bands = dapatkanBandMUET();
  const petaRekod = petaRekodMuet(tahunSTPM);
  const sumberBanding = { T2: 'T1', A: 'T2' }[sumber] || null;
  const ada = []; // calon ada keputusan bagi sumber ini (seluruh tingkatan)
  const semua = pelajarMuet(tahunSTPM).map(s => {
    const rekod = petaRekod[String(s.ID_Pelajar)] || {};
    const th = sumber === 'A' && rekod.TidakHadir === 'YA';
    const jumlah = th ? null : jumlahMuet(rekod, sumber);
    const x = { pelajar: s, rekod, th, jumlah, id: String(s.ID_Pelajar) };
    if (jumlah !== null) ada.push(x);
    return x;
  });
  const dalamKelas = semua.filter(x => String(x.pelajar.Kelas).toUpperCase() === kelas.toUpperCase());
  const adaKelas = dalamKelas.filter(x => x.jumlah !== null);
  const rankTingkatan = petaKedudukan(ada);
  const rankKelas = petaKedudukan(adaKelas);
  const nilaiEtr = {};
  bands.forEach(b => { nilaiEtr[b.band] = b; });

  let dipilih = dalamKelas.sort((a, b) => String(a.pelajar.Nama).localeCompare(String(b.pelajar.Nama)));
  if (idPelajar) {
    dipilih = dipilih.filter(x => x.id === idPelajar);
    if (!dipilih.length) return ralat('Pelajar tidak dijumpai dalam kelas ' + kelas + '.');
  }

  const slip = [], dilangkau = [];
  dipilih.forEach(x => {
    if (x.th) { dilangkau.push(x.pelajar.Nama + ' (Tidak Hadir)'); return; }
    if (x.jumlah === null) { dilangkau.push(x.pelajar.Nama + ' (tiada markah)'); return; }
    const b = bandMuet(bands, x.jumlah);
    const etr = nilaiEtr[normalBandMUET(x.rekod.ETR_Band)] || null;
    const markah = {};
    KOMPONEN_MUET.forEach(k => { const v = x.rekod[sumber + '_' + k]; markah[k] = (v === '' || v === null || v === undefined) ? null : Number(v); });
    let banding = null;
    if (sumberBanding) {
      const j = jumlahMuet(x.rekod, sumberBanding);
      const bb = bandMuet(bands, j);
      if (j !== null) banding = { sumber: sumberBanding, jumlah: j, band: bb ? bb.band : null, beza: x.jumlah - j };
    }
    const cefr = b ? CEFR_BAND_MUET[b.band] : null;
    slip.push({
      idPelajar: x.id, nama: x.pelajar.Nama, nokp: x.pelajar.NoKP ? normalNoKP(x.pelajar.NoKP) : '', kelas: x.pelajar.Kelas,
      markah, jumlah: x.jumlah, band: b ? b.band : null, nilaiBand: b ? b.nilai : null,
      cefr: cefr ? cefr[0] : null, tahapCefr: cefr ? cefr[1] : null,
      etr: etr ? etr.band : null, capaiEtr: (etr && b) ? b.nilai >= etr.nilai : null,
      markahKeEtr: (etr && b && b.nilai < etr.nilai) ? etr.min - x.jumlah : null,
      kedudukanKelas: rankKelas[x.id], bilKelas: adaKelas.length,
      kedudukanTingkatan: rankTingkatan[x.id], bilTingkatan: ada.length,
      banding
    });
  });

  return jaya({
    sekolah: tetapanSlipMuet(), sumber, tahunSTPM, kelas, tarikhJana: formatTarikh(new Date()),
    bands: bands.map(b => b.band).reverse(), slip, dilangkau,
    calon: dalamKelas.map(x => ({ idPelajar: x.id, nama: x.pelajar.Nama, ada: x.jumlah !== null }))
  });
}
