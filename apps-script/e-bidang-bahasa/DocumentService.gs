/* =========================================================================
 * DocumentService.gs — Fail Panitia (MODUL TERAS): kategori dokumen,
 * senarai/muat naik/kemaskini/padam dokumen, dan checklist kelengkapan
 * fail bagi setiap panitia (kategori Wajib='YA' mesti ada sekurang-kurangnya
 * satu dokumen semasa).
 * ========================================================================= */

const HEADER_KATEGORI_DOKUMEN = ['KodKategori', 'NamaKategori', 'Keterangan', 'Wajib'];
const HEADER_DOKUMEN = ['IDDokumen', 'Panitia', 'KodKategori', 'NamaDokumen', 'TarikhDokumen',
  'FailUrl', 'FailId', 'DimuatNaikOleh', 'TarikhMuatNaik', 'Catatan', 'Status'];

function apiSenaraiKategoriDokumen(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const senarai = bacaSheetSebagaiObjek(SHEET_KATEGORI_DOKUMEN).map(k => ({
    kodKategori: k.KodKategori, namaKategori: k.NamaKategori, keterangan: k.Keterangan, wajib: k.Wajib
  }));
  return jaya({ senarai });
}

function apiSenaraiDokumen(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const kategori = bacaSheetSebagaiObjek(SHEET_KATEGORI_DOKUMEN);
  const senarai = bacaSheetSebagaiObjek(SHEET_DOKUMEN)
    .filter(d => String(d.Panitia) === String(p.panitia) && String(d.Status).toUpperCase() !== 'DIPADAM')
    .map(d => {
      const k = kategori.find(kt => kt.KodKategori === d.KodKategori);
      return {
        idDokumen: d.IDDokumen, panitia: d.Panitia, kodKategori: d.KodKategori,
        namaKategori: k ? k.NamaKategori : d.KodKategori, namaDokumen: d.NamaDokumen,
        tarikhDokumen: d.TarikhDokumen, failUrl: d.FailUrl, dimuatNaikOleh: d.DimuatNaikOleh,
        tarikhMuatNaik: d.TarikhMuatNaik, catatan: d.Catatan, __row: d.__row
      };
    })
    .sort((a, b) => String(b.tarikhDokumen).localeCompare(String(a.tarikhDokumen)));
  return jaya({ senarai });
}

/* Checklist kelengkapan fail satu panitia — teras keperluan "kemas & terperinci". */
function apiChecklistDokumen(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const dokumen = bacaSheetSebagaiObjek(SHEET_DOKUMEN)
    .filter(d => String(d.Panitia) === String(p.panitia) && String(d.Status).toUpperCase() !== 'DIPADAM');

  const checklist = bacaSheetSebagaiObjek(SHEET_KATEGORI_DOKUMEN).map(k => {
    const bilangan = dokumen.filter(d => d.KodKategori === k.KodKategori).length;
    return {
      kodKategori: k.KodKategori, namaKategori: k.NamaKategori, wajib: k.Wajib,
      bilangan, lengkap: k.Wajib === 'YA' ? bilangan > 0 : true
    };
  });

  const wajibJumlah = checklist.filter(c => c.wajib === 'YA').length;
  const wajibLengkap = checklist.filter(c => c.wajib === 'YA' && c.lengkap).length;
  return jaya({ checklist, peratusLengkap: wajibJumlah ? Math.round((wajibLengkap / wajibJumlah) * 100) : 100 });
}

function apiMuatNaikDokumen(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const namaDokumen = String(p.namaDokumen || '').trim();
  const kategori = cariBarisMengikutId(SHEET_KATEGORI_DOKUMEN, 'KodKategori', p.kodKategori);
  if (!namaDokumen || !kategori) return ralat('Sila lengkapkan nama dokumen dan kategori.');
  if (!p.namaFail || !p.dataBase64) return ralat('Sila pilih fail untuk dimuat naik.');

  const failDrive = muatNaikFailKeDrive(p.panitia, kategori.NamaKategori, p.namaFail, p.dataBase64, p.jenisMime);
  const objek = {
    IDDokumen: janaId('DOK'),
    Panitia: p.panitia,
    KodKategori: kategori.KodKategori,
    NamaDokumen: namaDokumen,
    TarikhDokumen: p.tarikhDokumen || formatTarikh(new Date()),
    FailUrl: failDrive.url,
    FailId: failDrive.fileId,
    DimuatNaikOleh: sesi.nama,
    TarikhMuatNaik: formatTarikhMasa(new Date()),
    Catatan: String(p.catatan || '').trim(),
    Status: 'AKTIF'
  };
  tambahBaris(SHEET_DOKUMEN, objek, HEADER_DOKUMEN);
  catatAudit(sesi, 'MUAT_NAIK', 'DOKUMEN', objek.IDDokumen, 'Muat naik dokumen: ' + namaDokumen + ' (' + p.panitia + ')');
  return jaya({ idDokumen: objek.IDDokumen });
}

function apiKemaskiniDokumen(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const dokumen = cariBarisMengikutId(SHEET_DOKUMEN, 'IDDokumen', p.idDokumen);
  if (!dokumen) return ralat('Dokumen tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, dokumen.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk dokumen ini.');

  dokumen.NamaDokumen = String(p.namaDokumen || dokumen.NamaDokumen).trim();
  dokumen.TarikhDokumen = p.tarikhDokumen || dokumen.TarikhDokumen;
  dokumen.Catatan = p.catatan !== undefined ? String(p.catatan).trim() : dokumen.Catatan;

  if (p.namaFail && p.dataBase64) {
    padamFailDrive(dokumen.FailId);
    const kategori = cariBarisMengikutId(SHEET_KATEGORI_DOKUMEN, 'KodKategori', dokumen.KodKategori);
    const failDrive = muatNaikFailKeDrive(dokumen.Panitia, kategori ? kategori.NamaKategori : dokumen.KodKategori, p.namaFail, p.dataBase64, p.jenisMime);
    dokumen.FailUrl = failDrive.url;
    dokumen.FailId = failDrive.fileId;
  }

  kemaskiniBaris(SHEET_DOKUMEN, dokumen.__row, dokumen, HEADER_DOKUMEN);
  catatAudit(sesi, 'KEMASKINI', 'DOKUMEN', dokumen.IDDokumen, 'Kemaskini dokumen: ' + dokumen.NamaDokumen);
  return jaya({});
}

function apiPadamDokumen(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const dokumen = cariBarisMengikutId(SHEET_DOKUMEN, 'IDDokumen', p.idDokumen);
  if (!dokumen) return ralat('Dokumen tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, dokumen.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk dokumen ini.');

  padamFailDrive(dokumen.FailId);
  dokumen.Status = 'DIPADAM';
  kemaskiniBaris(SHEET_DOKUMEN, dokumen.__row, dokumen, HEADER_DOKUMEN);
  catatAudit(sesi, 'PADAM', 'DOKUMEN', dokumen.IDDokumen, 'Padam dokumen: ' + dokumen.NamaDokumen);
  return jaya({});
}
