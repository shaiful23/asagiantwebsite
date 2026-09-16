/* =========================================================================
 * CalendarService.gs — Penyegerakan Google Calendar bagi tarikh Mesyuarat &
 * Program/PLC panitia. Satu kalendar khusus "E-Bidang Sains & Matematik"
 * dicipta secara automatik (di bawah akaun Google yang men-deploy sistem —
 * sama seperti struktur folder Drive dalam DriveService.gs) jika belum
 * wujud. Kongsikan kalendar ini dengan staf berkenaan selepas dicipta kali
 * pertama (rujuk README.md).
 *
 * Segerak dipanggil dari MeetingService.gs/ProgramService.gs, dibalut
 * try/catch di situ supaya kegagalan Kalendar (kuota/akses) tidak
 * menghalang mesyuarat/program itu sendiri daripada disimpan.
 * ========================================================================= */

const NAMA_KALENDAR_EBIDANG = 'E-Bidang Sains & Matematik';

function dapatkanKalendarEBidang() {
  const sediaAda = CalendarApp.getCalendarsByName(NAMA_KALENDAR_EBIDANG);
  if (sediaAda.length) return sediaAda[0];
  return CalendarApp.createCalendar(NAMA_KALENDAR_EBIDANG);
}

/* Cipta/kemaskini event sehari (all-day) bagi satu Mesyuarat. Pulangkan ID
   event untuk disimpan dalam lajur EventIdKalendar (HEADER_MESYUARAT). */
function segerakEventMesyuarat(mesyuarat) {
  const tarikh = keTarikhObjek(mesyuarat.TarikhMesyuarat);
  if (!tarikh) return '';

  const kalendar = dapatkanKalendarEBidang();
  const tajuk = '[Mesyuarat Panitia ' + mesyuarat.Panitia + '] ' + mesyuarat.Tajuk;

  if (mesyuarat.EventIdKalendar) {
    const eventSediaAda = kalendar.getEventById(mesyuarat.EventIdKalendar);
    if (eventSediaAda) {
      eventSediaAda.setTitle(tajuk);
      eventSediaAda.setAllDayDate(tarikh);
      eventSediaAda.setDescription(mesyuarat.Agenda || '');
      return mesyuarat.EventIdKalendar;
    }
  }
  return kalendar.createAllDayEvent(tajuk, tarikh, { description: mesyuarat.Agenda || '' }).getId();
}

/* Cipta/kemaskini event (satu hari atau julat) bagi satu Program/PLC.
   Pulangkan ID event untuk disimpan dalam lajur EventIdKalendar (HEADER_PROGRAM). */
function segerakEventProgram(program) {
  const mula = keTarikhObjek(program.TarikhMula);
  if (!mula) return '';

  const kalendar = dapatkanKalendarEBidang();
  const tamatMentah = keTarikhObjek(program.TarikhTamat) || mula;
  // createAllDayEvent(start, end) — 'end' EKSKLUSIF, +1 hari supaya hari akhir turut disertakan.
  const tamat = new Date(tamatMentah.getTime() + 24 * 60 * 60 * 1000);
  const tajuk = '[' + (program.JenisProgram === 'PLC' ? 'PLC' : 'Program') + ' ' + program.Panitia + '] ' + program.NamaProgram;

  if (program.EventIdKalendar) {
    const eventSediaAda = kalendar.getEventById(program.EventIdKalendar);
    if (eventSediaAda) {
      eventSediaAda.setTitle(tajuk);
      eventSediaAda.setAllDayDates(mula, tamat);
      eventSediaAda.setDescription(program.Objektif || '');
      return program.EventIdKalendar;
    }
  }
  return kalendar.createAllDayEvent(tajuk, mula, tamat, { description: program.Objektif || '' }).getId();
}

function padamEventKalendar(idEvent) {
  if (!idEvent) return;
  const kalendar = dapatkanKalendarEBidang();
  const event = kalendar.getEventById(idEvent);
  if (event) event.deleteEvent();
}
