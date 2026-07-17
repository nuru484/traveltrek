// src/services/payment/query.service.ts
//
// Payment read paths: fetch one (customer-scoped), the general list (customers
// scoped to themselves; the customerId filter is ADMIN-only), and the
// per-customer list. Pagination runs through the payment core.
import { type Prisma } from '#config/prismaClient.js';
import {
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type PaymentCore } from '#services/payment/core.js';
import {
  type PaymentActor,
  type PaymentDeps,
  type PaymentListParams,
} from '#services/payment/shared.js';
import { UserRole } from '#types/user-profile.types.js';
import {
  paymentInclude,
  type PaymentWithRelations,
} from '#utils/mappers/payment.mapper.js';

export const makePaymentQueryService = (d: PaymentDeps, core: PaymentCore) => {
  const { prisma } = d;
  const { findPage } = core;

  /** GET /payments/:id — customers may only view their own payments. */
  const getPaymentById = async (
    actor: PaymentActor,
    id: number,
  ): Promise<PaymentWithRelations> => {
    const payment = await prisma.payment.findFirst({
      include: paymentInclude,
      where: { id },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (actor.role === UserRole.CUSTOMER && payment.customerId !== actor.id) {
      throw new UnauthorizedError('You can only view your own payments');
    }

    return payment;
  };

  /**
   * GET /payments — customers are always scoped to their own rows; the
   * customerId filter is honoured for admins only (legacy rule: agents may
   * see everything but not filter by owner).
   */
  const listPayments = async (
    actor: PaymentActor,
    params: PaymentListParams,
  ): Promise<{ payments: PaymentWithRelations[]; total: number }> => {
    const where: Prisma.PaymentWhereInput =
      actor.role === UserRole.CUSTOMER ? { customerId: actor.id } : {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.paymentMethod) {
      where.paymentMethod = params.paymentMethod;
    }

    if (params.customerId && actor.role === UserRole.ADMIN) {
      where.customerId = params.customerId;
    }

    if (params.search) {
      where.OR = [
        {
          transactionReference: {
            contains: params.search,
            mode: 'insensitive',
          },
        },
        {
          customer: { name: { contains: params.search, mode: 'insensitive' } },
        },
        {
          customer: {
            email: { contains: params.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return findPage(where, params.page, params.limit);
  };

  /** GET /payments/customer/:customerId — a customer may only list their own. */
  const listCustomerPayments = async (
    actor: PaymentActor,
    customerId: number,
    params: PaymentListParams,
  ): Promise<{ payments: PaymentWithRelations[]; total: number }> => {
    if (actor.role === UserRole.CUSTOMER && actor.id !== customerId) {
      throw new UnauthorizedError('You can only view your own payments');
    }

    const where: Prisma.PaymentWhereInput = { customerId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.paymentMethod) {
      where.paymentMethod = params.paymentMethod;
    }

    return findPage(where, params.page, params.limit);
  };

  return { getPaymentById, listCustomerPayments, listPayments };
};
