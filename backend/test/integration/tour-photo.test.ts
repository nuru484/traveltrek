// test/integration/tour-photo.test.ts
//
// The tour cover-photo pipeline (mirrors the hotel/flight photo flow):
// multer single('tourPhoto') → photo file guard → zod → conditional
// Cloudinary upload → handler, with replacement/orphan cleanup through the
// injected cloudinary dep. Cloudinary is faked in test/setup.ts — uploads
// mint fake secure_urls and deleteImage records reclaimed images.
import { describe, expect, it, vi } from 'vitest';

import { cloudinaryService } from '#config/claudinary.js';

import { authedApi } from '../helpers/auth.js';
import { createAdmin, createDestination } from '../helpers/factories.js';

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

// The mocked service method is a vi.fn() (test/setup.ts fakes Cloudinary), so
// the unbound reference is safe — there is no `this` to lose.
// eslint-disable-next-line @typescript-eslint/unbound-method
const deleteImageMock = vi.mocked(cloudinaryService.deleteImage);

const tourFields = (destinationId: number) => ({
  description: 'Seven days across the Volta highlands',
  destinationId: String(destinationId),
  endDate: '2027-03-08',
  maxGuests: '12',
  name: 'Volta Highlands Trek',
  price: '95000',
  startDate: '2027-03-01',
  type: 'ADVENTURE',
});

/** Multipart create with an attached tourPhoto file. */
const createTourWithPhoto = async (
  admin: Awaited<ReturnType<typeof createAdmin>>,
) => {
  const destination = await createDestination();
  let req = authedApi(admin)
    .post('/api/v1/tours')
    .attach('tourPhoto', PNG, { contentType: 'image/png', filename: 'a.png' });
  for (const [key, value] of Object.entries(tourFields(destination.id))) {
    req = req.field(key, value);
  }
  return req;
};

describe('tour photo pipeline', () => {
  it('uploads a multipart tourPhoto and stores the Cloudinary URL', async () => {
    const admin = await createAdmin();

    const res = await createTourWithPhoto(admin);

    expect(res.status).toBe(201);
    expect(res.body.data.photo).toMatch(
      /^https:\/\/res\.cloudinary\.com\/test\//,
    );
  });

  it('rejects a non-image tourPhoto file with a field error', async () => {
    const admin = await createAdmin();
    const destination = await createDestination();

    let req = authedApi(admin)
      .post('/api/v1/tours')
      .attach('tourPhoto', Buffer.from('plain text'), {
        contentType: 'text/plain',
        filename: 'notes.txt',
      });
    for (const [key, value] of Object.entries(tourFields(destination.id))) {
      req = req.field(key, value);
    }
    const res = await req;

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain(
      'Tour photo must be a valid image file',
    );
  });

  it('accepts a plain tourPhoto URL in a JSON body', async () => {
    const admin = await createAdmin();
    const destination = await createDestination();

    const res = await authedApi(admin)
      .post('/api/v1/tours')
      .send({
        description: 'Seven days across the Volta highlands',
        destinationId: destination.id,
        endDate: '2027-03-08',
        maxGuests: 12,
        name: 'Volta Highlands Trek',
        price: 95000,
        startDate: '2027-03-01',
        tourPhoto: 'https://example.com/tour.jpg',
        type: 'ADVENTURE',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.photo).toBe('https://example.com/tour.jpg');
  });

  it('replaces the photo on update and cleans up the old image', async () => {
    const admin = await createAdmin();
    const created = await createTourWithPhoto(admin);
    const oldPhoto: string = created.body.data.photo;

    deleteImageMock.mockClear();

    const updated = await authedApi(admin)
      .put(`/api/v1/tours/${created.body.data.id}`)
      .attach('tourPhoto', PNG, {
        contentType: 'image/png',
        filename: 'b.png',
      })
      .field('name', 'Volta Highlands Trek (Refreshed)');

    expect(updated.status).toBe(200);
    expect(updated.body.data.photo).toMatch(
      /^https:\/\/res\.cloudinary\.com\/test\//,
    );
    expect(updated.body.data.photo).not.toBe(oldPhoto);
    // The replaced image is reclaimed via the injected cloudinary dep.
    expect(deleteImageMock).toHaveBeenCalledWith(oldPhoto);
  });

  it('cleans up the fresh upload when the update is refused', async () => {
    const admin = await createAdmin();
    deleteImageMock.mockClear();

    const res = await authedApi(admin)
      .put('/api/v1/tours/999999')
      .attach('tourPhoto', PNG, {
        contentType: 'image/png',
        filename: 'c.png',
      })
      .field('name', 'Ghost Tour');

    expect(res.status).toBe(404);
    // The freshly uploaded image was orphan-cleaned before rethrowing.
    expect(deleteImageMock).toHaveBeenCalledTimes(1);
  });

  it('deletes the photo from Cloudinary when the tour is deleted', async () => {
    const admin = await createAdmin();
    const created = await createTourWithPhoto(admin);
    const photo: string = created.body.data.photo;

    deleteImageMock.mockClear();

    const res = await authedApi(admin).delete(
      `/api/v1/tours/${created.body.data.id}`,
    );

    expect(res.status).toBe(200);
    expect(deleteImageMock).toHaveBeenCalledWith(photo);
  });
});
