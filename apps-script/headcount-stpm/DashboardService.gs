/* =========================================================================
 * DashboardService.gs — MODUL 15 (DASHBOARD GPK), MODUL 16 (DASHBOARD GURU),
 * MODUL 17 (DASHBOARD KETUA PANITIA), MODUL 40 (DASHBOARD UTAMA)
 * ========================================================================= */

/* Dashboard pengurusan (ADMIN/GPK/KETUA_AKADEMIK) — MODUL 15 & 40. */
function apiDashboardGPK(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || 'S1').trim();
  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();

  let pelajar = bacaSheetSebagaiObjek(SHEET_STUDENTS).filter(s => String(s.Status).toUpperCase() === 'AKTIF');
  if (p.tahunSTPM) pelajar = pelajar.filter(s => String(s.TahunSTPM) === String(p.tahunSTPM));
  if (p.kelas) pelajar = pelajar.filter(s => String(s.Kelas).toUpperCase() === String(p.kelas).toUpperCase());

  let headcount = bacaSheetSebagaiObjek(sheetHeadcount(semester));
  if (p.kodSubjek) headcount = headcount.filter(h => h.KodSubjek === p.kodSubjek);
  const idPelajarDibenarkan = new Set(pelajar.map(s => s.ID_Pelajar));
  headcount = headcount.filter(h => idPelajarDibenarkan.has(h.ID_Pelajar));

  const dianalisis = headcount.map(h => Object.assign({}, h, analisisRekodHeadcount(mapGred, konfig, h)));

  let hijau = 0, kuning = 0, merah = 0;
  dianalisis.forEach(r => {
    if (r.statusGapETR === STATUS_HIJAU) hijau++;
    else if (r.statusGapETR === STATUS_KUNING) kuning++;
    else if (r.statusGapETR === STATUS_MERAH) merah++;
  });

  const gpsSemasa = kiraGPS(mapGred, dianalisis.map(gredEfektif).filter(Boolean));
  const pngkPurata = kiraPNGK(mapGred, dianalisis.map(r => r.SEBENAR_Gred).filter(Boolean));
  const sasaranGPS = Number(konfig.sasaranGPS || 0);

  const bilUlanganS1 = bacaSheetSebagaiObjek(SHEET_REPEAT_S1).filter(r => idPelajarDibenarkan.has(r.ID_Pelajar)).length;
  const bilUlanganS2 = bacaSheetSebagaiObjek(SHEET_REPEAT_S2).filter(r => idPelajarDibenarkan.has(r.ID_Pelajar)).length;

  // Subjek kritikal: subjek dengan peratus MERAH tertinggi
  const mengikutSubjek = {};
  dianalisis.forEach(r => {
    if (!mengikutSubjek[r.KodSubjek]) mengikutSubjek[r.KodSubjek] = { jumlah: 0, merah: 0 };
    mengikutSubjek[r.KodSubjek].jumlah++;
    if (r.statusGapETR === STATUS_MERAH) mengikutSubjek[r.KodSubjek].merah++;
  });
  const subjekKritikal = Object.keys(mengikutSubjek)
    .map(k => ({ kodSubjek: k, peratusMerah: Number(((mengikutSubjek[k].merah / mengikutSubjek[k].jumlah) * 100).toFixed(1)) }))
    .sort((a, b) => b.peratusMerah - a.peratusMerah)
    .slice(0, 5);

  return jaya({
    jumlahCalon: pelajar.length,
    jumlahSubjek: bacaSheetSebagaiObjek(SHEET_SUBJECTS).length,
    sasaranGPS, gpsSemasa, gapGPS: gpsSemasa !== null ? Number((gpsSemasa - sasaranGPS).toFixed(2)) : null,
    pngkPurata,
    bilanganHijau: hijau, bilanganKuning: kuning, bilanganMerah: merah,
    bilanganUlanganS1: bilUlanganS1, bilanganUlanganS2: bilUlanganS2,
    subjekKritikal
  });
}

/* Dashboard Guru (MODUL 16) — hanya kelas/subjek yang diajar guru berkenaan. */
function apiDashboardGuru(p) {
  const sesi = wajibPeranan(p.token, [ROLE_GURU, ROLE_KETUA_PANITIA].concat(PERANAN_AKSES_PENUH));
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || 'S1').trim();
  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  let headcount = bacaSheetSebagaiObjek(sheetHeadcount(semester));
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) headcount = headcount.filter(h => sesi.skopSubjek.includes(h.KodSubjek));
  if (p.kodSubjek) headcount = headcount.filter(h => h.KodSubjek === p.kodSubjek);

  const senarai = headcount.map(h => {
    const analisis = analisisRekodHeadcount(mapGred, konfig, h);
    const pelajar = pelajarMap[h.ID_Pelajar] || {};
    const intervensiPelajar = bacaSheetSebagaiObjek(SHEET_INTERVENTIONS)
      .filter(i => i.ID_Pelajar === h.ID_Pelajar && i.KodSubjek === h.KodSubjek).length;
    return Object.assign({}, h, analisis, { namaPelajar: pelajar.Nama || '', kelas: pelajar.Kelas || '', bilanganIntervensi: intervensiPelajar });
  });

  return jaya({ senarai });
}

/* Dashboard Ketua Panitia (MODUL 17) — analisis satu mata pelajaran merentasi kelas/semester. */
function apiDashboardKetuaPanitia(p) {
  const sesi = wajibPeranan(p.token, [ROLE_KETUA_PANITIA].concat(PERANAN_AKSES_PENUH));
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  if (!kodSubjek) return ralat('Kod Subjek wajib dinyatakan.');
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }

  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  const bySemester = {};
  ['S1', 'S2', 'S3'].forEach(sem => {
    const rekod = bacaSheetSebagaiObjek(sheetHeadcount(sem)).filter(r => r.KodSubjek === kodSubjek);
    const dianalisis = rekod.map(r => Object.assign({}, r, analisisRekodHeadcount(mapGred, konfig, r), { kelas: (pelajarMap[r.ID_Pelajar] || {}).Kelas || '' }));
    const gps = kiraGPS(mapGred, dianalisis.map(gredEfektif).filter(Boolean));
    const berisiko = dianalisis.filter(r => r.risiko === RISIKO_BERISIKO).length;
    bySemester[sem] = { senarai: dianalisis, gps, bilanganBerisiko: berisiko };
  });

  const impakS1 = apiImpakIntervensi({ token: p.token, semester: 'S1' });
  const impakS2 = apiImpakIntervensi({ token: p.token, semester: 'S2' });

  return jaya({
    kodSubjek, mengikutSemester: bySemester,
    keberkesananIntervensi: { S1: impakS1.peratusKeberkesanan, S2: impakS2.peratusKeberkesanan }
  });
}
