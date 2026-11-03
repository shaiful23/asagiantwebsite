/* =========================================================================
 * PematuhanGuruService.gs — analisis guru MP & guru teach-in MASUK / TIDAK
 * MASUK kelas (paparan ADMIN sahaja).
 *
 * Sesi dijangka  = setiap blok jadual waktu (e-Teach-In) pada hari persekolahan
 *                  yang sudah berlalu, ditambah tugasan teach-in (Rekod_TeachIn).
 * Sesi direkod   = imbasan QR guru dalam LOG_KEHADIRAN_SUBJEK (kelas + tarikh + masa).
 * Status         = TEPAT MASA | LEWAT | TIDAK MASUK | DIGANTI (guru asal tiada di
 *                  sekolah & ada guru teach-in) | DIKECUALIKAN (cuti sekolah, tingkatan
 *                  tidak hadir, atau pengecualian admin cth. kursus).
 * Kadar pematuhan = (tepat + lewat) / (dijangka − diganti − dikecualikan).
 * ========================================================================= */

function wajibAdminPematuhan(token) { return wajibSesi(token, { jenis: 'GURU', peranan: [PERANAN.ADMIN] }); }

/* Senarai julat cuti sekolah (Sheet CUTI_SEKOLAH). */
function senaraiCutiSekolah() {
  return bacaSheetSebagaiObjek(SHEET.CUTI).map(c => ({ id: c.IdCuti, mula: keTarikh(c.TarikhMula), tamat: keTarikh(c.TarikhTamat || c.TarikhMula), catatan: String(c.Catatan || '') }))
    .filter(c => c.mula);
}
function cutiSekolahPada(tarikh, senarai) {
  return (senarai || senaraiCutiSekolah()).find(c => tarikh >= c.mula && tarikh <= c.tamat) || null;
}

/* Padankan nama guru dalam jadual/teach-in dengan akaun guru (memo per nama). */
function pemadanGuru() {
  const guru = senaraiGuru(), memo = {};
  return (nokp, nama) => {
    if (digitSahaja(nokp)) { const g = guru.find(x => samaNoKP(x.NoKP, nokp)); if (g) return g; }
    const k = String(nama || '').toUpperCase().trim();
    if (!k) return null;
    if (!(k in memo)) memo[k] = guru.find(x => namaSepadan(x.NamaDalamJadual || x.Nama, k) || (x.NamaDalamJadual && namaSepadan(x.Nama, k))) || null;
    return memo[k];
  };
}

/* Bina senarai sesi dijangka + status bagi julat tarikh [dari, hingga]. */
function sesiPematuhan(dari, hingga) {
  const kini = sekarang(), hariIni = formatTarikh(kini), masaKini = formatMasa(kini);
  const hariSek = senaraiDaripadaMedan(tetapan('HARI_PERSEKOLAHAN'));
  const toleransi = Number(tetapan('TOLERANSI_LEWAT_MINIT') || 10);
  const cuti = senaraiCutiSekolah(), padan = pemadanGuru();
  const jadual = senaraiJadual(), teachIn = senaraiTeachIn().filter(t => t.Tarikh >= dari && t.Tarikh <= hingga && t.Kelas);
  const pengecualian = bacaSheetSebagaiObjek(SHEET.PENGECUALIAN).map(x => ({ id: x.IdPengecualian, tarikh: keTarikh(x.Tarikh), masa: keHHmm(x.Masa),
    kelas: normalKelas(x.Kelas), nokp: digitSahaja(x.NoKPGuru), nama: String(x.NamaGuru || ''), sebab: String(x.Sebab || '') }))
    .filter(x => x.tarikh >= dari && x.tarikh <= hingga);
  const tingkatanKelas = {}; senaraiKelas().forEach(k => { tingkatanKelas[k.kelas] = String(k.tingkatan || ''); });

  /* Indeks log: tarikh|kelas → [log] */
  const log = {};
  bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).forEach(l => {
    const t = keTarikh(l.Tarikh); if (t < dari || t > hingga) return;
    const k = t + '|' + normalKelas(l.Kelas);
    (log[k] = log[k] || []).push({ id: l.IdLog, slot: keHHmm(l.Slot), nokp: digitSahaja(l.NoKPGuru), nama: String(l.NamaGuru || ''), jenis: String(l.Jenis || ''),
      status: String(l.StatusMasa || ''), masa: String(l.Masa || ''), subjek: String(l.Subjek || ''), dipakai: false });
  });
  const milik = (l, g, nama) => (g && l.nokp && samaNoKP(l.nokp, g.NoKP)) || (!l.nokp || !g ? namaSepadan(l.nama, nama) : false);
  const cariLog = (tarikh, kelas, mula, tamat, g, nama) => {
    const senarai = log[tarikh + '|' + kelas] || [];
    const mm = minitDaripadaHHmm(mula), tt = tamat ? minitDaripadaHHmm(tamat) : mm + 60;
    return senarai.find(l => !l.dipakai && milik(l, g, nama) && l.slot === mula)
      || senarai.find(l => !l.dipakai && milik(l, g, nama) && l.slot && minitDaripadaHHmm(l.slot) >= mm - 10 && minitDaripadaHHmm(l.slot) < tt) || null;
  };
  const statusLog = (l, mula) => {
    if (/LEWAT/.test(l.status)) return 'LEWAT';
    if (/TEPAT/.test(l.status)) return 'TEPAT MASA';
    const jam = (l.masa.match(/(\d{1,2}):(\d{2})/) || []);
    return jam.length && (Number(jam[1]) * 60 + Number(jam[2]) - minitDaripadaHHmm(mula)) > toleransi ? 'LEWAT' : 'TEPAT MASA';
  };
  const dikecualikan = (tarikh, mula, kelas, g, nama) => pengecualian.find(x => x.tarikh === tarikh && (!x.masa || x.masa === mula) && (!x.kelas || x.kelas === kelas)
    && ((x.nokp && g && samaNoKP(x.nokp, g.NoKP)) || (!x.nokp && x.nama && namaSepadan(x.nama, nama)) || (!x.nokp && !x.nama)));

  const sesi = [];
  for (let d = dari; d <= hingga; d = tambahHari(d, 1)) {
    if (d > hariIni) break;
    const hari = hariBagiTarikh(d);
    if (hariSek.indexOf(hari) === -1) continue;
    const cutiHari = cutiSekolahPada(d, cuti), cutiT = tingkatanCutiPada(d);
    const tiHari = teachIn.filter(t => t.Tarikh === d);
    const tambah = (o) => {
      const g = o.guru;
      const s = { tarikh: d, hari, mula: o.mula, tamat: o.tamat || '', kelas: o.kelas, subjek: o.subjek, jenis: o.jenis,
        nokp: g ? digitSahaja(g.NoKP) : '', guru: g ? g.Nama : o.nama, namaJadual: o.nama, guruAsal: o.guruAsal || '', status: '', catatan: '', idLog: '', idPengecualian: '' };
      const berlalu = d < hariIni || (o.tamat ? o.tamat <= masaKini : o.mula <= masaKini);
      const ex = dikecualikan(d, o.mula, o.kelas, g, o.nama);
      if (cutiHari) { s.status = 'DIKECUALIKAN'; s.catatan = 'Cuti sekolah' + (cutiHari.catatan ? ': ' + cutiHari.catatan : ''); }
      else if (cutiT[tingkatanKelas[o.kelas] || String(o.kelas).charAt(0)]) { s.status = 'DIKECUALIKAN'; s.catatan = 'Tingkatan tidak hadir: ' + cutiT[tingkatanKelas[o.kelas] || String(o.kelas).charAt(0)]; }
      else if (o.ganti) { s.status = 'DIGANTI'; s.catatan = 'Guru teach-in: ' + o.ganti; }
      else {
        const l = cariLog(d, o.kelas, o.mula, o.tamat, g, o.nama);
        if (l) { l.dipakai = true; s.status = statusLog(l, o.mula); s.idLog = l.id; s.catatan = 'Imbas ' + (l.masa.split(' ')[1] || l.masa); }
        else if (ex) { s.status = 'DIKECUALIKAN'; s.catatan = ex.sebab || 'Dikecualikan admin'; s.idPengecualian = ex.id; }
        else if (!berlalu) return;
        else {
          s.status = 'TIDAK MASUK';
          const lain = (log[d + '|' + o.kelas] || []).find(x => !x.dipakai && x.slot === o.mula);
          if (lain) s.catatan = 'Kelas direkod oleh ' + lain.nama;
        }
      }
      sesi.push(s);
    };
    /* Teach-in: guru teach-in dijangka masuk; guru asal ditanda DIGANTI. */
    tiHari.forEach(t => tambah({ mula: t.MasaMula || t.Slot, tamat: t.MasaTamat, kelas: t.Kelas, subjek: t.Subjek || 'TEACH-IN', jenis: 'TEACH-IN',
      guru: padan(t.NoKPGuruGanti, t.NamaGuruGanti), nama: t.NamaGuruGanti, guruAsal: t.NamaGuruAsal }));
    jadual.filter(j => j.Hari === hari && j.Kelas).forEach(j => {
      const g = padan(j.NoKPGuru, j.NamaGuru);
      const ti = tiHari.find(t => t.Kelas === j.Kelas && (t.MasaMula || t.Slot) && minitDaripadaHHmm(t.MasaMula || t.Slot) >= minitDaripadaHHmm(j.MasaMula)
        && minitDaripadaHHmm(t.MasaMula || t.Slot) < minitDaripadaHHmm(j.MasaTamat || j.MasaMula) + (j.MasaTamat ? 0 : 1)
        && (!t.NamaGuruAsal || namaSepadan(t.NamaGuruAsal, j.NamaGuru) || (g && namaSepadan(t.NamaGuruAsal, g.Nama)) || (t.NoKPGuruAsal && g && samaNoKP(t.NoKPGuruAsal, g.NoKP))));
      tambah({ mula: j.MasaMula, tamat: j.MasaTamat, kelas: j.Kelas, subjek: j.Subjek, jenis: 'JADUAL', guru: g, nama: j.NamaGuru, ganti: ti ? ti.NamaGuruGanti : '' });
    });
  }
  return sesi.sort((a, b) => (a.tarikh + a.mula + a.kelas).localeCompare(b.tarikh + b.mula + b.kelas));
}

function ringkasSesi(senarai) {
  const o = { dijangka: senarai.length, tepat: 0, lewat: 0, tidakMasuk: 0, diganti: 0, dikecualikan: 0 };
  senarai.forEach(s => {
    if (s.status === 'TEPAT MASA') o.tepat++; else if (s.status === 'LEWAT') o.lewat++; else if (s.status === 'TIDAK MASUK') o.tidakMasuk++;
    else if (s.status === 'DIGANTI') o.diganti++; else if (s.status === 'DIKECUALIKAN') o.dikecualikan++;
  });
  o.direkod = o.tepat + o.lewat; o.dikira = o.direkod + o.tidakMasuk;
  o.kadar = o.dikira ? bulatPeratus(o.direkod, o.dikira) : 0;
  o.kadarTepat = o.direkod ? bulatPeratus(o.tepat, o.direkod) : 0;
  return o;
}

function apiAnalisisPematuhanGuru(p) {
  const sesiA = wajibAdminPematuhan(p.token);
  if (gagal(sesiA)) return sesiA;
  const bulan = /^\d{4}-\d{2}$/.test(String(p.bulan || '')) ? p.bulan : tarikhHariIni().slice(0, 7);
  const [y, m] = bulan.split('-').map(Number);
  const dari = bulan + '-01', hingga = bulan + '-' + ('0' + new Date(y, m, 0).getDate()).slice(-2);
  let semua = sesiPematuhan(dari, hingga);
  const guruPilih = String(p.guru || '').trim();
  const senaraiPilihanGuru = Array.from(new Set(semua.map(s => s.guru).filter(Boolean))).sort();
  if (guruPilih) semua = semua.filter(s => s.guru === guruPilih);
  const jenisPilih = String(p.jenis || '').toUpperCase();
  if (jenisPilih === 'JADUAL' || jenisPilih === 'TEACH-IN') semua = semua.filter(s => s.jenis === jenisPilih);

  const kad = ringkasSesi(semua);
  const ti = ringkasSesi(semua.filter(s => s.jenis === 'TEACH-IN'));
  kad.teachInDijangka = ti.dikira; kad.teachInMasuk = ti.direkod; kad.teachInKadar = ti.kadar;
  kad.guru = new Set(semua.map(s => s.guru)).size;
  kad.guruTidakMasuk = new Set(semua.filter(s => s.status === 'TIDAK MASUK').map(s => s.guru)).size;
  /* Bulan lalu untuk perbandingan (hanya jika tiada penapis guru) */
  if (!guruPilih && !jenisPilih) {
    const lalu = new Date(y, m - 2, 1), bl = lalu.getFullYear() + '-' + ('0' + (lalu.getMonth() + 1)).slice(-2);
    try { kad.kadarBulanLalu = ringkasSesi(sesiPematuhan(bl + '-01', bl + '-' + ('0' + new Date(lalu.getFullYear(), lalu.getMonth() + 1, 0).getDate()).slice(-2))).kadar; } catch (e) { kad.kadarBulanLalu = null; }
  }

  const kumpul = (fn) => {
    const o = {};
    semua.forEach(s => { const k = fn(s); if (!k) return; (o[k] = o[k] || []).push(s); });
    return Object.keys(o).map(k => Object.assign({ label: k }, ringkasSesi(o[k])));
  };
  const perGuru = kumpul(s => s.guru).map(g => {
    const contoh = semua.find(s => s.guru === g.label);
    const t = semua.filter(s => s.guru === g.label && s.jenis === 'TEACH-IN');
    return Object.assign(g, { nokp: contoh.nokp, berakaun: !!contoh.nokp, teachIn: t.filter(s => s.status !== 'DIKECUALIKAN').length,
      teachInMasuk: t.filter(s => s.status === 'TEPAT MASA' || s.status === 'LEWAT').length });
  }).sort((a, b) => a.kadar - b.kadar || b.tidakMasuk - a.tidakMasuk || a.label.localeCompare(b.label));

  const hariSek = senaraiDaripadaMedan(tetapan('HARI_PERSEKOLAHAN'));
  const tidakMasuk = semua.filter(s => s.status === 'TIDAK MASUK');
  const masaUnik = Array.from(new Set(semua.map(s => s.mula).filter(Boolean))).sort();
  const haba = {}; tidakMasuk.forEach(s => { const k = s.hari + '|' + s.mula; haba[k] = (haba[k] || 0) + 1; });
  const harian = {}; semua.forEach(s => { (harian[s.tarikh] = harian[s.tarikh] || []).push(s); });

  return jaya({
    bulan, labelBulan: BULAN_MS[m - 1] + ' ' + y, kad,
    trendHarian: Object.keys(harian).sort().map(t => Object.assign({ tarikh: t }, ringkasSesi(harian[t]))),
    perGuru, perSubjek: kumpul(s => s.subjek).sort((a, b) => b.tidakMasuk - a.tidakMasuk),
    perKelas: kumpul(s => s.kelas).sort((a, b) => b.tidakMasuk - a.tidakMasuk),
    perHari: hariSek.map(h => Object.assign({ label: h }, ringkasSesi(semua.filter(s => s.hari === h)))),
    perMasa: kumpul(s => s.mula).sort((a, b) => a.label.localeCompare(b.label)),
    petaHaba: { hari: hariSek, masa: masaUnik, nilai: hariSek.map(h => masaUnik.map(ms => haba[h + '|' + ms] || 0)) },
    sesi: semua.slice().reverse(), senaraiGuru: senaraiPilihanGuru, guru: guruPilih, jenis: jenisPilih,
    pengecualian: bacaSheetSebagaiObjek(SHEET.PENGECUALIAN).filter(x => keTarikh(x.Tarikh).slice(0, 7) === bulan)
      .map(x => ({ id: x.IdPengecualian, tarikh: keTarikh(x.Tarikh), masa: keHHmm(x.Masa), kelas: x.Kelas, guru: x.NamaGuru, nokp: digitSahaja(x.NoKPGuru), sebab: x.Sebab, oleh: x.NamaAdmin }))
  });
}

/* Admin tanda sesi/hari guru sebagai dikecualikan (kursus, cuti rehat, tugas rasmi).
   Masa & kelas kosong = sepanjang hari. */
function apiSimpanPengecualian(p) {
  const sesi = wajibAdminPematuhan(p.token);
  if (gagal(sesi)) return sesi;
  if (!tarikhSah(p.tarikh)) return ralat('Tarikh tidak sah.');
  const sebab = String(p.sebab || '').trim();
  if (sebab.length < 3) return ralat('Sila nyatakan sebab pengecualian.');
  const g = p.nokp ? cariGuru(p.nokp) : null;
  return denganKunci(() => {
    const o = { IdPengecualian: p.id || janaId('PG'), Tarikh: p.tarikh, Masa: /^\d{1,2}:\d{2}$/.test(String(p.masa || '')) ? p.masa : '',
      Kelas: normalKelas(p.kelas || ''), NoKPGuru: g ? "'" + digitSahaja(g.NoKP) : '', NamaGuru: g ? g.Nama : String(p.nama || '').trim(), Sebab: sebab.slice(0, 300),
      NoKPAdmin: "'" + sesi.nokp, NamaAdmin: sesi.nama, MasaRekod: formatTarikhMasa(sekarang()) };
    const sedia = p.id ? bacaSheetSebagaiObjek(SHEET.PENGECUALIAN).find(x => x.IdPengecualian === p.id) : null;
    if (sedia) { o.__row = sedia.__row; kemaskiniBaris(SHEET.PENGECUALIAN, o); } else tambahBaris(SHEET.PENGECUALIAN, o);
    catatAudit(sesi, sedia ? 'KEMASKINI_PENGECUALIAN' : 'TAMBAH_PENGECUALIAN', o.Tarikh + ' ' + (o.Masa || 'sepanjang hari') + ' ' + o.NamaGuru + ': ' + sebab);
    return jaya({ id: o.IdPengecualian });
  });
}
function apiPadamPengecualian(p) {
  const sesi = wajibAdminPematuhan(p.token);
  if (gagal(sesi)) return sesi;
  return denganKunci(() => {
    const r = bacaSheetSebagaiObjek(SHEET.PENGECUALIAN).find(x => x.IdPengecualian === p.id);
    if (!r) return ralat('Rekod pengecualian tidak dijumpai.');
    padamBaris(SHEET.PENGECUALIAN, [r.__row]);
    catatAudit(sesi, 'PADAM_PENGECUALIAN', keTarikh(r.Tarikh) + ' ' + r.NamaGuru);
    return jaya({});
  });
}
