/* =========================================================================
 * MuridService.gs — Data murid & penyegerakan daripada e-Kokurikulum.
 *
 * Peraturan penyegerakan (selamat untuk Arkib / Naik Tingkatan):
 *  - Nama, unit PBB/KP/SP sentiasa diambil daripada e-Kokurikulum.
 *  - TINGKATAN tidak pernah dinaikkan oleh penyegerakan (hanya fungsi Naik
 *    Tingkatan yang menaikkannya). Kelas dikemaskini hanya jika tingkatan di
 *    kedua-dua sistem SAMA. Murid yang baru dinaikkan (PerluSemak = YA) akan
 *    menerima kelas baharu sebaik sahaja e-Kokurikulum turut dinaikkan.
 *  - Murid yang sudah TAMAT (Tingkatan 5 diarkibkan) tidak disentuh.
 * ========================================================================= */

const HEADER_MURID = ['NoKP', 'Nama', 'Jantina', 'Tingkatan', 'Kelas', 'KunciKelas', 'CGPA_Sebelum', 'SejarahCGPA',
  'PBB_Unit', 'KP_Unit', 'SP_Unit', 'Status', 'PerluSemak', 'SegerakTerakhir', 'TahunTamat'];

const HEADER_ASPEK = ['Kunci', 'NoKP', 'Aspek', 'Unit', 'Jawatan', 'Libat1', 'Capai1', 'Aktiviti2', 'Libat2', 'Capai2',
  'Komit1', 'Komit2', 'Komit3', 'Komit4', 'Khidmat', 'KehadiranAuto', 'KehadiranManual', 'Kehadiran',
  'SkorJawatan', 'SkorLibat', 'SkorCapai', 'SkorKomit', 'SkorKhidmat', 'SkorKehadiran', 'Skor', 'Markah', 'Dikemaskini', 'OlehKP',
  'JawatanKoko',    // jawatan terakhir yang dilihat dalam e-Kokurikulum (untuk mengesan perubahan)
  'PencapaianKoko']; // aktiviti 1/2 yang diisi automatik daripada PENCAPAIAN e-Kokurikulum (JSON: ID + label)

const HEADER_EKSTRA = ['NoKP', 'Perkhidmatan', 'AnugerahKhas', 'KhidmatMasyarakat', 'Nilam', 'TimmsPisa', 'TugasKhas',
  'SkPerkhidmatan', 'SkAnugerah', 'SkKM', 'SkNilam', 'SkTimms', 'SkTugas', 'SkorTertinggi', 'Dikemaskini', 'OlehKP'];

const HEADER_RUMUSAN = ['NoKP', 'Nama', 'Tingkatan', 'Kelas', 'KunciKelas', 'CGPA_Sebelum', 'PBB', 'SP', 'KP', 'Ekstra',
  'Purata2Tertinggi', 'GPA', 'CGPA', 'Persepuluh', 'Gred', 'Label', 'Rumusan', 'Dikemaskini'];

/* ------------------------- OBJEK KOSONG ------------------------- */
function kunciAspek(nokp, aspek) { return nokp + '|' + aspek; }

function aspekKosong(nokp, aspek, unit) {
  return {
    Kunci: kunciAspek(nokp, aspek), NoKP: nokp, Aspek: aspek, Unit: unit || '', Jawatan: '', Libat1: '', Capai1: '',
    Aktiviti2: '', Libat2: '', Capai2: '', Komit1: '', Komit2: '', Komit3: '', Komit4: '', Khidmat: '',
    KehadiranAuto: 0, KehadiranManual: '', Kehadiran: 0,
    SkorJawatan: 0, SkorLibat: 0, SkorCapai: 0, SkorKomit: 0, SkorKhidmat: 0, SkorKehadiran: 0, Skor: 0, Markah: 0,
    Dikemaskini: '', OlehKP: '', JawatanKoko: '', PencapaianKoko: ''
  };
}

function ekstraKosong(nokp) {
  return {
    NoKP: nokp, Perkhidmatan: '', AnugerahKhas: '', KhidmatMasyarakat: '', Nilam: '', TimmsPisa: '', TugasKhas: '',
    SkPerkhidmatan: 0, SkAnugerah: 0, SkKM: 0, SkNilam: 0, SkTimms: 0, SkTugas: 0, SkorTertinggi: 0, Dikemaskini: '', OlehKP: ''
  };
}

/* Tetapkan Kehadiran akhir (manual mengatasi auto) kemudian kira semua skor aspek. */
function kiraSemulaAspek(rec, ref) {
  const manual = rec.KehadiranManual;
  const guna = (manual === '' || manual === null || manual === undefined) ? nombor(rec.KehadiranAuto) : nombor(manual);
  rec.Kehadiran = Math.max(0, Math.min(KEHADIRAN_MAKSIMUM, Math.floor(guna)));
  Object.assign(rec, kiraAspekMurni(rec, ref));
  return rec;
}

function kiraSemulaEkstra(rec, ref) {
  Object.assign(rec, kiraEkstraMurni(rec, ref));
  return rec;
}

function binaRumusan(murid, aspekMap, ekstraMap, ref) {
  const nokp = normalKP(murid.NoKP);
  const markah = a => nombor((aspekMap[kunciAspek(nokp, a)] || {}).Markah);
  const ek = ekstraMap[nokp];
  const ekTinggi = ek ? nombor(ek.SkorTertinggi) : 0;
  const cg = murid.CGPA_Sebelum === '' || murid.CGPA_Sebelum === null || murid.CGPA_Sebelum === undefined ? '' : nombor(murid.CGPA_Sebelum);
  const r = kiraRumusanMurni(markah(ASPEK_PBB), markah(ASPEK_SP), markah(ASPEK_KP), ekTinggi, cg, ref);
  return Object.assign({
    NoKP: nokp, Nama: murid.Nama, Tingkatan: murid.Tingkatan, Kelas: murid.Kelas, KunciKelas: murid.KunciKelas,
    CGPA_Sebelum: cg, PBB: markah(ASPEK_PBB), SP: markah(ASPEK_SP), KP: markah(ASPEK_KP), Ekstra: ekTinggi,
    Dikemaskini: sekarangTeks()
  }, r);
}

/* ------------------------- KONTEKS (baca sekali) ------------------------- */
/* kunciKelas null => semua murid aktif. */
function muatKonteks(kunciKelas) {
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m =>
    String(m.Status).toUpperCase() === 'AKTIF' && (!kunciKelas || m.KunciKelas === kunciKelas));
  murid.forEach(m => { m.NoKP = normalKP(m.NoKP); });
  const set = {};
  murid.forEach(m => { set[m.NoKP] = true; });
  const aspekMap = {}, ekstraMap = {}, rumusanMap = {};
  bacaSheetSebagaiObjek(SHEET_ASPEK).forEach(r => { r.NoKP = normalKP(r.NoKP); if (set[r.NoKP]) aspekMap[r.Kunci] = r; });
  bacaSheetSebagaiObjek(SHEET_EKSTRA).forEach(r => { r.NoKP = normalKP(r.NoKP); if (set[r.NoKP]) ekstraMap[r.NoKP] = r; });
  bacaSheetSebagaiObjek(SHEET_RUMUSAN).forEach(r => { r.NoKP = normalKP(r.NoKP); if (set[r.NoKP]) rumusanMap[r.NoKP] = r; });
  murid.sort((a, b) => String(a.Nama).localeCompare(String(b.Nama)));
  return { murid, aspekMap, ekstraMap, rumusanMap };
}

function sesiBolehKelas(sesi, kelas) {
  return !!kelas && wajibAksesKelas(sesi, kelas);
}

/* ------------------------- SEGERAK DARIPADA e-KOKURIKULUM ------------------------- */
/* Segerak "delta": data e-Kokurikulum dibaca melalui cache berasaskan masa kemas kini fail; hanya baris yang
   BENAR-BENAR berubah ditulis ke Sheet (menjimatkan masa dan tidak menaikkan versi data tanpa sebab).
   MESTI dipanggil dalam denganKunci(). */
function laksanakanSegerak(kunciKelas, paksa) {
  pastikanStrukturTerkini();
  const tahun = tahunSemasa();
  const ref = muatRujukan();
  const koko = bacaKokoRingkas(tahun, !!paksa);
  const hadir = { kira: koko.kira, amaran: koko.amaran || [] };

  const sediaAda = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => { sediaAda[normalKP(m.NoKP)] = m; });
  const aspekMap = {}, ekstraMap = {}, rumusanAda = {};
  bacaSheetSebagaiObjek(SHEET_ASPEK).forEach(r => { aspekMap[r.Kunci] = r; });
  bacaSheetSebagaiObjek(SHEET_EKSTRA).forEach(r => { ekstraMap[normalKP(r.NoKP)] = r; });
  bacaSheetSebagaiObjek(SHEET_RUMUSAN).forEach(r => { rumusanAda[normalKP(r.NoKP)] = true; });

  const laporan = { baharu: 0, dikemaskini: 0, jawatanDikemaskini: 0, jawatanTidakDikenali: [], pencapaianDiisi: 0, pencapaianTiadaUnit: [], kelasBerubah: 0, tingkatanBeza: [], tiadaDiKoko: 0, amaran: hadir.amaran.slice(), diubah: 0, dariCache: !!koko.dariCache };
  const kokoMap = {};
  const muridUbah = [];
  const proses = [];     // murid (objek akhir) dalam skop, untuk semakan aspek/rumusan
  const masa = sekarangTeks();
  let capaiPeta = {};
  try { capaiPeta = petaPencapaianKokoTahun(tahun); } catch (e) { laporan.amaran.push('Sheet PENCAPAIAN e-Kokurikulum tidak dapat dibaca: ' + e.message); }

  koko.murid.forEach(k => {
    kokoMap[k.nokp] = k;
    const sedia = sediaAda[k.nokp];
    if (kunciKelas && !(k.kunciKelas === kunciKelas || (sedia && sedia.KunciKelas === kunciKelas))) return;
    if (sedia && String(sedia.Status).toUpperCase() === 'TAMAT') return;
    let obj, berubah = false;
    if (!sedia) {
      obj = {
        NoKP: k.nokp, Nama: k.nama, Jantina: jantinaDaripadaKP(k.nokp), Tingkatan: k.tingkatan, Kelas: k.kelas,
        KunciKelas: k.kunciKelas, CGPA_Sebelum: '', SejarahCGPA: '', Status: 'AKTIF', PerluSemak: '', TahunTamat: ''
      };
      SEMUA_ASPEK.forEach(a => { obj[a + '_Unit'] = k.unit[a]; });
      obj.SegerakTerakhir = masa;
      laporan.baharu++;
      berubah = true;
    } else {
      obj = Object.assign({}, sedia);
      obj.NoKP = k.nokp;
      const tetapkan = (medan, nilai) => { if (String(obj[medan] === undefined ? '' : obj[medan]) !== String(nilai)) { obj[medan] = nilai; berubah = true; } };
      tetapkan('Nama', k.nama);
      if (!obj.Jantina) tetapkan('Jantina', jantinaDaripadaKP(k.nokp));
      if (nomborTingkatan(sedia.Tingkatan) === k.tingkatan) {
        if (sedia.Kelas !== k.kelas) laporan.kelasBerubah++;
        tetapkan('Kelas', k.kelas);
        tetapkan('KunciKelas', k.kunciKelas);
        tetapkan('PerluSemak', '');
      } else {
        laporan.tingkatanBeza.push(k.nama + ' (PAJSK: T' + sedia.Tingkatan + ', e-Koko: T' + k.tingkatan + ')');
      }
      SEMUA_ASPEK.forEach(a => tetapkan(a + '_Unit', k.unit[a]));
      if (berubah) obj.SegerakTerakhir = masa;
      laporan.dikemaskini++;
    }
    if (berubah) muridUbah.push(obj);
    proses.push(obj);
  });

  Object.keys(sediaAda).forEach(kp => {
    const m = sediaAda[kp];
    if (String(m.Status).toUpperCase() !== 'AKTIF' || kokoMap[kp]) return;
    if (kunciKelas && m.KunciKelas !== kunciKelas) return;
    laporan.tiadaDiKoko++;
  });

  // ASPEK (unit, kehadiran auto, jawatan e-Kokurikulum jika diisi) — tulis hanya yang berubah; RUMUSAN bagi yang terjejas.
  const aspekUbah = [], rumusanUbah = [];
  const muridUbahSet = {};
  muridUbah.forEach(m => { muridUbahSet[m.NoKP] = true; });
  proses.forEach(m => {
    const k = kokoMap[m.NoKP];
    let aspekBerubah = false;
    const capaiAspek = kumpulPencapaianMurid(m, capaiPeta, ref, laporan);
    SEMUA_ASPEK.forEach(a => {
      const unit = m[a + '_Unit'];
      const kunci = kunciAspek(m.NoKP, a);
      let rec = aspekMap[kunci];
      const jawMentah = k ? k.jawatan[a] : '';
      const jawKoko = labelJawatanKoko(jawMentah, ref);
      if (jawMentah && !jawKoko && laporan.jawatanTidakDikenali.length < 30) laporan.jawatanTidakDikenali.push(m.Nama + ' (' + a + '): "' + jawMentah + '"');
      if (!rec && !unit && !jawKoko) return;
      const medanCapai = () => [rec.Libat1, rec.Capai1, rec.Libat2, rec.Capai2, rec.PencapaianKoko].join('|');
      const hadirAuto = Math.min(KEHADIRAN_MAKSIMUM, hadir.kira[a][m.NoKP] || 0);
      const baharu = !rec;
      if (baharu) { rec = aspekKosong(m.NoKP, a, unit); aspekMap[kunci] = rec; }
      const sebelum = [rec.Unit, rec.Jawatan, rec.KehadiranAuto, rec.JawatanKoko].join('|') + '|' + medanCapai();
      rec.Unit = unit || rec.Unit;
      // Jawatan: e-Kokurikulum menjadi sumber. Apabila jawatan di e-Kokurikulum BERUBAH sejak segerak lepas, ia
      // menggantikan jawatan dalam e-PAJSK. Jika tidak berubah, suntingan KGP dalam e-PAJSK dikekalkan.
      // Jawatan yang tidak dikenali dalam jadual skor diabaikan (dilaporkan).
      if (k && !(jawMentah && !jawKoko)) {
        const lepas = String(rec.JawatanKoko || '');
        if (jawKoko !== lepas) {
          const asal = rec.Jawatan;
          if (jawKoko) rec.Jawatan = jawKoko;
          else if (lepas && rec.Jawatan === lepas) rec.Jawatan = '';   // dikosongkan di e-Kokurikulum
          rec.JawatanKoko = jawKoko;
          if (rec.Jawatan !== asal) laporan.jawatanDikemaskini++;
        } else if (!rec.Jawatan && jawKoko) { rec.Jawatan = jawKoko; laporan.jawatanDikemaskini++; }
      }
      rec.KehadiranAuto = hadirAuto;
      const capaiSebelum = medanCapai();
      isiPencapaianAuto(rec, capaiAspek[a] || []);
      if (medanCapai() !== capaiSebelum) laporan.pencapaianDiisi++;
      if (baharu || sebelum !== [rec.Unit, rec.Jawatan, rec.KehadiranAuto, rec.JawatanKoko].join('|') + '|' + medanCapai()) {
        rec.Dikemaskini = masa;
        kiraSemulaAspek(rec, ref);
        aspekUbah.push(rec);
        aspekBerubah = true;
      }
    });
    if (aspekBerubah || muridUbahSet[m.NoKP] || !rumusanAda[m.NoKP]) {
      rumusanUbah.push(binaRumusan(m, aspekMap, ekstraMap, ref));
    }
  });

  upsertBanyak(SHEET_MURID, 'NoKP', muridUbah);
  upsertBanyak(SHEET_ASPEK, 'Kunci', aspekUbah);
  upsertBanyak(SHEET_RUMUSAN, 'NoKP', rumusanUbah);

  let kgpUbah = 0;
  if (!kunciKelas) {
    try { kgpUbah = segerakKgpDaripadaKoko(); } catch (e) { laporan.amaran.push('Senarai Ketua Guru Penasihat tidak dapat dibaca: ' + e.message); }
  }
  laporan.kgpDikemaskini = kgpUbah;
  laporan.diubah = muridUbah.length + aspekUbah.length + rumusanUbah.length + kgpUbah;
  laporan.jumlahDiproses = proses.length;
  laporan.masa = masa;
  laporan.ts = koko.ts;
  return laporan;
}

/* Pencapaian e-Kokurikulum seorang murid, dikumpul ikut aspek -> {PBB:[calon], KP:[...], SP:[...]}.
   Unit pelibatan = UNIT_PAJSK (jika kosong: UNIT); aspek = KATEGORI. Hanya rekod yang unitnya sama dengan unit
   berdaftar murid dalam e-PAJSK diambil (yang lain dilaporkan). calon: {id, l (label pelibatan), c (label pencapaian), skor}. */
function kumpulPencapaianMurid(m, capaiPeta, ref, laporan) {
  const hasil = {};
  const rekod = (capaiPeta[m.NoKP] || []).concat(capaiPeta['NAMA:' + banding(m.Nama)] || []);
  rekod.forEach(r => {
    const t = tentukanAspekPencapaian(r, m);
    if (!t.aspek || !t.padan) {
      if (laporan.pencapaianTiadaUnit.length < 30) {
        laporan.pencapaianTiadaUnit.push(m.Nama + ': ' + r.pertandingan + ' (unit ' + (unitPelibatanKoko(r) || '-') +
          (t.aspek ? '; unit ' + t.aspek + ' murid: ' + (m[t.aspek + '_Unit'] || 'tiada') : '; kategori tidak dikenali') + ')');
      }
      return;
    }
    const l = labelPelibatan(r.peringkat, ref), c = labelPencapaian(r.peringkat, r.pencapaian, ref);
    if (!l && !c) return;
    const skor = skorCari(ref.peta.PELIBATAN, l) + skorCari(ref.peta.PENCAPAIAN, c);
    (hasil[t.aspek] = hasil[t.aspek] || []).push({ id: r.id, l, c, skor, tarikh: r.tarikh });
  });
  Object.keys(hasil).forEach(a => {
    hasil[a].sort((x, y) => (y.skor - x.skor) || String(x.tarikh).localeCompare(String(y.tarikh)) || String(x.id).localeCompare(String(y.id)));
  });
  return hasil;
}

/* Isi Libat/Capai aktiviti 1 & 2 dengan pencapaian terbaik (calon sudah disusun). Idempoten: slot yang diisi
   automatik dicatat (PencapaianKoko) dan diisi semula dengan hasil yang sama setiap kali segerak, jadi tiada rekod
   berganda. Slot yang diisi/diubah sendiri oleh guru tidak disentuh, dan calon yang sama dengan slot itu dilangkau. */
function isiPencapaianAuto(rec, calon) {
  let simpan = [];
  try { simpan = JSON.parse(rec.PencapaianKoko || '[]') || []; } catch (e) { simpan = []; }
  // ZON, DAERAH dan ZON/DAERAH dianggap peringkat yang sama semasa mengesan pendua.
  const kunci = (L, C) => (L + '|' + C).replace(/ (ZON\/DAERAH|DAERAH|ZON)\b/g, ' ZD');
  const slotAuto = [], manual = [];
  [1, 2].forEach(n => {
    const L = String(rec['Libat' + n] || ''), C = String(rec['Capai' + n] || ''), s = simpan[n - 1];
    if ((!L && !C) || (s && s.l === L && s.c === C)) slotAuto.push(n);
    else manual.push(kunci(L, C));
  });
  const guna = calon.filter(x => manual.indexOf(kunci(x.l, x.c)) === -1);
  const baharu = [null, null];
  slotAuto.forEach((n, i) => {
    const x = guna[i];
    rec['Libat' + n] = x ? x.l : '';
    rec['Capai' + n] = x ? x.c : '';
    if (x) baharu[n - 1] = { id: x.id, l: x.l, c: x.c };
  });
  rec.PencapaianKoko = baharu[0] || baharu[1] ? JSON.stringify(baharu) : '';
}

/* Padankan jawatan e-Kokurikulum dengan label dalam jadual skor JAWATAN (tidak peka huruf besar/ruang). '' jika tiada. */
function labelJawatanKoko(teks, ref) {
  const t = banding(teks);
  if (!t) return '';
  const peta = ref.peta.JAWATAN || {};
  if (peta[t] !== undefined) return t;
  const jumpa = Object.keys(peta).find(l => banding(l) === t);
  return jumpa || '';
}

/* Kemas kini PENGGUNA.UnitKoko (unit yang dipimpin sebagai Ketua Guru Penasihat dalam e-Kokurikulum) dan cipta
   akaun bagi KGP yang belum wujud (kata laluan lalai = 6 digit terakhir No. KP, wajib tukar). Pulangkan bil berubah. */
function segerakKgpDaripadaKoko() {
  const guru = bacaGuruKoko();
  const peta = {};
  guru.forEach(g => { peta[g.nokp] = g; });
  const ubah = [];
  bacaSheetSebagaiObjek(SHEET_PENGGUNA).forEach(u => {
    const kp = normalKP(u.NoKP);
    const g = peta[kp];
    const baharu = g ? g.unitKgp.slice().sort().join('; ') : String(u.UnitKoko || '');
    // Guru yang tiada lagi dalam e-Kokurikulum: kekalkan nilai lama (mungkin hanya ralat sementara).
    if (g && String(u.UnitKoko || '') !== baharu) ubah.push({ NoKP: kp, UnitKoko: baharu });
    delete peta[kp];
  });
  Object.keys(peta).forEach(kp => {
    const g = peta[kp];
    if (!g.unitKgp.length) return;
    ubah.push({
      NoKP: kp, Password: cincangKataLaluan(kp, kataLaluanLalaiDaripadaIC(kp)), Peranan: ROLE_GURU_KELAS, NamaPenuh: g.nama,
      KelasDijaga: '', MestiTukarPassword: 'YA', Status: 'AKTIF', Emel: g.emel, UnitDijaga: '', UnitKoko: g.unitKgp.sort().join('; ')
    });
  });
  upsertBanyak(SHEET_PENGGUNA, 'NoKP', ubah);
  return ubah.length;
}

function apiSegerakKoko(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const kelas = String(p.kelas || '').trim();
  if (kelas) {
    if (!sesiBolehKelas(sesi, kelas)) return ralat('Anda tidak mempunyai akses kepada kelas ini.');
  } else if (sesi.peranan !== ROLE_ADMIN) {
    return ralat('Hanya Admin boleh menyegerak semua kelas.');
  }
  const paksa = sesi.peranan === ROLE_ADMIN && !!p.paksa;
  const hasil = denganKunci(() => {
    const laporan = laksanakanSegerak(kelas || null, paksa);
    if (laporan.diubah || paksa) tulisTetapan('SEGERAK_KOKO_TERAKHIR', laporan.masa);
    if (!kelas && laporan.ts) tulisTetapan('KOKO_TS_TERAKHIR', penandaKoko(laporan.ts));   // segerak penuh sahaja menandakan fail sudah diproses
    if (laporan.diubah || paksa) {
      catatAudit(sesi, 'SEGERAK_KOKO', 'MURID', kelas || 'SEMUA',
        laporan.jumlahDiproses + ' murid; ' + laporan.diubah + ' rekod berubah; baharu ' + laporan.baharu + ', kelas berubah ' + laporan.kelasBerubah);
    }
    return jaya({ laporan, versi: versiData() });
  });
  return hasil;
}

/* ------------------------- PENGURUSAN MURID (Admin) ------------------------- */
function apiSenaraiMurid(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const status = String(p.status || 'AKTIF').toUpperCase();
  const semuaMurid = bacaSheetSebagaiObjek(SHEET_MURID);
  const senarai = semuaMurid
    .filter(m => status === 'SEMUA' || String(m.Status).toUpperCase() === status)
    .filter(m => !p.kelas || m.KunciKelas === p.kelas)
    .sort((a, b) => String(a.KunciKelas).localeCompare(String(b.KunciKelas)) || String(a.Nama).localeCompare(String(b.Nama)))
    .map(m => ({
      nokp: normalKP(m.NoKP), nama: m.Nama, tingkatan: m.Tingkatan, kelas: m.Kelas, kunciKelas: m.KunciKelas,
      cgpaSebelum: m.CGPA_Sebelum, sejarah: m.SejarahCGPA, pbb: m.PBB_Unit, kp: m.KP_Unit, sp: m.SP_Unit,
      status: m.Status, perluSemak: m.PerluSemak, tahunTamat: m.TahunTamat
    }));
  const bilPerluSemak = semuaMurid.filter(m => String(m.Status).toUpperCase() === 'AKTIF' && m.PerluSemak === 'YA').length;
  return jaya(Object.assign(halamanKan(senarai, p, m => m.nama + ' ' + m.nokp + ' ' + m.kunciKelas + ' ' + m.pbb + ' ' + m.kp + ' ' + m.sp),
    { bilPerluSemak, segerakTerakhir: dapatTetapan('SEGERAK_KOKO_TERAKHIR') }));
}

function apiSimpanMurid(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  const ting = Number(p.tingkatan);
  const kelas = banding(p.kelas);
  const status = String(p.status || 'AKTIF').toUpperCase();
  if (!(ting >= 1 && ting <= 5) || !kelas) return ralat('Tingkatan (1-5) dan kelas diperlukan.');
  if (['AKTIF', 'PINDAH'].indexOf(status) === -1) return ralat('Status mesti AKTIF atau PINDAH.');
  const cg = String(p.cgpaSebelum === undefined || p.cgpaSebelum === null ? '' : p.cgpaSebelum).trim();
  if (cg !== '' && (isNaN(Number(cg)) || Number(cg) < 0 || Number(cg) > 100)) return ralat('CGPA tahun sebelum mesti antara 0 dan 100.');
  return denganKunci(() => {
    const m = bacaSheetSebagaiObjek(SHEET_MURID).find(x => normalKP(x.NoKP) === nokp);
    if (!m) return ralat('Murid tidak dijumpai.');
    m.Tingkatan = ting;
    m.Kelas = kelas;
    m.KunciKelas = ting + ' ' + kelas;
    m.Status = status;
    m.CGPA_Sebelum = cg === '' ? '' : Number(cg);
    m.SejarahCGPA = String(p.sejarah || '').trim();
    m.PerluSemak = '';
    kemaskiniBaris(SHEET_MURID, m.__row, m);
    const ref = muatRujukan();
    const k = muatKonteks(null);
    const rum = binaRumusan(Object.assign({}, m, { NoKP: nokp }), k.aspekMap, k.ekstraMap, ref);
    upsertBanyak(SHEET_RUMUSAN, 'NoKP', [rum]);
    catatAudit(sesi, 'KEMASKINI', 'MURID', nokp, 'Kemaskini murid: ' + m.Nama + ' -> ' + m.KunciKelas + ' (' + status + ')');
    return jaya({});
  });
}
