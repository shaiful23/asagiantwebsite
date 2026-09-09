/* =========================================================================
 * AnalysisService.gs — MODUL 7 (GAP), MODUL 8 (TREND), MODUL 9 (RISIKO),
 * MODUL 18 (GPS/PNGK). Backend ialah SATU-SATUNYA sumber pengiraan
 * (MODUL 43) — frontend hanya memaparkan hasil. Tiada nilai di-hard-code;
 * semua threshold/nilai gred diambil dari Sheet GRADES & CONFIG.
 * ========================================================================= */

function dapatkanKonfig() {
  const rekod = bacaSheetSebagaiObjek(SHEET_CONFIG);
  const map = {};
  rekod.forEach(r => { map[r.Key] = r.Value; });
  return map;
}

function dapatkanGred() {
  // { 'A': {nilai: 4.00, lulus: true}, ... }
  const rekod = bacaSheetSebagaiObjek(SHEET_GRADES);
  const map = {};
  rekod.forEach(r => {
    map[String(r.Gred).trim().toUpperCase()] = {
      nilai: Number(r.NilaiGred),
      lulus: String(r.Lulus).toUpperCase() === 'YA'
    };
  });
  return map;
}

function nilaiGred(mapGred, gred) {
  if (!gred) return null;
  const g = mapGred[String(gred).trim().toUpperCase()];
  return g ? g.nilai : null;
}

/* MODUL 7 — GAP: bandingkan sasaran vs sebenar (dalam nilai gred), pulangkan {gap, status}. */
function kiraGap(mapGred, konfig, sasaranGred, sebenarGred) {
  const sasaran = nilaiGred(mapGred, sasaranGred);
  const sebenar = nilaiGred(mapGred, sebenarGred);
  if (sasaran === null || sebenar === null) return { gap: null, status: '' };

  const gap = Number((sebenar - sasaran).toFixed(2));
  const thresholdKuning = Number(konfig.thresholdGapKuning || 0.33);

  let status;
  if (gap >= 0) status = STATUS_HIJAU;
  else if (Math.abs(gap) <= thresholdKuning) status = STATUS_KUNING;
  else status = STATUS_MERAH;

  return { gap, status };
}

/* MODUL 8 — TREND: jujukan gred (contoh AR1,AR2,SEBENAR / rentetan semester). */
function kiraTrend(mapGred, gredJujukan) {
  const nilai = gredJujukan.map(g => nilaiGred(mapGred, g)).filter(n => n !== null);
  if (nilai.length < 2) return TREND_TIDAK_CUKUP_DATA;

  let naik = 0, turun = 0, sama = 0;
  for (let i = 1; i < nilai.length; i++) {
    const beza = nilai[i] - nilai[i - 1];
    if (beza > 0) naik++;
    else if (beza < 0) turun++;
    else sama++;
  }

  if (sama === nilai.length - 1) return TREND_KONSISTEN;
  if (naik > 0 && turun === 0) return TREND_MENINGKAT;
  if (turun > 0 && naik === 0) return TREND_MENURUN;
  return TREND_TIDAK_STABIL;
}

/* MODUL 9 — RISIKO: gabungan status gap ETR vs SEBENAR + trend. Boleh dikonfigurasi ADMIN
   melalui thresholdRisikoPemantauan/thresholdRisikoBerisiko (nilai gred). */
function kiraRisiko(mapGred, konfig, etrGred, sebenarGred, trend) {
  const etr = nilaiGred(mapGred, etrGred);
  const sebenar = nilaiGred(mapGred, sebenarGred);

  if (etr === null || sebenar === null) return RISIKO_PEMANTAUAN;

  const gap = etr - sebenar; // positif = di bawah sasaran
  const ambangPemantauan = Number(konfig.thresholdRisikoPemantauan || 0.33);
  const ambangBerisiko = Number(konfig.thresholdRisikoBerisiko || 0.67);

  if (gap <= 0 && (trend === TREND_MENINGKAT || trend === TREND_KONSISTEN || trend === TREND_TIDAK_CUKUP_DATA)) {
    return RISIKO_SELAMAT;
  }
  if (gap > ambangBerisiko || trend === TREND_MENURUN && gap > 0) {
    return RISIKO_BERISIKO;
  }
  if (gap > ambangPemantauan || trend === TREND_MENURUN) {
    return RISIKO_PEMANTAUAN;
  }
  return RISIKO_SELAMAT;
}

/* Kira satu rekod headcount lengkap: gap1 (AR1 vs OTR1), gap2 (AR2 vs OTR2),
   gapETR (SEBENAR vs ETR), trend, risiko. Dipanggil oleh HeadcountService. */
function analisisRekodHeadcount(mapGred, konfig, rekod) {
  const gap1 = kiraGap(mapGred, konfig, rekod.OTR1, rekod.AR1);
  const gap2 = kiraGap(mapGred, konfig, rekod.OTR2, rekod.AR2);
  const gapETR = kiraGap(mapGred, konfig, rekod.ETR, rekod.SEBENAR);
  const trend = kiraTrend(mapGred, [rekod.TOV, rekod.AR1, rekod.AR2, rekod.SEBENAR].filter(Boolean));
  const risiko = kiraRisiko(mapGred, konfig, rekod.ETR, rekod.SEBENAR || rekod.AR2 || rekod.AR1, trend);

  return {
    gap1: gap1.gap, statusGap1: gap1.status,
    gap2: gap2.gap, statusGap2: gap2.status,
    gapETR: gapETR.gap, statusGapETR: gapETR.status,
    trend, risiko
  };
}

/* MODUL 18 — PNGK: purata nilai gred merentasi semua subjek seorang pelajar. */
function kiraPNGK(mapGred, gredSenarai) {
  const nilai = gredSenarai.map(g => nilaiGred(mapGred, g)).filter(n => n !== null);
  if (!nilai.length) return null;
  const jumlah = nilai.reduce((a, b) => a + b, 0);
  return Number((jumlah / nilai.length).toFixed(2));
}

/* MODUL 18 — GPS: purata nilai gred merentasi semua pelajar bagi satu subjek/kohort. */
function kiraGPS(mapGred, gredSenarai) {
  return kiraPNGK(mapGred, gredSenarai); // formula sama (purata nilai gred), skop berbeza
}
