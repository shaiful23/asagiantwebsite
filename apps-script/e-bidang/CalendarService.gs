/* =========================================================================
 * CalendarService.gs — Penyegerakan automatik Google Calendar bagi
 * Mesyuarat & Program/PLC (panitia dan skop Bidang).
 *
 * - Satu kalendar khusus "E-Bidang Sains & Matematik" dicipta automatik di
 *   bawah akaun yang men-deploy sistem; ID-nya disimpan dalam Script
 *   Properties supaya tidak perlu dicari semula (getCalendarsByName lambat).
 * - Setiap event menjemput ahli panitia berkenaan (atau semua guru bidang
 *   bagi skop Bidang) yang ada lajur Emel, TANPA e-mel jemputan, supaya
 *   event terus muncul dalam Google Calendar peribadi setiap guru.
 * - Disegerak serta-merta setiap kali Mesyuarat/Program disimpan/dipadam
 *   (MeetingService.gs/ProgramService.gs, dibalut try/catch di sana), dan
 *   oleh segerakSemuaKeKalendar() — dijalankan pencetus automatik setiap
 *   6 jam, menu Sheet, atau butang "Segerak Sekarang" — untuk rekod lama,
 *   kegagalan sementara, dan perubahan senarai ahli/emel. Cincangan medan
 *   yang disegerak disimpan supaya hanya rekod yang berubah disentuh
 *   (jimat kuota CalendarApp).
 * ========================================================================= */

const NAMA_KALENDAR_EBIDANG = 'E-Bidang Sains & Matematik';
const PROP_ID_KALENDAR = 'ID_KALENDAR_EBIDANG';
const HARI_SEGERAK_KE_BELAKANG = 30;

let MEMO_KALENDAR = null;
let SEGERAK_TERAKHIR_BERUBAH = false;

function dapatkanKalendarEBidang() {
  if (MEMO_KALENDAR) return MEMO_KALENDAR;
  const prop = PropertiesService.getScriptProperties();
  const idTersimpan = prop.getProperty(PROP_ID_KALENDAR);
  let kalendar = idTersimpan ? CalendarApp.getCalendarById(idTersimpan) : null;
  if (!kalendar) {
    const sediaAda = CalendarApp.getCalendarsByName(NAMA_KALENDAR_EBIDANG);
    kalendar = sediaAda.length ? sediaAda[0] : CalendarApp.createCalendar(NAMA_KALENDAR_EBIDANG, { color: CalendarApp.Color.BLUE });
    prop.setProperty(PROP_ID_KALENDAR, kalendar.getId());
  }
  MEMO_KALENDAR = kalendar;
  return kalendar;
}

function idKalendarTersimpan() {
  return PropertiesService.getScriptProperties().getProperty(PROP_ID_KALENDAR) || '';
}

/* Emel ahli aktif bagi satu skop (panitia, atau semua guru bidang bagi SKOP_BIDANG). */
const MEMO_EMEL_SKOP = {};
function emelAhliSkop(panitia) {
  if (MEMO_EMEL_SKOP[panitia]) return MEMO_EMEL_SKOP[panitia];
  const emel = bacaSheetSebagaiObjek(SHEET_USERS)
    .filter(u => String(u.Status).toUpperCase() === 'AKTIF')
    .filter(u => {
      const senarai = senaraiPanitiaDaripadaMedan(u.Panitia);
      return panitia === SKOP_BIDANG ? senarai.length > 0 : senarai.indexOf(panitia) !== -1;
    })
    .map(u => String(u.Emel || '').trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  MEMO_EMEL_SKOP[panitia] = Array.from(new Set(emel)).sort();
  return MEMO_EMEL_SKOP[panitia];
}

function labelSkopKalendar(panitia) {
  return panitia === SKOP_BIDANG ? 'Bidang' : panitia;
}

/* ------------------------- DATA EVENT ------------------------- */
function dataEventMesyuarat(m) {
  const tarikh = keTarikhObjek(m.TarikhMesyuarat);
  if (!tarikh) return null;
  const bermasa = !!(m.MasaMula && m.MasaTamat);
  return {
    tajuk: (m.Panitia === SKOP_BIDANG ? '[Mesyuarat Bidang] ' : '[Mesyuarat Panitia ' + m.Panitia + '] ') + m.Tajuk,
    bermasa,
    mula: bermasa ? gabungTarikhMasa(tarikh, m.MasaMula) : tarikh,
    tamat: bermasa ? gabungTarikhMasa(tarikh, m.MasaTamat) : new Date(tarikh.getTime() + 24 * 60 * 60 * 1000),
    keterangan: (m.Agenda ? 'Agenda:\n' + m.Agenda + '\n\n' : '') + 'Dijana oleh Sistem E-Bidang Sains & Matematik SMK Asajaya.',
    tetamu: emelAhliSkop(m.Panitia)
  };
}

function dataEventProgram(pr) {
  const mula = keTarikhObjek(pr.TarikhMula);
  if (!mula) return null;
  const tamatMentah = keTarikhObjek(pr.TarikhTamat) || mula;
  const bermasa = !!(pr.MasaMula && pr.MasaTamat);
  return {
    tajuk: '[' + (pr.JenisProgram === 'PLC' ? 'PLC' : 'Program') + ' ' + labelSkopKalendar(pr.Panitia) + '] ' + pr.NamaProgram,
    bermasa,
    mula: bermasa ? gabungTarikhMasa(mula, pr.MasaMula) : mula,
    // all-day: tarikh tamat EKSKLUSIF, +1 hari supaya hari akhir turut disertakan.
    tamat: bermasa ? gabungTarikhMasa(tamatMentah, pr.MasaTamat) : new Date(tamatMentah.getTime() + 24 * 60 * 60 * 1000),
    keterangan: (pr.Objektif ? 'Objektif:\n' + pr.Objektif + '\n\n' : '') + 'Status: ' + (pr.Status || '-') + '\nDijana oleh Sistem E-Bidang Sains & Matematik SMK Asajaya.',
    tetamu: emelAhliSkop(pr.Panitia)
  };
}

function cincangDataEvent(data) {
  const ringkas = JSON.stringify([data.tajuk, data.bermasa, data.mula.getTime(), data.tamat.getTime(), data.keterangan, data.tetamu]);
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ringkas));
}

function kunciCincang(idRekod) { return 'kal_' + idRekod; }

/* ------------------------- SEGERAK SATU EVENT ------------------------- */
function selaraskanTetamu(event, senaraiEmel) {
  const semasa = event.getGuestList().map(g => String(g.getEmail()).toLowerCase());
  senaraiEmel.filter(e => semasa.indexOf(e) === -1).forEach(e => event.addGuest(e));
  semasa.filter(e => senaraiEmel.indexOf(e) === -1).forEach(e => event.removeGuest(e));
}

/* Cipta/kemaskini satu event; pulangkan ID event. paksa=false melangkau rekod
   yang tidak berubah sejak segerak terakhir (guna oleh segerak pukal). */
function segerakEvent(idRekod, idEventSediaAda, data, paksa) {
  const prop = PropertiesService.getScriptProperties();
  const cincang = cincangDataEvent(data);
  SEGERAK_TERAKHIR_BERUBAH = false;
  if (!paksa && idEventSediaAda && prop.getProperty(kunciCincang(idRekod)) === cincang) return idEventSediaAda;
  SEGERAK_TERAKHIR_BERUBAH = true;

  const kalendar = dapatkanKalendarEBidang();
  let event = idEventSediaAda ? kalendar.getEventById(idEventSediaAda) : null;
  if (event) {
    event.setTitle(data.tajuk);
    if (data.bermasa) event.setTime(data.mula, data.tamat); else event.setAllDayDates(data.mula, data.tamat);
    event.setDescription(data.keterangan);
    selaraskanTetamu(event, data.tetamu);
  } else {
    const pilihan = { description: data.keterangan, guests: data.tetamu.join(','), sendInvites: false };
    event = data.bermasa
      ? kalendar.createEvent(data.tajuk, data.mula, data.tamat, pilihan)
      : kalendar.createAllDayEvent(data.tajuk, data.mula, data.tamat, pilihan);
  }
  event.setGuestsCanSeeGuests(true);
  prop.setProperty(kunciCincang(idRekod), cincang);
  return event.getId();
}

function segerakEventMesyuarat(mesyuarat) {
  const data = dataEventMesyuarat(mesyuarat);
  if (!data) return '';
  return segerakEvent(mesyuarat.IDMesyuarat, mesyuarat.EventIdKalendar, data, true);
}

function segerakEventProgram(program) {
  const data = dataEventProgram(program);
  if (!data) return '';
  return segerakEvent(program.IDProgram, program.EventIdKalendar, data, true);
}

function padamEventKalendar(idEvent, idRekod) {
  if (idRekod) PropertiesService.getScriptProperties().deleteProperty(kunciCincang(idRekod));
  if (!idEvent) return;
  const event = dapatkanKalendarEBidang().getEventById(idEvent);
  if (event) event.deleteEvent();
}

/* ------------------------- SEGERAK PUKAL (AUTOMATIK) ------------------------- */
/* Segerak semua Mesyuarat & Program dari 30 hari lalu ke hadapan. Dijalankan oleh
   pencetus automatik (sediakanSegerakKalendarAutomatik), menu Sheet, atau API.
   Berhenti sebelum had masa pelaksanaan Apps Script (6 minit); baki disambung
   pada larian seterusnya. */
function segerakSemuaKeKalendar() {
  const masaMula = Date.now();
  const hadMasaMs = 4.5 * 60 * 1000;
  const sempadan = formatTarikh(new Date(Date.now() - HARI_SEGERAK_KE_BELAKANG * 24 * 60 * 60 * 1000));
  const hasil = { disegerak: 0, tidakBerubah: 0, gagal: 0, belumSelesai: false };

  const kerja = [
    { sheet: SHEET_MESYUARAT, header: HEADER_MESYUARAT, idMedan: 'IDMesyuarat', tarikhMedan: 'TarikhMesyuarat', data: dataEventMesyuarat },
    { sheet: SHEET_PROGRAM, header: HEADER_PROGRAM, idMedan: 'IDProgram', tarikhMedan: 'TarikhTamat', tarikhGanti: 'TarikhMula', data: dataEventProgram }
  ];

  for (let k = 0; k < kerja.length; k++) {
    const j = kerja[k];
    const rekod = bacaSheetSebagaiObjek(j.sheet)
      .filter(r => String(r[j.tarikhMedan] || r[j.tarikhGanti] || '') >= sempadan);
    for (let i = 0; i < rekod.length; i++) {
      if (Date.now() - masaMula > hadMasaMs) { hasil.belumSelesai = true; return hasil; }
      const r = rekod[i];
      try {
        const data = j.data(r);
        if (!data) continue;
        const idBaharu = segerakEvent(r[j.idMedan], r.EventIdKalendar, data, false);
        if (idBaharu !== r.EventIdKalendar) {
          r.EventIdKalendar = idBaharu;
          kemaskiniBaris(j.sheet, r.__row, r, j.header);
        }
        if (SEGERAK_TERAKHIR_BERUBAH) hasil.disegerak++; else hasil.tidakBerubah++;
      } catch (e) {
        hasil.gagal++;
      }
    }
  }
  return hasil;
}

function apiSegerakKalendar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const hasil = segerakSemuaKeKalendar();
  catatAudit(sesi, 'KEMASKINI', 'KALENDAR', '-', 'Segerak pukal Google Calendar: ' + JSON.stringify(hasil));
  return jaya(Object.assign({ idKalendar: idKalendarTersimpan() }, hasil));
}

/* ------------------------- PAPARAN KALENDAR (BULANAN) ------------------------- */
function apiKalendarAktiviti(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const tahun = Number(p.tahun) || new Date().getFullYear();
  const bulan = Number(p.bulan) || (new Date().getMonth() + 1);
  const awal = tahun + '-' + ('0' + bulan).slice(-2) + '-01';
  const akhir = tahun + '-' + ('0' + bulan).slice(-2) + '-31';
  const bolehLihat = pn => bolehLihatPanitia(sesi, pn);

  const mesyuarat = bacaSheetSebagaiObjek(SHEET_MESYUARAT)
    .filter(m => bolehLihat(m.Panitia) && String(m.TarikhMesyuarat) >= awal && String(m.TarikhMesyuarat) <= akhir)
    .map(m => ({
      jenis: 'MESYUARAT', id: m.IDMesyuarat, tajuk: m.Tajuk, panitia: m.Panitia,
      tarikhMula: m.TarikhMesyuarat, tarikhTamat: m.TarikhMesyuarat, masaMula: m.MasaMula || '', masaTamat: m.MasaTamat || '',
      keterangan: m.Agenda || '', disegerak: !!m.EventIdKalendar
    }));

  const program = bacaSheetSebagaiObjek(SHEET_PROGRAM)
    .filter(pr => bolehLihat(pr.Panitia) && pr.TarikhMula && String(pr.TarikhMula) <= akhir && String(pr.TarikhTamat || pr.TarikhMula) >= awal)
    .map(pr => ({
      jenis: pr.JenisProgram === 'PLC' ? 'PLC' : 'PROGRAM', id: pr.IDProgram, tajuk: pr.NamaProgram, panitia: pr.Panitia,
      tarikhMula: pr.TarikhMula, tarikhTamat: pr.TarikhTamat || pr.TarikhMula, masaMula: pr.MasaMula || '', masaTamat: pr.MasaTamat || '',
      keterangan: pr.Objektif || '', disegerak: !!pr.EventIdKalendar
    }));

  return jaya({
    tahun, bulan,
    senarai: mesyuarat.concat(program).sort((a, b) => String(a.tarikhMula).localeCompare(String(b.tarikhMula))),
    idKalendar: idKalendarTersimpan()
  });
}

/* ------------------------- PENCETUS AUTOMATIK ------------------------- */
function sediakanSegerakKalendarAutomatik() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'segerakSemuaKeKalendar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('segerakSemuaKeKalendar').timeBased().everyHours(6).create();
  const hasil = segerakSemuaKeKalendar();
  paparMesejAdmin(
    'Segerak automatik Google Calendar diaktifkan (setiap 6 jam).\n\n' +
    'Larian pertama: ' + hasil.disegerak + ' event dicipta/dikemaskini, ' + hasil.tidakBerubah + ' tidak berubah, ' +
    hasil.gagal + ' gagal' + (hasil.belumSelesai ? ' (baki akan disambung pada larian seterusnya)' : '') + '.\n\n' +
    'Guru yang ada lajur Emel di menu Pengguna akan dijemput secara automatik (tanpa e-mel) dan event akan ' +
    'muncul dalam Google Calendar mereka. ID kalendar: ' + idKalendarTersimpan()
  );
}

function segerakKalendarSekarangMenu() {
  const hasil = segerakSemuaKeKalendar();
  paparMesejAdmin('Segerak selesai: ' + hasil.disegerak + ' dicipta/dikemaskini, ' + hasil.tidakBerubah +
    ' tidak berubah, ' + hasil.gagal + ' gagal' + (hasil.belumSelesai ? ' (belum selesai — jalankan sekali lagi)' : '') + '.');
}
