import {
  buildOwnerManifest,
  buildSalonManifest,
  shortName,
  iconInitial,
  iconColors,
  isIos,
  iosVersion,
  iosSupportsWebPush,
  installHelp,
  LUZ_NAVY,
  LUZ_GOLD,
} from "./pwa";

const IPHONE_17 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
const IPHONE_15 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.7 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

describe("manifests", () => {
  it("app do dono abre na agenda, escopo do site todo", () => {
    const m = buildOwnerManifest();
    expect(m.start_url).toBe("/agenda?source=pwa");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.icons.map((i) => i.sizes)).toEqual(["192x192", "192x192", "512x512", "512x512"]);
    expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("app do estabelecimento usa nome, cor e escopo do salão", () => {
    const m = buildSalonManifest({ name: "Studio Beleza Nova", slug: "studio-beleza-nova", primaryColor: "#7A1F5C" });
    expect(m.name).toBe("Studio Beleza Nova");
    expect(m.short_name).toBe("Studio");
    expect(m.start_url).toBe("/studio-beleza-nova?source=pwa");
    expect(m.scope).toBe("/studio-beleza-nova");
    expect(m.theme_color).toBe("#7A1F5C");
    expect(m.icons[0].src).toBe("/pwa-icon?salon=studio-beleza-nova&size=192");
  });

  it("cor inválida cai no navy da Luz", () => {
    expect(buildSalonManifest({ name: "X", slug: "x", primaryColor: "vermelho" }).theme_color).toBe(LUZ_NAVY);
  });
});

describe("helpers de ícone", () => {
  it("shortName mantém nomes curtos e corta os longos", () => {
    expect(shortName("Barbearia DG")).toBe("Barbearia DG");
    expect(shortName("Espaço Cabelo & Cia Ltda")).toBe("Espaço");
    expect(shortName("Supercalifragilístico")).toBe("Supercalifra");
  });

  it("iconInitial ignora acento e símbolo", () => {
    expect(iconInitial("Ébano Studio")).toBe("E");
    expect(iconInitial("  @studio")).toBe("S");
    expect(iconInitial("***")).toBe("L");
  });

  it("iconColors com fallback", () => {
    expect(iconColors("#112233", "#445566")).toEqual({ background: "#112233", foreground: "#445566" });
    expect(iconColors(null, "x")).toEqual({ background: LUZ_NAVY, foreground: LUZ_GOLD });
  });
});

describe("detecção de iOS", () => {
  it("reconhece iPhone e iPad em modo desktop", () => {
    expect(isIos(IPHONE_17)).toBe(true);
    expect(isIos(IPAD_DESKTOP_UA, 5)).toBe(true);
    expect(isIos(IPAD_DESKTOP_UA, 0)).toBe(false); // Mac de verdade
    expect(isIos(ANDROID)).toBe(false);
  });

  it("push só a partir do iOS 16.4", () => {
    expect(iosVersion(IPHONE_17)).toBeCloseTo(17.02);
    expect(iosSupportsWebPush(IPHONE_17)).toBe(true);
    expect(iosSupportsWebPush(IPHONE_15)).toBe(false);
    expect(iosSupportsWebPush("iPhone OS 16_4")).toBe(true);
    expect(iosSupportsWebPush("iPhone OS 16_3")).toBe(false);
  });
});

describe("installHelp", () => {
  const ua = {
    iphoneSafari: IPHONE_17,
    iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 CriOS/129.0 Mobile/15E148 Safari/604.1",
    android: ANDROID,
    samsung: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
    edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0",
    chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36",
    firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    macSafari: IPAD_DESKTOP_UA,
  };

  it("escolhe o caminho certo por navegador", () => {
    expect(installHelp(ua.iphoneSafari).platform).toBe("iPhone");
    expect(installHelp(ua.iphoneChrome).steps.join(" ")).toContain("abra este mesmo link no Safari");
    expect(installHelp(ua.android).steps.join(" ")).toContain("Instalar app");
    expect(installHelp(ua.samsung).platform).toBe("Samsung Internet");
    expect(installHelp(ua.edge).platform).toBe("Edge");
    expect(installHelp(ua.chrome).platform).toBe("Chrome");
    expect(installHelp(ua.firefox).steps[0]).toContain("não instala");
    expect(installHelp(ua.macSafari, 0).platform).toBe("Safari (Mac)");
    expect(installHelp(ua.macSafari, 5).platform).toBe("iPhone"); // iPad em modo desktop
  });
});
