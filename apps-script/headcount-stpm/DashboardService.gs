/* =========================================================================
 * DashboardService.gs — MODUL 15 (DASHBOARD GPK), MODUL 16 (DASHBOARD GURU),
 * MODUL 17 (DASHBOARD KETUA PANITIA), MODUL 40 (DASHBOARD UTAMA)
 * ========================================================================= */

/* Dashboard pengurusan (ADMIN) — MODUL 15 & 40. */
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
  if (p.kodSubjek) headcount = headcount.filter(h => String(h.KodSubjek) === String(p.kodSubjek));
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

/* Pemantauan pengisian markah (ADMIN/GPK/Ketua Akademik sahaja) — peratus
   siap ETR/AR1/AR2/SEBENAR bagi SETIAP gabungan Subjek x Kelas, supaya admin
   boleh kenal pasti terus kelas/subjek mana yang guru belum selesai isi
   markah sebelum tarikh akhir (rujuk LockService.gs). */
function apiPemantauanPengisianMarkah(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || 'S1').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();

  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).filter(s => String(s.Status).toUpperCase() === 'AKTIF').forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  let enrolmen = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).filter(e => pelajarMap[e.ID_Pelajar]);
  if (tahunSTPM) enrolmen = enrolmen.filter(e => String(e.TahunSTPM) === tahunSTPM);

  const headcountMap = {};
  bacaSheetSebagaiObjek(sheetHeadcount(semester)).forEach(h => { headcountMap[kunciRekod(h.ID_Pelajar, h.KodSubjek, h.TahunSTPM)] = h; });

  const kumpulan = {}; // kunci: KodSubjek|Kelas
  enrolmen.forEach(e => {
    const pelajar = pelajarMap[e.ID_Pelajar];
    if (!pelajar) return;
    const kunci = e.KodSubjek + '|' + pelajar.Kelas;
    if (!kumpulan[kunci]) kumpulan[kunci] = { kodSubjek: e.KodSubjek, kelas: pelajar.Kelas, jumlah: 0, etr: 0, ar1: 0, ar2: 0, sebenar: 0 };
    kumpulan[kunci].jumlah++;
    const hc = headcountMap[kunciRekod(e.ID_Pelajar, e.KodSubjek, e.TahunSTPM)];
    if (hc) {
      if (hc.ETR_Markah !== '') kumpulan[kunci].etr++;
      if (hc.AR1_Markah !== '') kumpulan[kunci].ar1++;
      if (hc.AR2_Markah !== '') kumpulan[kunci].ar2++;
      if (hc.SEBENAR_Gred !== '') kumpulan[kunci].sebenar++;
    }
  });

  const peratus = (bil, jum) => jum ? Number(((bil / jum) * 100).toFixed(0)) : 0;
  const senarai = Object.keys(kumpulan).map(k => {
    const r = kumpulan[k];
    return {
      kodSubjek: r.kodSubjek, kelas: r.kelas, jumlahPelajar: r.jumlah,
      peratusETR: peratus(r.etr, r.jumlah), peratusAR1: peratus(r.ar1, r.jumlah),
      peratusAR2: peratus(r.ar2, r.jumlah), peratusSEBENAR: peratus(r.sebenar, r.jumlah)
    };
  }).sort((a, b) => a.peratusETR - b.peratusETR || String(a.kodSubjek).localeCompare(String(b.kodSubjek)) || String(a.kelas).localeCompare(String(b.kelas)));

  return jaya({ senarai });
}

/* Dashboard Guru (MODUL 16) — hanya kelas/subjek yang diajar guru berkenaan. */
function apiDashboardGuru(p) {
  const sesi = wajibPeranan(p.token, null); // semua peranan; rekod ditapis ikut subjek/kelas jagaan
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || 'S1').trim();
  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  let headcount = bacaSheetSebagaiObjek(sheetHeadcount(semester));
  headcount = headcount.filter(penapisRekodPelajar(sesi, pelajarMap));
  if (p.kodSubjek) headcount = headcount.filter(h => String(h.KodSubjek) === String(p.kodSubjek));
  if (p.tahunSTPM) headcount = headcount.filter(h => String(h.TahunSTPM) === String(p.tahunSTPM));

  const senarai = headcount.map(h => {
    const analisis = analisisRekodHeadcount(mapGred, konfig, h);
    const pelajar = pelajarMap[h.ID_Pelajar] || {};
    const intervensiPelajar = bacaSheetSebagaiObjek(SHEET_INTERVENTIONS)
      .filter(i => i.ID_Pelajar === h.ID_Pelajar && String(i.KodSubjek) === String(h.KodSubjek)).length;
    return Object.assign({}, h, analisis, { namaPelajar: pelajar.Nama || '', kelas: pelajar.Kelas || '', bilanganIntervensi: intervensiPelajar });
  });

  return jaya({ senarai });
}

/* Dashboard Ketua Unit (MODUL 17) — analisis satu mata pelajaran merentasi kelas/semester. */
function apiDashboardKetuaPanitia(p) {
  const sesi = wajibPeranan(p.token, [ROLE_KETUA_UNIT].concat(PERANAN_AKSES_PENUH));
  if (sesi.success === false) return sesi;

  const kodSubjek = String(p.kodSubjek || '').trim();
  if (!kodSubjek) return ralat('Kod Subjek wajib dinyatakan.');
  if (!aksesPenuh(sesi) && !ketuaUnitBagi(sesi, kodSubjek)) {
    return ralat('Hanya Ketua Unit mata pelajaran ini (atau Admin) boleh melihat dashboard subjek.');
  }

  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  const bySemester = {};
  ['S1', 'S2', 'S3'].forEach(sem => {
    let rekod = bacaSheetSebagaiObjek(sheetHeadcount(sem)).filter(r => String(r.KodSubjek) === String(kodSubjek));
    if (p.tahunSTPM) rekod = rekod.filter(r => String(r.TahunSTPM) === String(p.tahunSTPM));
    const dianalisis = rekod.map(r => Object.assign({}, r, analisisRekodHeadcount(mapGred, konfig, r), { kelas: (pelajarMap[r.ID_Pelajar] || {}).Kelas || '' }));
    const gps = kiraGPS(mapGred, dianalisis.map(gredEfektif).filter(Boolean));
    const berisiko = dianalisis.filter(r => r.risiko === RISIKO_BERISIKO).length;
    bySemester[sem] = { senarai: dianalisis, gps, bilanganBerisiko: berisiko };
  });

  const impakS1 = apiImpakIntervensi({ token: p.token, semester: 'S1', tahunSTPM: p.tahunSTPM });
  const impakS2 = apiImpakIntervensi({ token: p.token, semester: 'S2', tahunSTPM: p.tahunSTPM });

  return jaya({
    kodSubjek, mengikutSemester: bySemester,
    keberkesananIntervensi: { S1: impakS1.peratusKeberkesanan, S2: impakS2.peratusKeberkesanan }
  });
}
