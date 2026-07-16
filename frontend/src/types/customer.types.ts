// src/types/customer.types.ts
//
// Customers are their own principal (backend Phase 5b): bookings/payments
// hang off a Customer record, and customers have NO role field. The DTO
// shapes mirror backend src/utils/mappers/customer.mapper.ts.

export interface ICustomer {
  id: number;
  name: string;
  /** Absent for phone-only signups. */
  email?: string;
  phone?: string;
  address?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /customers/:id returns the base DTO plus lifetime activity counters. */
export interface ICustomerProfile extends ICustomer {
  stats: {
    totalBookings: number;
    totalPayments: number;
  };
}

export interface ICustomerResponse {
  message: string;
  data: ICustomer;
}

export interface ICustomerProfileResponse {
  message: string;
  data: ICustomerProfile;
}

export interface ICustomersPaginatedResponse {
  message: string;
  data: ICustomer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Mirrors backend customerListQuery (page/limit + free-text search). */
export interface ICustomersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

/** Mirrors backend customerHistoryQuery (pagination only). */
export interface ICustomerHistoryQueryParams {
  page?: number;
  limit?: number;
}

/** POST /customers is JSON (no upload middleware on the create route). */
export interface ICustomerCreateInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  password?: string;
}

export interface IDeleteCustomerResponse {
  message: string;
}

export interface ICustomersDataTableProps {
  data: ICustomer[];
  loading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  filters: Omit<ICustomersQueryParams, "page" | "limit">;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<ICustomersQueryParams, "page" | "limit">>
  ) => void;
  onRefresh?: () => void;
}
