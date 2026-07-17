// test/unit/append-photo-form-data.test.ts
//
// appendPhotoToFormData encodes the shared photo field onto a multipart
// submit: a new File is appended as-is; a cleared photo on an edit is sent as
// "" (the API remove signal); otherwise the field is left off entirely.
import { describe, expect, it } from "vitest";
import { appendPhotoToFormData } from "@/components/forms/photo-upload-field";

describe("appendPhotoToFormData", () => {
  it("appends a newly chosen file under the field name", () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const fd = new FormData();
    appendPhotoToFormData(fd, "tourPhoto", {
      value: file,
      existingPhoto: undefined,
      isEdit: false,
      previewUrl: "blob:preview",
    });
    expect(fd.get("tourPhoto")).toBe(file);
  });

  it("sends an empty string when an edit clears an existing photo", () => {
    const fd = new FormData();
    appendPhotoToFormData(fd, "hotelPhoto", {
      value: undefined,
      existingPhoto: "https://cdn/old.png",
      isEdit: true,
      previewUrl: null,
    });
    expect(fd.get("hotelPhoto")).toBe("");
  });

  it("omits the field when creating without a photo", () => {
    const fd = new FormData();
    appendPhotoToFormData(fd, "roomPhoto", {
      value: undefined,
      existingPhoto: undefined,
      isEdit: false,
      previewUrl: null,
    });
    expect(fd.has("roomPhoto")).toBe(false);
  });

  it("leaves an untouched existing photo alone on edit", () => {
    const fd = new FormData();
    appendPhotoToFormData(fd, "roomPhoto", {
      value: undefined,
      existingPhoto: "https://cdn/keep.png",
      isEdit: true,
      previewUrl: "https://cdn/keep.png",
    });
    expect(fd.has("roomPhoto")).toBe(false);
  });
});
