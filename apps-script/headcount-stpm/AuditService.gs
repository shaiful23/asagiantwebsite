/* =========================================================================
 * AuditService.gs — MODUL 27: AUDIT LOG
 * Setiap perubahan penting (TOV, keputusan, pengguna, dsb.) direkodkan di sini.
 * ========================================================================= */

const HEADER_AUDIT_LOG = ['ID', 'Timestamp', 'NoKP', 'NamaPengguna', 'Peranan', 'Tindakan', 'Modul', 'IDRekod', 'NilaiLama', 'NilaiBaharu', 'Butiran'];

function catatAudit(sesi, tindakan, modul, idRekod, nilaiLama, nilaiBaharu, butiran) {
  tambahBaris(SHEET_AUDIT_LOG, {
    ID: janaId('AUD'),
    Timestamp: formatTarikhMasa(new Date()),
    NoKP: sesi ? sesi.nokp : 'SISTEM',
    NamaPengguna: sesi ? sesi.nama : 'SISTEM',
    Peranan: sesi ? sesi.peranan : '',
    Tindakan: tindakan,
    Modul: modul,
    IDRekod: idRekod || '',
    NilaiLama: nilaiLama === undefined || nilaiLama === null ? '' : String(nilaiLama),
    NilaiBaharu: nilaiBaharu === undefined || nilaiBaharu === null ? '' : String(nilaiBaharu),
    Butiran: butiran || ''
  }, HEADER_AUDIT_LOG);
}

function apiSenaraiAudit(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const semua = bacaSheetSebagaiObjek(SHEET_AUDIT_LOG)
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 500);
  return jaya({ senarai: semua });
}
