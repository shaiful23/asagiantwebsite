/* =========================================================================
 * UrusService.gs — admin mengurus SEMUA data sistem terus dari UI (tanpa
 * membuka Google Sheet) + suntingan rekod oleh pemilik.
 *
 *  • Jadual konfigurasi (TETAPAN, GURU, KELAS, SEBAB, SLOT, PETA_KOD, CUTI)
 *    — senarai, tambah, kemaskini, padam (whitelist medan & pengesahan).
 *  • Sesi kehadiran subjek — guru pemilik boleh sunting dalam tempoh
 *    TEMPOH_EDIT_SESI_HARI (lalai 14 hari); admin bila-bila masa & boleh padam.
 *  • Intervensi (pemilik/admin), surat amaran (admin batal), rekod kehadiran
 *    harian kelas (admin padam), permohonan buka akses (admin tarik balik).
 *  • Log audit & tindakan sistem (sediakan struktur, segar cache, jana peta kod).
 * ========================================================================= */

const RE_HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const JADUAL_URUS = {
  TETAPAN: { label: 'Tetapan sistem', kunci: 'Kunci', medan: ['Nilai'], tambah: false, padam: false },
  GURU: { label: 'Guru & peranan', kunci: 'NoKP', medan: ['Nama', 'Peranan', 'KelasTingkatan', 'Emel', 'NoTelefon', 'Status', 'NamaDalamJadual'], tambah: true, padam: true, nokp: true },
  KELAS: { label: 'Kelas & kod QR', kunci: 'Kelas', medan: ['Tingkatan', 'KodQR', 'Bilik'], tambah: true, padam: true },
  SEBAB: { label: 'Sebab tidak hadir (IDME)', kunci: 'Kod', medan: ['Sebab', 'Kategori', 'DikiraPonteng'], tambah: true, padam: true },
  SLOT: { label: 'Slot waktu', kunci: 'Slot', medan: ['MasaMula', 'MasaTamat'], tambah: true, padam: true },
  PETA_KOD: { label: 'Peta kod kelas e-Teach-In', kunci: 'Kod', medan: ['Kelas', 'Catatan'], tambah: true, padam: true },
  CUTI: { label: 'Cuti sekolah / tiada P&P', kunci: 'IdCuti', medan: ['TarikhMula', 'TarikhTamat', 'Catatan'], tambah: true, padam: true, auto: 'CT' }
};

function nilaiSahUrus(jadual, o) {
  if (jadual === 'GURU') {
    if (digitSahaja(o.NoKP).length !== 12) return 'No. KP guru mesti 12 digit.';
    const p = senaraiDaripadaMedan(String(o.Peranan || '').replace(/\+/g, ',')).map(x => x.toUpperCase());
    const salah = p.filter(x => !PERANAN[x] || x === PERANAN.MURID);
    if (salah.length) return 'Peranan tidak sah: ' + salah.join(', ') + '. Pilih: ADMIN, GT, PGT, GMP, PRAKTIKAL, KAUNSELOR.';
    o.Peranan = p.join(',');
    o.Status = String(o.Status || 'AKTIF').toUpperCase();
    if (['AKTIF', 'TIDAK AKTIF'].indexOf(o.Status) === -1) return 'Status mesti AKTIF atau TIDAK AKTIF.';
    o.KelasTingkatan = normalKelas(o.KelasTingkatan || '');
    if (p.some(x => x === 'GT' || x === 'PGT') && !o.KelasTingkatan) return 'GT/PGT mesti mempunyai kelas tingkatan.';
    o.Nama = String(o.Nama || '').trim().toUpperCase();
  }
  if (jadual === 'KELAS') {
    o.Kelas = normalKelas(o.Kelas); if (!o.Kelas) return 'Nama kelas wajib diisi.';
    o.KodQR = String(o.KodQR || '').trim().toUpperCase().replace(/\s+/g, '');
    if (o.KodQR && !/^[A-Z0-9_\-]+$/.test(o.KodQR)) return 'Kod QR hanya huruf, nombor, - atau _.';
  }
  if (jadual === 'SEBAB') {
    o.Kod = String(o.Kod || '').trim().toUpperCase(); if (!o.Kod || !o.Sebab) return 'Kod & sebab wajib diisi.';
    if (o.Kod === KOD_PONTENG_KELAS) return 'Kod ' + KOD_PONTENG_KELAS + ' dikhaskan oleh sistem.';
    o.DikiraPonteng = /^(YA|Y|TRUE|1)$/i.test(String(o.DikiraPonteng || '')) ? 'YA' : 'TIDAK';
  }
  if (jadual === 'SLOT') {
    if (!RE_HHMM.test(o.MasaMula) || !RE_HHMM.test(o.MasaTamat)) return 'Masa mesti dalam format HH:mm (cth. 07:30).';
    if (keHHmm(o.MasaMula) >= keHHmm(o.MasaTamat)) return 'Masa tamat mesti selepas masa mula.';
    o.MasaMula = "'" + keHHmm(o.MasaMula); o.MasaTamat = "'" + keHHmm(o.MasaTamat);
  }
  if (jadual === 'PETA_KOD') { o.Kod = normalKelas(o.Kod); o.Kelas = normalKelas(o.Kelas); if (!o.Kod) return 'Kod wajib diisi.'; }
  if (jadual === 'CUTI') {
    if (!tarikhSah(o.TarikhMula)) return 'Tarikh mula tidak sah.';
    if (!o.TarikhTamat) o.TarikhTamat = o.TarikhMula;
    if (!tarikhSah(o.TarikhTamat) || o.TarikhTamat < o.TarikhMula) return 'Tarikh tamat tidak sah.';
  }
  if (jadual === 'TETAPAN') {
    const k = String(o.Kunci || '');
    if (k === 'MASA_KUNCI_KEHADIRAN' && !RE_HHMM.test(o.Nilai)) return 'Masa kunci mesti HH:mm.';
    if (/^(PK_|TEMPOH_|TOLERANSI_)/.test(k) && !/^\d+$/.test(String(o.Nilai))) return k + ' mesti nombor bulat.';
    o.Nilai = "'" + String(o.Nilai === undefined ? '' : o.Nilai).trim();
  }
  return '';
}

function apiUrusSenarai(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const jadual = String(p.jadual || '');
  const cfg = JADUAL_URUS[jadual];
  if (!cfg) return ralat('Jadual tidak dikenali.');
  sediakanSistem(true);
  const baris = bacaSheetSebagaiObjek(SHEET[jadual]).map(r => {
    const o = {}; HEADER[jadual].forEach(h => { o[h] = r[h] === undefined ? '' : (/^NoKP/.test(h) ? digitSahaja(r[h]) : teksSelUrus(r[h], h)); }); return o;
  });
  if (jadual === 'TETAPAN') {
    const lalai = {}; TETAPAN_LALAI.forEach(t => { lalai[t[0]] = t[2]; });
    baris.forEach(b => { if (!b.Keterangan) b.Keterangan = lalai[b.Kunci] || ''; });
  }
  const tambahan = {};
  if (jadual === 'GURU') tambahan.gabung = senaraiGuru().map(g => ({ NoKP: g.NoKP, Nama: g.Nama, Peranan: g.Peranan.join(','), KelasTingkatan: g.KelasTingkatan, Status: g.Status, NamaDalamJadual: g.NamaDalamJadual }));
  if (jadual === 'KELAS') tambahan.gabung = senaraiKelas().map(k => ({ Kelas: k.kelas, Tingkatan: k.tingkatan, KodQR: k.kodQR, Bilik: k.bilik }));
  if (jadual === 'SEBAB') tambahan.disambungIDME = !!tetapan('IDME_SPREADSHEET_ID');
  if (jadual === 'PETA_KOD') tambahan.peta = ringkasanPetaKod();
  return jaya({ jadual, label: cfg.label, header: HEADER[jadual], kunci: cfg.kunci, medan: cfg.medan, tambah: cfg.tambah, padam: cfg.padam, baris,
    peranan: Object.keys(PERANAN).filter(k => k !== 'MURID'), kelas: senaraiKelas().map(k => k.kelas), tambahan });
}

function teksSelUrus(v, h) {
  if (v instanceof Date) return /Masa|Slot/.test(h) ? keHHmm(v) : keTarikh(v);
  return String(v);
}

function apiUrusSimpan(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const jadual = String(p.jadual || ''), cfg = JADUAL_URUS[jadual];
  if (!cfg) return ralat('Jadual tidak dikenali.');
  const data = p.data || {};
  return denganKunci(() => {
    const semua = bacaSheetSebagaiObjek(SHEET[jadual]);
    const sama = (r, k) => cfg.nokp ? samaNoKP(r[cfg.kunci], k) : String(teksSelUrus(r[cfg.kunci], cfg.kunci)).toUpperCase() === String(k).toUpperCase();
    const asal = p.kunciAsal !== undefined && p.kunciAsal !== '' ? semua.find(r => sama(r, p.kunciAsal)) : null;
    if (p.kunciAsal && !asal && !cfg.tambah) return ralat('Rekod tidak dijumpai.');
    if (!asal && !cfg.tambah) return ralat('Penambahan tidak dibenarkan untuk jadual ini.');
    const o = {};
    HEADER[jadual].forEach(h => { o[h] = asal ? asal[h] : ''; });
    cfg.medan.forEach(m => { if (data[m] !== undefined) o[m] = String(data[m]).trim(); });
    if (!asal) o[cfg.kunci] = cfg.auto ? janaId(cfg.auto) : String(data[cfg.kunci] || '').trim();
    else if (data[cfg.kunci] !== undefined && !cfg.auto && jadual !== 'TETAPAN') o[cfg.kunci] = String(data[cfg.kunci]).trim();
    const salah = nilaiSahUrus(jadual, o);
    if (salah) return ralat(salah);
    const kunciBaru = cfg.nokp ? digitSahaja(o[cfg.kunci]) : String(o[cfg.kunci]);
    if (!kunciBaru) return ralat(cfg.kunci + ' wajib diisi.');
    const pendua = semua.find(r => r !== asal && sama(r, kunciBaru));
    if (pendua) return ralat(cfg.kunci + ' "' + kunciBaru + '" sudah wujud.');
    if (jadual === 'KELAS' && o.KodQR) {
      const qr = senaraiKelas().find(k => k.kodQR.toUpperCase() === o.KodQR && k.kelas !== o.Kelas);
      if (qr) return ralat('Kod QR "' + o.KodQR + '" sudah digunakan oleh ' + qr.kelas + '.');
    }
    if (cfg.nokp) o[cfg.kunci] = "'" + kunciBaru;
    if (asal) { o.__row = asal.__row; kemaskiniBaris(SHEET[jadual], o); } else tambahBaris(SHEET[jadual], o);
    if (jadual === 'TETAPAN') MEMO_TETAPAN = null;
    segarSemulaSumberLuar();
    catatAudit(sesi, (asal ? 'URUS_KEMASKINI_' : 'URUS_TAMBAH_') + jadual, kunciBaru + ' ' + cfg.medan.map(m => m + '=' + String(o[m]).replace(/^'/, '')).join('; ').slice(0, 400));
    return jaya({ kunci: kunciBaru });
  });
}

function apiUrusPadam(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const jadual = String(p.jadual || ''), cfg = JADUAL_URUS[jadual];
  if (!cfg || !cfg.padam) return ralat('Padam tidak dibenarkan untuk jadual ini.');
  return denganKunci(() => {
    const r = bacaSheetSebagaiObjek(SHEET[jadual]).find(x => cfg.nokp ? samaNoKP(x[cfg.kunci], p.kunci) : String(teksSelUrus(x[cfg.kunci], cfg.kunci)).toUpperCase() === String(p.kunci).toUpperCase());
    if (!r) return ralat('Rekod tidak dijumpai.');
    if (jadual === 'GURU' && samaNoKP(r.NoKP, sesi.nokp)) return ralat('Anda tidak boleh memadam akaun anda sendiri.');
    padamBaris(SHEET[jadual], [r.__row]);
    segarSemulaSumberLuar();
    catatAudit(sesi, 'URUS_PADAM_' + jadual, String(p.kunci));
    return jaya({});
  });
}

/* ----------------------- SESI KEHADIRAN SUBJEK ----------------------- */
function bolehEditSesi(sesi, log) {
  if (adalahAdmin(sesi)) return true;
  if (!samaNoKP(log.NoKPGuru, sesi.nokp)) return false;
  const hari = Number(tetapan('TEMPOH_EDIT_SESI_HARI') || 14);
  return keTarikh(log.Tarikh) >= tambahHari(tarikhHariIni(), -hari);
}

function apiSenaraiSesiSubjek(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const dari = tarikhSah(p.dari) ? p.dari : tambahHari(tarikhHariIni(), -6), hingga = tarikhSah(p.hingga) ? p.hingga : tarikhHariIni();
  const kelas = normalKelas(p.kelas || ''), guru = String(p.guru || '').toUpperCase();
  const senarai = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).filter(l => { const t = keTarikh(l.Tarikh); return t >= dari && t <= hingga; })
    .filter(l => (!kelas || normalKelas(l.Kelas) === kelas) && (!guru || String(l.NamaGuru).toUpperCase().indexOf(guru) !== -1))
    .map(l => ({ idLog: l.IdLog, tarikh: keTarikh(l.Tarikh), hari: l.Hari, slot: keHHmm(l.Slot), kelas: l.Kelas, subjek: l.Subjek, jenis: l.Jenis, guru: l.NamaGuru,
      statusMasa: l.StatusMasa, hadir: Number(l.Hadir), jumlah: Number(l.JumlahMurid), tidakHadir: Number(l.TidakHadir), masa: l.Masa }))
    .sort((a, b) => (b.tarikh + b.slot).localeCompare(a.tarikh + a.slot));
  return jaya({ dari, hingga, senarai, kelas: senaraiKelas().map(k => k.kelas) });
}

function apiButiranSesiSubjek(p) {
  const sesi = wajibSesi(p.token, { jenis: 'GURU' });
  if (gagal(sesi)) return sesi;
  const log = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).find(l => l.IdLog === p.idLog);
  if (!log) return ralat('Sesi tidak dijumpai.');
  const lihat = adalahAdmin(sesi) || samaNoKP(log.NoKPGuru, sesi.nokp) || (adalahGuruKelas(sesi) && normalKelas(log.Kelas) === sesi.kelasTingkatan);
  if (!lihat) return ralat('Anda tidak mempunyai akses kepada sesi ini.', 'AKSES');
  const kelas = normalKelas(log.Kelas), tarikh = keTarikh(log.Tarikh);
  const th = {}; bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => t.IdLog === log.IdLog).forEach(t => { th[digitSahaja(t.NoKPMurid)] = t.KodSebab; });
  const pagi = muridTidakHadirSekolah(kelas, tarikh);
  return jaya({
    sesi: { idLog: log.IdLog, tarikh, hari: log.Hari, slot: keHHmm(log.Slot), kelas, bilik: log.Bilik, subjek: log.Subjek, jenis: log.Jenis, statusMasa: log.StatusMasa,
      catatan: log.Catatan, guru: log.NamaGuru, masa: log.Masa },
    murid: muridDalamKelas(kelas).map(m => ({ nokp: digitSahaja(m.NoKP), nama: m.Nama, kodSebab: th[digitSahaja(m.NoKP)] || '', tidakHadirPagi: pagi[digitSahaja(m.NoKP)] || '' })),
    sebab: [SEBAB_PONTENG_KELAS].concat(senaraiSebab()), subjek: Array.from(new Set(SENARAI_SUBJEK.concat([String(log.Subjek)]))).filter(Boolean),
    jenis: ['GURU SUBJEK', 'GURU TEACH-IN'], bolehEdit: bolehEditSesi(sesi, log), admin: adalahAdmin(sesi),
    tempohEdit: Number(tetapan('TEMPOH_EDIT_SESI_HARI') || 14)
  });
}

function apiKemaskiniSesiSubjek(p) {
  const sesi = wajibSesi(p.token, { jenis: 'GURU' });
  if (gagal(sesi)) return sesi;
  return denganKunci(() => {
    const log = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).find(l => l.IdLog === p.idLog);
    if (!log) return ralat('Sesi tidak dijumpai.');
    if (!bolehEditSesi(sesi, log)) return ralat('Sesi ini tidak boleh disunting lagi (melebihi ' + (tetapan('TEMPOH_EDIT_SESI_HARI') || 14) + ' hari) atau bukan milik anda. Hubungi admin.', 'AKSES');
    const kelas = normalKelas(log.Kelas), tarikh = keTarikh(log.Tarikh);
    let tidakHadir = p.tidakHadir;
    if (typeof tidakHadir === 'string') { try { tidakHadir = JSON.parse(tidakHadir || '[]'); } catch (e) { return ralat('Data murid tidak sah.'); } }
    tidakHadir = Array.isArray(tidakHadir) ? tidakHadir : [];
    const senaraiM = muridDalamKelas(kelas), petaMurid = {}; senaraiM.forEach(m => { petaMurid[digitSahaja(m.NoKP)] = m; });
    const pagi = muridTidakHadirSekolah(kelas, tarikh);
    for (let i = 0; i < tidakHadir.length; i++) {
      const t = tidakHadir[i], m = petaMurid[digitSahaja(t.nokp)];
      if (!m) return ralat('Murid ' + t.nokp + ' bukan dalam kelas ini.');
      if (!t.kodSebab) return ralat('Sila pilih sebab bagi ' + m.Nama + '.');
      if (t.kodSebab === KOD_PONTENG_KELAS && pagi[digitSahaja(t.nokp)]) return ralat(m.Nama + ' tidak hadir ke sekolah pada tarikh ini (' + pagi[digitSahaja(t.nokp)] + ') — bukan ponteng kelas.');
      if (t.kodSebab !== KOD_PONTENG_KELAS && !cariSebab(t.kodSebab)) return ralat('Sebab "' + t.kodSebab + '" tidak sah.');
    }
    const subjek = String(p.subjek || log.Subjek).trim().toUpperCase(), jenis = String(p.jenis || log.Jenis).trim().toUpperCase();
    const o = {}; HEADER.LOG_SUBJEK.forEach(h => { o[h] = log[h]; });
    Object.assign(o, { __row: log.__row, NoKPGuru: "'" + digitSahaja(log.NoKPGuru), Subjek: subjek, Jenis: jenis, Hadir: senaraiM.length - tidakHadir.length, JumlahMurid: senaraiM.length,
      TidakHadir: tidakHadir.length, Catatan: String(p.catatan === undefined ? log.Catatan : p.catatan).slice(0, 500), Tarikh: tarikh, Slot: "'" + keHHmm(log.Slot) });
    if (adalahAdmin(sesi) && ['TEPAT MASA', 'LEWAT', 'TIADA SLOT'].indexOf(String(p.statusMasa || '')) !== -1) o.StatusMasa = p.statusMasa;
    kemaskiniBaris(SHEET.LOG_SUBJEK, o);
    const lama = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => t.IdLog === log.IdLog).map(t => t.__row);
    if (lama.length) padamBaris(SHEET.TIDAK_HADIR_SUBJEK, lama);
    tambahBanyakBaris(SHEET.TIDAK_HADIR_SUBJEK, tidakHadir.map(t => {
      const m = petaMurid[digitSahaja(t.nokp)], s = t.kodSebab === KOD_PONTENG_KELAS ? SEBAB_PONTENG_KELAS : cariSebab(t.kodSebab);
      return { IdLog: log.IdLog, Tarikh: tarikh, Slot: "'" + keHHmm(log.Slot), Kelas: kelas, Subjek: subjek, NoKPMurid: "'" + digitSahaja(m.NoKP), NamaMurid: m.Nama,
        KodSebab: s.kod, Sebab: s.sebab, PontengKelas: s.pontengKelas ? 'YA' : 'TIDAK', NoKPGuru: "'" + digitSahaja(log.NoKPGuru), NamaGuru: log.NamaGuru };
    }));
    catatAudit(sesi, 'SUNTING_SESI_SUBJEK', log.IdLog + ' ' + kelas + ' ' + subjek + ' ' + tarikh + ' (tidak hadir ' + tidakHadir.length + ')');
    return jaya({ hadir: o.Hadir, tidakHadir: o.TidakHadir, jumlah: o.JumlahMurid });
  });
}

function apiPadamSesiSubjek(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  return denganKunci(() => {
    const log = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).find(l => l.IdLog === p.idLog);
    if (!log) return ralat('Sesi tidak dijumpai.');
    const anak = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => t.IdLog === log.IdLog).map(t => t.__row);
    if (anak.length) padamBaris(SHEET.TIDAK_HADIR_SUBJEK, anak);
    padamBaris(SHEET.LOG_SUBJEK, [log.__row]);
    catatAudit(sesi, 'PADAM_SESI_SUBJEK', log.IdLog + ' ' + log.Kelas + ' ' + log.Subjek + ' ' + keTarikh(log.Tarikh) + ' ' + log.NamaGuru);
    return jaya({});
  });
}

/* ----------------------- INTERVENSI & SURAT ----------------------- */
function apiKemaskiniIntervensi(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  return denganKunci(() => {
    const r = bacaSheetSebagaiObjek(SHEET.INTERVENSI).find(i => i.IdIntervensi === p.id);
    if (!r) return ralat('Rekod intervensi tidak dijumpai.');
    if (!adalahAdmin(sesi) && !samaNoKP(r.NoKPGuru, sesi.nokp)) return ralat('Hanya guru yang merekod atau admin boleh menyunting intervensi ini.', 'AKSES');
    if (p.padam) {
      padamBaris(SHEET.INTERVENSI, [r.__row]);
      catatAudit(sesi, 'PADAM_INTERVENSI', r.NamaMurid + ': ' + r.Tindakan);
      return jaya({ dipadam: true });
    }
    const tindakan = String(p.tindakan || '').trim();
    if (!tindakan) return ralat('Sila pilih tindakan/intervensi.');
    const o = {}; HEADER.INTERVENSI.forEach(h => { o[h] = r[h]; });
    Object.assign(o, { __row: r.__row, NoKPMurid: "'" + digitSahaja(r.NoKPMurid), NoKPGuru: "'" + digitSahaja(r.NoKPGuru), Tindakan: tindakan,
      Catatan: String(p.catatan || '').slice(0, 1000), Tarikh: tarikhSah(p.tarikh) && p.tarikh <= tarikhHariIni() ? p.tarikh : keTarikh(r.Tarikh) });
    kemaskiniBaris(SHEET.INTERVENSI, o);
    catatAudit(sesi, 'SUNTING_INTERVENSI', r.NamaMurid + ': ' + tindakan);
    return jaya({});
  });
}

function apiBatalSurat(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  return denganKunci(() => {
    const r = bacaSheetSebagaiObjek(SHEET.SURAT).find(s => s.NoRujukan === p.noRujukan);
    if (!r) return ralat('Surat tidak dijumpai.');
    padamBaris(SHEET.SURAT, [r.__row]);
    catatAudit(sesi, 'BATAL_SURAT', r.NoRujukan + ' ' + r.NamaMurid + ' ' + r.Kategori + ' ' + r.Peringkat + (p.sebab ? ' — ' + p.sebab : ''));
    return jaya({});
  });
}

/* ----------------------- REKOD HARIAN & PERMOHONAN ----------------------- */
function apiSenaraiRekodKelas(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const dari = tarikhSah(p.dari) ? p.dari : tambahHari(tarikhHariIni(), -6), hingga = tarikhSah(p.hingga) ? p.hingga : tarikhHariIni();
  const kelas = normalKelas(p.kelas || '');
  return jaya({ dari, hingga, kelas: senaraiKelas().map(k => k.kelas), senarai: bacaSheetSebagaiObjek(SHEET.REKOD_KELAS)
    .filter(r => { const t = keTarikh(r.Tarikh); return t >= dari && t <= hingga && (!kelas || normalKelas(r.Kelas) === kelas); })
    .map(r => ({ id: r.IdRekod, tarikh: keTarikh(r.Tarikh), kelas: r.Kelas, jumlah: Number(r.JumlahMurid), hadir: Number(r.Hadir), tidakHadir: Number(r.TidakHadir),
      guru: r.NamaGuru, masa: r.MasaRekod, selepasKunci: r.SelepasKunci === 'YA' }))
    .sort((a, b) => (b.tarikh + a.kelas).localeCompare(a.tarikh + b.kelas)) });
}

function apiPadamRekodKelas(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  return denganKunci(() => {
    const r = bacaSheetSebagaiObjek(SHEET.REKOD_KELAS).find(x => x.IdRekod === p.id);
    if (!r) return ralat('Rekod tidak dijumpai.');
    const anak = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => t.IdRekod === r.IdRekod).map(t => t.__row);
    if (anak.length) padamBaris(SHEET.TIDAK_HADIR, anak);
    padamBaris(SHEET.REKOD_KELAS, [r.__row]);
    catatAudit(sesi, 'PADAM_REKOD_KELAS', keTarikh(r.Tarikh) + ' ' + r.Kelas);
    return jaya({});
  });
}

function apiKemaskiniPermohonan(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  return denganKunci(() => {
    const r = bacaSheetSebagaiObjek(SHEET.PERMOHONAN).find(x => x.IdPermohonan === p.id);
    if (!r) return ralat('Permohonan tidak dijumpai.');
    const o = {}; HEADER.PERMOHONAN.forEach(h => { o[h] = r[h]; });
    Object.assign(o, { __row: r.__row, NoKPGuru: "'" + digitSahaja(r.NoKPGuru), TarikhRekod: keTarikh(r.TarikhRekod) });
    if (p.catatan !== undefined) o.CatatanAdmin = String(p.catatan).slice(0, 500);
    if (p.tarikBalik) {
      if (r.Status !== 'DILULUSKAN') return ralat('Hanya permohonan yang diluluskan boleh ditarik balik.');
      o.Status = 'DITARIK BALIK'; o.TamatAkses = formatTarikhMasa(sekarang());
      o.CatatanAdmin = (o.CatatanAdmin ? o.CatatanAdmin + ' | ' : '') + 'Akses ditarik balik oleh ' + sesi.nama;
    }
    if (p.lanjutMinit) {
      if (r.Status !== 'DILULUSKAN') return ralat('Hanya permohonan yang diluluskan boleh dilanjutkan.');
      const n = Math.min(Math.max(Number(p.lanjutMinit) || 0, 10), 24 * 60);
      o.TamatAkses = formatTarikhMasa(new Date(sekarang().getTime() + n * 60000));
    }
    kemaskiniBaris(SHEET.PERMOHONAN, o);
    catatAudit(sesi, p.tarikBalik ? 'TARIK_BALIK_AKSES' : 'KEMASKINI_PERMOHONAN', r.IdPermohonan + ' ' + r.Kelas + ' ' + keTarikh(r.TarikhRekod));
    return jaya({ status: o.Status, tamatAkses: o.TamatAkses });
  });
}

/* ----------------------- AUDIT & TINDAKAN SISTEM ----------------------- */
function apiLogAudit(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const cari = String(p.cari || '').toUpperCase();
  const senarai = bacaSheetSebagaiObjek(SHEET.AUDIT).map(a => ({ masa: String(teksSelUrus(a.Masa, 'Masa')), nokp: digitSahaja(a.NoKP), nama: a.Nama, tindakan: a.Tindakan, butiran: a.Butiran }))
    .filter(a => !cari || (a.nama + ' ' + a.tindakan + ' ' + a.butiran + ' ' + a.nokp).toUpperCase().indexOf(cari) !== -1).reverse();
  return jaya({ senarai: senarai.slice(0, Math.min(Number(p.had) || 1000, 3000)), jumlah: senarai.length });
}

function apiTindakanSistem(p) {
  const sesi = wajibAdmin(p.token);
  if (gagal(sesi)) return sesi;
  const t = String(p.tindakan || '');
  let mesej = '';
  if (t === 'SEDIAKAN') { sediakanSistem(true); mesej = 'Struktur Sheet disemak — tab & lajur yang tiada telah ditambah.'; }
  else if (t === 'SEGAR') { segarSemulaSumberLuar(); mesej = 'Cache data e-Data / e-Teach-In / IDME dikosongkan. Data terkini akan dibaca semula.'; }
  else if (t === 'JANA_PETA') { const n = janaPetaKodKelas(); mesej = n + ' pemetaan kod kelas baharu ditulis. Semak tab Peta Kod.'; }
  else return ralat('Tindakan tidak dikenali.');
  catatAudit(sesi, 'SISTEM_' + t, mesej);
  return jaya({ mesej });
}
