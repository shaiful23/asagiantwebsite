/* =========================================================================
 * KehadiranKelasService.gs — rekod kehadiran harian kelas oleh GT / PGT.
 *
 *  • Lalai: SEMUA murid hadir. GT hanya tandakan murid yang TIDAK hadir dan
 *    pilih sebab (senarai IDME). Hanya murid tidak hadir disimpan
 *    (KETIDAKHADIRAN_HARIAN) + satu baris ringkasan (REKOD_KELAS_HARIAN).
 *  • Kunci automatik selepas MASA_KUNCI_KEHADIRAN (lalai 07:10) pada hari itu.
 *    Selepas dikunci (atau untuk tarikh lepas), GT wajib memohon admin membuka
 *    akses dengan alasan. Semua permohonan disimpan & dianalisis untuk admin.
 * ========================================================================= */

function permohonanUntuk(tarikh, kelas) {
  return bacaSheetSebagaiObjek(SHEET.PERMOHONAN)
    .filter(p => keTarikh(p.TarikhRekod) === tarikh && normalKelas(p.Kelas) === normalKelas(kelas))
    .sort((a, b) => String(b.MasaMohon).localeCompare(String(a.MasaMohon)));
}

function statusKunci(tarikh, kelas) {
  const hariIni = tarikhHariIni();
  const masaKunci = keHHmm(tetapan('MASA_KUNCI_KEHADIRAN')) || '07:10';
  if (tarikh > hariIni) return { boleh: false, terkunci: true, masaKunci, sebab: 'Kehadiran tarikh akan datang tidak boleh direkod.' };
  if (tarikh === hariIni && masaSekarang() < masaKunci) return { boleh: true, terkunci: false, masaKunci, tamat: tarikh + ' ' + masaKunci };

  const kini = formatTarikhMasa(sekarang());
  const senarai = permohonanUntuk(tarikh, kelas);
  const aktif = senarai.find(p => String(p.Status) === 'DILULUSKAN' && String(p.TamatAkses) > kini);
  if (aktif) return { boleh: true, terkunci: false, masaKunci, melaluiPermohonan: aktif.IdPermohonan, tamat: aktif.TamatAkses };

  const menunggu = senarai.find(p => String(p.Status) === 'MENUNGGU');
  return {
    boleh: false, terkunci: true, masaKunci,
    sebab: tarikh === hariIni
      ? 'Rekod kehadiran dikunci selepas ' + masaKunci + '. Mohon admin membuka semula akses.'
      : 'Rekod untuk tarikh lepas dikunci. Mohon admin membuka akses.',
    permohonanMenunggu: menunggu ? { id: menunggu.IdPermohonan, masa: menunggu.MasaMohon, alasan: menunggu.Alasan } : null
  };
}

function rekodKelasPada(tarikh, kelas) {
  return bacaSheetSebagaiObjek(SHEET.REKOD_KELAS)
    .find(r => keTarikh(r.Tarikh) === tarikh && normalKelas(r.Kelas) === normalKelas(kelas)) || null;
}

function wajibGuruKelas(token) {
  const sesi = wajibSesi(token, { peranan: KUMPULAN_GURU_KELAS.concat([PERANAN.ADMIN]) });
  if (gagal(sesi)) return sesi;
  if (!sesi.kelasTingkatan && !adalahAdmin(sesi)) return ralat('Kelas tingkatan anda belum ditetapkan dalam Sheet GURU (lajur KelasTingkatan). Sila hubungi admin.');
  return sesi;
}
/* GT/PGT terhad kepada kelas sendiri; admin boleh pilih mana-mana kelas. */
function kelasDibenarkan(sesi, kelasDiminta) {
  if (adalahAdmin(sesi) && kelasDiminta) return normalKelas(kelasDiminta);
  return sesi.kelasTingkatan;
}

function apiKehadiranKelasMuat(p) {
  const sesi = wajibGuruKelas(p.token);
  if (gagal(sesi)) return sesi;
  const kelas = kelasDibenarkan(sesi, p.kelas);
  if (!kelas) return ralat('Sila pilih kelas.');
  const tarikh = tarikhSah(p.tarikh) ? p.tarikh : tarikhHariIni();

  const rekod = rekodKelasPada(tarikh, kelas);
  const tidakHadir = {};
  if (rekod) {
    bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => t.IdRekod === rekod.IdRekod)
      .forEach(t => { tidakHadir[digitSahaja(t.NoKPMurid)] = String(t.KodSebab); });
  }
  const murid = muridDalamKelas(kelas).map(m => ({
    nokp: digitSahaja(m.NoKP), nama: m.Nama, jantina: m.Jantina, gambar: m.GambarUrl,
    hadir: !tidakHadir[digitSahaja(m.NoKP)], kodSebab: tidakHadir[digitSahaja(m.NoKP)] || ''
  }));

  return jaya({
    tarikh, kelas, hari: hariBagiTarikh(tarikh), murid, sebab: senaraiSebab(),
    rekod: rekod ? { direkodOleh: rekod.NamaGuru, masa: rekod.MasaRekod, hadir: Number(rekod.Hadir), tidakHadir: Number(rekod.TidakHadir), selepasKunci: rekod.SelepasKunci === 'YA' } : null,
    kunci: statusKunci(tarikh, kelas),
    permohonan: permohonanUntuk(tarikh, kelas).slice(0, 5).map(ringkasPermohonan),
    senaraiKelas: adalahAdmin(sesi) ? senaraiKelas().map(k => k.kelas) : []
  });
}

function apiKehadiranKelasSimpan(p) {
  const sesi = wajibGuruKelas(p.token);
  if (gagal(sesi)) return sesi;
  const kelas = kelasDibenarkan(sesi, p.kelas);
  const tarikh = tarikhSah(p.tarikh) ? p.tarikh : '';
  if (!kelas || !tarikh) return ralat('Kelas atau tarikh tidak sah.');

  const kunci = statusKunci(tarikh, kelas);
  if (!kunci.boleh && !adalahAdmin(sesi)) return ralat(kunci.sebab, 'TERKUNCI');

  const senaraiMuridKelas = muridDalamKelas(kelas);
  const petaMurid = {}; senaraiMuridKelas.forEach(m => { petaMurid[digitSahaja(m.NoKP)] = m; });
  const tidakHadir = Array.isArray(p.tidakHadir) ? p.tidakHadir : [];
  for (let i = 0; i < tidakHadir.length; i++) {
    if (!petaMurid[digitSahaja(tidakHadir[i].nokp)]) return ralat('Murid ' + tidakHadir[i].nokp + ' bukan dalam kelas ' + kelas + '.');
    if (!tidakHadir[i].kodSebab) return ralat('Sila pilih sebab tidak hadir bagi ' + petaMurid[digitSahaja(tidakHadir[i].nokp)].Nama + '.');
  }

  return denganKunci(() => {
    const sedia = rekodKelasPada(tarikh, kelas);
    const idRekod = sedia ? sedia.IdRekod : janaId('RK');
    const ringkasan = {
      IdRekod: idRekod, Tarikh: tarikh, Kelas: kelas, JumlahMurid: senaraiMuridKelas.length,
      Hadir: senaraiMuridKelas.length - tidakHadir.length, TidakHadir: tidakHadir.length,
      NoKPGuru: "'" + sesi.nokp, NamaGuru: sesi.nama, MasaRekod: formatTarikhMasa(sekarang()),
      SelepasKunci: kunci.melaluiPermohonan || (!kunci.boleh && adalahAdmin(sesi)) ? 'YA' : 'TIDAK',
      IdPermohonan: kunci.melaluiPermohonan || ''
    };
    if (sedia) { ringkasan.__row = sedia.__row; kemaskiniBaris(SHEET.REKOD_KELAS, ringkasan); }
    else tambahBaris(SHEET.REKOD_KELAS, ringkasan);

    const barisLama = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => t.IdRekod === idRekod).map(t => t.__row);
    if (barisLama.length) padamBaris(SHEET.TIDAK_HADIR, barisLama);
    tambahBanyakBaris(SHEET.TIDAK_HADIR, tidakHadir.map(t => {
      const m = petaMurid[digitSahaja(t.nokp)]; const s = cariSebab(t.kodSebab);
      return { IdRekod: idRekod, Tarikh: tarikh, Kelas: kelas, NoKPMurid: "'" + digitSahaja(m.NoKP), NamaMurid: m.Nama,
        KodSebab: s.kod, Sebab: s.sebab, DikiraPonteng: s.dikiraPonteng ? 'YA' : 'TIDAK' };
    }));
    catatAudit(sesi, sedia ? 'KEMASKINI_KEHADIRAN_KELAS' : 'REKOD_KEHADIRAN_KELAS', kelas + ' ' + tarikh + ' (tidak hadir: ' + tidakHadir.length + ')');
    return jaya({ hadir: ringkasan.Hadir, tidakHadir: ringkasan.TidakHadir, jumlah: ringkasan.JumlahMurid, dikemaskini: !!sedia });
  });
}

/* ------------------------------ PERMOHONAN BUKA AKSES ------------------------------ */
function ringkasPermohonan(p) {
  return { id: p.IdPermohonan, tarikhRekod: keTarikh(p.TarikhRekod), kelas: p.Kelas, guru: p.NamaGuru, nokpGuru: digitSahaja(p.NoKPGuru),
    alasan: p.Alasan, masaMohon: p.MasaMohon, status: p.Status, diprosesOleh: p.DiprosesOleh, masaProses: p.MasaProses,
    catatanAdmin: p.CatatanAdmin, tamatAkses: p.TamatAkses };
}

function apiMohonBukaAkses(p) {
  const sesi = wajibGuruKelas(p.token);
  if (gagal(sesi)) return sesi;
  const kelas = kelasDibenarkan(sesi, p.kelas);
  const tarikh = tarikhSah(p.tarikh) ? p.tarikh : '';
  const alasan = String(p.alasan || '').trim();
  if (!tarikh) return ralat('Tarikh tidak sah.');
  if (alasan.length < 15) return ralat('Alasan wajib diberikan (sekurang-kurangnya 15 aksara) supaya admin boleh menilai permohonan.');
  const kunci = statusKunci(tarikh, kelas);
  if (kunci.boleh) return ralat('Akses rekod untuk tarikh ini masih dibuka — tiada permohonan diperlukan.');
  if (tarikh > tarikhHariIni()) return ralat(kunci.sebab);
  if (kunci.permohonanMenunggu) return ralat('Permohonan anda untuk tarikh ini sedang menunggu kelulusan admin.');

  return denganKunci(() => {
    const id = janaId('PB');
    tambahBaris(SHEET.PERMOHONAN, { IdPermohonan: id, TarikhRekod: tarikh, Kelas: kelas, NoKPGuru: "'" + sesi.nokp, NamaGuru: sesi.nama,
      Alasan: alasan, MasaMohon: formatTarikhMasa(sekarang()), Status: 'MENUNGGU' });
    catatAudit(sesi, 'MOHON_BUKA_AKSES', kelas + ' ' + tarikh);
    return jaya({ id });
  });
}
