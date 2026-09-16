/* =========================================================================
 * NotifikasiService.gs — Notifikasi e-mel harian bagi Tindakan Susulan
 * tertunggak/tamat tempoh dan Pesanan Radas & Bahan Makmal menunggu
 * tindakan. Dicetuskan oleh pencetus terjadual (time-driven trigger) yang
 * ditetapkan melalui menu Sheet "3. Aktifkan Notifikasi E-mel Harian"
 * (sediakanNotifikasiHarian(), Code.gs) — tidak dipanggil oleh mana-mana
 * fungsi api*() klien.
 *
 * Hanya pengguna dengan lajur Emel (USERS) diisi akan menerima e-mel;
 * pengguna lain dilangkau senyap (bukan ralat).
 * ========================================================================= */

function hantarNotifikasiHarian() {
  hantarNotifikasiTindakanTertunggak();
  hantarNotifikasiPesananMenunggu();
}

/* Satu e-mel setiap guru/ketua panitia yang mempunyai tindakan susulan
   tertunggak (belum SELESAI, tarikh akhir sudah sampai/lepas). */
function hantarNotifikasiTindakanTertunggak() {
  const hariIni = formatTarikh(new Date());
  const tertunggak = bacaSheetSebagaiObjek(SHEET_TINDAKAN_SUSULAN)
    .filter(t => t.Status !== STATUS_SELESAI && t.TanggungjawabNoKP && String(t.TarikhAkhir) && String(t.TarikhAkhir) <= hariIni);
  if (!tertunggak.length) return;

  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS);
  const kumpulan = {}; // NoKP -> [tindakan...]
  tertunggak.forEach(t => {
    (kumpulan[t.TanggungjawabNoKP] = kumpulan[t.TanggungjawabNoKP] || []).push(t);
  });

  Object.keys(kumpulan).forEach(nokp => {
    const u = pengguna.find(pn => pn.NoKP === nokp);
    if (!u || !u.Emel) return;

    const senarai = kumpulan[nokp];
    const badan = 'Salam ' + u.NamaPenuh + ',\n\n' +
      'Berikut adalah tindakan susulan yang tertunggak/telah tamat tempoh di Sistem E-Bidang:\n\n' +
      senarai.map(t => '- [' + t.Panitia + '] ' + t.Perkara + ' (tarikh akhir: ' + t.TarikhAkhir + ', status: ' + LABEL_STATUS_TINDAKAN_EMEL[t.Status] + ')').join('\n') +
      '\n\nSila log masuk ke Sistem E-Bidang untuk kemaskini status.\n\n— E-Bidang Sains & Matematik, SMK Asajaya';

    MailApp.sendEmail(u.Emel, 'Peringatan: ' + senarai.length + ' Tindakan Susulan Tertunggak', badan);
  });
}

/* Satu e-mel setiap Pembantu Makmal/Admin/Ketua Bidang aktif jika ada
   Pesanan Radas & Bahan Makmal berstatus Menunggu (merentasi semua panitia). */
function hantarNotifikasiPesananMenunggu() {
  const menunggu = bacaSheetSebagaiObjek(SHEET_PESANAN_MAKMAL).filter(ps => ps.Status === STATUS_PESANAN_MENUNGGU);
  if (!menunggu.length) return;

  const penerima = bacaSheetSebagaiObjek(SHEET_USERS)
    .filter(u => PERANAN_LIHAT_SEMUA_PESANAN.indexOf(u.Peranan) !== -1 && String(u.Status).toUpperCase() === 'AKTIF' && u.Emel);
  if (!penerima.length) return;

  const badan = 'Salam,\n\n' +
    'Terdapat ' + menunggu.length + ' Pesanan Radas & Bahan Makmal menunggu tindakan di Sistem E-Bidang:\n\n' +
    menunggu.map(ps => '- [' + ps.Panitia + '] ' + ps.TajukEksperimen + ' (' + ps.Kelas + ') — diperlukan ' + ps.TarikhDiperlukan + ', oleh ' + ps.NamaGuru).join('\n') +
    '\n\nSila log masuk ke Sistem E-Bidang untuk memproses pesanan.\n\n— E-Bidang Sains & Matematik, SMK Asajaya';

  penerima.forEach(u => MailApp.sendEmail(u.Emel, 'Peringatan: ' + menunggu.length + ' Pesanan Makmal Menunggu Tindakan', badan));
}

const LABEL_STATUS_TINDAKAN_EMEL = { BELUM_MULA: 'Belum Mula', DALAM_PROSES: 'Dalam Proses', SELESAI: 'Selesai' };
