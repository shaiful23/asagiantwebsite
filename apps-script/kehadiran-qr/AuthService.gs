/* =========================================================================
 * AuthService.gs — log masuk GURU & MURID, sesi, peranan, tukar kata laluan.
 *
 *  • Log masuk: No. KP + kata laluan. Kata laluan lalai = 6 digit terakhir No. KP.
 *  • Kata laluan disimpan sebagai hash SHA-256 (bergaram No. KP) dalam Sheet AKAUN;
 *    baris akaun dicipta automatik semasa log masuk pertama.
 *  • Selagi kata laluan lalai belum ditukar, SEMUA API lain ditolak di pelayan
 *    (bukan sekadar disembunyikan di skrin) — pengguna dipaksa tukar dahulu.
 * ========================================================================= */

function cincangKataLaluan(nokp, kataLaluan) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'ekehadiran:' + digitSahaja(nokp) + ':' + String(kataLaluan));
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
function kataLaluanLalai(nokp) { return digitSahaja(nokp).slice(-6); }

/* ------------------------------ PENGGUNA ------------------------------ */
function cariGuru(nokp) {
  return bacaSheetSebagaiObjek(SHEET.GURU).find(g => samaNoKP(g.NoKP, nokp)
    && String(g.Status || 'AKTIF').toUpperCase() !== 'TIDAK AKTIF') || null;
}
function perananGuru(guru) {
  return senaraiDaripadaMedan(guru.Peranan).map(p => p.toUpperCase().replace(/\s+/g, ''))
    .map(p => p === 'GURUTINGKATAN' ? 'GT' : p === 'PENOLONGGT' || p === 'PENOLONGGURUTINGKATAN' ? 'PGT' : p)
    .filter(p => PERANAN[p] && p !== PERANAN.MURID);
}
function profilSesi(nokp) {
  const guru = cariGuru(nokp);
  if (guru) {
    const peranan = perananGuru(guru);
    if (!peranan.length) peranan.push(PERANAN.GMP);
    return { jenis: 'GURU', nokp: digitSahaja(guru.NoKP), nama: String(guru.Nama || '').trim(), peranan,
      kelasTingkatan: normalKelas(guru.KelasTingkatan) };
  }
  const murid = cariMurid(nokp);
  if (murid) {
    return { jenis: 'MURID', nokp: digitSahaja(murid.NoKP), nama: String(murid.Nama || '').trim(),
      peranan: [PERANAN.MURID], kelas: murid.Kelas, tingkatan: murid.Tingkatan };
  }
  return null;
}
function adaPeranan(sesi, senarai) { return (sesi.peranan || []).some(p => senarai.indexOf(p) !== -1); }
function adalahAdmin(sesi) { return adaPeranan(sesi, [PERANAN.ADMIN]); }
function adalahGuruKelas(sesi) { return adaPeranan(sesi, KUMPULAN_GURU_KELAS) && !!sesi.kelasTingkatan; }

/* ------------------------------ SESI ------------------------------ */
const AWALAN_SESI = 'sesi_ekhd_';
const MEMO_SESI = {};

function ciptaSesi(profil, mestiTukar) {
  const token = Utilities.getUuid();
  const sesi = Object.assign({}, profil, { mestiTukar: !!mestiTukar, t: Date.now() });
  CacheService.getScriptCache().put(AWALAN_SESI + token, JSON.stringify(sesi), TEMPOH_SESI_SAAT);
  return token;
}
function simpanSesi(token, sesi) {
  CacheService.getScriptCache().put(AWALAN_SESI + token, JSON.stringify(sesi), TEMPOH_SESI_SAAT);
  MEMO_SESI[token] = sesi;
}
function sahkanSesi(token) {
  if (!token) return null;
  if (MEMO_SESI[token]) return MEMO_SESI[token];
  const mentah = CacheService.getScriptCache().get(AWALAN_SESI + token);
  if (!mentah) return null;
  const sesi = JSON.parse(mentah);
  if (Date.now() - (sesi.t || 0) > 10 * 60 * 1000) { sesi.t = Date.now(); try { simpanSesi(token, sesi); } catch (e) { /* abaikan */ } }
  MEMO_SESI[token] = sesi;
  return sesi;
}

/* Semua api*() WAJIB memanggil ini. Pulangkan sesi, atau objek ralat {success:false}.
   opsyen.peranan  : senarai peranan dibenarkan (kosong = semua pengguna log masuk)
   opsyen.jenis    : 'GURU' / 'MURID' sahaja */
function wajibSesi(token, opsyen) {
  const o = opsyen || {};
  const sesi = sahkanSesi(token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.', 'SESI');
  if (sesi.mestiTukar && !o.benarMestiTukar) return ralat('Sila tukar kata laluan lalai anda dahulu.', 'MESTI_TUKAR');
  if (o.jenis && sesi.jenis !== o.jenis) return ralat('Fungsi ini bukan untuk akaun anda.', 'AKSES');
  if (o.peranan && o.peranan.length && !adaPeranan(sesi, o.peranan)) return ralat('Anda tidak mempunyai kebenaran untuk fungsi ini.', 'AKSES');
  return sesi;
}
function gagal(x) { return x && x.success === false; }

/* ------------------------------ AKAUN ------------------------------ */
function cariAkaun(nokp) { return bacaSheetSebagaiObjek(SHEET.AKAUN).find(a => samaNoKP(a.NoKP, nokp)) || null; }

function apiLogin(p) {
  const nokp = digitSahaja(p.nokp);
  const kataLaluan = String(p.kataLaluan || '').trim();
  if (nokp.length < 6 || !kataLaluan) return ralat('Sila isi No. KP (tanpa sengkang) dan kata laluan.');

  const cache = CacheService.getScriptCache();
  const kunciGagal = 'gagal_ekhd_' + nokp;
  const bilGagal = Number(cache.get(kunciGagal) || 0);
  if (bilGagal >= HAD_CUBAAN_LOGIN) return ralat('Terlalu banyak cubaan gagal. Akaun dikunci sementara — cuba lagi selepas 10 minit.');

  const profil = profilSesi(nokp);
  const akaun = profil ? cariAkaun(nokp) : null;
  const hashSimpanan = akaun ? String(akaun.Password) : cincangKataLaluan(nokp, kataLaluanLalai(nokp));

  if (!profil || hashSimpanan !== cincangKataLaluan(nokp, kataLaluan)) {
    const bil = bilGagal + 1;
    cache.put(kunciGagal, String(bil), TEMPOH_KUNCI_LOGIN_SAAT);
    if (bil >= HAD_CUBAAN_LOGIN) {
      catatAudit({ nokp, nama: '-' }, 'LOGIN_DIKUNCI', bil + ' cubaan gagal');
      return ralat('Terlalu banyak cubaan gagal. Akaun dikunci sementara — cuba lagi selepas 10 minit.');
    }
    const baki = HAD_CUBAAN_LOGIN - bil;
    return ralat('No. KP atau kata laluan tidak sah.' + (baki <= 2 ? ' Baki ' + baki + ' cubaan.' : ''));
  }
  cache.remove(kunciGagal);

  const mestiTukar = !akaun || String(akaun.MestiTukarPassword).toUpperCase() === 'YA';
  denganKunci(() => {
    const semasa = cariAkaun(nokp);
    if (semasa) {
      semasa.LogMasukTerakhir = formatTarikhMasa(sekarang());
      kemaskiniBaris(SHEET.AKAUN, semasa);
    } else {
      tambahBaris(SHEET.AKAUN, { NoKP: "'" + nokp, Jenis: profil.jenis, Password: hashSimpanan, MestiTukarPassword: 'YA',
        LogMasukTerakhir: formatTarikhMasa(sekarang()), DikemaskiniPada: formatTarikhMasa(sekarang()) });
    }
  });

  const token = ciptaSesi(profil, mestiTukar);
  catatAudit(profil, 'LOGIN', profil.jenis);
  return jaya({ token, pengguna: ringkasanPengguna(profil), mestiTukarPassword: mestiTukar });
}

function ringkasanPengguna(sesi) {
  const o = { jenis: sesi.jenis, nokp: sesi.nokp, nama: sesi.nama, peranan: sesi.peranan,
    labelPeranan: (sesi.peranan || []).map(p => LABEL_PERANAN[p] || p),
    kelasTingkatan: sesi.kelasTingkatan || '', kelas: sesi.kelas || '', tingkatan: sesi.tingkatan || '',
    admin: adalahAdmin(sesi), guruKelas: adalahGuruKelas(sesi),
    guruSubjek: sesi.jenis === 'GURU', mestiTukar: !!sesi.mestiTukar };
  if (sesi.jenis === 'MURID') { const m = cariMurid(sesi.nokp); o.gambar = m ? m.GambarUrl : ''; }
  return o;
}

function apiSemakSesi(p) {
  const sesi = wajibSesi(p.token, { benarMestiTukar: true });
  if (gagal(sesi)) return sesi;
  return jaya({ pengguna: ringkasanPengguna(sesi), mestiTukarPassword: !!sesi.mestiTukar, tetapanUi: tetapanUntukKlien() });
}

function apiLogout(p) {
  if (p && p.token) { CacheService.getScriptCache().remove(AWALAN_SESI + p.token); delete MEMO_SESI[p.token]; }
  return jaya({});
}

function apiTukarKataLaluan(p) {
  const sesi = wajibSesi(p.token, { benarMestiTukar: true });
  if (gagal(sesi)) return sesi;
  const lama = String(p.kataLaluanLama || '').trim();
  const baharu = String(p.kataLaluanBaharu || '').trim();
  if (baharu.length < PANJANG_MIN_KATA_LALUAN) return ralat('Kata laluan baharu mesti sekurang-kurangnya ' + PANJANG_MIN_KATA_LALUAN + ' aksara.');
  if (!/[A-Za-z]/.test(baharu) || !/\d/.test(baharu)) return ralat('Kata laluan baharu mesti mengandungi huruf dan nombor.');
  if (baharu === kataLaluanLalai(sesi.nokp)) return ralat('Kata laluan baharu tidak boleh sama dengan kata laluan lalai.');

  return denganKunci(() => {
    const akaun = cariAkaun(sesi.nokp);
    if (!akaun) return ralat('Akaun tidak dijumpai. Sila log masuk semula.');
    if (String(akaun.Password) !== cincangKataLaluan(sesi.nokp, lama)) return ralat('Kata laluan semasa tidak sah.');
    if (lama === baharu) return ralat('Kata laluan baharu mesti berbeza daripada kata laluan semasa.');
    akaun.Password = cincangKataLaluan(sesi.nokp, baharu);
    akaun.MestiTukarPassword = 'TIDAK';
    akaun.DikemaskiniPada = formatTarikhMasa(sekarang());
    kemaskiniBaris(SHEET.AKAUN, akaun);
    sesi.mestiTukar = false;
    simpanSesi(p.token, sesi);
    catatAudit(sesi, 'TUKAR_KATA_LALUAN', '');
    return jaya({ pengguna: ringkasanPengguna(sesi) });
  });
}

/* Admin set semula kata laluan pengguna kepada lalai (6 digit akhir No. KP). */
function apiAdminSetSemulaKataLaluan(p) {
  const sesi = wajibSesi(p.token, { peranan: [PERANAN.ADMIN] });
  if (gagal(sesi)) return sesi;
  const nokp = digitSahaja(p.nokp);
  if (!profilSesi(nokp)) return ralat('No. KP tidak dijumpai dalam senarai guru atau murid.');
  return denganKunci(() => {
    const akaun = cariAkaun(nokp);
    const hash = cincangKataLaluan(nokp, kataLaluanLalai(nokp));
    if (akaun) {
      akaun.Password = hash; akaun.MestiTukarPassword = 'YA'; akaun.DikemaskiniPada = formatTarikhMasa(sekarang());
      kemaskiniBaris(SHEET.AKAUN, akaun);
    }
    catatAudit(sesi, 'SET_SEMULA_KATA_LALUAN', nokp);
    return jaya({ mesej: 'Kata laluan ditetapkan semula kepada 6 digit terakhir No. KP. Pengguna wajib menukarnya semasa log masuk.' });
  });
}

function tetapanUntukKlien() {
  return { namaSekolah: tetapan('NAMA_SEKOLAH'), masaKunci: keHHmm(tetapan('MASA_KUNCI_KEHADIRAN')),
    urlPengimbas: tetapan('URL_PENGIMBAS'), tarikhHariIni: tarikhHariIni(), masaPelayan: masaSekarang() };
}
