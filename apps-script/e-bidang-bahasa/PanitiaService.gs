/* =========================================================================
 * PanitiaService.gs — Pengurusan Panitia tetap Bidang Bahasa (senarai dalam
 * SENARAI_PANITIA, Config.gs). Baris Panitia dicipta semasa "Sediakan Sistem"
 * dan diselaraskan dengan SENARAI_PANITIA melalui selaraskanSenaraiPanitia()
 * (menu Sheet); service ini juga menguruskan penetapan Ketua Panitia.
 * ========================================================================= */

const HEADER_PANITIA = ['KodPanitia', 'NamaPanitia', 'KetuaPanitia', 'Status'];

function kodPanitiaDaripadaNama(nama) {
  return String(nama).toUpperCase().replace(/\s+/g, '_');
}

/* Baris Sheet PANITIA yang masih tersenarai dalam SENARAI_PANITIA (Config.gs) —
   baris panitia lama yang telah dibuang daripada senarai tidak dipaparkan. */
function barisPanitiaSemasa() {
  return bacaSheetSebagaiObjek(SHEET_PANITIA).filter(pn => SENARAI_PANITIA.indexOf(pn.NamaPanitia) !== -1);
}

/* Selaraskan Sheet PANITIA dengan SENARAI_PANITIA selepas senarai itu diubah:
   tambah baris bagi panitia baharu, aktifkan semula panitia yang kembali ke senarai,
   dan tandakan TIDAK_AKTIF (bukan padam — penetapan Ketua Panitia & rekod lama
   kekal) bagi panitia yang telah dibuang. Selamat dijalankan berulang kali. */
function selaraskanSenaraiPanitia() {
  const sedia = bacaSheetSebagaiObjek(SHEET_PANITIA);
  const ditambah = [], diaktifkan = [], dinyahaktif = [];

  SENARAI_PANITIA.forEach(nama => {
    const baris = sedia.find(pn => pn.NamaPanitia === nama);
    if (!baris) {
      tambahBaris(SHEET_PANITIA, { KodPanitia: kodPanitiaDaripadaNama(nama), NamaPanitia: nama, KetuaPanitia: '', Status: 'AKTIF' }, HEADER_PANITIA);
      ditambah.push(nama);
    } else if (String(baris.Status).toUpperCase() !== 'AKTIF') {
      baris.Status = 'AKTIF';
      kemaskiniBaris(SHEET_PANITIA, baris.__row, baris, HEADER_PANITIA);
      diaktifkan.push(nama);
    }
  });
  sedia.filter(pn => SENARAI_PANITIA.indexOf(pn.NamaPanitia) === -1 && String(pn.Status).toUpperCase() === 'AKTIF')
    .forEach(pn => {
      pn.Status = 'TIDAK_AKTIF';
      kemaskiniBaris(SHEET_PANITIA, pn.__row, pn, HEADER_PANITIA);
      dinyahaktif.push(pn.NamaPanitia);
    });

  return { ditambah, diaktifkan, dinyahaktif };
}

function apiSenaraiPanitia(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS);
  const senarai = barisPanitiaSemasa().map(pn => {
    const ketua = pengguna.find(u => String(u.NoKP) === String(pn.KetuaPanitia));
    return {
      kodPanitia: pn.KodPanitia,
      namaPanitia: pn.NamaPanitia,
      ketuaPanitiaNoKP: pn.KetuaPanitia || '',
      ketuaPanitiaNama: ketua ? ketua.NamaPenuh : '',
      status: pn.Status,
      __row: pn.__row
    };
  });
  return jaya({ senarai });
}

function apiTetapkanKetuaPanitia(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;

  const panitia = cariBarisMengikutId(SHEET_PANITIA, 'KodPanitia', String(p.kodPanitia || '').trim());
  if (!panitia) return ralat('Panitia tidak dijumpai.');

  const nokpKetua = String(p.nokpKetua || '').trim();
  if (nokpKetua) {
    const pengguna = cariBarisMengikutId(SHEET_USERS, 'NoKP', nokpKetua);
    if (!pengguna) return ralat('Pengguna (bakal Ketua Panitia) tidak dijumpai.');
    if (senaraiPanitiaDaripadaMedan(pengguna.Panitia).indexOf(panitia.NamaPanitia) === -1) {
      return ralat('Pengguna ini bukan ahli panitia ' + panitia.NamaPanitia + '. Kemaskini panitia pengguna dahulu.');
    }
    if (pengguna.Peranan !== ROLE_KETUA_PANITIA) {
      pengguna.Peranan = ROLE_KETUA_PANITIA;
      kemaskiniBaris(SHEET_USERS, pengguna.__row, pengguna, HEADER_USERS);
    }
  }

  panitia.KetuaPanitia = nokpKetua;
  kemaskiniBaris(SHEET_PANITIA, panitia.__row, panitia, HEADER_PANITIA);
  catatAudit(sesi, 'KEMASKINI', 'PANITIA', panitia.KodPanitia, 'Tetapkan Ketua Panitia: ' + (nokpKetua || '(kosongkan)'));
  return jaya({});
}
