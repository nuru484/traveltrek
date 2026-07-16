// Whether an edit-form submit should tell the API to remove the entity's
// current photo: the entity had one, the user cleared the preview, and no
// new file was chosen. Matches the backend contract where the photo field
// sent as an EMPTY STRING on a multipart update nulls the column and deletes
// the old Cloudinary image (omitting the field leaves it untouched).
export const shouldRemovePhoto = (params: {
  existingPhoto: string | null | undefined;
  isEdit: boolean;
  newFile: unknown;
  previewUrl: string | null;
}): boolean =>
  params.isEdit &&
  !!params.existingPhoto &&
  params.previewUrl === null &&
  !params.newFile;
