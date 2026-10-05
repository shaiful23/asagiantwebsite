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
function laksanakanSegerak(kunciKelas) {
  const tahun = tahunSemasa();
  const ref = muatRujukan();
  const koko = bacaMuridKoko();
  const hadir = bacaKehadiranKoko(tahun);

  const sediaAda = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => { sediaAda[normalKP(m.NoKP)] = m; });

  const laporan = { baharu: 0, dikemaskini: 0, kelasBerubah: 0, tingkatanBeza: [], tiadaDiKoko: 0, amaran: hadir.amaran.slice() };
  const kokoMap = {};
  const muridUbah = [];
  const masa = sekarangTeks();

  koko.forEach(k => {
    kokoMap[k.nokp] = k;
    const sedia = sediaAda[k.nokp];
    if (kunciKelas && !(k.kunciKelas === kunciKelas || (sedia && sedia.KunciKelas === kunciKelas))) return;
    if (sedia && String(sedia.Status).toUpperCase() === 'TAMAT') return;
    let obj;
    if (!sedia) {
      obj = {
        NoKP: k.nokp, Nama: k.nama, Jantina: jantinaDaripadaKP(k.nokp), Tingkatan: k.tingkatan, Kelas: k.kelas,
        KunciKelas: k.kunciKelas, CGPA_Sebelum: '', SejarahCGPA: '', Status: 'AKTIF', PerluSemak: '', TahunTamat: ''
      };
      laporan.baharu++;
    } else {
      obj = Object.assign({}, sedia);
      obj.NoKP = k.nokp;
      obj.Nama = k.nama;
      if (!obj.Jantina) obj.Jantina = jantinaDaripadaKP(k.nokp);
      if (nomborTingkatan(sedia.Tingkatan) === k.tingkatan) {
        if (sedia.Kelas !== k.kelas) laporan.kelasBerubah++;
        obj.Kelas = k.kelas;
        obj.KunciKelas = k.kunciKelas;
        obj.PerluSemak = '';
      } else {
        laporan.tingkatanBeza.push(k.nama + ' (PAJSK: T' + sedia.Tingkatan + ', e-Koko: T' + k.tingkatan + ')');
      }
      laporan.dikemaskini++;
    }
    SEMUA_ASPEK.forEach(a => { obj[a + '_Unit'] = k.unit[a]; });
    obj.SegerakTerakhir = masa;
    muridUbah.push(obj);
  });

  // Murid aktif dalam skop yang tiada lagi dalam e-Kokurikulum (pindah / tamat) — dilapor sahaja, tidak dipadam.
  Object.keys(sediaAda).forEach(kp => {
    const m = sediaAda[kp];
    if (String(m.Status).toUpperCase() !== 'AKTIF' || kokoMap[kp]) return;
    if (kunciKelas && m.KunciKelas !== kunciKelas) return;
    laporan.tiadaDiKoko++;
  });

  upsertBanyak(SHEET_MURID, 'NoKP', muridUbah);

  // Kemaskini baris ASPEK (unit, kehadiran auto, jawatan jika diisi di e-Kokurikulum) + RUMUSAN.
  const konteksSemua = muatKonteks(null);
  const aspekMap = konteksSemua.aspekMap, ekstraMap = konteksSemua.ekstraMap;
  const aspekUbah = [], rumusanUbah = [];
  muridUbah.forEach(m => {
    const k = kokoMap[m.NoKP];
    SEMUA_ASPEK.forEach(a => {
      const unit = m[a + '_Unit'];
      const kunci = kunciAspek(m.NoKP, a);
      let rec = aspekMap[kunci];
      const jawKoko = k && k.jawatan[a] && ref.peta.JAWATAN[k.jawatan[a]] !== undefined ? k.jawatan[a] : '';
      if (!rec && !unit && !jawKoko) return;
      if (!rec) { rec = aspekKosong(m.NoKP, a, unit); aspekMap[kunci] = rec; }
      rec.Unit = unit || rec.Unit;
      if (!rec.Jawatan && jawKoko) rec.Jawatan = jawKoko;
      rec.KehadiranAuto = Math.min(KEHADIRAN_MAKSIMUM, hadir.kira[a][m.NoKP] || 0);
      rec.Dikemaskini = masa;
      kiraSemulaAspek(rec, ref);
      aspekUbah.push(rec);
    });
    rumusanUbah.push(binaRumusan(m, aspekMap, ekstraMap, ref));
  });
  upsertBanyak(SHEET_ASPEK, 'Kunci', aspekUbah);
  upsertBanyak(SHEET_RUMUSAN, 'NoKP', rumusanUbah);
  tulisTetapan('SEGERAK_KOKO_TERAKHIR', masa);

  laporan.jumlahDiproses = muridUbah.length;
  laporan.masa = masa;
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
  try {
    const laporan = denganKunci(() => laksanakanSegerak(kelas || null));
    catatAudit(sesi, 'SEGERAK_KOKO', 'MURID', kelas || 'SEMUA',
      laporan.jumlahDiproses + ' murid; baharu ' + laporan.baharu + ', kelas berubah ' + laporan.kelasBerubah);
    return jaya({ laporan });
  } catch (e) {
    return ralat(e.message);
  }
}

/* ------------------------- PENGURUSAN MURID (Admin) ------------------------- */
function apiSenaraiMurid(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const status = String(p.status || 'AKTIF').toUpperCase();
  const senarai = bacaSheetSebagaiObjek(SHEET_MURID)
    .filter(m => status === 'SEMUA' || String(m.Status).toUpperCase() === status)
    .filter(m => !p.kelas || m.KunciKelas === p.kelas)
    .map(m => ({
      nokp: normalKP(m.NoKP), nama: m.Nama, tingkatan: m.Tingkatan, kelas: m.Kelas, kunciKelas: m.KunciKelas,
      cgpaSebelum: m.CGPA_Sebelum, sejarah: m.SejarahCGPA, pbb: m.PBB_Unit, kp: m.KP_Unit, sp: m.SP_Unit,
      status: m.Status, perluSemak: m.PerluSemak, tahunTamat: m.TahunTamat
    }));
  const bilPerluSemak = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => String(m.Status).toUpperCase() === 'AKTIF' && m.PerluSemak === 'YA').length;
  return jaya({ senarai, bilPerluSemak, segerakTerakhir: dapatTetapan('SEGERAK_KOKO_TERAKHIR') });
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
