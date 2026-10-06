/** Regra única de senha — cadastro, redefinição, troca e convite. */
export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirmation?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (confirmation !== undefined && password !== confirmation) {
    return "As senhas não conferem.";
  }
  return null;
}
