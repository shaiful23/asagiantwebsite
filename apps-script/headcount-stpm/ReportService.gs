/* =========================================================================
 * ReportService.gs — MODUL 22: LAPORAN
 * Backend menyediakan data laporan yang SUDAH dianalisis (MODUL 43):
 *   - lajur   : susunan & label lajur yang tetap (google.script.run TIDAK
 *               mengekalkan susunan kunci objek, jadi susunan mesti dihantar
 *               secara eksplisit — punca lajur "bercelaru" sebelum ini).
 *   - baris   : rekod, disusun (Kelas → Nama → Subjek dsb.).
 *   - ringkasan / carta : angka KPI & data carta untuk paparan persembahan.
 * Rekod ditapis ikut peranan (penapisRekodPelajar) — Guru hanya subjeknya,
 * Guru Tingkatan hanya kelas jagaannya, Ketua Unit subjek unitnya, Admin semua.
 * ========================================================================= */

const JENIS_LAPORAN = [
  'HEADCOUNT_S1', 'HEADCOUNT_S2', 'HEADCOUNT_S3',
  'PELAJAR_BERISIKO', 'INTERVENSI', 'ULANGAN_S1', 'ULANGAN_S2',
  'PRESTASI_SUBJEK', 'GPS'
];
const RISIKO_TIADA_DATA = 'TIADA_DATA';

function lajurLaporan(senarai) {
  return senarai.map(([k, label]) => ({ k, label }));
}

function kiraan(senarai, fn) {
  const peta = {};
  senarai.forEach(x => { const k = fn(x); if (k !== '' && k !== null && k !== undefined) peta[k] = (peta[k] || 0) + 1; });
  return peta;
}

/* {kunci: bil} -> [{label, nilai}] menurun (had pilihan; baki digabung "Lain-lain"). */
function senaraiKiraan(peta, had) {
  const s = Object.keys(peta).map(k => ({ label: k, nilai: peta[k] })).sort((a, b) => b.nilai - a.nilai || String(a.label).localeCompare(String(b.label)));
  if (!had || s.length <= had) return s;
  const baki = s.slice(had - 1).reduce((j, x) => j + x.nilai, 0);
  return s.slice(0, had - 1).concat([{ label: 'Lain-lain', nilai: baki }]);
}

function susunPelajar(a, b) {
  return String(a.Kelas).localeCompare(String(b.Kelas)) || String(a.Nama).localeCompare(String(b.Nama)) ||
    String(a.Subjek || '').localeCompare(String(b.Subjek || ''));
}

/* Gred dalam susunan nilai menurun (A, A-, B+ ... F) — untuk taburan gred. */
function susunanGred(mapGred) {
  return Object.keys(mapGred).sort((a, b) => mapGred[b].nilai - mapGred[a].nilai);
}

function taburanGred(mapGred, gredSenarai) {
  const peta = {};
  susunanGred(mapGred).forEach(g => { peta[g] = 0; });
  gredSenarai.forEach(g => { const k = String(g || '').trim().toUpperCase(); if (peta[k] !== undefined) peta[k]++; });
  return susunanGred(mapGred).map(g => ({ label: g, nilai: peta[g] }));
}

function bundarLaporan(n) { return n === null || n === undefined || isNaN(n) ? null : Number(Number(n).toFixed(2)); }

function apiJanaLaporan(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const jenis = String(p.jenis || '').trim();
  if (JENIS_LAPORAN.indexOf(jenis) === -1) return ralat('Jenis laporan tidak dikenali: ' + jenis);

  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });
  const namaSubjek = {};
  bacaSheetSebagaiObjek(SHEET_SUBJECTS).forEach(s => { namaSubjek[String(s.KodSubjek)] = s.NamaSubjek; });
  const dalamSkop = penapisRekodPelajar(sesi, pelajarMap);
  const ikutTahun = r => !p.tahunSTPM || String(r.TahunSTPM) === String(p.tahunSTPM);
  const pelajar = id => pelajarMap[id] || {};
  const sasaranGPS = Number(konfig.sasaranGPS || 0) || null;

  const bacaHeadcount = sem => bacaSheetSebagaiObjek(sheetHeadcount(sem)).filter(ikutTahun).filter(dalamSkop);
  /* Risiko dikira hanya jika ada ETR DAN gred semasa — jika tidak, "Tiada Data"
     (bukan "Perlu Pemantauan"), supaya carta tidak mengelirukan. */
  const risikoLaporan = (r, a) => (r.ETR_Gred && gredEfektif(r)) ? a.risiko : RISIKO_TIADA_DATA;

  let lajur = [], baris = [], ringkasan = {}, carta = {};

  if (jenis.indexOf('HEADCOUNT_') === 0) {
    const semester = jenis.split('_')[1];
    const rekod = bacaHeadcount(semester);
    baris = rekod.map(r => {
      const a = analisisRekodHeadcount(mapGred, konfig, r);
      const s = pelajar(r.ID_Pelajar);
      return {
        IDPelajar: r.ID_Pelajar, Nama: s.Nama || '', Kelas: s.Kelas || '', Subjek: String(r.KodSubjek),
        TOV: formatMarkahGred(r.TOV_Markah, r.TOV_Gred), OTR1: formatMarkahGred(r.OTR1_Markah, r.OTR1_Gred),
        AR1: formatMarkahGred(r.AR1_Markah, r.AR1_Gred), OTR2: formatMarkahGred(r.OTR2_Markah, r.OTR2_Gred),
        AR2: formatMarkahGred(r.AR2_Markah, r.AR2_Gred), ETR: formatMarkahGred(r.ETR_Markah, r.ETR_Gred),
        SEBENAR: formatMarkahGred(r.SEBENAR_Markah, r.SEBENAR_Gred),
        StatusGapETR: a.statusGapETR || '', Trend: a.trend, Risiko: risikoLaporan(r, a),
        __gredTerkini: gredEfektif(r), __gredETR: r.ETR_Gred
      };
    }).sort(susunPelajar);
    lajur = lajurLaporan([['IDPelajar', 'ID'], ['Nama', 'Nama Pelajar'], ['Kelas', 'Kelas'], ['Subjek', 'Subjek'],
      ['TOV', 'TOV'], ['OTR1', 'OTR1'], ['AR1', 'AR1'], ['OTR2', 'OTR2'], ['AR2', 'AR2'], ['ETR', 'ETR'], ['SEBENAR', 'Sebenar'],
      ['StatusGapETR', 'Gap ETR'], ['Trend', 'Trend'], ['Risiko', 'Risiko']]);
    const terkini = baris.map(b => b.__gredTerkini).filter(Boolean);
    const etr = baris.map(b => b.__gredETR).filter(Boolean);
    ringkasan = {
      jumlahRekod: baris.length, bilPelajar: new Set(baris.map(b => b.IDPelajar)).size,
      bilSubjek: new Set(baris.map(b => b.Subjek)).size,
      gpsTerkini: bundarLaporan(kiraGPS(mapGred, terkini)), gpsETR: bundarLaporan(kiraGPS(mapGred, etr)), sasaranGPS,
      bilBerisiko: baris.filter(b => b.Risiko === RISIKO_BERISIKO).length
    };
    carta = {
      risiko: kiraan(baris, b => b.Risiko), trend: kiraan(baris, b => b.Trend),
      taburanTerkini: taburanGred(mapGred, terkini), taburanETR: taburanGred(mapGred, etr),
      berisikoIkutSubjek: senaraiKiraan(kiraan(baris.filter(b => b.Risiko === RISIKO_BERISIKO), b => b.Subjek), 10)
    };
    baris.forEach(b => { delete b.__gredTerkini; delete b.__gredETR; });

  } else if (jenis === 'PELAJAR_BERISIKO') {
    ['S1', 'S2', 'S3'].forEach(sem => {
      bacaHeadcount(sem).forEach(r => {
        const a = analisisRekodHeadcount(mapGred, konfig, r);
        if (risikoLaporan(r, a) !== RISIKO_BERISIKO) return;
        const s = pelajar(r.ID_Pelajar);
        baris.push({
          Semester: sem, IDPelajar: r.ID_Pelajar, Nama: s.Nama || '', Kelas: s.Kelas || '', Subjek: String(r.KodSubjek),
          ETR: formatMarkahGred(r.ETR_Markah, r.ETR_Gred), Terkini: formatMarkahGred(markahEfektif(r), gredEfektif(r)),
          Gap: a.gapETR !== null && a.gapETR !== undefined ? a.gapETR : '', Trend: a.trend
        });
      });
    });
    baris.sort((a, b) => String(a.Semester).localeCompare(String(b.Semester)) || susunPelajar(a, b));
    lajur = lajurLaporan([['Semester', 'Semester'], ['IDPelajar', 'ID'], ['Nama', 'Nama Pelajar'], ['Kelas', 'Kelas'], ['Subjek', 'Subjek'],
      ['ETR', 'ETR'], ['Terkini', 'Keputusan Terkini'], ['Trend', 'Trend']]);
    const ikutPelajar = kiraan(baris, b => b.IDPelajar);
    ringkasan = {
      jumlahKes: baris.length, bilPelajar: Object.keys(ikutPelajar).length,
      bilBerbilangSubjek: Object.keys(ikutPelajar).filter(k => ikutPelajar[k] > 1).length,
      subjekUtama: (senaraiKiraan(kiraan(baris, b => b.Subjek))[0] || {}).label || '-'
    };
    carta = {
      ikutSemester: ['S1', 'S2', 'S3'].map(s => ({ label: 'Semester ' + s.slice(1), nilai: baris.filter(b => b.Semester === s).length })),
      ikutSubjek: senaraiKiraan(kiraan(baris, b => b.Subjek), 10),
      ikutKelas: senaraiKiraan(kiraan(baris, b => b.Kelas), 10),
      trend: kiraan(baris, b => b.Trend)
    };

  } else if (jenis === 'INTERVENSI') {
    const rekod = bacaSheetSebagaiObjek(SHEET_INTERVENTIONS).filter(dalamSkop)
      .filter(i => !p.tahunSTPM || String(pelajar(i.ID_Pelajar).TahunSTPM) === String(p.tahunSTPM));
    baris = rekod.map(i => {
      const s = pelajar(i.ID_Pelajar);
      return {
        Tarikh: keTarikh(i.Tarikh), Semester: i.Semester, IDPelajar: i.ID_Pelajar, Nama: s.Nama || '', Kelas: s.Kelas || '',
        Subjek: String(i.KodSubjek), Jenis: i.JenisIntervensi, PIC: i.GuruPIC, Tempoh: i.Tempoh, Status: i.Status,
        Punca: i.PuncaMasalah, Objektif: i.Objektif, Keputusan: i.KeputusanSelepasIntervensi, Catatan: i.Catatan
      };
    }).sort((a, b) => String(b.Tarikh).localeCompare(String(a.Tarikh)) || susunPelajar(a, b));
    lajur = lajurLaporan([['Tarikh', 'Tarikh'], ['Semester', 'Sem'], ['IDPelajar', 'ID'], ['Nama', 'Nama Pelajar'], ['Kelas', 'Kelas'],
      ['Subjek', 'Subjek'], ['Jenis', 'Jenis Intervensi'], ['PIC', 'Guru PIC'], ['Tempoh', 'Tempoh'], ['Status', 'Status'],
      ['Punca', 'Punca Masalah'], ['Objektif', 'Objektif'], ['Keputusan', 'Keputusan Selepas'], ['Catatan', 'Catatan']]);
    ringkasan = {
      jumlah: baris.length, bilPelajar: new Set(baris.map(b => b.IDPelajar)).size,
      selesai: baris.filter(b => String(b.Status).toUpperCase() === 'SELESAI').length,
      dijalankan: baris.filter(b => String(b.Status).toUpperCase() !== 'SELESAI').length
    };
    carta = {
      status: kiraan(baris, b => String(b.Status || 'DIJALANKAN').toUpperCase()),
      ikutJenis: senaraiKiraan(kiraan(baris, b => b.Jenis || 'Tidak dinyatakan'), 10),
      ikutSubjek: senaraiKiraan(kiraan(baris, b => b.Subjek), 10)
    };

  } else if (jenis === 'ULANGAN_S1' || jenis === 'ULANGAN_S2') {
    const sem = jenis.split('_')[1];
    const rekod = bacaSheetSebagaiObjek(sheetRepeat(sem)).filter(ikutTahun).filter(dalamSkop);
    baris = rekod.map(r => {
      const s = pelajar(r.ID_Pelajar);
      return {
        IDPelajar: r.ID_Pelajar, Nama: s.Nama || '', Kelas: s.Kelas || '', Subjek: String(r.KodSubjek),
        Asal: r.KeputusanAsal, Sasaran: r.SasaranUlangan, Ujian: r.UjianSelepasIntervensi, Ulangan: r.KeputusanUlangan,
        Perubahan: statusPerubahanUlangan(mapGred, r) || 'BELUM_DINILAI', Status: r.Status
      };
    }).sort(susunPelajar);
    lajur = lajurLaporan([['IDPelajar', 'ID'], ['Nama', 'Nama Pelajar'], ['Kelas', 'Kelas'], ['Subjek', 'Subjek'],
      ['Asal', 'Keputusan Asal'], ['Sasaran', 'Sasaran'], ['Ujian', 'Ujian Selepas Intervensi'], ['Ulangan', 'Keputusan Ulangan'],
      ['Perubahan', 'Perubahan'], ['Status', 'Status']]);
    const perubahan = kiraan(baris, b => b.Perubahan);
    const dinilai = baris.filter(b => b.Perubahan !== 'BELUM_DINILAI').length;
    ringkasan = {
      jumlah: baris.length, dinilai, meningkat: perubahan.BERJAYA_MENINGKAT || 0, masihGagal: perubahan.MASIH_GAGAL || 0,
      peratusMeningkat: dinilai ? Math.round((perubahan.BERJAYA_MENINGKAT || 0) * 100 / dinilai) : null
    };
    carta = { perubahan, ikutSubjek: senaraiKiraan(kiraan(baris, b => b.Subjek), 10) };

  } else if (jenis === 'PRESTASI_SUBJEK' || jenis === 'GPS') {
    const semester = SEMESTER_HEADCOUNT.indexOf(String(p.semester)) !== -1 ? String(p.semester) : 'S1';
    const rekod = bacaHeadcount(semester).map(r => ({ r, gred: gredEfektif(r), etr: r.ETR_Gred, kelas: pelajar(r.ID_Pelajar).Kelas || '' }));
    const lulus = g => !!(mapGred[String(g).toUpperCase()] && mapGred[String(g).toUpperCase()].lulus);
    const kumpul = (fnKunci) => {
      const peta = {};
      rekod.forEach(x => { const k = fnKunci(x); (peta[k] = peta[k] || []).push(x); });
      return peta;
    };
    const statistik = senarai => {
      const gred = senarai.map(x => x.gred).filter(Boolean);
      const etr = senarai.map(x => x.etr).filter(Boolean);
      return {
        calon: gred.length, gps: bundarLaporan(kiraGPS(mapGred, gred)), gpsETR: bundarLaporan(kiraGPS(mapGred, etr)),
        peratusLulus: gred.length ? Number((gred.filter(lulus).length * 100 / gred.length).toFixed(1)) : null, gred
      };
    };
    const semua = statistik(rekod);
    const subjek = kumpul(x => String(x.r.KodSubjek));
    const kodSubjek = Object.keys(subjek).sort();
    ringkasan = {
      semester, bilSubjek: kodSubjek.length, calon: semua.calon, gpsSekolah: semua.gps, gpsETR: semua.gpsETR,
      peratusLulus: semua.peratusLulus, sasaranGPS
    };

    if (jenis === 'PRESTASI_SUBJEK') {
      const gredLajur = susunanGred(mapGred);
      baris = kodSubjek.map(k => {
        const st = statistik(subjek[k]);
        const b = { Subjek: k, NamaSubjek: namaSubjek[k] || '', Calon: st.calon, GPS: st.gps, PeratusLulus: st.peratusLulus };
        const t = taburanGred(mapGred, st.gred);
        t.forEach(x => { b['G_' + x.label] = x.nilai; });
        return b;
      });
      lajur = lajurLaporan([['Subjek', 'Kod'], ['NamaSubjek', 'Mata Pelajaran'], ['Calon', 'Calon'], ['GPS', 'GPS'], ['PeratusLulus', '% Lulus']]
        .concat(gredLajur.map(g => ['G_' + g, g])));
      carta = {
        lulusIkutSubjek: baris.map(b => ({ label: b.Subjek, nama: b.NamaSubjek, nilai: b.PeratusLulus })),
        taburan: taburanGred(mapGred, semua.gred)
      };
    } else {
      const kelas = kumpul(x => x.kelas || '(Tiada kelas)');
      const barisGPS = (peringkat, kod, nama, st) => ({
        Peringkat: peringkat, Kod: kod, Nama: nama, Calon: st.calon, GPS: st.gps, GPSETR: st.gpsETR,
        Gap: st.gps !== null && st.gpsETR !== null ? bundarLaporan(st.gps - st.gpsETR) : null,
        Sasaran: sasaranGPS, CapaiSasaran: st.gps === null || !sasaranGPS ? '' : (st.gps >= sasaranGPS ? 'YA' : 'TIDAK')
      });
      const ikutSubjek = kodSubjek.map(k => barisGPS('Subjek', k, namaSubjek[k] || '', statistik(subjek[k])));
      const ikutKelas = Object.keys(kelas).sort().map(k => barisGPS('Kelas', k, k, statistik(kelas[k])));
      baris = [barisGPS('Sekolah', '-', 'Keseluruhan', semua)].concat(ikutSubjek, ikutKelas);
      lajur = lajurLaporan([['Peringkat', 'Peringkat'], ['Kod', 'Kod'], ['Nama', 'Subjek / Kelas'], ['Calon', 'Calon'],
        ['GPS', 'GPS Semasa'], ['GPSETR', 'GPS ETR'], ['Gap', 'Gap (Semasa − ETR)'], ['CapaiSasaran', 'Capai Sasaran']]);
      carta = {
        gpsIkutSubjek: ikutSubjek.map(b => ({ label: b.Kod, nama: b.Nama, nilai: b.GPS, etr: b.GPSETR })),
        gpsIkutKelas: ikutKelas.map(b => ({ label: b.Kod, nilai: b.GPS, etr: b.GPSETR }))
      };
    }
  }

  return jaya({ jenis, lajur, baris, ringkasan, carta, tahunSTPM: String(p.tahunSTPM || ''), dijanaPada: formatTarikhMasa(new Date()) });
}
