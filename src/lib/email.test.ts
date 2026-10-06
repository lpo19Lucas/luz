import { sendEmail, passwordResetEmail, isEmailConfigured } from "./email";

const message = { to: "dono@teste.com", subject: "Assunto", html: "<p>oi</p>", text: "oi" };

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  jest.restoreAllMocks();
});

describe("sendEmail", () => {
  it("sem RESEND_API_KEY não chama a API e devolve delivered=false", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    jest.spyOn(console, "info").mockImplementation(() => {});
    expect(isEmailConfigured()).toBe(false);
    expect(await sendEmail(message)).toEqual({ delivered: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("com a chave, chama o Resend com remetente e destinatário", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    process.env.EMAIL_FROM = "Luz <nao-responda@luz.app>";
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy as unknown as typeof fetch;

    expect(await sendEmail(message)).toEqual({ delivered: true });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_teste");
    const body = JSON.parse(init.body);
    expect(body.from).toBe("Luz <nao-responda@luz.app>");
    expect(body.to).toEqual(["dono@teste.com"]);
  });

  it("erro da API vira delivered=false (não derruba o fluxo)", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "erro" }) as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendEmail(message)).toEqual({ delivered: false });
  });
});

describe("passwordResetEmail", () => {
  it("leva o link e escapa HTML no nome", () => {
    const email = passwordResetEmail({ name: "<b>Ana</b> Souza", link: "https://luz.app/redefinir-senha/abc", expiresInLabel: "1 hora" });
    expect(email.text).toContain("https://luz.app/redefinir-senha/abc");
    expect(email.html).toContain('href="https://luz.app/redefinir-senha/abc"');
    expect(email.html).not.toContain("<b>Ana</b>");
    expect(email.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  });
});
