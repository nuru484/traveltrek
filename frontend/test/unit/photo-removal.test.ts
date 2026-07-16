// The remove-photo derivation shared by every edit form: only an edit of an
// entity that HAD a photo, whose preview was cleared without picking a new
// file, produces the empty-string removal signal.
import { describe, expect, it } from "vitest";
import { shouldRemovePhoto } from "@/utils/photo-removal";

const base = {
  existingPhoto: "https://res.cloudinary.com/x/old.png",
  isEdit: true,
  newFile: undefined,
  previewUrl: null,
};

describe("shouldRemovePhoto", () => {
  it("is true when an edit cleared an existing photo with no new file", () => {
    expect(shouldRemovePhoto(base)).toBe(true);
  });

  it("is false on create", () => {
    expect(shouldRemovePhoto({ ...base, isEdit: false })).toBe(false);
  });

  it("is false when the entity never had a photo", () => {
    expect(shouldRemovePhoto({ ...base, existingPhoto: null })).toBe(false);
    expect(shouldRemovePhoto({ ...base, existingPhoto: undefined })).toBe(
      false
    );
  });

  it("is false when the preview still shows an image", () => {
    expect(
      shouldRemovePhoto({ ...base, previewUrl: base.existingPhoto })
    ).toBe(false);
    expect(shouldRemovePhoto({ ...base, previewUrl: "blob:new" })).toBe(false);
  });

  it("is false when a new file replaces the photo instead", () => {
    expect(
      shouldRemovePhoto({ ...base, newFile: new Blob(["x"]) })
    ).toBe(false);
  });
});
