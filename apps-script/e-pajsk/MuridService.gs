/* =========================================================================
 * MuridService.gs — Data murid & penyegerakan daripada e-Kokurikulum.
 *
 * Peraturan penyegerakan (selamat untuk Arkib / Naik Tingkatan):
 *  - Nama, unit PBB/KP/SP sentiasa diambil daripada e-Kokurikulum.
 *  - TINGKATAN tidak pernah dinaikkan oleh penyegerakan (hanya fungsi Naik
 *    Tingkatan yang menaikkannya). Kelas dikemaskini hanya jika tingkatan di
 *    kedua-dua sistem SAMA. Murid yang baru dinaikkan (PerluSemak = YA) akan
 *    menerima kelas baharu sebaik sahaja e-Kokurikulum turut dinaikkan.
 *  - Murid yang sudah TAMAT (Tingkatan 5 diarkibkan) tidak disentuh.
 * ========================================================================= */

const HEADER_MURID = ['NoKP', 'Nama', 'Jantina', 'Tingkatan', 'Kelas', 'KunciKelas', 'CGPA_Sebelum', 'SejarahCGPA',
  'PBB_Unit', 'KP_Unit', 'SP_Unit', 'Status', 'PerluSemak', 'SegerakTerakhir', 'TahunTamat'];

const HEADER_ASPEK = ['Kunci', 'NoKP', 'Aspek', 'Unit', 'Jawatan', 'Libat1', 'Capai1', 'Aktiviti2', 'Libat2', 'Capai2',
  'Komit1', 'Komit2', 'Komit3', 'Komit4', 'Khidmat', 'KehadiranAuto', 'KehadiranManual', 'Kehadiran',
  'SkorJawatan', 'SkorLibat', 'SkorCapai', 'SkorKomit', 'SkorKhidmat', 'SkorKehadiran', 'Skor', 'Markah', 'Dikemaskini', 'OlehKP'];

const HEADER_EKSTRA = ['NoKP', 'Perkhidmatan', 'AnugerahKhas', 'KhidmatMasyarakat', 'Nilam', 'TimmsPisa', 'TugasKhas',
  'SkPerkhidmatan', 'SkAnugerah', 'SkKM', 'SkNilam', 'SkTimms', 'SkTugas', 'SkorTertinggi', 'Dikemaskini', 'OlehKP'];

const HEADER_RUMUSAN = ['NoKP', 'Nama', 'Tingkatan', 'Kelas', 'KunciKelas', 'CGPA_Sebelum', 'PBB', 'SP', 'KP', 'Ekstra',
  'Purata2Tertinggi', 'GPA', 'CGPA', 'Persepuluh', 'Gred', 'Label', 'Rumusan', 'Dikemaskini'];

/* ------------------------- OBJEK KOSONG ------------------------- */
function kunciAspek(nokp, aspek) { return nokp + '|' + aspek; }

function aspekKosong(nokp, aspek, unit) {
  return {
    Kunci: kunciAspek(nokp, aspek), NoKP: nokp, Aspek: aspek, Unit: unit || '', Jawatan: '', Libat1: '', Capai1: '',
    Aktiviti2: '', Libat2: '', Capai2: '', Komit1: '', Komit2: '', Komit3: '', Komit4: '', Khidmat: '',
    KehadiranAuto: 0, KehadiranManual: '', Kehadiran: 0,
    SkorJawatan: 0, SkorLibat: 0, SkorCapai: 0, SkorKomit: 0, SkorKhidmat: 0, SkorKehadiran: 0, Skor: 0, Markah: 0,
    Dikemaskini: '', OlehKP: ''
  };
}

function ekstraKosong(nokp) {
  return {
    NoKP: nokp, Perkhidmatan: '', AnugerahKhas: '', KhidmatMasyarakat: '', Nilam: '', TimmsPisa: '', TugasKhas: '',
    SkPerkhidmatan: 0, SkAnugerah: 0, SkKM: 0, SkNilam: 0, SkTimms: 0, SkTugas: 0, SkorTertinggi: 0, Dikemaskini: '', OlehKP: ''
  };
}

/* Tetapkan Kehadiran akhir (manual mengatasi auto) kemudian kira semua skor aspek. */
function kiraSemulaAspek(rec, ref) {
  const manual = rec.KehadiranManual;
  const guna = (manual === '' || manual === null || manual === undefined) ? nombor(rec.KehadiranAuto) : nombor(manual);
  rec.Kehadiran = Math.max(0, Math.min(KEHADIRAN_MAKSIMUM, Math.floor(guna)));
  Object.assign(rec, kiraAspekMurni(rec, ref));
  return rec;
}

function kiraSemulaEkstra(rec, ref) {
  Object.assign(rec, kiraEkstraMurni(rec, ref));
  return rec;
}

function binaRumusan(murid, aspekMap, ekstraMap, ref) {
  const nokp = normalKP(murid.NoKP);
  const markah = a => nombor((aspekMap[kunciAspek(nokp, a)] || {}).Markah);
  const ek = ekstraMap[nokp];
  const ekTinggi = ek ? nombor(ek.SkorTertinggi) : 0;
  const cg = murid.CGPA_Sebelum === '' || murid.CGPA_Sebelum === null || murid.CGPA_Sebelum === undefined ? '' : nombor(murid.CGPA_Sebelum);
  const r = kiraRumusanMurni(markah(ASPEK_PBB), markah(ASPEK_SP), markah(ASPEK_KP), ekTinggi, cg, ref);
  return Object.assign({
    NoKP: nokp, Nama: murid.Nama, Tingkatan: murid.Tingkatan, Kelas: murid.Kelas, KunciKelas: murid.KunciKelas,
    CGPA_Sebelum: cg, PBB: markah(ASPEK_PBB), SP: markah(ASPEK_SP), KP: markah(ASPEK_KP), Ekstra: ekTinggi,
    Dikemaskini: sekarangTeks()
  }, r);
}

/* ------------------------- KONTEKS (baca sekali) ------------------------- */
/* kunciKelas null => semua murid aktif. */
function muatKonteks(kunciKelas) {
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m =>
    String(m.Status).toUpperCase() === 'AKTIF' && (!kunciKelas || m.KunciKelas === kunciKelas));
  murid.forEach(m => { m.NoKP = normalKP(m.NoKP); });
  const set = {};
  murid.forEach(m => { set[m.NoKP] = true; });
  const aspekMap = {}, ekstraMap = {}, rumusanMap = {};
  bacaSheetSebagaiObjek(SHEET_ASPEK).forEach(r => { r.NoKP = normalKP(r.NoKP); if (set[r.NoKP]) aspekMap[r.Kunci] = r; });
  bacaSheetSebagaiObjek(SHEET_EKSTRA).forEach(r => { r.NoKP = normalKP(r.NoKP); if (set[r.NoKP]) ekstraMap[r.NoKP] = r; });
  bacaSheetSebagaiObjek(SHEET_RUMUSAN).forEach(r => { r.NoKP = normalKP(r.NoKP); if (set[r.NoKP]) rumusanMap[r.NoKP] = r; });
  murid.sort((a, b) => String(a.Nama).localeCompare(String(b.Nama)));
  return { murid, aspekMap, ekstraMap, rumusanMap };
}

function sesiBolehKelas(sesi, kelas) {
  return !!kelas && wajibAksesKelas(sesi, kelas);
}

/* ------------------------- SEGERAK DARIPADA e-KOKURIKULUM ------------------------- */
/* Segerak "delta": data e-Kokurikulum dibaca melalui cache berasaskan masa kemas kini fail; hanya baris yang
   BENAR-BENAR berubah ditulis ke Sheet (menjimatkan masa dan tidak menaikkan versi data tanpa sebab).
   MESTI dipanggil dalam denganKunci(). */
function laksanakanSegerak(kunciKelas, paksa) {
  const tahun = tahunSemasa();
  const ref = muatRujukan();
  const koko = bacaKokoRingkas(tahun, !!paksa);
  const hadir = { kira: koko.kira, amaran: koko.amaran || [] };

  const sediaAda = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => { sediaAda[normalKP(m.NoKP)] = m; });
  const aspekMap = {}, ekstraMap = {}, rumusanAda = {};
  bacaSheetSebagaiObjek(SHEET_ASPEK).forEach(r => { aspekMap[r.Kunci] = r; });
  bacaSheetSebagaiObjek(SHEET_EKSTRA).forEach(r => { ekstraMap[normalKP(r.NoKP)] = r; });
  bacaSheetSebagaiObjek(SHEET_RUMUSAN).forEach(r => { rumusanAda[normalKP(r.NoKP)] = true; });

  const laporan = { baharu: 0, dikemaskini: 0, kelasBerubah: 0, tingkatanBeza: [], tiadaDiKoko: 0, amaran: hadir.amaran.slice(), diubah: 0, dariCache: !!koko.dariCache };
  const kokoMap = {};
  const muridUbah = [];
  const proses = [];     // murid (objek akhir) dalam skop, untuk semakan aspek/rumusan
  const masa = sekarangTeks();

  koko.murid.forEach(k => {
    kokoMap[k.nokp] = k;
    const sedia = sediaAda[k.nokp];
    if (kunciKelas && !(k.kunciKelas === kunciKelas || (sedia && sedia.KunciKelas === kunciKelas))) return;
    if (sedia && String(sedia.Status).toUpperCase() === 'TAMAT') return;
    let obj, berubah = false;
    if (!sedia) {
      obj = {
        NoKP: k.nokp, Nama: k.nama, Jantina: jantinaDaripadaKP(k.nokp), Tingkatan: k.tingkatan, Kelas: k.kelas,
        KunciKelas: k.kunciKelas, CGPA_Sebelum: '', SejarahCGPA: '', Status: 'AKTIF', PerluSemak: '', TahunTamat: ''
      };
      SEMUA_ASPEK.forEach(a => { obj[a + '_Unit'] = k.unit[a]; });
      obj.SegerakTerakhir = masa;
      laporan.baharu++;
      berubah = true;
    } else {
      obj = Object.assign({}, sedia);
      obj.NoKP = k.nokp;
      const tetapkan = (medan, nilai) => { if (String(obj[medan] === undefined ? '' : obj[medan]) !== String(nilai)) { obj[medan] = nilai; berubah = true; } };
      tetapkan('Nama', k.nama);
      if (!obj.Jantina) tetapkan('Jantina', jantinaDaripadaKP(k.nokp));
      if (nomborTingkatan(sedia.Tingkatan) === k.tingkatan) {
        if (sedia.Kelas !== k.kelas) laporan.kelasBerubah++;
        tetapkan('Kelas', k.kelas);
        tetapkan('KunciKelas', k.kunciKelas);
        tetapkan('PerluSemak', '');
      } else {
        laporan.tingkatanBeza.push(k.nama + ' (PAJSK: T' + sedia.Tingkatan + ', e-Koko: T' + k.tingkatan + ')');
      }
      SEMUA_ASPEK.forEach(a => tetapkan(a + '_Unit', k.unit[a]));
      if (berubah) obj.SegerakTerakhir = masa;
      laporan.dikemaskini++;
    }
    if (berubah) muridUbah.push(obj);
    proses.push(obj);
  });

  Object.keys(sediaAda).forEach(kp => {
    const m = sediaAda[kp];
    if (String(m.Status).toUpperCase() !== 'AKTIF' || kokoMap[kp]) return;
    if (kunciKelas && m.KunciKelas !== kunciKelas) return;
    laporan.tiadaDiKoko++;
  });

  // ASPEK (unit, kehadiran auto, jawatan e-Kokurikulum jika diisi) — tulis hanya yang berubah; RUMUSAN bagi yang terjejas.
  const aspekUbah = [], rumusanUbah = [];
  const muridUbahSet = {};
  muridUbah.forEach(m => { muridUbahSet[m.NoKP] = true; });
  proses.forEach(m => {
    const k = kokoMap[m.NoKP];
    let aspekBerubah = false;
    SEMUA_ASPEK.forEach(a => {
      const unit = m[a + '_Unit'];
      const kunci = kunciAspek(m.NoKP, a);
      let rec = aspekMap[kunci];
      const jawKoko = k && k.jawatan[a] && ref.peta.JAWATAN[k.jawatan[a]] !== undefined ? k.jawatan[a] : '';
      if (!rec && !unit && !jawKoko) return;
      const hadirAuto = Math.min(KEHADIRAN_MAKSIMUM, hadir.kira[a][m.NoKP] || 0);
      const baharu = !rec;
      if (baharu) { rec = aspekKosong(m.NoKP, a, unit); aspekMap[kunci] = rec; }
      const sebelum = [rec.Unit, rec.Jawatan, rec.KehadiranAuto].join('|');
      rec.Unit = unit || rec.Unit;
      if (!rec.Jawatan && jawKoko) rec.Jawatan = jawKoko;
      rec.KehadiranAuto = hadirAuto;
      if (baharu || sebelum !== [rec.Unit, rec.Jawatan, rec.KehadiranAuto].join('|')) {
        rec.Dikemaskini = masa;
        kiraSemulaAspek(rec, ref);
        aspekUbah.push(rec);
        aspekBerubah = true;
      }
    });
    if (aspekBerubah || muridUbahSet[m.NoKP] || !rumusanAda[m.NoKP]) {
      rumusanUbah.push(binaRumusan(m, aspekMap, ekstraMap, ref));
    }
  });

  upsertBanyak(SHEET_MURID, 'NoKP', muridUbah);
  upsertBanyak(SHEET_ASPEK, 'Kunci', aspekUbah);
  upsertBanyak(SHEET_RUMUSAN, 'NoKP', rumusanUbah);

  laporan.diubah = muridUbah.length + aspekUbah.length + rumusanUbah.length;
  laporan.jumlahDiproses = proses.length;
  laporan.masa = masa;
  laporan.ts = koko.ts;
  return laporan;
}

function apiSegerakKoko(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const kelas = String(p.kelas || '').trim();
  if (kelas) {
    if (!sesiBolehKelas(sesi, kelas)) return ralat('Anda tidak mempunyai akses kepada kelas ini.');
  } else if (sesi.peranan !== ROLE_ADMIN) {
    return ralat('Hanya Admin boleh menyegerak semua kelas.');
  }
  const paksa = sesi.peranan === ROLE_ADMIN && !!p.paksa;
  const hasil = denganKunci(() => {
    const laporan = laksanakanSegerak(kelas || null, paksa);
    if (laporan.diubah || paksa) tulisTetapan('SEGERAK_KOKO_TERAKHIR', laporan.masa);
    if (!kelas && laporan.ts) tulisTetapan('KOKO_TS_TERAKHIR', penandaKoko(laporan.ts));   // segerak penuh sahaja menandakan fail sudah diproses
    if (laporan.diubah || paksa) {
      catatAudit(sesi, 'SEGERAK_KOKO', 'MURID', kelas || 'SEMUA',
        laporan.jumlahDiproses + ' murid; ' + laporan.diubah + ' rekod berubah; baharu ' + laporan.baharu + ', kelas berubah ' + laporan.kelasBerubah);
    }
    return jaya({ laporan, versi: versiData() });
  });
  return hasil;
}

/* ------------------------- PENGURUSAN MURID (Admin) ------------------------- */
function apiSenaraiMurid(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const status = String(p.status || 'AKTIF').toUpperCase();
  const semuaMurid = bacaSheetSebagaiObjek(SHEET_MURID);
  const senarai = semuaMurid
    .filter(m => status === 'SEMUA' || String(m.Status).toUpperCase() === status)
    .filter(m => !p.kelas || m.KunciKelas === p.kelas)
    .sort((a, b) => String(a.KunciKelas).localeCompare(String(b.KunciKelas)) || String(a.Nama).localeCompare(String(b.Nama)))
    .map(m => ({
      nokp: normalKP(m.NoKP), nama: m.Nama, tingkatan: m.Tingkatan, kelas: m.Kelas, kunciKelas: m.KunciKelas,
      cgpaSebelum: m.CGPA_Sebelum, sejarah: m.SejarahCGPA, pbb: m.PBB_Unit, kp: m.KP_Unit, sp: m.SP_Unit,
      status: m.Status, perluSemak: m.PerluSemak, tahunTamat: m.TahunTamat
    }));
  const bilPerluSemak = semuaMurid.filter(m => String(m.Status).toUpperCase() === 'AKTIF' && m.PerluSemak === 'YA').length;
  return jaya(Object.assign(halamanKan(senarai, p, m => m.nama + ' ' + m.nokp + ' ' + m.kunciKelas + ' ' + m.pbb + ' ' + m.kp + ' ' + m.sp),
    { bilPerluSemak, segerakTerakhir: dapatTetapan('SEGERAK_KOKO_TERAKHIR') }));
}

function apiSimpanMurid(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  const ting = Number(p.tingkatan);
  const kelas = banding(p.kelas);
  const status = String(p.status || 'AKTIF').toUpperCase();
  if (!(ting >= 1 && ting <= 5) || !kelas) return ralat('Tingkatan (1-5) dan kelas diperlukan.');
  if (['AKTIF', 'PINDAH'].indexOf(status) === -1) return ralat('Status mesti AKTIF atau PINDAH.');
  const cg = String(p.cgpaSebelum === undefined || p.cgpaSebelum === null ? '' : p.cgpaSebelum).trim();
  if (cg !== '' && (isNaN(Number(cg)) || Number(cg) < 0 || Number(cg) > 100)) return ralat('CGPA tahun sebelum mesti antara 0 dan 100.');
  return denganKunci(() => {
    const m = bacaSheetSebagaiObjek(SHEET_MURID).find(x => normalKP(x.NoKP) === nokp);
    if (!m) return ralat('Murid tidak dijumpai.');
    m.Tingkatan = ting;
    m.Kelas = kelas;
    m.KunciKelas = ting + ' ' + kelas;
    m.Status = status;
    m.CGPA_Sebelum = cg === '' ? '' : Number(cg);
    m.SejarahCGPA = String(p.sejarah || '').trim();
    m.PerluSemak = '';
    kemaskiniBaris(SHEET_MURID, m.__row, m);
    const ref = muatRujukan();
    const k = muatKonteks(null);
    const rum = binaRumusan(Object.assign({}, m, { NoKP: nokp }), k.aspekMap, k.ekstraMap, ref);
    upsertBanyak(SHEET_RUMUSAN, 'NoKP', [rum]);
    catatAudit(sesi, 'KEMASKINI', 'MURID', nokp, 'Kemaskini murid: ' + m.Nama + ' -> ' + m.KunciKelas + ' (' + status + ')');
    return jaya({});
  });
}
