/* =========================================================================
 * NotifikasiService.gs — Notifikasi e-mel harian bagi Tindakan Susulan
 * tertunggak/tamat tempoh dan Pesanan Radas & Bahan Makmal menunggu
 * tindakan (dicetuskan oleh pencetus terjadual — sediakanNotifikasiHarian(),
 * Code.gs), DAN notifikasi e-mel SEGERA (hantarEmelSegera()) yang dipanggil
 * terus daripada PesananMakmalService.gs/MeetingService.gs sebaik sahaja
 * satu peristiwa berlaku (status pesanan ditukar / tindakan baharu
 * ditugaskan) — bukan menunggu pencetus harian.
 *
 * Hanya pengguna dengan lajur Emel (USERS) diisi akan menerima e-mel;
 * pengguna lain dilangkau senyap (bukan ralat).
 * ========================================================================= */

function hantarNotifikasiHarian() {
  hantarNotifikasiTindakanTertunggak();
  hantarNotifikasiPesananMenunggu();
}

/* E-mel SEGERA (bukan digest) — dipanggil terus daripada service berkaitan
   sebaik sahaja peristiwa berlaku. Kuota/ralat MailApp tidak menghalang
   tindakan utama (simpan/kemaskini rekod) — dibalut try/catch di sini. */
function hantarEmelSegera(emelPenerima, tajuk, badan) {
  if (!emelPenerima) return;
  try { MailApp.sendEmail(emelPenerima, tajuk, badan); } catch (e) { /* abaikan — bukan sumber kebenaran */ }
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

/* Satu e-mel setiap penerima aktif jika ada Pesanan Radas & Bahan Makmal berstatus
   Menunggu YANG RELEVAN kepadanya — Admin/Ketua Bidang/Ketua Pembantu Makmal menerima
   senarai PENUH merentasi semua Makmal; Pembantu Makmal biasa hanya menerima pesanan
   bagi Makmal yang dijaganya sendiri (USERS.MakmalDijaga). */
function hantarNotifikasiPesananMenunggu() {
  const menunggu = bacaSheetSebagaiObjek(SHEET_PESANAN_MAKMAL).filter(ps => ps.Status === STATUS_PESANAN_MENUNGGU);
  if (!menunggu.length) return;

  const penggunaAktif = bacaSheetSebagaiObjek(SHEET_USERS)
    .filter(u => String(u.Status).toUpperCase() === 'AKTIF' && u.Emel);

  penggunaAktif.forEach(u => {
    let senarai;
    if (PERANAN_LIHAT_SEMUA_PESANAN.indexOf(u.Peranan) !== -1) {
      senarai = menunggu;
    } else if (u.Peranan === ROLE_PEMBANTU_MAKMAL) {
      const makmalSendiri = senaraiDaripadaMedan(u.MakmalDijaga);
      senarai = menunggu.filter(ps => makmalSendiri.indexOf(ps.Makmal) !== -1);
    } else {
      return;
    }
    if (!senarai.length) return;

    const badan = 'Salam ' + u.NamaPenuh + ',\n\n' +
      'Terdapat ' + senarai.length + ' Pesanan Radas & Bahan Makmal menunggu tindakan di Sistem E-Bidang:\n\n' +
      senarai.map(ps => '- [' + ps.Makmal + '] ' + ps.TajukEksperimen + ' (' + ps.Kelas + ') — diperlukan ' + ps.TarikhDiperlukan + ', oleh ' + ps.NamaGuru).join('\n') +
      '\n\nSila log masuk ke Sistem E-Bidang untuk memproses pesanan.\n\n— E-Bidang Sains & Matematik, SMK Asajaya';

    MailApp.sendEmail(u.Emel, 'Peringatan: ' + senarai.length + ' Pesanan Makmal Menunggu Tindakan', badan);
  });
}

const LABEL_STATUS_TINDAKAN_EMEL = { BELUM_MULA: 'Belum Mula', DALAM_PROSES: 'Dalam Proses', SELESAI: 'Selesai' };
const LABEL_STATUS_PESANAN_EMEL = { MENUNGGU: 'Menunggu', DALAM_PROSES: 'Dalam Proses', SIAP: 'Siap', DITOLAK: 'Ditolak', DIBATALKAN: 'Dibatalkan' };
