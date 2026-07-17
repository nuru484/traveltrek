// test/component/photo-upload-field.test.tsx
//
// The shared optional-photo control (usePhotoUpload + PhotoUploadField) used by
// the tour, room, and hotel forms: the empty upload button, the preview +
// "Change Photo" swap after a valid pick, and the type/size validation errors.
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import {
  PhotoUploadField,
  usePhotoUpload,
} from "@/components/forms/photo-upload-field";

function Harness({ existingPhoto }: { existingPhoto?: string | null }) {
  const form = useForm<{ photo?: unknown }>({
    defaultValues: { photo: undefined },
  });
  const upload = usePhotoUpload({ form, name: "photo", existingPhoto });
  return (
    <Form {...form}>
      <PhotoUploadField
        control={form.control}
        name="photo"
        label="Photo (Optional)"
        uploadLabel="Upload Photo"
        previewAlt="Photo preview"
        upload={upload}
      />
    </Form>
  );
}

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PhotoUploadField", () => {
  it("shows the upload label and no preview initially", () => {
    render(<Harness />);
    expect(screen.getByText("Upload Photo")).toBeInTheDocument();
    expect(screen.queryByAltText("Photo preview")).not.toBeInTheDocument();
  });

  it("previews a valid image and swaps the button to Change Photo", () => {
    const { container } = render(<Harness />);
    const file = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.change(fileInput(container), { target: { files: [file] } });

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(screen.getByAltText("Photo preview")).toBeInTheDocument();
    expect(screen.getByText("Change Photo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove image" })
    ).toBeInTheDocument();
  });

  it("removing the preview restores the upload button", () => {
    const { container } = render(<Harness />);
    const file = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.change(fileInput(container), { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(screen.queryByAltText("Photo preview")).not.toBeInTheDocument();
    expect(screen.getByText("Upload Photo")).toBeInTheDocument();
  });

  it("rejects a non-image file with a validation message", () => {
    const { container } = render(<Harness />);
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(fileInput(container), { target: { files: [file] } });

    expect(
      screen.getByText("Please select a valid image file")
    ).toBeInTheDocument();
    expect(screen.queryByAltText("Photo preview")).not.toBeInTheDocument();
  });

  it("rejects an image over 5MB", () => {
    const { container } = render(<Harness />);
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(fileInput(container), { target: { files: [big] } });

    expect(
      screen.getByText("Image size should be less than 5MB")
    ).toBeInTheDocument();
  });
});
