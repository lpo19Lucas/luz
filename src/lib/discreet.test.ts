import { isDiscreetSalon, yourAppointment } from "./discreet";
import { appointmentCalendarEvent } from "./calendarLinks";
import { whatsappReminderText } from "./whatsappReminder";

const startAt = new Date("2026-10-12T13:00:00Z");

function appt(segment: string) {
  return {
    startAt,
    endAt: new Date("2026-10-12T13:50:00Z"),
    id: "a1",
    accessToken: "tok",
    status: "CONFIRMED",
    rescheduledCount: 0,
    service: { name: "Sessão de terapia" },
    professional: { name: "Dra. Ana" },
    client: { name: "Maria Silva" },
    salon: {
      name: "Espaço Calma",
      slug: "espaco-calma",
      segment,
      whatsappPhone: null,
      addressStreet: null,
      addressNumber: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
    },
  };
}

const leaks = (text: string) => /terapia|Ana/.test(text);

describe("modo discreto", () => {
  it("vale pra saúde e podologia, não pra barbearia", () => {
    expect(isDiscreetSalon({ segment: "psicologo" })).toBe(true);
    expect(isDiscreetSalon({ segment: "dentista" })).toBe(true);
    expect(isDiscreetSalon({ segment: "podologa" })).toBe(true);
    expect(isDiscreetSalon({ segment: "barbearia" })).toBe(false);
    expect(isDiscreetSalon({})).toBe(false);
    expect(yourAppointment(true, "Corte")).toBe("seu horário");
    expect(yourAppointment(false, "Corte")).toBe("seu Corte");
  });

  it("evento de agenda não cita serviço nem profissional", () => {
    const ev = appointmentCalendarEvent(appt("psicologo"));
    expect(leaks(ev.title + ev.description)).toBe(false);
    expect(ev.title).toContain("Espaço Calma");

    const normal = appointmentCalendarEvent(appt("barbearia"));
    expect(normal.title).toContain("Sessão de terapia");
  });


  it("lembrete manual de WhatsApp não cita serviço nem profissional", () => {
    const base = {
      clientName: "Maria Silva",
      salonName: "Espaço Calma",
      serviceName: "Sessão de terapia",
      professionalName: "Dra. Ana",
      startAt,
      manageUrl: "https://x/y",
      askConfirmation: false,
    };
    expect(leaks(whatsappReminderText({ ...base, discreet: true }))).toBe(false);
    expect(whatsappReminderText({ ...base, discreet: false })).toContain("Sessão de terapia");
  });
});
