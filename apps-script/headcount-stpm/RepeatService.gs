/* =========================================================================
 * RepeatService.gs — MODUL 12 (ULANGAN SEMESTER 1), MODUL 13 (ULANGAN SEMESTER 2)
 * Struktur sama untuk kedua semester: ASAL -> INTERVENSI -> ULANGAN.
 * ========================================================================= */

const HEADER_REPEAT = ['ID_Pelajar', 'KodSubjek', 'TahunSTPM', 'KeputusanAsal', 'SasaranUlangan', 'ID_Intervensi', 'UjianSelepasIntervensi', 'KeputusanUlangan', 'PerubahanGred', 'Status'];

function apiSenaraiUlangan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const mapGred = dapatkanGred();
  let senarai = bacaSheetSebagaiObjek(sheetRepeat(p.semester));
  if (p.idPelajar) senarai = senarai.filter(r => r.ID_Pelajar === p.idPelajar);
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) senarai = senarai.filter(r => sesi.skopSubjek.includes(r.KodSubjek));

  const hasil = senarai.map(r => {
    const asal = nilaiGred(mapGred, r.KeputusanAsal);
    const ulangan = nilaiGred(mapGred, r.KeputusanUlangan);
    let statusPerubahan = '';
    if (asal !== null && ulangan !== null) {
      if (ulangan > asal) statusPerubahan = 'BERJAYA_MENINGKAT';
      else if (ulangan === asal) statusPerubahan = 'KEKAL';
      else statusPerubahan = 'MENURUN';
      if (ulangan !== null && mapGred[String(r.KeputusanUlangan).toUpperCase()] && !mapGred[String(r.KeputusanUlangan).toUpperCase()].lulus) {
        statusPerubahan = 'MASIH_GAGAL';
      }
    }
    return Object.assign({}, r, { statusPerubahan });
  });

  return jaya({ senarai: hasil });
}

function apiSimpanUlangan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH.concat([ROLE_GURU]));
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!idPelajar || !kodSubjek || !tahunSTPM) return ralat('ID Pelajar, Kod Subjek dan Tahun STPM wajib diisi.');
  if (!cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar)) return ralat('Pelajar tidak dijumpai.');

  const namaSheet = sheetRepeat(p.semester);
  const sediaAda = bacaSheetSebagaiObjek(namaSheet).find(r => r.ID_Pelajar === idPelajar && r.KodSubjek === kodSubjek && String(r.TahunSTPM) === tahunSTPM);

  const objek = {
    ID_Pelajar: idPelajar,
    KodSubjek: kodSubjek,
    TahunSTPM: tahunSTPM,
    KeputusanAsal: String(p.keputusanAsal !== undefined ? p.keputusanAsal : (sediaAda ? sediaAda.KeputusanAsal : '')).trim(),
    SasaranUlangan: String(p.sasaranUlangan !== undefined ? p.sasaranUlangan : (sediaAda ? sediaAda.SasaranUlangan : '')).trim(),
    ID_Intervensi: String(p.idIntervensi !== undefined ? p.idIntervensi : (sediaAda ? sediaAda.ID_Intervensi : '')).trim(),
    UjianSelepasIntervensi: String(p.ujianSelepasIntervensi !== undefined ? p.ujianSelepasIntervensi : (sediaAda ? sediaAda.UjianSelepasIntervensi : '')).trim(),
    KeputusanUlangan: String(p.keputusanUlangan !== undefined ? p.keputusanUlangan : (sediaAda ? sediaAda.KeputusanUlangan : '')).trim(),
    PerubahanGred: '',
    Status: String(p.status !== undefined ? p.status : (sediaAda ? sediaAda.Status : 'DALAM_TINDAKAN')).trim()
  };
  objek.PerubahanGred = objek.KeputusanAsal && objek.KeputusanUlangan ? (objek.KeputusanAsal + ' -> ' + objek.KeputusanUlangan) : '';

  if (sediaAda) {
    kemaskiniBaris(namaSheet, sediaAda.__row, objek, HEADER_REPEAT);
    catatAudit(sesi, 'KEMASKINI', 'ULANGAN_' + p.semester, idPelajar + '-' + kodSubjek, JSON.stringify(sediaAda), JSON.stringify(objek), '');
  } else {
    tambahBaris(namaSheet, objek, HEADER_REPEAT);
    catatAudit(sesi, 'TAMBAH', 'ULANGAN_' + p.semester, idPelajar + '-' + kodSubjek, '', JSON.stringify(objek), '');
  }
  return jaya({});
}
