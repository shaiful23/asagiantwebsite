/* =========================================================================
 * MeetingService.gs — Mesyuarat Panitia: minit, kehadiran & tindakan susulan.
 * Lihat: sesiapa dalam panitia berkenaan (+ akses penuh). Urus (cipta/
 * kemaskini/padam): KETUA_PANITIA panitia berkenaan + ADMIN/KETUA_BIDANG.
 * ========================================================================= */

const HEADER_MESYUARAT = ['IDMesyuarat', 'Panitia', 'TarikhMesyuarat', 'Tajuk', 'Agenda',
  'MinitUrl', 'MinitFailId', 'DiciptaOleh', 'TarikhCipta', 'EventIdKalendar'];
const HEADER_KEHADIRAN_MESYUARAT = ['IDKehadiran', 'IDMesyuarat', 'NamaAhli', 'Status', 'Catatan'];
const HEADER_TINDAKAN_SUSULAN = ['IDTindakan', 'IDMesyuarat', 'Panitia', 'Perkara',
  'TanggungjawabNoKP', 'TarikhAkhir', 'Status', 'CatatanKemaskini'];


function apiSenaraiMesyuarat(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_MESYUARAT)
    .filter(m => String(m.Panitia) === String(p.panitia))
    .sort((a, b) => String(b.TarikhMesyuarat).localeCompare(String(a.TarikhMesyuarat)));
  return jaya({ senarai });
}

function apiSimpanMesyuarat(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const tajuk = String(p.tajuk || '').trim();
  const tarikh = String(p.tarikhMesyuarat || '').trim();
  if (!tajuk || !tarikh) return ralat('Sila lengkapkan tajuk dan tarikh mesyuarat.');

  const sediaAda = p.idMesyuarat ? cariBarisMengikutId(SHEET_MESYUARAT, 'IDMesyuarat', p.idMesyuarat) : null;
  const objek = {
    IDMesyuarat: sediaAda ? sediaAda.IDMesyuarat : janaId('MSY'),
    Panitia: p.panitia,
    TarikhMesyuarat: tarikh,
    Tajuk: tajuk,
    Agenda: String(p.agenda || '').trim(),
    MinitUrl: sediaAda ? sediaAda.MinitUrl : '',
    MinitFailId: sediaAda ? sediaAda.MinitFailId : '',
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama,
    TarikhCipta: sediaAda ? sediaAda.TarikhCipta : formatTarikhMasa(new Date()),
    EventIdKalendar: sediaAda ? sediaAda.EventIdKalendar : ''
  };

  if (p.namaFail && p.dataBase64) {
    if (sediaAda && sediaAda.MinitFailId) padamFailDrive(sediaAda.MinitFailId);
    const failDrive = muatNaikFailKeDrive(p.panitia, 'Minit Mesyuarat Panitia', p.namaFail, p.dataBase64, p.jenisMime);
    objek.MinitUrl = failDrive.url;
    objek.MinitFailId = failDrive.fileId;
  }

  // Kalendar bukan sumber kebenaran — kegagalan (kuota/akses) tidak menghalang mesyuarat disimpan.
  try { objek.EventIdKalendar = segerakEventMesyuarat(objek); } catch (e) { /* kekalkan nilai sediaAda */ }

  if (sediaAda) {
    kemaskiniBaris(SHEET_MESYUARAT, sediaAda.__row, objek, HEADER_MESYUARAT);
    catatAudit(sesi, 'KEMASKINI', 'MESYUARAT', objek.IDMesyuarat, 'Kemaskini mesyuarat: ' + tajuk);
  } else {
    tambahBaris(SHEET_MESYUARAT, objek, HEADER_MESYUARAT);
    catatAudit(sesi, 'TAMBAH', 'MESYUARAT', objek.IDMesyuarat, 'Tambah mesyuarat: ' + tajuk + ' (' + p.panitia + ')');
  }
  return jaya({ idMesyuarat: objek.IDMesyuarat });
}

function apiPadamMesyuarat(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;

  const mesyuarat = cariBarisMengikutId(SHEET_MESYUARAT, 'IDMesyuarat', p.idMesyuarat);
  if (!mesyuarat) return ralat('Mesyuarat tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, mesyuarat.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  padamFailDrive(mesyuarat.MinitFailId);
  try { padamEventKalendar(mesyuarat.EventIdKalendar); } catch (e) { /* abaikan — rekod Sheet tetap dipadam */ }
  padamBaris(SHEET_MESYUARAT, mesyuarat.__row);

  bacaSheetSebagaiObjek(SHEET_KEHADIRAN_MESYUARAT)
    .filter(k => k.IDMesyuarat === mesyuarat.IDMesyuarat)
    .sort((a, b) => b.__row - a.__row)
    .forEach(k => padamBaris(SHEET_KEHADIRAN_MESYUARAT, k.__row));

  catatAudit(sesi, 'PADAM', 'MESYUARAT', mesyuarat.IDMesyuarat, 'Padam mesyuarat: ' + mesyuarat.Tajuk);
  return jaya({});
}

/* ------------------------- KEHADIRAN ------------------------- */
function apiSenaraiKehadiran(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const senarai = bacaSheetSebagaiObjek(SHEET_KEHADIRAN_MESYUARAT).filter(k => k.IDMesyuarat === p.idMesyuarat);
  return jaya({ senarai });
}

/* Simpan kehadiran seluruh mesyuarat dalam SATU panggilan (gantikan rekod sedia ada). */
function apiSimpanKehadiranPukal(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;

  const mesyuarat = cariBarisMengikutId(SHEET_MESYUARAT, 'IDMesyuarat', p.idMesyuarat);
  if (!mesyuarat) return ralat('Mesyuarat tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, mesyuarat.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  bacaSheetSebagaiObjek(SHEET_KEHADIRAN_MESYUARAT)
    .filter(k => k.IDMesyuarat === p.idMesyuarat)
    .sort((a, b) => b.__row - a.__row)
    .forEach(k => padamBaris(SHEET_KEHADIRAN_MESYUARAT, k.__row));

  (p.senarai || []).forEach(item => {
    tambahBaris(SHEET_KEHADIRAN_MESYUARAT, {
      IDKehadiran: janaId('KHD'),
      IDMesyuarat: p.idMesyuarat,
      NamaAhli: String(item.namaAhli || '').trim(),
      Status: String(item.status || 'HADIR').trim(),
      Catatan: String(item.catatan || '').trim()
    }, HEADER_KEHADIRAN_MESYUARAT);
  });

  catatAudit(sesi, 'KEMASKINI', 'KEHADIRAN_MESYUARAT', p.idMesyuarat, 'Simpan kehadiran (' + (p.senarai || []).length + ' ahli)');
  return jaya({});
}

/* ------------------------- TINDAKAN SUSULAN ------------------------- */
function apiSenaraiTindakanSusulan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_TINDAKAN_SUSULAN)
    .filter(t => String(t.Panitia) === String(p.panitia))
    .sort((a, b) => String(a.TarikhAkhir).localeCompare(String(b.TarikhAkhir)));
  return jaya({ senarai });
}

function apiSimpanTindakanSusulan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const perkara = String(p.perkara || '').trim();
  if (!perkara) return ralat('Sila isi perkara tindakan.');

  const sediaAda = p.idTindakan ? cariBarisMengikutId(SHEET_TINDAKAN_SUSULAN, 'IDTindakan', p.idTindakan) : null;
  const objek = {
    IDTindakan: sediaAda ? sediaAda.IDTindakan : janaId('TDK'),
    IDMesyuarat: p.idMesyuarat || (sediaAda ? sediaAda.IDMesyuarat : ''),
    Panitia: p.panitia,
    Perkara: perkara,
    TanggungjawabNoKP: String(p.tanggungjawabNoKP || '').trim(),
    TarikhAkhir: p.tarikhAkhir || '',
    Status: sediaAda ? sediaAda.Status : STATUS_BELUM_MULA,
    CatatanKemaskini: sediaAda ? sediaAda.CatatanKemaskini : ''
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_TINDAKAN_SUSULAN, sediaAda.__row, objek, HEADER_TINDAKAN_SUSULAN);
    catatAudit(sesi, 'KEMASKINI', 'TINDAKAN_SUSULAN', objek.IDTindakan, 'Kemaskini tindakan: ' + perkara);
  } else {
    tambahBaris(SHEET_TINDAKAN_SUSULAN, objek, HEADER_TINDAKAN_SUSULAN);
    catatAudit(sesi, 'TAMBAH', 'TINDAKAN_SUSULAN', objek.IDTindakan, 'Tambah tindakan: ' + perkara);
  }
  return jaya({ idTindakan: objek.IDTindakan });
}

/* Kemaskini status sahaja — dibenarkan juga kepada GURU yang ditugaskan (bukan
   sekadar Ketua Panitia/Admin), supaya guru boleh lapor kemajuan tugasan sendiri. */
function apiKemaskiniStatusTindakan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const tindakan = cariBarisMengikutId(SHEET_TINDAKAN_SUSULAN, 'IDTindakan', p.idTindakan);
  if (!tindakan) return ralat('Tindakan tidak dijumpai.');

  const dibenarkan = PERANAN_URUS_PANITIA.indexOf(sesi.peranan) !== -1 || sesi.nokp === tindakan.TanggungjawabNoKP;
  if (!dibenarkan || !wajibAksesPanitia(sesi, tindakan.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk tindakan ini.');

  if (SEMUA_STATUS_TINDAKAN.indexOf(p.status) === -1) return ralat('Status tidak sah.');
  tindakan.Status = p.status;
  tindakan.CatatanKemaskini = String(p.catatanKemaskini || tindakan.CatatanKemaskini || '').trim();
  kemaskiniBaris(SHEET_TINDAKAN_SUSULAN, tindakan.__row, tindakan, HEADER_TINDAKAN_SUSULAN);
  catatAudit(sesi, 'TUKAR_STATUS', 'TINDAKAN_SUSULAN', tindakan.IDTindakan, 'Status ditukar kepada ' + p.status);
  return jaya({});
}

function apiPadamTindakanSusulan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;

  const tindakan = cariBarisMengikutId(SHEET_TINDAKAN_SUSULAN, 'IDTindakan', p.idTindakan);
  if (!tindakan) return ralat('Tindakan tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, tindakan.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  padamBaris(SHEET_TINDAKAN_SUSULAN, tindakan.__row);
  catatAudit(sesi, 'PADAM', 'TINDAKAN_SUSULAN', tindakan.IDTindakan, 'Padam tindakan: ' + tindakan.Perkara);
  return jaya({});
}
