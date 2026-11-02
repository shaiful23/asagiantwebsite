/* =========================================================================
 * CalendarService.gs — Segerak DUA HALA Google Calendar bagi Mesyuarat,
 * Program dan PLC (panitia & skop Bidang).
 *
 * PORTAL -> KALENDAR: setiap kali rekod disimpan, dan oleh pencetus automatik
 *   (setiap SELANG_SYNC_MINIT dalam Sheet TETAPAN), event dicipta/dikemaskini
 *   dengan warna modul, tempat, peringatan pop-up dan jemputan ahli panitia
 *   (jika JEMPUT_GURU = YA). Setiap event ditag "ebidang = MODUL:ID".
 * KALENDAR -> PORTAL (DUA_HALA = YA): jika tarikh/masa/tempat diubah terus di
 *   Google Calendar dan rekod portal tidak berubah sejak segerak terakhir,
 *   perubahan itu ditarik balik ke Sheet ("⇄ dari kalendar").
 * Event yang dipadam di Google Calendar ditanda "DIPADAM DI KALENDAR" dan
 *   tidak dicipta semula sehingga rekod disunting dari portal.
 * Event bertag yang rekodnya sudah tiada (yatim) dipadam automatik.
 *
 * Lajur status dalam setiap Sheet: EventIdKalendar, StatusKalendar
 * (DISEGERAK / ⇄ dari kalendar / RALAT / DIBATALKAN / TIADA TARIKH) dan
 * HashKalendar (cincangan data terakhir yang dihantar ke kalendar).
 * ========================================================================= */

const NAMA_KALENDAR_EBIDANG = 'E-Bidang Bahasa';
const PROP_ID_KALENDAR = 'ID_KALENDAR_EBIDANG';
const TAG_KALENDAR = 'ebidang';
const HARI_SEGERAK_KE_BELAKANG = 60;
const HARI_SEGERAK_KE_HADAPAN = 730;
const HANDLER_SEGERAK = 'segerakSemuaKeKalendar';
const HANDLER_PANAS_CACHE = 'panaskanCache';
const LAJUR_STATUS_KALENDAR = ['EventIdKalendar', 'StatusKalendar', 'HashKalendar'];
const SEHARI_MS = 24 * 60 * 60 * 1000;

let MEMO_KALENDAR = null;
let SEGERAK_TERAKHIR_BERUBAH = false;

/* Konfigurasi setiap modul yang disegerak. */
function modulKalendar(kod) {
  const peta = {
    MESYUARAT: {
      sheet: SHEET_MESYUARAT, id: 'IDMesyuarat', data: dataEventMesyuarat,
      tarikh: r => r.TarikhMesyuarat, tarik: tarikMesyuarat, medanTarik: ['TarikhMesyuarat', 'MasaMula', 'MasaTamat', 'Tempat']
    },
    PROGRAM: {
      sheet: SHEET_PROGRAM, id: 'IDProgram', data: dataEventProgram,
      tarikh: r => r.TarikhTamat || r.TarikhMula, tarik: tarikProgram, medanTarik: ['TarikhMula', 'TarikhTamat', 'MasaMula', 'MasaTamat', 'Tempat']
    },
    PLC: {
      sheet: SHEET_PLC, id: 'IDPLC', data: dataEventPLC,
      tarikh: r => r.Tarikh, tarik: tarikPLC, medanTarik: ['Tarikh', 'MasaMula', 'MasaTamat', 'Tempat'],
      batal: r => r.Status === 'DIBATALKAN'
    }
  };
  return peta[kod];
}
const SEMUA_MODUL_KALENDAR = ['MESYUARAT', 'PROGRAM', 'PLC'];

function dapatkanKalendarEBidang() {
  if (MEMO_KALENDAR) return MEMO_KALENDAR;
  const idTetapan = tetapan('CALENDAR_ID');
  if (idTetapan) {
    const k = CalendarApp.getCalendarById(idTetapan);
    if (!k) throw new Error('CALENDAR_ID dalam TETAPAN tidak sah atau tiada akses: ' + idTetapan);
    MEMO_KALENDAR = k;
    return k;
  }
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
  return tetapan('CALENDAR_ID') || PropertiesService.getScriptProperties().getProperty(PROP_ID_KALENDAR) || '';
}

/* Emel ahli aktif bagi satu skop (panitia, atau semua guru bidang bagi SKOP_BIDANG). */
const MEMO_EMEL_SKOP = {};
function emelAhliSkop(panitia) {
  if (!tetapanYa('JEMPUT_GURU')) return [];
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
/* Masa berkesan: masa rekod, atau masa lalai TETAPAN jika rekod tiada masa. */
function masaBerkesan(masaMula, masaTamat) {
  if (masaMula && masaTamat) return { mula: masaMula, tamat: masaTamat };
  const lalaiMula = tetapan('MASA_MULA_LALAI'), lalaiTamat = tetapan('MASA_TAMAT_LALAI');
  if (!masaMula && !masaTamat && lalaiMula && lalaiTamat && lalaiTamat > lalaiMula) return { mula: lalaiMula, tamat: lalaiTamat };
  return null;
}

function binaDataEvent(tajuk, tarikhMula, tarikhTamat, masaMula, masaTamat, tempat, keterangan, panitia, warna) {
  const mula = keTarikhObjek(tarikhMula);
  if (!mula) return null;
  const tamatHari = keTarikhObjek(tarikhTamat) || mula;
  const masa = masaBerkesan(masaMula, masaTamat);
  return {
    tajuk,
    bermasa: !!masa,
    mula: masa ? gabungTarikhMasa(mula, masa.mula) : mula,
    /* all-day: tarikh tamat EKSKLUSIF, +1 hari supaya hari akhir turut disertakan. */
    tamat: masa ? gabungTarikhMasa(tamatHari, masa.tamat) : new Date(tamatHari.getTime() + SEHARI_MS),
    lokasi: String(tempat || tetapan('TEMPAT_LALAI') || ''),
    keterangan: keterangan + 'Dijana oleh Sistem E-Bidang Bahasa SMK Asajaya.',
    tetamu: emelAhliSkop(panitia),
    warna,
    peringatan: tetapanNombor('PERINGATAN_MINIT', 30)
  };
}

function dataEventMesyuarat(m) {
  const tajuk = (m.Panitia === SKOP_BIDANG ? '[Mesyuarat Bidang] ' : '[Mesyuarat Panitia ' + m.Panitia + '] ') + m.Tajuk;
  return binaDataEvent(tajuk, m.TarikhMesyuarat, m.TarikhMesyuarat, m.MasaMula, m.MasaTamat, m.Tempat,
    m.Agenda ? 'Agenda:\n' + m.Agenda + '\n\n' : '', m.Panitia, 'BLUE');
}

function dataEventProgram(pr) {
  const tajuk = '[' + (pr.JenisProgram === 'PLC' ? 'PLC' : 'Program') + ' ' + labelSkopKalendar(pr.Panitia) + '] ' + pr.NamaProgram;
  return binaDataEvent(tajuk, pr.TarikhMula, pr.TarikhTamat, pr.MasaMula, pr.MasaTamat, pr.Tempat,
    (pr.Objektif ? 'Objektif:\n' + pr.Objektif + '\n\n' : '') + 'Status: ' + (pr.Status || '-') + '\n',
    pr.Panitia, pr.JenisProgram === 'PLC' ? 'MAUVE' : 'RED');
}

function dataEventPLC(r) {
  const tajuk = '[PLC ' + labelSkopKalendar(r.Panitia) + '] ' + r.Tajuk;
  const ket = 'Jenis: ' + (r.JenisPLC || '-') + '\n' +
    (r.Fasilitator ? 'Fasilitator: ' + r.Fasilitator + '\n' : '') +
    (r.Objektif ? '\nObjektif:\n' + r.Objektif + '\n' : '') + '\n';
  return binaDataEvent(tajuk, r.Tarikh, r.Tarikh, r.MasaMula, r.MasaTamat, r.Tempat, ket, r.Panitia, 'MAUVE');
}

function cincangDataEvent(data) {
  const ringkas = JSON.stringify([data.tajuk, data.bermasa, data.mula.getTime(), data.tamat.getTime(), data.keterangan,
    data.tetamu, data.lokasi, data.warna, data.peringatan]);
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ringkas));
}

function kunciCincang(idRekod) { return 'kal_' + idRekod; }

function capMasaKalendar() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuching', 'dd/MM HH:mm');
}

/* ------------------------- BACA EVENT (UNTUK TARIK BALIK) ------------------------- */
function jamMinit(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Kuching', 'HH:mm');
}

function masaEvent(ev) {
  const lokasi = String(ev.getLocation() || '');
  if (ev.isAllDayEvent()) {
    const mula = ev.getAllDayStartDate();
    const tamat = new Date(ev.getAllDayEndDate().getTime() - SEHARI_MS);
    return { semuaHari: true, tarikhMula: formatTarikh(mula), tarikhTamat: formatTarikh(tamat < mula ? mula : tamat),
      masaMula: '', masaTamat: '', lokasi };
  }
  const mula = ev.getStartTime(), tamat = ev.getEndTime();
  return { semuaHari: false, tarikhMula: formatTarikh(mula), tarikhTamat: formatTarikh(tamat),
    masaMula: jamMinit(mula), masaTamat: jamMinit(tamat), lokasi };
}

/* Adakah event di kalendar masih sama dengan data yang kita hantar? */
function eventSamaDenganData(ev, data) {
  const m = masaEvent(ev);
  if (m.lokasi !== data.lokasi) return false;
  if (data.bermasa !== !m.semuaHari) return false;
  if (data.bermasa) return ev.getStartTime().getTime() === data.mula.getTime() && ev.getEndTime().getTime() === data.tamat.getTime();
  return m.tarikhMula === formatTarikh(data.mula) && m.tarikhTamat === formatTarikh(new Date(data.tamat.getTime() - SEHARI_MS));
}

/* Masa/tempat lalai TETAPAN tidak ditulis ke rekod: jika event masih pada nilai lalai, kekal kosong. */
function masaUntukRekod(m, r) {
  if (m.semuaHari) return { mula: '', tamat: '' };
  const lalai = !r.MasaMula && !r.MasaTamat ? masaBerkesan('', '') : null;
  if (lalai && lalai.mula === m.masaMula && lalai.tamat === m.masaTamat) return { mula: '', tamat: '' };
  return { mula: m.masaMula, tamat: m.masaTamat };
}

function lokasiUntukRekod(m, r) {
  if (!r.Tempat && m.lokasi === tetapan('TEMPAT_LALAI')) return '';
  return m.lokasi;
}

function tarikMesyuarat(r, ev) {
  const m = masaEvent(ev), masa = masaUntukRekod(m, r);
  r.TarikhMesyuarat = m.tarikhMula; r.MasaMula = masa.mula; r.MasaTamat = masa.tamat; r.Tempat = lokasiUntukRekod(m, r);
}
function tarikProgram(r, ev) {
  const m = masaEvent(ev), masa = masaUntukRekod(m, r);
  r.TarikhMula = m.tarikhMula; r.TarikhTamat = m.tarikhTamat; r.MasaMula = masa.mula; r.MasaTamat = masa.tamat; r.Tempat = lokasiUntukRekod(m, r);
}
function tarikPLC(r, ev) {
  const m = masaEvent(ev), masa = masaUntukRekod(m, r);
  r.Tarikh = m.tarikhMula; r.MasaMula = masa.mula; r.MasaTamat = masa.tamat; r.Tempat = lokasiUntukRekod(m, r);
}

/* ------------------------- TULIS EVENT ------------------------- */
function selaraskanTetamu(event, senaraiEmel) {
  const semasa = event.getGuestList().map(g => String(g.getEmail()).toLowerCase());
  senaraiEmel.filter(e => semasa.indexOf(e) === -1).forEach(e => event.addGuest(e));
  semasa.filter(e => senaraiEmel.indexOf(e) === -1).forEach(e => event.removeGuest(e));
}

function tulisEvent(kalendar, event, data, tag) {
  if (event) {
    event.setTitle(data.tajuk);
    if (data.bermasa) event.setTime(data.mula, data.tamat); else event.setAllDayDates(data.mula, data.tamat);
    event.setDescription(data.keterangan);
    event.setLocation(data.lokasi);
    selaraskanTetamu(event, data.tetamu);
  } else {
    const pilihan = { description: data.keterangan, location: data.lokasi, guests: data.tetamu.join(','), sendInvites: false };
    event = data.bermasa
      ? kalendar.createEvent(data.tajuk, data.mula, data.tamat, pilihan)
      : kalendar.createAllDayEvent(data.tajuk, data.mula, data.tamat, pilihan);
  }
  try { event.setColor(CalendarApp.EventColor[data.warna]); } catch (e) { /* warna pilihan */ }
  try {
    event.removeAllReminders();
    if (data.peringatan > 0) event.addPopupReminder(data.peringatan);
  } catch (e) { /* peringatan pilihan */ }
  event.setGuestsCanSeeGuests(true);
  event.setTag(TAG_KALENDAR, tag);
  return event;
}

function cariEvent(kalendar, idEvent, petaEvent) {
  if (!idEvent) return null;
  if (petaEvent && petaEvent[idEvent]) return petaEvent[idEvent];
  try { return kalendar.getEventById(idEvent); } catch (e) { return null; }
}

/* Segerak satu rekod (objek r diubah terus: EventIdKalendar, StatusKalendar,
   HashKalendar, dan medan tarikh/masa/Tempat jika ditarik dari kalendar).
   paksa = true bila rekod baru disimpan dari portal (portal menang).
   Pulangkan: 'DIKEMASKINI' | 'SAMA' | 'DITARIK' | 'DIPADAM'. */
function segerakRekodKalendar(kodModul, r, paksa, petaEvent) {
  const m = modulKalendar(kodModul);
  const idRekod = r[m.id];
  const prop = PropertiesService.getScriptProperties();
  const data = m.data(r);
  SEGERAK_TERAKHIR_BERUBAH = false;

  if (!data || (m.batal && m.batal(r))) {
    const status = data ? 'DIBATALKAN' : 'TIADA TARIKH';
    if (!r.EventIdKalendar && r.StatusKalendar === status) return 'SAMA';
    const lama = r.EventIdKalendar ? cariEvent(dapatkanKalendarEBidang(), r.EventIdKalendar, petaEvent) : null;
    if (lama) { try { lama.deleteEvent(); } catch (e) { /* sudah tiada */ } }
    r.EventIdKalendar = ''; r.HashKalendar = ''; r.StatusKalendar = status;
    prop.deleteProperty(kunciCincang(idRekod));
    SEGERAK_TERAKHIR_BERUBAH = true;
    return 'DIPADAM';
  }

  const kalendar = dapatkanKalendarEBidang();
  let event = cariEvent(kalendar, r.EventIdKalendar, petaEvent);
  const hash = cincangDataEvent(data);
  const hashLama = r.HashKalendar || prop.getProperty(kunciCincang(idRekod)) || '';
  const duaHala = tetapanYa('DUA_HALA');

  if (!paksa && hashLama === hash) {
    const dipadamDiKalendar = String(r.StatusKalendar || '').indexOf('DIPADAM DI KALENDAR') === 0;
    if (!event && duaHala && (r.EventIdKalendar || dipadamDiKalendar)) {
      /* Event dipadam terus di Google Calendar — hormati, jangan cipta semula. */
      if (r.EventIdKalendar) {
        r.StatusKalendar = 'DIPADAM DI KALENDAR ' + capMasaKalendar();
        r.EventIdKalendar = '';
        SEGERAK_TERAKHIR_BERUBAH = true;
      }
      return 'SAMA';
    }
    if (event) {
      if (duaHala && !eventSamaDenganData(event, data)) {
        m.tarik(r, event);
        const hashBaharu = cincangDataEvent(m.data(r));
        r.HashKalendar = hashBaharu;
        prop.setProperty(kunciCincang(idRekod), hashBaharu);
        r.StatusKalendar = '⇄ dari kalendar ' + capMasaKalendar();
        SEGERAK_TERAKHIR_BERUBAH = true;
        return 'DITARIK';
      }
      if (!event.getTag(TAG_KALENDAR)) event.setTag(TAG_KALENDAR, kodModul + ':' + idRekod);
      if (!r.HashKalendar) r.HashKalendar = hash;
      if (!r.StatusKalendar) r.StatusKalendar = 'DISEGERAK ' + capMasaKalendar();
      return 'SAMA';
    }
  }

  event = tulisEvent(kalendar, event, data, kodModul + ':' + idRekod);
  r.EventIdKalendar = event.getId();
  r.HashKalendar = hash;
  r.StatusKalendar = 'DISEGERAK ' + capMasaKalendar();
  prop.setProperty(kunciCincang(idRekod), hash);
  SEGERAK_TERAKHIR_BERUBAH = true;
  return 'DIKEMASKINI';
}

/* Dipanggil oleh service semasa simpan — kalendar bukan sumber kebenaran,
   jadi kegagalan (kuota/akses) dicatat dalam StatusKalendar sahaja. */
function segerakKalendarSelamat(kodModul, objek) {
  try {
    segerakRekodKalendar(kodModul, objek, true, null);
  } catch (e) {
    objek.StatusKalendar = 'RALAT: ' + String((e && e.message) || e).slice(0, 120);
  }
  return objek;
}

/* Keserasian dengan kod lama. */
function segerakEventMesyuarat(mesyuarat) { segerakKalendarSelamat('MESYUARAT', mesyuarat); return mesyuarat.EventIdKalendar || ''; }
function segerakEventProgram(program) { segerakKalendarSelamat('PROGRAM', program); return program.EventIdKalendar || ''; }

function padamEventKalendar(idEvent, idRekod) {
  if (idRekod) PropertiesService.getScriptProperties().deleteProperty(kunciCincang(idRekod));
  if (!idEvent) return;
  const event = dapatkanKalendarEBidang().getEventById(idEvent);
  if (event) event.deleteEvent();
}

/* ------------------------- SEGERAK PUKAL (AUTOMATIK) ------------------------- */
/* Dijalankan pencetus automatik, menu Sheet, atau butang "Segerak Sekarang".
   Satu panggilan getEvents() mengambil semua event dalam julat (pantas), kemudian
   setiap rekod dibandingkan. Berhenti sebelum had 6 minit; baki disambung kemudian. */
function segerakSemuaKeKalendar() {
  const masaMula = Date.now();
  const hadMasaMs = 4.5 * 60 * 1000;
  const hasil = { disegerak: 0, ditarik: 0, tidakBerubah: 0, dipadam: 0, yatim: 0, gagal: 0, belumSelesai: false };
  const cache = CacheService.getScriptCache();
  if (cache.get('segerak_kalendar_berjalan')) { hasil.sedangBerjalan = true; return hasil; }
  cache.put('segerak_kalendar_berjalan', '1', 330);

  try {
    MEMO_TETAPAN = null;
    const kalendar = dapatkanKalendarEBidang();
    const awal = new Date(Date.now() - HARI_SEGERAK_KE_BELAKANG * SEHARI_MS);
    const akhir = new Date(Date.now() + HARI_SEGERAK_KE_HADAPAN * SEHARI_MS);
    const sempadan = formatTarikh(awal);
    const petaEvent = {};
    const eventBertag = [];
    kalendar.getEvents(awal, akhir).forEach(ev => {
      petaEvent[ev.getId()] = ev;
      if (ev.getTag(TAG_KALENDAR)) eventBertag.push(ev);
    });
    const idDigunakan = {};

    for (let k = 0; k < SEMUA_MODUL_KALENDAR.length; k++) {
      const kod = SEMUA_MODUL_KALENDAR[k];
      const m = modulKalendar(kod);
      if (!dapatkanSpreadsheet().getSheetByName(m.sheet)) continue;
      const rekod = bacaSheetSebagaiObjek(m.sheet);
      rekod.forEach(r => { if (r.EventIdKalendar) idDigunakan[r.EventIdKalendar] = true; });
      const dalamJulat = rekod.filter(r => !m.tarikh(r) || String(m.tarikh(r)) >= sempadan);
      for (let i = 0; i < dalamJulat.length; i++) {
        if (Date.now() - masaMula > hadMasaMs) { hasil.belumSelesai = true; return hasil; }
        const r = dalamJulat[i];
        const asal = JSON.stringify(r);
        try {
          const keputusan = segerakRekodKalendar(kod, r, false, petaEvent);
          if (keputusan === 'DIKEMASKINI') hasil.disegerak++;
          else if (keputusan === 'DITARIK') hasil.ditarik++;
          else if (keputusan === 'DIPADAM') hasil.dipadam++;
          else hasil.tidakBerubah++;
        } catch (e) {
          hasil.gagal++;
          r.StatusKalendar = 'RALAT: ' + String((e && e.message) || e).slice(0, 120);
        }
        if (r.EventIdKalendar) idDigunakan[r.EventIdKalendar] = true;
        if (JSON.stringify(r) !== asal) {
          try { kemaskiniMedan(m.sheet, r, LAJUR_STATUS_KALENDAR.concat(m.medanTarik)); } catch (e) { hasil.gagal++; }
        }
      }
    }

    /* Event yatim: bertag E-Bidang tetapi rekodnya sudah dipadam dari Sheet. */
    eventBertag.forEach(ev => {
      if (idDigunakan[ev.getId()]) return;
      try { ev.deleteEvent(); hasil.yatim++; } catch (e) { /* abaikan */ }
    });

    PropertiesService.getScriptProperties().setProperty('SYNC_TERAKHIR', formatTarikhMasa(new Date()));
    return hasil;
  } finally {
    cache.remove('segerak_kalendar_berjalan');
  }
}

function apiSegerakKalendar(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const hasil = segerakSemuaKeKalendar();
  if (hasil.sedangBerjalan) return ralat('Segerak automatik sedang berjalan. Cuba lagi dalam beberapa minit.');
  catatAudit(sesi, 'KEMASKINI', 'KALENDAR', '-', 'Segerak pukal Google Calendar: ' + JSON.stringify(hasil));
  return jaya(Object.assign({ idKalendar: idKalendarTersimpan() }, hasil));
}

/* ------------------------- PAPARAN KALENDAR (BULANAN) ------------------------- */
function aktivitiKalendarDaripadaRekod(sesi, awal, akhir) {
  const bolehLihat = pn => bolehLihatPanitia(sesi, pn);
  const dalam = (mula, tamat) => !!mula && String(mula) <= akhir && String(tamat || mula) >= awal;

  const mesyuarat = bacaSheetSebagaiObjek(SHEET_MESYUARAT)
    .filter(m => bolehLihat(m.Panitia) && dalam(m.TarikhMesyuarat, m.TarikhMesyuarat))
    .map(m => ({
      jenis: 'MESYUARAT', id: m.IDMesyuarat, tajuk: m.Tajuk, panitia: m.Panitia, tempat: m.Tempat || '',
      tarikhMula: m.TarikhMesyuarat, tarikhTamat: m.TarikhMesyuarat, masaMula: m.MasaMula || '', masaTamat: m.MasaTamat || '',
      keterangan: m.Agenda || '', disegerak: !!m.EventIdKalendar, statusKalendar: m.StatusKalendar || ''
    }));

  const program = bacaSheetSebagaiObjek(SHEET_PROGRAM)
    .filter(pr => bolehLihat(pr.Panitia) && dalam(pr.TarikhMula, pr.TarikhTamat))
    .map(pr => ({
      jenis: pr.JenisProgram === 'PLC' ? 'PLC' : 'PROGRAM', id: pr.IDProgram, tajuk: pr.NamaProgram, panitia: pr.Panitia,
      tempat: pr.Tempat || '', tarikhMula: pr.TarikhMula, tarikhTamat: pr.TarikhTamat || pr.TarikhMula,
      masaMula: pr.MasaMula || '', masaTamat: pr.MasaTamat || '',
      keterangan: pr.Objektif || '', disegerak: !!pr.EventIdKalendar, statusKalendar: pr.StatusKalendar || ''
    }));

  const plc = dapatkanSpreadsheet().getSheetByName(SHEET_PLC) ? bacaSheetSebagaiObjek(SHEET_PLC)
    .filter(r => r.Status !== 'DIBATALKAN' && bolehLihat(r.Panitia) && dalam(r.Tarikh, r.Tarikh))
    .map(r => ({
      jenis: 'PLC', id: r.IDPLC, tajuk: r.Tajuk, panitia: r.Panitia, tempat: r.Tempat || '',
      tarikhMula: r.Tarikh, tarikhTamat: r.Tarikh, masaMula: r.MasaMula || '', masaTamat: r.MasaTamat || '',
      keterangan: (r.JenisPLC ? r.JenisPLC + '. ' : '') + (r.Objektif || ''),
      disegerak: !!r.EventIdKalendar, statusKalendar: r.StatusKalendar || ''
    })) : [];

  return mesyuarat.concat(program, plc).sort((a, b) =>
    String(a.tarikhMula + a.masaMula).localeCompare(String(b.tarikhMula + b.masaMula)));
}

function apiKalendarAktiviti(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const tahun = Number(p.tahun) || new Date().getFullYear();
  const bulan = Number(p.bulan) || (new Date().getMonth() + 1);
  const awal = tahun + '-' + ('0' + bulan).slice(-2) + '-01';
  const akhir = tahun + '-' + ('0' + bulan).slice(-2) + '-31';

  return jaya({
    tahun, bulan,
    senarai: aktivitiKalendarDaripadaRekod(sesi, awal, akhir),
    idKalendar: idKalendarTersimpan(),
    syncTerakhir: PropertiesService.getScriptProperties().getProperty('SYNC_TERAKHIR') || '',
    duaHala: tetapanYa('DUA_HALA')
  });
}

/* ------------------------- PENCETUS AUTOMATIK ------------------------- */
function pencetusKalendarAktif() {
  try {
    return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === HANDLER_SEGERAK);
  } catch (e) { return false; }
}

/* Pasang (semula) pencetus segerak kalendar + pemanas cache. Selamat diulang. */
function pasangPencetusKalendar() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const h = t.getHandlerFunction();
    if (h === HANDLER_SEGERAK || h === HANDLER_PANAS_CACHE) ScriptApp.deleteTrigger(t);
  });
  const selang = Number(tetapan('SELANG_SYNC_MINIT'));
  const sah = [5, 10, 15, 30].indexOf(selang) !== -1;
  const pembina = ScriptApp.newTrigger(HANDLER_SEGERAK).timeBased();
  if (sah) pembina.everyMinutes(selang).create(); else pembina.everyHours(1).create();
  ScriptApp.newTrigger(HANDLER_PANAS_CACHE).timeBased().everyMinutes(10).create();
  return sah ? selang + ' minit' : '1 jam';
}

function sediakanSegerakKalendarAutomatik() {
  pastikanSheetTetapan();
  const selang = pasangPencetusKalendar();
  const hasil = segerakSemuaKeKalendar();
  paparMesejAdmin(
    'Pencetus automatik diaktifkan:\n' +
    '• Segerak DUA HALA Google Calendar setiap ' + selang + ' (ubah di TETAPAN > SELANG_SYNC_MINIT).\n' +
    '• Pemanas cache setiap 10 minit (portal dibuka lebih pantas).\n\n' +
    'Larian pertama: ' + hasil.disegerak + ' dihantar ke kalendar, ' + hasil.ditarik + ' ditarik dari kalendar, ' +
    hasil.tidakBerubah + ' tidak berubah, ' + hasil.yatim + ' event yatim dipadam, ' + hasil.gagal + ' gagal' +
    (hasil.belumSelesai ? ' (baki disambung pada larian seterusnya)' : '') + '.\n\n' +
    'ID kalendar: ' + idKalendarTersimpan()
  );
}

function segerakKalendarSekarangMenu() {
  const hasil = segerakSemuaKeKalendar();
  if (hasil.sedangBerjalan) { paparMesejAdmin('Segerak automatik sedang berjalan. Cuba lagi dalam beberapa minit.'); return; }
  paparMesejAdmin('Segerak selesai: ' + hasil.disegerak + ' dihantar, ' + hasil.ditarik + ' ditarik dari kalendar, ' +
    hasil.tidakBerubah + ' tidak berubah, ' + hasil.yatim + ' yatim dipadam, ' + hasil.gagal + ' gagal' +
    (hasil.belumSelesai ? ' (belum selesai — jalankan sekali lagi)' : '') + '.');
}

/* Pencetus setiap 10 minit: muat semula cache Sheet kecil supaya log masuk &
   menu pertama tidak perlu membaca Sheet (lebih pantas). */
function panaskanCache() {
  [SHEET_USERS, SHEET_PANITIA, SHEET_KATEGORI_DOKUMEN, SHEET_TETAPAN].forEach(nama => {
    try {
      if (!dapatkanSpreadsheet().getSheetByName(nama)) return;
      batalCacheSheet(nama);
      bacaSheetSebagaiObjek(nama);
    } catch (e) { /* abaikan */ }
  });
}
