/* =========================================================================
 * PanitiaService.gs — Pengurusan 5 Panitia tetap Bidang Sains & Matematik
 * (Matematik, Sains, Kimia, Biologi, Fizik). Baris Panitia dicipta semasa
 * "Sediakan Sistem"; service ini hanya menguruskan penetapan Ketua Panitia.
 * ========================================================================= */

const HEADER_PANITIA = ['KodPanitia', 'NamaPanitia', 'KetuaPanitia', 'Status'];

function apiSenaraiPanitia(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS);
  const senarai = bacaSheetSebagaiObjek(SHEET_PANITIA).map(pn => {
    const ketua = pengguna.find(u => String(u.NoKP) === String(pn.KetuaPanitia));
    return {
      kodPanitia: pn.KodPanitia,
      namaPanitia: pn.NamaPanitia,
      ketuaPanitiaNoKP: pn.KetuaPanitia || '',
      ketuaPanitiaNama: ketua ? ketua.NamaPenuh : '',
      status: pn.Status,
      __row: pn.__row
    };
  });
  return jaya({ senarai });
}

function apiTetapkanKetuaPanitia(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const panitia = cariBarisMengikutId(SHEET_PANITIA, 'KodPanitia', String(p.kodPanitia || '').trim());
  if (!panitia) return ralat('Panitia tidak dijumpai.');

  const nokpKetua = String(p.nokpKetua || '').trim();
  if (nokpKetua) {
    const pengguna = cariBarisMengikutId(SHEET_USERS, 'NoKP', nokpKetua);
    if (!pengguna) return ralat('Pengguna (bakal Ketua Panitia) tidak dijumpai.');
    if (String(pengguna.Panitia) !== String(panitia.NamaPanitia)) {
      return ralat('Pengguna ini bukan ahli panitia ' + panitia.NamaPanitia + '. Kemaskini panitia pengguna dahulu.');
    }
    if (pengguna.Peranan !== ROLE_KETUA_PANITIA) {
      pengguna.Peranan = ROLE_KETUA_PANITIA;
      kemaskiniBaris(SHEET_USERS, pengguna.__row, pengguna, HEADER_USERS);
    }
  }

  panitia.KetuaPanitia = nokpKetua;
  kemaskiniBaris(SHEET_PANITIA, panitia.__row, panitia, HEADER_PANITIA);
  catatAudit(sesi, 'KEMASKINI', 'PANITIA', panitia.KodPanitia, 'Tetapkan Ketua Panitia: ' + (nokpKetua || '(kosongkan)'));
  return jaya({});
}
