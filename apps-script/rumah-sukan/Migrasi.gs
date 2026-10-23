/* =========================================================================
 * Migrasi.gs — Penyelarasan struktur database secara AUTOMATIK.
 * Apabila sistem dinaik taraf (Sheet atau lajur baharu), pengguna tidak perlu
 * membuka Google Sheet: panggilan pertama ke Web App (log masuk / mula) akan
 * mencipta Sheet yang tiada dan menambah lajur yang tiada di hujung header.
 * Versi skema disimpan dalam Script Properties supaya semakan ini hanya
 * membaca satu nilai pada kebanyakan panggilan (sangat pantas).
 * ========================================================================= */

function definisiSkema() {
  return [
    { nama: SHEET_STAF, header: HEADER_STAF },
    { nama: SHEET_MURID, header: HEADER_MURID },
    { nama: SHEET_RUMAH, header: HEADER_RUMAH, isi: RUMAH_LALAI },
    { nama: SHEET_AJK, header: HEADER_AJK, isi: [
      ['AJK-TEKNIK', 'AJK TEKNIK', 'Pengurusan padang, peralatan & balapan', 1, 'TIDAK'],
      ['AJK-HADIAH', 'AJK HADIAH & PIALA', 'Penyediaan hadiah, pingat & piala', 2, 'TIDAK'],
      ['AJK-PENGADIL', 'AJK PENGADIL & HAKIM', 'Pengadilan acara padang & balapan', 3, 'YA'],
      ['AJK-REKOD', 'AJK REKOD & KEPUTUSAN', 'Rekod & pengumuman keputusan', 4, 'YA']
    ] },
    { nama: SHEET_AJK_AHLI, header: HEADER_AJK_AHLI },
    { nama: SHEET_TETAPAN, header: HEADER_TETAPAN, isi: tetapanLalai() },
    { nama: SHEET_AUDIT, header: HEADER_AUDIT },
    { nama: SHEET_ACARA, header: HEADER_ACARA },
    { nama: SHEET_PESERTA, header: HEADER_PESERTA },
    { nama: SHEET_MATA_LAIN, header: HEADER_MATA_LAIN }
  ];
}

/* Cipta Sheet yang tiada + tambah lajur yang tiada. Pulangkan senarai perubahan. */
function selaraskanSkema() {
  const ss = spreadsheetAktif();
  const ubah = [];
  definisiSkema().forEach(d => {
    let sh = ss.getSheetByName(d.nama);
    if (!sh) {
      sh = ciptaSheetJikaTiada(ss, d.nama, d.header, LAJUR_TEKS[d.nama]);
      if (d.isi && d.isi.length) sh.getRange(2, 1, d.isi.length, d.header.length).setValues(d.isi);
      ubah.push('Sheet ' + d.nama);
    } else {
      const lebar = Math.max(sh.getLastColumn(), 1);
      const sedia = sh.getRange(1, 1, 1, lebar).getValues()[0].map(String);
      const tiada = d.header.filter(h => sedia.indexOf(h) === -1);
      if (tiada.length) {
        const mula = sedia.filter(String).length + 1;
        sh.getRange(1, mula, 1, tiada.length).setValues([tiada]).setFontWeight('bold').setBackground('#e2e8f0');
        (LAJUR_TEKS[d.nama] || []).forEach(nm => {
          const i = tiada.indexOf(nm);
          if (i !== -1) sh.getRange(2, mula + i, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
        });
        ubah.push(d.nama + ': ' + tiada.join(', '));
      }
    }
    delete _memoHeader[d.nama];
    tandaKotor(d.nama);
  });
  return ubah;
}

/* Dipanggil pada permulaan sesi. Kos biasa: satu bacaan Script Properties. */
function pastikanSkema() {
  const props = PropertiesService.getScriptProperties();
  if (Number(props.getProperty('VERSI_SKEMA')) >= VERSI_SKEMA) return;
  const kunci = LockService.getScriptLock();
  try { kunci.waitLock(20000); } catch (e) { return; }
  try {
    if (Number(props.getProperty('VERSI_SKEMA')) >= VERSI_SKEMA) return;
    selaraskanSkema();
    props.setProperty('VERSI_SKEMA', String(VERSI_SKEMA));
  } finally { kunci.releaseLock(); }
}
