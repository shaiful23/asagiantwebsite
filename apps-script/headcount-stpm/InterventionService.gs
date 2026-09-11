/* =========================================================================
 * InterventionService.gs — MODUL 10 (INTERVENSI), MODUL 11 (IMPAK INTERVENSI)
 * ========================================================================= */

const HEADER_INTERVENTIONS = ['ID_Intervensi', 'ID_Pelajar', 'KodSubjek', 'Semester', 'Tarikh', 'JenisIntervensi', 'PuncaMasalah', 'Objektif', 'GuruPIC', 'Tempoh', 'Status', 'Catatan', 'KeputusanSelepasIntervensi'];

/* Peta ID_Pelajar -> TahunSTPM — INTERVENTIONS/REPEAT tidak simpan TahunSTPM
   terus, jadi batch (cth. calon 2026 vs 2027) ditentukan menerusi pelajar. */
function petaTahunSTPMPelajar() {
  const peta = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { peta[s.ID_Pelajar] = String(s.TahunSTPM); });
  return peta;
}

function apiSenaraiIntervensi(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  let senarai = bacaSheetSebagaiObjek(SHEET_INTERVENTIONS);
  if (p.idPelajar) senarai = senarai.filter(i => i.ID_Pelajar === p.idPelajar);
  if (p.semester) senarai = senarai.filter(i => i.Semester === p.semester);
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) senarai = senarai.filter(i => sesi.skopSubjek.includes(String(i.KodSubjek)));
  if (p.tahunSTPM) {
    const petaTahun = petaTahunSTPMPelajar();
    senarai = senarai.filter(i => petaTahun[i.ID_Pelajar] === String(p.tahunSTPM));
  }

  return jaya({ senarai, jenisIntervensiPilihan: jenisIntervensiLalai() });
}

function apiSimpanIntervensi(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_GURU, ROLE_KETUA_PANITIA]));
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const semester = String(p.semester || '').trim();
  if (!idPelajar || !kodSubjek || !semester) return ralat('ID Pelajar, Kod Subjek dan Semester wajib diisi.');
  if (!cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar)) return ralat('Pelajar tidak dijumpai.');

  let idIntervensi = String(p.idIntervensi || '').trim();
  const sediaAda = idIntervensi ? cariBarisMengikutId(SHEET_INTERVENTIONS, 'ID_Intervensi', idIntervensi) : null;
  idIntervensi = idIntervensi || janaId('INT');

  const objek = {
    ID_Intervensi: idIntervensi,
    ID_Pelajar: idPelajar,
    KodSubjek: kodSubjek,
    Semester: semester,
    Tarikh: String(p.tarikh || formatTarikh(new Date())).trim(),
    JenisIntervensi: String(p.jenisIntervensi || '').trim(),
    PuncaMasalah: String(p.puncaMasalah || '').trim(),
    Objektif: String(p.objektif || '').trim(),
    GuruPIC: String(p.guruPIC || sesi.nama).trim(),
    Tempoh: String(p.tempoh || '').trim(),
    Status: String(p.status || 'DIJALANKAN').trim(),
    Catatan: String(p.catatan || '').trim(),
    KeputusanSelepasIntervensi: String(p.keputusanSelepasIntervensi || (sediaAda ? sediaAda.KeputusanSelepasIntervensi : '')).trim()
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_INTERVENTIONS, sediaAda.__row, objek, HEADER_INTERVENTIONS);
    catatAudit(sesi, 'KEMASKINI', 'INTERVENSI', idIntervensi, JSON.stringify(sediaAda), JSON.stringify(objek), '');
  } else {
    tambahBaris(SHEET_INTERVENTIONS, objek, HEADER_INTERVENTIONS);
    catatAudit(sesi, 'TAMBAH', 'INTERVENSI', idIntervensi, '', JSON.stringify(objek), 'Intervensi baharu untuk ' + idPelajar);
  }
  return jaya({ idIntervensi });
}

/* MODUL 11 — Impak intervensi: bandingkan AR1 -> AR2 (headcount semester berkaitan)
   bagi semua pelajar yang menerima intervensi pada semester tersebut. */
function apiImpakIntervensi(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_KETUA_PANITIA, ROLE_GURU]));
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || 'S1').trim();
  const mapGred = dapatkanGred();
  let intervensiSenarai = bacaSheetSebagaiObjek(SHEET_INTERVENTIONS).filter(i => i.Semester === semester);
  if (p.tahunSTPM) {
    const petaTahun = petaTahunSTPMPelajar();
    intervensiSenarai = intervensiSenarai.filter(i => petaTahun[i.ID_Pelajar] === String(p.tahunSTPM));
  }
  const headcountSenarai = bacaSheetSebagaiObjek(sheetHeadcount(semester));

  let pulih = 0, masihBerisiko = 0;
  const butiran = intervensiSenarai.map(i => {
    const hc = headcountSenarai.find(h => h.ID_Pelajar === i.ID_Pelajar && String(h.KodSubjek) === String(i.KodSubjek));
    if (!hc) return Object.assign({}, i, { status: 'TIADA_DATA_HEADCOUNT' });

    const ar1 = nilaiGred(mapGred, hc.AR1_Gred);
    const ar2 = nilaiGred(mapGred, hc.AR2_Gred);
    let status = 'BELUM_LENGKAP';
    if (ar1 !== null && ar2 !== null) {
      status = ar2 > ar1 ? 'BERJAYA_MENINGKAT' : (ar2 === ar1 ? 'KEKAL' : 'MASIH_MENURUN');
      if (status === 'BERJAYA_MENINGKAT') pulih++; else masihBerisiko++;
    }
    return Object.assign({}, i, {
      AR1_Markah: hc.AR1_Markah, AR1_Gred: hc.AR1_Gred,
      AR2_Markah: hc.AR2_Markah, AR2_Gred: hc.AR2_Gred, status
    });
  });

  const jumlahDinilai = pulih + masihBerisiko;
  const peratusKeberkesanan = jumlahDinilai ? Number(((pulih / jumlahDinilai) * 100).toFixed(1)) : null;

  return jaya({ butiran, bilanganPulih: pulih, bilanganMasihBerisiko: masihBerisiko, peratusKeberkesanan });
}
