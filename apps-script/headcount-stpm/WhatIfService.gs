/* =========================================================================
 * WhatIfService.gs — MODUL 21: WHAT-IF ANALYSIS
 * Input ialah MARKAH hipotesis (Gred diterbitkan automatik daripada BLD subjek
 * berkenaan, sama seperti headcount sebenar). Simulasi anggaran perubahan
 * PNGK/GPS sahaja — TIDAK PERNAH menulis ke mana-mana Sheet. Frontend WAJIB
 * label hasil sebagai "SIMULASI" (MODUL 21).
 * ========================================================================= */

function apiSimulasiWhatIf(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const semester = String(p.semester || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const markahBaruMentah = String(p.markahBaru !== undefined ? p.markahBaru : '').trim();
  if (!idPelajar || !semester || !kodSubjek || markahBaruMentah === '') {
    return ralat('ID Pelajar, Semester, Kod Subjek dan Markah Hipotesis wajib diisi.');
  }

  const markahBaru = Number(markahBaruMentah);
  if (isNaN(markahBaru) || markahBaru < 0 || markahBaru > 100) return ralat('Markah Hipotesis mesti nombor antara 0-100.');

  const mapGred = dapatkanGred();
  const bldMap = dapatkanBLD();
  const gredBaru = gredDaripadaMarkah(bldMap, kodSubjek, markahBaru);
  if (!gredBaru) return ralat('BLD subjek "' + kodSubjek + '" belum lengkap, atau markah tiada dalam mana-mana julat gred yang ditetapkan.');

  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }

  /* ---- PNGK pelajar merentasi semua semester (MODUL 18) ---- */
  const gredSemasaSemuaSemester = {};
  let rekodDisasar = null;
  ['S1', 'S2', 'S3'].forEach(sem => {
    bacaSheetSebagaiObjek(sheetHeadcount(sem)).filter(r => r.ID_Pelajar === idPelajar).forEach(r => {
      gredSemasaSemuaSemester[sem + '|' + r.KodSubjek] = gredEfektif(r);
      if (sem === semester && r.KodSubjek === kodSubjek) rekodDisasar = r;
    });
  });
  if (!rekodDisasar) return ralat('Tiada rekod headcount bagi pelajar/subjek/semester ini.');

  const gredSemasaSubjekIni = gredEfektif(rekodDisasar);
  const markahSemasaSubjekIni = markahEfektif(rekodDisasar);
  const pngkSemasa = kiraPNGK(mapGred, Object.values(gredSemasaSemuaSemester).filter(Boolean));

  const kunciSasaran = semester + '|' + kodSubjek;
  const gredSelepasSimulasi = Object.assign({}, gredSemasaSemuaSemester);
  gredSelepasSimulasi[kunciSasaran] = gredBaru;
  const pngkSimulasi = kiraPNGK(mapGred, Object.values(gredSelepasSimulasi).filter(Boolean));

  /* ---- GPS subjek/semester berkenaan (kohort sekelas subjek) ---- */
  const headcountSubjekSemester = bacaSheetSebagaiObjek(sheetHeadcount(semester)).filter(r => r.KodSubjek === kodSubjek);
  const gpsSemasa = kiraGPS(mapGred, headcountSubjekSemester.map(gredEfektif).filter(Boolean));
  const gpsSimulasi = kiraGPS(mapGred, headcountSubjekSemester
    .map(r => r.ID_Pelajar === idPelajar ? gredBaru : gredEfektif(r)).filter(Boolean));

  return jaya({
    simulasi: true,
    label: 'SIMULASI — tidak mengubah data sebenar',
    idPelajar, semester, kodSubjek,
    markahSemasa: markahSemasaSubjekIni, gredSemasa: gredSemasaSubjekIni,
    markahBaru, gredBaru,
    pngkSemasa, pngkSelepasSimulasi: pngkSimulasi,
    perubahanPNGK: (pngkSemasa !== null && pngkSimulasi !== null) ? Number((pngkSimulasi - pngkSemasa).toFixed(2)) : null,
    gpsSemasa, gpsSelepasSimulasi: gpsSimulasi,
    perubahanGPS: (gpsSemasa !== null && gpsSimulasi !== null) ? Number((gpsSimulasi - gpsSemasa).toFixed(2)) : null
  });
}
