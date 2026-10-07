/* =========================================================================
 * ProfilService.gs — Profil Guru (lengkap dengan gambar) & Carta Organisasi.
 * Medan profil (gambar, jawatan, no. telefon, kelayakan akademik, opsyen,
 * gred jawatan, kelas diajar, tahun mula mengajar subjek semasa) dikemaskini
 * SECARA SENDIRI oleh setiap pengguna (apiKemaskiniProfilSendiri/
 * apiMuatNaikGambarProfilSendiri — terhad kepada NoKP sesi sendiri sahaja).
 * Admin/Ketua Bidang juga boleh isi medan teks yang sama bagi pihak
 * pengguna lain melalui apiSimpanPengguna (UserService.gs).
 *
 * Gambar disimpan di Drive (DriveService.gs) tetapi dipaparkan sebagai data
 * URI base64 yang dibaca semula oleh pelayan (gambarSebagaiDataUri) — supaya
 * paparan tidak bergantung kepada tetapan perkongsian Drive setiap pengguna.
 * Klien WAJIB kecilkan/mampatkan gambar dahulu sebelum muat naik (rujuk
 * resizeGambarSebagaiBase64() dalam Index.html) supaya respons kekal kecil.
 * ========================================================================= */

/* Profil ringkas — digunakan dalam nod Carta Organisasi (bukan butiran penuh). */
function profilRingkas(u) {
  return {
    nokp: u.NoKP,
    nama: u.NamaPenuh,
    peranan: u.Peranan,
    jawatan: u.Jawatan || '',
    gambarDataUri: gambarSebagaiDataUri(u.GambarProfilFailId)
  };
}

/* Carta Organisasi — kepimpinan bidang (Admin/Ketua Bidang), satu nod bagi
   setiap Panitia (Ketua Panitia + ahli), dan kumpulan Pembantu Makmal
   (tiada Panitia sendiri, jadi diasingkan daripada senarai panitia). Hanya
   pengguna berstatus AKTIF dipaparkan. */
function apiCartaOrganisasi(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS).filter(u => String(u.Status).toUpperCase() === 'AKTIF');

  const pentadbir = pengguna
    .filter(u => PERANAN_AKSES_PENUH.indexOf(u.Peranan) !== -1)
    .map(profilRingkas);

  const panitia = bacaSheetSebagaiObjek(SHEET_PANITIA).map(pn => {
    const ahliPanitia = pengguna.filter(u => senaraiPanitiaDaripadaMedan(u.Panitia).indexOf(pn.NamaPanitia) !== -1);
    const ketua = ahliPanitia.find(u => String(u.NoKP) === String(pn.KetuaPanitia)) || null;
    const ahliLain = ahliPanitia.filter(u => !ketua || String(u.NoKP) !== String(ketua.NoKP));
    return {
      kodPanitia: pn.KodPanitia,
      namaPanitia: pn.NamaPanitia,
      ketua: ketua ? profilRingkas(ketua) : null,
      ahli: ahliLain.map(profilRingkas)
    };
  });

  const pembantuMakmal = pengguna
    .filter(u => u.Peranan === ROLE_PEMBANTU_MAKMAL || u.Peranan === ROLE_KETUA_PEMBANTU_MAKMAL)
    .map(u => Object.assign(profilRingkas(u), { makmal: senaraiDaripadaMedan(u.MakmalDijaga) }));

  return jaya({ pentadbir, panitia, pembantuMakmal });
}

/* Butiran penuh satu profil (dibuka daripada nod Carta Organisasi, atau Profil
   Saya sendiri — nokp ditinggalkan kosong bermaksud profil sesi sendiri, sebab
   klien tidak simpan No. KP sendiri selepas log masuk). Tiada sekatan tambahan
   selain log masuk sah, sama seperti apiSenaraiAhliPanitia() sedia ada yang
   turut dedahkan nama/peranan merentasi panitia; ini direktori staf dalaman,
   bukan data sensitif setiap panitia. */
function apiProfilPengguna(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const nokp = String(p.nokp || sesi.nokp || '').trim();
  const u = cariBarisMengikutId(SHEET_USERS, 'NoKP', nokp);
  if (!u) return ralat('Pengguna tidak dijumpai.');

  const tahunMula = Number(u.TahunMulaSubjekSemasa);
  const tempohMengajarTahun = tahunMula ? Math.max(0, new Date().getFullYear() - tahunMula) : null;

  return jaya({
    profil: {
      nokp: u.NoKP,
      nama: u.NamaPenuh,
      peranan: u.Peranan,
      panitia: senaraiPanitiaDaripadaMedan(u.Panitia),
      makmal: senaraiDaripadaMedan(u.MakmalDijaga),
      jawatan: u.Jawatan || '',
      noTelefon: u.NoTelefon || '',
      emel: u.Emel || '',
      kelayakanAkademik: u.KelayakanAkademik || '',
      opsyenPengkhususan: u.OpsyenPengkhususan || '',
      gredJawatan: u.GredJawatan || '',
      kelasDiajar: u.KelasDiajar || '',
      tahunMulaSubjekSemasa: u.TahunMulaSubjekSemasa || '',
      tempohMengajarTahun: tempohMengajarTahun,
      gambarDataUri: gambarSebagaiDataUri(u.GambarProfilFailId)
    }
  });
}

/* Kemaskini medan profil (teks) — SENDIRI sahaja (guna sesi.nokp, bukan p.nokp,
   supaya seseorang tidak boleh kemaskini profil orang lain melalui laluan ini). */
function apiKemaskiniProfilSendiri(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pengguna = cariBarisMengikutId(SHEET_USERS, 'NoKP', sesi.nokp);
  if (!pengguna) return ralat('Akaun tidak dijumpai.');

  const tahunMula = String(p.tahunMulaSubjekSemasa || '').trim();
  if (tahunMula && !/^(19|20)\d{2}$/.test(tahunMula)) {
    return ralat('Tahun mula mengajar subjek semasa tidak sah (format yyyy, cth. 2019).');
  }

  pengguna.Jawatan = String(p.jawatan || '').trim();
  pengguna.NoTelefon = String(p.noTelefon || '').trim();
  pengguna.KelayakanAkademik = String(p.kelayakanAkademik || '').trim();
  pengguna.OpsyenPengkhususan = String(p.opsyenPengkhususan || '').trim();
  pengguna.GredJawatan = String(p.gredJawatan || '').trim();
  pengguna.KelasDiajar = String(p.kelasDiajar || '').trim();
  pengguna.TahunMulaSubjekSemasa = tahunMula;

  kemaskiniBaris(SHEET_USERS, pengguna.__row, pengguna, HEADER_USERS);
  catatAudit(sesi, 'KEMASKINI', 'PROFIL_SENDIRI', sesi.nokp, 'Kemaskini profil sendiri');
  return jaya({});
}

/* Muat naik/ganti gambar profil — SENDIRI sahaja (sesi.nokp). Padam gambar
   lama di Drive dahulu (jika ada) supaya tidak bertimbun fail yatim. */
function apiMuatNaikGambarProfilSendiri(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!p.namaFail || !p.dataBase64) return ralat('Sila pilih gambar untuk dimuat naik.');

  const pengguna = cariBarisMengikutId(SHEET_USERS, 'NoKP', sesi.nokp);
  if (!pengguna) return ralat('Akaun tidak dijumpai.');

  if (pengguna.GambarProfilFailId) padamFailDrive(pengguna.GambarProfilFailId);
  const gambar = muatNaikGambarProfil(p.namaFail, p.dataBase64, p.jenisMime);
  pengguna.GambarProfilUrl = gambar.url;
  pengguna.GambarProfilFailId = gambar.fileId;
  kemaskiniBaris(SHEET_USERS, pengguna.__row, pengguna, HEADER_USERS);
  catatAudit(sesi, 'KEMASKINI', 'PROFIL_SENDIRI', sesi.nokp, 'Muat naik gambar profil');
  return jaya({ gambarDataUri: gambarSebagaiDataUri(gambar.fileId) });
}
