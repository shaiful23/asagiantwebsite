/* =========================================================================
 * LiveService.gs — Kemas kini "langsung" daripada e-Kokurikulum + permulaan pantas.
 *
 * Tiga lapisan (semua selamat dijalankan serentak):
 *  1. PENCETUS MASA (pilihan, disyorkan): segerakAutoBerjadual() setiap 1/5/10/15/30 minit — semak masa kemas
 *     kini fail e-Kokurikulum (panggilan Drive ringan); hanya jika berubah, segerak "delta" dijalankan.
 *  2. SEMAKAN OLEH PELAYAR: setiap kali ada pengguna membuka sistem, apiVersi() (dipanggil ~setiap 45 saat)
 *     menjalankan semakan yang sama jika sudah melepasi tempoh — jadi data kekal terkini walau tanpa pencetus.
 *  3. PELAYAR: apabila versi data berubah, skrin terbuka dimuat semula senyap-senyap (tanpa tekan butang).
 * Versi data = gabungan nombor versi cache bagi Sheet MURID/ASPEK/EKSTRA/RUMUSAN/PENGGUNA/TETAPAN.
 * ========================================================================= */

const TET_AUTO = 'AUTO_SEGERAK';
const TET_AUTO_MINIT = 'AUTO_SEGERAK_MINIT';
const TET_KOKO_TS = 'KOKO_TS_TERAKHIR';
const TET_AUTO_STATUS = 'SEGERAK_AUTO_STATUS';
const MINIT_AUTO_DIBENARKAN = [1, 5, 10, 15, 30];
const PENGENDALI_AUTO = 'segerakAutoBerjadual';

function versiData() {
  return [SHEET_MURID, SHEET_ASPEK, SHEET_EKSTRA, SHEET_RUMUSAN, SHEET_PENGGUNA, SHEET_TETAPAN].map(versiSheet).join('|');
}

function adaPencetusAuto() {
  try { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === PENGENDALI_AUTO); } catch (e) { return false; }
}

function maklumatAutoSegerak(t, tanpaPencetus) {
  t = t || bacaTetapan();
  return {
    aktif: String(t[TET_AUTO] || 'YA') === 'YA',
    minit: Number(t[TET_AUTO_MINIT]) || 5,
    pencetus: tanpaPencetus ? null : adaPencetusAuto(),
    status: t[TET_AUTO_STATUS] || '',
    kemaskiniTerakhir: t.SEGERAK_KOKO_TERAKHIR || ''
  };
}

/* Semak masa kemas kini e-Kokurikulum; jika berubah jalankan segerak delta (semua kelas).
   tryLock — jika sistem sedang sibuk menulis, langkau (akan disemak semula pada kitaran seterusnya). */
function semakDanSegerakAuto(sumber, paksa) {
  const kunci = LockService.getScriptLock();
  if (!kunci.tryLock(2000)) return { langkau: 'sibuk' };
  try {
    const ts = masaKemaskiniKoko();
    const lalu = Number(dapatTetapan(TET_KOKO_TS)) || 0;
    if (!paksa && ts && ts === lalu) return { langkau: 'tiada perubahan' };
    const lap = laksanakanSegerak(null, !!paksa);
    const masa = sekarangTeks();
    tulisTetapan(TET_KOKO_TS, String(lap.ts || ts || ''));
    if (lap.diubah) tulisTetapan('SEGERAK_KOKO_TERAKHIR', masa);
    tulisTetapan(TET_AUTO_STATUS, masa + ' (' + sumber + '): ' + lap.diubah + ' rekod dikemaskini');
    return { diubah: lap.diubah };
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    try { tulisTetapan(TET_AUTO_STATUS, sekarangTeks() + ' (' + sumber + ') RALAT: ' + e.message); } catch (x) { /* abaikan */ }
    return { ralat: e.message };
  } finally {
    kunci.releaseLock();
  }
}

/* Pengendali pencetus masa. */
function segerakAutoBerjadual() {
  if (String(dapatTetapan(TET_AUTO) || 'YA') !== 'YA') return;
  semakDanSegerakAuto('pencetus');
}

/* Dipanggil oleh apiVersi: lapisan 2. Dihadkan oleh cache supaya tidak lebih kerap daripada tempoh yang ditetapkan. */
function semakAutoJikaPerlu() {
  const t = bacaTetapan();
  if (String(t[TET_AUTO] || 'YA') !== 'YA') return;
  const minit = Number(t[TET_AUTO_MINIT]) || 5;
  const c = CacheService.getScriptCache();
  const terakhir = Number(c.get('semak_koko')) || 0;
  if (Date.now() - terakhir < minit * 60000) return;
  c.put('semak_koko', String(Date.now()), 6 * 60 * 60);
  semakDanSegerakAuto('pelayar');
}

function apiAutoSegerak(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const aktif = !!p.aktif;
  const minit = Number(p.minit) || 5;
  if (MINIT_AUTO_DIBENARKAN.indexOf(minit) === -1) return ralat('Selang mestilah salah satu daripada: ' + MINIT_AUTO_DIBENARKAN.join(', ') + ' minit.');
  try {
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === PENGENDALI_AUTO) ScriptApp.deleteTrigger(t); });
    if (aktif) ScriptApp.newTrigger(PENGENDALI_AUTO).timeBased().everyMinutes(minit).create();
  } catch (e) {
    return ralat('Gagal menetapkan pencetus masa: ' + e.message + ' (pastikan kebenaran script.scriptapp diberikan — deploy semula versi baharu).');
  }
  denganKunci(() => { tulisTetapan(TET_AUTO, aktif ? 'YA' : 'TIDAK'); tulisTetapan(TET_AUTO_MINIT, String(minit)); });
  catatAudit(sesi, 'KEMASKINI', 'AUTO_SEGERAK', '', (aktif ? 'Aktif setiap ' + minit + ' minit' : 'Dimatikan'));
  return jaya({ autoSegerak: maklumatAutoSegerak() });
}

/* Menu Sheet: pasang pencetus dengan tetapan semasa. */
function pasangPencetusAutoMelaluiMenu() {
  const t = bacaTetapan();
  const minit = Number(t[TET_AUTO_MINIT]) || 5;
  ScriptApp.getProjectTriggers().forEach(x => { if (x.getHandlerFunction() === PENGENDALI_AUTO) ScriptApp.deleteTrigger(x); });
  ScriptApp.newTrigger(PENGENDALI_AUTO).timeBased().everyMinutes(minit).create();
  tulisTetapan(TET_AUTO, 'YA');
  SpreadsheetApp.getUi().alert('Auto-segerak dengan e-Kokurikulum diaktifkan setiap ' + minit + ' minit.');
}

/* ---- Webhook "ping" (pilihan): e-Kokurikulum boleh memanggil URL ini sebaik sahaja ia menyimpan kehadiran/data supaya
   e-PAJSK segerak SERTA-MERTA (tanpa menunggu kitaran semakan). Dilindungi kunci rahsia; dihadkan 1 kali / 20 saat. ---- */
function balasPing(par) {
  const kunciSah = dapatTetapan('KUNCI_PING');
  let hasil;
  if (!kunciSah || String(par.kunci || '') !== kunciSah) {
    hasil = { ok: false, mesej: 'Kunci tidak sah.' };
  } else {
    const c = CacheService.getScriptCache();
    if (Date.now() - (Number(c.get('ping_terakhir')) || 0) < 20000) {
      hasil = { ok: true, langkau: 'terlalu kerap' };
    } else {
      c.put('ping_terakhir', String(Date.now()), 60);
      hasil = Object.assign({ ok: true }, semakDanSegerakAuto('ping', true));
    }
  }
  return ContentService.createTextOutput(JSON.stringify(hasil)).setMimeType(ContentService.MimeType.JSON);
}

function apiKunciPing(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  let kunci = dapatTetapan('KUNCI_PING');
  if (p.jana || !kunci) {
    kunci = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').substring(0, 8);
    denganKunci(() => tulisTetapan('KUNCI_PING', kunci));
    catatAudit(sesi, 'KEMASKINI', 'AUTO_SEGERAK', '', 'Kunci webhook dijana semula');
  }
  let url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { /* tiada URL sebelum deploy */ }
  return jaya({ url: url ? url + '?aksi=ping&kunci=' + kunci : '', kunci });
}

/* Panggilan sangat ringan (hanya cache) — dipanggil berkala oleh pelayar. */
function apiVersi(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  semakAutoJikaPerlu();
  return jaya({ versi: versiData(), kemaskini: dapatTetapan('SEGERAK_KOKO_TERAKHIR') });
}

/* Senarai kelas (kunci + bilangan murid aktif) yang boleh diakses sesi. */
function senaraiKelasSesi(sesi) {
  const bil = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() !== 'AKTIF') return;
    bil[m.KunciKelas] = (bil[m.KunciKelas] || 0) + 1;
  });
  let kunci = Object.keys(bil).sort();
  if (sesi.peranan !== ROLE_ADMIN) kunci = kunci.filter(k => sesi.kelas.indexOf(k) !== -1);
  return kunci.map(k => ({ kunci: k, nama: paparKelas(k), bilMurid: bil[k] }));
}

/* SATU panggilan permulaan (menggantikan 3-4 panggilan berasingan): pengguna, rujukan skor, tetapan, kelas. */
function apiMula(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const pengguna = bacaSheetSebagaiObjek(SHEET_PENGGUNA).find(u => normalKP(u.NoKP) === sesi.nokp);
  const mesti = String(pengguna.MestiTukarPassword).toUpperCase() === 'YA';
  if (mesti) return jaya({ nama: sesi.nama, peranan: sesi.peranan, kelas: sesi.kelas, mestiTukarPassword: true });
  const t = bacaTetapan();
  return jaya({
    nama: sesi.nama, peranan: sesi.peranan, kelas: sesi.kelas, mestiTukarPassword: false,
    rujukan: muatRujukan(),
    tetapan: {
      tahun: Number(t[TET_TAHUN]) || new Date().getFullYear(), kodSekolah: t[TET_KOD_SEKOLAH] || '', namaSekolah: t[TET_NAMA_SEKOLAH] || '',
      idKoko: sesi.peranan === ROLE_ADMIN ? (t[TET_ID_KOKO] || '') : '',
      autoSegerak: maklumatAutoSegerak(t, true)
    },
    kelasSenarai: senaraiKelasSesi(sesi),
    versi: versiData()
  });
}
