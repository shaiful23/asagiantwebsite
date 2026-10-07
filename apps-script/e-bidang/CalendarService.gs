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

/* Cipta/kemaskini event bagi satu Mesyuarat. Jika MasaMula & MasaTamat kedua-duanya
   diisi, event dicipta BERMASA (bukan sehari penuh); jika tidak, sehari penuh (all-day)
   seperti sebelum ini — supaya rekod lama (tiada masa) kekal serasi. Pulangkan ID
   event untuk disimpan dalam lajur EventIdKalendar (HEADER_MESYUARAT). */
function segerakEventMesyuarat(mesyuarat) {
  const tarikh = keTarikhObjek(mesyuarat.TarikhMesyuarat);
  if (!tarikh) return '';

  const kalendar = dapatkanKalendarEBidang();
  const tajuk = '[Mesyuarat Panitia ' + mesyuarat.Panitia + '] ' + mesyuarat.Tajuk;
  const gunaMasa = !!(mesyuarat.MasaMula && mesyuarat.MasaTamat);
  const mula = gunaMasa ? gabungTarikhMasa(tarikh, mesyuarat.MasaMula) : tarikh;
  const tamat = gunaMasa ? gabungTarikhMasa(tarikh, mesyuarat.MasaTamat) : null;

  if (mesyuarat.EventIdKalendar) {
    const eventSediaAda = kalendar.getEventById(mesyuarat.EventIdKalendar);
    if (eventSediaAda) {
      eventSediaAda.setTitle(tajuk);
      if (gunaMasa) eventSediaAda.setTime(mula, tamat); else eventSediaAda.setAllDayDate(tarikh);
      eventSediaAda.setDescription(mesyuarat.Agenda || '');
      return mesyuarat.EventIdKalendar;
    }
  }
  return (gunaMasa
    ? kalendar.createEvent(tajuk, mula, tamat, { description: mesyuarat.Agenda || '' })
    : kalendar.createAllDayEvent(tajuk, tarikh, { description: mesyuarat.Agenda || '' })
  ).getId();
}

/* Cipta/kemaskini event bagi satu Program/PLC. Jika MasaMula & MasaTamat kedua-duanya
   diisi, event dicipta BERMASA (Masa Mula pada TarikhMula, Masa Tamat pada TarikhTamat
   — boleh merentasi > 1 hari); jika tidak, sehari/julat penuh (all-day) seperti sebelum
   ini. Pulangkan ID event untuk disimpan dalam lajur EventIdKalendar (HEADER_PROGRAM). */
function segerakEventProgram(program) {
  const mula = keTarikhObjek(program.TarikhMula);
  if (!mula) return '';

  const kalendar = dapatkanKalendarEBidang();
  const tamatMentah = keTarikhObjek(program.TarikhTamat) || mula;
  const tajuk = '[' + (program.JenisProgram === 'PLC' ? 'PLC' : 'Program') + ' ' + program.Panitia + '] ' + program.NamaProgram;
  const gunaMasa = !!(program.MasaMula && program.MasaTamat);
  const mulaEvent = gunaMasa ? gabungTarikhMasa(mula, program.MasaMula) : mula;
  // all-day createAllDayEvent(start, end) — 'end' EKSKLUSIF, +1 hari supaya hari akhir turut disertakan.
  const tamatEvent = gunaMasa ? gabungTarikhMasa(tamatMentah, program.MasaTamat) : new Date(tamatMentah.getTime() + 24 * 60 * 60 * 1000);

  if (program.EventIdKalendar) {
    const eventSediaAda = kalendar.getEventById(program.EventIdKalendar);
    if (eventSediaAda) {
      eventSediaAda.setTitle(tajuk);
      if (gunaMasa) eventSediaAda.setTime(mulaEvent, tamatEvent); else eventSediaAda.setAllDayDates(mulaEvent, tamatEvent);
      eventSediaAda.setDescription(program.Objektif || '');
      return program.EventIdKalendar;
    }
  }
  return (gunaMasa
    ? kalendar.createEvent(tajuk, mulaEvent, tamatEvent, { description: program.Objektif || '' })
    : kalendar.createAllDayEvent(tajuk, mulaEvent, tamatEvent, { description: program.Objektif || '' })
  ).getId();
}

function padamEventKalendar(idEvent) {
  if (!idEvent) return;
  const kalendar = dapatkanKalendarEBidang();
  const event = kalendar.getEventById(idEvent);
  if (event) event.deleteEvent();
}
