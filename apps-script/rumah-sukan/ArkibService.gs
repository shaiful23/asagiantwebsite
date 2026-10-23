/* =========================================================================
 * ArkibService.gs — NAIK TINGKATAN & ARKIB.
 *
 * Naik tingkatan (Admin, hujung tahun):
 *   - Pratonton mengikut tingkatan semasa: setiap kumpulan diberi cadangan
 *     NAIK (cth. 1 -> 2, PERALIHAN -> 1, 6 RENDAH -> 6 ATAS), TAMAT (5, 6 ATAS:
 *     murid lepasan dipindah ke ARKIB_MURID) atau KEKAL. Admin boleh mengubah
 *     setiap cadangan sebelum menjalankan.
 *   - Dijalankan dalam SATU bacaan & SATU tulisan Sheet MURID (pantas & atomik
 *     di bawah kunci). Rumah sukan, kelas & No. Bib murid kekal.
 *   - Setiap perubahan direkod dalam SEJARAH_NAIK supaya proses terakhir boleh
 *     DIBATALKAN sepenuhnya.
 *
 * Arkib:
 *   - Murid lepasan / diarkibkan: cari, pulihkan ke senarai murid atau padam kekal.
 *   - Kejohanan tahun-tahun lepas: papan mata, olahragawan, pemenang & rekod.
 *   - Mula kejohanan tahun baharu (tahun + 1, salin acara & rekod).
 * ========================================================================= */

const SAH_NAIK = 'NAIK TINGKATAN';
const TINDAKAN_NAIK = ['NAIK', 'TAMAT', 'KEKAL'];

/* Cadangan bagi satu nilai tingkatan (format asal dikekalkan: "1" -> "2", "T1" -> "T2"). */
function cadanganNaik(tingkatan) {
  const s = String(tingkatan || '').trim().toUpperCase();
  if (!s) return { tindakan: 'KEKAL', baru: '', nota: 'Tingkatan kosong — kemas kini rekod murid' };
  if (/PERALIHAN|^PR(A)?\b|^PRA$/.test(s)) return { tindakan: 'NAIK', baru: '1', nota: '' };
  if (/RENDAH|BAWAH/.test(s)) return { tindakan: 'NAIK', baru: s.replace(/RENDAH|BAWAH/, 'ATAS'), nota: '' };
  if (/^6\s*[RB]$/.test(s)) return { tindakan: 'NAIK', baru: s.replace(/[RB]$/, 'A'), nota: '' };
  if (/ATAS/.test(s) || /^6\s*A$/.test(s)) return { tindakan: 'TAMAT', baru: '', nota: 'Tamat Tingkatan 6' };
  const m = s.match(/\d/);
  if (!m) return { tindakan: 'KEKAL', baru: '', nota: 'Tidak dikenali — pilih tindakan sendiri' };
  const n = Number(m[0]);
  if (n >= 1 && n <= 4) return { tindakan: 'NAIK', baru: s.replace(/\d/, String(n + 1)), nota: '' };
  if (n === 5) return { tindakan: 'TAMAT', baru: '', nota: 'Tamat SPM' };
  if (n === 6) return { tindakan: 'KEKAL', baru: '', nota: '6 Rendah atau 6 Atas? Pilih tindakan sendiri' };
  return { tindakan: 'KEKAL', baru: '', nota: 'Tidak dikenali — pilih tindakan sendiri' };
}

function normalTingkatanKunci(t) { return String(t || '').trim().toUpperCase(); }

/* Ringkasan setiap proses naik tingkatan (terbaru dahulu). */
function senaraiProsesNaik() {
  const ikut = {};
  bacaSheetSebagaiObjek(SHEET_SEJARAH_NAIK).forEach(r => {
    if (!r.IdNaik) return;
    const o = ikut[r.IdNaik] = ikut[r.IdNaik] || { id: String(r.IdNaik), tahun: String(r.Tahun || ''), masa: String(r.Masa || ''), oleh: String(r.Oleh || ''), naik: 0, tamat: 0, status: 'AKTIF' };
    if (r.Tindakan === 'NAIK') o.naik++; else if (r.Tindakan === 'TAMAT') o.tamat++;
    if (r.Status === 'DIBATALKAN') o.status = 'DIBATALKAN';
  });
  return Object.keys(ikut).map(k => ikut[k]).sort((a, b) => b.masa.localeCompare(a.masa));
}

function apiPratontonNaik(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const kumpulan = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (!m.NoKP) return;
    const k = normalTingkatanKunci(m.Tingkatan);
    const g = kumpulan[k] = kumpulan[k] || { tingkatan: k, bil: 0, tidakAktif: 0, kelas: {} };
    g.bil++;
    if (String(m.Status || 'AKTIF').toUpperCase() === 'TIDAK AKTIF') g.tidakAktif++;
    g.kelas[String(m.Kelas || '').trim().toUpperCase() || '-'] = true;
  });
  const senarai = Object.keys(kumpulan).map(k => {
    const g = kumpulan[k];
    return Object.assign({ tingkatan: g.tingkatan, bil: g.bil, tidakAktif: g.tidakAktif, kelas: Object.keys(g.kelas).sort(susunNatural) }, cadanganNaik(g.tingkatan));
  }).sort((a, b) => susunNatural(a.tingkatan, b.tingkatan));
  const proses = senaraiProsesNaik();
  const tahun = new Date().getFullYear();
  const akhir = proses.find(x => x.status === 'AKTIF') || null;
  return jaya({ senarai, tahun, proses: proses.slice(0, 10), sudahTahunIni: !!(akhir && akhir.tahun === String(tahun)), akhir });
}

function susunNatural(a, b) { return String(a).localeCompare(String(b), 'ms', { numeric: true }); }

/* p = { peta: { "<tingkatan>": {tindakan, baru} }, tahun, sah: "NAIK TINGKATAN" } */
function apiJalankanNaik(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  if (String(p.sah || '').trim().toUpperCase() !== SAH_NAIK) return ralat('Taip "' + SAH_NAIK + '" untuk mengesahkan.');
  const peta = {};
  const masuk = p.peta || {};
  for (const k of Object.keys(masuk)) {
    const t = String((masuk[k] || {}).tindakan || '').toUpperCase(), baru = teksBersih((masuk[k] || {}).baru).toUpperCase();
    if (TINDAKAN_NAIK.indexOf(t) === -1) return ralat('Tindakan tidak sah bagi tingkatan ' + k + '.');
    if (t === 'NAIK' && !baru) return ralat('Nyatakan tingkatan baharu bagi ' + (k || '(kosong)') + '.');
    if (t === 'NAIK' && baru === normalTingkatanKunci(k)) return ralat('Tingkatan baharu bagi ' + k + ' sama dengan tingkatan semasa.');
    peta[normalTingkatanKunci(k)] = { tindakan: t, baru: baru };
  }
  const tahun = Number(p.tahun) > 2000 ? Number(p.tahun) : new Date().getFullYear();
  return denganKunci(() => {
    const sh = dapatkanSheet(SHEET_MURID);
    const nilai = cubaSemula(() => sh.getDataRange().getValues());
    if (nilai.length < 2) return ralat('Tiada murid.');
    const header = nilai[0].map(String);
    const iKP = header.indexOf('NoKP'), iT = header.indexOf('Tingkatan'), iNama = header.indexOf('NamaPenuh'), iDk = header.indexOf('Dikemaskini');
    const idNaik = janaId('NK'), masa = sekarangTeks(), oleh = sesi.nama || sesi.nokp;
    const kekal = [nilai[0]], arkib = [], sejarah = [];
    let bilNaik = 0;
    for (let r = 1; r < nilai.length; r++) {
      const baris = nilai[r];
      if (!String(baris[iKP] || '').trim()) continue;   // baris kosong dibuang semasa tulis semula
      const lama = normalTingkatanKunci(baris[iT]);
      const tindak = peta[lama] || { tindakan: 'KEKAL' };
      const rek = { Id: janaId('SN'), IdNaik: idNaik, Tahun: String(tahun), NoKP: String(baris[iKP]), Nama: String(baris[iNama] || ''), TingkatanLama: String(baris[iT] || ''),
        TingkatanBaru: '', Tindakan: tindak.tindakan, Masa: masa, Oleh: oleh, Status: 'AKTIF' };
      if (tindak.tindakan === 'TAMAT') {
        const o = {};
        header.forEach((h, c) => { o[h] = baris[c]; });
        arkib.push(Object.assign(o, { TahunTamat: String(tahun), TarikhArkib: masa, IdNaik: idNaik, Sebab: 'TAMAT PERSEKOLAHAN' }));
        sejarah.push(rek);
        continue;
      }
      if (tindak.tindakan === 'NAIK') {
        baris[iT] = tindak.baru;
        if (iDk !== -1) baris[iDk] = masa;
        rek.TingkatanBaru = tindak.baru;
        sejarah.push(rek);
        bilNaik++;
      }
      kekal.push(baris);
    }
    if (!sejarah.length) return ralat('Tiada perubahan — semua kumpulan ditetapkan KEKAL.');
    // arkib & sejarah ditulis DAHULU (jika gagal, MURID belum diubah)
    if (arkib.length) tulisBarisBaharu(SHEET_ARKIB_MURID, arkib);
    tulisBarisBaharu(SHEET_SEJARAH_NAIK, sejarah);
    tulisSemulaSheet(sh, nilai.length, kekal);
    tandaKotor(SHEET_MURID);
    catatAudit(sesi, 'NAIK_TINGKATAN', 'MURID', idNaik, bilNaik + ' naik tingkatan, ' + arkib.length + ' tamat (diarkibkan) · tahun ' + tahun);
    return jaya({ id: idNaik, naik: bilNaik, tamat: arkib.length });
  });
}

/* Tulis semula keseluruhan data Sheet (header + baris) dalam satu operasi; baris lebihan dikosongkan. */
function tulisSemulaSheet(sh, bilBarisLama, baris) {
  const lebar = baris[0].length;
  formatLajurTeks(sh, 2, Math.max(baris.length - 1, 1));
  cubaSemula(() => sh.getRange(1, 1, baris.length, lebar).setValues(baris));
  if (bilBarisLama > baris.length) sh.getRange(baris.length + 1, 1, bilBarisLama - baris.length, lebar).clearContent();
}

/* Batal proses naik tingkatan TERAKHIR yang masih aktif. */
function apiBatalNaik(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const proses = senaraiProsesNaik();
    const akhir = proses.find(x => x.status === 'AKTIF');
    if (!akhir || akhir.id !== p.id) return ralat('Hanya proses naik tingkatan yang terakhir boleh dibatalkan.');
    const rekod = bacaSheetSebagaiObjek(SHEET_SEJARAH_NAIK).filter(r => r.IdNaik === akhir.id);
    const naik = {}, tamat = {};
    rekod.forEach(r => { if (r.Tindakan === 'NAIK') naik[normalKP(r.NoKP)] = r; else if (r.Tindakan === 'TAMAT') tamat[normalKP(r.NoKP)] = true; });

    // 1) pulihkan tingkatan murid yang dinaikkan
    const sh = dapatkanSheet(SHEET_MURID);
    const nilai = cubaSemula(() => sh.getDataRange().getValues());
    const header = nilai[0].map(String);
    const iKP = header.indexOf('NoKP'), iT = header.indexOf('Tingkatan');
    const ada = {};
    let dipulih = 0;
    for (let r = 1; r < nilai.length; r++) {
      const kp = normalKP(nilai[r][iKP]);
      if (!kp) continue;
      ada[kp] = true;
      if (naik[kp]) { nilai[r][iT] = String(naik[kp].TingkatanLama || ''); dipulih++; }
    }
    // 2) murid lepasan dikembalikan daripada arkib
    const shA = dapatkanSheet(SHEET_ARKIB_MURID);
    const nilaiA = cubaSemula(() => shA.getDataRange().getValues());
    const headerA = nilaiA[0].map(String), iKPA = headerA.indexOf('NoKP'), iIdA = headerA.indexOf('IdNaik');
    const tinggalA = [nilaiA[0]];
    let dikembali = 0;
    for (let r = 1; r < nilaiA.length; r++) {
      const kp = normalKP(nilaiA[r][iKPA]);
      if (!kp) continue;
      if (String(nilaiA[r][iIdA]) === akhir.id && tamat[kp]) {
        if (!ada[kp]) { nilai.push(header.map(h => { const c = headerA.indexOf(h); return c === -1 ? '' : nilaiA[r][c]; })); ada[kp] = true; dikembali++; }
        continue;
      }
      tinggalA.push(nilaiA[r]);
    }
    tulisSemulaSheet(sh, nilai.length, nilai);
    tulisSemulaSheet(shA, nilaiA.length, tinggalA);
    tandaKotor(SHEET_MURID); tandaKotor(SHEET_ARKIB_MURID);
    upsertBanyak(SHEET_SEJARAH_NAIK, 'Id', rekod.map(r => ({ Id: r.Id, Status: 'DIBATALKAN' })));
    catatAudit(sesi, 'BATAL_NAIK_TINGKATAN', 'MURID', akhir.id, dipulih + ' tingkatan dipulihkan, ' + dikembali + ' murid dikembalikan daripada arkib');
    return jaya({ dipulih, dikembali });
  });
}

/* ------------------------- ARKIB MURID ------------------------- */
function arkibMuridKeKlien(m, rumah) {
  const r = rumah[m.RumahId];
  return { nokp: normalKP(m.NoKP), nama: m.NamaPenuh || '', jantina: m.Jantina || jantinaDaripadaKP(m.NoKP), tingkatan: String(m.Tingkatan || ''), kelas: String(m.Kelas || ''),
    rumah: r ? r.nama : '', warna: r ? r.warna : '', tahunTamat: String(m.TahunTamat || ''), tarikh: String(m.TarikhArkib || ''), sebab: String(m.Sebab || ''), bib: String(m.NoBib || '') };
}

function apiArkib(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const admin = sesi.admin;
  const tahunAcara = {};
  bacaSheetSebagaiObjek(SHEET_ACARA).forEach(a => { if (a.AcaraId && nombor(a.Tahun, 0)) tahunAcara[nombor(a.Tahun, 0)] = (tahunAcara[nombor(a.Tahun, 0)] || 0) + 1; });
  const hasil = { admin: !!admin, tahunSemasa: tahunKejohanan(), tahunKejohanan: Object.keys(tahunAcara).map(Number).sort((a, b) => b - a).map(t => ({ tahun: t, bilAcara: tahunAcara[t] })) };
  if (admin) {
    const rumah = petaRumah();
    hasil.murid = bacaSheetSebagaiObjek(SHEET_ARKIB_MURID).filter(m => m.NoKP).map(m => arkibMuridKeKlien(m, rumah))
      .sort((a, b) => b.tahunTamat.localeCompare(a.tahunTamat) || susunNatural(a.tingkatan + ' ' + a.kelas, b.tingkatan + ' ' + b.kelas) || a.nama.localeCompare(b.nama));
    hasil.proses = senaraiProsesNaik().slice(0, 10);
  }
  return jaya(hasil);
}

/* Pulihkan murid daripada arkib ke senarai murid aktif. p = { nokp: [..] } */
function apiPulihkanArkib(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const pilih = {};
  (p.nokp || []).forEach(k => { pilih[normalKP(k)] = true; });
  if (!Object.keys(pilih).length) return ralat('Pilih sekurang-kurangnya seorang murid.');
  return denganKunci(() => {
    const sh = dapatkanSheet(SHEET_MURID), shA = dapatkanSheet(SHEET_ARKIB_MURID);
    const nilai = cubaSemula(() => sh.getDataRange().getValues()), nilaiA = cubaSemula(() => shA.getDataRange().getValues());
    const header = nilai[0].map(String), headerA = nilaiA[0].map(String);
    const iKP = header.indexOf('NoKP'), iKPA = headerA.indexOf('NoKP'), iSt = header.indexOf('Status'), iDk = header.indexOf('Dikemaskini');
    const ada = {};
    for (let r = 1; r < nilai.length; r++) ada[normalKP(nilai[r][iKP])] = true;
    const tinggal = [nilaiA[0]], wujud = [];
    let bil = 0;
    for (let r = 1; r < nilaiA.length; r++) {
      const kp = normalKP(nilaiA[r][iKPA]);
      if (!kp) continue;
      if (pilih[kp]) {
        if (ada[kp]) { wujud.push(kp); tinggal.push(nilaiA[r]); continue; }
        const baris = header.map(h => { const c = headerA.indexOf(h); return c === -1 ? '' : nilaiA[r][c]; });
        if (iSt !== -1) baris[iSt] = 'AKTIF';
        if (iDk !== -1) baris[iDk] = sekarangTeks();
        nilai.push(baris); ada[kp] = true; bil++;
        continue;
      }
      tinggal.push(nilaiA[r]);
    }
    if (!bil) return ralat(wujud.length ? 'Murid ini sudah wujud dalam senarai murid aktif.' : 'Murid tidak dijumpai dalam arkib.');
    tulisSemulaSheet(sh, nilai.length, nilai);
    tulisSemulaSheet(shA, nilaiA.length, tinggal);
    tandaKotor(SHEET_MURID); tandaKotor(SHEET_ARKIB_MURID);
    catatAudit(sesi, 'PULIH_ARKIB_MURID', 'MURID', '', bil + ' murid dipulihkan daripada arkib');
    return jaya({ bil, wujud: wujud.length });
  });
}

/* Padam kekal rekod arkib. p = { nokp: [..], sah: "PADAM" } */
function apiPadamArkib(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  if (String(p.sah || '').trim().toUpperCase() !== 'PADAM') return ralat('Taip "PADAM" untuk mengesahkan.');
  const pilih = {};
  (p.nokp || []).forEach(k => { pilih[normalKP(k)] = true; });
  if (!Object.keys(pilih).length) return ralat('Pilih sekurang-kurangnya seorang murid.');
  return denganKunci(() => {
    const shA = dapatkanSheet(SHEET_ARKIB_MURID);
    const nilaiA = cubaSemula(() => shA.getDataRange().getValues());
    const iKPA = nilaiA[0].map(String).indexOf('NoKP');
    const tinggal = nilaiA.filter((b, i) => i === 0 || (normalKP(b[iKPA]) && !pilih[normalKP(b[iKPA])]));
    const bil = nilaiA.length - tinggal.length - nilaiA.slice(1).filter(b => !normalKP(b[iKPA])).length;
    tulisSemulaSheet(shA, nilaiA.length, tinggal);
    tandaKotor(SHEET_ARKIB_MURID);
    catatAudit(sesi, 'PADAM_ARKIB_MURID', 'MURID', '', bil + ' rekod arkib dipadam kekal');
    return jaya({ bil });
  });
}

/* ------------------------- ARKIB KEJOHANAN ------------------------- */
function apiArkibKejohanan(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const tahun = nombor(p.tahun, 0);
  if (!tahun) return ralat('Pilih tahun kejohanan.');
  const acara = acaraTahun(tahun);
  if (!acara.length) return ralat('Tiada rekod kejohanan bagi tahun ' + tahun + '.');
  const peserta = pesertaTahun(tahun), mataLain = mataLainTahun(tahun);
  const murid = petaMuridRingkas(), rumahSenarai = senaraiRumah(), rumah = petaRumah();
  const ked = kiraKedudukan(acara, peserta, mataLain, rumahSenarai, murid, konfigKategori().senarai);
  const ikut = {};
  peserta.forEach(x => { if (x.Pusingan === 'AKHIR') (ikut[x.AcaraId] = ikut[x.AcaraId] || []).push(x); });
  const senaraiAcara = acara.map(a => {
    const k = acaraKeKlien(a);
    k.podium = (ikut[a.AcaraId] || []).filter(x => nombor(x.Kedudukan, 0) >= 1 && nombor(x.Kedudukan, 0) <= 3)
      .map(x => butiranPeserta(x, murid, rumah)).sort((x, y) => x.kedudukan - y.kedudukan)
      .map(x => ({ kedudukan: x.kedudukan, nama: x.nama, ahli: x.ahli, kelas: x.kelas, rumah: x.rumah, warna: x.warna, keputusan: x.keputusan, rekodBaharu: x.rekodBaharu }));
    return k;
  });
  return jaya({
    tahun, semasa: tahun === tahunKejohanan(),
    kedudukan: ked.rumah, olahragawan: ked.olahragawan.map(o => Object.assign(o, { calon: o.calon.map(c => Object.assign(c, { rumah: (rumah[c.rumahId] || {}).nama || '', warna: (rumah[c.rumahId] || {}).warna || '' })) })),
    acara: senaraiAcara, bilAcara: acara.length, selesai: acara.filter(a => a.Status === 'SELESAI').length,
    rekodBaharu: senaraiAcara.filter(a => a.podium.some(x => x.rekodBaharu)).length,
    mataLain: mataLain.map(m => ({ perkara: m.Perkara, rumah: (rumah[m.RumahId] || {}).nama || '', mata: nombor(m.Mata, 0), catatan: m.Catatan || '' }))
  });
}

/* Mula kejohanan tahun baharu. p = { tahun, salinAcara } */
function apiMulaTahunBaharu(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const semasa = tahunKejohanan();
  const tahun = nombor(p.tahun, 0);
  if (tahun <= semasa || tahun > semasa + 5) return ralat('Tahun baharu mesti selepas ' + semasa + '.');
  return denganKunci(() => {
    const peta = {};
    peta[TET_TAHUN] = String(tahun);
    [TET_TARIKH_KEJOHANAN, TET_TARIKH_PADANG, TET_TARIKH_BALAPAN1, TET_TARIKH_BALAPAN2].forEach(k => { peta[k] = ''; });
    peta[TET_PENDAFTARAN] = 'TUTUP';
    peta[TET_TERBIT] = 'TIDAK';
    simpanTetapan(peta);
    let disalin = 0;
    if (p.salinAcara) disalin = salinAcaraDalaman(tetKejohanan()).bil;
    catatAudit(sesi, 'MULA_TAHUN_BAHARU', 'KEJOHANAN', String(tahun), 'Kejohanan ' + semasa + ' diarkibkan; ' + disalin + ' acara disalin ke ' + tahun);
    return jaya({ tahun, disalin, tahunLama: semasa });
  });
}
