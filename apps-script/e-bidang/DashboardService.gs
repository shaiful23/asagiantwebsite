/* =========================================================================
 * DashboardService.gs — Ringkasan prestasi fail bagi setiap panitia (dalam
 * skop akses peranan semasa) + senarai tindakan susulan tertunggak sendiri
 * + ringkasan Pesanan Radas & Bahan Makmal (panitia makmal / Pembantu Makmal).
 * ========================================================================= */

function apiDashboard(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const panitiaSkop = PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1 ? SENARAI_PANITIA : (sesi.panitia || []);
  const semuaDokumen = bacaSheetSebagaiObjek(SHEET_DOKUMEN).filter(d => String(d.Status).toUpperCase() !== 'DIPADAM');
  const kategoriWajib = bacaSheetSebagaiObjek(SHEET_KATEGORI_DOKUMEN).filter(k => k.Wajib === 'YA');
  const semuaMesyuarat = bacaSheetSebagaiObjek(SHEET_MESYUARAT);
  const semuaTindakan = bacaSheetSebagaiObjek(SHEET_TINDAKAN_SUSULAN);
  const semuaPesanan = bacaSheetSebagaiObjek(SHEET_PESANAN_MAKMAL);
  const hariIni = formatTarikh(new Date());

  const ringkasanPanitia = panitiaSkop.map(namaPanitia => {
    const dokumenPanitia = semuaDokumen.filter(d => d.Panitia === namaPanitia);
    const wajibLengkap = kategoriWajib.filter(k => dokumenPanitia.some(d => d.KodKategori === k.KodKategori)).length;
    return {
      panitia: namaPanitia,
      jumlahDokumen: dokumenPanitia.length,
      peratusChecklist: kategoriWajib.length ? Math.round((wajibLengkap / kategoriWajib.length) * 100) : 100,
      mesyuaratAkanDatang: semuaMesyuarat.filter(m => m.Panitia === namaPanitia && String(m.TarikhMesyuarat) >= hariIni).length,
      tindakanTertunggak: semuaTindakan.filter(t => t.Panitia === namaPanitia && t.Status !== STATUS_SELESAI).length,
      pesananMenunggu: PANITIA_MAKMAL.indexOf(namaPanitia) !== -1
        ? semuaPesanan.filter(ps => ps.Panitia === namaPanitia && ps.Status === STATUS_PESANAN_MENUNGGU).length
        : null
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

  let ringkasanPesananMakmal = null;
  if (PERANAN_LIHAT_SEMUA_PESANAN.indexOf(sesi.peranan) !== -1) {
    ringkasanPesananMakmal = ringkasanPesananDaripadaSenarai(semuaPesanan);
  } else if (sesi.peranan === ROLE_PEMBANTU_MAKMAL) {
    // Pembantu Makmal biasa hanya nampak ringkasan bagi Makmal yang dijaganya sendiri.
    const pesananMakmalSaya = semuaPesanan.filter(ps => (sesi.makmal || []).indexOf(ps.Makmal) !== -1);
    ringkasanPesananMakmal = ringkasanPesananDaripadaSenarai(pesananMakmalSaya);
  }

  return jaya({ ringkasanPanitia, tindakanSaya, jumlahPenggunaAktif, ringkasanPesananMakmal });
}

function ringkasanPesananDaripadaSenarai(senarai) {
  return {
    menunggu: senarai.filter(ps => ps.Status === STATUS_PESANAN_MENUNGGU).length,
    dalamProses: senarai.filter(ps => ps.Status === STATUS_PESANAN_DALAM_PROSES).length,
    siap: senarai.filter(ps => ps.Status === STATUS_PESANAN_SIAP).length,
    terkini: senarai
      .filter(ps => ps.Status === STATUS_PESANAN_MENUNGGU || ps.Status === STATUS_PESANAN_DALAM_PROSES)
      .sort((a, b) => String(a.TarikhDiperlukan).localeCompare(String(b.TarikhDiperlukan)))
      .slice(0, 8)
      .map(ps => ({
        idPesanan: ps.IDPesanan, panitia: ps.Panitia, makmal: ps.Makmal, namaGuru: ps.NamaGuru, kelas: ps.Kelas,
        tajukEksperimen: ps.TajukEksperimen, tarikhDiperlukan: ps.TarikhDiperlukan, status: ps.Status
      }))
  };
}
