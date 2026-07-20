// src/services/auth/demo-login.service.ts
//
// Server-side demo login: mints a real session for a canned ADMIN / AGENT /
// CUSTOMER account so the public demo needs NO credentials in the client. The
// whole flow is gated by DEMO_LOGIN_ENABLED (403 when off), and each role
// resolves a REAL account by its configured email — never a synthetic
// principal, so tokens, DTOs and role-gating behave exactly like a normal
// login. The controller mints/sets cookies from the returned principal, so the
// session it establishes is indistinguishable from a password login.
import { ForbiddenError, NotFoundError } from '#middlewares/error-handler.js';
import {
  type AuthDeps,
  type AuthPrincipal,
  type DemoRole,
} from '#services/auth/shared.js';

export const makeDemoLoginService = (d: AuthDeps) => {
  const { config, prisma } = d;

  /**
   * Resolves the real account a demo role points at and returns it as the
   * same AuthPrincipal a password login yields (so toTokenPrincipal + the DTO
   * mappers work verbatim). Forbidden when demo login is disabled; NotFound
   * when the role's account isn't configured/seeded — the caller never learns
   * anything an operator couldn't (the endpoint is a fixture, not a secret).
   */
  const demoLogin = async (role: DemoRole): Promise<AuthPrincipal> => {
    if (!config.DEMO_LOGIN_ENABLED) {
      throw new ForbiddenError('Demo login is disabled.', {
        code: 'DEMO_LOGIN_DISABLED',
        layer: 'auth',
      });
    }

    const notSeeded = (): NotFoundError =>
      new NotFoundError(
        `No demo ${role} account is configured. Seed the demo accounts and set the DEMO_${role}_EMAIL variable.`,
        { code: 'DEMO_ACCOUNT_NOT_FOUND', layer: 'auth' },
      );

    if (role === 'CUSTOMER') {
      const email = config.DEMO_CUSTOMER_EMAIL;
      // findFirst so the soft-delete extension scopes the read (a removed
      // demo account behaves like an unconfigured one).
      const customer = email
        ? await prisma.customer.findFirst({ where: { email } })
        : null;
      if (!customer) throw notSeeded();
      return { customer, kind: 'customer' };
    }

    const email =
      role === 'ADMIN' ? config.DEMO_ADMIN_EMAIL : config.DEMO_AGENT_EMAIL;
    const user = email
      ? await prisma.user.findFirst({ where: { email } })
      : null;
    if (!user) throw notSeeded();
    return { kind: 'staff', user };
  };

  return { demoLogin };
};
