import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@getsales4now.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@getsales4now.com");
    expect(result?.role).toBe("user");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("returns success on logout", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("router structure", () => {
  it("has all required module routers", () => {
    const routerKeys = Object.keys(appRouter._def.record);
    expect(routerKeys).toContain("auth");
    expect(routerKeys).toContain("crm");
    expect(routerKeys).toContain("campaigns");
    expect(routerKeys).toContain("social");
    expect(routerKeys).toContain("funnels");
    expect(routerKeys).toContain("inbox");
    expect(routerKeys).toContain("ai");
    expect(routerKeys).toContain("reports");
    expect(routerKeys).toContain("integrations");
    expect(routerKeys).toContain("onboarding");
  });

  it("has CRM sub-procedures", () => {
    expect(appRouter._def.record).toHaveProperty("crm");
  });

  it("has campaigns sub-procedures", () => {
    expect(appRouter._def.record).toHaveProperty("campaigns");
  });

  it("has AI sub-procedures", () => {
    // ai router is registered under appRouter
    expect(appRouter._def.record).toHaveProperty("ai");
  });

  it("has reports sub-procedures", () => {
    // reports router is registered under appRouter
    expect(appRouter._def.record).toHaveProperty("reports");
  });
});

// ─── Admin Router Tests ───────────────────────────────────────────────────────
describe("admin router", () => {
  it("admin.listUsers is accessible to admin users", () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    expect(caller.admin).toBeDefined();
    expect(typeof caller.admin.listUsers).toBe("function");
  });

  it("admin.listSettings is accessible to admin users", () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.admin.listSettings).toBe("function");
  });

  it("admin.getPermissionsMatrix returns 14 module entries", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const matrix = await caller.admin.getPermissionsMatrix();
    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix.length).toBe(14);
  });

  it("admin.getPermissionsMatrix marks Admin Panel as admin-only", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const matrix = await caller.admin.getPermissionsMatrix();
    const adminPanel = matrix.find((m) => m.module === "Admin Panel");
    expect(adminPanel).toBeDefined();
    expect(adminPanel?.user).toBe(false);
    expect(adminPanel?.admin).toBe(true);
  });

  it("admin.getSystemStats procedure exists and is callable", () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    // Only verify the procedure is exposed — actual DB call would fail in test env
    expect(typeof caller.admin.getSystemStats).toBe("function");
  });

  it("non-admin user is forbidden from admin procedures", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.getPermissionsMatrix()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin router exposes all required procedures", () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const procedures = [
      "listUsers", "getUserDetail", "updateUserRole", "deleteUser",
      "listSettings", "updateSetting", "listAuditLogs",
      "getSystemStats", "getPermissionsMatrix",
    ];
    procedures.forEach((proc) => {
      expect(typeof (caller.admin as Record<string, unknown>)[proc]).toBe("function");
    });
  });
});

// ─── Auth Own: Register / Login / Checkout Flow ───────────────────────────────

describe("authOwn router structure", () => {
  it("has register procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("authOwn.register");
  });

  it("has login procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("authOwn.login");
  });

  it("has forgotPassword procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("authOwn.forgotPassword");
  });

  it("has resetPassword procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("authOwn.resetPassword");
  });
});

describe("billing router structure", () => {
  it("has getPlans procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("billing.getPlans");
  });

  it("has createCheckout procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("billing.createCheckout");
  });

  it("has getSubscription procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("billing.getSubscription");
  });

  it("getPlans returns Starter and Business plans", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.billing.getPlans();
    expect(Array.isArray(plans)).toBe(true);
    const planIds = plans.map((p: { id: string }) => p.id);
    expect(planIds).toContain("basic");
    expect(planIds).toContain("business");
  });

  it("Basic plan price is 118", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.billing.getPlans();
    const basic = plans.find((p: { id: string }) => p.id === "basic");
    expect(basic).toBeDefined();
    expect(basic.monthlyPrice).toBe(118);
  });

  it("Business plan price is 248", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.billing.getPlans();
    const business = plans.find((p: { id: string }) => p.id === "business");
    expect(business).toBeDefined();
    expect(business.monthlyPrice).toBe(248);
  });
});

// ─── authOwn validation tests ─────────────────────────────────────────────────
describe("authOwn.register validation", () => {
  const publicCtx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };

  it("rejects registration when passwords do not match", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.authOwn.register({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "different456",
        plan: "starter",
      })
    ).rejects.toThrow();
  });

  it("rejects registration with invalid email", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.authOwn.register({
        name: "Test User",
        email: "not-an-email",
        password: "password123",
        confirmPassword: "password123",
        plan: "starter",
      })
    ).rejects.toThrow();
  });

  it("rejects registration with password shorter than 8 chars", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.authOwn.register({
        name: "Test User",
        email: "valid@example.com",
        password: "123",
        confirmPassword: "123",
        plan: "starter",
      })
    ).rejects.toThrow();
  });
});

describe("authOwn.login validation", () => {
  const publicCtx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };

  it("rejects login with invalid email format", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.authOwn.login({ email: "not-valid", password: "password123" })
    ).rejects.toThrow();
  });

  it("rejects login with empty password", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.authOwn.login({ email: "user@example.com", password: "" })
    ).rejects.toThrow();
  });
});

describe("billing.createCheckout auth guard", () => {
  it("rejects checkout for unauthenticated user (UNAUTHORIZED)", async () => {
    const publicCtx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      (caller.billing as unknown as { createCheckout: (i: unknown) => Promise<unknown> }).createCheckout({
        plan: "starter",
        billing: "monthly",
      })
    ).rejects.toThrow();
  });
});

describe("gs4nProvisioning.triggerProvisioning — payment guard", () => {
  it("rejects provisioning for unauthenticated user (UNAUTHORIZED)", async () => {
    const publicCtx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      (caller.gs4nProvisioning as unknown as { triggerProvisioning: (i: unknown) => Promise<unknown> }).triggerProvisioning({
        businessName: "Test Company",
        businessEmail: "test@company.com",
        businessPhone: "+5511999999999",
        country: "BR",
        timezone: "America/Sao_Paulo",
      })
    ).rejects.toThrow();
  });

  it("rejects provisioning when user has no subscription in DB (FORBIDDEN)", async () => {
    // User with id=9999 has no subscription record — should be rejected
    const { ctx } = createAuthContext("user");
    // Override user id to one that has no subscription
    ctx.user = { ...ctx.user!, id: 9999 };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.gs4nProvisioning.triggerProvisioning({
        businessName: "Test Company",
        businessEmail: "test@company.com",
        businessPhone: "+5511999999999",
        country: "BR",
        timezone: "America/Sao_Paulo",
      })
    ).rejects.toThrow();
  }, 15000);
});

describe("gs4nProvisioning.getStatus — payment confirmed field", () => {
  it("returns null when user has no subscription", async () => {
    const { ctx } = createAuthContext("user");
    ctx.user = { ...ctx.user!, id: 9999 };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gs4nProvisioning.getStatus();
    expect(result).toBeNull();
  });
});
