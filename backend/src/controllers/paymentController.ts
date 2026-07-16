import axios from 'axios';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import {
  IDeleteAllPaymentsResponse,
  IDeletePaymentResponse,
  IPayment,
  IPaymentInitializeResponse,
  IPaymentInput,
  IPaymentsPaginatedResponse,
  IPaymentsQueryParams,
  IPaymentVerificationResponse,
  IRefundPaymentResponse,
  IUpdatePaymentStatusResponse,
} from 'types/payment.types';

import { HTTP_STATUS_CODES } from '../config/constants';
import ENV from '../config/env';
import prisma from '../config/prismaClient';
import {
  asyncHandler,
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '../middlewares/error-handler';

// Paystack configuration
const PAYSTACK_SECRET_KEY = ENV.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE_URL = 'https://api.paystack.co';

const getPaystackChannel = (paymentMethod: string): string => {
  switch (paymentMethod) {
    case 'BANK_TRANSFER':
      return 'bank';
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return 'card';
    case 'MOBILE_MONEY':
      return 'mobile_money';
    default:
      return 'card';
  }
};

/**
 * Create a payment for a booking using Paystack
 */
export const createPayment = asyncHandler(
  async (
    req: Request<{}, IPaymentInitializeResponse, IPaymentInput>,
    res: Response<IPaymentInitializeResponse>,
    _next: NextFunction,
  ): Promise<void> => {
    const { bookingId, paymentMethod } = req.body;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized access');
    }

    // Validate booking with updated relations
    const booking = await prisma.booking.findUnique({
      include: {
        flight: {
          include: {
            destination: true,
            origin: true,
          },
        },
        payment: true, // Include existing payment
        room: {
          include: {
            hotel: true,
          },
        },
        tour: true,
        user: true,
      },
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Customers can only pay for their own bookings
    if (user.role === 'CUSTOMER' && booking.userId !== user.id) {
      throw new UnauthorizedError('You can only pay for your own bookings');
    }

    // Check booking status - only PENDING bookings can be paid for
    if (booking.status === 'CANCELLED') {
      throw new BadRequestError('Cannot pay for cancelled booking');
    }

    if (booking.status === 'COMPLETED') {
      throw new BadRequestError('Booking already completed');
    }

    if (booking.status === 'CONFIRMED') {
      throw new BadRequestError('Booking already paid for');
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestError('Payment not available for this booking');
    }

    // Validate payment method
    if (
      !['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY'].includes(
        paymentMethod,
      )
    ) {
      throw new BadRequestError('Invalid payment method');
    }

    // Check if payment already exists for this booking
    if (booking.payment) {
      if (booking.payment.status === 'COMPLETED') {
        throw new BadRequestError('Payment already completed');
      }

      if (booking.payment.status === 'PENDING') {
        // Re-initialize Paystack for existing pending payment
        const paystackResponse = await axios.post(
          `${PAYSTACK_API_BASE_URL}/transaction/initialize`,
          {
            amount: booking.totalPrice * 100,
            callback_url:
              process.env.PAYSTACK_CALLBACK_URL ||
              'http://localhost:3000/dashboard/payments/callback',
            channels: [getPaystackChannel(paymentMethod)],
            currency: 'GHS',
            email: booking.user.email,
            metadata: { bookingId },
            reference: booking.payment.transactionReference,
          },
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
          },
        );

        const { authorization_url } = paystackResponse.data.data;

        res.status(HTTP_STATUS_CODES.OK).json({
          data: {
            authorization_url,
            paymentId: booking.payment.id,
            transactionReference: booking.payment.transactionReference!,
          },
          message: 'Payment session resumed',
        });
        return;
      }

      if (booking.payment.status === 'FAILED') {
        throw new BadRequestError(
          'Previous payment failed. Please contact support',
        );
      }
    }

    // Initialize Paystack transaction
    const paystackResponse = await axios.post(
      `${PAYSTACK_API_BASE_URL}/transaction/initialize`,
      {
        amount: booking.totalPrice * 100,
        callback_url:
          process.env.PAYSTACK_CALLBACK_URL ||
          'http://localhost:3000/dashboard/payments/callback',
        channels: [getPaystackChannel(paymentMethod)],
        currency: 'GHS',
        email: booking.user.email,
        metadata: { bookingId },
        reference: `booking_${bookingId}_${Date.now()}`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const { authorization_url, reference } = paystackResponse.data.data;

    // Create payment record in PENDING state
    const payment = await prisma.payment.create({
      data: {
        amount: booking.totalPrice,
        bookingId: bookingId,
        currency: 'GHS',
        paymentMethod,
        status: 'PENDING',
        transactionReference: reference,
        userId: booking.userId,
      },
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        authorization_url,
        paymentId: payment.id,
        transactionReference: reference,
      },
      message: 'Payment initialized successfully',
    });
  },
);

// Helper function to determine booked item from booking
const getBookedItemFromBooking = (booking: any) => {
  if (booking.tour) {
    return {
      description: booking.tour.description,
      id: booking.tour.id,
      name: booking.tour.name,
      type: 'TOUR' as const,
    };
  } else if (booking.room) {
    return {
      description: booking.room.description,
      id: booking.room.id,
      name: `${booking.room.hotel.name} - ${booking.room.roomType}`,
      type: 'ROOM' as const,
    };
  } else if (booking.flight) {
    return {
      description: `${booking.flight.origin.name} to ${booking.flight.destination.name}`,
      id: booking.flight.id,
      name: `${booking.flight.airline} ${booking.flight.flightNumber}`,
      type: 'FLIGHT' as const,
    };
  } else {
    return {
      description: null,
      id: booking.id,
      name: 'Unknown Item',
      type: 'TOUR' as const,
    };
  }
};

export const handleCallback = asyncHandler(
  async (
    req: Request,
    res: Response<IPaymentVerificationResponse>,
  ): Promise<void> => {
    const { reference } = req.query;

    if (!reference) {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: 'No reference provided',
        success: false,
      });
      return;
    }

    // Verify transaction
    const verificationResponse = await axios.get(
      `${PAYSTACK_API_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const verifiedData = verificationResponse.data.data;
    const metadata = verifiedData.metadata;
    const bookingId = metadata?.bookingId;

    if (!bookingId) {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: 'No bookingId found in payment metadata',
        success: false,
      });
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId, 10) },
    });

    if (!booking) {
      res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: 'Booking not found',
        success: false,
      });
      return;
    }

    // If payment failed
    if (verifiedData.status !== 'success') {
      await prisma.payment.updateMany({
        data: { status: 'FAILED' },
        where: { transactionReference: reference as string },
      });

      res.status(HTTP_STATUS_CODES.OK).json({
        data: {
          amount: verifiedData.amount / 100,
          bookingId,
          paymentStatus: 'FAILED',
          reference: reference as string,
        },
        message: 'Payment verification failed',
        success: false,
      });
      return;
    }

    // If amount mismatch
    if (verifiedData.amount / 100 !== booking.totalPrice) {
      await prisma.payment.updateMany({
        data: { status: 'FAILED' },
        where: { transactionReference: reference as string },
      });

      res.status(HTTP_STATUS_CODES.OK).json({
        data: {
          amount: verifiedData.amount / 100,
          bookingId,
          paymentStatus: 'FAILED',
          reference: reference as string,
        },
        message: 'Payment amount does not match booking total price',
        success: false,
      });
      return;
    }

    // Update statuses
    await prisma.payment.updateMany({
      data: {
        paymentDate: new Date(),
        status: 'COMPLETED',
      },
      where: { transactionReference: reference as string },
    });

    await prisma.booking.update({
      data: { status: 'CONFIRMED' },
      where: { id: parseInt(bookingId) },
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        amount: verifiedData.amount / 100,
        bookingId,
        paymentStatus: 'COMPLETED',
        reference: reference as string,
      },
      message: 'Payment verified successfully',
      success: true,
    });
  },
);

/**
 * Handle Paystack webhook for payment verification
 */
export const handleWebhook = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const event = req.body;

    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const signature = req.headers['x-paystack-signature'] as string;

    if (hash !== signature) {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).send('Invalid signature');
      return;
    }

    if (event.event === 'charge.success') {
      const { metadata, reference } = event.data;
      const bookingId = metadata.bookingId;

      // Verify transaction with Paystack
      const verificationResponse = await axios.get(
        `${PAYSTACK_API_BASE_URL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        },
      );

      const verifiedData = verificationResponse.data.data;
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      // Verify amount matches booking totalPrice
      if (verifiedData.amount / 100 !== booking.totalPrice) {
        await prisma.payment.updateMany({
          data: { status: 'FAILED' },
          where: { transactionReference: reference },
        });
        throw new Error('Payment amount does not match booking total price');
      }

      // Update payment and booking status
      await prisma.payment.updateMany({
        data: {
          paymentDate: new Date(),
          status: 'COMPLETED',
        },
        where: { transactionReference: reference },
      });

      await prisma.booking.update({
        data: { status: 'CONFIRMED' },
        where: { id: bookingId },
      });

      res
        .status(HTTP_STATUS_CODES.OK)
        .json({ message: 'Payment verified and booking confirmed' });
    } else {
      res.status(HTTP_STATUS_CODES.OK).json({ message: 'Event received' });
    }
  },
);

/**
 * Get a single payment by ID
 */
export const getPayment = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    const payment = await prisma.payment.findUnique({
      include: {
        booking: {
          include: {
            flight: {
              include: {
                destination: true,
                origin: true,
              },
            },
            room: {
              include: {
                hotel: true,
              },
            },
            tour: true,
          },
        },
        user: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      where: { id: parseInt(id) },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Customers can only view their own payments
    if (user.role === 'CUSTOMER' && payment.userId !== user.id) {
      throw new UnauthorizedError('You can only view your own payments');
    }

    const bookedItem = getBookedItemFromBooking(payment.booking);

    const response: IPayment = {
      amount: payment.amount,
      bookedItem,
      bookingId: payment.bookingId,
      createdAt: payment.createdAt,
      currency: payment.currency,
      id: payment.id,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      transactionReference: payment.transactionReference ?? '',
      updatedAt: payment.updatedAt,
      user: {
        email: payment.user.email,
        id: payment.user.id,
        name: payment.user.name,
      },
      userId: payment.userId,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Payment retrieved successfully',
    });
  },
);

/**
 * Get all payments with pagination
 */
export const getAllPayments = asyncHandler(
  async (
    req: Request<{}, IPaymentsPaginatedResponse, {}, IPaymentsQueryParams>,
    res: Response<IPaymentsPaginatedResponse>,
    _next: NextFunction,
  ): Promise<void> => {
    const user = req.user;
    const {
      limit = 10,
      page = 1,
      paymentMethod,
      search,
      status,
      userId: queryUserId,
    } = req.query;

    const pageNum = parseInt(page.toString()) || 1;
    const limitNum = parseInt(limit.toString()) || 10;
    const skip = (pageNum - 1) * limitNum;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    // Build where clause
    const where: any = user.role === 'CUSTOMER' ? { userId: user.id } : {};

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (queryUserId && user.role === 'ADMIN') {
      where.userId = parseInt(queryUserId.toString());
    }

    if (search) {
      where.OR = [
        { transactionReference: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        include: {
          booking: {
            include: {
              flight: {
                include: {
                  destination: true,
                  origin: true,
                },
              },
              room: {
                include: {
                  hotel: true,
                },
              },
              tour: true,
            },
          },
          user: {
            select: {
              email: true,
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        where,
      }),
      prisma.payment.count({ where }),
    ]);

    const response: IPayment[] = payments.map((payment) => {
      const bookedItem = getBookedItemFromBooking(payment.booking);

      return {
        amount: payment.amount,
        bookedItem,
        bookingId: payment.bookingId,
        createdAt: payment.createdAt,
        currency: payment.currency,
        id: payment.id,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        transactionReference: payment.transactionReference ?? '',
        updatedAt: payment.updatedAt,
        user: {
          email: payment.user.email,
          id: payment.user.id,
          name: payment.user.name,
        },
        userId: payment.userId,
      };
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Payments retrieved successfully',
      meta: {
        limit: limitNum,
        page: pageNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  },
);

/**
 * Get all payments for a specific user
 */
export const getUserPayments = asyncHandler(
  async (
    req: Request,
    res: Response<IPaymentsPaginatedResponse>,
    _next: NextFunction,
  ): Promise<void> => {
    const { userId } = req.params;
    const user = req.user;
    const { limit = 10, page = 1 } = req.query;
    const status = req.query.status as string | undefined;
    const paymentMethod = req.query.paymentMethod as string | undefined;

    const pageNum = parseInt(page.toString()) || 1;
    const limitNum = parseInt(limit.toString()) || 10;
    const skip = (pageNum - 1) * limitNum;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    const targetUserId = parseInt(userId);

    // Customers can only view their own payments
    if (user.role === 'CUSTOMER' && user.id !== targetUserId) {
      throw new UnauthorizedError('You can only view your own payments');
    }

    // Build where clause
    const where: any = { userId: targetUserId };

    if (
      status &&
      ['COMPLETED', 'FAILED', 'PENDING', 'REFUNDED'].includes(status)
    ) {
      where.status = status;
    }

    if (
      paymentMethod &&
      ['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY'].includes(
        paymentMethod,
      )
    ) {
      where.paymentMethod = paymentMethod;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        include: {
          booking: {
            include: {
              flight: {
                include: {
                  destination: true,
                  origin: true,
                },
              },
              room: {
                include: {
                  hotel: true,
                },
              },
              tour: true,
            },
          },
          user: {
            select: {
              email: true,
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        where,
      }),
      prisma.payment.count({ where }),
    ]);

    const response: IPayment[] = payments.map((payment) => {
      const bookedItem = getBookedItemFromBooking(payment.booking);

      return {
        amount: payment.amount,
        bookedItem,
        bookingId: payment.bookingId,
        createdAt: payment.createdAt,
        currency: payment.currency,
        id: payment.id,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        transactionReference: payment.transactionReference ?? '',
        updatedAt: payment.updatedAt,
        user: {
          email: payment.user.email,
          id: payment.user.id,
          name: payment.user.name,
        },
        userId: payment.userId,
      };
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: `Payments for user ${targetUserId} retrieved successfully`,
      meta: {
        limit: limitNum,
        page: pageNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  },
);

/**
 * Update payment status
 */
export const updatePaymentStatus = asyncHandler(
  async (
    req: Request,
    res: Response<IUpdatePaymentStatusResponse>,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    // Only ADMIN can update payment status
    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError(
        'Only administrators can update payment status',
      );
    }

    // Validate status
    if (!['COMPLETED', 'FAILED', 'PENDING', 'REFUNDED'].includes(status)) {
      throw new BadRequestError('Invalid payment status');
    }

    // Find the payment
    const payment = await prisma.payment.findUnique({
      include: {
        booking: true,
      },
      where: { id: parseInt(id) },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Prevent invalid status transitions
    if (payment.status === 'COMPLETED' && status === 'PENDING') {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot change completed payment back to pending',
      );
    }

    if (payment.status === 'REFUNDED' && status !== 'REFUNDED') {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot change status of refunded payment',
      );
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      data: {
        paymentDate: status === 'COMPLETED' ? new Date() : payment.paymentDate,
        status,
        updatedAt: new Date(),
      },
      where: { id: parseInt(id) },
    });

    // Update booking status based on payment status
    let bookingStatus = payment.booking.status;

    if (status === 'COMPLETED') {
      bookingStatus = 'CONFIRMED';
    } else if (status === 'FAILED' || status === 'REFUNDED') {
      bookingStatus = 'CANCELLED';
    } else if (status === 'PENDING') {
      bookingStatus = 'PENDING';
    }

    await prisma.booking.update({
      data: { status: bookingStatus },
      where: { id: payment.bookingId },
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        bookingStatus,
        paymentId: updatedPayment.id,
        status: updatedPayment.status,
        updatedAt: updatedPayment.updatedAt,
      },
      message: 'Payment status updated successfully',
    });
  },
);

/**
 * Delete a single payment
 */
export const deletePayment = asyncHandler(
  async (
    req: Request,
    res: Response<IDeletePaymentResponse>,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    // Only ADMIN can delete payments
    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Only administrators can delete payments');
    }

    // Find the payment
    const payment = await prisma.payment.findUnique({
      include: {
        booking: true,
      },
      where: { id: parseInt(id) },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Prevent deletion of completed payments (for audit purposes)
    if (payment.status === 'COMPLETED') {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot delete completed payments. Consider refunding instead.',
      );
    }

    // Delete the payment
    await prisma.payment.delete({
      where: { id: parseInt(id) },
    });

    // Update booking status back to PENDING if payment is deleted
    await prisma.booking.update({
      data: { status: 'PENDING' },
      where: { id: payment.bookingId },
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        bookingId: payment.bookingId,
        paymentId: parseInt(id),
      },
      message: 'Payment deleted successfully',
    });
  },
);

export const deleteAllPayments = asyncHandler(
  async (
    req: Request<{}, IDeleteAllPaymentsResponse>,
    res: Response<IDeleteAllPaymentsResponse>,
    _next: NextFunction,
  ): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized access');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Admin privileges required');
    }

    const paymentCount = await prisma.payment.count();

    if (paymentCount === 0) {
      throw new BadRequestError('No payments to delete');
    }

    const payments = await prisma.payment.findMany({
      include: {
        booking: true,
      },
    });

    const completedPayments = payments.filter((p) => p.status === 'COMPLETED');

    if (completedPayments.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete payments: ${completedPayments.length} completed payment${completedPayments.length > 1 ? 's' : ''} must be refunded first`,
      );
    }

    const bookingIds = payments.map((p) => p.bookingId);

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({});

      await tx.booking.updateMany({
        data: {
          status: 'PENDING',
        },
        where: {
          id: { in: bookingIds },
        },
      });
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        bookingsAffected: bookingIds.length,
        deletedCount: payments.length,
      },
      message: `Successfully deleted ${payments.length} payment${payments.length > 1 ? 's' : ''}`,
    });
  },
);

/**
 * Refund a payment (safer alternative to deletion for completed payments)
 */
export const refundPayment = asyncHandler(
  async (
    req: Request,
    res: Response<IRefundPaymentResponse>,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    // Only ADMIN can refund payments
    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Only administrators can refund payments');
    }

    // Find the payment
    const payment = await prisma.payment.findUnique({
      include: {
        booking: true,
      },
      where: { id: parseInt(id) },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Only completed payments can be refunded
    if (payment.status !== 'COMPLETED') {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Only completed payments can be refunded',
      );
    }

    // Update payment to REFUND HTTP_STATUS_CODES.CONFLICT,ED status
    const refundedPayment = await prisma.payment.update({
      data: {
        status: 'REFUNDED',
        updatedAt: new Date(),
      },
      where: { id: parseInt(id) },
    });

    // Update booking status to CANCELLED
    await prisma.booking.update({
      data: { status: 'CANCELLED' },
      where: { id: payment.bookingId },
    });

    console.log(`Refund requested for payment ${id}:`, {
      amount: payment.amount,
      reason: reason || 'No reason provided',
      transactionReference: payment.transactionReference,
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        bookingStatus: 'CANCELLED',
        paymentId: refundedPayment.id,
        reason: reason || 'No reason provided',
        refundAmount: payment.amount,
        status: refundedPayment.status,
        updatedAt: refundedPayment.updatedAt,
      },
      message: 'Payment refunded successfully',
    });
  },
);
