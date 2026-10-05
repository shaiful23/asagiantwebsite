/* =========================================================================
 * PemantauanService.gs — Status pengisian pentaksiran oleh Guru Kelas.
 *
 * Status seorang murid:
 *   LENGKAP      — semua medan wajib (MEDAN_WAJIB_ASPEK, Config.gs) diisi bagi setiap aspek yang
 *                  murid sertai (ada unit) + CGPA tahun sebelum (Tingkatan 2 ke atas, jika diwajibkan).
 *   DALAM_PROSES — guru telah menyimpan sesuatu bagi murid ini tetapi masih ada medan wajib kosong.
 *   BELUM_MULA   — tiada apa-apa disimpan oleh guru lagi.
 * Status kelas/guru: LENGKAP jika semua murid lengkap; BELUM_MULA jika semua belum mula; selainnya DALAM_PROSES.
 * ========================================================================= */

const ST_LENGKAP = 'LENGKAP', ST_PROSES = 'DALAM_PROSES', ST_BELUM = 'BELUM_MULA';

function medanKosong(nilai) { return nilai === '' || nilai === null || nilai === undefined; }

/* Pulangkan {status, kurang:[{aspek, medan:[label]}], kurangCgpa:bool, diisi:bool, aktiviti:'tarikh'} */
function semakKelengkapan(m, aspekMap, ekstraMap) {
  const nokp = normalKP(m.NoKP);
  const kurang = [];
  let diisi = false, aktiviti = '';
  const catatAktiviti = rec => {
    if (rec && rec.OlehKP) { diisi = true; if (String(rec.Dikemaskini) > aktiviti) aktiviti = String(rec.Dikemaskini); }
  };
  SEMUA_ASPEK.forEach(a => {
    const rec = aspekMap[kunciAspek(nokp, a)];
    catatAktiviti(rec);
    const unit = (rec && rec.Unit) || m[a + '_Unit'];
    if (!unit) return;                                     // murid tidak menyertai aspek ini
    const r = rec || {};
    const tiada = [];
    MEDAN_WAJIB_ASPEK.forEach(([medan, label]) => {
      const kosong = medan === 'KOMITMEN'
        ? [r.Komit1, r.Komit2, r.Komit3, r.Komit4].every(medanKosong)
        : medanKosong(r[medan]);
      if (kosong) tiada.push(label);
    });
    if (tiada.length) kurang.push({ aspek: a, medan: tiada });
  });
  catatAktiviti(ekstraMap[nokp]);
  const kurangCgpa = WAJIB_CGPA_SEBELUM && nomborTingkatan(m.Tingkatan) >= 2 && medanKosong(m.CGPA_Sebelum);
  const status = (!kurang.length && !kurangCgpa) ? ST_LENGKAP : (diisi ? ST_PROSES : ST_BELUM);
  return { status, kurang, kurangCgpa, diisi, aktiviti };
}

function teksKurang(k) {
  const bahagian = k.kurang.map(x => x.aspek + ' (' + x.medan.join(', ') + ')');
  if (k.kurangCgpa) bahagian.push('CGPA tahun sebelum');
  return bahagian;
}

function statusGabungan(senaraiStatus) {
  if (!senaraiStatus.length) return ST_BELUM;
  if (senaraiStatus.every(s => s === ST_LENGKAP)) return ST_LENGKAP;
  if (senaraiStatus.every(s => s === ST_BELUM)) return ST_BELUM;
  return ST_PROSES;
}

/* Ringkasan satu kelas daripada senarai murid aktifnya. */
function ringkasanKelas(kunci, murid, aspekMap, ekstraMap) {
  const k = { kunci, nama: paparKelas(kunci), bil: murid.length, lengkap: 0, proses: 0, belum: 0, aktivitiTerakhir: '',
    kurangAspek: {}, kurangCgpa: 0, murid: [] };
  murid.forEach(m => {
    const s = semakKelengkapan(m, aspekMap, ekstraMap);
    if (s.status === ST_LENGKAP) k.lengkap++; else if (s.status === ST_PROSES) k.proses++; else k.belum++;
    if (s.aktiviti > k.aktivitiTerakhir) k.aktivitiTerakhir = s.aktiviti;
    s.kurang.forEach(x => {
      const ka = k.kurangAspek[x.aspek] = k.kurangAspek[x.aspek] || { murid: 0, medan: {} };
      ka.murid++;
      x.medan.forEach(md => { ka.medan[md] = (ka.medan[md] || 0) + 1; });
    });
    if (s.kurangCgpa) k.kurangCgpa++;
    if (s.status !== ST_LENGKAP) k.murid.push({ nokp: normalKP(m.NoKP), nama: m.Nama, status: s.status, kurang: teksKurang(s) });
  });
  k.murid.sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  k.status = k.bil ? (k.lengkap === k.bil ? ST_LENGKAP : (k.belum === k.bil ? ST_BELUM : ST_PROSES)) : ST_BELUM;
  k.peratus = k.bil ? Math.round(k.lengkap / k.bil * 100) : 0;
  return k;
}

/* Admin: semua guru kelas. Guru Kelas: kelas sendiri sahaja. */
function apiStatusPengisian(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  return jaya(binaStatusPengisian(sesi));
}

function binaStatusPengisian(sesi) {
  const admin = sesi.peranan === ROLE_ADMIN;

  const aspekMap = {}, ekstraMap = {}, muridKelas = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() !== 'AKTIF') return;
    if (!admin && sesi.kelas.indexOf(m.KunciKelas) === -1) return;
    (muridKelas[m.KunciKelas] = muridKelas[m.KunciKelas] || []).push(m);
  });
  bacaSheetSebagaiObjek(SHEET_ASPEK).forEach(r => { aspekMap[r.Kunci] = r; });
  bacaSheetSebagaiObjek(SHEET_EKSTRA).forEach(r => { ekstraMap[normalKP(r.NoKP)] = r; });

  const ringkasan = {};
  Object.keys(muridKelas).forEach(kunci => { ringkasan[kunci] = ringkasanKelas(kunci, muridKelas[kunci], aspekMap, ekstraMap); });

  const guruAktif = bacaSheetSebagaiObjek(SHEET_PENGGUNA).filter(u =>
    u.Peranan === ROLE_GURU_KELAS && String(u.Status).toUpperCase() === 'AKTIF' && (admin || normalKP(u.NoKP) === sesi.nokp));
  const kelasBerguru = {};
  const guru = [], guruTanpaKelas = [];
  guruAktif.forEach(u => {
    const kelas = senaraiDaripadaMedan(u.KelasDijaga).filter(k => ringkasan[k]);
    if (!kelas.length) { guruTanpaKelas.push({ nokp: normalKP(u.NoKP), nama: u.NamaPenuh }); return; }
    kelas.forEach(k => { kelasBerguru[k] = true; });
    const senaraiKelas = kelas.map(k => ringkasan[k]);
    const bil = senaraiKelas.reduce((j, k) => j + k.bil, 0), lengkap = senaraiKelas.reduce((j, k) => j + k.lengkap, 0);
    guru.push({
      nokp: normalKP(u.NoKP), nama: u.NamaPenuh, emel: u.Emel || '',
      status: statusGabungan(senaraiKelas.map(k => k.status)),
      peratus: bil ? Math.round(lengkap / bil * 100) : 0,
      aktivitiTerakhir: senaraiKelas.reduce((t, k) => (k.aktivitiTerakhir > t ? k.aktivitiTerakhir : t), ''),
      kelas: senaraiKelas
    });
  });
  const turutan = { BELUM_MULA: 0, DALAM_PROSES: 1, LENGKAP: 2 };
  guru.sort((a, b) => turutan[a.status] - turutan[b.status] || a.peratus - b.peratus || String(a.nama).localeCompare(String(b.nama)));

  const kira = { LENGKAP: 0, DALAM_PROSES: 0, BELUM_MULA: 0 };
  guru.forEach(g => { kira[g.status]++; });
  return {
    tahun: tahunSemasa(), guru, kira,
    kelasTanpaGuru: admin ? Object.keys(ringkasan).filter(k => !kelasBerguru[k]).sort().map(k => ringkasan[k]) : [],
    guruTanpaKelas: admin ? guruTanpaKelas : [],
    peraturan: { medanWajib: MEDAN_WAJIB_ASPEK.map(x => x[1]), cgpa: WAJIB_CGPA_SEBELUM }
  };
}
