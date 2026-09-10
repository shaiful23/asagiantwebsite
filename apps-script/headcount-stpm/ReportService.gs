/* =========================================================================
 * ReportService.gs — MODUL 22: LAPORAN
 * Menjana data untuk dipaparkan/dieksport (CSV) di klien. Backend hanya
 * menyediakan data yang sudah dianalisis; format/paparan di frontend.
 * ========================================================================= */

const JENIS_LAPORAN = [
  'HEADCOUNT_S1', 'HEADCOUNT_S2', 'HEADCOUNT_S3',
  'PELAJAR_BERISIKO', 'INTERVENSI', 'ULANGAN_S1', 'ULANGAN_S2',
  'PRESTASI_SUBJEK', 'GPS'
];

function apiJanaLaporan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const jenis = String(p.jenis || '').trim();
  if (JENIS_LAPORAN.indexOf(jenis) === -1) return ralat('Jenis laporan tidak dikenali: ' + jenis);

  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  let baris = [];

  if (jenis.indexOf('HEADCOUNT_') === 0) {
    const semester = jenis.split('_')[1];
    baris = bacaSheetSebagaiObjek(sheetHeadcount(semester)).map(r => {
      const a = analisisRekodHeadcount(mapGred, konfig, r);
      const pelajar = pelajarMap[r.ID_Pelajar] || {};
      return {
        IDPelajar: r.ID_Pelajar, Nama: pelajar.Nama || '', Kelas: pelajar.Kelas || '', Subjek: r.KodSubjek,
        TOV: formatMarkahGred(r.TOV_Markah, r.TOV_Gred), OTR1: formatMarkahGred(r.OTR1_Markah, r.OTR1_Gred),
        AR1: formatMarkahGred(r.AR1_Markah, r.AR1_Gred), OTR2: formatMarkahGred(r.OTR2_Markah, r.OTR2_Gred),
        AR2: formatMarkahGred(r.AR2_Markah, r.AR2_Gred), ETR: formatMarkahGred(r.ETR_Markah, r.ETR_Gred),
        SEBENAR: formatMarkahGred(r.SEBENAR_Markah, r.SEBENAR_Gred),
        StatusGapETR: a.statusGapETR, Trend: a.trend, Risiko: a.risiko
      };
    });
  } else if (jenis === 'PELAJAR_BERISIKO') {
    ['S1', 'S2', 'S3'].forEach(sem => {
      bacaSheetSebagaiObjek(sheetHeadcount(sem)).forEach(r => {
        const a = analisisRekodHeadcount(mapGred, konfig, r);
        if (a.risiko === RISIKO_BERISIKO) {
          const pelajar = pelajarMap[r.ID_Pelajar] || {};
          baris.push({
            Semester: sem, IDPelajar: r.ID_Pelajar, Nama: pelajar.Nama || '', Kelas: pelajar.Kelas || '', Subjek: r.KodSubjek,
            ETR: formatMarkahGred(r.ETR_Markah, r.ETR_Gred), Sebenar: formatMarkahGred(markahEfektif(r), gredEfektif(r)), Trend: a.trend
          });
        }
      });
    });
  } else if (jenis === 'INTERVENSI') {
    baris = bacaSheetSebagaiObjek(SHEET_INTERVENTIONS).map(i => {
      const pelajar = pelajarMap[i.ID_Pelajar] || {};
      return Object.assign({ Nama: pelajar.Nama || '', Kelas: pelajar.Kelas || '' }, i, { __row: undefined });
    });
  } else if (jenis === 'ULANGAN_S1' || jenis === 'ULANGAN_S2') {
    const sem = jenis.split('_')[1];
    baris = bacaSheetSebagaiObjek(sheetRepeat(sem)).map(r => {
      const pelajar = pelajarMap[r.ID_Pelajar] || {};
      return Object.assign({ Nama: pelajar.Nama || '', Kelas: pelajar.Kelas || '' }, r, { __row: undefined });
    });
  } else if (jenis === 'PRESTASI_SUBJEK' || jenis === 'GPS') {
    const semester = String(p.semester || 'S1').trim();
    const rekod = bacaSheetSebagaiObjek(sheetHeadcount(semester));
    const mengikutSubjek = {};
    rekod.forEach(r => {
      const gred = gredEfektif(r);
      if (!mengikutSubjek[r.KodSubjek]) mengikutSubjek[r.KodSubjek] = [];
      if (gred) mengikutSubjek[r.KodSubjek].push(gred);
    });
    baris = Object.keys(mengikutSubjek).map(kod => {
      const gredSenarai = mengikutSubjek[kod];
      const lulus = gredSenarai.filter(g => mapGred[String(g).toUpperCase()] && mapGred[String(g).toUpperCase()].lulus).length;
      return {
        Subjek: kod, BilanganCalon: gredSenarai.length,
        GPS: kiraGPS(mapGred, gredSenarai),
        PeratusLulus: gredSenarai.length ? Number(((lulus / gredSenarai.length) * 100).toFixed(1)) : null
      };
    });
  }

  return jaya({ jenis, baris });
}
