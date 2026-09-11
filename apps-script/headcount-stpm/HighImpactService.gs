/* =========================================================================
 * HighImpactService.gs — MODUL 20: "HIGH IMPACT STUDENTS"
 * Kenal pasti pelajar yang berpotensi memberi impak besar kepada GPS:
 * hampir capai sasaran (ETR), atau hanya satu subjek kritikal menghalang.
 * Semua pengiraan di backend (MODUL 43) — tiada nilai di-hard-code.
 * ========================================================================= */

function cadanganTindakanHighImpact(risiko, trend, statusGapETR) {
  if (risiko === RISIKO_BERISIKO && trend === TREND_MENURUN) return 'Perlu intervensi segera + pemantauan rapi.';
  if (statusGapETR === STATUS_KUNING && (trend === TREND_MENINGKAT || trend === TREND_KONSISTEN)) return 'Teruskan sokongan sedia ada — hampir capai sasaran.';
  if (statusGapETR === STATUS_KUNING) return 'Beri fokus tambahan sebelum peperiksaan sebenar.';
  return 'Pantau perkembangan seterusnya.';
}

function apiTopHighImpactStudents(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || 'S1').trim();
  const had = Number(p.had) || 20;
  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const thresholdGap = Number(konfig.thresholdHighImpactGap || konfig.thresholdGapKuning || 0.33);

  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  let headcount = bacaSheetSebagaiObjek(sheetHeadcount(semester));
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) headcount = headcount.filter(h => sesi.skopSubjek.includes(String(h.KodSubjek)));
  if (p.tahunSTPM) headcount = headcount.filter(h => String(h.TahunSTPM) === String(p.tahunSTPM));

  // Bilangan subjek berstatus bukan-Hijau bagi setiap pelajar — untuk kenal pasti "hanya satu subjek kritikal".
  const bilTidakHijauSetiapPelajar = {};
  headcount.forEach(h => {
    const a = analisisRekodHeadcount(mapGred, konfig, h);
    if (a.statusGapETR && a.statusGapETR !== STATUS_HIJAU) {
      bilTidakHijauSetiapPelajar[h.ID_Pelajar] = (bilTidakHijauSetiapPelajar[h.ID_Pelajar] || 0) + 1;
    }
  });

  const senaraiGred = Object.keys(mapGred).sort((a, b) => mapGred[a].nilai - mapGred[b].nilai);

  const calon = [];
  headcount.forEach(h => {
    const gredSemasa = gredEfektif(h);
    const gredSasaran = gredSasaranEfektif(h);
    if (!gredSemasa || !gredSasaran) return;

    const nilaiSemasa = nilaiGred(mapGred, gredSemasa);
    const nilaiSasaran = nilaiGred(mapGred, gredSasaran);
    if (nilaiSemasa === null || nilaiSasaran === null) return;

    const gap = Number((nilaiSasaran - nilaiSemasa).toFixed(2));
    if (gap <= 0 || gap > thresholdGap) return; // sudah capai ATAU gap terlalu jauh untuk dikira "hampir naik"

    const a = analisisRekodHeadcount(mapGred, konfig, h);
    const pelajar = pelajarMap[h.ID_Pelajar] || {};
    const gredSeterusnya = senaraiGred.find(g => mapGred[g].nilai > nilaiSemasa);

    calon.push({
      idPelajar: h.ID_Pelajar, namaPelajar: pelajar.Nama || '', kelas: pelajar.Kelas || '',
      kodSubjek: h.KodSubjek, markahSemasa: markahEfektif(h), gredSemasa,
      markahSasaran: markahSasaranEfektif(h), gredSasaran, gap,
      potensiPeningkatan: gredSeterusnya || '', trend: a.trend, risiko: a.risiko,
      hanyaSatuSubjekKritikal: (bilTidakHijauSetiapPelajar[h.ID_Pelajar] || 0) <= 1,
      cadanganTindakan: cadanganTindakanHighImpact(a.risiko, a.trend, a.statusGapETR)
    });
  });

  calon.sort((x, y) => {
    if (x.hanyaSatuSubjekKritikal !== y.hanyaSatuSubjekKritikal) return x.hanyaSatuSubjekKritikal ? -1 : 1;
    return x.gap - y.gap;
  });

  return jaya({ senarai: calon.slice(0, had) });
}
