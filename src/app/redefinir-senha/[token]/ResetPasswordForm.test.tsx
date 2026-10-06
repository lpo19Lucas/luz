import { render, screen } from "@testing-library/react";
import ResetPasswordForm from "./ResetPasswordForm";

jest.mock("@/lib/actions/password", () => ({ resetPasswordAction: jest.fn() }));

describe("ResetPasswordForm", () => {
  it("leva o token escondido e pede senha + confirmação", () => {
    const { container } = render(<ResetPasswordForm token="abc123" requireTerms={false} />);
    expect(container.querySelector('input[name="token"]')).toHaveValue("abc123");
    expect(screen.getByLabelText(/Nova senha/)).toBeRequired();
    expect(screen.getByLabelText(/Repita a nova senha/)).toBeRequired();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("no convite de conta sem aceite, exige os termos", () => {
    render(<ResetPasswordForm token="abc123" requireTerms />);
    expect(screen.getByRole("checkbox")).toBeRequired();
    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos");
  });
});
