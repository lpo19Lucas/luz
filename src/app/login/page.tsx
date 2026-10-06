import LoginForm from "./LoginForm";

const NOTICES = {
  bloqueado: { severity: "warning", text: "Esta conta está bloqueada. Fale com o suporte da Luz." },
  expirada: { severity: "info", text: "Sua sessão expirou porque a senha foi alterada. Entre de novo." },
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find((k) => params[k] !== undefined);
  return <LoginForm notice={key ? NOTICES[key] : null} />;
}
