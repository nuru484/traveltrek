// src/services/report/payments.service.ts
//
// GET /reports/payments/summary — the period's payment slice with status/
// method/month breakdowns and per-KPI trends against the previous window.
import {
  type PaymentMethod,
  PaymentStatus,
  type Prisma,
} from '#config/prismaClient.js';
import { type ReportCore } from '#services/report/core.js';
import {
  type AmountCountBucket,
  calculateTrend,
  type PaymentMonthBucket,
  type PaymentsSummaryParams,
  type PaymentsSummaryReport,
  paymentSummarySelect,
  periodEcho,
  periodWindow,
  previousWindow,
  type ReportDeps,
  windowClause,
} from '#services/report/shared.js';

export const makeReportPaymentsService = (d: ReportDeps, core: ReportCore) => {
  const { prisma } = d;
  const { resolveYear } = core;

  /** GET /reports/payments/summary — 10 most recent rows + aggregates. */
  const getPaymentsSummary = async (
    params: PaymentsSummaryParams,
  ): Promise<PaymentsSummaryReport> => {
    const year = resolveYear(params.year);
    const window = periodWindow(params, year);

    const entityWhere: Prisma.PaymentWhereInput = {
      currency: params.currency,
    };
    if (params.paymentMethod) entityWhere.paymentMethod = params.paymentMethod;
    if (params.status) entityWhere.status = params.status;
    if (params.customerId) entityWhere.customerId = params.customerId;

    const [payments, previousGroups] = await Promise.all([
      prisma.payment.findMany({
        select: paymentSummarySelect,
        where: { ...entityWhere, paymentDate: windowClause(window) },
      }),
      // Equal-length previous window, same entity filters — feeds the trends.
      prisma.payment.groupBy({
        _count: { _all: true },
        _sum: { amount: true },
        by: ['status'],
        where: {
          ...entityWhere,
          paymentDate: windowClause(previousWindow(window)),
        },
      }),
    ]);

    const previousAmount = (status: PaymentStatus): number =>
      previousGroups.find((group) => group.status === status)?._sum.amount ??
      0;
    const previousPayments = previousGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );

    const sumWhere = (status: PaymentStatus): number =>
      payments
        .filter((p) => p.status === status)
        .reduce((sum, payment) => sum + payment.amount, 0);

    const statusBreakdown: Partial<
      Record<PaymentStatus, AmountCountBucket>
    > = {};
    const methodBreakdown: Partial<
      Record<PaymentMethod, AmountCountBucket>
    > = {};
    const monthlyBuckets = new Map<string, PaymentMonthBucket>();

    for (const payment of payments) {
      const statusBucket = (statusBreakdown[payment.status] ??= {
        amount: 0,
        count: 0,
      });
      statusBucket.count += 1;
      statusBucket.amount += payment.amount;

      const methodBucket = (methodBreakdown[payment.paymentMethod] ??= {
        amount: 0,
        count: 0,
      });
      methodBucket.count += 1;
      methodBucket.amount += payment.amount;

      // Monthly buckets count every dated payment but only COMPLETED ones
      // contribute revenue; undated payments are skipped entirely.
      if (!payment.paymentDate) continue;
      const monthKey = payment.paymentDate.toISOString().slice(0, 7);
      let monthBucket = monthlyBuckets.get(monthKey);
      if (!monthBucket) {
        monthBucket = { count: 0, month: monthKey, revenue: 0 };
        monthlyBuckets.set(monthKey, monthBucket);
      }
      monthBucket.count += 1;
      if (payment.status === PaymentStatus.COMPLETED) {
        monthBucket.revenue += payment.amount;
      }
    }

    return {
      methodBreakdown,
      monthlyBreakdown: [...monthlyBuckets.values()],
      recentPayments: [...payments]
        .sort(
          (a, b) =>
            (b.paymentDate?.getTime() ?? 0) - (a.paymentDate?.getTime() ?? 0),
        )
        .slice(0, 10),
      statusBreakdown,
      summary: {
        currency: params.currency,
        failedAmount: sumWhere(PaymentStatus.FAILED),
        pendingAmount: sumWhere(PaymentStatus.PENDING),
        period: periodEcho(params, year),
        refundedAmount: sumWhere(PaymentStatus.REFUNDED),
        totalPayments: payments.length,
        totalRevenue: sumWhere(PaymentStatus.COMPLETED),
        trends: {
          failedAmount: calculateTrend(
            sumWhere(PaymentStatus.FAILED),
            previousAmount(PaymentStatus.FAILED),
          ),
          pendingAmount: calculateTrend(
            sumWhere(PaymentStatus.PENDING),
            previousAmount(PaymentStatus.PENDING),
          ),
          refundedAmount: calculateTrend(
            sumWhere(PaymentStatus.REFUNDED),
            previousAmount(PaymentStatus.REFUNDED),
          ),
          totalPayments: calculateTrend(payments.length, previousPayments),
          totalRevenue: calculateTrend(
            sumWhere(PaymentStatus.COMPLETED),
            previousAmount(PaymentStatus.COMPLETED),
          ),
        },
      },
    };
  };

  return { getPaymentsSummary };
};
