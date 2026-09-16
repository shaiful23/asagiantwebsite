/* =========================================================================
 * DashboardService.gs — Ringkasan prestasi fail bagi setiap panitia (dalam
 * skop akses peranan semasa) + senarai tindakan susulan tertunggak sendiri.
 * ========================================================================= */

function apiDashboard(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const panitiaSkop = PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1 ? SENARAI_PANITIA : [sesi.panitia];
  const semuaDokumen = bacaSheetSebagaiObjek(SHEET_DOKUMEN).filter(d => String(d.Status).toUpperCase() !== 'DIPADAM');
  const kategoriWajib = bacaSheetSebagaiObjek(SHEET_KATEGORI_DOKUMEN).filter(k => k.Wajib === 'YA');
  const semuaMesyuarat = bacaSheetSebagaiObjek(SHEET_MESYUARAT);
  const semuaTindakan = bacaSheetSebagaiObjek(SHEET_TINDAKAN_SUSULAN);
  const hariIni = formatTarikh(new Date());

  const ringkasanPanitia = panitiaSkop.map(namaPanitia => {
    const dokumenPanitia = semuaDokumen.filter(d => d.Panitia === namaPanitia);
    const wajibLengkap = kategoriWajib.filter(k => dokumenPanitia.some(d => d.KodKategori === k.KodKategori)).length;
    return {
      panitia: namaPanitia,
      jumlahDokumen: dokumenPanitia.length,
      peratusChecklist: kategoriWajib.length ? Math.round((wajibLengkap / kategoriWajib.length) * 100) : 100,
      mesyuaratAkanDatang: semuaMesyuarat.filter(m => m.Panitia === namaPanitia && String(m.TarikhMesyuarat) >= hariIni).length,
      tindakanTertunggak: semuaTindakan.filter(t => t.Panitia === namaPanitia && t.Status !== STATUS_SELESAI).length
    };
  });

  const tindakanSaya = semuaTindakan
    .filter(t => t.TanggungjawabNoKP === sesi.nokp && t.Status !== STATUS_SELESAI)
    .sort((a, b) => String(a.TarikhAkhir).localeCompare(String(b.TarikhAkhir)))
    .slice(0, 10)
    .map(t => ({ idTindakan: t.IDTindakan, panitia: t.Panitia, perkara: t.Perkara, tarikhAkhir: t.TarikhAkhir, status: t.Status }));

  const jumlahPenggunaAktif = PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1
    ? bacaSheetSebagaiObjek(SHEET_USERS).filter(u => String(u.Status).toUpperCase() === 'AKTIF').length
    : null;

  return jaya({ ringkasanPanitia, tindakanSaya, jumlahPenggunaAktif });
}
