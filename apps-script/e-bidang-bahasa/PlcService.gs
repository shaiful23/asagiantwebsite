/* =========================================================================
 * PlcService.gs — Professional Learning Community (PLC) panitia & Bidang.
 * Lihat: ahli panitia berkenaan (+ akses penuh; skop Bidang dilihat semua).
 * Tambah: SEMUA guru panitia berkenaan (bukan Ketua Panitia sahaja).
 * Sunting/padam: Ketua Panitia/Admin/Ketua Bidang, ATAU guru yang mencipta.
 * Setiap sesi PLC disegerak dua hala ke Google Calendar (CalendarService.gs).
 * ========================================================================= */

const HEADER_PLC = ['IDPLC', 'Panitia', 'Tajuk', 'JenisPLC', 'Tarikh', 'MasaMula', 'MasaTamat', 'Tempat',
  'Fasilitator', 'Peserta', 'Objektif', 'Refleksi', 'Status', 'FailUrl', 'FailId', 'DiciptaOleh',
  'DiciptaOlehNoKP', 'TarikhCipta', 'EventIdKalendar', 'StatusKalendar', 'HashKalendar'];

/* Pemilik rekod (pencipta) atau pengurus panitia boleh ubah rekod. */
function bolehUrusRekodSendiri(sesi, panitia, noKpPemilik, namaPemilik) {
  if (!wajibAksesPanitia(sesi, panitia)) return false;
  if (PERANAN_URUS_PANITIA.indexOf(sesi.peranan) !== -1) return true;
  if (noKpPemilik) return String(noKpPemilik) === String(sesi.nokp);
  return !!namaPemilik && String(namaPemilik) === String(sesi.nama);
}

function apiSenaraiPLC(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehLihatPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');
  if (!dapatkanSpreadsheet().getSheetByName(SHEET_PLC)) return jaya({ senarai: [], perluMigrasi: true });

  const senarai = bacaSheetSebagaiObjek(SHEET_PLC)
    .filter(r => String(r.Panitia) === String(p.panitia))
    .sort((a, b) => String(b.Tarikh).localeCompare(String(a.Tarikh)))
    .map(r => {
      const o = Object.assign({}, r);
      delete o.HashKalendar;
      o.bolehUrus = bolehUrusRekodSendiri(sesi, r.Panitia, r.DiciptaOlehNoKP, r.DiciptaOleh);
      return o;
    });
  return jaya({ senarai, jenisPLC: SENARAI_JENIS_PLC });
}

function apiSimpanPLC(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!dapatkanSpreadsheet().getSheetByName(SHEET_PLC)) {
    return ralat('Sheet PLC belum wujud. Admin perlu jalankan menu "2. Kemaskini Struktur" dahulu.');
  }
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const tajuk = String(p.tajuk || '').trim();
  const tarikh = String(p.tarikh || '').trim();
  if (!tajuk || !tarikh) return ralat('Sila lengkapkan tajuk dan tarikh PLC.');
  const jenis = SENARAI_JENIS_PLC.indexOf(p.jenisPLC) !== -1 ? p.jenisPLC : 'Lain-lain';
  const masaMula = String(p.masaMula || '').trim();
  const masaTamat = String(p.masaTamat || '').trim();
  if (masaMula && masaTamat && masaTamat <= masaMula) return ralat('Masa tamat mesti selepas masa mula.');

  const sediaAda = p.idPLC ? cariBarisMengikutId(SHEET_PLC, 'IDPLC', p.idPLC) : null;
  if (p.idPLC && !sediaAda) return ralat('Rekod PLC tidak dijumpai.');
  if (sediaAda && !bolehUrusRekodSendiri(sesi, sediaAda.Panitia, sediaAda.DiciptaOlehNoKP, sediaAda.DiciptaOleh)) {
    return ralat('Hanya pencipta rekod atau Ketua Panitia boleh menyunting PLC ini.');
  }

  const objek = Object.assign({}, sediaAda || {}, {
    IDPLC: sediaAda ? sediaAda.IDPLC : janaId('PLC'),
    Panitia: p.panitia,
    Tajuk: tajuk,
    JenisPLC: jenis,
    Tarikh: tarikh,
    MasaMula: masaMula,
    MasaTamat: masaTamat,
    Tempat: String(p.tempat || '').trim(),
    Fasilitator: String(p.fasilitator || '').trim(),
    Peserta: String(p.peserta || '').trim(),
    Objektif: String(p.objektif || '').trim(),
    Refleksi: String(p.refleksi || '').trim(),
    Status: SEMUA_STATUS_PLC.indexOf(p.status) !== -1 ? p.status : (sediaAda ? sediaAda.Status : 'DIRANCANG'),
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama,
    DiciptaOlehNoKP: sediaAda ? sediaAda.DiciptaOlehNoKP : sesi.nokp,
    TarikhCipta: sediaAda ? sediaAda.TarikhCipta : formatTarikhMasa(new Date())
  });

  if (p.namaFail && p.dataBase64) {
    if (sediaAda && sediaAda.FailId) padamFailDrive(sediaAda.FailId);
    const failDrive = muatNaikFailKeDrive(p.panitia, 'PLC', p.namaFail, p.dataBase64, p.jenisMime);
    objek.FailUrl = failDrive.url;
    objek.FailId = failDrive.fileId;
  }

  segerakKalendarSelamat('PLC', objek);

  if (sediaAda) {
    kemaskiniBaris(SHEET_PLC, sediaAda.__row, objek, HEADER_PLC);
    catatAudit(sesi, 'KEMASKINI', 'PLC', objek.IDPLC, 'Kemaskini PLC: ' + tajuk);
  } else {
    tambahBaris(SHEET_PLC, objek, HEADER_PLC);
    catatAudit(sesi, 'TAMBAH', 'PLC', objek.IDPLC, 'Tambah PLC: ' + tajuk + ' (' + p.panitia + ')');
  }
  return jaya({ idPLC: objek.IDPLC, statusKalendar: objek.StatusKalendar || '' });
}

function apiPadamPLC(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const plc = cariBarisMengikutId(SHEET_PLC, 'IDPLC', p.idPLC);
  if (!plc) return ralat('Rekod PLC tidak dijumpai.');
  if (!bolehUrusRekodSendiri(sesi, plc.Panitia, plc.DiciptaOlehNoKP, plc.DiciptaOleh)) {
    return ralat('Hanya pencipta rekod atau Ketua Panitia boleh memadam PLC ini.');
  }

  padamFailDrive(plc.FailId);
  try { padamEventKalendar(plc.EventIdKalendar, plc.IDPLC); } catch (e) { /* rekod Sheet tetap dipadam */ }
  padamBaris(SHEET_PLC, plc.__row);
  catatAudit(sesi, 'PADAM', 'PLC', plc.IDPLC, 'Padam PLC: ' + plc.Tajuk);
  return jaya({});
}
