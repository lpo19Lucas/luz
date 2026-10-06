import { whatsappReminderText, whatsappReminderLink } from "./whatsappReminder";

const appt = {
  accessToken: "tok123",
  status: "CONFIRMED",
  startAt: new Date("2026-10-10T13:00:00Z"),
  client: { name: "Bia Lima", phone: "(11) 98888-7777" },
  service: { name: "Corte" },
  professionalName: "João",
  salon: { name: "Studio Ana", slug: "studio-ana" },
};

describe("lembrete manual por WhatsApp", () => {
  it("abre o WhatsApp do cliente (com 55) e a mensagem pronta", () => {
    const url = new URL(whatsappReminderLink(appt));
    expect(url.origin + url.pathname).toBe("https://wa.me/5511988887777");
    const text = url.searchParams.get("text")!;
    expect(text).toMatch(/^Olá, Bia! Passando para lembrar do seu Corte com João no Studio Ana/);
    expect(text).toContain("10:00");
    expect(text).toContain("/studio-ana/agendamento/tok123");
    expect(text).toContain("remarcar ou cancelar");
  });

  it("pede confirmação quando o agendamento aguarda presença", () => {
    const text = whatsappReminderText({
      clientName: "Bia",
      salonName: "Studio Ana",
      serviceName: "Corte",
      professionalName: "João",
      startAt: appt.startAt,
      manageUrl: "https://x/y",
      askConfirmation: true,
    });
    expect(text).toContain("Pode confirmar sua presença por aqui? https://x/y");
  });
});
