// src/services/customer.service.ts
//
// Customers domain logic (Phase 5b): the product owner's design keeps
// customers separate from staff, so an admin can open a customer profile and
// see "his details and everything" — the full identity plus the COMPLETE
// (paginated) booking and payment history, not just a recent-N slice.
//
// Pure, DI'd functions: they take typed inputs, own every Prisma access and
// domain invariant (email/phone uniqueness, delete guards, Cloudinary picture
// cleanup), throw the typed CustomError subclasses and never touch req/res.
// Credentials are OUT of scope here: staff never set or change a customer's
// password (creation is passwordless; rotation happens only through the
// authenticated POST /auth/change-password).
//
// Authorization: routes gate the broad role sets; the self-vs-others rule
// lives here as an explicit actor check. A CUSTOMER actor may only touch
// their own profile/history; ADMIN/AGENT staff may touch anyone. The actor's
// `kind` matters — customer and staff ids overlap across the two tables, so
// "self" only ever means a customer principal with the same id.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import {
  BookingStatus,
  PaymentStatus,
  type Prisma,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import { type PrincipalKind } from '#types/auth.types.js';
import { UserRole } from '#types/user-profile.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import { assertContactFreeAcrossPrincipals } from '#utils/cross-principal-contact.js';
import {
  bookingInclude,
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';
import {
  customerSelect,
  type SafeCustomer,
} from '#utils/mappers/customer.mapper.js';
import {
  paymentInclude,
  type PaymentWithRelations,
} from '#utils/mappers/payment.mapper.js';
import { photoColumnValue } from '#utils/photo-removal.js';

export interface CustomerActor {
  id: number;
  kind: PrincipalKind;
  role: UserRole;
}

/** NO password: staff-created customers start passwordless (OTP login /
 * forgot-password establish one) — the zod schema strips any sent value. */
export interface CustomerCreateInput {
  address?: string;
  email?: string;
  name: string;
  phone?: string;
  profilePicture?: string;
}

export interface CustomerDeleteSummary {
  /** Null for phone-only accounts (email is a nullable column). */
  email: null | string;
  name: string;
}

export interface CustomerListParams {
  limit: number;
  page: number;
  search?: string;
}

export interface CustomerProfile {
  customer: SafeCustomer;
  stats: CustomerProfileStats;
}

/** The lifetime-activity block of GET /customers/:id — see the mapper
 * (CustomerProfileDTO) for the per-field wire documentation. */
export interface CustomerProfileStats {
  averageBookingValue: null | number;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  favoriteDestination: null | { id: number; name: string };
  lastBookingAt: Date | null;
  memberSince: Date;
  signupMethod: 'email' | 'google' | 'phone';
  totalBookings: number;
  totalPayments: number;
  totalSpent: number;
  upcomingTrips: number;
}

/** NO password: profile updates never touch credentials — passwords rotate
 * only through the authenticated POST /auth/change-password. */
export interface CustomerUpdateInput {
  address?: string;
  email?: string;
  name?: string;
  phone?: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  profilePicture?: string;
}

export interface HistoryParams {
  limit: number;
  page: number;
}

/** May the actor read/write this customer? Self (a CUSTOMER principal with
 * the same id) always; ADMIN/AGENT staff anyone. */
const canTouchCustomer = (actor: CustomerActor, customerId: number): boolean =>
  (actor.kind === 'customer' && actor.id === customerId) ||
  actor.role === UserRole.ADMIN ||
  actor.role === UserRole.AGENT;

export const makeCustomerService = (
  d: Pick<AppDeps, 'clock' | 'cloudinary' | 'logger' | 'prisma'>,
) => {
  const { clock, cloudinary, logger, prisma } = d;

  /** Best-effort Cloudinary delete; a cleanup failure never fails the request. */
  const cleanupPicture = async (
    picture: string,
    context: string,
  ): Promise<void> => {
    try {
      await cloudinary.deleteImage(picture);
    } catch (cleanupError) {
      logger.warn({ err: cleanupError, picture }, context);
    }
  };

  /** Uniqueness pre-checks use findUnique ON PURPOSE (unscoped): the DB
   * unique constraints span soft-deleted rows (khadys convention), so a
   * tombstoned customer still holds its email/phone and the pre-check must
   * see it — otherwise the write would die on a raw P2002 instead. */
  const assertContactAvailable = async (
    input: Pick<CustomerUpdateInput, 'email' | 'phone'>,
    excludeId?: number,
  ): Promise<void> => {
    if (input.email) {
      const byEmail = await prisma.customer.findUnique({
        where: { email: input.email },
      });
      if (byEmail && byEmail.id !== excludeId) {
        throw new CustomError(
          HTTP_STATUS_CODES.CONFLICT,
          'A customer with this email already exists.',
        );
      }
    }

    if (input.phone) {
      const byPhone = await prisma.customer.findUnique({
        where: { phone: input.phone },
      });
      if (byPhone && byPhone.id !== excludeId) {
        throw new CustomError(
          HTTP_STATUS_CODES.CONFLICT,
          'A customer with this phone number already exists.',
        );
      }
    }

    // Login/reset resolve contacts customer-first, so a contact held by a
    // STAFF account must be just as unavailable as one held by a customer.
    await assertContactFreeAcrossPrincipals(prisma, input, 'customer');
  };

  /** POST /customers — staff-side creation (walk-in / phone customers).
   * Always PASSWORDLESS: the customer signs in via OTP login, or claims a
   * password themselves through forgot-password / change-password. */
  const createCustomer = async (
    input: CustomerCreateInput,
  ): Promise<SafeCustomer> => {
    await assertContactAvailable(input);

    return prisma.customer.create({
      data: {
        address: input.address,
        email: input.email,
        name: input.name,
        phone: input.phone,
        profilePicture: input.profilePicture,
      },
      select: customerSelect,
    });
  };

  /** GET /customers — newest first, free-text search across name/email/phone. */
  const listCustomers = async (
    params: CustomerListParams,
  ): Promise<{ customers: SafeCustomer[]; total: number }> => {
    const where: Prisma.CustomerWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        select: customerSelect,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total };
  };

  /** The scoped existence read every per-customer function starts from. */
  const findCustomerOr404 = async (
    customerId: number,
  ): Promise<SafeCustomer> => {
    // findFirst so soft-deleted customers 404 like hard-deleted ones would.
    const customer = await prisma.customer.findFirst({
      select: customerSelect,
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  };

  /** The booking slice the profile stats reduce over: status + timeline plus
   * the destination each product ultimately points at. */
  const bookingActivitySelect = {
    createdAt: true,
    flight: {
      select: {
        departure: true,
        destination: { select: { id: true, name: true } },
      },
    },
    room: {
      select: {
        hotel: { select: { destination: { select: { id: true, name: true } } } },
      },
    },
    startDate: true,
    status: true,
    tour: {
      select: {
        destination: { select: { id: true, name: true } },
        startDate: true,
      },
    },
  } satisfies Prisma.BookingSelect;

  type BookingActivityRow = Prisma.BookingGetPayload<{
    select: typeof bookingActivitySelect;
  }>;

  /** The date a booking's trip actually starts: the tour's start, the room's
   * check-in (booking.startDate), or the flight's departure. */
  const tripStartOf = (row: BookingActivityRow): Date | null =>
    row.tour?.startDate ?? row.flight?.departure ?? row.startDate;

  /** The destination a booking ultimately points at (tour's, flight's, or the
   * room's hotel's), or null for malformed rows. */
  const destinationOf = (
    row: BookingActivityRow,
  ): null | { id: number; name: string } =>
    row.tour?.destination ??
    row.flight?.destination ??
    row.room?.hotel.destination ??
    null;

  /** The destination booked most often, ties broken by the most recently
   * booked one. Rows must arrive in createdAt ASC order so "latest booking
   * for this destination" is a simple overwrite. */
  const favoriteDestinationOf = (
    rows: BookingActivityRow[],
  ): null | { id: number; name: string } => {
    const tally = new Map<
      number,
      { count: number; latestAt: number; name: string }
    >();
    for (const row of rows) {
      const destination = destinationOf(row);
      if (!destination) continue;
      const entry = tally.get(destination.id) ?? {
        count: 0,
        latestAt: 0,
        name: destination.name,
      };
      entry.count += 1;
      entry.latestAt = row.createdAt.getTime();
      tally.set(destination.id, entry);
    }

    let favorite: null | { id: number; name: string } = null;
    let best = { count: 0, latestAt: 0 };
    for (const [id, entry] of tally) {
      if (
        entry.count > best.count ||
        (entry.count === best.count && entry.latestAt > best.latestAt)
      ) {
        favorite = { id, name: entry.name };
        best = { count: entry.count, latestAt: entry.latestAt };
      }
    }
    return favorite;
  };

  /**
   * GET /customers/:id — the FULL profile: identity plus the lifetime
   * activity stats (see CustomerProfileStats / the mapper for field-by-field
   * docs). Three queries total — one booking slice that every booking-derived
   * stat reduces over (statuses, upcoming trips, last booking, favorite
   * destination), one payment aggregate, one payment count — no N+1. All
   * reads are top-level so the soft-delete scope applies; "upcoming" is
   * judged against the injected clock.
   */
  const getCustomerById = async (
    actor: CustomerActor,
    customerId: number,
  ): Promise<CustomerProfile> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError(
        'You are not authorized to view this customer profile',
      );
    }

    const customer = await findCustomerOr404(customerId);

    const [identity, bookings, completedPayments, totalPayments] =
      await Promise.all([
        // googleId is auth bookkeeping and stays out of customerSelect; the
        // profile only needs it to derive signupMethod.
        prisma.customer.findFirst({
          select: { googleId: true },
          where: { id: customerId },
        }),
        prisma.booking.findMany({
          orderBy: { createdAt: 'asc' },
          select: bookingActivitySelect,
          where: { customerId },
        }),
        prisma.payment.aggregate({
          _count: { _all: true },
          _sum: { amount: true },
          where: { customerId, status: PaymentStatus.COMPLETED },
        }),
        prisma.payment.count({ where: { customerId } }),
      ]);

    const bookingsByStatus: Partial<Record<BookingStatus, number>> = {};
    for (const row of bookings) {
      bookingsByStatus[row.status] = (bookingsByStatus[row.status] ?? 0) + 1;
    }

    const now = clock.timestamp();
    const upcomingTrips = bookings.filter((row) => {
      if (
        row.status !== BookingStatus.PENDING &&
        row.status !== BookingStatus.CONFIRMED
      ) {
        return false;
      }
      const start = tripStartOf(row);
      return start !== null && start.getTime() > now;
    }).length;

    const totalSpent = completedPayments._sum.amount ?? 0;
    const completedCount = completedPayments._count._all;

    return {
      customer,
      stats: {
        averageBookingValue:
          completedCount === 0 ? null : Math.round(totalSpent / completedCount),
        bookingsByStatus,
        favoriteDestination: favoriteDestinationOf(bookings),
        lastBookingAt: bookings.at(-1)?.createdAt ?? null,
        memberSince: customer.createdAt,
        signupMethod: identity?.googleId
          ? 'google'
          : customer.email
            ? 'email'
            : 'phone',
        totalBookings: bookings.length,
        totalPayments,
        totalSpent,
        upcomingTrips,
      },
    };
  };

  /** GET /customers/:id/bookings — the customer's COMPLETE booking history,
   * paginated (newest first), self or staff only. */
  const listCustomerBookingHistory = async (
    actor: CustomerActor,
    customerId: number,
    params: HistoryParams,
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError('You can only view your own bookings');
    }
    await findCustomerOr404(customerId);

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where: { customerId },
      }),
      prisma.booking.count({ where: { customerId } }),
    ]);

    return { bookings, total };
  };

  /** GET /customers/:id/payments — the customer's COMPLETE payment history,
   * paginated (newest first), self or staff only. */
  const listCustomerPaymentHistory = async (
    actor: CustomerActor,
    customerId: number,
    params: HistoryParams,
  ): Promise<{ payments: PaymentWithRelations[]; total: number }> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError('You can only view your own payments');
    }
    await findCustomerOr404(customerId);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where: { customerId },
      }),
      prisma.payment.count({ where: { customerId } }),
    ]);

    return { payments, total };
  };

  /**
   * PUT /customers/:id — self or ADMIN/AGENT only. Guard order mirrors the
   * user domain: actor rule → existence → email uniqueness → phone uniqueness
   * → update. A replaced profile picture has its old image cleaned up
   * best-effort; if anything fails after the middleware already uploaded a
   * new image, that fresh upload is reclaimed before rethrowing.
   */
  const updateCustomer = async (
    actor: CustomerActor,
    customerId: number,
    input: CustomerUpdateInput,
  ): Promise<SafeCustomer> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError(
        'You are not authorized to update this customer.',
      );
    }

    const uploadedImageUrl = input.profilePicture;

    try {
      const existing = await prisma.customer.findFirst({
        select: { email: true, phone: true, profilePicture: true },
        where: { id: customerId },
      });
      if (!existing) {
        throw new NotFoundError('Customer not found');
      }

      // Email/phone are LOGIN IDENTIFIERS: a customer editing their OWN
      // profile may no longer change them here — the dedicated verified flows
      // (POST /auth/change-email / /auth/change-phone, which re-authenticate
      // and confirm possession of the new contact) are the only self-service
      // path. Staff edits keep the direct administrative path (zod cannot
      // know the actor, so the rule lives here). Sending the unchanged
      // current value stays a no-op so full-profile form submits keep working.
      const isSelf = actor.kind === 'customer' && actor.id === customerId;
      if (isSelf) {
        if (input.email !== undefined && input.email !== existing.email) {
          throw new BadRequestError(
            'Your email address cannot be changed here. Use POST /auth/change-email, which confirms the new address.',
          );
        }
        if (input.phone !== undefined && input.phone !== existing.phone) {
          throw new BadRequestError(
            'Your phone number cannot be changed here. Use POST /auth/change-phone, which verifies the new number.',
          );
        }
      }

      await assertContactAvailable(
        {
          email: input.email !== existing.email ? input.email : undefined,
          phone: input.phone !== existing.phone ? input.phone : undefined,
        },
        customerId,
      );

      // Prisma ignores undefined keys, so omitted fields stay untouched.
      // Credentials are deliberately NOT writable here — see the input type.
      const updated = await prisma.customer.update({
        data: {
          address: input.address,
          email: input.email,
          name: input.name,
          phone: input.phone,
          profilePicture: photoColumnValue(uploadedImageUrl),
        },
        select: customerSelect,
        where: { id: customerId },
      });

      // Replaced or removed picture: drop the old image now that the row no
      // longer points at it ('' — the removal signal — is covered too).
      if (
        uploadedImageUrl !== undefined &&
        existing.profilePicture &&
        existing.profilePicture !== uploadedImageUrl
      ) {
        await cleanupPicture(
          existing.profilePicture,
          'Failed to clean up old customer profile picture',
        );
      }

      return updated;
    } catch (error) {
      // The picture was already uploaded by the route middleware; don't
      // orphan it on Cloudinary when the update is refused.
      if (uploadedImageUrl) {
        try {
          await cloudinary.deleteImage(uploadedImageUrl);
        } catch (cleanupError) {
          logger.error(
            { err: cleanupError, picture: uploadedImageUrl },
            'Failed to clean up Cloudinary image',
          );
        }
      }
      throw error;
    }
  };

  /**
   * DELETE /customers/:id — ADMIN only (route-gated). A customer with any
   * ACTIVE (pending or confirmed) booking is protected (409) — the user
   * domain's delete guard, adapted to bookings. Soft delete; the profile
   * picture is cleaned up best-effort after the row is tombstoned.
   */
  const deleteCustomer = async (
    customerId: number,
  ): Promise<CustomerDeleteSummary> => {
    const existing = await prisma.customer.findFirst({
      select: { email: true, id: true, name: true, profilePicture: true },
      where: { id: customerId },
    });
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    const activeBookings = await prisma.booking.count({
      where: {
        customerId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    });
    if (activeBookings > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot delete customer with active (pending or confirmed) bookings. ' +
          'Please cancel or complete the bookings first.',
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.customer.update({
      data: { deletedAt: clock.now() },
      where: { id: customerId },
    });

    // Deleted accounts must lose access at once, not at cache expiry: the
    // next request re-reads the DB (scoped), finds no row, and is rejected.
    invalidateCachedTokenVersion('customer', customerId);

    if (existing.profilePicture) {
      await cleanupPicture(
        existing.profilePicture,
        `Failed to clean up profile picture for deleted customer ${String(customerId)}`,
      );
    }

    return { email: existing.email, name: existing.name };
  };

  return {
    createCustomer,
    deleteCustomer,
    getCustomerById,
    listCustomerBookingHistory,
    listCustomerPaymentHistory,
    listCustomers,
    updateCustomer,
  };
};

export const customerService = makeCustomerService(defaultDeps);

export const {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomerBookingHistory,
  listCustomerPaymentHistory,
  listCustomers,
  updateCustomer,
} = customerService;
