import { render, screen, fireEvent, act } from "@testing-library/react";
import InstallAppPrompt from "./InstallAppPrompt";

const ANDROID = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1";

type W = Window & { __luzInstallPrompt?: unknown };

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}
function setStandalone(standalone: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({ matches: standalone }) as unknown as typeof window.matchMedia;
}
function fakePrompt(outcome = "accepted") {
  const prompt = jest.fn().mockResolvedValue(undefined);
  return { event: Object.assign(new Event("beforeinstallprompt"), { prompt, userChoice: Promise.resolve({ outcome }) }), prompt };
}

beforeEach(() => {
  setStandalone(false);
  delete (window as W).__luzInstallPrompt;
});

describe("InstallAppPrompt", () => {
  it("regressão: aviso do Chrome capturado ANTES de o botão existir ainda instala em um toque", async () => {
    setUserAgent(ANDROID);
    const { event, prompt } = fakePrompt();
    (window as W).__luzInstallPrompt = event; // o script do <head> guardou
    render(<InstallAppPrompt appName="Luz" variant="sidebar" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Instalar app/ }));
    });
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Instalar app/ })).not.toBeInTheDocument();
  });

  it("aviso que chega depois de montar também é usado", async () => {
    setUserAgent(ANDROID);
    render(<InstallAppPrompt appName="Studio Ana" />);
    const { event, prompt } = fakePrompt();
    act(() => {
      window.dispatchEvent(event);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));
    });
    expect(prompt).toHaveBeenCalled();
  });

  it("sem aviso do navegador, o botão continua e mostra o passo a passo do Android", () => {
    setUserAgent(ANDROID);
    render(<InstallAppPrompt appName="Studio Ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));
    expect(screen.getByText(/menu ⋮/)).toBeInTheDocument();
  });

  it("Samsung Internet tem o caminho próprio", () => {
    setUserAgent(SAMSUNG);
    render(<InstallAppPrompt appName="Studio Ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));
    expect(screen.getByText(/Adicionar página a/)).toBeInTheDocument();
  });

  it("iPhone: mostra o passo a passo do Adicionar à Tela de Início", () => {
    setUserAgent(IPHONE);
    render(<InstallAppPrompt appName="Studio Ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar no iPhone" }));
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
  });

  it("já instalado (aberto pelo ícone): não mostra nada", () => {
    setUserAgent(IPHONE);
    setStandalone(true);
    const { container } = render(<InstallAppPrompt appName="Studio Ana" />);
    expect(container).toBeEmptyDOMElement();
  });
});
