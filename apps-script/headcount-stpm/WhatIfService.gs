/* =========================================================================
 * WhatIfService.gs — MODUL 21: WHAT-IF ANALYSIS
 * Simulasi anggaran perubahan PNGK/GPS sahaja — TIDAK PERNAH menulis ke
 * mana-mana Sheet. Frontend WAJIB label hasil sebagai "SIMULASI" (MODUL 21).
 * ========================================================================= */

function gredEfektif(rekod) {
  return rekod.SEBENAR || rekod.AR2 || rekod.AR1 || rekod.TOV || '';
}

function apiSimulasiWhatIf(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const semester = String(p.semester || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const gredBaru = String(p.gredBaru || '').trim().toUpperCase();
  if (!idPelajar || !semester || !kodSubjek || !gredBaru) return ralat('ID Pelajar, Semester, Kod Subjek dan Gred Hipotesis wajib diisi.');

  const mapGred = dapatkanGred();
  if (!mapGred[gredBaru]) return ralat('Gred "' + gredBaru + '" tidak wujud dalam Sheet GRADES.');
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
    idPelajar, semester, kodSubjek, gredSemasa: gredSemasaSubjekIni, gredBaru,
    pngkSemasa, pngkSelepasSimulasi: pngkSimulasi,
    perubahanPNGK: (pngkSemasa !== null && pngkSimulasi !== null) ? Number((pngkSimulasi - pngkSemasa).toFixed(2)) : null,
    gpsSemasa, gpsSelepasSimulasi: gpsSimulasi,
    perubahanGPS: (gpsSemasa !== null && gpsSimulasi !== null) ? Number((gpsSimulasi - gpsSemasa).toFixed(2)) : null
  });
}
