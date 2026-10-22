/* =========================================================================
 * DashboardService.gs — Ringkasan prestasi fail bagi setiap panitia (dalam
 * skop akses peranan semasa) + senarai tindakan susulan tertunggak sendiri.
 * ========================================================================= */

function apiDashboard(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const panitiaSkop = (bolehLihatPanitia(sesi, SKOP_BIDANG) ? [SKOP_BIDANG] : [])
    .concat(PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1 ? SENARAI_PANITIA : (sesi.panitia || []));
  const semuaDokumen = bacaSheetSebagaiObjek(SHEET_DOKUMEN).filter(d => String(d.Status).toUpperCase() !== 'DIPADAM');
  const kategoriWajib = bacaSheetSebagaiObjek(SHEET_KATEGORI_DOKUMEN).filter(k => k.Wajib === 'YA');
  const semuaMesyuarat = bacaSheetSebagaiObjek(SHEET_MESYUARAT);
  const semuaTindakan = bacaSheetSebagaiObjek(SHEET_TINDAKAN_SUSULAN);
  const semuaProgram = bacaSheetSebagaiObjek(SHEET_PROGRAM);
  const hariIni = formatTarikh(new Date());
  const tahunIni = hariIni.slice(0, 4);
  const dalamSkop = r => panitiaSkop.indexOf(String(r.Panitia)) !== -1;

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

  /* Data carta & kad ringkas (dalam skop panitia yang boleh dilihat sahaja). */
  const mesyuaratSkop = semuaMesyuarat.filter(dalamSkop);
  const programSkop = semuaProgram.filter(dalamSkop);
  const tindakanSkop = semuaTindakan.filter(dalamSkop);

  const aktivitiBulanan = [];
  for (let b = 1; b <= 12; b++) {
    const awalan = tahunIni + '-' + ('0' + b).slice(-2);
    aktivitiBulanan.push({
      mesyuarat: mesyuaratSkop.filter(m => String(m.TarikhMesyuarat).indexOf(awalan) === 0).length,
      program: programSkop.filter(pr => pr.JenisProgram !== 'PLC' && String(pr.TarikhMula).indexOf(awalan) === 0).length,
      plc: programSkop.filter(pr => pr.JenisProgram === 'PLC' && String(pr.TarikhMula).indexOf(awalan) === 0).length
    });
  }

  const statusTindakan = {};
  SEMUA_STATUS_TINDAKAN.forEach(st => { statusTindakan[st] = tindakanSkop.filter(t => t.Status === st).length; });

  const aktivitiAkanDatang = mesyuaratSkop
    .filter(m => String(m.TarikhMesyuarat) >= hariIni)
    .map(m => ({ jenis: 'MESYUARAT', tajuk: m.Tajuk, panitia: m.Panitia, tarikhMula: m.TarikhMesyuarat, tarikhTamat: m.TarikhMesyuarat,
      masaMula: m.MasaMula || '', masaTamat: m.MasaTamat || '', keterangan: m.Agenda || '', disegerak: !!m.EventIdKalendar }))
    .concat(programSkop
      .filter(pr => String(pr.TarikhTamat || pr.TarikhMula) >= hariIni)
      .map(pr => ({ jenis: pr.JenisProgram === 'PLC' ? 'PLC' : 'PROGRAM', tajuk: pr.NamaProgram, panitia: pr.Panitia,
        tarikhMula: pr.TarikhMula, tarikhTamat: pr.TarikhTamat || pr.TarikhMula, masaMula: pr.MasaMula || '', masaTamat: pr.MasaTamat || '',
        keterangan: pr.Objektif || '', disegerak: !!pr.EventIdKalendar })))
    .sort((a, b) => String(a.tarikhMula).localeCompare(String(b.tarikhMula)))
    .slice(0, 6);

  const kpi = {
    jumlahDokumen: ringkasanPanitia.reduce((j, r) => j + r.jumlahDokumen, 0),
    purataKelengkapan: ringkasanPanitia.length ? Math.round(ringkasanPanitia.reduce((j, r) => j + r.peratusChecklist, 0) / ringkasanPanitia.length) : 0,
    mesyuaratAkanDatang: mesyuaratSkop.filter(m => String(m.TarikhMesyuarat) >= hariIni).length,
    programTahunIni: programSkop.filter(pr => String(pr.TarikhMula).indexOf(tahunIni) === 0).length,
    tindakanTertunggak: tindakanSkop.filter(t => t.Status !== STATUS_SELESAI).length
  };

  /* Perbandingan antara panitia bagi tahun semasa (carta bar mendatar & jadual prestasi). */
  const aktivitiPanitia = panitiaSkop.map(namaPanitia => {
    const programPanitia = programSkop.filter(pr => pr.Panitia === namaPanitia && String(pr.TarikhMula).indexOf(tahunIni) === 0);
    const tindakanPanitia = tindakanSkop.filter(t => t.Panitia === namaPanitia);
    return {
      panitia: namaPanitia,
      mesyuarat: mesyuaratSkop.filter(m => m.Panitia === namaPanitia && String(m.TarikhMesyuarat).indexOf(tahunIni) === 0).length,
      program: programPanitia.filter(pr => pr.JenisProgram !== 'PLC').length,
      plc: programPanitia.filter(pr => pr.JenisProgram === 'PLC').length,
      tindakanJumlah: tindakanPanitia.length,
      tindakanSelesai: tindakanPanitia.filter(t => t.Status === STATUS_SELESAI).length
    };
  });

  return jaya({ ringkasanPanitia, tindakanSaya, jumlahPenggunaAktif,
    kpi, aktivitiBulanan, statusTindakan, aktivitiAkanDatang, aktivitiPanitia, tahun: Number(tahunIni) });
}
