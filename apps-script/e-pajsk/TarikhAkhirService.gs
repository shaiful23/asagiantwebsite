/* =========================================================================
 * TarikhAkhirService.gs — Tarikh akhir pengisian KGP, kunci pengisian dan
 * permohonan buka semula.
 *
 *  - Admin menetapkan TARIKH_AKHIR_PENGISIAN (Sheet TETAPAN, "yyyy-MM-dd HH:mm", zon masa skrip).
 *  - Selepas tarikh akhir, KGP tidak boleh menyimpan pentaksiran (apiSimpanPentaksiran / apiSimpanPukal)
 *    kecuali permohonan buka semulanya DILULUSKAN dan masih dalam tempoh "BukaHingga".
 *  - Admin tidak pernah dikunci. Guru Kelas sememangnya lihat sahaja.
 *  - Permohonan disimpan dalam Sheet PERMOHONAN_BUKA (satu baris setiap permohonan).
 * ========================================================================= */

const TET_TARIKH_AKHIR = 'TARIKH_AKHIR_PENGISIAN';
const HEADER_PERMOHONAN = ['ID', 'Tarikh', 'NoKP', 'Nama', 'Unit', 'Sebab', 'Status', 'BukaHingga', 'DiprosesOleh', 'TarikhProses', 'Catatan'];
const ST_MOHON_MENUNGGU = 'MENUNGGU';
const ST_MOHON_LULUS = 'LULUS';
const ST_MOHON_TOLAK = 'DITOLAK';
const ST_MOHON_TUTUP = 'DITUTUP';
const UNIT_SEMUA = 'SEMUA';

/* "yyyy-MM-dd HH:mm[:ss]" atau "yyyy-MM-dd" (zon masa skrip) -> milisaat; null jika kosong/tidak sah. */
function msDaripadaTeks(nilai) {
  if (nilai instanceof Date) return nilai.getTime();
  const m = String(nilai || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const p = n => String(n).padStart(2, '0');
  const teks = m[1] + '-' + p(m[2]) + '-' + p(m[3]) + ' ' + p(m[4] || 0) + ':' + p(m[5] || 0);
  const t = Utilities.parseDate(teks, zonMasa(), 'yyyy-MM-dd HH:mm');
  return isNaN(t.getTime()) ? null : t.getTime();
}

function teksDaripadaMs(ms) { return Utilities.formatDate(new Date(ms), zonMasa(), 'yyyy-MM-dd HH:mm'); }

function tarikhAkhirMs() { return msDaripadaTeks(dapatTetapan(TET_TARIKH_AKHIR)); }

function bacaPermohonan() { return bacaSheetSebagaiObjek(SHEET_PERMOHONAN); }

/* Bukaan (permohonan LULUS yang masih berkuat kuasa) bagi seorang pengguna. */
function bukaanAktif(nokp, sekarang) {
  return bacaPermohonan().filter(r => normalKP(r.NoKP) === nokp && r.Status === ST_MOHON_LULUS)
    .map(r => ({ id: r.ID, unit: String(r.Unit || ''), hinggaMs: msDaripadaTeks(r.BukaHingga) }))
    .filter(b => b.hinggaMs && b.hinggaMs > sekarang);
}

/* '' jika sesi boleh mengisi unit `kunciUnitIsi` sekarang; jika tidak, mesej ralat. */
function semakKunciPengisian(sesi, kunciUnitIsi) {
  if (sesi.peranan === ROLE_ADMIN) return '';
  const akhir = tarikhAkhirMs();
  const sekarang = Date.now();
  if (!akhir || sekarang <= akhir) return '';
  const dibuka = bukaanAktif(sesi.nokp, sekarang).some(b => b.unit === UNIT_SEMUA || b.unit === kunciUnitIsi);
  if (dibuka) return '';
  return 'Pengisian telah DIKUNCI kerana melepasi tarikh akhir (' + teksDaripadaMs(akhir) + '). ' +
    'Sila hantar permohonan buka semula kepada Admin melalui Dashboard / Pengisian Unit.';
}

/* Maklumat tarikh akhir untuk paparan (kiraan detik dibuat di pelayar menggunakan sekarangMs pelayan). */
function infoTarikhAkhir(sesi) {
  const akhir = tarikhAkhirMs();
  const sekarang = Date.now();
  const admin = sesi.peranan === ROLE_ADMIN;
  const info = {
    ada: !!akhir, akhirMs: akhir || null, akhirTeks: akhir ? teksDaripadaMs(akhir) : '',
    sekarangMs: sekarang, tamat: !!akhir && sekarang > akhir, terkesan: !admin && (sesi.unit || []).length > 0,
    bukaan: [], permohonanSaya: [], menunggu: 0
  };
  if (!akhir && !admin) return info;
  const semua = bacaPermohonan();
  if (admin) {
    info.menunggu = semua.filter(r => r.Status === ST_MOHON_MENUNGGU).length;
  } else {
    info.bukaan = bukaanAktif(sesi.nokp, sekarang).map(b => ({ unit: b.unit, hinggaMs: b.hinggaMs, hinggaTeks: teksDaripadaMs(b.hinggaMs) }));
    info.permohonanSaya = semua.filter(r => normalKP(r.NoKP) === sesi.nokp).slice(-5).reverse().map(ringkasPermohonan);
  }
  return info;
}

function ringkasPermohonan(r) {
  const hinggaMs = msDaripadaTeks(r.BukaHingga);
  return { id: r.ID, tarikh: r.Tarikh, nokp: normalKP(r.NoKP), nama: r.Nama, unit: r.Unit, sebab: r.Sebab, status: r.Status,
    bukaHingga: hinggaMs ? teksDaripadaMs(hinggaMs) : '', bukaHinggaMs: hinggaMs || 0, diprosesOleh: r.DiprosesOleh,
    tarikhProses: r.TarikhProses, catatan: r.Catatan };
}

function apiTarikhAkhir(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  return jaya({ tarikhAkhir: infoTarikhAkhir(sesi) });
}

/* Admin: tetapkan / kosongkan tarikh akhir. p.tarikh = "yyyy-MM-dd", p.masa = "HH:mm" (lalai 23:59). */
function apiSimpanTarikhAkhir(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const tarikh = String(p.tarikh || '').trim();
  let teks = '';
  if (tarikh) {
    const masa = String(p.masa || '23:59').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarikh) || !/^\d{1,2}:\d{2}$/.test(masa)) return ralat('Format tarikh / masa tidak sah.');
    const ms = msDaripadaTeks(tarikh + ' ' + masa);
    if (!ms) return ralat('Tarikh akhir tidak sah.');
    teks = teksDaripadaMs(ms);
  }
  return denganKunci(() => {
    tulisTetapan(TET_TARIKH_AKHIR, teks);
    catatAudit(sesi, 'KEMASKINI', 'TARIKH_AKHIR', '', teks ? 'Tarikh akhir pengisian: ' + teks : 'Tarikh akhir dikosongkan (tiada had)');
    return jaya({ tarikhAkhir: infoTarikhAkhir(sesi) });
  });
}

/* KGP: mohon buka semula pengisian. p.unit = kunci unit atau "SEMUA" (semua unit saya), p.sebab wajib. */
function apiMohonBuka(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (sesi.peranan === ROLE_ADMIN) return ralat('Admin tidak dikunci — tiada permohonan diperlukan.');
  if (!(sesi.unit || []).length) return ralat('Hanya Ketua Guru Penasihat boleh memohon buka semula pengisian.');
  const unit = String(p.unit || UNIT_SEMUA).trim();
  if (unit !== UNIT_SEMUA && sesi.unit.indexOf(unit) === -1) return ralat('Anda bukan Ketua Guru Penasihat bagi unit ini.');
  const sebab = String(p.sebab || '').trim().substring(0, 500);
  if (sebab.length < 5) return ralat('Sila nyatakan sebab permohonan (sekurang-kurangnya 5 aksara).');
  const akhir = tarikhAkhirMs();
  if (!akhir || Date.now() <= akhir) return ralat('Pengisian belum dikunci — tiada permohonan diperlukan.');
  return denganKunci(() => {
    const ada = bacaPermohonan().some(r => normalKP(r.NoKP) === sesi.nokp && r.Status === ST_MOHON_MENUNGGU && (r.Unit === unit || r.Unit === UNIT_SEMUA));
    if (ada) return ralat('Anda sudah mempunyai permohonan yang sedang menunggu kelulusan Admin untuk unit ini.');
    const id = janaId('MB');
    tambahBaris(SHEET_PERMOHONAN, { ID: id, Tarikh: sekarangTeks(), NoKP: sesi.nokp, Nama: sesi.nama, Unit: unit, Sebab: sebab, Status: ST_MOHON_MENUNGGU,
      BukaHingga: '', DiprosesOleh: '', TarikhProses: '', Catatan: '' });
    catatAudit(sesi, 'MOHON_BUKA', 'TARIKH_AKHIR', id, unit + ' — ' + sebab);
    return jaya({ id, tarikhAkhir: infoTarikhAkhir(sesi) });
  });
}

/* Admin: semua permohonan (menunggu dahulu, kemudian terbaharu). KGP: permohonan sendiri. */
function apiSenaraiPermohonan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const admin = sesi.peranan === ROLE_ADMIN;
  let senarai = bacaPermohonan().filter(r => admin || normalKP(r.NoKP) === sesi.nokp).map(ringkasPermohonan).reverse();
  const tapis = String(p.status || '').trim();
  if (tapis) senarai = senarai.filter(r => r.status === tapis);
  senarai.sort((a, b) => (a.status === ST_MOHON_MENUNGGU ? 0 : 1) - (b.status === ST_MOHON_MENUNGGU ? 0 : 1));
  const h = halamanKan(senarai, p, r => r.nama + ' ' + r.unit + ' ' + r.sebab);
  h.tarikhAkhir = infoTarikhAkhir(sesi);
  return jaya(h);
}

/* Admin: luluskan (dengan BukaHingga), tolak, atau tutup bukaan yang masih aktif. p.tindakan = LULUS | DITOLAK | DITUTUP. */
function apiProsesPermohonan(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const tindakan = String(p.tindakan || '').toUpperCase();
  if ([ST_MOHON_LULUS, ST_MOHON_TOLAK, ST_MOHON_TUTUP].indexOf(tindakan) === -1) return ralat('Tindakan tidak sah.');
  let hingga = '';
  if (tindakan === ST_MOHON_LULUS) {
    const ms = msDaripadaTeks(String(p.hingga || '').trim());
    if (!ms) return ralat('Sila tetapkan tarikh & masa pengisian dibuka sehingga.');
    if (ms <= Date.now()) return ralat('Tarikh "dibuka sehingga" mesti selepas masa sekarang.');
    hingga = teksDaripadaMs(ms);
  }
  const catatan = String(p.catatan || '').trim().substring(0, 300);
  return denganKunci(() => {
    const r = bacaSheetMentah(SHEET_PERMOHONAN).find(x => x.ID === p.id);
    if (!r) return ralat('Permohonan tidak dijumpai.');
    if (tindakan === ST_MOHON_TUTUP ? r.Status !== ST_MOHON_LULUS : r.Status !== ST_MOHON_MENUNGGU) {
      return ralat('Permohonan ini sudah diproses (' + r.Status + ').');
    }
    r.Status = tindakan;
    if (tindakan === ST_MOHON_LULUS) r.BukaHingga = hingga;
    if (tindakan === ST_MOHON_TUTUP) r.BukaHingga = sekarangTeks().substring(0, 16);
    r.DiprosesOleh = sesi.nama;
    r.TarikhProses = sekarangTeks();
    if (catatan) r.Catatan = catatan;
    kemaskiniBaris(SHEET_PERMOHONAN, r.__row, r);
    catatAudit(sesi, 'PROSES_PERMOHONAN', 'TARIKH_AKHIR', r.ID, tindakan + ' — ' + r.Nama + ' (' + r.Unit + ')' + (hingga ? ' hingga ' + hingga : ''));
    return jaya({ permohonan: ringkasPermohonan(r) });
  });
}
