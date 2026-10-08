/* =========================================================================
 * AuthService.gs — MODUL 1: LOGIN & PENGGUNA
 * Login NoKP+PIN (selari dengan Sistem Kehadiran QR sedia ada), sesi disimpan
 * dalam CacheService (bukan Sheet), dan pengesahan kebenaran server-side
 * (rujuk MODUL 31: KESELAMATAN — jangan benarkan frontend sahaja menentukan akses).
 * ========================================================================= */

const HEADER_USERS = ['NoKP', 'PIN', 'Peranan', 'NamaPenuh', 'SkopSubjek', 'Status', 'SkopKelas', 'UnitKetua'];
const PANJANG_MIN_KATA_LALUAN = 8;

/* Lajur PIN kini menyimpan KATA LALUAN dalam 3 bentuk:
     kosong          -> kata laluan LALAI = 6 digit akhir No. KP, WAJIB tukar selepas log masuk
     'sha256:<hex>'  -> kata laluan peribadi (dicincang, bukan teks biasa)
     teks lain       -> PIN lama sebelum kemaskini ini; masih diterima SEKALI, kemudian WAJIB tukar
   No. KP 12 digit yang bermula dengan 0 disimpan Sheets sebagai nombor (0 hadapan
   hilang), jadi No. KP sentiasa dibandingkan selepas dinormalkan ke 12 digit. */
function normalNoKP(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\D/g, '').padStart(12, '0');
}

function kataLaluanLalai(nokp) {
  return normalNoKP(nokp).slice(-6);
}

function cincangKataLaluan(nokp, kataLaluan) {
  const bait = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalNoKP(nokp) + ':' + kataLaluan, Utilities.Charset.UTF_8);
  return 'sha256:' + bait.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function semakKataLaluan(pengguna, kataLaluan) {
  const disimpan = String(pengguna.PIN === undefined || pengguna.PIN === null ? '' : pengguna.PIN).trim();
  if (!disimpan) return { sah: kataLaluan === kataLaluanLalai(pengguna.NoKP), perluTukar: true };
  if (disimpan.indexOf('sha256:') === 0) return { sah: cincangKataLaluan(pengguna.NoKP, kataLaluan) === disimpan, perluTukar: false };
  return { sah: kataLaluan === disimpan, perluTukar: true };
}

function cariPengguna(nokp) {
  const sasaran = normalNoKP(nokp);
  return bacaSheetSebagaiObjek(SHEET_USERS).find(u => normalNoKP(u.NoKP) === sasaran) || null;
}

/* Sesi tamat pada masa MUTLAK (tamatMs, 8 jam selepas log masuk) — menyegarkan
   sesi tidak memanjangkannya. Sesi lama tanpa tamatMs diberi tempoh penuh sekali. */
function simpanSesi(token, sesi) {
  if (!sesi.tamatMs) sesi.tamatMs = Date.now() + TEMPOH_SESI_SAAT * 1000;
  const bakiSaat = Math.floor((sesi.tamatMs - Date.now()) / 1000);
  if (bakiSaat < 1) { CacheService.getScriptCache().remove('sesi_hcstpm_' + token); return; }
  CacheService.getScriptCache().put('sesi_hcstpm_' + token, JSON.stringify(sesi), Math.min(bakiSaat, TEMPOH_SESI_SAAT));
}

function normalPeranan(peranan) {
  const p = String(peranan || '').trim().toUpperCase();
  return PETA_PERANAN_LAMA[p] || p;
}

function senaraiKod(v) {
  return v === undefined || v === null ? [] : String(v).split(',').map(x => x.trim()).filter(Boolean);
}

/* Mata pelajaran yang diketuai: lajur UnitKetua. Sebelum migrasi (lajur belum
   wajud/kosong), Ketua Panitia lama dianggap ketua bagi semua SkopSubjeknya. */
function unitKetuaPengguna(pengguna) {
  if (normalPeranan(pengguna.Peranan) !== ROLE_KETUA_UNIT) return [];
  const unit = senaraiKod(pengguna.UnitKetua);
  return unit.length ? unit : senaraiKod(pengguna.SkopSubjek);
}

/* Medan sesi yang diterbitkan daripada baris USERS (peranan & skop).
   skopSubjek = subjek diajar + subjek diketuai (supaya semakan subjek sedia ada
   terus meliputi unit Ketua Unit); unitKetua disimpan berasingan untuk kuasa ketua. */
function dataSesiPengguna(pengguna) {
  const unitKetua = unitKetuaPengguna(pengguna);
  return {
    nokp: pengguna.NoKP,
    nama: pengguna.NamaPenuh,
    peranan: normalPeranan(pengguna.Peranan),
    skopSubjek: Array.from(new Set(senaraiKod(pengguna.SkopSubjek).concat(unitKetua))),
    unitKetua,
    // SkopKelas: kelas jagaan Guru Tingkatan — huruf besar supaya padan dengan Kelas pelajar.
    skopKelas: senaraiKod(pengguna.SkopKelas).map(k => k.toUpperCase())
  };
}

/* ------------------------- HELPER AKSES (dipakai semua service) ------------------------- */
function aksesPenuh(sesi) { return PERANAN_AKSES_PENUH.includes(sesi.peranan); }
function guruTingkatan(sesi) { return sesi.peranan === ROLE_GURU_TINGKATAN && (sesi.skopKelas || []).length > 0; }
function ketuaUnitBagi(sesi, kodSubjek) {
  return sesi.peranan === ROLE_KETUA_UNIT && (sesi.unitKetua || []).indexOf(String(kodSubjek)) !== -1;
}
function kelasJagaan(sesi, kelas) {
  return guruTingkatan(sesi) && sesi.skopKelas.indexOf(String(kelas || '').toUpperCase()) !== -1;
}
/* Boleh akses mata pelajaran ini (sekurang-kurangnya bagi sebahagian pelajar)?
   Guru Tingkatan: semua subjek — rekod kemudian ditapis ikut kelas jagaan. */
function bolehAksesSubjek(sesi, kodSubjek) {
  return aksesPenuh(sesi) || sesi.skopSubjek.indexOf(String(kodSubjek)) !== -1 || guruTingkatan(sesi);
}
/* Boleh akses rekod (subjek x pelajar dalam kelas)? */
function bolehAksesRekod(sesi, kodSubjek, kelas) {
  return aksesPenuh(sesi) || sesi.skopSubjek.indexOf(String(kodSubjek)) !== -1 || kelasJagaan(sesi, kelas);
}
/* Penapis bagi senarai rekod yang ada KodSubjek & ID_Pelajar. */
function penapisRekodPelajar(sesi, pelajarMap) {
  if (aksesPenuh(sesi)) return () => true;
  let peta = pelajarMap;
  return r => {
    if (sesi.skopSubjek.indexOf(String(r.KodSubjek)) !== -1) return true;
    if (!guruTingkatan(sesi)) return false;
    if (!peta) { peta = {}; bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(x => { peta[x.ID_Pelajar] = x; }); }
    return kelasJagaan(sesi, (peta[r.ID_Pelajar] || {}).Kelas);
  };
}
/* Guru biasa (termasuk Guru Tingkatan & Ketua Unit bagi subjek BUKAN unitnya) hanya
   boleh mengisi AR1/AR2/SEBENAR; TOV/OTR/ETR untuk Admin & Ketua Unit subjek itu. */
function hadMedanGuru(sesi, kodSubjek) {
  return !aksesPenuh(sesi) && !ketuaUnitBagi(sesi, kodSubjek);
}

function ciptaSesi(pengguna, perluTukarKataLaluan) {
  const token = Utilities.getUuid();
  simpanSesi(token, Object.assign(dataSesiPengguna(pengguna), { perluTukarKataLaluan: !!perluTukarKataLaluan }));
  return token;
}

function sahkanSesi(token) {
  if (!token) return null;
  const mentah = CacheService.getScriptCache().get('sesi_hcstpm_' + token);
  return mentah ? JSON.parse(mentah) : null;
}

/* Pulangkan sesi jika sah DAN peranan dibenarkan; jika tidak, pulangkan objek ralat.
   Semua fungsi API service lain WAJIB panggil ini dahulu — server ialah punca kebenaran.
   Sesi yang masih guna kata laluan lalai/lama disekat drpd SEMUA API sehingga kata
   laluan ditukar (apiTukarKataLaluan tidak melalui fungsi ini). */
function wajibPeranan(token, perananDibenarkan) {
  const sesi = sahkanSesi(token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  // Sesi yang dicipta sebelum rombakan peranan: petakan peranan lama.
  sesi.peranan = normalPeranan(sesi.peranan);
  if (!sesi.unitKetua) sesi.unitKetua = sesi.peranan === ROLE_KETUA_UNIT ? (sesi.skopSubjek || []) : [];
  if (!sesi.skopKelas) sesi.skopKelas = [];
  if (sesi.perluTukarKataLaluan) return ralat('Sila tukar kata laluan anda dahulu sebelum meneruskan.');
  if (perananDibenarkan && perananDibenarkan.length && perananDibenarkan.indexOf(sesi.peranan) === -1) {
    return ralat('Anda tidak mempunyai kebenaran untuk tindakan ini.');
  }
  return sesi;
}

function apiLogin(p) {
  const nokp = String(p.nokp || '').trim();
  const kataLaluan = String(p.pin || '').trim();
  if (!nokp || !kataLaluan) return ralat('Sila isi No. KP dan Kata Laluan.');

  const pengguna = cariPengguna(nokp);
  const semakan = pengguna ? semakKataLaluan(pengguna, kataLaluan) : { sah: false };
  if (!semakan.sah) return ralat('No. KP atau Kata Laluan tidak sah.');
  if (String(pengguna.Status).toUpperCase() !== 'AKTIF') return ralat('Akaun ini tidak aktif. Sila hubungi admin.');

  const token = ciptaSesi(pengguna, semakan.perluTukar);
  const data = dataSesiPengguna(pengguna);
  catatAudit({ nokp: pengguna.NoKP, nama: pengguna.NamaPenuh, peranan: data.peranan }, 'LOGIN', 'PENGGUNA', pengguna.NoKP, '', '',
    semakan.perluTukar ? 'Log masuk (kata laluan lalai/lama — wajib tukar)' : 'Log masuk berjaya');
  return jaya({
    token, nama: pengguna.NamaPenuh, peranan: data.peranan, skopSubjek: data.skopSubjek, unitKetua: data.unitKetua,
    skopKelas: data.skopKelas, perluTukarKataLaluan: semakan.perluTukar
  });
}

/* Dipanggil setiap kali halaman dibuka. Peranan & skop DIBACA SEMULA daripada USERS
   (bukan diambil daripada sesi yang disimpan semasa log masuk), supaya perubahan oleh
   Admin — cth. tambah kod 800 dalam Skop Subjek, tukar peranan, nyahaktif akaun —
   berkuat kuasa sebaik pengguna membuka/muat semula halaman, tanpa perlu log keluar. */
function apiSemakSesi(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');
  const pengguna = cariPengguna(sesi.nokp);
  if (!pengguna || String(pengguna.Status).toUpperCase() !== 'AKTIF') {
    CacheService.getScriptCache().remove('sesi_hcstpm_' + p.token);
    return ralat('Akaun ini tidak aktif. Sila hubungi admin.');
  }
  const segar = Object.assign(dataSesiPengguna(pengguna), { perluTukarKataLaluan: !!sesi.perluTukarKataLaluan, tamatMs: sesi.tamatMs });
  simpanSesi(p.token, segar);
  return jaya({
    nama: segar.nama, peranan: segar.peranan, skopSubjek: segar.skopSubjek, unitKetua: segar.unitKetua, skopKelas: segar.skopKelas,
    perluTukarKataLaluan: segar.perluTukarKataLaluan
  });
}

/* Tukar kata laluan sendiri. Semasa tukar WAJIB (kali pertama / kata laluan lama),
   kata laluan semasa sudah disahkan ketika log masuk, jadi tidak diminta lagi;
   tukar secara sukarela pula wajib sertakan kata laluan semasa. */
function apiTukarKataLaluan(p) {
  const sesi = sahkanSesi(p.token);
  if (!sesi) return ralat('Sesi tamat tempoh. Sila log masuk semula.');

  const pengguna = cariPengguna(sesi.nokp);
  if (!pengguna) return ralat('Akaun tidak dijumpai.');

  const baru = String(p.kataLaluanBaru || '');
  if (!sesi.perluTukarKataLaluan && !semakKataLaluan(pengguna, String(p.kataLaluanSemasa || '')).sah) {
    return ralat('Kata laluan semasa tidak betul.');
  }
  if (baru.length < PANJANG_MIN_KATA_LALUAN) return ralat('Kata laluan baharu mesti sekurang-kurangnya ' + PANJANG_MIN_KATA_LALUAN + ' aksara.');
  if (!/[A-Za-z]/.test(baru) || !/\d/.test(baru)) return ralat('Kata laluan baharu mesti mengandungi huruf DAN nombor.');
  if (semakKataLaluan(pengguna, baru).sah) return ralat('Kata laluan baharu mesti berbeza daripada kata laluan semasa.');

  kemaskiniBaris(SHEET_USERS, pengguna.__row, Object.assign({}, pengguna, { PIN: cincangKataLaluan(pengguna.NoKP, baru) }), HEADER_USERS);
  sesi.perluTukarKataLaluan = false;
  simpanSesi(p.token, sesi);
  catatAudit(sesi, 'TUKAR_KATA_LALUAN', 'PENGGUNA', pengguna.NoKP, '', '', 'Kata laluan ditukar oleh pengguna sendiri');
  return jaya({});
}

function apiLogout(p) {
  const sesi = sahkanSesi(p.token);
  if (sesi) CacheService.getScriptCache().remove('sesi_hcstpm_' + p.token);
  return jaya({});
}

/* ------------------------- PENGURUSAN PENGGUNA (ADMIN sahaja) ------------------------- */
function apiSenaraiPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const statusKataLaluan = u => {
    const pin = String(u.PIN === undefined || u.PIN === null ? '' : u.PIN).trim();
    return !pin ? 'LALAI' : (pin.indexOf('sha256:') === 0 ? 'PERIBADI' : 'LAMA');
  };
  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS);
  const senarai = pengguna.map(u => ({
    nokp: u.NoKP, nama: u.NamaPenuh, peranan: normalPeranan(u.Peranan), perananAsal: u.Peranan,
    skopSubjek: u.SkopSubjek, skopKelas: u.SkopKelas, unitKetua: unitKetuaPengguna(u).join(', '), status: u.Status,
    kataLaluan: statusKataLaluan(u), __row: u.__row
  }));
  // Ketua unit setiap mata pelajaran (SUBJECTS aktif + MUET 800) — untuk semakan Admin.
  const ketua = petaKetuaUnit(pengguna);
  const unit = senaraiUnitMataPelajaran().map(s => ({ kodSubjek: s.kod, namaSubjek: s.nama, ketua: (ketua[s.kod] || []).map(u => u.NamaPenuh) }));
  return jaya({ senarai, unit, adaLajurUnitKetua: adaLajurUnitKetua() });
}

/* Kata laluan TIDAK ditetapkan oleh admin: pengguna baharu bermula dengan kata
   laluan lalai (6 digit akhir No. KP) dan dipaksa tukar selepas log masuk pertama.
   Kata laluan sedia ada dikekalkan semasa kemaskini maklumat lain. */
function apiSimpanPengguna(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;

  const nokp = String(p.nokp || '').trim();
  const nama = String(p.nama || '').trim();
  const peranan = String(p.peranan || '').trim();
  if (!nokp || !nama || SEMUA_PERANAN.indexOf(peranan) === -1) return ralat('Data pengguna tidak lengkap/sah.');
  if (nokp.replace(/\D/g, '').length !== 12) return ralat('No. KP mesti 12 digit.');
  const status = p.status ? String(p.status).trim() : 'AKTIF';
  const unitKetua = peranan === ROLE_KETUA_UNIT ? senaraiKod(p.unitKetua).map(k => k.toUpperCase()) : [];
  const skopKelas = senaraiKod(p.skopKelas);

  if (peranan === ROLE_KETUA_UNIT) {
    if (!adaLajurUnitKetua()) return ralat('Lajur UnitKetua belum wujud dalam USERS. Jalankan menu "5. Kemaskini Peranan (4 Peranan)" di Sheet dahulu.');
    if (!unitKetua.length) return ralat('Ketua Unit wajib ada sekurang-kurangnya satu Kod Subjek dalam "Unit Diketuai".');
    const sah = senaraiUnitMataPelajaran().map(u => u.kod);
    const tidakSah = unitKetua.filter(k => sah.indexOf(k) === -1);
    if (tidakSah.length) return ralat('Kod subjek tidak dijumpai: ' + tidakSah.join(', ') + ' (MUET = ' + KOD_SUBJEK_MUET + ').');
    if (status.toUpperCase() === 'AKTIF') {
      const ketua = petaKetuaUnit(bacaSheetSebagaiObjek(SHEET_USERS));
      const bertembung = unitKetua.map(k => ({ k, lain: (ketua[k] || []).filter(u => normalNoKP(u.NoKP) !== normalNoKP(nokp)) }))
        .filter(x => x.lain.length);
      if (bertembung.length) {
        return ralat('Setiap mata pelajaran hanya boleh ada SEORANG Ketua Unit. Sudah ada: ' +
          bertembung.map(x => x.k + ' (' + x.lain.map(u => u.NamaPenuh).join(', ') + ')').join('; ') +
          '. Tukar atau nyahaktifkan ketua unit sedia ada dahulu.');
      }
    }
  }
  if (peranan === ROLE_GURU_TINGKATAN && !skopKelas.length) return ralat('Guru Tingkatan wajib ada sekurang-kurangnya satu kelas dalam "Kelas Jagaan".');

  const sediaAda = cariPengguna(nokp);
  const objek = {
    NoKP: nokp,
    PIN: sediaAda ? sediaAda.PIN : '',
    Peranan: peranan,
    NamaPenuh: nama,
    SkopSubjek: String(p.skopSubjek || '').trim(),
    SkopKelas: skopKelas.join(', '),
    Status: status,
    UnitKetua: unitKetua.join(', ')
  };
  const tanpaPIN = o => JSON.stringify(Object.assign({}, o, { PIN: undefined, __row: undefined }));

  if (sediaAda) {
    kemaskiniBaris(SHEET_USERS, sediaAda.__row, objek, HEADER_USERS);
    catatAudit(sesi, 'KEMASKINI', 'PENGGUNA', nokp, tanpaPIN(sediaAda), tanpaPIN(objek), 'Kemaskini pengguna: ' + nama);
  } else {
    tambahBaris(SHEET_USERS, objek, HEADER_USERS);
    catatAudit(sesi, 'TAMBAH', 'PENGGUNA', nokp, '', tanpaPIN(objek), 'Tambah pengguna baharu: ' + nama);
  }
  return jaya({ baharu: !sediaAda });
}

/* Set semula kata laluan seorang pengguna kepada lalai (6 digit akhir No. KP) —
   pengguna akan dipaksa tukar semula selepas log masuk seterusnya. */
function apiResetKataLaluan(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;

  const pengguna = cariPengguna(p.nokp);
  if (!pengguna) return ralat('Pengguna tidak dijumpai.');
  kemaskiniBaris(SHEET_USERS, pengguna.__row, Object.assign({}, pengguna, { PIN: '' }), HEADER_USERS);
  catatAudit(sesi, 'RESET_KATA_LALUAN', 'PENGGUNA', pengguna.NoKP, '', '', 'Kata laluan diset semula ke lalai: ' + pengguna.NamaPenuh);
  return jaya({});
}

/* ------------------------- KETUA UNIT ------------------------- */
function adaLajurUnitKetua() {
  const sh = dapatkanSheet(SHEET_USERS);
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf('UnitKetua') !== -1;
}

/* Semua mata pelajaran yang perlu ada ketua unit: SUBJECTS aktif + MUET (800). */
function senaraiUnitMataPelajaran() {
  const senarai = bacaSheetSebagaiObjek(SHEET_SUBJECTS)
    .filter(s => String(s.StatusAktif || 'AKTIF').toUpperCase() === 'AKTIF')
    .map(s => ({ kod: String(s.KodSubjek), nama: s.NamaSubjek }));
  if (!senarai.some(s => s.kod === KOD_SUBJEK_MUET)) senarai.push({ kod: KOD_SUBJEK_MUET, nama: 'MUET' });
  return senarai;
}

/* { kodSubjek: [pengguna KETUA_UNIT aktif yang mengetuainya] } */
function petaKetuaUnit(pengguna) {
  const peta = {};
  pengguna.filter(u => String(u.Status).toUpperCase() === 'AKTIF').forEach(u => {
    unitKetuaPengguna(u).forEach(k => { (peta[k] = peta[k] || []).push(u); });
  });
  return peta;
}
