/* =========================================================================
 * AuditService.gs — Log audit tindakan penting (log masuk, ubah data, agihan, ...).
 * ========================================================================= */

function catatAudit(sesi, tindakan, modul, rujukanId, butiran) {
  try {
    const sh = dapatkanSheet(SHEET_AUDIT);
    // tambah terus (tanpa menaikkan versi cache — log audit dibaca terus daripada hujung Sheet)
    sh.appendRow(objekKeBaris({
      Tarikh: sekarangTeks(), NoKP: sesi.nokp, Nama: sesi.nama, Peranan: sesi.peranan,
      Tindakan: tindakan, Modul: modul, RujukanId: rujukanId || '', Butiran: butiran || ''
    }, headerSebenarSheet(sh)));
  } catch (e) { /* log audit tidak boleh menggagalkan tindakan utama */ }
}

/* Penomboran dari rekod terbaharu; hanya baris halaman semasa dibaca daripada Sheet. */
function apiSenaraiAudit(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const saiz = Math.max(10, Math.min(100, Number(p.saiz) || 25));
  const jumlahAwal = Math.max(0, dapatkanSheet(SHEET_AUDIT).getLastRow() - 1);
  const jumlahHalaman = Math.max(1, Math.ceil(jumlahAwal / saiz));
  const halaman = Math.max(1, Math.min(jumlahHalaman, Number(p.halaman) || 1));
  const r = bacaBarisAkhir(SHEET_AUDIT, saiz, (halaman - 1) * saiz);
  const senarai = r.baris.map(x => ({ tarikh: x.Tarikh, nokp: normalKP(x.NoKP), nama: x.Nama, peranan: x.Peranan,
    tindakan: x.Tindakan, modul: x.Modul, rujukan: x.RujukanId, butiran: x.Butiran }));
  return jaya({ senarai, jumlah: r.jumlah, halaman, saiz, jumlahHalaman });
}
