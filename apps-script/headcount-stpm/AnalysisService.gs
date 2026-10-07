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

/* BLD (Jadual Penentuan Gred) — KHUSUS SETIAP SUBJEK x SEMESTER (S1/S2/S3
   boleh ada julat markah berbeza bagi subjek yang sama). Pulangkan
   { 'KodSubjek|Semester': [{gred, min, max}, ...tersusun ikut min menaik] }. */
function kunciBLD(kodSubjek, semester) {
  return String(kodSubjek).trim() + '|' + String(semester).trim();
}

function dapatkanBLD() {
  const rekod = bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES);
  const map = {};
  rekod.forEach(r => {
    const kunci = kunciBLD(r.KodSubjek, r.Semester);
    if (!map[kunci]) map[kunci] = [];
    map[kunci].push({ gred: String(r.Gred).trim().toUpperCase(), min: Number(r.MarkahMin), max: Number(r.MarkahMax) });
  });
  Object.keys(map).forEach(k => map[k].sort((a, b) => a.min - b.min));
  return map;
}

/* Terjemah Markah -> Gred bagi SATU subjek PADA SATU semester, menggunakan
   BLD subjek+semester itu sahaja (bukan skema global) — rujuk permintaan:
   "BLD untuk setiap semester (S1, S2, S3) adalah berbeza". */
function gredDaripadaMarkah(bldMap, kodSubjek, semester, markah) {
  if (markah === '' || markah === null || markah === undefined || isNaN(Number(markah))) return '';
  const senarai = bldMap[kunciBLD(kodSubjek, semester)];
  if (!senarai || !senarai.length) return ''; // BLD subjek+semester ini belum ditetapkan
  const m = Number(markah);
  const padanan = senarai.find(b => m >= b.min && m <= b.max);
  return padanan ? padanan.gred : '';
}

/* Cari gred N tingkat ke bawah drpd satu gred asal, mengikut senarai Sheet GRADES
   tersusun MENURUN ikut NilaiGred — data-driven, TIADA huruf gred di-hard-code
   (MODUL 43). Dipakai untuk auto-isi TOV/OTR daripada ETR (rujuk apiSimpanETR). */
function gredTurun(mapGred, gredAsal, bilanganTurun) {
  const senarai = Object.keys(mapGred).sort((a, b) => mapGred[b].nilai - mapGred[a].nilai);
  const indeks = senarai.indexOf(String(gredAsal).trim().toUpperCase());
  if (indeks === -1) return '';
  const indeksBaru = Math.min(indeks + bilanganTurun, senarai.length - 1);
  return senarai[indeksBaru];
}

/* Kenal pasti medan (TOV/OTR1/AR1/OTR2/AR2/ETR/SEBENAR) paling terkini yang ada
   nilai — dipakai sebagai "keputusan semasa efektif" merentasi Dashboard/Laporan. */
function medanEfektif(rekod) {
  if (rekod.SEBENAR_Gred) return 'SEBENAR';
  if (rekod.AR2_Gred) return 'AR2';
  if (rekod.AR1_Gred) return 'AR1';
  if (rekod.TOV_Gred) return 'TOV';
  return null;
}
function gredEfektif(rekod) {
  const m = medanEfektif(rekod);
  return m ? rekod[m + '_Gred'] : '';
}
function markahEfektif(rekod) {
  const m = medanEfektif(rekod);
  return m && rekod[m + '_Markah'] !== '' && rekod[m + '_Markah'] !== undefined ? rekod[m + '_Markah'] : '';
}

/* Sasaran efektif (ETR diutamakan, jatuh balik ke OTR2/OTR1) — untuk paparan "sasaran semasa". */
function medanSasaranEfektif(rekod) {
  if (rekod.ETR_Gred) return 'ETR';
  if (rekod.OTR2_Gred) return 'OTR2';
  if (rekod.OTR1_Gred) return 'OTR1';
  return null;
}
function gredSasaranEfektif(rekod) {
  const m = medanSasaranEfektif(rekod);
  return m ? rekod[m + '_Gred'] : '';
}
function markahSasaranEfektif(rekod) {
  const m = medanSasaranEfektif(rekod);
  return m && rekod[m + '_Markah'] !== '' ? rekod[m + '_Markah'] : '';
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
  const gap1 = kiraGap(mapGred, konfig, rekod.OTR1_Gred, rekod.AR1_Gred);
  const gap2 = kiraGap(mapGred, konfig, rekod.OTR2_Gred, rekod.AR2_Gred);
  const gapETR = kiraGap(mapGred, konfig, rekod.ETR_Gred, rekod.SEBENAR_Gred);
  const trend = kiraTrend(mapGred, [rekod.TOV_Gred, rekod.AR1_Gred, rekod.AR2_Gred, rekod.SEBENAR_Gred].filter(Boolean));
  const risiko = kiraRisiko(mapGred, konfig, rekod.ETR_Gred, gredEfektif(rekod), trend);

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
