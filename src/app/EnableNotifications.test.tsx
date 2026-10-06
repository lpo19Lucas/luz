import { render, screen, waitFor } from "@testing-library/react";
import EnableNotifications from "./EnableNotifications";
import { urlBase64ToUint8Array } from "@/lib/pwa";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1";
const OLD_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Version/15.7 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

describe("EnableNotifications", () => {
  it("iPhone sem o app instalado: explica que precisa instalar", async () => {
    setUserAgent(IPHONE);
    render(<EnableNotifications />);
    expect(await screen.findByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar notificações" })).not.toBeInTheDocument();
  });

  it("iPhone antigo: avisa que não há suporte", async () => {
    setUserAgent(OLD_IPHONE);
    render(<EnableNotifications />);
    expect(await screen.findByText(/iOS 16.4/)).toBeInTheDocument();
  });

  it("navegador sem Push API (jsdom): não mostra nada", async () => {
    setUserAgent(CHROME);
    const { container } = render(<EnableNotifications />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodifica base64url com e sem padding", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("_-8"))).toEqual([255, 239]);
  });
});
