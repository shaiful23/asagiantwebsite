/* =========================================================================
 * KehadiranSubjekService.gs — kehadiran guru subjek / guru teach-in dan murid
 * semasa waktu P&P, melalui imbasan kod QR kelas.
 *
 * Aliran: Portal → butang "Imbas QR Kelas" → pengimbas (GitHub Pages, sebab
 * Apps Script menyekat kamera) → apiImbasKelas → borang dropdown (auto-isi
 * daripada jadual e-Teach-In / rekod teach-in) → apiRekodKehadiranSubjek.
 * Murid lalai HADIR; guru hanya tandakan yang tidak hadir.
 * ========================================================================= */

const SENARAI_SUBJEK = [
  'BAHASA MELAYU', 'BAHASA INGGERIS', 'MATEMATIK', 'MATEMATIK TAMBAHAN', 'SAINS', 'FIZIK', 'KIMIA', 'BIOLOGI',
  'SAINS KOMPUTER', 'ASAS SAINS KOMPUTER', 'SEJARAH', 'GEOGRAFI', 'PENDIDIKAN ISLAM', 'PENDIDIKAN MORAL',
  'PENDIDIKAN JASMANI & KESIHATAN', 'REKA BENTUK & TEKNOLOGI', 'PENDIDIKAN SENI VISUAL', 'MUZIK', 'EKONOMI',
  'PERNIAGAAN', 'PRINSIP PERAKAUNAN', 'BAHASA ARAB', 'BAHASA CINA', 'BAHASA IBAN', 'TASAWWUR ISLAM',
  'PENDIDIKAN SYARIAH ISLAMIAH', 'SAINS SUKAN', 'BIMBINGAN & KAUNSELING', 'LAIN-LAIN'
];

/* Slot sandaran (Sheet SLOT_WAKTU) — kunci slot = masa mula (HH:mm). */
function senaraiSlot() { return senaraiSlotTempatan().map(s => ({ slot: s.mula, mula: s.mula, tamat: s.tamat })); }
function slotPada(masaHHmm) {
  const s = senaraiSlotTempatan().find(x => masaHHmm >= x.mula && masaHHmm < x.tamat);
  return s ? { slot: s.mula, mula: s.mula, tamat: s.tamat } : null;
}

/* Blok P&P semasa bagi guru & kelas: rekod teach-in hari ini → jadual kelas → SLOT_WAKTU.
   Imbasan sehingga 10 minit sebelum blok bermula dikira untuk blok itu. */
function tentukanBlok(sesi, kelas, tarikh, masa) {
  const hari = hariBagiTarikh(tarikh), m = minitDaripadaHHmm(masa);
  const dalam = e => !!e.MasaMula && m >= minitDaripadaHHmm(e.MasaMula) - 10 && m < (e.MasaTamat ? minitDaripadaHHmm(e.MasaTamat) : 24 * 60);
  const teachIn = teachInGuru(sesi).filter(t => t.Tarikh === tarikh && t.Kelas === kelas).find(dalam) || null;
  const jadualKelas = senaraiJadual().filter(j => j.Hari === hari && j.Kelas === kelas && dalam(j));
  const jadual = jadualKelas.find(j => rekodMilikGuru(j.NoKPGuru, j.NamaGuru, sesi)) || jadualKelas[0] || null;
  const asas = teachIn || jadual;
  const blok = asas ? { slot: asas.MasaMula, mula: asas.MasaMula, tamat: asas.MasaTamat } : slotPada(masa);
  return { blok, jadual, teachIn };
}

/* Kod QR: "KELAS:<KodQR>" atau "KELAS:<KodQR>|BILIK:<bilik>". */
function huraiKodQR(kod) {
  let kodKelas = '', bilik = '';
  String(kod || '').trim().split('|').forEach(b => {
    const i = b.indexOf(':'); if (i < 0) return;
    const k = b.slice(0, i).trim().toUpperCase(), v = b.slice(i + 1).trim();
    if (k === 'KELAS') kodKelas = v;
    if (k === 'BILIK') bilik = v;
  });
  return { kodKelas, bilik };
}

function cariKelasDenganKod(kodKelas) {
  const k = String(kodKelas || '').trim().toUpperCase();
  return senaraiKelas().find(x => x.kodQR.toUpperCase() === k) || senaraiKelas().find(x => x.kelas === normalKelas(k)) || null;
}

function logSubjekPada(nokpGuru, kelas, tarikh, slot) {
  return bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).find(l => samaNoKP(l.NoKPGuru, nokpGuru) && normalKelas(l.Kelas) === kelas
    && keTarikh(l.Tarikh) === tarikh && String(l.Slot) === String(slot)) || null;
}

/* Peta { nokp: sebab } murid yang ditanda tidak hadir ke sekolah oleh GT pada tarikh itu. */
function muridTidakHadirSekolah(kelas, tarikh) {
  const o = {}, r = rekodKelasPada(tarikh, kelas);
  if (r) bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => t.IdRekod === r.IdRekod).forEach(t => { o[digitSahaja(t.NoKPMurid)] = t.Sebab; });
  return o;
}

function apiImbasKelas(p) {
  const sesi = wajibSesi(p.token, { jenis: 'GURU' });
  if (gagal(sesi)) return sesi;
  const qr = huraiKodQR(p.kod);
  if (!qr.kodKelas) return ralat('Kod QR ini bukan kod QR kelas e-Kehadiran.');
  const kelas = cariKelasDenganKod(qr.kodKelas);
  if (!kelas) return ralat('Kelas dengan kod "' + qr.kodKelas + '" tidak didaftarkan.');

  const tarikh = tarikhHariIni(), hari = hariBagiTarikh(tarikh);
  const tb = tentukanBlok(sesi, kelas.kelas, tarikh, masaSekarang());
  const slot = tb.blok, jadual = tb.jadual, teachIn = tb.teachIn;
  const milikSaya = jadual && rekodMilikGuru(jadual.NoKPGuru, jadual.NamaGuru, sesi);

  const subjekSaya = Array.from(new Set(jadualGuru(sesi).map(j => j.Subjek).filter(Boolean)));
  const subjekCadangan = teachIn ? (teachIn.Subjek || (jadual && jadual.Subjek) || '') : (jadual ? jadual.Subjek : (subjekSaya[0] || ''));
  const jenisCadangan = teachIn ? 'GURU TEACH-IN' : (milikSaya ? 'GURU SUBJEK' : (jadual ? 'GURU TEACH-IN' : 'GURU SUBJEK'));

  const sedia = slot ? logSubjekPada(sesi.nokp, kelas.kelas, tarikh, slot.slot) : null;
  const tidakHadirSedia = {};
  if (sedia) bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => t.IdLog === sedia.IdLog)
    .forEach(t => { tidakHadirSedia[digitSahaja(t.NoKPMurid)] = String(t.KodSebab); });

  /* Murid yang sudah ditanda tidak hadir oleh GT pagi ini — dicadangkan tidak hadir. */
  const rekodPagi = rekodKelasPada(tarikh, kelas.kelas);
  const tidakHadirPagi = {};
  if (rekodPagi) bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => t.IdRekod === rekodPagi.IdRekod)
    .forEach(t => { tidakHadirPagi[digitSahaja(t.NoKPMurid)] = String(t.KodSebab); });

  const murid = muridDalamKelas(kelas.kelas).map(m => {
    const n = digitSahaja(m.NoKP);
    const kod = sedia ? tidakHadirSedia[n] : tidakHadirPagi[n];
    return { nokp: n, nama: m.Nama, gambar: m.GambarUrl, hadir: !kod, kodSebab: kod || '', tidakHadirPagi: !!tidakHadirPagi[n] };
  });

  return jaya({
    kelas: kelas.kelas, tingkatan: kelas.tingkatan, bilik: qr.bilik || kelas.bilik, tarikh, hari,
    slot, jadual: jadual ? { subjek: jadual.Subjek, guru: jadual.NamaGuru, milikSaya: !!milikSaya } : null,
    teachIn: teachIn ? { subjek: teachIn.Subjek, guruAsal: teachIn.NamaGuruAsal } : null,
    subjekCadangan, jenisCadangan, subjekSaya, senaraiSubjek: SENARAI_SUBJEK, senaraiJenis: SENARAI_JENIS_GURU_SUBJEK,
    murid, sebab: [SEBAB_PONTENG_KELAS].concat(senaraiSebab()), sudahDirekod: sedia ? { idLog: sedia.IdLog, masa: sedia.Masa, subjek: sedia.Subjek } : null
  });
}

function apiRekodKehadiranSubjek(p) {
  const sesi = wajibSesi(p.token, { jenis: 'GURU' });
  if (gagal(sesi)) return sesi;
  const kelas = cariKelasDenganKod(p.kelas);
  const subjek = String(p.subjek || '').trim().toUpperCase();
  const jenis = String(p.jenis || '').trim().toUpperCase();
  if (!kelas || !subjek || !jenis) return ralat('Maklumat kelas, subjek atau jenis kehadiran tidak lengkap.');
  let tidakHadir = p.tidakHadir;
  if (typeof tidakHadir === 'string') { try { tidakHadir = JSON.parse(tidakHadir || '[]'); } catch (e) { return ralat('Data murid tidak sah.'); } }
  tidakHadir = Array.isArray(tidakHadir) ? tidakHadir : [];

  const kini = sekarang(), tarikh = formatTarikh(kini), masa = formatMasa(kini), slot = tentukanBlok(sesi, kelas.kelas, tarikh, masa).blok;
  const senaraiM = muridDalamKelas(kelas.kelas);
  const petaMurid = {}; senaraiM.forEach(m => { petaMurid[digitSahaja(m.NoKP)] = m; });
  for (let i = 0; i < tidakHadir.length; i++) {
    if (!petaMurid[digitSahaja(tidakHadir[i].nokp)]) return ralat('Murid ' + tidakHadir[i].nokp + ' bukan dalam kelas ini.');
    if (!tidakHadir[i].kodSebab) return ralat('Sila pilih sebab bagi ' + petaMurid[digitSahaja(tidakHadir[i].nokp)].Nama + '.');
  }
  /* Ponteng kelas hanya sah bagi murid yang hadir ke sekolah hari ini (tidak ditanda tidak hadir oleh GT). */
  const tidakHadirSekolah = muridTidakHadirSekolah(kelas.kelas, tarikh);
  const salah = tidakHadir.filter(t => t.kodSebab === KOD_PONTENG_KELAS && tidakHadirSekolah[digitSahaja(t.nokp)]);
  if (salah.length) return ralat(petaMurid[digitSahaja(salah[0].nokp)].Nama + ' ditanda tidak hadir ke sekolah oleh Guru Tingkatan hari ini (' +
    tidakHadirSekolah[digitSahaja(salah[0].nokp)] + ') — bukan ponteng kelas. Pilih sebab lain.');

  let statusMasa = 'TIADA SLOT';
  if (slot) statusMasa = (minitDaripadaHHmm(masa) - minitDaripadaHHmm(slot.mula)) > Number(tetapan('TOLERANSI_LEWAT_MINIT') || 10) ? 'LEWAT' : 'TEPAT MASA';

  return denganKunci(() => {
    const sedia = slot ? logSubjekPada(sesi.nokp, kelas.kelas, tarikh, slot.slot) : null;
    const idLog = sedia ? sedia.IdLog : janaId('LS');
    const log = {
      IdLog: idLog, Tarikh: tarikh, Hari: hariBagiTarikh(tarikh), Slot: slot ? slot.slot : '', NoKPGuru: "'" + sesi.nokp, NamaGuru: sesi.nama,
      Kelas: kelas.kelas, Bilik: String(p.bilik || kelas.bilik || ''), Subjek: subjek, Jenis: jenis,
      StatusMasa: sedia ? sedia.StatusMasa : statusMasa, JumlahMurid: senaraiM.length, Hadir: senaraiM.length - tidakHadir.length,
      TidakHadir: tidakHadir.length, Catatan: String(p.catatan || '').slice(0, 500), Masa: sedia ? sedia.Masa : formatTarikhMasa(kini)
    };
    if (sedia) { log.__row = sedia.__row; kemaskiniBaris(SHEET.LOG_SUBJEK, log); }
    else tambahBaris(SHEET.LOG_SUBJEK, log);
    const lama = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => t.IdLog === idLog).map(t => t.__row);
    if (lama.length) padamBaris(SHEET.TIDAK_HADIR_SUBJEK, lama);
    tambahBanyakBaris(SHEET.TIDAK_HADIR_SUBJEK, tidakHadir.map(t => {
      const m = petaMurid[digitSahaja(t.nokp)], s = t.kodSebab === KOD_PONTENG_KELAS ? SEBAB_PONTENG_KELAS : cariSebab(t.kodSebab);
      return { IdLog: idLog, Tarikh: tarikh, Slot: log.Slot, Kelas: kelas.kelas, Subjek: subjek, NoKPMurid: "'" + digitSahaja(m.NoKP),
        NamaMurid: m.Nama, KodSebab: s.kod, Sebab: s.sebab, PontengKelas: s.pontengKelas ? 'YA' : 'TIDAK', NoKPGuru: "'" + sesi.nokp, NamaGuru: sesi.nama };
    }));
    catatAudit(sesi, sedia ? 'KEMASKINI_KEHADIRAN_SUBJEK' : 'REKOD_KEHADIRAN_SUBJEK', kelas.kelas + ' ' + subjek + ' ' + log.Slot);
    return jaya({ idLog, statusMasa: log.StatusMasa, hadir: log.Hadir, tidakHadir: log.TidakHadir, jumlah: log.JumlahMurid, dikemaskini: !!sedia,
      pontengKelas: tidakHadir.filter(t => t.kodSebab === KOD_PONTENG_KELAS).length });
  });
}
