/* =========================================================================
 * DriveService.gs — Struktur folder Drive: Induk > Panitia > Kategori.
 * Folder induk dicipta dalam folder yang sama dengan Google Sheet database
 * (supaya kekal tersusun bersama), warisi perkongsian folder induk itu —
 * pastikan folder induk dikongsi dengan staf berkenaan (rujuk README.md).
 * ========================================================================= */

function cariAtauCiptaSubfolder(folderIbu, namaFolder) {
  const sediaAda = folderIbu.getFoldersByName(namaFolder);
  if (sediaAda.hasNext()) return sediaAda.next();
  return folderIbu.createFolder(namaFolder);
}

function folderIndukEBidang() {
  const failSheet = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const indukSheet = failSheet.getParents();
  const folderIbu = indukSheet.hasNext() ? indukSheet.next() : DriveApp.getRootFolder();
  return cariAtauCiptaSubfolder(folderIbu, NAMA_FOLDER_INDUK_DRIVE);
}

function folderPanitia(namaPanitia) {
  return cariAtauCiptaSubfolder(folderIndukEBidang(), namaPanitia);
}

function folderKategoriDalamPanitia(namaPanitia, namaKategori) {
  return cariAtauCiptaSubfolder(folderPanitia(namaPanitia), namaKategori);
}

/* dataBase64 tanpa prefix "data:...;base64,". Pulangkan {fileId, url}. */
function muatNaikFailKeDrive(namaPanitia, namaKategori, namaFail, dataBase64, jenisMime) {
  const bait = Utilities.base64Decode(dataBase64);
  const blob = Utilities.newBlob(bait, jenisMime || 'application/octet-stream', namaFail);
  const folder = folderKategoriDalamPanitia(namaPanitia, namaKategori);
  const fail = folder.createFile(blob);
  return { fileId: fail.getId(), url: fail.getUrl() };
}

function padamFailDrive(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    // Fail mungkin sudah dipadam/dipindah secara manual — abaikan.
  }
}

/* Folder khusus gambar profil — bidang-wide (bukan per panitia), sebab satu
   pengguna (Admin/Ketua Bidang/Pembantu Makmal) tidak semestinya tergolong
   dalam satu Panitia sahaja. */
function folderProfilGuru() {
  return cariAtauCiptaSubfolder(folderIndukEBidang(), 'Profil Guru');
}

/* dataBase64 tanpa prefix "data:...;base64," — klien WAJIB kecilkan/mampatkan
   imej dahulu (rujuk resizeGambarSebagaiBase64() dalam Index.html) supaya saiz
   fail kekal kecil apabila dibenamkan sebagai data URI dalam respons apiCartaOrganisasi()/
   apiProfilPengguna(). Pulangkan {fileId, url}. */
function muatNaikGambarProfil(namaFail, dataBase64, jenisMime) {
  const bait = Utilities.base64Decode(dataBase64);
  const blob = Utilities.newBlob(bait, jenisMime || 'image/jpeg', namaFail);
  const fail = folderProfilGuru().createFile(blob);
  return { fileId: fail.getId(), url: fail.getUrl() };
}

/* Baca semula gambar dari Drive sebagai data URI base64 — paparan gambar profil
   sengaja TIDAK bergantung kepada tetapan perkongsian Drive setiap pengguna;
   pelayan Apps Script sentiasa berjalan sebagai akaun yang men-deploy sistem
   (pemilik fail), jadi ini berfungsi tanpa mengira akses Drive peribadi penonton. */
function gambarSebagaiDataUri(fileId) {
  if (!fileId) return '';
  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return '';
  }
}
