/* =========================================================================
 * AuditService.gs — Log audit tindakan penting (log masuk, ubah data, arkib, ...).
 * ========================================================================= */

const HEADER_AUDIT = ['Tarikh', 'NoKP', 'Nama', 'Peranan', 'Tindakan', 'Modul', 'RujukanId', 'Butiran'];

function catatAudit(sesi, tindakan, modul, rujukanId, butiran) {
  try {
    tambahBaris(SHEET_AUDIT, {
      Tarikh: sekarangTeks(), NoKP: sesi.nokp, Nama: sesi.nama, Peranan: sesi.peranan,
      Tindakan: tindakan, Modul: modul, RujukanId: rujukanId || '', Butiran: butiran || ''
    });
  } catch (e) { /* log audit tidak boleh menggagalkan tindakan utama */ }
}

function apiSenaraiAudit(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const senarai = bacaSheetSebagaiObjek(SHEET_AUDIT)
    .sort((a, b) => String(b.Tarikh).localeCompare(String(a.Tarikh)))
    .slice(0, 300)
    .map(r => ({ tarikh: r.Tarikh, nokp: normalKP(r.NoKP), nama: r.Nama, peranan: r.Peranan,
      tindakan: r.Tindakan, modul: r.Modul, rujukan: r.RujukanId, butiran: r.Butiran }));
  return jaya({ senarai });
}
