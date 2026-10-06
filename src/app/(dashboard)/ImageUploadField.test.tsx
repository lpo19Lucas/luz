import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImageUploadField from "./ImageUploadField";

// O redimensionamento usa canvas, que o jsdom não tem.
jest.mock("@/lib/imageResize", () => ({
  resizeImageToDataURL: jest.fn().mockResolvedValue("data:image/jpeg;base64,AAAA"),
}));

function hidden(container: HTMLElement, name: string) {
  return container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

describe("ImageUploadField", () => {
  it("sem foto: nada a enviar e nada a remover", () => {
    const { container } = render(<ImageUploadField label="Foto" />);
    expect(hidden(container, "imageData").value).toBe("");
    expect(hidden(container, "removeImage").value).toBe("off");
    expect(screen.getByText("Escolher foto")).toBeInTheDocument();
  });

  it("escolher arquivo preenche a data URL redimensionada", async () => {
    const { container } = render(<ImageUploadField label="Foto" />);
    const file = new File(["x"], "foto.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(hidden(container, "imageData").value).toBe("data:image/jpeg;base64,AAAA"));
    expect(screen.getByText("Trocar foto")).toBeInTheDocument();
  });

  it("remover a foto atual marca removeImage", () => {
    const { container } = render(<ImageUploadField label="Foto" currentUrl="/api/images/abc" />);
    fireEvent.click(screen.getByText("Remover foto"));
    expect(hidden(container, "removeImage").value).toBe("on");
    expect(hidden(container, "imageData").value).toBe("");
  });
});
