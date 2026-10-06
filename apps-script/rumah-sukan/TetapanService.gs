/* =========================================================================
 * TetapanService.gs — Tetapan umum (tahun kejohanan, kategori) dan
 * pengurusan Rumah Sukan (bilangan, nama, warna, moto) melalui UI Admin.
 * ========================================================================= */

/* ------------------------- TETAPAN ------------------------- */
function tetapanLalai() {
  return [
    [TET_TAHUN, String(new Date().getFullYear()), 'Tahun kejohanan olahraga (umur kategori dikira daripada tahun ini)'],
    [TET_NAMA_KEJOHANAN, 'Kejohanan Olahraga Tahunan SMK Asajaya', 'Nama kejohanan'],
    [TET_MOD_KATEGORI, 'UMUR', 'UMUR = ikut tahun lahir (No. KP); TINGKATAN = ikut tingkatan'],
    [TET_KATEGORI, JSON.stringify(KATEGORI_LALAI), 'Senarai kategori (JSON) — ubah melalui UI'],
    [TET_KRITERIA, JSON.stringify(KRITERIA_LALAI), 'Kriteria agihan murid (JSON) — ubah melalui UI'],
    [TET_AGIHAN_TERAKHIR, '', 'Ringkasan agihan terakhir']
  ];
}

function bacaTetapan() {
  const peta = {};
  tetapanLalai().forEach(r => { peta[r[0]] = r[1]; });
  bacaSheetSebagaiObjek(SHEET_TETAPAN).forEach(r => { if (r.Kunci) peta[String(r.Kunci)] = String(r.Nilai === undefined ? '' : r.Nilai); });
  return peta;
}

function simpanTetapan(peta) {
  const ket = {};
  tetapanLalai().forEach(r => { ket[r[0]] = r[2]; });
  upsertBanyak(SHEET_TETAPAN, 'Kunci', Object.keys(peta).map(k => ({ Kunci: k, Nilai: peta[k], Keterangan: ket[k] || '' })));
}

function jsonSelamat(teks, lalai) {
  try { const v = JSON.parse(teks); return v === null || v === undefined ? lalai : v; } catch (e) { return lalai; }
}

function tahunKejohanan(tet) {
  const t = Number((tet || bacaTetapan())[TET_TAHUN]);
  return t > 2000 ? t : new Date().getFullYear();
}

function konfigKategori(tet) {
  const t = tet || bacaTetapan();
  const senarai = jsonSelamat(t[TET_KATEGORI], KATEGORI_LALAI);
  return {
    mod: t[TET_MOD_KATEGORI] === 'TINGKATAN' ? 'TINGKATAN' : 'UMUR',
    senarai: Array.isArray(senarai) && senarai.length ? senarai : KATEGORI_LALAI,
    tahun: tahunKejohanan(t)
  };
}

function kriteriaAgihan(tet) {
  const k = jsonSelamat((tet || bacaTetapan())[TET_KRITERIA], {});
  return Object.assign({}, KRITERIA_LALAI, k || {});
}

/* ------------------------- KATEGORI MURID ------------------------- */
/* Tahun lahir: daripada TarikhLahir (jika ada tahun 4 digit) atau 2 digit pertama No. KP. */
function tahunLahirMurid(m, tahunRujukan) {
  const t = String(m.TarikhLahir || '').match(/(19|20)\d{2}/);
  if (t) return Number(t[0]);
  const kp = normalKP(m.NoKP);
  if (kp.length !== 12) return null;
  const yy = Number(kp.slice(0, 2));
  return yy <= (tahunRujukan % 100) ? 2000 + yy : 1900 + yy;
}

/* "1", "T1", "TINGKATAN 1", "6 RENDAH", "PERALIHAN" -> 1..6 / 0 */
function nomborTingkatan(nilai) {
  const s = String(nilai || '').toUpperCase();
  if (/PERALIHAN|^PR/.test(s)) return 0;
  const m = s.match(/(\d)/);
  return m ? Number(m[1]) : 0;
}

/* Pulangkan kod kategori murid ('' jika tidak dapat ditentukan). */
function kategoriMurid(m, cfg) {
  if (cfg.mod === 'TINGKATAN') {
    const t = String(nomborTingkatan(m.Tingkatan));
    const k = cfg.senarai.find(x => senaraiDaripadaMedan(x.tingkatan).indexOf(t) !== -1);
    return k ? k.kod : '';
  }
  const lahir = tahunLahirMurid(m, cfg.tahun);
  if (!lahir) return '';
  const umur = cfg.tahun - lahir;
  const k = cfg.senarai.find(x => umur >= Number(x.umurMin) && umur <= Number(x.umurMax));
  return k ? k.kod : '';
}

/* ------------------------- RUMAH SUKAN ------------------------- */
function senaraiRumah() {
  return bacaSheetSebagaiObjek(SHEET_RUMAH)
    .filter(r => r.RumahId)
    .map(r => ({ id: String(r.RumahId), nama: String(r.Nama || ''), warna: String(r.Warna || '#64748b'), moto: String(r.Moto || ''), susunan: nombor(r.Susunan, 99) }))
    .sort((a, b) => a.susunan - b.susunan || a.nama.localeCompare(b.nama));
}

function petaRumah() {
  const peta = {};
  senaraiRumah().forEach(r => { peta[r.id] = r; });
  return peta;
}

function apiTetapan(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const tet = bacaTetapan();
  return jaya({
    tahun: tahunKejohanan(tet), namaKejohanan: tet[TET_NAMA_KEJOHANAN],
    kategori: konfigKategori(tet), kriteria: kriteriaAgihan(tet), rumah: senaraiRumah(),
    perananRumah: NAMA_PERANAN_RUMAH, perananAjk: NAMA_PERANAN_AJK, hadRumah: HAD_RUMAH
  });
}

function apiSimpanTetapan(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const tahun = Number(p.tahun);
  if (!(tahun >= 2000 && tahun <= 2100)) return ralat('Tahun kejohanan tidak sah.');
  const mod = p.modKategori === 'TINGKATAN' ? 'TINGKATAN' : 'UMUR';
  const kategori = (p.kategori || []).map(k => ({
    kod: banding(k.kod).replace(/\s+/g, ''), nama: teksBersih(k.nama),
    umurMin: nombor(k.umurMin, 0), umurMax: nombor(k.umurMax, 99), tingkatan: senaraiDaripadaMedan(k.tingkatan).join(',')
  })).filter(k => k.kod);
  if (!kategori.length) return ralat('Sekurang-kurangnya satu kategori diperlukan.');
  const kod = {};
  for (const k of kategori) {
    if (kod[k.kod]) return ralat('Kod kategori "' + k.kod + '" berulang.');
    kod[k.kod] = true;
    if (!k.nama) k.nama = k.kod;
    if (mod === 'UMUR' && k.umurMin > k.umurMax) return ralat('Julat umur kategori ' + k.kod + ' tidak sah.');
  }
  return denganKunci(() => {
    const peta = {};
    peta[TET_TAHUN] = String(tahun);
    peta[TET_NAMA_KEJOHANAN] = teksBersih(p.namaKejohanan) || tetapanLalai()[1][1];
    peta[TET_MOD_KATEGORI] = mod;
    peta[TET_KATEGORI] = JSON.stringify(kategori);
    simpanTetapan(peta);
    catatAudit(sesi, 'SIMPAN_TETAPAN', 'TETAPAN', '', 'Tahun ' + tahun + ', mod ' + mod + ', ' + kategori.length + ' kategori');
    return jaya({});
  });
}

/* Simpan keseluruhan senarai rumah sukan (bilangan + nama + warna + moto) sekali gus.
   p.rumah = [{id?, nama, warna, moto}] mengikut susunan paparan. Rumah yang dibuang mesti tiada ahli. */
function apiSimpanRumah(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const masuk = (p.rumah || []).map(r => ({
    id: String(r.id || '').trim(), nama: banding(r.nama),
    warna: /^#[0-9a-fA-F]{6}$/.test(String(r.warna || '')) ? String(r.warna) : '#64748b', moto: teksBersih(r.moto)
  }));
  if (masuk.length < 2) return ralat('Sekurang-kurangnya 2 rumah sukan diperlukan.');
  if (masuk.length > HAD_RUMAH) return ralat('Maksimum ' + HAD_RUMAH + ' rumah sukan.');
  const nama = {};
  for (const r of masuk) {
    if (!r.nama) return ralat('Setiap rumah sukan mesti mempunyai nama.');
    if (nama[r.nama]) return ralat('Nama rumah "' + r.nama + '" berulang.');
    nama[r.nama] = true;
  }

  return denganKunci(() => {
    const sedia = senaraiRumah();
    const idSedia = {};
    sedia.forEach(r => { idSedia[r.id] = true; });
    const dikekal = {};
    masuk.forEach(r => { if (r.id && idSedia[r.id]) dikekal[r.id] = true; else r.id = ''; });

    // rumah yang dibuang mesti tiada ahli (murid aktif atau staf)
    const dibuang = sedia.filter(r => !dikekal[r.id]);
    if (dibuang.length) {
      const bil = {};
      bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => { if (m.RumahId) bil[m.RumahId] = (bil[m.RumahId] || 0) + 1; });
      bacaSheetSebagaiObjek(SHEET_STAF).forEach(s => { if (s.RumahId) bil[s.RumahId] = (bil[s.RumahId] || 0) + 1; });
      const berahli = dibuang.filter(r => bil[r.id]);
      if (berahli.length && !p.kosongkanAhli) {
        return ralat('Rumah ' + berahli.map(r => r.nama + ' (' + bil[r.id] + ' ahli)').join(', ') +
          ' masih mempunyai ahli. Tandakan "Kosongkan ahli rumah yang dibuang" atau pindahkan ahli dahulu.');
      }
      if (berahli.length) {
        const idBuang = {};
        berahli.forEach(r => { idBuang[r.id] = true; });
        const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => idBuang[m.RumahId]).map(m => ({ NoKP: m.NoKP, RumahId: '', KunciRumah: '' }));
        const staf = bacaSheetSebagaiObjek(SHEET_STAF).filter(s => idBuang[s.RumahId]).map(s => ({ NoKP: s.NoKP, RumahId: '', PerananRumah: '' }));
        upsertBanyak(SHEET_MURID, 'NoKP', murid);
        upsertBanyak(SHEET_STAF, 'NoKP', staf);
      }
    }

    // ID baharu: R<n> yang belum pernah digunakan
    let n = 1;
    const guna = {};
    sedia.forEach(r => { guna[r.id] = true; });
    masuk.forEach(r => {
      if (r.id) return;
      while (guna['R' + n]) n++;
      r.id = 'R' + n; guna[r.id] = true;
    });

    const sh = dapatkanSheet(SHEET_RUMAH);
    const header = headerSebenarSheet(sh);
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, header.length).clearContent();
    const baris = masuk.map((r, i) => objekKeBaris({ RumahId: r.id, Nama: r.nama, Warna: r.warna, Moto: r.moto, Susunan: i + 1 }, header));
    sh.getRange(2, 1, baris.length, header.length).setValues(baris);
    tandaKotor(SHEET_RUMAH);
    catatAudit(sesi, 'SIMPAN_RUMAH', 'RUMAH_SUKAN', '', masuk.length + ' rumah: ' + masuk.map(r => r.nama).join(', ') +
      (dibuang.length ? ' | dibuang: ' + dibuang.map(r => r.nama).join(', ') : ''));
    return jaya({ rumah: senaraiRumah() });
  });
}
