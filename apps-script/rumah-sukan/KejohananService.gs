/* =========================================================================
 * KejohananService.gs — Pengurusan Kejohanan Olahraga Tahunan (mula hingga akhir)
 *   1. Persediaan   : tetapan kejohanan, acara (jana acara standard / salin tahun lepas)
 *   2. Pendaftaran  : guru rumah mendaftar atlet rumah sendiri bagi setiap acara
 *   3. Jadual       : tarikh/masa acara, senarai mula (saringan & lorong / giliran padang)
 *   4. Pertandingan : keputusan, kedudukan, mata, mara ke akhir, pecah rekod
 *   5. Penutup      : papan mata, pingat, olahragawan/olahragawati, rekod, laporan
 * Semua data disimpan dalam Sheet ACARA, PESERTA & MATA_LAIN mengikut TAHUN kejohanan.
 * AUTOMATIK (tiada proses manual oleh guru): jadual masa acara, No. Bib, senarai mula
 * (saringan & lorong / giliran), kedudukan, mata, mara ke akhir, rekod kejohanan,
 * pingat, papan mata dan olahragawan/olahragawati.
 * KAWALAN MANUAL MENGATASI AUTOMASI: jadual, senarai mula (saringan/lorong), finalis, kedudukan,
 * rekod dan No. Bib yang disunting oleh Admin / AJK berakses ditanda (…Manual = YA) dan tidak
 * ditimpa oleh proses automatik.
 * Kebenaran: Admin (semua) · AJK berakses keputusan (jadual, senarai mula, keputusan)
 *            · Ketua/Penolong Guru Rumah (pendaftaran atlet rumah sendiri) · staf lain (lihat)
 * ========================================================================= */

/* ------------------------- TETAPAN & UTILITI ------------------------- */
function senaraiNombor(teks, lalai) {
  const v = String(teks || '').split(/[,;\s]+/).filter(x => x !== '').map(Number).filter(n => isFinite(n) && n >= 0);
  return v.length ? v : lalai;
}

function tetKejohanan(tet) {
  const t = tet || bacaTetapan();
  return {
    tahun: tahunKejohanan(t), nama: t[TET_NAMA_KEJOHANAN] || '', tarikh: t[TET_TARIKH_KEJOHANAN] || '',
    lokasi: t[TET_LOKASI] || '',
    mataIndividu: senaraiNombor(t[TET_MATA_INDIVIDU], [7, 5, 4, 3, 2, 1]),
    mataBerganti: senaraiNombor(t[TET_MATA_BERGANTI], [14, 10, 8, 6, 4, 2]),
    hadIndividu: nombor(t[TET_HAD_INDIVIDU], 3), hadBerganti: nombor(t[TET_HAD_BERGANTI], 2),
    pendaftaran: String(t[TET_PENDAFTARAN] || 'TUTUP').toUpperCase() === 'BUKA' ? 'BUKA' : 'TUTUP',
    terbit: ya(t[TET_TERBIT]),
    masaMula: /^\d{2}:\d{2}$/.test(String(t[TET_MASA_MULA] || '')) ? String(t[TET_MASA_MULA]) : '07:30',
    selangBalapan: Math.max(1, nombor(t[TET_SELANG_BALAPAN], 10)), selangPadang: Math.max(1, nombor(t[TET_SELANG_PADANG], 30)),
    // padang 1 hari, balapan 2 hari (tidak serentak). Kosong = tarikh kejohanan, +1 hari, +2 hari.
    tarikhPadang: tarikhSah(t[TET_TARIKH_PADANG]) || tambahHari(t[TET_TARIKH_KEJOHANAN], 0),
    tarikhBalapan1: tarikhSah(t[TET_TARIKH_BALAPAN1]) || tambahHari(t[TET_TARIKH_KEJOHANAN], 1),
    tarikhBalapan2: tarikhSah(t[TET_TARIKH_BALAPAN2]) || tambahHari(t[TET_TARIKH_KEJOHANAN], 2),
    // nilai yang disimpan (kosong = ikut tarikh kejohanan) untuk borang tetapan
    tarikhHari: { padang: tarikhSah(t[TET_TARIKH_PADANG]), balapan1: tarikhSah(t[TET_TARIKH_BALAPAN1]), balapan2: tarikhSah(t[TET_TARIKH_BALAPAN2]) }
  };
}

function tarikhSah(t) { return /^\d{4}-\d{2}-\d{2}$/.test(String(t || '')) ? String(t) : ''; }
function tambahHari(t, n) {
  if (!tarikhSah(t)) return '';
  const d = new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10)) + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

/* "12.45" | "1:05.32" | "1.05.32" | "4.35m" -> nombor (saat / meter); null jika tidak sah. */
function huraiKeputusan(teks, unit) {
  let s = String(teks === null || teks === undefined ? '' : teks).trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');
  if (!s) return null;
  if (unit === 'MASA') {
    s = s.replace(/s$/, '');
    let m = s.match(/^(\d+)[:.](\d{1,2})[.:](\d{1,3})$/);
    if (m) return Math.round((Number(m[1]) * 60 + Number(m[2]) + Number('0.' + m[3])) * 1000) / 1000;
    m = s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
    if (m) return Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000) / 1000;
  } else {
    s = s.replace(/m$/, '');
  }
  const n = Number(s);
  return isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

function formatKeputusan(n, unit) {
  if (n === null || n === undefined || n === '' || !isFinite(Number(n))) return '';
  n = Number(n);
  if (unit === 'MASA') {   // masa larian dengan milisaat: 12.345 · 1:05.321
    if (n >= 60) {
      const min = Math.floor(n / 60), saat = Math.round((n - min * 60) * 1000) / 1000;
      return min + ':' + (saat < 10 ? '0' : '') + saat.toFixed(3);
    }
    return n.toFixed(3);
  }
  return n.toFixed(2);
}

/* Susunan lorong dari tengah ke luar (atlet pertama/terbaik di lorong tengah): 8 lorong -> 4,5,3,6,2,7,1,8. */
function susunanLorong(n) {
  const tengah = Math.ceil(n / 2), hasil = [];
  for (let d = 0; hasil.length < n; d++) {
    if (d === 0) { hasil.push(tengah); continue; }
    if (tengah + d <= n) hasil.push(tengah + d);
    if (tengah - d >= 1) hasil.push(tengah - d);
  }
  return hasil;
}

/* Benar jika a lebih baik daripada b (masa: lebih kecil; jarak/tinggi: lebih besar). */
function lebihBaik(a, b, unit) { return unit === 'MASA' ? a < b : a > b; }

/* Tetapkan medan kedudukan (seri berkongsi kedudukan) bagi senarai {nilai, status}. */
function tetapkanKedudukan(senarai, unit) {
  const sah = senarai.filter(x => x.status === 'OK' && x.nilai > 0)
    .sort((a, b) => unit === 'MASA' ? a.nilai - b.nilai : b.nilai - a.nilai);
  senarai.forEach(x => { x.kedudukan = ''; });
  sah.forEach((x, i) => { x.kedudukan = i > 0 && sah[i - 1].nilai === x.nilai ? sah[i - 1].kedudukan : i + 1; });
  return sah;
}

/* ------------------------- BACA DATA ------------------------- */
function acaraTahun(tahun) {
  return bacaSheetSebagaiObjek(SHEET_ACARA).filter(a => a.AcaraId && String(a.Tahun) === String(tahun))
    .sort((a, b) => nombor(a.Susunan, 999) - nombor(b.Susunan, 999) || nombor(a.NoAcara, 999) - nombor(b.NoAcara, 999));
}

function pesertaTahun(tahun) {
  return bacaSheetSebagaiObjek(SHEET_PESERTA).filter(x => x.Id && String(x.Tahun) === String(tahun));
}

function mataLainTahun(tahun) {
  return bacaSheetSebagaiObjek(SHEET_MATA_LAIN).filter(x => x.Id && String(x.Tahun) === String(tahun));
}

function petaMuridRingkas() {
  const peta = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (!m.NoKP) return;
    peta[normalKP(m.NoKP)] = { nama: m.NamaPenuh, kelas: kunciKelas(m), rumahId: String(m.RumahId || ''), bib: String(m.NoBib || ''),
      jantina: (m.Jantina || jantinaDaripadaKP(m.NoKP)) === 'PEREMPUAN' ? 'P' : 'L', rekod: m };
  });
  return peta;
}

function namaAhli(ahli, murid) {
  return senaraiDaripadaMedan(ahli).map(kp => (murid[normalKP(kp)] || {}).nama || kp);
}

function acaraKeKlien(a) {
  return {
    id: String(a.AcaraId), no: String(a.NoAcara || ''), nama: String(a.Nama || ''), jenis: a.Jenis || 'BALAPAN',
    kategori: String(a.Kategori || ''), jantina: a.Jantina || 'L', unit: a.Unit || 'MASA',
    had: nombor(a.HadPerRumah, a.Jenis === 'BERGANTI' ? 1 : 2), bilLorong: nombor(a.BilLorong, 8), bilKeAkhir: nombor(a.BilKeAkhir, 0),
    tarikh: String(a.Tarikh || ''), masa: String(a.Masa || ''), status: a.Status || 'DIRANCANG',
    rekod: { nilai: String(a.RekodNilai || ''), pemegang: String(a.RekodPemegang || ''), rumah: String(a.RekodRumah || ''), tahun: String(a.RekodTahun || '') },
    rekodAsal: rekodAsal(a),
    jadualManual: ya(a.JadualManual), akhirManual: ya(a.AkhirManual), rekodManual: ya(a.RekodManual)
  };
}

/* ------------------------- REKOD (AUTOMATIK) -------------------------
   RekodAsal* = rekod sebelum kejohanan tahun ini (garis asas). Rekod semasa = terbaik antara
   rekod asal dan keputusan sah tahun ini. Dikira semula setiap kali keputusan disimpan, jadi
   pembetulan keputusan (cth. salah taip) turut membetulkan rekod secara automatik. */
function rekodAsal(a) {
  if (String(a.RekodAsalNilai || '') || String(a.RekodAsalTahun || '') || String(a.RekodAsalPemegang || '')) {
    return { nilai: String(a.RekodAsalNilai || ''), pemegang: String(a.RekodAsalPemegang || ''), rumah: String(a.RekodAsalRumah || ''), tahun: String(a.RekodAsalTahun || '') };
  }
  if (String(a.RekodTahun || '') === String(a.Tahun)) return { nilai: '', pemegang: '', rumah: '', tahun: '' };
  return { nilai: String(a.RekodNilai || ''), pemegang: String(a.RekodPemegang || ''), rumah: String(a.RekodRumah || ''), tahun: String(a.RekodTahun || '') };
}

/* Kemas kini medan rekod objek acara `a` (tidak menulis ke Sheet). Pulangkan true jika berubah. */
function kiraRekodAuto(a, pesertaAcara, murid, rumah) {
  if (ya(a.RekodManual)) return false;   // rekod ditetapkan manual oleh Admin -> automasi tidak menimpa
  const asal = rekodAsal(a);
  const nilaiAsal = huraiKeputusan(asal.nilai, a.Unit);
  let terbaik = null;
  pesertaAcara.forEach(x => {
    const n = nombor(x.Nilai, 0);
    if (x.Status !== 'OK' || !(n > 0)) return;
    if (!terbaik || lebihBaik(n, nombor(terbaik.Nilai, 0), a.Unit)) terbaik = x;
  });
  const sebelum = [a.RekodNilai, a.RekodPemegang, a.RekodRumah, a.RekodTahun].join('|');
  a.RekodAsalNilai = asal.nilai; a.RekodAsalPemegang = asal.pemegang; a.RekodAsalRumah = asal.rumah; a.RekodAsalTahun = asal.tahun;
  if (terbaik && (nilaiAsal === null || lebihBaik(nombor(terbaik.Nilai, 0), nilaiAsal, a.Unit))) {
    a.RekodNilai = formatKeputusan(nombor(terbaik.Nilai, 0), a.Unit);
    a.RekodPemegang = terbaik.NoKP ? (murid[normalKP(terbaik.NoKP)] || {}).nama || normalKP(terbaik.NoKP) : namaAhli(terbaik.Ahli, murid).join(', ');
    a.RekodRumah = rumah[terbaik.RumahId] ? rumah[terbaik.RumahId].nama : '';
    a.RekodTahun = String(a.Tahun);
  } else {
    a.RekodNilai = asal.nilai; a.RekodPemegang = asal.pemegang; a.RekodRumah = asal.rumah; a.RekodTahun = asal.tahun;
  }
  return sebelum !== [a.RekodNilai, a.RekodPemegang, a.RekodRumah, a.RekodTahun].join('|');
}

/* ------------------------- KEBENARAN ------------------------- */
function aksesKeputusanAjk(a) {
  const v = String(a.AksesKeputusan || '').toUpperCase();
  if (v) return v === 'YA';
  return /REKOD|KEPUTUSAN|PENGADIL/.test(String(a.Nama || '').toUpperCase());
}

function kebenaranKejohanan(sesi, tahun) {
  const rumah = senaraiRumah();
  let keputusan = sesi.admin;
  if (!keputusan) {
    const ajkAkses = {};
    bacaSheetSebagaiObjek(SHEET_AJK).forEach(a => { if (a.AjkId && aksesKeputusanAjk(a)) ajkAkses[a.AjkId] = true; });
    keputusan = bacaSheetSebagaiObjek(SHEET_AJK_AHLI).some(x => String(x.Tahun) === String(tahun) && normalKP(x.NoKP) === sesi.nokp && ajkAkses[x.AjkId]);
  }
  const r = sesi.rekod;
  const urusRumah = r.RumahId && (r.PerananRumah === PERANAN_RUMAH.KETUA || r.PerananRumah === PERANAN_RUMAH.PENOLONG);
  return {
    admin: sesi.admin, keputusan,
    rumahUrus: sesi.admin ? rumah.map(x => x.id) : (urusRumah ? [String(r.RumahId)] : []),
    rumahSendiri: String(r.RumahId || '')
  };
}

function wajibKeputusan(token) {
  const sesi = wajibStaf(token);
  if (sesi.success === false) return sesi;
  sesi.kj = kebenaranKejohanan(sesi, tahunKejohanan());
  if (!sesi.kj.keputusan) return ralat('Hanya Admin atau AJK yang diberi akses keputusan boleh melakukan tindakan ini.');
  return sesi;
}

/* ------------------------- KEDUDUKAN, PINGAT & OLAHRAGAWAN ------------------------- */
function kiraKedudukan(acara, peserta, mataLain, rumah, murid, cfgKat) {
  const st = {};
  rumah.forEach(r => { st[r.id] = { id: r.id, nama: r.nama, warna: r.warna, mataAcara: 0, mataLain: 0, jumlah: 0, emas: 0, perak: 0, gangsa: 0, kat: {} }; });
  const petaAcara = {};
  acara.forEach(a => { petaAcara[a.AcaraId] = a; });
  const individu = {};   // olahragawan: NoKP -> {mata, emas}
  peserta.forEach(x => {
    if (x.Pusingan !== 'AKHIR') return;
    const a = petaAcara[x.AcaraId];
    const s = st[x.RumahId];
    if (!a || !s) return;
    const mata = nombor(x.Mata, 0), k = nombor(x.Kedudukan, 0);
    s.mataAcara += mata;
    const kunciKat = (a.Kategori || '-') + '|' + (a.Jantina || '-');
    s.kat[kunciKat] = (s.kat[kunciKat] || 0) + mata;
    if (k === 1) s.emas++; else if (k === 2) s.perak++; else if (k === 3) s.gangsa++;
    if (a.Jenis !== 'BERGANTI' && x.NoKP && (mata > 0 || k)) {
      const kp = normalKP(x.NoKP);
      const o = individu[kp] = individu[kp] || { nokp: kp, mata: 0, emas: 0, perak: 0, gangsa: 0, kategori: a.Kategori, jantina: a.Jantina };
      o.mata += mata;
      if (k === 1) o.emas++; else if (k === 2) o.perak++; else if (k === 3) o.gangsa++;
    }
  });
  mataLain.forEach(m => { if (st[m.RumahId]) st[m.RumahId].mataLain += nombor(m.Mata, 0); });
  const senarai = rumah.map(r => st[r.id]);
  senarai.forEach(s => { s.jumlah = Math.round((s.mataAcara + s.mataLain) * 100) / 100; });
  senarai.sort((a, b) => b.jumlah - a.jumlah || b.emas - a.emas || b.perak - a.perak || b.gangsa - a.gangsa);
  senarai.forEach((s, i) => { s.kedudukan = i > 0 && senarai[i - 1].jumlah === s.jumlah && senarai[i - 1].emas === s.emas ? senarai[i - 1].kedudukan : i + 1; });

  // olahragawan (L) & olahragawati (P) bagi setiap kategori: 3 teratas mengikut mata, kemudian pingat emas
  const olahragawan = [];
  (cfgKat || []).forEach(k => {
    ['L', 'P'].forEach(j => {
      const calon = Object.keys(individu).map(kp => individu[kp]).filter(o => o.kategori === k.kod && o.jantina === j && o.mata > 0)
        .sort((a, b) => b.mata - a.mata || b.emas - a.emas || b.perak - a.perak);
      if (!calon.length) return;
      olahragawan.push({
        kategori: k.kod, namaKategori: k.nama, jantina: j, gelaran: (j === 'L' ? 'Olahragawan ' : 'Olahragawati ') + k.nama,
        calon: calon.slice(0, 3).map(o => {
          const m = murid[o.nokp] || {};
          return { nama: m.nama || o.nokp, kelas: m.kelas || '', rumahId: m.rumahId || '', mata: o.mata, emas: o.emas, perak: o.perak, gangsa: o.gangsa };
        })
      });
    });
  });
  return { rumah: senarai, olahragawan };
}

/* Fasa kejohanan — dipaparkan sebagai langkah (stepper) di Pusat Kejohanan. */
function kiraFasa(kt, acara, peserta, bilAjk, bilRumah) {
  const n = acara.length;
  const adaPeserta = {};
  peserta.forEach(x => { adaPeserta[x.AcaraId] = true; });
  const berdaftar = acara.filter(a => adaPeserta[a.AcaraId]).length;
  const berjadual = acara.filter(a => a.Tarikh && a.Masa).length;
  const sedia = acara.filter(a => a.Status && a.Status !== 'DIRANCANG').length;
  const selesai = acara.filter(a => a.Status === 'SELESAI').length;
  const pct = (x, y) => (y ? Math.round(x / y * 100) : 0);
  return [
    { kod: 'PERSEDIAAN', nama: 'Persediaan', ikon: 'flag', peratus: Math.round(((bilRumah >= 2 ? 1 : 0) + (n ? 1 : 0) + (bilAjk ? 1 : 0) + (kt.tarikh ? 1 : 0)) / 4 * 100),
      butiran: bilRumah + ' rumah · ' + n + ' acara · ' + bilAjk + ' lantikan AJK' + (kt.tarikh ? '' : ' · tarikh belum ditetapkan') },
    { kod: 'PENDAFTARAN', nama: 'Pendaftaran Atlet', ikon: 'users', peratus: pct(berdaftar, n),
      butiran: berdaftar + '/' + n + ' acara ada peserta · ' + peserta.filter(x => x.Saringan !== 'M').length + ' penyertaan · pendaftaran ' + kt.pendaftaran.toLowerCase() },
    { kod: 'JADUAL', nama: 'Jadual & Senarai Mula', ikon: 'calendar', peratus: n ? Math.round((pct(berjadual, n) + pct(sedia, n)) / 2) : 0,
      butiran: berjadual + '/' + n + ' berjadual · ' + sedia + '/' + n + ' senarai mula sedia' },
    { kod: 'PERTANDINGAN', nama: 'Pertandingan', ikon: 'timer', peratus: pct(selesai, n), butiran: selesai + '/' + n + ' acara selesai' },
    { kod: 'PENUTUP', nama: 'Keputusan Rasmi', ikon: 'trophy', peratus: Math.round(((n && selesai === n ? 1 : 0) + (kt.terbit ? 1 : 0)) / 2 * 100),
      butiran: (kt.terbit ? 'Keputusan diterbitkan' : 'Belum diterbitkan') + ' · ' + acara.filter(a => String(a.RekodTahun) === String(kt.tahun)).length + ' rekod baharu' }
  ];
}

/* Ringkasan untuk Dashboard guru & Portal Murid. */
function ringkasanKejohanan(tet) {
  const kt = tetKejohanan(tet);
  const acara = acaraTahun(kt.tahun);
  const peserta = pesertaTahun(kt.tahun);
  const rumah = senaraiRumah();
  const ked = kiraKedudukan(acara, peserta, mataLainTahun(kt.tahun), rumah, {}, []);
  return {
    nama: kt.nama, tahun: kt.tahun, tarikh: kt.tarikh, lokasi: kt.lokasi, pendaftaran: kt.pendaftaran, terbit: kt.terbit,
    bilAcara: acara.length, acaraSelesai: acara.filter(a => a.Status === 'SELESAI').length,
    bilPenyertaan: peserta.filter(x => x.Saringan !== 'M').length,
    kedudukan: ked.rumah.map(r => ({ id: r.id, nama: r.nama, warna: r.warna, jumlah: r.jumlah, emas: r.emas, perak: r.perak, gangsa: r.gangsa, kedudukan: r.kedudukan }))
  };
}

/* ------------------------- API: PUSAT KEJOHANAN (satu panggilan) ------------------------- */
function apiKejohanan(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const tet = bacaTetapan();
  const kt = tetKejohanan(tet);
  const cfg = konfigKategori(tet);
  const acara = acaraTahun(kt.tahun);
  const peserta = pesertaTahun(kt.tahun);
  const mataLain = mataLainTahun(kt.tahun);
  const rumah = senaraiRumah();
  const murid = petaMuridRingkas();
  const ked = kiraKedudukan(acara, peserta, mataLain, rumah, murid, cfg.senarai);

  // ringkasan per acara: bilangan peserta (pendaftaran), per rumah, podium
  const per = {};
  peserta.forEach(x => {
    const o = per[x.AcaraId] = per[x.AcaraId] || { daftar: {}, perRumah: {}, akhir: [] };
    const kunci = x.RumahId + '|' + (x.NoKP || x.Ahli);
    if (!o.daftar[kunci]) { o.daftar[kunci] = true; o.perRumah[x.RumahId] = (o.perRumah[x.RumahId] || 0) + 1; }
    if (x.Pusingan === 'AKHIR' && nombor(x.Kedudukan, 0) > 0) o.akhir.push(x);
  });
  const senaraiAcara = acara.map(a => {
    const k = acaraKeKlien(a);
    const o = per[a.AcaraId] || { daftar: {}, perRumah: {}, akhir: [] };
    k.bilPeserta = Object.keys(o.daftar).length;
    k.perRumah = o.perRumah;
    k.podium = o.akhir.sort((x, y) => nombor(x.Kedudukan, 99) - nombor(y.Kedudukan, 99)).slice(0, 3).map(x => ({
      kedudukan: nombor(x.Kedudukan, 0), rumahId: x.RumahId, keputusan: x.Keputusan,
      nama: x.NoKP ? ((murid[normalKP(x.NoKP)] || {}).nama || '') : '', rekodBaharu: ya(x.RekodBaharu)
    }));
    k.rekodBaharu = String(a.RekodTahun) === String(kt.tahun) && !!a.RekodNilai;
    k.dikemaskini = String(a.Dikemaskini || '');
    return k;
  });
  const terkini = senaraiAcara.filter(a => a.status === 'SELESAI').sort((x, y) => y.dikemaskini.localeCompare(x.dikemaskini)).slice(0, 8);
  const bilAjk = bacaSheetSebagaiObjek(SHEET_AJK_AHLI).filter(x => String(x.Tahun) === String(kt.tahun)).length;
  return jaya({
    tet: kt, kebenaran: kebenaranKejohanan(sesi, kt.tahun), kategori: cfg.senarai, rumah,
    acara: senaraiAcara, kedudukan: ked.rumah, olahragawan: ked.olahragawan,
    mataLain: mataLain.map(m => ({ id: m.Id, rumahId: m.RumahId, perkara: m.Perkara, mata: nombor(m.Mata, 0), catatan: m.Catatan || '' })),
    fasa: kiraFasa(kt, acara, peserta, bilAjk, rumah.length),
    terkini: terkini.map(a => a.id),
    jenis: JENIS_ACARA, unit: UNIT_ACARA, statusAcara: STATUS_ACARA, standard: ACARA_STANDARD.map(x => x.nama)
  });
}

/* ------------------------- API: TETAPAN KEJOHANAN ------------------------- */
function apiSimpanTetapanKejohanan(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const d = p.data || {};
  const tarikh = String(d.tarikh || '').trim();
  if (tarikh && !/^\d{4}-\d{2}-\d{2}$/.test(tarikh)) return ralat('Tarikh kejohanan mesti dalam format YYYY-MM-DD.');
  const mi = senaraiNombor(d.mataIndividu, null), mb = senaraiNombor(d.mataBerganti, null);
  if (!mi || !mb) return ralat('Mata kedudukan mesti senarai nombor dipisah koma (cth. 7,5,4,3,2,1).');
  if (d.masaMula && !/^\d{2}:\d{2}$/.test(String(d.masaMula))) return ralat('Masa mula mesti dalam format HH:MM.');
  return denganKunci(() => {
    const lama = tetKejohanan();
    const peta = {};
    peta[TET_TARIKH_KEJOHANAN] = tarikh;
    peta[TET_LOKASI] = teksBersih(d.lokasi);
    peta[TET_MATA_INDIVIDU] = mi.join(',');
    peta[TET_MATA_BERGANTI] = mb.join(',');
    peta[TET_HAD_INDIVIDU] = String(Math.max(1, Math.min(10, nombor(d.hadIndividu, 3))));
    peta[TET_HAD_BERGANTI] = String(Math.max(0, Math.min(10, nombor(d.hadBerganti, 2))));
    peta[TET_PENDAFTARAN] = d.pendaftaran === 'BUKA' ? 'BUKA' : 'TUTUP';
    peta[TET_TERBIT] = d.terbit ? 'YA' : 'TIDAK';
    peta[TET_MASA_MULA] = d.masaMula || lama.masaMula;
    peta[TET_SELANG_BALAPAN] = String(Math.max(1, Math.min(120, nombor(d.selangBalapan, lama.selangBalapan))));
    peta[TET_SELANG_PADANG] = String(Math.max(1, Math.min(240, nombor(d.selangPadang, lama.selangPadang))));
    peta[TET_TARIKH_PADANG] = tarikhSah(d.tarikhPadang);
    peta[TET_TARIKH_BALAPAN1] = tarikhSah(d.tarikhBalapan1);
    peta[TET_TARIKH_BALAPAN2] = tarikhSah(d.tarikhBalapan2);
    simpanTetapan(peta);
    const kt = tetKejohanan();
    // tetapan hari/masa berubah -> jadual automatik disusun semula (acara yang disunting manual kekal)
    const ubahJadual = ['tarikhPadang', 'tarikhBalapan1', 'tarikhBalapan2', 'masaMula', 'selangBalapan', 'selangPadang'].some(k => String(lama[k]) !== String(kt[k]));
    // AUTOMATIK: mata dikira semula, jadual dilengkapkan, dan apabila pendaftaran ditutup:
    // No. Bib + senarai mula (saringan & lorong / giliran) dijana bagi semua acara berpeserta.
    const bil = kiraSemulaMataSemua();
    const jadual = janaJadualDalaman(kt, ubahJadual);
    let senaraiMula = 0, bib = 0;
    if (kt.pendaftaran === 'TUTUP') {
      bib = janaBibDalaman(kt);
      senaraiMula = janaSemuaSenaraiMula(kt);
    }
    catatAudit(sesi, 'SIMPAN_TETAPAN_KEJOHANAN', 'KEJOHANAN', '', JSON.stringify(peta) + ' | mata dikira semula: ' + bil + ' · jadual: ' + jadual + ' · bib: ' + bib + ' · senarai mula: ' + senaraiMula);
    return jaya({ jadual, bib, senaraiMula });
  });
}

/* ------------------------- API: ACARA ------------------------- */
function normalAcara(d, kt) {
  const jenis = JENIS_ACARA[d.jenis] ? d.jenis : 'BALAPAN';
  const unit = UNIT_ACARA[d.unit] ? d.unit : (jenis === 'PADANG' ? 'JARAK' : 'MASA');
  return {
    Nama: banding(d.nama), Jenis: jenis, Kategori: banding(d.kategori), Jantina: ['L', 'P', 'C'].indexOf(d.jantina) !== -1 ? d.jantina : 'L',
    Unit: unit, HadPerRumah: Math.max(1, Math.min(10, nombor(d.had, jenis === 'BERGANTI' ? 1 : 2))),
    BilLorong: Math.max(4, Math.min(10, nombor(d.bilLorong, 8))), BilKeAkhir: Math.max(0, Math.min(16, nombor(d.bilKeAkhir, 0))),
    Tarikh: tarikhSah(d.tarikh),
    Masa: /^\d{2}:\d{2}$/.test(String(d.masa || '')) ? d.masa : '',
    // rekod yang diisi di borang = rekod SEBELUM kejohanan tahun ini (garis asas); rekod semasa dikira automatik
    RekodAsalNilai: (function () { const n = huraiKeputusan(d.rekodNilai, unit); return n ? formatKeputusan(n, unit) : ''; })(),
    RekodAsalPemegang: banding(d.rekodPemegang), RekodAsalRumah: banding(d.rekodRumah), RekodAsalTahun: teksBersih(d.rekodTahun)
  };
}

/* Rekod semasa ditetapkan manual oleh Admin (mengatasi pengiraan automatik). */
function rekodManualDaripada(d, unit) {
  if (!d.rekodManual) return { RekodManual: '' };
  const n = huraiKeputusan(d.rekodSemasaNilai, unit);
  return { RekodManual: 'YA', RekodNilai: n ? formatKeputusan(n, unit) : '', RekodPemegang: banding(d.rekodSemasaPemegang),
    RekodRumah: banding(d.rekodSemasaRumah), RekodTahun: teksBersih(d.rekodSemasaTahun) };
}

function apiSimpanAcara(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const d = p.data || {};
  const kt = tetKejohanan();
  const o = normalAcara(d, kt);
  if (!o.Nama) return ralat('Nama acara diperlukan.');
  return denganKunci(() => {
    const semua = acaraTahun(kt.tahun);
    const masa = sekarangTeks();
    if (d.id) {
      const a = semua.find(x => x.AcaraId === d.id);
      if (!a) return ralat('Acara tidak dijumpai.');
      const ubahStruktur = a.Jenis !== o.Jenis || a.Unit !== o.Unit;
      if (ubahStruktur && a.Status && a.Status !== 'DIRANCANG') return ralat('Jenis/unit tidak boleh diubah selepas senarai mula dijana.');
      // jadual disunting manual -> dikunci daripada jadual automatik; dikosongkan -> kembali automatik
      const jadualUbah = o.Tarikh !== String(a.Tarikh || '') || o.Masa !== String(a.Masa || '') || (teksBersih(d.no) && teksBersih(d.no) !== String(a.NoAcara || ''));
      const manual = jadualUbah ? ((o.Tarikh || o.Masa) ? 'YA' : '') : (a.JadualManual || '');
      Object.assign(a, o, { NoAcara: teksBersih(d.no) || a.NoAcara, JadualManual: manual, Dikemaskini: masa }, rekodManualDaripada(d, o.Unit));
      kiraRekodAuto(a, pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId), petaMuridRingkas(), petaRumah());
      kemaskiniBaris(SHEET_ACARA, a.__row, a);
      if (!manual) janaJadualDalaman(kt, false);
    } else {
      const no = teksBersih(d.no) || String(semua.reduce((mx, x) => Math.max(mx, nombor(x.NoAcara, 0)), 0) + 1);
      const baru = Object.assign(o, { AcaraId: janaId('AC'), Tahun: kt.tahun, NoAcara: no, Status: 'DIRANCANG', Susunan: semua.length + 1, Dikemaskini: masa,
        JadualManual: o.Tarikh || o.Masa || teksBersih(d.no) ? 'YA' : '' }, rekodManualDaripada(d, o.Unit));
      kiraRekodAuto(baru, [], {}, {});
      tambahBaris(SHEET_ACARA, baru);
      if (!baru.JadualManual) janaJadualDalaman(kt, false);
    }
    catatAudit(sesi, d.id ? 'KEMASKINI_ACARA' : 'TAMBAH_ACARA', 'KEJOHANAN', d.id || '', o.Nama + ' ' + o.Kategori + ' ' + o.Jantina);
    return jaya({});
  });
}

function apiPadamAcara(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const a = cariBarisMengikutId(SHEET_ACARA, 'AcaraId', p.id);
    if (!a) return ralat('Acara tidak dijumpai.');
    padamBarisBanyak(SHEET_PESERTA, bacaSheetSebagaiObjek(SHEET_PESERTA).filter(x => x.AcaraId === p.id));
    padamBaris(SHEET_ACARA, a.__row, a.AcaraId);
    catatAudit(sesi, 'PADAM_ACARA', 'KEJOHANAN', p.id, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina);
    return jaya({});
  });
}

/* Padam banyak baris (dari bawah ke atas supaya nombor baris kekal sah). */
function padamBarisBanyak(namaSheet, baris) {
  baris.slice().sort((a, b) => b.__row - a.__row).forEach(x => {
    const header = headerSebenarSheet(dapatkanSheet(namaSheet));
    padamBaris(namaSheet, x.__row, x[header[0]]);
  });
}

/* Cipta acara standard bagi kategori × jantina dipilih (yang sudah wujud dilangkau). */
function apiJanaAcaraStandard(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  const pilih = (p.acara || []).filter(n => ACARA_STANDARD.some(s => s.nama === n));
  const kategori = (p.kategori || []).map(banding).filter(Boolean);
  const jantina = (p.jantina || []).filter(j => j === 'L' || j === 'P');
  if (!pilih.length || !kategori.length || !jantina.length) return ralat('Pilih sekurang-kurangnya satu acara, kategori dan jantina.');
  return denganKunci(() => {
    const semua = acaraTahun(kt.tahun);
    const ada = {};
    semua.forEach(a => { ada[a.Nama + '|' + a.Kategori + '|' + a.Jantina] = true; });
    let no = semua.reduce((mx, x) => Math.max(mx, nombor(x.NoAcara, 0)), 0);
    let susunan = semua.length;
    const masa = sekarangTeks(), baru = [];
    ACARA_STANDARD.filter(s => pilih.indexOf(s.nama) !== -1).forEach(s => {
      kategori.forEach(k => jantina.forEach(j => {
        if (ada[s.nama + '|' + k + '|' + j]) return;
        baru.push({ AcaraId: janaId('AC'), Tahun: kt.tahun, NoAcara: String(++no), Nama: s.nama, Jenis: s.jenis, Kategori: k, Jantina: j, Unit: s.unit,
          HadPerRumah: s.jenis === 'BERGANTI' ? 1 : 2, BilLorong: 8, BilKeAkhir: 0, Tarikh: '', Masa: '', Status: 'DIRANCANG',
          Susunan: ++susunan, Dikemaskini: masa });
      }));
    });
    if (baru.length) tulisBarisBaharu(SHEET_ACARA, baru);
    const jadual = janaJadualDalaman(kt, true);   // AUTOMATIK: no. acara, tarikh & masa (acara manual kekal)
    catatAudit(sesi, 'JANA_ACARA_STANDARD', 'KEJOHANAN', '', baru.length + ' acara dicipta, ' + jadual + ' dijadualkan');
    return jaya({ bil: baru.length, jadual });
  });
}

/* Salin acara (termasuk rekod kejohanan) daripada tahun terakhir yang mempunyai acara. */
function apiSalinAcaraTahunLepas(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  return denganKunci(() => {
    const semua = bacaSheetSebagaiObjek(SHEET_ACARA).filter(a => a.AcaraId);
    const tahunLepas = semua.map(a => nombor(a.Tahun, 0)).filter(t => t < kt.tahun).reduce((mx, t) => Math.max(mx, t), 0);
    if (!tahunLepas) return ralat('Tiada acara tahun sebelumnya untuk disalin.');
    const ada = {};
    acaraTahun(kt.tahun).forEach(a => { ada[a.Nama + '|' + a.Kategori + '|' + a.Jantina] = true; });
    const masa = sekarangTeks();
    const baru = acaraTahun(tahunLepas).filter(a => !ada[a.Nama + '|' + a.Kategori + '|' + a.Jantina]).map(a => Object.assign({}, a, {
      AcaraId: janaId('AC'), Tahun: kt.tahun, Tarikh: kt.tarikh || '', Masa: '', Status: 'DIRANCANG', Dikemaskini: masa,
      RekodAsalNilai: '', RekodAsalPemegang: '', RekodAsalRumah: '', RekodAsalTahun: ''   // rekod terbaik setakat tahun lepas jadi garis asas
    }));
    baru.forEach(b => { delete b.__row; });
    if (baru.length) tulisBarisBaharu(SHEET_ACARA, baru);
    janaJadualDalaman(kt, false);
    catatAudit(sesi, 'SALIN_ACARA', 'KEJOHANAN', String(tahunLepas), baru.length + ' acara disalin');
    return jaya({ bil: baru.length, tahun: tahunLepas });
  });
}

/* Simpan jadual (no. acara, tarikh, masa) bagi banyak acara sekali gus. */
function apiSimpanJadual(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  const masa = sekarangTeks();
  const objek = (p.jadual || []).map(j => ({
    AcaraId: j.id, NoAcara: teksBersih(j.no),
    Tarikh: /^\d{4}-\d{2}-\d{2}$/.test(String(j.tarikh || '')) ? j.tarikh : '',
    Masa: /^\d{2}:\d{2}$/.test(String(j.masa || '')) ? j.masa : '', JadualManual: 'YA', Dikemaskini: masa
  })).filter(o => o.AcaraId);
  // tarikh & masa dikosongkan -> acara kembali kepada jadual automatik
  objek.forEach(o => { if (!o.Tarikh && !o.Masa) o.JadualManual = ''; });
  if (!objek.length) return ralat('Tiada perubahan jadual.');
  return denganKunci(() => {
    upsertBanyak(SHEET_ACARA, 'AcaraId', objek);
    if (objek.some(o => !o.JadualManual)) janaJadualDalaman(tetKejohanan(), false);
    catatAudit(sesi, 'SIMPAN_JADUAL', 'KEJOHANAN', '', objek.length + ' acara');
    return jaya({ bil: objek.length });
  });
}

/* ------------------------- JADUAL AUTOMATIK -------------------------
   Padang dan balapan TIDAK serentak: semua acara PADANG pada hari padang (1 hari) setiap
   `selangPadang` minit; acara BALAPAN (jarak menaik, kemudian berganti-ganti) dibahagi kepada
   2 hari balapan setiap `selangBalapan` minit. Setiap hari bermula `masaMula`. No. acara diberi
   mengikut tarikh & masa. Acara yang jadualnya disunting manual (JadualManual = YA) TIDAK ditimpa.
   semua=false: hanya acara yang belum lengkap jadualnya diisi. */
function janaJadualDalaman(kt, semua) {
  const acara = acaraTahun(kt.tahun);
  if (!acara.length) return 0;
  if (!semua && acara.every(a => a.Masa && a.Tarikh && a.NoAcara)) return 0;
  const kat = {};
  konfigKategori().senarai.forEach((k, i) => { kat[k.kod] = i; });
  const indeksStd = {};
  ACARA_STANDARD.forEach((x, i) => { indeksStd[x.nama] = i; });
  const jarak = a => { const m = String(a.Nama).match(/(\d+)\s*X\s*(\d+)/i); if (m) return Number(m[1]) * Number(m[2]); const n = String(a.Nama).match(/(\d+)/); return n ? Number(n[1]) : 0; };
  const banding2 = (a, b) => (kat[a.Kategori] === undefined ? 99 : kat[a.Kategori]) - (kat[b.Kategori] === undefined ? 99 : kat[b.Kategori]) || String(a.Jantina).localeCompare(String(b.Jantina));
  const balapan = acara.filter(a => a.Jenis !== 'PADANG').sort((a, b) => (a.Jenis === 'BERGANTI') - (b.Jenis === 'BERGANTI') || jarak(a) - jarak(b) || String(a.Nama).localeCompare(String(b.Nama)) || banding2(a, b));
  const padang = acara.filter(a => a.Jenis === 'PADANG').sort((a, b) => (indeksStd[a.Nama] === undefined ? 99 : indeksStd[a.Nama]) - (indeksStd[b.Nama] === undefined ? 99 : indeksStd[b.Nama]) || String(a.Nama).localeCompare(String(b.Nama)) || banding2(a, b));
  const mula = Number(kt.masaMula.slice(0, 2)) * 60 + Number(kt.masaMula.slice(3, 5));
  const hh = m => ('0' + Math.floor(m / 60) % 24).slice(-2) + ':' + ('0' + m % 60).slice(-2);
  const slot = [];
  padang.forEach((a, i) => slot.push({ a, tarikh: kt.tarikhPadang, minit: mula + i * kt.selangPadang }));
  const separuh = Math.ceil(balapan.length / 2);
  balapan.forEach((a, i) => {
    const hari2 = i >= separuh;
    slot.push({ a, tarikh: hari2 ? kt.tarikhBalapan2 : kt.tarikhBalapan1, minit: mula + (hari2 ? i - separuh : i) * kt.selangBalapan });
  });
  // acara manual kekal pada tarikh/masanya sendiri dan turut menentukan susunan no. acara
  slot.forEach(x => { if (ya(x.a.JadualManual) && x.a.Tarikh && x.a.Masa) { x.tarikh = x.a.Tarikh; x.minit = Number(x.a.Masa.slice(0, 2)) * 60 + Number(x.a.Masa.slice(3, 5)); } });
  slot.sort((x, y) => String(x.tarikh).localeCompare(String(y.tarikh)) || x.minit - y.minit || (x.a.Jenis === 'PADANG') - (y.a.Jenis === 'PADANG'));
  const masa = sekarangTeks(), objek = [];
  slot.forEach((x, i) => {
    const a = x.a;
    if (ya(a.JadualManual)) return;
    if (!semua && a.Masa && a.Tarikh && a.NoAcara) return;
    // acara automatik yang belum lengkap dijadualkan penuh (tarikh hari padang / balapan + masa)
    objek.push({ AcaraId: a.AcaraId, NoAcara: semua || !a.NoAcara ? String(i + 1) : a.NoAcara, Tarikh: x.tarikh || a.Tarikh || '',
      Masa: hh(x.minit), Susunan: i + 1, Dikemaskini: masa });
  });
  if (objek.length) upsertBanyak(SHEET_ACARA, 'AcaraId', objek);
  return objek.length;
}

function apiJanaJadual(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const kt = tetKejohanan();
    if (p.termasukManual) {   // pilihan pengguna: kembalikan acara manual kepada jadual automatik
      const kunci = acaraTahun(kt.tahun).filter(a => ya(a.JadualManual)).map(a => ({ AcaraId: a.AcaraId, JadualManual: '' }));
      if (kunci.length) upsertBanyak(SHEET_ACARA, 'AcaraId', kunci);
    }
    const bil = janaJadualDalaman(kt, true);
    catatAudit(sesi, 'JANA_JADUAL', 'KEJOHANAN', '', bil + ' acara dijadualkan semula');
    return jaya({ bil });
  });
}

/* Tambah banyak baris baharu dalam satu tulisan. */
function tulisBarisBaharu(namaSheet, senarai) {
  const sh = dapatkanSheet(namaSheet);
  const header = headerSebenarSheet(sh);
  const mula = sh.getLastRow() + 1;
  formatLajurTeks(sh, mula, senarai.length);
  cubaSemula(() => sh.getRange(mula, 1, senarai.length, header.length).setValues(senarai.map(o => objekKeBaris(o, header))));
  tandaKotor(namaSheet);
}

/* ------------------------- API: PENDAFTARAN ATLET ------------------------- */
function semakAksesRumah(sesi, rumahId, ubah) {
  const kj = kebenaranKejohanan(sesi, tahunKejohanan());
  if (kj.rumahUrus.indexOf(rumahId) !== -1) return kj;
  if (!ubah && (kj.rumahSendiri === rumahId || kj.keputusan)) return kj;
  return null;
}

function apiPenyertaanRumah(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const rumahId = String(p.rumahId || sesi.rekod.RumahId || '');
  const kj = semakAksesRumah(sesi, rumahId, false);
  if (!kj) return ralat('Anda hanya boleh melihat penyertaan rumah sendiri.');
  const tet = bacaTetapan();
  const kt = tetKejohanan(tet);
  const cfg = konfigKategori(tet);
  const acara = {};
  acaraTahun(kt.tahun).forEach(a => { acara[a.AcaraId] = a; });
  const bil = {}, penyertaan = {};
  pesertaTahun(kt.tahun).forEach(x => {
    if (!acara[x.AcaraId] || x.Pusingan === 'AKHIR' && x.Saringan === 'M') return;   // baris "mara ke akhir" tidak dikira dua kali
    const ahli = x.NoKP ? [normalKP(x.NoKP)] : senaraiDaripadaMedan(x.Ahli).map(normalKP);
    const berganti = acara[x.AcaraId].Jenis === 'BERGANTI';
    ahli.forEach(kp => { const b = bil[kp] = bil[kp] || { i: 0, b: 0 }; if (berganti) b.b++; else b.i++; });
    if (x.RumahId === rumahId) {
      const o = penyertaan[x.AcaraId] = penyertaan[x.AcaraId] || [];
      ahli.forEach(kp => { if (o.indexOf(kp) === -1) o.push(kp); });
    }
  });
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => m.NoKP && aktif(m) && String(m.RumahId) === rumahId).map(m => {
    const kp = normalKP(m.NoKP), b = bil[kp] || { i: 0, b: 0 };
    return { nokp: kp, nama: m.NamaPenuh, jantina: (m.Jantina || jantinaDaripadaKP(m.NoKP)) === 'PEREMPUAN' ? 'P' : 'L',
      kategori: kategoriMurid(m, cfg), kelas: kunciKelas(m), atlet: ya(m.Atlet), acaraAtlet: m.Acara || '', bib: String(m.NoBib || ''),
      bilIndividu: b.i, bilBerganti: b.b };
  }).sort((a, b) => (b.atlet - a.atlet) || a.nama.localeCompare(b.nama));
  return jaya({ rumahId, bolehUbah: kj.rumahUrus.indexOf(rumahId) !== -1 && (kt.pendaftaran === 'BUKA' || kj.admin),
    pendaftaran: kt.pendaftaran, had: { individu: kt.hadIndividu, berganti: kt.hadBerganti }, murid, penyertaan });
}

/* Ganti senarai peserta sebuah rumah bagi satu acara. p = {rumahId, acaraId, nokp:[...]} */
function apiSimpanPenyertaan(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const rumahId = String(p.rumahId || '');
  const kj = semakAksesRumah(sesi, rumahId, true);
  if (!kj) return ralat('Hanya Admin atau Ketua/Penolong Ketua Guru Rumah ini boleh mendaftar atlet.');
  const tet = bacaTetapan();
  const kt = tetKejohanan(tet);
  if (kt.pendaftaran !== 'BUKA' && !kj.admin) return ralat('Pendaftaran atlet telah ditutup.');
  const cfg = konfigKategori(tet);
  return denganKunci(() => {
    const a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    if (!a) return ralat('Acara tidak dijumpai.');
    if (a.Status && a.Status !== 'DIRANCANG' && !kj.admin) return ralat('Senarai mula acara ini telah dijana. Hubungi Admin untuk perubahan.');
    if (a.Status === 'SARINGAN' || a.Status === 'SELESAI') return ralat('Acara ini sudah mempunyai keputusan; penyertaan tidak boleh diubah.');
    const berganti = a.Jenis === 'BERGANTI';
    const dipilih = [];
    (p.nokp || []).map(normalKP).forEach(kp => { if (kp && dipilih.indexOf(kp) === -1) dipilih.push(kp); });
    const had = nombor(a.HadPerRumah, berganti ? 1 : 2);
    if (berganti) {
      if (dipilih.length && (dipilih.length < 4 || dipilih.length > 6)) return ralat('Pasukan berganti-ganti mesti 4 hingga 6 orang (termasuk simpanan).');
    } else if (dipilih.length > had) return ralat('Had acara ini ialah ' + had + ' atlet bagi setiap rumah.');

    const murid = {};
    bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => { if (m.NoKP) murid[normalKP(m.NoKP)] = m; });
    const semuaPeserta = pesertaTahun(kt.tahun);
    const petaAcara = {};
    acaraTahun(kt.tahun).forEach(x => { petaAcara[x.AcaraId] = x; });
    const bil = {};
    semuaPeserta.forEach(x => {
      if (x.AcaraId === a.AcaraId || !petaAcara[x.AcaraId] || x.Saringan === 'M') return;
      const b2 = petaAcara[x.AcaraId].Jenis === 'BERGANTI';
      (x.NoKP ? [normalKP(x.NoKP)] : senaraiDaripadaMedan(x.Ahli).map(normalKP)).forEach(kp => {
        const o = bil[kp] = bil[kp] || { i: 0, b: 0 }; if (b2) o.b++; else o.i++;
      });
    });
    for (const kp of dipilih) {
      const m = murid[kp];
      if (!m || !aktif(m)) return ralat('Murid ' + kp + ' tidak dijumpai / tidak aktif.');
      if (String(m.RumahId) !== rumahId) return ralat(m.NamaPenuh + ' bukan ahli rumah ini.');
      const jan = (m.Jantina || jantinaDaripadaKP(m.NoKP)) === 'PEREMPUAN' ? 'P' : 'L';
      if (a.Jantina !== 'C' && jan !== a.Jantina) return ralat(m.NamaPenuh + ': jantina tidak layak untuk acara ini.');
      const kat = kategoriMurid(m, cfg);
      if (a.Kategori && kat !== a.Kategori) return ralat(m.NamaPenuh + ' (kategori ' + (kat || '?') + ') tidak layak untuk kategori ' + a.Kategori + '.');
      const b = bil[kp] || { i: 0, b: 0 };
      if (berganti ? b.b + 1 > kt.hadBerganti : b.i + 1 > kt.hadIndividu) {
        return ralat(m.NamaPenuh + ' telah mencapai had ' + (berganti ? kt.hadBerganti + ' acara berganti-ganti' : kt.hadIndividu + ' acara individu') + '.');
      }
    }
    // ganti baris rumah ini bagi acara ini
    padamBarisBanyak(SHEET_PESERTA, semuaPeserta.filter(x => x.AcaraId === a.AcaraId && x.RumahId === rumahId));
    const masa = sekarangTeks();
    const baru = !dipilih.length ? [] : berganti
      ? [{ Id: janaId('PS'), Tahun: kt.tahun, AcaraId: a.AcaraId, RumahId: rumahId, NoKP: '', Ahli: dipilih.join(','), Status: 'OK', Dikemaskini: masa }]
      : dipilih.map(kp => ({ Id: janaId('PS'), Tahun: kt.tahun, AcaraId: a.AcaraId, RumahId: rumahId, NoKP: kp, Ahli: '', Status: 'OK', Dikemaskini: masa }));
    if (baru.length) tulisBarisBaharu(SHEET_PESERTA, baru);
    if (a.Status === 'SEDIA') {   // senarai mula lama tidak sah lagi
      upsertBanyak(SHEET_PESERTA, 'Id', bacaSheetSebagaiObjek(SHEET_PESERTA).filter(x => x.AcaraId === a.AcaraId).map(x => ({ Id: x.Id, Pusingan: '', Saringan: '', Lorong: '' })));
      a.Status = 'DIRANCANG'; a.Dikemaskini = masa;
      kemaskiniBaris(SHEET_ACARA, a.__row, a);
    }
    // AUTOMATIK: No. Bib bagi atlet baharu; jika pendaftaran sudah ditutup (perubahan oleh Admin), senarai mula dijana semula
    janaBibDalaman(kt);
    if (kt.pendaftaran === 'TUTUP' && a.Status === 'DIRANCANG' && dipilih.length) janaSenaraiMulaDalaman(a, kt);
    catatAudit(sesi, 'SIMPAN_PENYERTAAN', 'KEJOHANAN', a.AcaraId, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina + ' | rumah ' + rumahId + ': ' + dipilih.length + ' atlet');
    return jaya({ bil: dipilih.length });
  });
}

/* ------------------------- API: BUTIRAN ACARA / SENARAI MULA ------------------------- */
function butiranPeserta(x, murid, rumah) {
  const m = x.NoKP ? murid[normalKP(x.NoKP)] || {} : {};
  return {
    id: x.Id, rumahId: x.RumahId, rumah: rumah[x.RumahId] ? rumah[x.RumahId].nama : '', warna: rumah[x.RumahId] ? rumah[x.RumahId].warna : '#64748b',
    nokp: x.NoKP ? normalKP(x.NoKP) : '', nama: x.NoKP ? (m.nama || normalKP(x.NoKP)) : 'PASUKAN ' + (rumah[x.RumahId] ? rumah[x.RumahId].nama : ''),
    ahli: x.NoKP ? [] : namaAhli(x.Ahli, murid), kelas: m.kelas || '', bib: m.bib || '',
    pusingan: x.Pusingan || '', saringan: x.Saringan === 'M' ? '' : String(x.Saringan || ''), lorong: String(x.Lorong || ''),
    keputusan: String(x.Keputusan || ''), nilai: nombor(x.Nilai, 0), kedudukan: x.Kedudukan === '' ? '' : nombor(x.Kedudukan, 0) || '',
    mata: nombor(x.Mata, 0), status: x.Status || 'OK', rekodBaharu: ya(x.RekodBaharu), kedudukanManual: String(x.KedudukanManual || ''),
    kunci: x.RumahId + '|' + (x.NoKP ? normalKP(x.NoKP) : senaraiDaripadaMedan(x.Ahli).map(normalKP).sort().join(','))   // padan saringan <-> akhir
  };
}

function apiAcaraButiran(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  let a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
  if (!a) return ralat('Acara tidak dijumpai.');
  // AUTOMATIK: selepas pendaftaran ditutup, senarai mula dijana sebaik acara dibuka (tiada butang perlu ditekan)
  if ((!a.Status || a.Status === 'DIRANCANG') && kt.pendaftaran === 'TUTUP' && pesertaTahun(kt.tahun).some(x => x.AcaraId === a.AcaraId)) {
    const kunci = LockService.getScriptLock();
    if (kunci.tryLock(15000)) {
      try {
        a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
        if (!a.Status || a.Status === 'DIRANCANG') janaSenaraiMulaDalaman(a, kt);
      } finally { kunci.releaseLock(); }
      a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    }
  }
  const murid = petaMuridRingkas();
  const rumah = petaRumah();
  const peserta = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId).map(x => butiranPeserta(x, murid, rumah))
    .sort((x, y) => (x.pusingan === 'AKHIR') - (y.pusingan === 'AKHIR') || nombor(x.saringan, 99) - nombor(y.saringan, 99) || nombor(x.lorong, 99) - nombor(y.lorong, 99) || x.rumah.localeCompare(y.rumah));
  return jaya({ acara: acaraKeKlien(a), peserta, kebenaran: kebenaranKejohanan(sesi, kt.tahun) });
}

/* Jana senarai mula: balapan -> saringan & lorong (atau terus akhir jika muat); padang -> giliran.
   Atlet dari rumah sama diselang-seli supaya tidak bertembung dalam saringan yang sama.
   Dijana AUTOMATIK apabila pendaftaran ditutup / acara dibuka; butang Jana hanya untuk jana semula. */
function janaSenaraiMulaDalaman(a, kt) {
  const semua = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId);
  padamBarisBanyak(SHEET_PESERTA, semua.filter(x => x.Saringan === 'M'));   // buang baris akhir lama (jika ada)
  const daftar = semua.filter(x => x.Saringan !== 'M');
  if (!daftar.length) return 0;
  const rawak = penjanaRawak(Date.now() % 2147483647);
  const ikutRumah = {};
  kocok(daftar.slice(), rawak).forEach(x => { (ikutRumah[x.RumahId] = ikutRumah[x.RumahId] || []).push(x); });
  const kumpulan = kocok(Object.keys(ikutRumah), rawak).map(k => ikutRumah[k]);
  const tertib = [];
  for (let i = 0; tertib.length < daftar.length; i++) kumpulan.forEach(g => { if (g[i]) tertib.push(g[i]); });

  const masa = sekarangTeks(), objek = [];
  const lorong = Math.max(4, Math.min(10, nombor(a.BilLorong, 8)));
  if (a.Jenis === 'PADANG') {
    tertib.forEach((x, i) => objek.push({ Id: x.Id, Pusingan: 'AKHIR', Saringan: '1', Lorong: String(i + 1) }));
  } else {
    const bilSaringan = Math.ceil(tertib.length / lorong);
    const pusingan = bilSaringan > 1 ? 'SARINGAN' : 'AKHIR';
    const saringan = [];
    for (let h = 0; h < bilSaringan; h++) saringan.push([]);
    // saiz saringan seimbang dahulu, kemudian rumah yang paling sedikit dalam saringan itu (atlet serumah tersebar)
    const bilRumah = saringan.map(() => ({}));
    tertib.forEach(x => {
      const min = Math.min.apply(null, saringan.map(g => g.length));
      let pilih = -1;
      saringan.forEach((g, h) => {
        if (g.length !== min) return;
        if (pilih === -1 || (bilRumah[h][x.RumahId] || 0) < (bilRumah[pilih][x.RumahId] || 0)) pilih = h;
      });
      saringan[pilih].push(x);
      bilRumah[pilih][x.RumahId] = (bilRumah[pilih][x.RumahId] || 0) + 1;
    });
    const lo = susunanLorong(lorong);
    saringan.forEach((g, h) => g.forEach((x, i) => objek.push({ Id: x.Id, Pusingan: pusingan, Saringan: String(h + 1), Lorong: String(lo[i] || i + 1) })));
  }
  objek.forEach(o => { o.Keputusan = ''; o.Nilai = ''; o.Kedudukan = ''; o.Mata = ''; o.Status = 'OK'; o.RekodBaharu = ''; o.Dikemaskini = masa; });
  upsertBanyak(SHEET_PESERTA, 'Id', objek);
  a.Status = 'SEDIA'; a.BilLorong = lorong; a.Dikemaskini = masa;
  kiraRekodAuto(a, [], {}, {});   // tiada keputusan lagi -> rekod kembali kepada rekod asal
  kemaskiniBaris(SHEET_ACARA, a.__row, a);
  return objek.length;
}

function janaSemuaSenaraiMula(kt) {
  const ada = {};
  pesertaTahun(kt.tahun).forEach(x => { ada[x.AcaraId] = true; });
  let bil = 0;
  acaraTahun(kt.tahun).forEach(a => { if ((!a.Status || a.Status === 'DIRANCANG') && ada[a.AcaraId]) { janaSenaraiMulaDalaman(a, kt); bil++; } });
  return bil;
}

/* Jana semula (rawak semula) senarai mula sesuatu acara — pilihan; senarai mula sudah dijana automatik. */
function apiJanaSenaraiMula(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  return denganKunci(() => {
    const a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    if (!a) return ralat('Acara tidak dijumpai.');
    if (a.Status === 'SARINGAN' || a.Status === 'SELESAI') return ralat('Acara ini sudah mempunyai keputusan. Set semula dahulu untuk menjana semula.');
    if (p.bilLorong) a.BilLorong = p.bilLorong;
    const bil = janaSenaraiMulaDalaman(a, kt);
    if (!bil) return ralat('Tiada peserta berdaftar untuk acara ini.');
    janaBibDalaman(kt);
    catatAudit(sesi, 'JANA_SENARAI_MULA', 'KEJOHANAN', a.AcaraId, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina + ': ' + bil + ' peserta');
    return jaya({ bil });
  });
}

/* Simpan keputusan satu pusingan. p = {acaraId, pusingan, baris:[{id, keputusan, status}]} */
function apiSimpanKeputusan(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  const pusingan = p.pusingan === 'SARINGAN' ? 'SARINGAN' : 'AKHIR';
  return denganKunci(() => {
    const a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    if (!a) return ralat('Acara tidak dijumpai.');
    if (!a.Status || a.Status === 'DIRANCANG') janaSenaraiMulaDalaman(a, kt);   // AUTOMATIK
    const input = {};
    (p.baris || []).forEach(b => { input[b.id] = b; });
    const baris = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId && x.Pusingan === pusingan);
    if (!baris.length) return ralat('Tiada peserta bagi pusingan ini.');
    const ralatInput = [];
    const data = baris.map(x => {
      const b = input[x.Id] || { keputusan: x.Keputusan, status: x.Status };
      const status = STATUS_PESERTA.indexOf(b.status) !== -1 ? b.status : 'OK';
      const nilai = status === 'OK' ? huraiKeputusan(b.keputusan, a.Unit) : null;
      if (status === 'OK' && String(b.keputusan || '').trim() && nilai === null) ralatInput.push(String(b.keputusan));
      const km = String(b.kedudukanManual === undefined ? (x.KedudukanManual || '') : b.kedudukanManual).trim();
      return { x, status, nilai, saringan: x.Saringan, manual: /^\d+$/.test(km) && Number(km) > 0 ? Number(km) : '' };
    });
    if (ralatInput.length) return ralat('Keputusan tidak sah: ' + ralatInput.slice(0, 5).join(', ') + '. Contoh masa: 12.345 · 1:05.321 · jarak: 4.35');

    // kedudukan: saringan dalam setiap saringan; akhir keseluruhan
    const kumpulan = {};
    data.forEach(d => { (kumpulan[pusingan === 'SARINGAN' ? d.saringan : 'A'] = kumpulan[pusingan === 'SARINGAN' ? d.saringan : 'A'] || []).push(d); });
    Object.keys(kumpulan).forEach(k => tetapkanKedudukan(kumpulan[k], a.Unit));
    // kedudukan yang ditetapkan manual (cth. keputusan hakim / photo-finish) mengatasi kedudukan automatik
    data.forEach(d => { if (d.manual) d.kedudukan = d.manual; });
    const mataJadual = a.Jenis === 'BERGANTI' ? kt.mataBerganti : kt.mataIndividu;
    const rekod = huraiKeputusan(rekodAsal(a).nilai, a.Unit);   // pecah rekod = lebih baik daripada rekod SEBELUM kejohanan ini
    const masa = sekarangTeks();
    let lengkap = true, rekodBaru = 0;
    const objek = data.map(d => {
      if (d.status === 'OK' && !d.nilai && !d.manual) lengkap = false;
      const baru = d.nilai && rekod !== null && lebihBaik(d.nilai, rekod, a.Unit);
      if (baru) rekodBaru++;
      return { Id: d.x.Id, Keputusan: d.nilai ? formatKeputusan(d.nilai, a.Unit) : '', Nilai: d.nilai || '', Status: d.status,
        Kedudukan: d.kedudukan || '', Mata: pusingan === 'AKHIR' && d.kedudukan ? (mataJadual[d.kedudukan - 1] || 0) : '',
        RekodBaharu: baru ? 'YA' : '', KedudukanManual: d.manual || '', Dikemaskini: masa };
    });
    upsertBanyak(SHEET_PESERTA, 'Id', objek);
    if (lengkap) a.Status = pusingan === 'AKHIR' ? 'SELESAI' : 'SARINGAN';
    else if (a.Status === 'SELESAI' && pusingan === 'AKHIR') a.Status = baris.some(x => x.Saringan === 'M') ? 'SARINGAN' : 'SEDIA';
    a.Dikemaskini = masa;
    // AUTOMATIK: rekod kejohanan dikira semula daripada semua keputusan sah acara ini
    const rekodBerubah = kiraRekodAuto(a, pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId), petaMuridRingkas(), petaRumah());
    kemaskiniBaris(SHEET_ACARA, a.__row, a);
    // AUTOMATIK: saringan lengkap -> finalis terbaik terus dimarakan ke pusingan akhir (jika akhir belum bermula)
    let keAkhir = 0;
    if (pusingan === 'SARINGAN' && lengkap) {
      const akhirLama = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId && x.Saringan === 'M');
      if (!ya(a.AkhirManual) && !akhirLama.some(x => String(x.Keputusan || '') || (x.Status && x.Status !== 'OK'))) keAkhir = maraKeAkhirDalaman(a, kt);
    }
    catatAudit(sesi, 'SIMPAN_KEPUTUSAN', 'KEJOHANAN', a.AcaraId, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina + ' (' + pusingan + ')' + (lengkap ? ' lengkap' : ' separa') +
      (rekodBaru ? ' · ' + rekodBaru + ' pecah rekod' : '') + (keAkhir ? ' · ' + keAkhir + ' mara ke akhir' : ''));
    return jaya({ lengkap, rekodBaru, rekodBerubah, keAkhir, status: a.Status, rekod: a.RekodNilai });
  });
}

/* SUNTINGAN MANUAL senarai mula: tukar saringan / lorong (giliran) peserta. p = {acaraId, baris:[{id, saringan, lorong}]} */
function apiSimpanSenaraiMula(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  return denganKunci(() => {
    const a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    if (!a) return ralat('Acara tidak dijumpai.');
    const semua = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId);
    const ikutId = {};
    semua.forEach(x => { ikutId[x.Id] = x; });
    const objek = [], guna = {}, dihantar = {};
    (p.baris || []).forEach(b => { dihantar[b.id] = true; });
    // lorong peserta yang tidak diubah turut dikira supaya tiada lorong berganda
    semua.filter(x => x.Pusingan && !dihantar[x.Id] && x.Lorong).forEach(x => { guna[x.Pusingan + '|' + x.Saringan + '|' + Number(x.Lorong)] = true; });
    for (const b of (p.baris || [])) {
      const x = ikutId[b.id];
      if (!x || !x.Pusingan) continue;
      const lorong = String(b.lorong || '').trim(), saringan = x.Saringan === 'M' ? 'M' : String(b.saringan || x.Saringan || '1').trim();
      if (!/^\d+$/.test(lorong) || Number(lorong) < 1) return ralat('Lorong / giliran mesti nombor positif.');
      if (saringan !== 'M' && !/^\d+$/.test(saringan)) return ralat('No. saringan mesti nombor.');
      const k = x.Pusingan + '|' + saringan + '|' + Number(lorong);
      if (guna[k]) return ralat('Lorong ' + lorong + (x.Pusingan === 'SARINGAN' ? ' dalam saringan ' + saringan : '') + ' digunakan lebih daripada sekali.');
      guna[k] = true;
      objek.push({ Id: x.Id, Saringan: saringan, Lorong: String(Number(lorong)), Dikemaskini: sekarangTeks() });
    }
    if (!objek.length) return ralat('Tiada perubahan senarai mula.');
    upsertBanyak(SHEET_PESERTA, 'Id', objek);
    catatAudit(sesi, 'SUNTING_SENARAI_MULA', 'KEJOHANAN', a.AcaraId, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina + ': ' + objek.length + ' peserta');
    return jaya({ bil: objek.length });
  });
}

/* PEMILIHAN FINALIS MANUAL: p = {acaraId, ids:[Id baris saringan]} — mengatasi mara automatik. */
function apiTetapkanFinalis(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  return denganKunci(() => {
    const a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    if (!a) return ralat('Acara tidak dijumpai.');
    const semua = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId);
    const pilih = {};
    (p.ids || []).forEach(id => { pilih[id] = true; });
    const layak = semua.filter(x => x.Pusingan === 'SARINGAN' && pilih[x.Id]);
    if (layak.length < 2) return ralat('Pilih sekurang-kurangnya 2 finalis.');
    if (layak.length > 10) return ralat('Maksimum 10 finalis.');
    if (semua.some(x => x.Saringan === 'M' && (String(x.Keputusan || '') || (x.Status && x.Status !== 'OK')))) return ralat('Keputusan akhir sudah dimasukkan. Kosongkan keputusan akhir dahulu sebelum menukar finalis.');
    // susun ikut keputusan saringan (terbaik di lorong tengah); tanpa keputusan di hujung
    layak.sort((x, y) => {
      const nx = nombor(x.Nilai, 0), ny = nombor(y.Nilai, 0);
      if (!nx || !ny) return (ny > 0) - (nx > 0);
      return a.Unit === 'MASA' ? nx - ny : ny - nx;
    });
    padamBarisBanyak(SHEET_PESERTA, semua.filter(x => x.Saringan === 'M'));
    const lo = susunanLorong(Math.max(layak.length, nombor(a.BilLorong, 8))), masa = sekarangTeks();
    tulisBarisBaharu(SHEET_PESERTA, layak.map((x, i) => ({ Id: janaId('PS'), Tahun: kt.tahun, AcaraId: a.AcaraId, RumahId: x.RumahId, NoKP: x.NoKP, Ahli: x.Ahli,
      Pusingan: 'AKHIR', Saringan: 'M', Lorong: String(lo[i] || i + 1), Status: 'OK', Dikemaskini: masa })));
    a.AkhirManual = 'YA'; a.BilKeAkhir = layak.length; a.Dikemaskini = masa;
    if (a.Status === 'SEDIA') a.Status = 'SARINGAN';
    kemaskiniBaris(SHEET_ACARA, a.__row, a);
    catatAudit(sesi, 'TETAPKAN_FINALIS', 'KEJOHANAN', a.AcaraId, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina + ': ' + layak.length + ' finalis (manual)');
    return jaya({ bil: layak.length });
  });
}

/* Pilih atlet terpantas/terbaik merentasi semua saringan untuk ke pusingan akhir (AUTOMATIK selepas saringan lengkap). */
function maraKeAkhirDalaman(a, kt, bilDiminta) {
  const semua = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId);
  const bil = Math.max(2, Math.min(10, nombor(bilDiminta, nombor(a.BilKeAkhir, 0) || nombor(a.BilLorong, 8))));
  const layak = semua.filter(x => x.Pusingan === 'SARINGAN' && x.Status === 'OK' && nombor(x.Nilai, 0) > 0)
    .sort((x, y) => a.Unit === 'MASA' ? nombor(x.Nilai, 0) - nombor(y.Nilai, 0) : nombor(y.Nilai, 0) - nombor(x.Nilai, 0)).slice(0, bil);
  if (!layak.length) return 0;
  padamBarisBanyak(SHEET_PESERTA, semua.filter(x => x.Saringan === 'M'));
  const masa = sekarangTeks();
  const lo = susunanLorong(Math.max(bil, nombor(a.BilLorong, 8)));
  tulisBarisBaharu(SHEET_PESERTA, layak.map((x, i) => ({
    Id: janaId('PS'), Tahun: kt.tahun, AcaraId: a.AcaraId, RumahId: x.RumahId, NoKP: x.NoKP, Ahli: x.Ahli, Pusingan: 'AKHIR', Saringan: 'M',
    Lorong: String(lo[i] || i + 1), Status: 'OK', Dikemaskini: masa
  })));
  return layak.length;
}

/* Pilih semula finalis dengan bilangan lain (pilihan; mara ke akhir sudah automatik). */
function apiMaraKeAkhir(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  return denganKunci(() => {
    const a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    if (!a) return ralat('Acara tidak dijumpai.');
    if (a.Status !== 'SARINGAN') return ralat('Lengkapkan keputusan semua saringan dahulu.');
    const bil = maraKeAkhirDalaman(a, kt, p.bil);
    if (!bil) return ralat('Tiada keputusan saringan yang sah.');
    a.BilKeAkhir = bil; a.AkhirManual = 'YA'; a.Dikemaskini = sekarangTeks();
    kemaskiniBaris(SHEET_ACARA, a.__row, a);
    catatAudit(sesi, 'MARA_KE_AKHIR', 'KEJOHANAN', a.AcaraId, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina + ': ' + bil + ' ke akhir');
    return jaya({ bil });
  });
}

/* Kosongkan semua keputusan & senarai mula sesuatu acara (kembali ke DIRANCANG). */
function apiSetSemulaAcara(p) {
  const sesi = wajibKeputusan(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  return denganKunci(() => {
    const a = acaraTahun(kt.tahun).find(x => x.AcaraId === p.acaraId);
    if (!a) return ralat('Acara tidak dijumpai.');
    const semua = pesertaTahun(kt.tahun).filter(x => x.AcaraId === a.AcaraId);
    padamBarisBanyak(SHEET_PESERTA, semua.filter(x => x.Saringan === 'M'));
    const masa = sekarangTeks();
    upsertBanyak(SHEET_PESERTA, 'Id', semua.filter(x => x.Saringan !== 'M').map(x => ({ Id: x.Id, Pusingan: '', Saringan: '', Lorong: '', Keputusan: '',
      Nilai: '', Kedudukan: '', Mata: '', Status: 'OK', RekodBaharu: '', KedudukanManual: '', Dikemaskini: masa })));
    a.Status = 'DIRANCANG'; a.AkhirManual = ''; a.Dikemaskini = masa;
    kiraRekodAuto(a, [], {}, {});
    kemaskiniBaris(SHEET_ACARA, a.__row, a);
    catatAudit(sesi, 'SET_SEMULA_ACARA', 'KEJOHANAN', a.AcaraId, a.Nama + ' ' + a.Kategori + ' ' + a.Jantina);
    return jaya({});
  });
}

/* Kira semula mata bagi semua acara akhir (selepas jadual mata ditukar). */
function kiraSemulaMataSemua() {
  const kt = tetKejohanan();
  const acara = {};
  acaraTahun(kt.tahun).forEach(a => { acara[a.AcaraId] = a; });
  const objek = [];
  pesertaTahun(kt.tahun).forEach(x => {
    const a = acara[x.AcaraId];
    if (!a || x.Pusingan !== 'AKHIR') return;
    const k = nombor(x.Kedudukan, 0);
    const jadual = a.Jenis === 'BERGANTI' ? kt.mataBerganti : kt.mataIndividu;
    const mata = k ? (jadual[k - 1] || 0) : '';
    if (String(mata) !== String(x.Mata)) objek.push({ Id: x.Id, Mata: mata });
  });
  if (objek.length) upsertBanyak(SHEET_PESERTA, 'Id', objek);
  return objek.length;
}

/* ------------------------- API: MATA LAIN-LAIN ------------------------- */
function apiSimpanMataLain(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const d = p.data || {};
  if (!petaRumah()[d.rumahId]) return ralat('Pilih rumah sukan.');
  const perkara = teksBersih(d.perkara).toUpperCase();
  if (!perkara) return ralat('Perkara diperlukan (cth. PERBARISAN).');
  const mata = Number(d.mata);
  if (!isFinite(mata)) return ralat('Mata mesti nombor.');
  return denganKunci(() => {
    const o = { RumahId: d.rumahId, Perkara: perkara, Mata: mata, Catatan: teksBersih(d.catatan), Dikemaskini: sekarangTeks() };
    if (d.id) {
      const r = cariBarisMengikutId(SHEET_MATA_LAIN, 'Id', d.id);
      if (!r) return ralat('Rekod tidak dijumpai.');
      kemaskiniBaris(SHEET_MATA_LAIN, r.__row, Object.assign(r, o));
    } else {
      tambahBaris(SHEET_MATA_LAIN, Object.assign(o, { Id: janaId('ML'), Tahun: tahunKejohanan() }));
    }
    catatAudit(sesi, 'SIMPAN_MATA_LAIN', 'KEJOHANAN', d.id || '', perkara + ' ' + d.rumahId + ' ' + mata);
    return jaya({});
  });
}

function apiPadamMataLain(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const r = cariBarisMengikutId(SHEET_MATA_LAIN, 'Id', p.id);
    if (!r) return ralat('Rekod tidak dijumpai.');
    padamBaris(SHEET_MATA_LAIN, r.__row, r.Id);
    catatAudit(sesi, 'PADAM_MATA_LAIN', 'KEJOHANAN', p.id, r.Perkara);
    return jaya({});
  });
}

/* ------------------------- NO. BIB (AUTOMATIK) -------------------------
   Setiap atlet berdaftar diberi No. Bib secara automatik: <no. rumah><3 digit>, cth. 1001. Bib sedia ada kekal. */
function janaBibDalaman(kt) {
  const rumah = senaraiRumah();
  const indeks = {};
  rumah.forEach((r, i) => { indeks[r.id] = i + 1; });
  const perlu = {};
  pesertaTahun(kt.tahun).forEach(x => (x.NoKP ? [x.NoKP] : senaraiDaripadaMedan(x.Ahli)).forEach(kp => { perlu[normalKP(kp)] = true; }));
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => m.NoKP && indeks[m.RumahId]);
  const maks = {};
  murid.forEach(m => { const n = nombor(m.NoBib, 0); if (n) maks[m.RumahId] = Math.max(maks[m.RumahId] || 0, n % 1000); });
  const objek = [];
  murid.filter(m => perlu[normalKP(m.NoKP)] && !String(m.NoBib || '')).sort((a, b) => String(a.NamaPenuh).localeCompare(String(b.NamaPenuh))).forEach(m => {
    const seq = (maks[m.RumahId] || 0) + 1;
    maks[m.RumahId] = seq;
    objek.push({ NoKP: m.NoKP, NoBib: String(indeks[m.RumahId] * 1000 + seq) });
  });
  if (objek.length) upsertBanyak(SHEET_MURID, 'NoKP', objek);
  return objek.length;
}

/* ------------------------- API: LAPORAN (buku keputusan) ------------------------- */
function apiLaporanKejohanan(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const kt = tetKejohanan();
  const murid = petaMuridRingkas();
  const rumah = petaRumah();
  const peserta = pesertaTahun(kt.tahun);
  const ikutAcara = {};
  peserta.forEach(x => { (ikutAcara[x.AcaraId] = ikutAcara[x.AcaraId] || []).push(x); });
  const acara = acaraTahun(kt.tahun).map(a => {
    const k = acaraKeKlien(a);
    const semua = (ikutAcara[a.AcaraId] || []).map(x => butiranPeserta(x, murid, rumah));
    k.akhir = semua.filter(x => x.pusingan === 'AKHIR').sort((x, y) => (nombor(x.kedudukan, 99) || 99) - (nombor(y.kedudukan, 99) || 99) || nombor(x.lorong, 99) - nombor(y.lorong, 99));
    k.saringan = semua.filter(x => x.pusingan === 'SARINGAN').sort((x, y) => nombor(x.saringan, 99) - nombor(y.saringan, 99) || nombor(x.lorong, 99) - nombor(y.lorong, 99));
    k.daftar = semua.filter(x => !x.pusingan);
    return k;
  });
  return jaya({ tet: kt, acara });
}

/* ------------------------- PORTAL MURID ------------------------- */
function kejohananMurid(sesi) {
  const tet = bacaTetapan();
  const kt = tetKejohanan(tet);
  const kp = sesi.nokp;
  const acara = {};
  acaraTahun(kt.tahun).forEach(a => { acara[a.AcaraId] = a; });
  const rumah = petaRumah();
  const saya = pesertaTahun(kt.tahun).filter(x => acara[x.AcaraId] && (normalKP(x.NoKP) === kp || senaraiDaripadaMedan(x.Ahli).map(normalKP).indexOf(kp) !== -1))
    .map(x => {
      const a = acara[x.AcaraId];
      const k = acaraKeKlien(a);
      return { acara: k.nama, kategori: k.kategori, jantina: k.jantina, jenis: k.jenis, tarikh: k.tarikh, masa: k.masa, no: k.no,
        pusingan: x.Pusingan || '', saringan: x.Saringan === 'M' ? '' : String(x.Saringan || ''), lorong: String(x.Lorong || ''),
        keputusan: kt.terbit ? String(x.Keputusan || '') : '', kedudukan: kt.terbit ? (nombor(x.Kedudukan, 0) || '') : '',
        mata: kt.terbit ? nombor(x.Mata, 0) : '', status: x.Status || 'OK', rekodBaharu: kt.terbit && ya(x.RekodBaharu) };
    }).sort((x, y) => (x.tarikh + x.masa).localeCompare(y.tarikh + y.masa) || (x.pusingan === 'AKHIR') - (y.pusingan === 'AKHIR'));
  const hasil = { nama: kt.nama, tahun: kt.tahun, tarikh: kt.tarikh, lokasi: kt.lokasi, terbit: kt.terbit, bib: String(sesi.rekod.NoBib || ''), acaraSaya: saya, kedudukan: null };
  if (kt.terbit) hasil.kedudukan = ringkasanKejohanan(tet).kedudukan;
  return hasil;
}
