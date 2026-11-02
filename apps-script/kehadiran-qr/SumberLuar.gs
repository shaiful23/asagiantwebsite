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
 *
 * FORMAT SMK ASAJAYA dikesan secara automatik (tab Data_Murid / Pengguna /
 * Foto_Murid di e-Data, dan Jadual_Induk_Perdana / Jadual_Induk_T6 /
 * Rekod_TeachIn / Profil_Guru di e-Teach-In). Jika tab itu tiada, sistem
 * guna pemetaan lajur generik (TETAPAN *_LAJUR_*).
 * ========================================================================= */

const MEDAN_EDATA = ['NoKP', 'Nama', 'Kelas', 'Tingkatan', 'Jantina', 'TarikhLahir', 'Alamat', 'NamaPenjaga', 'TelefonPenjaga', 'Gambar', 'Status'];
const MEDAN_JADUAL = ['Hari', 'Slot', 'Kelas', 'NoKPGuru', 'NamaGuru', 'Subjek'];
const MEDAN_GANTI = ['Tarikh', 'Slot', 'Kelas', 'NoKPGuruGanti', 'NamaGuruGanti', 'NoKPGuruAsal', 'NamaGuruAsal', 'Subjek'];
const MEDAN_IDME = ['Kod', 'Sebab', 'Kategori', 'DikiraPonteng'];
const TEMPOH_CACHE_LUAR_SAAT = 600;

function kunciHeader(h) { return String(h || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

/* Terima ID spreadsheet ATAU URL penuh (https://docs.google.com/spreadsheets/d/<ID>/edit...). */
function idSpreadsheet(nilai) {
  const s = String(nilai || '').trim();
  if (!s) return '';
  const m = s.match(/\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/) || s.match(/^([-\w]{20,})$/);
  return m ? m[1] : s;
}

/* Baca tab dari spreadsheet luar dan petakan lajurnya kepada medan piawai. */
function bacaLuarDipetakan(idSs, namaTab, prefiksLajur, medan, namaSistem) {
  let ss;
  try { ss = SpreadsheetApp.openById(idSs); }
  catch (e) { throw new Error(namaSistem + ': spreadsheet tidak dapat dibuka (ID "' + idSs + '"). Semak ID/URL dalam Sheet TETAPAN dan pastikan akaun yang men-deploy skrip ada akses lihat.'); }
  const sh = ss.getSheetByName(namaTab);
  if (!sh) throw new Error(namaSistem + ': tab "' + namaTab + '" tidak dijumpai. Tab yang ada: ' + ss.getSheets().map(x => x.getName()).join(', ') + '.');
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
  const id = idSpreadsheet(tetapan(idTetapan));
  const data = id ? fnLuar(id) : fnTempatan();
  simpanCacheBesar('luar_' + kunciCache, data, TEMPOH_CACHE_LUAR_SAAT);
  MEMO_LUAR[kunciCache] = data;
  return data;
}
const MEMO_LUAR = {};

function segarSemulaSumberLuar() {
  ['murid', 'jadual', 'ganti', 'sebab', 'guruEdata', 'peranTeachin', 'cutiTingkatan', 'tetapanEdata'].forEach(k => { padamCacheBesar('luar_' + k); delete MEMO_LUAR[k]; });
  Object.keys(MEMO_LUAR).forEach(k => { delete MEMO_LUAR[k]; });
}

/* =========================================================================
 * UTILITI FORMAT SMK ASAJAYA
 * ========================================================================= */
const MEMO_SS_LUAR = {};
function bukaSSLuar(idTetapan, namaSistem) {
  const id = idSpreadsheet(tetapan(idTetapan));
  if (!id) return null;
  if (MEMO_SS_LUAR[id]) return MEMO_SS_LUAR[id];
  try { MEMO_SS_LUAR[id] = SpreadsheetApp.openById(id); }
  catch (e) { throw new Error(namaSistem + ': spreadsheet tidak dapat dibuka (ID "' + id + '"). Semak ID/URL dalam Sheet TETAPAN dan pastikan akaun yang men-deploy skrip ada akses lihat.'); }
  return MEMO_SS_LUAR[id];
}
/* Baca tab sebagai objek dengan kunci header dinormalkan (cth. "NO KP" → NOKP). null jika tab tiada. */
function bacaTabLuar(ss, namaTab) {
  const sh = ss && ss.getSheetByName(namaTab);
  if (!sh) return null;
  const nilai = sh.getDataRange().getValues();
  const header = (nilai.shift() || []).map(kunciHeader);
  return nilai.filter(b => b.some(x => x !== '' && x !== null)).map(b => {
    const o = {}; header.forEach((h, i) => { if (h) o[h] = nilaiSelSebagaiTeks(b[i]); }); return o;
  });
}
function formatSumber(idTetapan, kunciFormat, tabPengenal, namaSistem) {
  const f = String(tetapan(kunciFormat) || 'AUTO').toUpperCase();
  if (f === 'SMKA' || f === 'UMUM') return f;
  const ss = bukaSSLuar(idTetapan, namaSistem);
  return ss && ss.getSheetByName(tabPengenal) ? 'SMKA' : 'UMUM';
}
function formatEData() { return MEMO_LUAR.fmtE || (MEMO_LUAR.fmtE = formatSumber('EDATA_SPREADSHEET_ID', 'EDATA_FORMAT', 'Data_Murid', 'e-Data & Enrolmen')); }
function formatTeachIn() { return MEMO_LUAR.fmtT || (MEMO_LUAR.fmtT = formatSumber('TEACHIN_SPREADSHEET_ID', 'TEACHIN_FORMAT', 'Jadual_Induk_Perdana', 'e-Teach-In')); }

/* "TINGKATAN 1" → "1"; "PPKI" → "PPKI". */
function tingkatanRingkas(t) { return String(t || '').toUpperCase().replace(/^TINGKATAN\s*/, '').trim(); }
/* Nama kelas penuh yang unik: tingkatan + kelas, cth. "1 AKASIA", "PPKI PKKS ROTI 2". */
function kelasPenuh(tingkatan, kelas) {
  const t = tingkatanRingkas(tingkatan), k = normalKelas(kelas);
  if (!t || k.indexOf(t + ' ') === 0) return k;
  return normalKelas(t + ' ' + k);
}
/* Tarikh fleksibel: Date, yyyy-MM-dd, dd-MM-yyyy, dd/MM/yyyy → yyyy-MM-dd. */
function keTarikhFleksibel(n) {
  if (n instanceof Date) return formatTarikh(n);
  const s = String(n || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s.slice(0, 10);
}
/* "7:00 - 7:30" → {mula:"07:00", tamat:"07:30"} */
function huraiJulatMasa(teks) {
  const m = String(teks || '').match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  return m ? { mula: ('0' + m[1]).slice(-2) + ':' + m[2], tamat: ('0' + m[3]).slice(-2) + ':' + m[4] } : null;
}

/* Padanan nama longgar: BTE/BT → BINTI, BN → BIN, dan beza ejaan kecil (≤2 aksara)
   — cth. "MOHAMED" vs "MOHAMAD" antara e-Data dan e-Teach-In. */
function namaKanonik(n) {
  return normalNama(n).replace(/\(.*?\)/g, '').replace(/\b(BTE|BT)\b/g, 'BINTI').replace(/\bBN\b/g, 'BIN').replace(/\s+/g, ' ').trim();
}
function jarakEdit(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = []; for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let min = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < min) min = cur[j]; }
    if (min > 2) return 99; prev = cur;
  }
  return prev[b.length];
}
function namaSepadan(a, b) {
  const x = namaKanonik(a), y = namaKanonik(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 12 && jarakEdit(x, y) <= 2);
}

/* Peranan teks dari sistem lain → kod peranan e-Kehadiran. */
function petaPeranan(teks) {
  const hasil = [];
  String(teks || '').toUpperCase().split(/[+,;/&]/).map(x => x.trim().replace(/[_\s]+/g, ' ')).filter(Boolean).forEach(p => {
    let k = '';
    if (/^(SUPER ADMIN|ADMIN|PENTADBIR)$/.test(p)) k = 'ADMIN';
    else if (/^(PENGETUA|PK|PENOLONG KANAN.*|GPK.*)$/.test(p)) k = 'ADMIN';
    else if (/^(PENOLONG GURU TINGKATAN|PENOLONG GT|PGT)$/.test(p)) k = 'PGT';
    else if (/^(GURU TINGKATAN|GT)$/.test(p)) k = 'GT';
    else if (/^(KAUNSELOR|GURU KAUNSELING|GBK|GURU BIMBINGAN.*)$/.test(p)) k = 'KAUNSELOR';
    else if (/^(GURU PRAKTIKAL|PRAKTIKAL)$/.test(p)) k = 'PRAKTIKAL';
    else if (/^(GURU MATA PELAJARAN|GMP|GURU)$/.test(p)) k = 'GMP';
    else if (PERANAN[p.replace(/\s/g, '')]) k = p.replace(/\s/g, '');
    if (k && hasil.indexOf(k) === -1) hasil.push(k);
  });
  return hasil;
}

/* =========================================================================
 * MURID (e-Data & Enrolmen)
 * ========================================================================= */
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
    id => formatEData() === 'SMKA' ? muridFormatSMKA() : bacaLuarDipetakan(id, tetapan('EDATA_TAB') || 'MURID', 'EDATA_LAJUR_', MEDAN_EDATA, 'e-Data & Enrolmen'),
    () => bacaSheetSebagaiObjek(SHEET.MURID).map(r => {
      const o = {}; MEDAN_EDATA.forEach(m => { o[m] = r[m] === undefined ? '' : r[m]; }); return o;
    })
  ).filter(m => m.NoKP && statusMuridAktif(m.Status)).map(m => Object.assign({}, m, {
    NoKP: String(m.NoKP).trim(),
    Kelas: normalKelas(m.Kelas),
    Tingkatan: tingkatanRingkas(m.Tingkatan),
    GambarUrl: urlGambar(m.Gambar)
  }));
}

/* e-Data SMK Asajaya: Data_Murid (KELAS tanpa tingkatan) + Foto_Murid (FILE ID). */
function muridFormatSMKA() {
  const ss = bukaSSLuar('EDATA_SPREADSHEET_ID', 'e-Data & Enrolmen');
  const data = bacaTabLuar(ss, 'Data_Murid') || [];
  const fail = {};
  (bacaTabLuar(ss, 'Foto_Murid') || []).forEach(f => { if (f.FILEID) fail[digitSahaja(f.NOKP)] = f.FILEID; });
  return data.map(r => ({
    NoKP: digitSahaja(r.NOKP) || String(r.NOKP || ''), Nama: r.NAMA, Kelas: kelasPenuh(r.TINGKATAN, r.KELAS), Tingkatan: tingkatanRingkas(r.TINGKATAN),
    Jantina: r.JANTINA, TarikhLahir: keTarikhFleksibel(r.TARIKHLAHIR), Alamat: r.ALAMAT || '', NamaPenjaga: r.NAMAPENJAGA || r.NAMAIBUBAPA || '',
    TelefonPenjaga: r.TELEFONPENJAGA || r.NOTELEFONPENJAGA || '', Gambar: fail[digitSahaja(r.NOKP)] || '', Status: r.STATUS,
    Kaum: r.KAUM || '', Agama: r.AGAMA || '', Asrama: String(r.STATUSASRAMA || '').toUpperCase() === 'YA' ? (r.NAMAASRAMA || 'YA') : '',
    Aliran: r.KETERANGANALIRAN || ''
  }));
}

/* Foto murid (THUMB base64 dari Foto_Murid) — dibaca sekali setiap pelaksanaan,
   tidak dicache (saiz besar). Dipaparkan terus tanpa perlu fail Drive dikongsi. */
function petaThumbMurid() {
  if (MEMO_LUAR.thumb) return MEMO_LUAR.thumb;
  const peta = {};
  try {
    if (tetapan('EDATA_SPREADSHEET_ID') && formatEData() === 'SMKA') {
      const sh = bukaSSLuar('EDATA_SPREADSHEET_ID', 'e-Data & Enrolmen').getSheetByName('Foto_Murid');
      if (sh && sh.getLastRow() > 1) {
        const v = sh.getRange(1, 1, sh.getLastRow(), Math.min(5, sh.getLastColumn())).getValues();
        const h = v.shift().map(kunciHeader), iK = h.indexOf('NOKP'), iT = h.indexOf('THUMB');
        if (iK >= 0 && iT >= 0) v.forEach(b => { if (String(b[iT]).indexOf('data:image') === 0) peta[digitSahaja(b[iK])] = String(b[iT]); });
      }
    }
  } catch (e) { /* foto pilihan sahaja */ }
  MEMO_LUAR.thumb = peta;
  return peta;
}
function denganFoto(m) {
  const t = petaThumbMurid()[digitSahaja(m.NoKP)];
  return t ? Object.assign({}, m, { GambarUrl: t }) : m;
}

function cariMurid(nokp) { const m = senaraiMurid().find(x => samaNoKP(x.NoKP, nokp)); return m ? denganFoto(m) : null; }
function muridDalamKelas(kelas) {
  const k = normalKelas(kelas);
  return senaraiMurid().filter(m => m.Kelas === k).sort((a, b) => String(a.Nama).localeCompare(String(b.Nama))).map(denganFoto);
}

/* =========================================================================
 * GURU — gabungan e-Data (Pengguna), e-Teach-In (Profil_Guru) & Sheet GURU
 * ========================================================================= */
function guruDariEData() {
  return bacaSumber('guruEdata', 'EDATA_SPREADSHEET_ID', () => {
    if (formatEData() !== 'SMKA') return [];
    return (bacaTabLuar(bukaSSLuar('EDATA_SPREADSHEET_ID', 'e-Data & Enrolmen'), 'Pengguna') || []).map(r => ({
      NoKP: digitSahaja(r.NOKP), Nama: String(r.NAMA || '').trim(), Peranan: petaPeranan(r.PERANAN).join(','),
      KelasTingkatan: r.KELAS ? kelasPenuh(r.TINGKATAN, r.KELAS) : '', Status: String(r.STATUS || 'AKTIF').toUpperCase()
    })).filter(g => g.NoKP);
  }, () => []);
}
function perananDariTeachIn() {
  return bacaSumber('peranTeachin', 'TEACHIN_SPREADSHEET_ID', () => {
    if (formatTeachIn() !== 'SMKA') return [];
    return (bacaTabLuar(bukaSSLuar('TEACHIN_SPREADSHEET_ID', 'e-Teach-In'), 'Profil_Guru') || [])
      .map(r => ({ Nama: String(r.NAMAGURU || '').trim(), NoKP: digitSahaja(r.NOKP), Peranan: petaPeranan(r.PERANANGURU).join(',') }))
      .filter(r => r.Nama);
  }, () => []);
}

/* Senarai guru bergabung. Sheet GURU tempatan boleh menambah guru (cth. guru
   mata pelajaran yang tiada di e-Data), menambah peranan, menukar kelas
   tingkatan, menyahaktifkan, atau menetapkan NamaDalamJadual (nama tepat di e-Teach-In). */
function senaraiGuru() {
  if (MEMO_LUAR.guruGabung) return MEMO_LUAR.guruGabung;
  const peta = {};
  const tambah = (g) => {
    const n = digitSahaja(g.NoKP); if (!n) return;
    const sedia = peta[n] || { NoKP: n, Nama: '', Peranan: [], KelasTingkatan: '', Status: 'AKTIF', NamaDalamJadual: '' };
    if (g.Nama) sedia.Nama = String(g.Nama).trim();
    senaraiDaripadaMedan(g.Peranan).forEach(p => { petaPeranan(p).forEach(k => { if (sedia.Peranan.indexOf(k) === -1) sedia.Peranan.push(k); }); });
    if (g.KelasTingkatan) sedia.KelasTingkatan = normalKelas(g.KelasTingkatan);
    if (g.Status) sedia.Status = String(g.Status).toUpperCase();
    if (g.NamaDalamJadual) sedia.NamaDalamJadual = String(g.NamaDalamJadual).trim();
    peta[n] = sedia;
  };
  try { guruDariEData().forEach(tambah); } catch (e) { /* e-Data tidak boleh dibaca — guna Sheet GURU */ }
  bacaSheetSebagaiObjek(SHEET.GURU).forEach(tambah);
  let peranTI = [];
  try { peranTI = perananDariTeachIn(); } catch (e) { /* abaikan */ }
  /* Guru dalam Profil_Guru e-Teach-In yang NO_KP-nya diisi → akaun guru automatik
     (guru mata pelajaran yang tiada dalam Pengguna e-Data). */
  peranTI.filter(r => r.NoKP).forEach(r => {
    const n = digitSahaja(r.NoKP);
    if (!peta[n]) tambah({ NoKP: n, Nama: r.Nama, Peranan: r.Peranan || 'GMP', NamaDalamJadual: r.Nama });
    else if (!peta[n].NamaDalamJadual) peta[n].NamaDalamJadual = r.Nama;
  });
  bacaSheetSebagaiObjek(SHEET.GURU).forEach(g => { if (g.Status) tambah({ NoKP: g.NoKP, Status: g.Status }); });
  const senarai = Object.keys(peta).map(k => peta[k]);
  senarai.forEach(g => { if (!g.Peranan.length) g.Peranan.push('GMP'); });
  peranTI.forEach(r => {
    const g = senarai.find(x => (r.NoKP && samaNoKP(x.NoKP, r.NoKP)) || namaSepadan(x.NamaDalamJadual || x.Nama, r.Nama));
    if (g) senaraiDaripadaMedan(r.Peranan).forEach(p => { if (g.Peranan.indexOf(p) === -1) g.Peranan.push(p); });
  });
  MEMO_LUAR.guruGabung = senarai;
  return senarai;
}

/* =========================================================================
 * JADUAL WAKTU & TEACH-IN (e-Teach-In)
 * Setiap entri jadual = satu BLOK P&P: waktu berturut dengan subjek & kelas
 * sama digabung (cth. 7:00–8:00). Kunci "Slot" = masa mula blok (HH:mm).
 * ========================================================================= */
function masaSlotTempatan(n) { return senaraiSlotTempatan().find(s => String(s.slot) === String(n)) || null; }
function senaraiSlotTempatan() {
  if (MEMO_LUAR.slotT) return MEMO_LUAR.slotT;
  MEMO_LUAR.slotT = bacaSheetSebagaiObjek(SHEET.SLOT).map(s => ({ slot: Number(s.Slot) || s.Slot, mula: keHHmm(s.MasaMula), tamat: keHHmm(s.MasaTamat) }))
    .sort((a, b) => a.mula.localeCompare(b.mula));
  return MEMO_LUAR.slotT;
}

/* Data mentah jadual (sebelum kod kelas dipetakan) + grid masa setiap sumber. */
function jadualMentah() {
  return bacaSumber('jadual', 'TEACHIN_SPREADSHEET_ID',
    id => formatTeachIn() === 'SMKA' ? jadualFormatSMKA() : { entri: bacaLuarDipetakan(id, tetapan('TEACHIN_TAB_JADUAL') || 'JADUAL_WAKTU', 'TEACHIN_JADUAL_LAJUR_', MEDAN_JADUAL, 'e-Teach-In (jadual)').map(jadualUmum), grid: {} },
    () => ({ entri: bacaSheetSebagaiObjek(SHEET.JADUAL).map(jadualUmum), grid: {} }));
}
function jadualUmum(j) {
  const m = masaSlotTempatan(j.Slot) || { mula: String(j.Slot || ''), tamat: '' };
  return { Hari: String(j.Hari || '').toUpperCase().trim(), Slot: m.mula, MasaMula: m.mula, MasaTamat: m.tamat, KodKelas: normalKelas(j.Kelas),
    NoKPGuru: digitSahaja(j.NoKPGuru), NamaGuru: String(j.NamaGuru || ''), Subjek: String(j.Subjek || '').toUpperCase(), Sumber: 'UMUM' };
}

/* Jadual grid SMK Asajaya: baris = guru × hari, lajur = julat masa, sel = "SUBJEK, KOD/KOD". */
function jadualFormatSMKA() {
  const ss = bukaSSLuar('TEACHIN_SPREADSHEET_ID', 'e-Teach-In');
  const entri = [], grid = {};
  [['Jadual_Induk_Perdana', 'PERDANA'], ['Jadual_Induk_T6', 'T6']].forEach(([tab, sumber]) => {
    const sh = ss.getSheetByName(tab); if (!sh) return;
    const v = sh.getDataRange().getDisplayValues();
    const header = v.shift() || [];
    const lajurMasa = [];
    header.forEach((h, i) => { const j = huraiJulatMasa(h); if (j) lajurMasa.push(Object.assign({ i }, j)); });
    grid[sumber] = lajurMasa.map(x => ({ mula: x.mula, tamat: x.tamat }));
    v.forEach(b => {
      const guru = String(b[0] || '').trim(), hari = String(b[1] || '').toUpperCase().trim();
      if (!guru || !hari) return;
      let blok = null;
      const tutup = () => { if (blok) { blok.kod.forEach(k => entri.push({ Hari: hari, Slot: blok.mula, MasaMula: blok.mula, MasaTamat: blok.tamat,
        KodKelas: k, NoKPGuru: '', NamaGuru: guru, Subjek: blok.subjek, Sumber: sumber })); blok = null; } };
      lajurMasa.forEach(c => {
        const sel = String(b[c.i] || '').trim();
        const m = sel.match(/^([^,]+),\s*(.+)$/);
        if (!m) { tutup(); return; }
        const subjek = m[1].trim().toUpperCase(), kod = m[2].split('/').map(x => normalKelas(x)).filter(Boolean);
        const kunci = subjek + '|' + kod.join('/');
        if (blok && blok.kunci === kunci && blok.tamat === c.mula) { blok.tamat = c.tamat; return; }
        tutup(); blok = { kunci, subjek, kod, mula: c.mula, tamat: c.tamat };
      });
      tutup();
    });
  });
  return { entri, grid };
}

/* ---------------- Pemetaan kod kelas e-Teach-In (cth. "2AR") → kelas e-Data ("2 AZARA") ----------------
   Dicuba secara automatik: kod = digit tingkatan + huruf pertama nama kelas + huruf
   pembeza. Pemetaan dibetulkan/ditambah oleh admin dalam Sheet PETA_KOD_KELAS. */
function petaKodKelas() {
  if (MEMO_LUAR.petaKod) return MEMO_LUAR.petaKod;
  const peta = {};
  const kelasWujud = {}; senaraiMurid().forEach(m => { kelasWujud[m.Kelas] = m.Tingkatan; });
  try { bacaSheetSebagaiObjek(SHEET.PETA_KOD).forEach(r => { if (r.Kod && r.Kelas) peta[normalKelas(r.Kod)] = normalKelas(r.Kelas); }); } catch (e) { /* belum disediakan */ }
  const kod = {};
  try { jadualMentah().entri.forEach(j => { kod[j.KodKelas] = true; }); } catch (e) { /* abaikan */ }
  try { teachInMentah().forEach(t => { if (t.KodKelas) kod[t.KodKelas] = true; }); } catch (e) { /* abaikan */ }
  const belum = Object.keys(kod).filter(k => !peta[k] && !kelasWujud[k]);
  /* Kumpul mengikut tingkatan, kemudian padanan optimum (kos = kedudukan huruf pembeza). */
  const ikutT = {};
  belum.forEach(k => { const m = k.match(/^(\d)([A-Z]{2,})$/); if (m) (ikutT[m[1]] = ikutT[m[1]] || []).push({ kod: k, akhiran: m[2] }); });
  Object.keys(ikutT).forEach(t => {
    const kelas = Object.keys(kelasWujud).filter(k => kelasWujud[k] === t && Object.keys(peta).map(x => peta[x]).indexOf(k) === -1);
    const nama = kelas.map(k => k.slice(t.length).trim());
    const kos = (akhiran, n) => {
      if (n[0] !== akhiran[0]) return 99;
      let pos = 0, jum = 0;
      for (let i = 1; i < akhiran.length; i++) { const p = n.indexOf(akhiran[i], pos + 1); if (p < 0) return 99; jum += p; pos = p; }
      return jum;
    };
    const senaraiKod = ikutT[t];
    let terbaik = null;
    const cari = (i, dipakai, jumlah, padan) => {
      if (terbaik && jumlah >= terbaik.jumlah) return;
      if (i === senaraiKod.length) { terbaik = { jumlah, padan: padan.slice() }; return; }
      let ada = false;
      nama.forEach((n, j) => {
        if (dipakai[j]) return; const c = kos(senaraiKod[i].akhiran, n); if (c >= 99) return;
        ada = true; dipakai[j] = true; padan.push(j); cari(i + 1, dipakai, jumlah + c, padan); padan.pop(); dipakai[j] = false;
      });
      if (!ada) { padan.push(-1); cari(i + 1, dipakai, jumlah + 50, padan); padan.pop(); }
    };
    if (senaraiKod.length <= 10 && nama.length <= 12) cari(0, {}, 0, []);
    if (terbaik) terbaik.padan.forEach((j, i) => { if (j >= 0) peta[senaraiKod[i].kod] = kelas[j]; });
  });
  MEMO_LUAR.petaKod = peta;
  MEMO_LUAR.kodTanpaPeta = Object.keys(kod).filter(k => !peta[k] && !kelasWujud[k]).sort();
  return peta;
}
function kelasDaripadaKod(kod) {
  const k = normalKelas(kod);
  if (!k) return '';
  const peta = petaKodKelas();
  return peta[k] || k;
}

function senaraiJadual() {
  if (MEMO_LUAR.jadualSedia) return MEMO_LUAR.jadualSedia;
  MEMO_LUAR.jadualSedia = jadualMentah().entri.map(j => Object.assign({}, j, { Kelas: kelasDaripadaKod(j.KodKelas) }));
  return MEMO_LUAR.jadualSedia;
}
function gridMasa(sumber) { return (jadualMentah().grid || {})[sumber] || null; }

function teachInMentah() {
  return bacaSumber('ganti', 'TEACHIN_SPREADSHEET_ID',
    id => formatTeachIn() === 'SMKA' ? teachInFormatSMKA() : bacaLuarDipetakan(id, tetapan('TEACHIN_TAB_GANTI') || 'TEACH_IN', 'TEACHIN_GANTI_LAJUR_', MEDAN_GANTI, 'e-Teach-In (guru ganti)').map(teachInUmum),
    () => bacaSheetSebagaiObjek(SHEET.TEACHIN).map(teachInUmum));
}
function teachInUmum(t) {
  const m = masaSlotTempatan(t.Slot) || { mula: String(t.Slot || ''), tamat: '' };
  return { Tarikh: keTarikhFleksibel(t.Tarikh), Slot: m.mula, MasaMula: m.mula, MasaTamat: m.tamat, KodKelas: normalKelas(t.Kelas),
    NoKPGuruGanti: digitSahaja(t.NoKPGuruGanti), NamaGuruGanti: String(t.NamaGuruGanti || ''), NoKPGuruAsal: digitSahaja(t.NoKPGuruAsal),
    NamaGuruAsal: String(t.NamaGuruAsal || ''), Subjek: String(t.Subjek || '').toUpperCase() };
}
/* Rekod_TeachIn SMK Asajaya: TARIKH, GURU TIADA DI SEKOLAH, GURU TEACH-IN, WAKTU,
   KELAS DITUGASKAN, STATUS, SUBJEK, INDEKS_SLOT. Rekod BATAL/TOLAK diabaikan. */
function teachInFormatSMKA() {
  const rekod = bacaTabLuar(bukaSSLuar('TEACHIN_SPREADSHEET_ID', 'e-Teach-In'), 'Rekod_TeachIn') || [];
  const grid = jadualMentah().grid || {};
  const hasil = [];
  rekod.forEach(r => {
    if (/(BATAL|TOLAK|DIBATAL)/i.test(String(r.STATUS || ''))) return;
    const kodSemua = String(r.KELASDITUGASKAN || '').split(/[\/,]/).map(x => normalKelas(x)).filter(Boolean);
    let masa = huraiJulatMasa(r.WAKTU);
    if (!masa && r.INDEKSSLOT !== '' && r.INDEKSSLOT !== undefined) {
      const g = grid[(kodSemua[0] || '').indexOf('T6') === 0 ? 'T6' : 'PERDANA'] || [];
      masa = g[Number(r.INDEKSSLOT)] || null;
    }
    kodSemua.forEach(k => hasil.push({ Tarikh: keTarikhFleksibel(r.TARIKH), Slot: masa ? masa.mula : '', MasaMula: masa ? masa.mula : '', MasaTamat: masa ? masa.tamat : '',
      KodKelas: k, NoKPGuruGanti: '', NamaGuruGanti: String(r.GURUTEACHIN || '').trim(), NoKPGuruAsal: '',
      NamaGuruAsal: String(r.GURUTIADADISEKOLAH || '').trim(), Subjek: String(r.SUBJEK || '').toUpperCase(), Tempat: r.TEMPAT || '' }));
  });
  return hasil;
}
function senaraiTeachIn() {
  if (MEMO_LUAR.gantiSedia) return MEMO_LUAR.gantiSedia;
  MEMO_LUAR.gantiSedia = teachInMentah().map(t => Object.assign({}, t, { Kelas: kelasDaripadaKod(t.KodKelas) }));
  return MEMO_LUAR.gantiSedia;
}

/* Giliran / tingkatan tidak hadir ke sekolah (cth. giliran peperiksaan SPM). */
function cutiTingkatan() {
  try {
    return bacaSumber('cutiTingkatan', 'TEACHIN_SPREADSHEET_ID', () => {
      if (formatTeachIn() !== 'SMKA') return [];
      return (bacaTabLuar(bukaSSLuar('TEACHIN_SPREADSHEET_ID', 'e-Teach-In'), 'Tingkatan_Tidak_Hadir') || []).map(r => ({
        mula: keTarikhFleksibel(r.TARIKHMULA), tamat: keTarikhFleksibel(r.TARIKHTAMAT || r.TARIKHMULA),
        tingkatan: String(r.TINGKATAN || '').split(/[,\s]+/).map(tingkatanRingkas).filter(Boolean), catatan: r.CATATAN || '' }));
    }, () => []);
  } catch (e) { return []; }
}
function tingkatanCutiPada(tarikh) {
  const o = {};
  cutiTingkatan().forEach(c => { if (tarikh >= c.mula && tarikh <= c.tamat) c.tingkatan.forEach(t => { o[t] = c.catatan || 'Tidak hadir ke sekolah'; }); });
  return o;
}

/* Tetapan sekolah dari e-Data (NAMA_SEKOLAH, ALAMAT_SEKOLAH, PENGETUA, KOD_SEKOLAH). */
function tetapanEData() {
  try {
    return bacaSumber('tetapanEdata', 'EDATA_SPREADSHEET_ID', () => {
      if (formatEData() !== 'SMKA') return {};
      const o = {}; (bacaTabLuar(bukaSSLuar('EDATA_SPREADSHEET_ID', 'e-Data & Enrolmen'), 'Tetapan') || []).forEach(r => { if (r.KUNCI) o[String(r.KUNCI).trim()] = r.NILAI; });
      return o;
    }, () => ({}));
  } catch (e) { return {}; }
}

/* Padankan guru dengan rekod luar — melalui No. KP jika ada, jika tidak melalui nama
   (nama dalam jadual boleh ditetapkan dalam lajur NamaDalamJadual Sheet GURU). */
function rekodMilikGuru(nokpRekod, namaRekod, sesi) {
  if (digitSahaja(nokpRekod)) return samaNoKP(nokpRekod, sesi.nokp);
  return !!namaRekod && (namaSepadan(namaRekod, sesi.namaJadual || sesi.nama) || (!!sesi.namaJadual && namaSepadan(namaRekod, sesi.nama)));
}
function jadualGuru(sesi) { return senaraiJadual().filter(j => rekodMilikGuru(j.NoKPGuru, j.NamaGuru, sesi)); }
function teachInGuru(sesi) { return senaraiTeachIn().filter(t => rekodMilikGuru(t.NoKPGuruGanti, t.NamaGuruGanti, sesi)); }

/* =========================================================================
 * SEBAB TIDAK HADIR (IDME)
 * ========================================================================= */
function senaraiSebab() {
  const kodPonteng = senaraiDaripadaMedan(tetapan('SEBAB_PONTENG_KOD')).map(k => k.toUpperCase());
  return bacaSumber('sebab', 'IDME_SPREADSHEET_ID',
    id => bacaLuarDipetakan(id, tetapan('IDME_TAB') || 'SEBAB_TIDAK_HADIR', 'IDME_LAJUR_', MEDAN_IDME, 'IDME'),
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

/* =========================================================================
 * KELAS — Sheet KELAS (pilihan: KodQR/Bilik) + semua kelas dalam e-Data.
 * KodQR lalai = kod e-Teach-In (cth. "2AR") jika ada, jika tidak nama tanpa ruang.
 * ========================================================================= */
function senaraiKelas() {
  if (MEMO_LUAR.kelasSedia) return MEMO_LUAR.kelasSedia;
  const kodUntuk = {}; Object.keys(petaKodKelas()).forEach(k => { const kl = petaKodKelas()[k]; if (!kodUntuk[kl] || k.length < kodUntuk[kl].length) kodUntuk[kl] = k; });
  const tempatan = bacaSheetSebagaiObjek(SHEET.KELAS).map(k => ({
    kelas: normalKelas(k.Kelas), tingkatan: tingkatanRingkas(k.Tingkatan), kodQR: String(k.KodQR || '').trim(), bilik: String(k.Bilik || '')
  })).filter(k => k.kelas);
  const ada = {}; tempatan.forEach(k => { ada[k.kelas] = true; });
  senaraiMurid().forEach(m => {
    if (m.Kelas && !ada[m.Kelas]) { ada[m.Kelas] = true; tempatan.push({ kelas: m.Kelas, tingkatan: m.Tingkatan, kodQR: '', bilik: '' }); }
  });
  tempatan.forEach(k => { if (!k.kodQR) k.kodQR = kodUntuk[k.kelas] || k.kelas.replace(/\s+/g, ''); });
  MEMO_LUAR.kelasSedia = tempatan.sort((a, b) => (a.tingkatan + ' ' + a.kelas).localeCompare(b.tingkatan + ' ' + b.kelas, undefined, { numeric: true }));
  return MEMO_LUAR.kelasSedia;
}
