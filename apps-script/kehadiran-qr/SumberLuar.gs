/* =========================================================================
 * SumberLuar.gs — penyambung kepada sistem lain sekolah.
 *
 *  • e-Data & Enrolmen → senarai murid, profil & gambar murid
 *  • e-Teach-In        → jadual waktu (kelas diajar) & rekod guru ganti
 *  • IDME              → senarai sebab tidak hadir
 *
 * Setiap sumber dibaca terus dari spreadsheet sistem berkenaan (ID & nama
 * lajur ditetapkan dalam Sheet TETAPAN). Akaun yang men-deploy skrip ini
 * mesti ada akses LIHAT ke spreadsheet tersebut. Jika ID kosong, sistem guna
 * Sheet sandaran tempatan (MURID, JADUAL_WAKTU, TEACH_IN, SEBAB_TIDAK_HADIR).
 * Hasil disimpan dalam cache 10 minit supaya tidak membaca berulang kali.
 * ========================================================================= */

const MEDAN_EDATA = ['NoKP', 'Nama', 'Kelas', 'Tingkatan', 'Jantina', 'TarikhLahir', 'Alamat', 'NamaPenjaga', 'TelefonPenjaga', 'Gambar', 'Status'];
const MEDAN_JADUAL = ['Hari', 'Slot', 'Kelas', 'NoKPGuru', 'NamaGuru', 'Subjek'];
const MEDAN_GANTI = ['Tarikh', 'Slot', 'Kelas', 'NoKPGuruGanti', 'NamaGuruGanti', 'NoKPGuruAsal', 'NamaGuruAsal', 'Subjek'];
const MEDAN_IDME = ['Kod', 'Sebab', 'Kategori', 'DikiraPonteng'];
const TEMPOH_CACHE_LUAR_SAAT = 600;

function kunciHeader(h) { return String(h || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

/* Baca tab dari spreadsheet luar dan petakan lajurnya kepada medan piawai. */
function bacaLuarDipetakan(idSpreadsheet, namaTab, prefiksLajur, medan) {
  const ss = SpreadsheetApp.openById(idSpreadsheet);
  const sh = ss.getSheetByName(namaTab);
  if (!sh) throw new Error('Tab "' + namaTab + '" tidak dijumpai dalam spreadsheet sumber luar.');
  const nilai = sh.getDataRange().getValues();
  const header = (nilai.shift() || []).map(kunciHeader);
  const indeks = {};
  medan.forEach(m => {
    const namaLajur = tetapan(prefiksLajur + m.toUpperCase()) || m;
    indeks[m] = header.indexOf(kunciHeader(namaLajur));
  });
  return nilai.filter(b => b.some(s => s !== '' && s !== null)).map(b => {
    const o = {};
    medan.forEach(m => { o[m] = indeks[m] === -1 ? '' : nilaiSelSebagaiTeks(b[indeks[m]]); });
    return o;
  });
}

function bacaSumber(kunciCache, idTetapan, fnLuar, fnTempatan) {
  const memo = MEMO_LUAR[kunciCache];
  if (memo) return memo;
  const cache = bacaCacheBesar('luar_' + kunciCache);
  if (cache) { MEMO_LUAR[kunciCache] = cache; return cache; }
  const id = tetapan(idTetapan);
  const data = id ? fnLuar(id) : fnTempatan();
  simpanCacheBesar('luar_' + kunciCache, data, TEMPOH_CACHE_LUAR_SAAT);
  MEMO_LUAR[kunciCache] = data;
  return data;
}
const MEMO_LUAR = {};

function segarSemulaSumberLuar() {
  ['murid', 'jadual', 'ganti', 'sebab'].forEach(k => { padamCacheBesar('luar_' + k); delete MEMO_LUAR[k]; });
  delete MEMO_LUAR.muridSedia;
}

/* ------------------------------ MURID (e-Data) ------------------------------ */
function statusMuridAktif(status) {
  const s = String(status || '').toUpperCase();
  return !s || !/(BERHENTI|PINDAH|TIDAK AKTIF|TAMAT|KELUAR)/.test(s);
}

function senaraiMurid() {
  if (!MEMO_LUAR.muridSedia) MEMO_LUAR.muridSedia = senaraiMuridMentah();
  return MEMO_LUAR.muridSedia;
}
function senaraiMuridMentah() {
  return bacaSumber('murid', 'EDATA_SPREADSHEET_ID',
    id => bacaLuarDipetakan(id, tetapan('EDATA_TAB') || 'MURID', 'EDATA_LAJUR_', MEDAN_EDATA),
    () => bacaSheetSebagaiObjek(SHEET.MURID).map(r => {
      const o = {}; MEDAN_EDATA.forEach(m => { o[m] = r[m] === undefined ? '' : r[m]; }); return o;
    })
  ).filter(m => m.NoKP && statusMuridAktif(m.Status)).map(m => Object.assign({}, m, {
    NoKP: String(m.NoKP).trim(),
    Kelas: normalKelas(m.Kelas),
    Tingkatan: String(m.Tingkatan || '').trim(),
    GambarUrl: urlGambar(m.Gambar)
  }));
}

function cariMurid(nokp) { return senaraiMurid().find(m => samaNoKP(m.NoKP, nokp)) || null; }
function muridDalamKelas(kelas) {
  const k = normalKelas(kelas);
  return senaraiMurid().filter(m => m.Kelas === k).sort((a, b) => String(a.Nama).localeCompare(String(b.Nama)));
}

/* ------------------------------ JADUAL & TEACH-IN ------------------------------ */
function senaraiJadual() {
  return bacaSumber('jadual', 'TEACHIN_SPREADSHEET_ID',
    id => bacaLuarDipetakan(id, tetapan('TEACHIN_TAB_JADUAL') || 'JADUAL_WAKTU', 'TEACHIN_JADUAL_LAJUR_', MEDAN_JADUAL),
    () => bacaSheetSebagaiObjek(SHEET.JADUAL)
  ).map(j => ({
    Hari: String(j.Hari || '').toUpperCase().trim(), Slot: Number(j.Slot) || String(j.Slot || ''),
    Kelas: normalKelas(j.Kelas), NoKPGuru: String(j.NoKPGuru || ''), NamaGuru: String(j.NamaGuru || ''),
    Subjek: String(j.Subjek || '').toUpperCase()
  }));
}

function senaraiTeachIn() {
  return bacaSumber('ganti', 'TEACHIN_SPREADSHEET_ID',
    id => bacaLuarDipetakan(id, tetapan('TEACHIN_TAB_GANTI') || 'TEACH_IN', 'TEACHIN_GANTI_LAJUR_', MEDAN_GANTI),
    () => bacaSheetSebagaiObjek(SHEET.TEACHIN)
  ).map(t => ({
    Tarikh: keTarikh(t.Tarikh), Slot: Number(t.Slot) || String(t.Slot || ''), Kelas: normalKelas(t.Kelas),
    NoKPGuruGanti: String(t.NoKPGuruGanti || ''), NamaGuruGanti: String(t.NamaGuruGanti || ''),
    NoKPGuruAsal: String(t.NoKPGuruAsal || ''), NamaGuruAsal: String(t.NamaGuruAsal || ''),
    Subjek: String(t.Subjek || '').toUpperCase()
  }));
}

/* Padankan guru dengan rekod luar — melalui No. KP jika ada, jika tidak melalui nama. */
function rekodMilikGuru(nokpRekod, namaRekod, sesi) {
  if (digitSahaja(nokpRekod)) return samaNoKP(nokpRekod, sesi.nokp);
  return !!namaRekod && normalNama(namaRekod) === normalNama(sesi.nama);
}

function jadualGuru(sesi) { return senaraiJadual().filter(j => rekodMilikGuru(j.NoKPGuru, j.NamaGuru, sesi)); }
function teachInGuru(sesi) { return senaraiTeachIn().filter(t => rekodMilikGuru(t.NoKPGuruGanti, t.NamaGuruGanti, sesi)); }

/* ------------------------------ SEBAB TIDAK HADIR (IDME) ------------------------------ */
function senaraiSebab() {
  const kodPonteng = senaraiDaripadaMedan(tetapan('SEBAB_PONTENG_KOD')).map(k => k.toUpperCase());
  return bacaSumber('sebab', 'IDME_SPREADSHEET_ID',
    id => bacaLuarDipetakan(id, tetapan('IDME_TAB') || 'SEBAB_TIDAK_HADIR', 'IDME_LAJUR_', MEDAN_IDME),
    () => bacaSheetSebagaiObjek(SHEET.SEBAB)
  ).filter(s => s.Sebab || s.Kod).map(s => {
    const kod = String(s.Kod || s.Sebab).trim();
    const dikira = String(s.DikiraPonteng || '').toUpperCase();
    return {
      kod, sebab: String(s.Sebab || s.Kod).trim(), kategori: String(s.Kategori || '').trim(),
      dikiraPonteng: dikira ? dikira === 'YA' : kodPonteng.indexOf(kod.toUpperCase()) !== -1
    };
  });
}
function cariSebab(kod) {
  const s = senaraiSebab().find(x => String(x.kod) === String(kod));
  return s || { kod: String(kod || ''), sebab: String(kod || 'Tidak dinyatakan'), kategori: '', dikiraPonteng: true };
}

/* ------------------------------ KELAS ------------------------------ */
function senaraiKelas() {
  const tempatan = bacaSheetSebagaiObjek(SHEET.KELAS).map(k => ({
    kelas: normalKelas(k.Kelas), tingkatan: String(k.Tingkatan || ''), kodQR: String(k.KodQR || '').trim(), bilik: String(k.Bilik || '')
  })).filter(k => k.kelas);
  /* Kelas yang wujud di e-Data tetapi belum didaftar di Sheet KELAS tetap dipaparkan. */
  const ada = {}; tempatan.forEach(k => { ada[k.kelas] = true; });
  senaraiMurid().forEach(m => {
    if (m.Kelas && !ada[m.Kelas]) { ada[m.Kelas] = true; tempatan.push({ kelas: m.Kelas, tingkatan: m.Tingkatan, kodQR: '', bilik: '' }); }
  });
  return tempatan.sort((a, b) => (a.tingkatan + a.kelas).localeCompare(b.tingkatan + b.kelas));
}
