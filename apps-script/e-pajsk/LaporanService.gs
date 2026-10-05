/* =========================================================================
 * LaporanService.gs — Dashboard, Rumusan kelas, Analisa Ringkas dan data Slip.
 * ========================================================================= */

function skopKelas(sesi) {
  return sesi.peranan === ROLE_ADMIN ? null : (sesi.kelas || []);
}

function dalamSkop(skop, kunciKelas) {
  return skop === null || skop.indexOf(kunciKelas) !== -1;
}

/* Ringkasan setiap kelas dalam skop pengguna. */
function apiDashboard(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const skop = skopKelas(sesi);
  const rumusan = {};
  bacaSheetSebagaiObjek(SHEET_RUMUSAN).forEach(r => { rumusan[normalKP(r.NoKP)] = r; });

  const kelas = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() !== 'AKTIF' || !dalamSkop(skop, m.KunciKelas)) return;
    const k = kelas[m.KunciKelas] = kelas[m.KunciKelas] || {
      kunci: m.KunciKelas, nama: paparKelas(m.KunciKelas), bil: 0, siap: 0, jumlahCGPA: 0, gred: { A: 0, B: 0, C: 0, D: 0, E: 0 }
    };
    k.bil++;
    const r = rumusan[normalKP(m.NoKP)];
    if (r && nombor(r.CGPA) > 0) {
      k.siap++;
      k.jumlahCGPA += nombor(r.CGPA);
      if (k.gred[r.Gred] !== undefined) k.gred[r.Gred]++;
    }
  });
  const senarai = Object.keys(kelas).sort().map(kunci => {
    const k = kelas[kunci];
    return { kunci: k.kunci, nama: k.nama, bil: k.bil, siap: k.siap, purata: k.siap ? bundar2(k.jumlahCGPA / k.siap) : 0, gred: k.gred };
  });
  const jumlah = senarai.reduce((j, k) => ({ bil: j.bil + k.bil, siap: j.siap + k.siap }), { bil: 0, siap: 0 });

  const hasil = { kelas: senarai, jumlah, tahun: tahunSemasa(), segerakTerakhir: dapatTetapan('SEGERAK_KOKO_TERAKHIR') };
  if (sesi.peranan === ROLE_ADMIN) {
    const guru = bacaSheetSebagaiObjek(SHEET_PENGGUNA).filter(u => u.Peranan === ROLE_GURU_KELAS && String(u.Status).toUpperCase() === 'AKTIF');
    hasil.bilGuru = guru.length;
    const kelasBerguru = {};
    guru.forEach(u => senaraiDaripadaMedan(u.KelasDijaga).forEach(kk => { kelasBerguru[kk] = true; }));
    hasil.kelasTanpaGuru = Object.keys(kelas).filter(kunci => !kelasBerguru[kunci]).length;
    hasil.bilPerluSemak = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => String(m.Status).toUpperCase() === 'AKTIF' && m.PerluSemak === 'YA').length;
    hasil.arkibTahunIni = !!bacaSheetSebagaiObjek(SHEET_ARKIB).find(a => Number(a.TAHUN) === tahunSemasa());
  }
  return jaya(hasil);
}

/* Analisa Ringkas: taburan gred A-E bagi setiap aspek dan keseluruhan.
   Gred aspek: >79 A, >59 B, >39 C, >19 D, >0 E (markah aspek). Peratus dikira ke atas jumlah murid dalam skop;
   Gred Purata = purata gred bernombor (A=1 ... E=5) murid yang bergred; %GPS = ((5 - GredPurata) / 4) x 100. */
function apiAnalisa(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const skop = skopKelas(sesi);
  const tingkatan = Number(p.tingkatan) || 0;
  const kelas = String(p.kelas || '').trim();
  if (kelas && !sesiBolehKelas(sesi, kelas)) return ralat('Anda tidak mempunyai akses kepada kelas ini.');

  const aktif = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() === 'AKTIF') aktif[normalKP(m.NoKP)] = m;
  });
  const rows = bacaSheetSebagaiObjek(SHEET_RUMUSAN).filter(r => {
    const m = aktif[normalKP(r.NoKP)];
    if (!m || !dalamSkop(skop, r.KunciKelas)) return false;
    if (kelas && r.KunciKelas !== kelas) return false;
    if (tingkatan && Number(r.Tingkatan) !== tingkatan) return false;
    return true;
  });
  // Murid dalam skop tetapi belum ada baris RUMUSAN dikira sebagai belum dinilai (markah 0).
  const adaRumusan = {};
  rows.forEach(r => { adaRumusan[normalKP(r.NoKP)] = true; });
  let bil = rows.length;
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() !== 'AKTIF' || !dalamSkop(skop, m.KunciKelas)) return;
    if (kelas && m.KunciKelas !== kelas) return;
    if (tingkatan && nomborTingkatan(m.Tingkatan) !== tingkatan) return;
    if (!adaRumusan[normalKP(m.NoKP)]) bil++;
  });

  const baris = [
    { kunci: 'SP', nama: 'Sukan & Permainan', nilai: r => nombor(r.SP) },
    { kunci: 'KP', nama: 'Kelab & Persatuan', nilai: r => nombor(r.KP) },
    { kunci: 'PBB', nama: 'Pasukan Badan Beruniform', nilai: r => nombor(r.PBB) },
    { kunci: 'KESELURUHAN', nama: 'Keseluruhan (Gred Akhir)', gred: r => r.Gred }
  ].map(def => {
    const n = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    rows.forEach(r => {
      const g = def.gred ? String(def.gred(r)) : gredAspek(def.nilai(r));
      if (n[g] !== undefined) n[g]++;
    });
    const bergred = n.A + n.B + n.C + n.D + n.E;
    const gredPurata = bergred ? bundar2((n.A * 1 + n.B * 2 + n.C * 3 + n.D * 4 + n.E * 5) / bergred) : 0;
    const peratus = {};
    Object.keys(n).forEach(g => { peratus[g] = bil ? bundar2(n[g] / bil * 100) : 0; });
    return { kunci: def.kunci, nama: def.nama, bil: n, peratus, bergred, gredPurata, peratusGPS: gredPurata ? bundar2((5 - gredPurata) / 4 * 100) : 0 };
  });
  return jaya({ bilMurid: bil, baris, tahun: tahunSemasa() });
}

/* Data lengkap slip (satu murid atau seluruh kelas). */
function apiDataSlip(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const kelas = String(p.kelas || '').trim();
  if (!sesiBolehKelas(sesi, kelas)) return ralat('Anda tidak mempunyai akses kepada kelas ini.');
  const nokp = normalKP(p.nokp);
  const k = muatKonteks(kelas);
  const t = bacaTetapan();
  const senarai = k.murid.filter(m => !nokp || m.NoKP === nokp).map(m => ringkasMurid(m, k));
  return jaya({
    tahun: tahunSemasa(), kodSekolah: t[TET_KOD_SEKOLAH] || '', sekolah: t[TET_NAMA_SEKOLAH] || '',
    namaKelas: paparKelas(kelas), murid: senarai
  });
}
