import { render, screen } from "@testing-library/react";
import AddToCalendarButtons from "./AddToCalendarButtons";

describe("AddToCalendarButtons", () => {
  it("mostra Google (nova aba) e .ics (download)", () => {
    render(
      <AddToCalendarButtons
        links={{ googleUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE", icsUrl: "/api/appointments/t/ics" }}
        note="Lembrete 2h antes"
      />
    );
    const google = screen.getByRole("link", { name: "Google Agenda" });
    expect(google).toHaveAttribute("href", "https://calendar.google.com/calendar/render?action=TEMPLATE");
    expect(google).toHaveAttribute("target", "_blank");
    const ics = screen.getByRole("link", { name: /\.ics/ });
    expect(ics).toHaveAttribute("href", "/api/appointments/t/ics");
    expect(ics).toHaveAttribute("download", "agendamento.ics");
    expect(screen.getByText("Lembrete 2h antes")).toBeInTheDocument();
  });
});
