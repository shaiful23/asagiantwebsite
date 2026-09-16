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
