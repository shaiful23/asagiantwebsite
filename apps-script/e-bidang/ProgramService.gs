/* =========================================================================
 * ProgramService.gs — Program/Aktiviti panitia (termasuk PLC) & Evidens
 * pelaksanaan. Lihat: sesiapa dalam panitia berkenaan (+ akses penuh). Urus:
 * KETUA_PANITIA panitia berkenaan + ADMIN/KETUA_BIDANG.
 * ========================================================================= */

const HEADER_PROGRAM = ['IDProgram', 'Panitia', 'NamaProgram', 'JenisProgram', 'TarikhMula',
  'TarikhTamat', 'Objektif', 'Status', 'DiciptaOleh'];
const HEADER_EVIDENS = ['IDEvidens', 'IDProgram', 'Panitia', 'Keterangan', 'FailUrl', 'FailId',
  'DimuatNaikOleh', 'TarikhMuatNaik'];

const STATUS_PROGRAM_DIRANCANG = 'DIRANCANG';
const STATUS_PROGRAM_BERJALAN = 'BERJALAN';
const STATUS_PROGRAM_SELESAI = 'SELESAI';
const SEMUA_STATUS_PROGRAM = [STATUS_PROGRAM_DIRANCANG, STATUS_PROGRAM_BERJALAN, STATUS_PROGRAM_SELESAI];

function apiSenaraiProgram(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const senarai = bacaSheetSebagaiObjek(SHEET_PROGRAM)
    .filter(prog => String(prog.Panitia) === String(p.panitia) && (!p.jenisProgram || prog.JenisProgram === p.jenisProgram))
    .sort((a, b) => String(b.TarikhMula).localeCompare(String(a.TarikhMula)));
  return jaya({ senarai });
}

function apiSimpanProgram(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;
  if (!wajibAksesPanitia(sesi, p.panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  const namaProgram = String(p.namaProgram || '').trim();
  const jenisProgram = String(p.jenisProgram || JENIS_PROGRAM).trim();
  if (!namaProgram) return ralat('Sila isi nama program.');
  if (SEMUA_JENIS_PROGRAM.indexOf(jenisProgram) === -1) return ralat('Jenis program tidak sah.');

  const sediaAda = p.idProgram ? cariBarisMengikutId(SHEET_PROGRAM, 'IDProgram', p.idProgram) : null;
  const status = p.status && SEMUA_STATUS_PROGRAM.indexOf(p.status) !== -1
    ? p.status : (sediaAda ? sediaAda.Status : STATUS_PROGRAM_DIRANCANG);

  const objek = {
    IDProgram: sediaAda ? sediaAda.IDProgram : janaId('PRG'),
    Panitia: p.panitia,
    NamaProgram: namaProgram,
    JenisProgram: jenisProgram,
    TarikhMula: p.tarikhMula || (sediaAda ? sediaAda.TarikhMula : ''),
    TarikhTamat: p.tarikhTamat || (sediaAda ? sediaAda.TarikhTamat : ''),
    Objektif: String(p.objektif || '').trim(),
    Status: status,
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_PROGRAM, sediaAda.__row, objek, HEADER_PROGRAM);
    catatAudit(sesi, 'KEMASKINI', 'PROGRAM', objek.IDProgram, 'Kemaskini program: ' + namaProgram);
  } else {
    tambahBaris(SHEET_PROGRAM, objek, HEADER_PROGRAM);
    catatAudit(sesi, 'TAMBAH', 'PROGRAM', objek.IDProgram, 'Tambah program: ' + namaProgram + ' (' + p.panitia + ')');
  }
  return jaya({ idProgram: objek.IDProgram });
}

function apiPadamProgram(p) {
  const sesi = wajibPeranan(p.token, PERANAN_URUS_PANITIA);
  if (sesi.success === false) return sesi;

  const program = cariBarisMengikutId(SHEET_PROGRAM, 'IDProgram', p.idProgram);
  if (!program) return ralat('Program tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, program.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  bacaSheetSebagaiObjek(SHEET_EVIDENS)
    .filter(ev => ev.IDProgram === program.IDProgram)
    .sort((a, b) => b.__row - a.__row)
    .forEach(ev => { padamFailDrive(ev.FailId); padamBaris(SHEET_EVIDENS, ev.__row); });

  padamBaris(SHEET_PROGRAM, program.__row);
  catatAudit(sesi, 'PADAM', 'PROGRAM', program.IDProgram, 'Padam program: ' + program.NamaProgram);
  return jaya({});
}

/* ------------------------- EVIDENS ------------------------- */
function apiSenaraiEvidens(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const senarai = bacaSheetSebagaiObjek(SHEET_EVIDENS).filter(ev => ev.IDProgram === p.idProgram);
  return jaya({ senarai });
}

function apiMuatNaikEvidens(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const program = cariBarisMengikutId(SHEET_PROGRAM, 'IDProgram', p.idProgram);
  if (!program) return ralat('Program tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, program.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');
  if (!p.namaFail || !p.dataBase64) return ralat('Sila pilih fail evidens untuk dimuat naik.');

  const failDrive = muatNaikFailKeDrive(program.Panitia, 'Evidens Program - ' + program.NamaProgram, p.namaFail, p.dataBase64, p.jenisMime);
  const objek = {
    IDEvidens: janaId('EVD'),
    IDProgram: program.IDProgram,
    Panitia: program.Panitia,
    Keterangan: String(p.keterangan || '').trim(),
    FailUrl: failDrive.url,
    FailId: failDrive.fileId,
    DimuatNaikOleh: sesi.nama,
    TarikhMuatNaik: formatTarikhMasa(new Date())
  };
  tambahBaris(SHEET_EVIDENS, objek, HEADER_EVIDENS);
  catatAudit(sesi, 'MUAT_NAIK', 'EVIDENS', objek.IDEvidens, 'Muat naik evidens program: ' + program.NamaProgram);
  return jaya({ idEvidens: objek.IDEvidens });
}

function apiPadamEvidens(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const evidens = cariBarisMengikutId(SHEET_EVIDENS, 'IDEvidens', p.idEvidens);
  if (!evidens) return ralat('Evidens tidak dijumpai.');
  if (!wajibAksesPanitia(sesi, evidens.Panitia)) return ralat('Anda tidak mempunyai kebenaran untuk panitia ini.');

  padamFailDrive(evidens.FailId);
  padamBaris(SHEET_EVIDENS, evidens.__row);
  catatAudit(sesi, 'PADAM', 'EVIDENS', evidens.IDEvidens, 'Padam evidens');
  return jaya({});
}
