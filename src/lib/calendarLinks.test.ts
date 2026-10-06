import {
  appointmentCalendarEvent,
  buildIcs,
  calendarLinksFor,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
} from "./calendarLinks";

const salon = {
  name: "Studio Ana; Beleza",
  slug: "studio-ana",
  whatsappPhone: "11988887777",
  addressStreet: "Rua das Flores",
  addressNumber: "10",
  addressNeighborhood: "Centro",
  addressCity: "São Paulo",
  addressState: "SP",
};

function appt(overrides: Partial<Parameters<typeof calendarLinksFor>[0]> = {}) {
  return {
    id: "appt1",
    accessToken: "tok123",
    status: "CONFIRMED",
    startAt: new Date("2026-10-10T13:00:00Z"), // 10h em Brasília
    endAt: new Date("2026-10-10T13:30:00Z"),
    rescheduledCount: 0,
    service: { name: "Corte, escova" },
    professional: { name: "João" },
    salon,
    ...overrides,
  };
}

const now = new Date("2026-10-06T12:00:00Z");

describe("googleCalendarUrl", () => {
  it("preenche título, horário em UTC, local e o link de gerenciar", () => {
    const url = new URL(googleCalendarUrl(appointmentCalendarEvent(appt())));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Corte, escova — Studio Ana; Beleza");
    expect(url.searchParams.get("dates")).toBe("20261010T130000Z/20261010T133000Z");
    expect(url.searchParams.get("location")).toBe("Studio Ana; Beleza, Rua das Flores, 10 · Centro — São Paulo/SP");
    expect(url.searchParams.get("details")).toContain("/studio-ana/agendamento/tok123");
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(appointmentCalendarEvent(appt({ rescheduledCount: 2 })), now);

  it("é um VCALENDAR válido com CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("UID fixo e SEQUENCE = remarcações (agendas substituem o evento antigo)", () => {
    expect(ics).toContain("UID:appt1@luz-agendamento\r\n");
    expect(ics).toContain("SEQUENCE:2\r\n");
    expect(ics).toContain("DTSTART:20261010T130000Z\r\n");
    expect(ics).toContain("DTEND:20261010T133000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261006T120000Z\r\n");
  });

  it("escapa ; e , no texto e tem lembrete de 2h", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("SUMMARY:Corte\\, escova — Studio Ana\\; Beleza");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("nenhuma linha passa de 75 bytes", () => {
    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("cancelado sai como CANCELLED e sem lembrete", () => {
    const cancelled = buildIcs(appointmentCalendarEvent(appt({ status: "CANCELLED" })), now);
    expect(cancelled).toContain("STATUS:CANCELLED");
    expect(cancelled).not.toContain("VALARM");
  });
});

describe("helpers de texto", () => {
  it("escapeIcsText", () => {
    expect(escapeIcsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("foldIcsLine não quebra caractere acentuado no meio", () => {
    const line = `DESCRIPTION:${"ã".repeat(100)}`;
    const folded = foldIcsLine(line);
    for (const part of folded.split("\r\n")) {
      expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
      expect(part).not.toContain("�");
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("calendarLinksFor", () => {
  it("devolve os links pra agendamento ativo e futuro", () => {
    const links = calendarLinksFor(appt({ status: "AWAITING_CONFIRMATION" }), now);
    expect(links?.icsUrl).toBe("/api/appointments/tok123/ics");
    expect(links?.googleUrl).toMatch(/^https:\/\/calendar\.google\.com/);
  });

  it("null pra cancelado, concluído ou que já passou", () => {
    expect(calendarLinksFor(appt({ status: "CANCELLED" }), now)).toBeNull();
    expect(calendarLinksFor(appt({ status: "COMPLETED" }), now)).toBeNull();
    expect(calendarLinksFor(appt(), new Date("2026-10-11T00:00:00Z"))).toBeNull();
  });
});
