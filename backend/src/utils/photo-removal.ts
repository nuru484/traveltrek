// src/utils/photo-removal.ts
//
// Wire semantics for photo/profilePicture fields on multipart UPDATE
// endpoints, shared by every image-bearing domain:
//   field omitted    → undefined — leave the column untouched
//   field ''         → remove    — null the column; the service then deletes
//                                  the old image from Cloudinary (best-effort)
//   field URL string → replace   — written by the upload middleware after a
//                                  file upload (never client-typed for the
//                                  photo domains; see each validation file)

/** Maps the wire value to the Prisma column value (see semantics above). */
export const photoColumnValue = (
  value: string | undefined,
): null | string | undefined => (value === '' ? null : value);
