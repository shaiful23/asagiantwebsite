/* =========================================================================
 * PesananMakmalService.gs — Pesanan Radas & Bahan Makmal (Panitia Sains,
 * Kimia, Biologi & Fizik sahaja — Matematik tidak menjalankan eksperimen
 * makmal). Guru/Ketua Panitia panitia berkenaan membuat pesanan; Pembantu
 * Makmal (+ Admin/Ketua Bidang) memproses & menukar status merentasi semua
 * panitia. Borang formal (dengan logo sekolah) dijana & dicetak di klien
 * (Index.html) daripada data apiButiranPesanan().
 * ========================================================================= */

const HEADER_PESANAN_MAKMAL = ['IDPesanan', 'Panitia', 'NamaGuru', 'NoKPGuru', 'Kelas',
  'TajukEksperimen', 'TarikhDiperlukan', 'CatatanAm', 'Status', 'DiciptaOleh', 'TarikhCipta',
  'DiprosesOleh', 'TarikhDiproses', 'CatatanPembantu'];
const HEADER_ITEM_PESANAN_MAKMAL = ['IDItem', 'IDPesanan', 'NamaBahanRadas', 'Kuantiti', 'Unit', 'Catatan'];

/* panitia ialah panitia SASARAN pesanan (bukan sesi.panitia terus, sebab seorang
   guru boleh mengajar > 1 panitia makmal). ADMIN/KETUA_BIDANG boleh buat pesanan
   bagi mana-mana panitia makmal (cth. admin yang juga ketua panitia Kimia tetapi
   perlu buat pesanan bagi panitia Sains juga). */
function bolehBuatPesananMakmal(sesi, panitia) {
  if (PANITIA_MAKMAL.indexOf(panitia) === -1) return false;
  if (PERANAN_AKSES_PENUH.indexOf(sesi.peranan) !== -1) return true;
  return (sesi.peranan === ROLE_GURU || sesi.peranan === ROLE_KETUA_PANITIA) && (sesi.panitia || []).indexOf(panitia) !== -1;
}

function bolehLihatPesanan(sesi, pesanan) {
  if (PERANAN_LIHAT_SEMUA_PESANAN.indexOf(sesi.peranan) !== -1) return true;
  if (sesi.peranan === ROLE_KETUA_PANITIA) return (sesi.panitia || []).indexOf(pesanan.Panitia) !== -1;
  if (sesi.peranan === ROLE_GURU) return (sesi.panitia || []).indexOf(pesanan.Panitia) !== -1 && sesi.nokp === pesanan.NoKPGuru;
  return false;
}

function apiSenaraiPesanan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  let senarai;
  if (PERANAN_LIHAT_SEMUA_PESANAN.indexOf(sesi.peranan) !== -1) {
    senarai = bacaSheetSebagaiObjek(SHEET_PESANAN_MAKMAL);
    if (p.panitia) senarai = senarai.filter(ps => ps.Panitia === p.panitia);
  } else if (sesi.peranan === ROLE_KETUA_PANITIA) {
    senarai = bacaSheetSebagaiObjek(SHEET_PESANAN_MAKMAL).filter(ps => (sesi.panitia || []).indexOf(ps.Panitia) !== -1);
  } else if (sesi.peranan === ROLE_GURU) {
    senarai = bacaSheetSebagaiObjek(SHEET_PESANAN_MAKMAL).filter(ps => (sesi.panitia || []).indexOf(ps.Panitia) !== -1 && ps.NoKPGuru === sesi.nokp);
  } else {
    return ralat('Anda tidak mempunyai kebenaran untuk modul ini.');
  }

  if (p.status) senarai = senarai.filter(ps => ps.Status === p.status);
  senarai.sort((a, b) => String(b.TarikhCipta).localeCompare(String(a.TarikhCipta)));
  return jaya({ senarai });
}

function apiButiranPesanan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pesanan = cariBarisMengikutId(SHEET_PESANAN_MAKMAL, 'IDPesanan', p.idPesanan);
  if (!pesanan) return ralat('Pesanan tidak dijumpai.');
  if (!bolehLihatPesanan(sesi, pesanan)) return ralat('Anda tidak mempunyai kebenaran untuk pesanan ini.');

  const item = bacaSheetSebagaiObjek(SHEET_ITEM_PESANAN_MAKMAL).filter(i => i.IDPesanan === pesanan.IDPesanan);
  return jaya({ pesanan, item });
}

function apiSimpanPesanan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const panitia = String(p.panitia || '').trim();
  if (!bolehBuatPesananMakmal(sesi, panitia)) return ralat('Hanya Guru/Ketua Panitia bagi panitia Sains, Kimia, Biologi & Fizik (atau Admin/Ketua Bidang) boleh membuat pesanan makmal.');

  const kelas = String(p.kelas || '').trim();
  const tajukEksperimen = String(p.tajukEksperimen || '').trim();
  const tarikhDiperlukan = String(p.tarikhDiperlukan || '').trim();
  const senaraiItem = (p.item || [])
    .map(it => ({
      namaBahanRadas: String(it.namaBahanRadas || '').trim(),
      kuantiti: String(it.kuantiti || '').trim(),
      unit: String(it.unit || '').trim(),
      catatan: String(it.catatan || '').trim()
    }))
    .filter(it => it.namaBahanRadas);

  if (!kelas || !tajukEksperimen || !tarikhDiperlukan) return ralat('Sila lengkapkan kelas, tajuk eksperimen dan tarikh diperlukan.');
  if (!senaraiItem.length) return ralat('Sila tambah sekurang-kurangnya satu bahan/radas.');

  const idPesanan = janaId('PSN');
  tambahBaris(SHEET_PESANAN_MAKMAL, {
    IDPesanan: idPesanan,
    Panitia: panitia,
    NamaGuru: sesi.nama,
    NoKPGuru: sesi.nokp,
    Kelas: kelas,
    TajukEksperimen: tajukEksperimen,
    TarikhDiperlukan: tarikhDiperlukan,
    CatatanAm: String(p.catatanAm || '').trim(),
    Status: STATUS_PESANAN_MENUNGGU,
    DiciptaOleh: sesi.nama,
    TarikhCipta: formatTarikhMasa(new Date()),
    DiprosesOleh: '',
    TarikhDiproses: '',
    CatatanPembantu: ''
  }, HEADER_PESANAN_MAKMAL);

  senaraiItem.forEach(it => {
    tambahBaris(SHEET_ITEM_PESANAN_MAKMAL, {
      IDItem: janaId('ITM'),
      IDPesanan: idPesanan,
      NamaBahanRadas: it.namaBahanRadas,
      Kuantiti: it.kuantiti,
      Unit: it.unit,
      Catatan: it.catatan
    }, HEADER_ITEM_PESANAN_MAKMAL);
  });

  catatAudit(sesi, 'TAMBAH', 'PESANAN_MAKMAL', idPesanan, 'Pesanan makmal baharu: ' + tajukEksperimen + ' (' + panitia + ', ' + kelas + ')');
  return jaya({ idPesanan });
}

/* Sama ada sesi boleh batal/sunting pesanan ini — pemohon asal, atau
   Ketua Panitia/Admin/Ketua Bidang bagi panitia berkenaan. */
function bolehUbahPesanan(sesi, pesanan) {
  return sesi.nokp === pesanan.NoKPGuru ||
    (PERANAN_URUS_PANITIA.indexOf(sesi.peranan) !== -1 && wajibAksesPanitia(sesi, pesanan.Panitia));
}

function apiBatalPesanan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pesanan = cariBarisMengikutId(SHEET_PESANAN_MAKMAL, 'IDPesanan', p.idPesanan);
  if (!pesanan) return ralat('Pesanan tidak dijumpai.');
  if (pesanan.Status !== STATUS_PESANAN_MENUNGGU) return ralat('Hanya pesanan berstatus Menunggu boleh dibatalkan.');
  if (!bolehUbahPesanan(sesi, pesanan)) return ralat('Anda tidak mempunyai kebenaran untuk membatalkan pesanan ini.');

  pesanan.Status = STATUS_PESANAN_DIBATALKAN;
  kemaskiniBaris(SHEET_PESANAN_MAKMAL, pesanan.__row, pesanan, HEADER_PESANAN_MAKMAL);
  catatAudit(sesi, 'BATAL', 'PESANAN_MAKMAL', pesanan.IDPesanan, 'Batal pesanan: ' + pesanan.TajukEksperimen);
  return jaya({});
}

/* Sunting pesanan sedia ada (kelas/tajuk/tarikh/catatan + gantikan senarai item)
   — hanya dibenarkan selagi status masih Menunggu, supaya Pembantu Makmal tidak
   memproses berdasarkan maklumat yang berubah tanpa disedari selepas pemprosesan
   bermula. Untuk pembetulan selepas itu, pemohon batalkan & hantar pesanan baharu. */
function apiKemaskiniPesanan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pesanan = cariBarisMengikutId(SHEET_PESANAN_MAKMAL, 'IDPesanan', p.idPesanan);
  if (!pesanan) return ralat('Pesanan tidak dijumpai.');
  if (pesanan.Status !== STATUS_PESANAN_MENUNGGU) return ralat('Hanya pesanan berstatus Menunggu boleh disunting.');
  if (!bolehUbahPesanan(sesi, pesanan)) return ralat('Anda tidak mempunyai kebenaran untuk menyunting pesanan ini.');

  const kelas = String(p.kelas || '').trim();
  const tajukEksperimen = String(p.tajukEksperimen || '').trim();
  const tarikhDiperlukan = String(p.tarikhDiperlukan || '').trim();
  const senaraiItem = (p.item || [])
    .map(it => ({
      namaBahanRadas: String(it.namaBahanRadas || '').trim(),
      kuantiti: String(it.kuantiti || '').trim(),
      unit: String(it.unit || '').trim(),
      catatan: String(it.catatan || '').trim()
    }))
    .filter(it => it.namaBahanRadas);

  if (!kelas || !tajukEksperimen || !tarikhDiperlukan) return ralat('Sila lengkapkan kelas, tajuk eksperimen dan tarikh diperlukan.');
  if (!senaraiItem.length) return ralat('Sila tambah sekurang-kurangnya satu bahan/radas.');

  pesanan.Kelas = kelas;
  pesanan.TajukEksperimen = tajukEksperimen;
  pesanan.TarikhDiperlukan = tarikhDiperlukan;
  pesanan.CatatanAm = String(p.catatanAm || '').trim();
  kemaskiniBaris(SHEET_PESANAN_MAKMAL, pesanan.__row, pesanan, HEADER_PESANAN_MAKMAL);

  bacaSheetSebagaiObjek(SHEET_ITEM_PESANAN_MAKMAL)
    .filter(i => i.IDPesanan === pesanan.IDPesanan)
    .sort((a, b) => b.__row - a.__row)
    .forEach(i => padamBaris(SHEET_ITEM_PESANAN_MAKMAL, i.__row));

  senaraiItem.forEach(it => {
    tambahBaris(SHEET_ITEM_PESANAN_MAKMAL, {
      IDItem: janaId('ITM'),
      IDPesanan: pesanan.IDPesanan,
      NamaBahanRadas: it.namaBahanRadas,
      Kuantiti: it.kuantiti,
      Unit: it.unit,
      Catatan: it.catatan
    }, HEADER_ITEM_PESANAN_MAKMAL);
  });

  catatAudit(sesi, 'KEMASKINI', 'PESANAN_MAKMAL', pesanan.IDPesanan, 'Sunting pesanan: ' + tajukEksperimen);
  return jaya({});
}

/* Pembantu Makmal (+ Admin/Ketua Bidang) menukar status & catatan pemprosesan. */
function apiKemaskiniStatusPesanan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_LIHAT_SEMUA_PESANAN);
  if (sesi.success === false) return sesi;

  const pesanan = cariBarisMengikutId(SHEET_PESANAN_MAKMAL, 'IDPesanan', p.idPesanan);
  if (!pesanan) return ralat('Pesanan tidak dijumpai.');
  if (SEMUA_STATUS_PESANAN.indexOf(p.status) === -1) return ralat('Status tidak sah.');

  pesanan.Status = p.status;
  pesanan.CatatanPembantu = String(p.catatanPembantu !== undefined ? p.catatanPembantu : (pesanan.CatatanPembantu || '')).trim();
  pesanan.DiprosesOleh = sesi.nama;
  pesanan.TarikhDiproses = formatTarikhMasa(new Date());
  kemaskiniBaris(SHEET_PESANAN_MAKMAL, pesanan.__row, pesanan, HEADER_PESANAN_MAKMAL);
  catatAudit(sesi, 'TUKAR_STATUS', 'PESANAN_MAKMAL', pesanan.IDPesanan, 'Status ditukar kepada ' + p.status);
  return jaya({});
}

function apiPadamPesanan(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const pesanan = cariBarisMengikutId(SHEET_PESANAN_MAKMAL, 'IDPesanan', p.idPesanan);
  if (!pesanan) return ralat('Pesanan tidak dijumpai.');

  bacaSheetSebagaiObjek(SHEET_ITEM_PESANAN_MAKMAL)
    .filter(i => i.IDPesanan === pesanan.IDPesanan)
    .sort((a, b) => b.__row - a.__row)
    .forEach(i => padamBaris(SHEET_ITEM_PESANAN_MAKMAL, i.__row));

  padamBaris(SHEET_PESANAN_MAKMAL, pesanan.__row);
  catatAudit(sesi, 'PADAM', 'PESANAN_MAKMAL', pesanan.IDPesanan, 'Padam pesanan: ' + pesanan.TajukEksperimen);
  return jaya({});
}
