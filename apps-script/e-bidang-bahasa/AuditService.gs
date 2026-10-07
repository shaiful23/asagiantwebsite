/* =========================================================================
 * AuditService.gs — Log audit setiap tindakan TAMBAH/KEMASKINI/PADAM/LOGIN.
 * Boleh disemak terus dalam Sheet AUDIT_LOG atau melalui apiSenaraiAudit
 * (ADMIN/KETUA_BIDANG sahaja).
 * ========================================================================= */

const HEADER_AUDIT_LOG = ['Tarikh', 'NoKP', 'Nama', 'Peranan', 'Tindakan', 'Modul', 'RujukanId', 'Butiran'];

function catatAudit(sesi, tindakan, modul, rujukanId, butiran) {
  tambahBaris(SHEET_AUDIT_LOG, {
    Tarikh: formatTarikhMasa(new Date()),
    NoKP: sesi.nokp,
    Nama: sesi.nama,
    Peranan: sesi.peranan,
    Tindakan: tindakan,
    Modul: modul,
    RujukanId: rujukanId || '',
    Butiran: butiran || ''
  }, HEADER_AUDIT_LOG);
}

function apiSenaraiAudit(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const senarai = bacaSheetSebagaiObjek(SHEET_AUDIT_LOG)
    .sort((a, b) => String(b.Tarikh).localeCompare(String(a.Tarikh)))
    .slice(0, 300);
  return jaya({ senarai });
}
