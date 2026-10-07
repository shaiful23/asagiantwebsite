/* =========================================================================
 * MakmalOpsService.gs — Pengurusan Makmal: Inventori Radas &amp; Bahan
 * (kuantiti/status) dan Semakan Keselamatan Makmal (senarai semak).
 * Lanjutan daripada Pesanan Radas &amp; Bahan Makmal (PesananMakmalService.gs)
 * yang hanya uruskan PERMINTAAN — modul ini uruskan STOK/inventori sedia ada
 * dan pematuhan keselamatan setiap Makmal.
 *
 * Lihat: PERANAN_PROSES_PESANAN (sama seperti Pesanan Makmal) ATAU mana-mana
 * Guru/Ketua Panitia bagi panitia makmal (PANITIA_MAKMAL). Urus (tambah/
 * sunting/padam): Admin/Ketua Bidang/Ketua Pembantu Makmal (semua Makmal),
 * atau Pembantu Makmal biasa bagi Makmal yang dijaganya sendiri sahaja.
 * ========================================================================= */

const HEADER_INVENTORI_MAKMAL = ['IDInventori', 'Makmal', 'NamaItem', 'Kategori', 'Kuantiti',
  'Unit', 'Status', 'TarikhKemaskini', 'Catatan', 'DiciptaOleh'];
const HEADER_SEMAKAN_KESELAMATAN_MAKMAL = ['IDSemakanKeselamatan', 'Makmal', 'TarikhSemakan', 'Pemeriksa']
  .concat(SENARAI_SEMAK_KESELAMATAN_MAKMAL.map(item => item[0]))
  .concat(['Catatan', 'DiciptaOleh']);

function bolehLihatMakmalOps(sesi) {
  return PERANAN_PROSES_PESANAN.indexOf(sesi.peranan) !== -1 ||
    ((sesi.peranan === ROLE_GURU || sesi.peranan === ROLE_KETUA_PANITIA) && (sesi.panitia || []).some(pn => PANITIA_MAKMAL.indexOf(pn) !== -1));
}
function bolehUrusMakmalOps(sesi, makmal) {
  if (PERANAN_LIHAT_SEMUA_PESANAN.indexOf(sesi.peranan) !== -1) return true;
  if (sesi.peranan === ROLE_PEMBANTU_MAKMAL) return (sesi.makmal || []).indexOf(makmal) !== -1;
  return false;
}

/* ============================ INVENTORI MAKMAL ============================ */
function apiSenaraiInventoriMakmal(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehLihatMakmalOps(sesi)) return ralat('Anda tidak mempunyai kebenaran untuk melihat inventori makmal.');

  const senarai = bacaSheetSebagaiObjek(SHEET_INVENTORI_MAKMAL).filter(inv => String(inv.Makmal) === String(p.makmal));
  return jaya({ senarai });
}

function apiSimpanInventoriMakmal(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehUrusMakmalOps(sesi, p.makmal)) return ralat('Anda tidak mempunyai kebenaran untuk Makmal ini.');

  const namaItem = String(p.namaItem || '').trim();
  const kategori = String(p.kategori || '').trim();
  if (!namaItem) return ralat('Sila isi Nama Item.');
  if (KATEGORI_INVENTORI_MAKMAL.indexOf(kategori) === -1) return ralat('Kategori tidak sah.');
  const status = STATUS_INVENTORI_MAKMAL.indexOf(p.status) !== -1 ? p.status : STATUS_INVENTORI_MAKMAL[0];

  const sediaAda = p.idInventori ? cariBarisMengikutId(SHEET_INVENTORI_MAKMAL, 'IDInventori', p.idInventori) : null;
  const objek = {
    IDInventori: sediaAda ? sediaAda.IDInventori : janaId('INV'),
    Makmal: p.makmal,
    NamaItem: namaItem,
    Kategori: kategori,
    Kuantiti: String(p.kuantiti || '').trim(),
    Unit: String(p.unit || '').trim(),
    Status: status,
    TarikhKemaskini: formatTarikh(new Date()),
    Catatan: String(p.catatan || '').trim(),
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama
  };

  if (sediaAda) {
    kemaskiniBaris(SHEET_INVENTORI_MAKMAL, sediaAda.__row, objek, HEADER_INVENTORI_MAKMAL);
    catatAudit(sesi, 'KEMASKINI', 'INVENTORI_MAKMAL', objek.IDInventori, 'Kemaskini inventori: ' + namaItem + ' (' + p.makmal + ')');
  } else {
    tambahBaris(SHEET_INVENTORI_MAKMAL, objek, HEADER_INVENTORI_MAKMAL);
    catatAudit(sesi, 'TAMBAH', 'INVENTORI_MAKMAL', objek.IDInventori, 'Tambah inventori: ' + namaItem + ' (' + p.makmal + ')');
  }
  return jaya({ idInventori: objek.IDInventori });
}

function apiPadamInventoriMakmal(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const inv = cariBarisMengikutId(SHEET_INVENTORI_MAKMAL, 'IDInventori', p.idInventori);
  if (!inv) return ralat('Item inventori tidak dijumpai.');
  if (!bolehUrusMakmalOps(sesi, inv.Makmal)) return ralat('Anda tidak mempunyai kebenaran untuk Makmal ini.');

  padamBaris(SHEET_INVENTORI_MAKMAL, inv.__row);
  catatAudit(sesi, 'PADAM', 'INVENTORI_MAKMAL', inv.IDInventori, 'Padam inventori: ' + inv.NamaItem);
  return jaya({});
}

/* ============================ SEMAKAN KESELAMATAN MAKMAL ============================ */
function apiSenaraiSemakanKeselamatan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehLihatMakmalOps(sesi)) return ralat('Anda tidak mempunyai kebenaran untuk melihat semakan keselamatan makmal.');

  const senarai = bacaSheetSebagaiObjek(SHEET_SEMAKAN_KESELAMATAN_MAKMAL)
    .filter(sm => String(sm.Makmal) === String(p.makmal))
    .sort((a, b) => String(b.TarikhSemakan).localeCompare(String(a.TarikhSemakan)));
  return jaya({ senarai });
}

function apiSimpanSemakanKeselamatan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  if (!bolehUrusMakmalOps(sesi, p.makmal)) return ralat('Anda tidak mempunyai kebenaran untuk Makmal ini.');

  const pemeriksa = String(p.pemeriksa || '').trim();
  const tarikhSemakan = String(p.tarikhSemakan || '').trim();
  if (!pemeriksa || !tarikhSemakan) return ralat('Sila isi Pemeriksa dan Tarikh Semakan.');

  const itemLulus = Array.isArray(p.itemLulus) ? p.itemLulus : [];
  const sediaAda = p.idSemakanKeselamatan ? cariBarisMengikutId(SHEET_SEMAKAN_KESELAMATAN_MAKMAL, 'IDSemakanKeselamatan', p.idSemakanKeselamatan) : null;
  const objek = {
    IDSemakanKeselamatan: sediaAda ? sediaAda.IDSemakanKeselamatan : janaId('SKM'),
    Makmal: p.makmal,
    TarikhSemakan: tarikhSemakan,
    Pemeriksa: pemeriksa,
    Catatan: String(p.catatan || '').trim(),
    DiciptaOleh: sediaAda ? sediaAda.DiciptaOleh : sesi.nama
  };
  SENARAI_SEMAK_KESELAMATAN_MAKMAL.forEach(item => { objek[item[0]] = itemLulus.indexOf(item[0]) !== -1 ? 'YA' : 'TIDAK'; });

  if (sediaAda) {
    kemaskiniBaris(SHEET_SEMAKAN_KESELAMATAN_MAKMAL, sediaAda.__row, objek, HEADER_SEMAKAN_KESELAMATAN_MAKMAL);
    catatAudit(sesi, 'KEMASKINI', 'SEMAKAN_KESELAMATAN_MAKMAL', objek.IDSemakanKeselamatan, 'Kemaskini semakan keselamatan: ' + p.makmal);
  } else {
    tambahBaris(SHEET_SEMAKAN_KESELAMATAN_MAKMAL, objek, HEADER_SEMAKAN_KESELAMATAN_MAKMAL);
    catatAudit(sesi, 'TAMBAH', 'SEMAKAN_KESELAMATAN_MAKMAL', objek.IDSemakanKeselamatan, 'Tambah semakan keselamatan: ' + p.makmal);
  }
  return jaya({ idSemakanKeselamatan: objek.IDSemakanKeselamatan });
}

function apiPadamSemakanKeselamatan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const sm = cariBarisMengikutId(SHEET_SEMAKAN_KESELAMATAN_MAKMAL, 'IDSemakanKeselamatan', p.idSemakanKeselamatan);
  if (!sm) return ralat('Rekod semakan keselamatan tidak dijumpai.');
  if (!bolehUrusMakmalOps(sesi, sm.Makmal)) return ralat('Anda tidak mempunyai kebenaran untuk Makmal ini.');

  padamBaris(SHEET_SEMAKAN_KESELAMATAN_MAKMAL, sm.__row);
  catatAudit(sesi, 'PADAM', 'SEMAKAN_KESELAMATAN_MAKMAL', sm.IDSemakanKeselamatan, 'Padam semakan keselamatan: ' + sm.Makmal);
  return jaya({});
}
