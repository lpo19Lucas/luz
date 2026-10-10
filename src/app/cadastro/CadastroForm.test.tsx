import { render, screen } from "@testing-library/react";
import CadastroPage from "./CadastroForm";

// A server action não roda em jsdom — só o formulário importa aqui.
jest.mock("@/lib/actions/auth", () => ({ signupAction: jest.fn() }));

describe("Cadastro", () => {
  it("exige o aceite dos termos e linka os três documentos", () => {
    render(<CadastroPage />);
    const checkbox = screen.getByRole("checkbox", { name: /Li e aceito/ });
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

describe("Cadastro por segmento", () => {
  it("usa o vocabulário do segmento recebido pela página de venda", () => {
    render(<CadastroPage initialSegment="manicure" />);
    expect(screen.getByRole("heading", { name: "Criar estúdio" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do estúdio/)).toBeInTheDocument();
  });

  it("sem segmento, começa como barbearia e oferece os serviços de exemplo marcados", () => {
    render(<CadastroPage />);
    expect(screen.getByRole("heading", { name: "Criar barbearia" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /serviços de exemplo/i })).toBeChecked();
  });
});
