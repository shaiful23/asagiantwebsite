/* =========================================================================
 * RujukanIdmeService.gs — Dokumen rujukan (PDF / cetak) semua medan PAJSK yang telah
 * diisi bagi satu kelas, untuk kegunaan Guru Kelas semasa memasukkan PAJSK ke dalam idME.
 * Susunan aspek ikut borang PAJSK: Sukan & Permainan, Kelab & Persatuan, Badan Beruniform,
 * kemudian Ekstra Kurikulum. Medan wajib yang masih kosong ditanda "BELUM DIISI".
 * Akses: Admin, atau Guru Kelas bagi kelasnya sendiri.
 * ========================================================================= */

const SUSUNAN_ASPEK_IDME = [ASPEK_SP, ASPEK_KP, ASPEK_PBB];
const MURID_SETIAP_HALAMAN_PDF = 2;

function escHtml(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sel(nilai, wajib) {
  const v = String(nilai === null || nilai === undefined ? '' : nilai).trim();
  if (v) return escHtml(v);
  return wajib ? '<span class="kosong-wajib">BELUM DIISI</span>' : '<span class="kosong">—</span>';
}

function htmlMuridIdme(m, bil) {
  const baris = [];
  const kol = a => m.aspek[a];
  const adaUnit = a => !!(kol(a).Unit || (m.unit && m.unit[a]));
  const barisAspek = (label, fn) => '<tr><th>' + label + '</th>' + SUSUNAN_ASPEK_IDME.map(a => '<td>' + (adaUnit(a) ? fn(kol(a), a) : '<span class="kosong">Tiada unit</span>') + '</td>').join('') + '</tr>';
  baris.push(barisAspek('Unit / aktiviti', r => '<b>' + sel(r.Unit) + '</b>'));
  baris.push(barisAspek('Jawatan', r => sel(r.Jawatan, true)));
  baris.push(barisAspek('Pelibatan (aktiviti 1)', r => sel(r.Libat1, true)));
  baris.push(barisAspek('Pencapaian (aktiviti 1)', r => sel(r.Capai1)));
  baris.push(barisAspek('Tambahan aktiviti', r => sel(r.Aktiviti2)));
  baris.push(barisAspek('Pelibatan (tambahan)', r => sel(r.Libat2)));
  baris.push(barisAspek('Pencapaian (tambahan)', r => sel(r.Capai2)));
  baris.push(barisAspek('Komitmen', r => {
    const k = [r.Komit1, r.Komit2, r.Komit3, r.Komit4].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    return k.length ? k.map((x, i) => (i + 1) + '. ' + escHtml(x)).join('<br>') : sel('', true);
  }));
  baris.push(barisAspek('Khidmat sumbangan', r => sel(r.Khidmat)));
  baris.push(barisAspek('Kehadiran (perjumpaan)', r => escHtml(r.Kehadiran || 0) + (String(r.KehadiranManual) !== '' ? ' <span class="kosong">(manual)</span>' : '')));
  baris.push(barisAspek('Markah aspek', r => escHtml(r.Markah || 0) + '%'));

  const ek = m.ekstra || {};
  const rum = m.rumusan || {};
  const cgpaWajib = WAJIB_CGPA_SEBELUM && nomborTingkatan(m.tingkatan) >= 2;
  return '<div class="murid">' +
    '<table class="kepala"><tr><td class="nama">' + bil + '. ' + escHtml(m.nama) + '</td><td>No. KP: <b>' + escHtml(m.nokp) + '</b></td><td>' + escHtml(m.jantina || '') + '</td></tr></table>' +
    '<table class="data"><tr><th style="width:21%">Medan</th>' + SUSUNAN_ASPEK_IDME.map(a => '<th style="width:26.3%">' + escHtml(NAMA_ASPEK[a]) + '</th>').join('') + '</tr>' + baris.join('') + '</table>' +
    '<table class="data ekstra"><tr><th colspan="4">Ekstra kurikulum &amp; rumusan</th></tr>' +
    '<tr><th>Perkhidmatan</th><td>' + sel(ek.Perkhidmatan) + '</td><th>Anugerah khas</th><td>' + sel(ek.AnugerahKhas) + '</td></tr>' +
    '<tr><th>Khidmat masyarakat</th><td>' + sel(ek.KhidmatMasyarakat) + '</td><th>NILAM</th><td>' + sel(ek.Nilam) + '</td></tr>' +
    '<tr><th>TIMSS &amp; PISA</th><td>' + sel(ek.TimmsPisa) + '</td><th>Tugas-tugas khas</th><td>' + sel(ek.TugasKhas) + '</td></tr>' +
    '<tr><th>CGPA tahun sebelum</th><td>' + sel(m.cgpaSebelum, cgpaWajib) + '</td><th>GPA / CGPA / Gred</th><td><b>' + escHtml(rum.GPA !== undefined ? rum.GPA : '—') + ' / ' + escHtml(rum.CGPA !== undefined ? rum.CGPA : '—') + ' / ' + escHtml(rum.Gred || '—') + '</b></td></tr>' +
    '</table></div>';
}

function binaHtmlRujukanIdme(kelas, senarai, bilKelas) {
  const t = bacaTetapan();
  const masa = sekarangTeks();
  const guru = bacaSheetSebagaiObjek(SHEET_PENGGUNA).filter(u => senaraiDaripadaMedan(u.KelasDijaga).indexOf(kelas) !== -1).map(u => u.NamaPenuh);
  const gaya = '<style>' +
    '.rujukan-idme{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#000}' +
    '.rujukan-idme h1{font-size:13pt;margin:0 0 2px;text-align:center}' +
    '.rujukan-idme .sub{text-align:center;font-size:9.5pt;margin-bottom:6px}' +
    '.rujukan-idme .nota{font-size:8pt;color:#333;margin:4px 0 8px}' +
    '.rujukan-idme table{width:100%;border-collapse:collapse;margin-bottom:4px}' +
    '.rujukan-idme th,.rujukan-idme td{border:1px solid #555;padding:2px 4px;vertical-align:top;text-align:left;font-size:8.5pt}' +
    '.rujukan-idme th{background:#e5e7eb}' +
    '.rujukan-idme table.kepala td{border:none;border-bottom:2px solid #1e3a8a;font-size:10pt;padding:3px 2px}' +
    '.rujukan-idme table.kepala td.nama{font-weight:bold;width:55%}' +
    '.rujukan-idme .murid{margin-bottom:10px;page-break-inside:avoid}' +
    '.rujukan-idme .kosong{color:#666}' +
    '.rujukan-idme .kosong-wajib{color:#b91c1c;font-weight:bold}' +
    '.rujukan-idme .putus{page-break-after:always;break-after:page;height:0}' +
    '</style>';
  const ringkas = '<table class="data"><tr><th style="width:6%">Bil</th><th>Nama</th><th style="width:16%">No. KP</th><th style="width:12%">CGPA</th><th style="width:8%">Gred</th><th style="width:30%">Belum diisi</th></tr>' +
    senarai.map((m, i) => '<tr><td>' + (i + 1) + '</td><td>' + escHtml(m.nama) + '</td><td>' + escHtml(m.nokp) + '</td><td>' + escHtml((m.rumusan || {}).CGPA || '—') + '</td><td>' + escHtml((m.rumusan || {}).Gred || '—') + '</td><td>' +
      (m.kelengkapan && m.kelengkapan.kurang.length ? '<span class="kosong-wajib">' + escHtml(m.kelengkapan.kurang.join('; ')) + '</span>' : 'Lengkap') + '</td></tr>').join('') + '</table>';
  let badan = '';
  senarai.forEach((m, i) => {
    badan += htmlMuridIdme(m, i + 1);
    if ((i + 1) % MURID_SETIAP_HALAMAN_PDF === 0 && i < senarai.length - 1) badan += '<div class="putus"></div>';
  });
  return gaya + '<div class="rujukan-idme">' +
    '<h1>RUJUKAN PENGISIAN PAJSK (idME) — ' + escHtml(t[TET_NAMA_SEKOLAH] || '') + '</h1>' +
    '<div class="sub">' + escHtml(paparKelas(kelas)) + ' · Tahun ' + escHtml(tahunSemasa()) + (t[TET_KOD_SEKOLAH] ? ' · ' + escHtml(t[TET_KOD_SEKOLAH]) : '') +
    (guru.length ? ' · Guru Kelas: ' + escHtml(guru.join(', ')) : '') + '</div>' +
    '<div class="nota">Dijana daripada e-PAJSK pada ' + escHtml(masa) + '. ' + senarai.length + (senarai.length !== bilKelas ? ' daripada ' + bilKelas : '') +
    ' murid. Medan bertanda <span class="kosong-wajib">BELUM DIISI</span> ialah medan wajib yang masih kosong dalam e-PAJSK. Dokumen ini mengandungi maklumat peribadi murid — simpan dengan selamat.</div>' +
    (senarai.length > 1 ? '<h1 style="font-size:11pt;text-align:left;margin-top:6px">Senarai semak</h1>' + ringkas + '<div class="putus"></div>' : '') +
    badan + '</div>';
}

/* p: {kelas, nokp?, format: 'pdf' | 'html'} */
function apiRujukanIdme(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const kelas = String(p.kelas || '').trim();
  if (!sesiBolehKelas(sesi, kelas)) return ralat('Anda tidak mempunyai akses kepada kelas ini.');
  const k = muatKonteks(kelas);
  const nokp = normalKP(p.nokp);
  const senarai = k.murid.filter(m => !nokp || m.NoKP === nokp).map(m => ringkasMurid(m, k));
  if (!senarai.length) return ralat('Tiada murid untuk dijana.');
  const html = binaHtmlRujukanIdme(kelas, senarai, k.murid.length);
  const namaFail = 'Rujukan-PAJSK-idME-' + tahunSemasa() + '-' + kelas.replace(/\s+/g, '_') + (nokp ? '-' + senarai[0].nama.split(' ')[0] : '') + '.pdf';
  catatAudit(sesi, 'JANA_RUJUKAN', 'IDME', kelas, (p.format === 'pdf' ? 'PDF' : 'Cetak') + ' · ' + senarai.length + ' murid');
  if (p.format !== 'pdf') return jaya({ html, namaFail });
  const dok = '<html><head><meta charset="UTF-8"></head><body>' + html + '</body></html>';
  const pdf = Utilities.newBlob(dok, 'text/html', 'rujukan.html').getAs('application/pdf');
  return jaya({ namaFail, data: Utilities.base64Encode(pdf.getBytes()), bilMurid: senarai.length });
}
