import { render, screen } from "@testing-library/react";
import CadastroPage from "./page";

// A server action não roda em jsdom — só o formulário importa aqui.
jest.mock("@/lib/actions/auth", () => ({ signupAction: jest.fn() }));

describe("Cadastro", () => {
  it("exige o aceite dos termos e linka os três documentos", () => {
    render(<CadastroPage />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeRequired();
    expect(checkbox).toHaveAttribute("name", "acceptTerms");
    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos");
    expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
    expect(screen.getByRole("link", { name: "Contrato de Licença" })).toHaveAttribute("href", "/contrato");
  });

  it("pede senha com o tamanho mínimo da política", () => {
    render(<CadastroPage />);
    expect(screen.getByLabelText(/Senha/)).toHaveAttribute("minLength", "8");
  });
});
