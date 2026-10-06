import { render, screen, fireEvent, act } from "@testing-library/react";
import InstallAppPrompt from "./InstallAppPrompt";

const ANDROID = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}
function setStandalone(standalone: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({ matches: standalone }) as unknown as typeof window.matchMedia;
}

beforeEach(() => setStandalone(false));

describe("InstallAppPrompt", () => {
  it("Android sem o evento de instalação: não mostra nada", () => {
    setUserAgent(ANDROID);
    const { container } = render(<InstallAppPrompt appName="Studio Ana" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Android com beforeinstallprompt: botão chama o prompt nativo", async () => {
    setUserAgent(ANDROID);
    render(<InstallAppPrompt appName="Studio Ana" />);
    const prompt = jest.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt"), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText(/Instale o app Studio Ana/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));
    });
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
  });

  it("iPhone: mostra o passo a passo do Adicionar à Tela de Início", () => {
    setUserAgent(IPHONE);
    render(<InstallAppPrompt appName="Studio Ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar no iPhone" }));
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
  });

  it("já instalado (standalone): não mostra nada", () => {
    setUserAgent(IPHONE);
    setStandalone(true);
    const { container } = render(<InstallAppPrompt appName="Studio Ana" />);
    expect(container).toBeEmptyDOMElement();
  });
});
