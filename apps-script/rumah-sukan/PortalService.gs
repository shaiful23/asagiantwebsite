/* =========================================================================
 * PortalService.gs — Data paparan Portal Guru (dashboard, rumah saya) dan
 * Portal Murid (profil & rumah sukan sendiri).
 * ========================================================================= */

/* Ringkasan setiap rumah: bilangan murid (L/P), atlet, guru, ketua & penolong. */
function statistikRumah(rumah) {
  const st = {};
  rumah.forEach(r => { st[r.id] = { id: r.id, nama: r.nama, warna: r.warna, moto: r.moto, murid: 0, L: 0, P: 0, atlet: 0, guru: 0, akp: 0, ketua: [], penolong: [] }; });
  let muridTanpaRumah = 0, stafTanpaRumah = 0, muridAktif = 0, atlet = 0;
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (!m.NoKP || !aktif(m)) return;
    muridAktif++;
    if (ya(m.Atlet)) atlet++;
    const s = st[m.RumahId];
    if (!s) { muridTanpaRumah++; return; }
    s.murid++;
    s[(m.Jantina || jantinaDaripadaKP(m.NoKP)) === 'PEREMPUAN' ? 'P' : 'L']++;
    if (ya(m.Atlet)) s.atlet++;
  });
  let stafAktif = 0;
  bacaSheetSebagaiObjek(SHEET_STAF).forEach(x => {
    if (!x.NoKP || !aktif(x)) return;
    stafAktif++;
    const s = st[x.RumahId];
    if (!s) { stafTanpaRumah++; return; }
    if (x.Kategori === 'AKP') s.akp++; else s.guru++;
    if (x.PerananRumah === PERANAN_RUMAH.KETUA) s.ketua.push(x.NamaPenuh);
    if (x.PerananRumah === PERANAN_RUMAH.PENOLONG) s.penolong.push(x.NamaPenuh);
  });
  return { rumah: rumah.map(r => st[r.id]), muridTanpaRumah, stafTanpaRumah, muridAktif, stafAktif, atlet };
}

function apiDashboard(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const rumah = senaraiRumah();
  const peta = {};
  rumah.forEach(r => { peta[r.id] = r; });
  const tet = bacaTetapan();
  const tahun = tahunKejohanan(tet);
  const r = peta[sesi.rekod.RumahId];
  const hasil = {
    tahun, namaKejohanan: tet[TET_NAMA_KEJOHANAN],
    saya: {
      nama: sesi.nama, kategori: sesi.rekod.Kategori || 'GURU', admin: sesi.admin,
      rumah: r || null, perananRumah: r ? (sesi.rekod.PerananRumah || PERANAN_RUMAH.GURU) : '',
      ajk: ajkMengikutKP(tahun)[sesi.nokp] || []
    },
    statistik: statistikRumah(rumah)
  };
  if (sesi.admin) {
    hasil.admin = {
      belumTukarMurid: bacaSheetSebagaiObjek(SHEET_MURID).filter(m => m.NoKP && aktif(m) && !String(m.Password || '')).length,
      belumTukarStaf: bacaSheetSebagaiObjek(SHEET_STAF).filter(s => s.NoKP && aktif(s) && !String(s.Password || '')).length,
      agihanTerakhir: tet[TET_AGIHAN_TERAKHIR] || ''
    };
  }
  return jaya(hasil);
}

/* Senarai guru & murid sesebuah rumah. Guru biasa hanya boleh melihat rumah sendiri; Admin semua rumah. */
function apiRumahSaya(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const rumah = senaraiRumah();
  const peta = {};
  rumah.forEach(r => { peta[r.id] = r; });
  const id = sesi.admin && p.rumahId ? String(p.rumahId) : String(sesi.rekod.RumahId || '');
  if (!peta[id]) {
    return sesi.admin ? jaya({ rumah: null, senaraiRumah: rumah }) : ralat('Anda belum ditetapkan kepada mana-mana rumah sukan. Sila hubungi admin.');
  }
  const tahun = tahunKejohanan();
  const ajk = ajkMengikutKP(tahun);
  const susunPeranan = { KETUA_GURU_RUMAH: 0, PENOLONG_KETUA_GURU_RUMAH: 1, GURU_RUMAH: 2 };
  const guru = bacaSheetSebagaiObjek(SHEET_STAF).filter(s => s.NoKP && aktif(s) && s.RumahId === id).map(s => ({
    nama: s.NamaPenuh, kategori: s.Kategori || 'GURU', jantina: s.Jantina || jantinaDaripadaKP(s.NoKP), jawatan: s.Jawatan || '',
    telefon: String(s.Telefon || ''), perananRumah: s.PerananRumah || PERANAN_RUMAH.GURU, ajk: ajk[normalKP(s.NoKP)] || []
  })).sort((a, b) => (susunPeranan[a.perananRumah] - susunPeranan[b.perananRumah]) || a.kategori.localeCompare(b.kategori) || a.nama.localeCompare(b.nama));
  const cfg = konfigKategori();
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => m.NoKP && aktif(m) && m.RumahId === id).map(m => ({
    nama: m.NamaPenuh, jantina: m.Jantina || jantinaDaripadaKP(m.NoKP), tingkatan: String(m.Tingkatan || ''), kelas: String(m.Kelas || ''),
    kunciKelas: kunciKelas(m), kategori: kategoriMurid(m, cfg), atlet: ya(m.Atlet), acara: m.Acara || ''
  })).sort((a, b) => a.kunciKelas.localeCompare(b.kunciKelas, 'ms', { numeric: true }) || a.nama.localeCompare(b.nama));
  return jaya({ rumah: peta[id], senaraiRumah: sesi.admin ? rumah : [], guru, murid, kategori: cfg.senarai });
}

/* Portal Murid: profil sendiri, rumah sukan, guru rumah dan ringkasan ahli rumah. */
function apiPortalMurid(p) {
  const sesi = wajibSesi(p.token, { jenis: JENIS_MURID });
  if (sesi.success === false) return sesi;
  const m = sesi.rekod;
  const tet = bacaTetapan();
  const cfg = konfigKategori(tet);
  const kod = kategoriMurid(m, cfg);
  const kat = cfg.senarai.find(x => x.kod === kod);
  const rumah = senaraiRumah();
  const r = rumah.find(x => x.id === m.RumahId) || null;
  const hasil = {
    tahun: cfg.tahun, namaKejohanan: tet[TET_NAMA_KEJOHANAN],
    profil: {
      nama: m.NamaPenuh, nokp: normalKP(m.NoKP), jantina: m.Jantina || jantinaDaripadaKP(m.NoKP),
      tingkatan: String(m.Tingkatan || ''), kelas: String(m.Kelas || ''),
      kategori: kat ? kat.nama + ' (' + kat.kod + ')' : '-', atlet: ya(m.Atlet), acara: m.Acara || ''
    },
    rumah: r, guru: [], ahli: null
  };
  if (r) {
    const susun = { KETUA_GURU_RUMAH: 0, PENOLONG_KETUA_GURU_RUMAH: 1, GURU_RUMAH: 2 };
    hasil.guru = bacaSheetSebagaiObjek(SHEET_STAF).filter(s => s.NoKP && aktif(s) && s.RumahId === r.id)
      .map(s => ({ nama: s.NamaPenuh, kategori: s.Kategori || 'GURU', perananRumah: s.PerananRumah || PERANAN_RUMAH.GURU }))
      .sort((a, b) => (susun[a.perananRumah] - susun[b.perananRumah]) || a.nama.localeCompare(b.nama));
    const ahli = { jumlah: 0, L: 0, P: 0, atlet: 0, sekelas: [] };
    const kelasSaya = kunciKelas(m);
    bacaSheetSebagaiObjek(SHEET_MURID).forEach(x => {
      if (!x.NoKP || !aktif(x) || x.RumahId !== r.id) return;
      ahli.jumlah++;
      ahli[(x.Jantina || jantinaDaripadaKP(x.NoKP)) === 'PEREMPUAN' ? 'P' : 'L']++;
      if (ya(x.Atlet)) ahli.atlet++;
      if (kunciKelas(x) === kelasSaya && normalKP(x.NoKP) !== sesi.nokp) ahli.sekelas.push(x.NamaPenuh);
    });
    ahli.sekelas.sort();
    hasil.ahli = ahli;
  }
  return jaya(hasil);
}
