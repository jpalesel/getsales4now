import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  users,
  contacts,
  companies,
  opportunities,
  pipelines,
  tasks,
  campaigns,
  socialPosts,
  funnels,
  conversations,
  messages,
  agentActions,
  integrations,
  templates,
  appSettings,
  auditLogs,
  userSessions,
  subscriptions,
  ghlProvisioningLogs,
} from "../drizzle/schema";
import {
  createGhlLocation,
  createGhlLocationUser,
  validateGhlToken,
  listGhlLocations,
  listGhlContacts,
  listGhlPipelines,
  listGhlOpportunities,
  listGhlConversations,
  PLAN_LIMITS,
  type PlanType,
} from "./ghl";
import Stripe from "stripe";
// FIX: Use a lazy getter so Stripe is not initialized at module load time.
// This prevents test failures when STRIPE_SECRET_KEY is not set in the test environment.
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "STRIPE_SECRET_KEY not configured" });
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}
// Keep a module-level instance for non-test environments
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" }) : null;

// Stripe Price IDs — Basic ($118/mo) and Business ($248/mo)
const STRIPE_PRICES: Record<string, Record<string, string>> = {
  basic:    { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "", yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? "" },
  business: { monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? "", yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? "" },
  // Corp is contact-us only — no Stripe price
};
import { TRPCError } from "@trpc/server";
import { authOwnRouter } from "./routers/authOwn";
import { ghlSyncRouter } from "./routers/ghlSyncRouter";
import { eq, desc, and, like, or, sql, count } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── AUTH ROUTER ──────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── ONBOARDING ROUTER ────────────────────────────────────────────────────────
const onboardingRouter = router({
  complete: protectedProcedure
    .input(z.object({
      language: z.enum(["en", "es", "pt"]),
      country: z.string(),
      businessType: z.string(),
      businessName: z.string(),
      primaryObjective: z.string(),
      channels: z.array(z.string()),
      brandVoice: z.string(),
      targetAudience: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(users)
        .set({
          uiLanguage: input.language,
          operationalLanguage: input.language,
          country: input.country,
          businessType: input.businessType,
          businessName: input.businessName,
          primaryObjective: input.primaryObjective,
          brandVoice: input.brandVoice,
          targetAudience: input.targetAudience,
          onboardingCompleted: true,
          onboardingStep: 8,
        })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { completed: false, step: 0 };
    const result = await db.select({
      onboardingCompleted: users.onboardingCompleted,
      onboardingStep: users.onboardingStep,
    }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return result[0] ?? { onboardingCompleted: false, onboardingStep: 0 };
  }),
});

// ─── CRM ROUTER ───────────────────────────────────────────────────────────────
const crmRouter = router({
  // Contacts
  listContacts: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const conditions = [eq(contacts.userId, ctx.user.id)];
      if (input.status) conditions.push(eq(contacts.status, input.status as "new" | "contacted" | "qualified" | "converted" | "lost" | "inactive"));
      const items = await db.select().from(contacts)
        .where(and(...conditions))
        .orderBy(desc(contacts.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return { items, total: items.length };
    }),

  createContact: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      whatsapp: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      country: z.string().optional(),
      language: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(contacts).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  updateContact: protectedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      status: z.string().optional(),
      leadScore: z.number().optional(),
      nextAction: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, status, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      if (status) updateData.status = status as "new" | "contacted" | "qualified" | "converted" | "lost" | "inactive";
      await db.update(contacts).set(updateData).where(and(eq(contacts.id, id), eq(contacts.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteContact: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(contacts).where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.user.id)));
      return { success: true };
    }),

  // Companies
  listCompanies: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const items = await db.select().from(companies)
        .where(eq(companies.userId, ctx.user.id))
        .orderBy(desc(companies.createdAt))
        .limit(input.limit).offset(input.offset);
      return { items, total: items.length };
    }),

  createCompany: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      industry: z.string().optional(),
      website: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(companies).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  // Opportunities
  listOpportunities: protectedProcedure
    .input(z.object({ pipelineId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(opportunities.userId, ctx.user.id)];
      if (input.status) conditions.push(eq(opportunities.status, input.status as "open" | "won" | "lost"));
      if (input.pipelineId) conditions.push(eq(opportunities.pipelineId, input.pipelineId));
      return db.select().from(opportunities).where(and(...conditions)).orderBy(desc(opportunities.createdAt));
    }),

  createOpportunity: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      contactId: z.number().optional(),
      companyId: z.number().optional(),
      pipelineId: z.number().optional(),
      value: z.string().optional(),
      stage: z.string().optional(),
      probability: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(opportunities).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  updateOpportunityStage: protectedProcedure
    .input(z.object({ id: z.number(), stage: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(opportunities).set({ stage: input.stage })
        .where(and(eq(opportunities.id, input.id), eq(opportunities.userId, ctx.user.id)));
      return { success: true };
    }),

  // Tasks
  listTasks: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(tasks.userId, ctx.user.id)];
      if (input.status) conditions.push(eq(tasks.status, input.status as "pending" | "in_progress" | "done" | "cancelled"));
      return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt));
    }),

  createTask: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      contactId: z.number().optional(),
      opportunityId: z.number().optional(),
      dueAt: z.date().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(tasks).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  // Pipelines
  listPipelines: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(pipelines).where(eq(pipelines.userId, ctx.user.id));
  }),

  createPipeline: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      stages: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), order: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(pipelines).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  // AI suggestion for next action
  suggestNextAction: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [contact] = await db.select().from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id))).limit(1);
      if (!contact) throw new Error("Contact not found");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a CRM assistant. Suggest the next best action for a sales rep to take with this contact. Be concise and practical. Reply in the same language as the contact's language field." },
          { role: "user", content: `Contact: ${contact.firstName} ${contact.lastName ?? ""}, Status: ${contact.status}, Lead Score: ${contact.leadScore}, Last contacted: ${contact.lastContactedAt ?? "never"}, Notes: ${contact.notes ?? "none"}` },
        ],
      });
      const rawSuggestion = response.choices[0]?.message?.content;
      const suggestion = typeof rawSuggestion === "string" ? rawSuggestion : "Follow up with a personalized message.";
      await db.update(contacts).set({ nextAction: suggestion }).where(eq(contacts.id, input.contactId));
      return { suggestion };
    }),
});

// ─── CAMPAIGNS ROUTER ─────────────────────────────────────────────────────────
const campaignsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), channel: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(campaigns.userId, ctx.user.id)];
      if (input.status) conditions.push(eq(campaigns.status, input.status as "draft" | "pending_approval" | "active" | "paused" | "completed" | "cancelled"));
      if (input.channel) conditions.push(eq(campaigns.channel, input.channel as "email" | "whatsapp" | "sms" | "multi"));
      return db.select().from(campaigns).where(and(...conditions)).orderBy(desc(campaigns.createdAt));
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      objective: z.enum(["leads", "sales", "booking", "retention", "followup", "reactivation"]),
      channel: z.enum(["email", "whatsapp", "sms", "multi"]),
      language: z.string().optional(),
      targetNiche: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(campaigns).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["draft", "pending_approval", "active", "paused", "completed", "cancelled"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(campaigns).set({ status: input.status })
        .where(and(eq(campaigns.id, input.id), eq(campaigns.userId, ctx.user.id)));
      return { success: true };
    }),

  generateContent: protectedProcedure
    .input(z.object({
      objective: z.string(),
      channel: z.string(),
      niche: z.string(),
      language: z.string(),
      brandVoice: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const langMap: Record<string, string> = { en: "English", es: "Spanish (Latin American)", pt: "Brazilian Portuguese" };
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a marketing copywriter specializing in small business campaigns. Write in ${langMap[input.language] ?? "English"}.` },
          { role: "user", content: `Create a ${input.channel} campaign for a ${input.niche} business with objective: ${input.objective}. Brand voice: ${input.brandVoice ?? "friendly"}. Include subject line (if email), main message, and CTA. Format as JSON with fields: subject, message, cta.` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "campaign_content",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject: { type: "string" },
                message: { type: "string" },
                cta: { type: "string" },
              },
              required: ["subject", "message", "cta"],
              additionalProperties: false,
            },
          },
        },
      });
      const rawContent = response.choices[0]?.message?.content;
      const content = JSON.parse(typeof rawContent === "string" ? rawContent : "{}");
      return content as { subject: string; message: string; cta: string };
    }),

  listTemplates: protectedProcedure
    .input(z.object({ type: z.string().optional(), language: z.string().optional(), niche: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(templates.isSystem, true)];
      if (input.type) conditions.push(eq(templates.type, input.type as "campaign" | "social_post" | "funnel" | "email" | "whatsapp" | "sms" | "bot"));
      if (input.language) conditions.push(eq(templates.language, input.language));
      if (input.niche) conditions.push(eq(templates.niche, input.niche));
      return db.select().from(templates).where(and(...conditions));
    }),
});

// ─── SOCIAL MEDIA ROUTER ──────────────────────────────────────────────────────
const socialRouter = router({
  listPosts: protectedProcedure
    .input(z.object({ status: z.string().optional(), month: z.number().optional(), year: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(socialPosts.userId, ctx.user.id)];
      if (input.status) conditions.push(eq(socialPosts.status, input.status as "draft" | "scheduled" | "published" | "failed"));
      return db.select().from(socialPosts).where(and(...conditions)).orderBy(desc(socialPosts.createdAt));
    }),

  createPost: protectedProcedure
    .input(z.object({
      content: z.string().min(1),
      channels: z.array(z.string()),
      hashtags: z.array(z.string()).optional(),
      postType: z.enum(["organic", "ad", "story", "reel"]).optional(),
      audience: z.enum(["b2b", "b2c", "both"]).optional(),
      language: z.string().optional(),
      scheduledAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const status = input.scheduledAt ? "scheduled" : "draft";
      await db.insert(socialPosts).values({ ...input, userId: ctx.user.id, status });
      return { success: true };
    }),

  generatePost: protectedProcedure
    .input(z.object({
      topic: z.string(),
      niche: z.string(),
      language: z.string(),
      audience: z.enum(["b2b", "b2c", "both"]),
      tone: z.string().optional(),
      includeHashtags: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const langMap: Record<string, string> = { en: "English", es: "Spanish (Latin American)", pt: "Brazilian Portuguese" };
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a social media expert for small businesses. Write in ${langMap[input.language] ?? "English"}. Target audience: ${input.audience}. Tone: ${input.tone ?? "friendly"}.` },
          { role: "user", content: `Create an engaging social media post for a ${input.niche} business about: ${input.topic}. ${input.includeHashtags ? "Include 5-8 relevant hashtags." : ""} Format as JSON with fields: content, hashtags (array).` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "social_post",
            strict: true,
            schema: {
              type: "object",
              properties: {
                content: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
              },
              required: ["content", "hashtags"],
              additionalProperties: false,
            },
          },
        },
      });
      const rawSocial = response.choices[0]?.message?.content;
      return JSON.parse(typeof rawSocial === "string" ? rawSocial : "{}") as { content: string; hashtags: string[] };
    }),
});

// ─── FUNNELS ROUTER ───────────────────────────────────────────────────────────
const funnelsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(funnels).where(eq(funnels.userId, ctx.user.id)).orderBy(desc(funnels.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      objective: z.string().optional(),
      niche: z.string().optional(),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const defaultSteps = [
        { id: "landing", type: "landing_page", name: "Landing Page", conversionRate: 0 },
        { id: "form", type: "form", name: "Lead Form", conversionRate: 0 },
        { id: "thankyou", type: "thank_you", name: "Thank You Page", conversionRate: 0 },
      ];
      await db.insert(funnels).values({ ...input, userId: ctx.user.id, steps: defaultSteps });
      return { success: true };
    }),

  generateCopy: protectedProcedure
    .input(z.object({
      funnelId: z.number(),
      stepType: z.string(),
      niche: z.string(),
      language: z.string(),
      objective: z.string(),
    }))
    .mutation(async ({ input }) => {
      const langMap: Record<string, string> = { en: "English", es: "Spanish (Latin American)", pt: "Brazilian Portuguese" };
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a conversion copywriter. Write in ${langMap[input.language] ?? "English"}.` },
          { role: "user", content: `Write copy for a ${input.stepType} page for a ${input.niche} business. Objective: ${input.objective}. Return JSON with: headline, subheadline, body, cta_button_text.` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "funnel_copy",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string" },
                subheadline: { type: "string" },
                body: { type: "string" },
                cta_button_text: { type: "string" },
              },
              required: ["headline", "subheadline", "body", "cta_button_text"],
              additionalProperties: false,
            },
          },
        },
      });
      const rawFunnel = response.choices[0]?.message?.content;
      return JSON.parse(typeof rawFunnel === "string" ? rawFunnel : "{}") as { headline: string; subheadline: string; body: string; cta_button_text: string };
    }),
});

// ─── INBOX ROUTER ─────────────────────────────────────────────────────────────
const inboxRouter = router({
  listConversations: protectedProcedure
    .input(z.object({ status: z.string().optional(), channel: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(conversations.userId, ctx.user.id)];
      if (input.status) conditions.push(eq(conversations.status, input.status as "open" | "pending" | "resolved" | "bot"));
      if (input.channel) conditions.push(eq(conversations.channel, input.channel as "whatsapp" | "email" | "sms" | "webchat" | "voice"));
      return db.select().from(conversations).where(and(...conditions)).orderBy(desc(conversations.lastMessageAt));
    }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(messages).where(eq(messages.conversationId, input.conversationId)).orderBy(messages.sentAt);
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(messages).values({ conversationId: input.conversationId, role: "agent", content: input.content });
      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, input.conversationId));
      return { success: true };
    }),

  suggestReply: protectedProcedure
    .input(z.object({ conversationId: z.number(), lastMessage: z.string(), language: z.string().optional() }))
    .mutation(async ({ input }) => {
      const langMap: Record<string, string> = { en: "English", es: "Spanish (Latin American)", pt: "Brazilian Portuguese" };
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a helpful customer support agent. Reply in ${langMap[input.language ?? "en"] ?? "English"}. Be concise, friendly and professional.` },
          { role: "user", content: `Suggest a reply to this customer message: "${input.lastMessage}"` },
        ],
      });
      return { suggestion: response.choices[0]?.message?.content ?? "" };
    }),

  createConversation: protectedProcedure
    .input(z.object({
      channel: z.enum(["whatsapp", "email", "sms", "webchat", "voice"]),
      contactId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(conversations).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),
});

// ─── AI ROUTER ────────────────────────────────────────────────────────────────
const aiRouter = router({
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1),
      agentType: z.enum(["central", "crm", "content", "funnel", "support", "reports"]),
      language: z.string().optional(),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [userData] = db ? await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1) : [null];
      const langMap: Record<string, string> = { en: "English", es: "Spanish (Latin American)", pt: "Brazilian Portuguese" };
      const lang = input.language ?? userData?.uiLanguage ?? "en";

      const systemPrompts: Record<string, string> = {
        central: `You are the central AI assistant for GetSales4Now, a marketing and CRM platform. Help small business owners with any question about their business, marketing, sales, and operations. Always respond in ${langMap[lang] ?? "English"}. Be friendly, practical, and avoid jargon. The user's business type is: ${userData?.businessType ?? "unknown"}.`,
        crm: `You are a CRM specialist assistant. Help with contact management, lead scoring, pipeline optimization, and follow-up strategies. Respond in ${langMap[lang] ?? "English"}.`,
        content: `You are a content marketing specialist. Help create posts, campaigns, email sequences, and marketing copy. Respond in ${langMap[lang] ?? "English"}.`,
        funnel: `You are a conversion optimization expert. Help design and improve sales funnels, landing pages, and lead capture strategies. Respond in ${langMap[lang] ?? "English"}.`,
        support: `You are a customer support specialist. Help craft responses, manage conversations, and improve customer satisfaction. Respond in ${langMap[lang] ?? "English"}.`,
        reports: `You are a business analytics expert. Help interpret metrics, identify trends, and suggest actionable improvements. Respond in ${langMap[lang] ?? "English"}.`,
      };

      const historyMessages = (input.history ?? []).map((h) => ({ role: h.role, content: h.content }));

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompts[input.agentType] ?? systemPrompts.central },
          ...historyMessages,
          { role: "user", content: input.message },
        ],
      });

      const rawContent = response.choices[0]?.message?.content;
      const reply = typeof rawContent === "string" ? rawContent : "I'm here to help!";

      // Log the action
      if (db) {
        await db.insert(agentActions).values({
          userId: ctx.user.id,
          agentType: input.agentType,
          action: input.message.slice(0, 200),
          output: reply.slice(0, 500),
          status: "executed",
          requiresApproval: false,
        });
      }

      return { reply };
    }),

  listActions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(agentActions)
      .where(eq(agentActions.userId, ctx.user.id))
      .orderBy(desc(agentActions.createdAt))
      .limit(20);
  }),
});

// ─── REPORTS ROUTER ───────────────────────────────────────────────────────────
const reportsRouter = router({
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return {
      totalContacts: 0,
      newLeadsThisMonth: 0,
      openOpportunities: 0,
      activeCampaigns: 0,
      openConversations: 0,
      totalRevenue: 0,
    };

    const [contactCount] = await db.select().from(contacts).where(eq(contacts.userId, ctx.user.id));
    const [oppCount] = await db.select().from(opportunities)
      .where(and(eq(opportunities.userId, ctx.user.id), eq(opportunities.status, "open")));
    const [campaignCount] = await db.select().from(campaigns)
      .where(and(eq(campaigns.userId, ctx.user.id), eq(campaigns.status, "active")));
    const [convCount] = await db.select().from(conversations)
      .where(and(eq(conversations.userId, ctx.user.id), eq(conversations.status, "open")));

    return {
      totalContacts: contactCount ? 1 : 0,
      newLeadsThisMonth: 0,
      openOpportunities: oppCount ? 1 : 0,
      activeCampaigns: campaignCount ? 1 : 0,
      openConversations: convCount ? 1 : 0,
      totalRevenue: 0,
    };
  }),

  getAISummary: protectedProcedure
    .input(z.object({ language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const langMap: Record<string, string> = { en: "English", es: "Spanish (Latin American)", pt: "Brazilian Portuguese" };
      const lang = input.language ?? "en";

      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a business analytics assistant. Respond in ${langMap[lang] ?? "English"}. Be concise and actionable.` },
          { role: "user", content: "Give me 3 actionable suggestions to improve my sales and marketing performance this week. Format as a simple numbered list." },
        ],
      });
      const rawSummary = response.choices[0]?.message?.content;
      const summary = typeof rawSummary === "string" ? rawSummary : "";
      return { summary };
    }),
});

// ─── INTEGRATIONS ROUTER ──────────────────────────────────────────────────────
const integrationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(integrations).where(eq(integrations.userId, ctx.user.id));
  }),

  connect: protectedProcedure
    .input(z.object({
      provider: z.enum(["ghl", "n8n", "whatsapp", "email", "meta", "linkedin", "telephony", "webhook"]),
      name: z.string(),
      config: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(integrations).values({
        provider: input.provider,
        name: input.name,
        userId: ctx.user.id,
        config: (input.config ?? {}) as Record<string, string>,
        status: "connected",
        lastCheckedAt: new Date(),
      });
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["connected", "disconnected", "error", "pending"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(integrations).set({ status: input.status, lastCheckedAt: new Date() })
        .where(and(eq(integrations.id, input.id), eq(integrations.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── ADMIN ROUTER ────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const adminRouter = router({
  // ── Users management ──
  listUsers: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      role: z.enum(["user", "admin", "all"]).default("all"),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { users: [], total: 0 };
      let query = db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        businessType: users.businessType,
        businessName: users.businessName,
        uiLanguage: users.uiLanguage,
        country: users.country,
        onboardingCompleted: users.onboardingCompleted,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      }).from(users).$dynamic();
      if (input.search) {
        query = query.where(or(
          like(users.name, `%${input.search}%`),
          like(users.email, `%${input.search}%`),
        ));
      }
      if (input.role !== "all") {
        query = query.where(eq(users.role, input.role as "user" | "admin"));
      }
      const result = await query.orderBy(desc(users.createdAt)).limit(input.limit).offset((input.page - 1) * input.limit);
      return { users: result, total: result.length };
    }),

  getUserDetail: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const contactCount = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.userId, input.userId));
      const campaignCount = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, input.userId));
      const sessions = await db.select().from(userSessions).where(eq(userSessions.userId, input.userId)).orderBy(desc(userSessions.lastActiveAt)).limit(5);
      return { user, contactCount: contactCount.length, campaignCount: campaignCount.length, sessions };
    }),

  updateUserRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: `Updated user role to ${input.role}`,
        entity: "user",
        entityId: input.userId,
        details: { role: input.role },
      });
      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete your own account" });
      await db.delete(users).where(eq(users.id, input.userId));
      await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: "Deleted user account",
        entity: "user",
        entityId: input.userId,
        details: {},
      });
      return { success: true };
    }),

  // ── App Settings ──
  listSettings: adminProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input.category) {
        return db.select().from(appSettings).where(eq(appSettings.category, input.category)).orderBy(appSettings.key);
      }
      return db.select().from(appSettings).orderBy(appSettings.category, appSettings.key);
    }),

  updateSetting: adminProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(appSettings)
        .set({ value: input.value, updatedBy: ctx.user.id })
        .where(eq(appSettings.key, input.key));
      await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: `Updated setting: ${input.key}`,
        entity: "app_setting",
        details: { key: input.key, value: input.value },
      });
      return { success: true };
    }),

  // ── Audit Logs ──
  listAuditLogs: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      userId: z.number().optional(),
      entity: z.string().optional(),
      limit: z.number().default(50),
      page: z.number().default(1),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);
    }),

  // ── Suspend/Unsuspend User ──
  suspendUser: adminProcedure
    .input(z.object({ userId: z.number(), suspended: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot suspend your own account" });
      // We use the loginMethod field as a suspension flag (prefix 'suspended:')
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      const newMethod = input.suspended
        ? `suspended:${target.loginMethod ?? "manus"}`
        : (target.loginMethod ?? "manus").replace(/^suspended:/, "");
      await db.update(users).set({ loginMethod: newMethod }).where(eq(users.id, input.userId));
      await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: input.suspended ? "Suspended user account" : "Unsuspended user account",
        entity: "user",
        entityId: input.userId,
        details: { suspended: input.suspended },
      });
      return { success: true };
    }),

  // ── System Stats ──
  getSystemStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [{ totalUsers }] = await db.select({ totalUsers: count(users.id) }).from(users);
    const [{ adminUsers }] = await db.select({ adminUsers: count(users.id) }).from(users).where(eq(users.role, "admin"));
    const [{ totalContacts }] = await db.select({ totalContacts: count(contacts.id) }).from(contacts);
    const [{ totalCampaigns }] = await db.select({ totalCampaigns: count(campaigns.id) }).from(campaigns);
    const [{ totalConversations }] = await db.select({ totalConversations: count(conversations.id) }).from(conversations);
    const [{ activeSessions }] = await db.select({ activeSessions: count(userSessions.id) }).from(userSessions).where(eq(userSessions.isActive, true));
    const recentLogs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(5);
    // Integration health: check which integrations are active
    const allIntegrations = await db.select({ provider: integrations.provider, status: integrations.status })
      .from(integrations);
    const connectedProviders = new Set(allIntegrations.filter(i => i.status === "connected").map(i => i.provider));
    const integrationHealth = [
      { name: "GS4N", status: connectedProviders.has("ghl") ? "connected" : "disconnected" },
      { name: "WhatsApp Business", status: connectedProviders.has("whatsapp") ? "connected" : "disconnected" },
      { name: "Meta Ads", status: connectedProviders.has("meta") ? "connected" : "disconnected" },
      { name: "Email (SMTP)", status: connectedProviders.has("email") ? "connected" : "disconnected" },
      { name: "n8n Workflows", status: connectedProviders.has("n8n") ? "connected" : "disconnected" },
    ];
    return {
      totalUsers,
      adminUsers,
      totalContacts,
      totalCampaigns,
      totalConversations,
      activeSessions,
      recentLogs,
      integrationHealth,
      serverTime: new Date(),
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
    };
  }),

  // ── Permissions Matrix ──
  getPermissionsMatrix: adminProcedure.query(() => {
    return [
      { module: "Dashboard", user: true, admin: true },
      { module: "CRM", user: true, admin: true },
      { module: "Campaigns", user: true, admin: true },
      { module: "Social Media", user: true, admin: true },
      { module: "Funnels", user: true, admin: true },
      { module: "Inbox", user: true, admin: true },
      { module: "AI Copilots", user: true, admin: true },
      { module: "Reports", user: true, admin: true },
      { module: "Integrations", user: true, admin: true },
      { module: "Admin Panel", user: false, admin: true },
      { module: "User Management", user: false, admin: true },
      { module: "App Settings", user: false, admin: true },
      { module: "Audit Logs", user: false, admin: true },
      { module: "System Health", user: false, admin: true },
    ];
  }),
});

// ─── BILLING ROUTER ─────────────────────────────────────────────────────────
const billingRouter = router({
  getPlans: publicProcedure.query(() => {
    return [
      {
        id: "basic",
        name: "Basic",
        description: "Pare de perder clientes e responda na hora — sem precisar mexer em tecnologia.",
        price: { monthly: 118, yearly: Math.round(118 * 12 * 0.8) },
        monthlyPrice: 118,
        yearlyPrice: Math.round(118 * 12 * 0.8),
        setupFee: 120,
        currency: "USD",
        limits: PLAN_LIMITS.basic,
        features: [
          "Respostas automáticas para seus clientes (24h)",
          "Todas as mensagens em um só lugar (WhatsApp e SMS)",
          "Follow-up automático para não perder clientes",
          "Ligações direto do sistema",
          "Organização simples dos seus clientes",
          "Agenda e calendário configurado automático ou manual",
          "Publicação nas mídias sociais",
          "Tudo configurado para você — sem precisar de tecnologia",
        ],
        notIncluded: ["Múltiplos números de WhatsApp", "Chamadas de vídeo", "Plataforma de treinamento", "Múltiplos usuários"],
        summary: "Um sistema completo de atendimento e vendas configurado pela nossa equipe. Você só precisa usar.",
        highlighted: false,
        trialDays: 0,
        contactSales: false,
      },
      {
        id: "business",
        name: "Business",
        description: "Um sistema completo para organizar, automatizar e escalar seus clientes — sem perder oportunidades.",
        price: { monthly: 248, yearly: Math.round(248 * 12 * 0.8) },
        monthlyPrice: 248,
        yearlyPrice: Math.round(248 * 12 * 0.8),
        setupFee: 250,
        currency: "USD",
        limits: PLAN_LIMITS.business,
        features: [
          "Tudo do Basic, mais:",
          "Gerencie todos seus clientes em um só lugar (WhatsApp, SMS, Mídias Sociais e mais)",
          "Até 5 números de WhatsApp — Voz e texto para sua equipe",
          "Respostas automáticas + conversas automatizadas avançadas",
          "Pipeline de vendas com controle total",
          "Chamadas de vídeo integradas com clientes",
          "Plataforma de treinamento para equipe ou clientes",
          "Acesso para múltiplos usuários",
          "Tudo configurado e pronto para uso",
        ],
        notIncluded: [],
        summary: "O sistema mais completo para empresas que querem crescer com organização, automação e atendimento de qualidade.",
        highlighted: true,
        trialDays: 0,
        contactSales: false,
      },
      {
        id: "corp",
        name: "Corp",
        description: "Ideal para empresas com múltiplas unidades, maior volume de leads e necessidade de personalização.",
        price: { monthly: 0, yearly: 0 },
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: "USD",
        limits: PLAN_LIMITS.business,
        features: [
          "Estrutura multiunidade",
          "Operações com maior volume",
          "Automação avançada",
          "Integrações via API",
          "Processos personalizados por departamento",
          "Suporte consultivo",
          "Arquitetura operacional sob medida",
          "Possibilidade de SLA",
        ],
        notIncluded: [],
        summary: "Um plano desenhado para empresas que precisam de flexibilidade, personalização e governança operacional em nível superior.",
        highlighted: false,
        trialDays: 0,
        contactSales: true,
      },
    ];
  }),

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
    return sub ?? null;
  }),

   createCheckout: protectedProcedure
    .input(z.object({
      plan: z.enum(["basic", "business"]),
      billing: z.enum(["monthly", "yearly"]).default("monthly"),
    }))
    .mutation(async ({ ctx, input }) => {
      const priceId = STRIPE_PRICES[input.plan]?.[input.billing];
      // FIX: Use APP_URL env var or derive from request — origin header may be absent in server-side calls
      const origin = (ctx.req.headers.origin as string) || process.env.APP_URL || "https://getsales4now.agency";
      // Real prices in cents
      const planPrices: Record<string, Record<string, number>> = {
        starter:  { monthly: 11800, yearly: Math.round(118 * 12 * 0.8 * 100) },
        basic:    { monthly: 11800, yearly: Math.round(118 * 12 * 0.8 * 100) },
        business: { monthly: 24800, yearly: Math.round(248 * 12 * 0.8 * 100) },
      };

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
        payment_method_collection: "always",
        client_reference_id: ctx.user.id.toString(),
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            user_id: ctx.user.id.toString(),
            plan: input.plan,
          },
        },
        metadata: {
          user_id: ctx.user.id.toString(),
          plan: input.plan,
          billing: input.billing,
          // FIX: Include price_id in session metadata so webhook can read it directly
          price_id: priceId ?? "",
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
        },
        success_url: `${origin}/ghl-onboarding?plan=${input.plan}&paid=true`,
        cancel_url: `${origin}/checkout?plan=${input.plan}&canceled=true`,
        line_items: [
          priceId
            ? { price: priceId, quantity: 1 }
            : {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `GetSales4Now ${input.plan.charAt(0).toUpperCase() + input.plan.slice(1)}`,
                    description: `${input.plan} plan - ${input.billing} billing`,
                  },
                  unit_amount: planPrices[input.plan]?.[input.billing] ?? 9700,
                  recurring: { interval: input.billing === "yearly" ? "year" : "month" },
                },
                quantity: 1,
              },
        ],
      };

      const session = await getStripe().checkout.sessions.create(sessionParams);
      return { url: session.url };
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
    if (!sub?.stripeSubscriptionId) throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription" });
    await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    await db.update(subscriptions).set({ status: "canceled", canceledAt: new Date() }).where(eq(subscriptions.userId, ctx.user.id));
    return { success: true };
  }),

  getProvisioningStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
    if (!sub) return null;
    const logs = await db.select().from(ghlProvisioningLogs).where(eq(ghlProvisioningLogs.userId, ctx.user.id)).orderBy(desc(ghlProvisioningLogs.createdAt)).limit(10);
    return { subscription: sub, logs };
  }),
});

// ─── GS4N PROVISIONING ROUTER ─────────────────────────────────────────────────
const ghlProvisioningRouter = router({
  triggerProvisioning: protectedProcedure
    .input(z.object({
      // NOTE: O token GHL NÃO é fornecido pelo cliente.
      // A GHL_API_KEY da agência é usada automaticamente pelo servidor.
      businessName: z.string().min(2),
      businessEmail: z.string().email(),
      businessPhone: z.string().optional(),
      country: z.string().optional(),
      timezone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Usar a GHL_API_KEY da agência — o cliente NÃO fornece token
      const agencyToken = process.env.GHL_API_KEY;
      if (!agencyToken) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configuração da agência incompleta. Entre em contato com o suporte." });

      // Validar o token da agência
      const isValid = await validateGhlToken(agencyToken);
      if (!isValid) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Token da agência inválido. Entre em contato com o suporte." });

      // ─── VERIFICAÇÃO DE PAGAMENTO STRIPE ────────────────────────────────────────
      // REGRA: A sub-conta GS4N só pode ser criada se o usuário tiver um
      // stripeSubscriptionId válido OU uma sessão de checkout paga no Stripe.
      // Apenas ter um plano "starter" ou "business" no banco NÃO é suficiente —
      // o usuário pode ter esse plano definido antes de pagar (durante o registro).
      let [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);

      // Verificar se o pagamento foi confirmado: precisa de stripeSubscriptionId OU status active/trialing com stripeCustomerId
      const hasConfirmedPayment = sub &&
        sub.plan !== "free" &&
        (sub.stripeSubscriptionId || sub.stripeCustomerId) &&
        (sub.status === "active" || sub.status === "trialing");

      if (!hasConfirmedPayment) {
        // Tentar buscar a sessão de checkout mais recente do Stripe para este usuário
        // (o webhook pode demorar alguns segundos após o redirect)
        let stripePaymentConfirmed = false;
        try {
          const sessions = await getStripe().checkout.sessions.list({ limit: 10 });
          // Procurar sessão com este user_id nos metadados E com pagamento confirmado
          const userSession = sessions.data.find(
            (s) => s.metadata?.user_id === ctx.user.id.toString() &&
              (s.payment_status === "paid" || s.status === "complete")
          );
          if (userSession && userSession.subscription) {
            stripePaymentConfirmed = true;
            const plan = (userSession.metadata?.plan ?? "starter") as PlanType;
            const limits = PLAN_LIMITS[plan];
            const stripeCustomerId = userSession.customer as string;
            const stripeSubscriptionId = userSession.subscription as string;
            if (!sub) {
              await db.insert(subscriptions).values({
                userId: ctx.user.id,
                plan,
                status: "active",
                stripeCustomerId,
                stripeSubscriptionId,
                contactsLimit: limits.contacts,
                usersLimit: limits.users,
                ghlStatus: "pending",
              });
            } else {
              await db.update(subscriptions).set({
                plan,
                status: "active",
                stripeCustomerId,
                stripeSubscriptionId,
                contactsLimit: limits.contacts,
                usersLimit: limits.users,
                ghlStatus: "pending",
              }).where(eq(subscriptions.userId, ctx.user.id));
            }
            // Recarregar assinatura
            [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
          }
        } catch (stripeErr) {
          console.error("[GHL Provisioning] Erro ao verificar Stripe:", stripeErr);
        }

        if (!stripePaymentConfirmed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Pagamento não confirmado. Complete o checkout do Stripe antes de criar sua conta. Se já pagou, aguarde alguns instantes e tente novamente.",
          });
        }
      }

      if (!sub) throw new TRPCError({ code: "FORBIDDEN", message: "Nenhuma assinatura encontrada. Verifique se o pagamento foi processado e tente novamente em alguns instantes." });
      if (sub.plan === "free") throw new TRPCError({ code: "FORBIDDEN", message: "Pagamento ainda sendo processado. Aguarde alguns instantes e tente novamente." });

      // Registrar início
      await db.insert(ghlProvisioningLogs).values({
        userId: ctx.user.id,
        subscriptionId: sub.id,
        action: "create_location",
        status: "pending",
        requestPayload: { businessName: input.businessName, email: input.businessEmail },
      });

      // Atualizar status para provisionando
      await db.update(subscriptions).set({ ghlStatus: "provisioning" }).where(eq(subscriptions.userId, ctx.user.id));

      try {
        // Usar o Company ID da plataforma SaaS getsales4now.com
        const ghlCompanyId = process.env.GHL_COMPANY_ID;
        if (!ghlCompanyId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Company ID da plataforma SaaS não configurado." });
        // Criar sub-conta GS4N dentro da plataforma SaaS getsales4now.com
        const location = await createGhlLocation({
          name: input.businessName,
          email: input.businessEmail,
          phone: input.businessPhone,
          country: input.country ?? "BR",
          timezone: input.timezone ?? "America/Sao_Paulo",
          companyId: ghlCompanyId,
          token: agencyToken,
        });

        // Criar usuário admin na nova sub-conta
        const fullName = ctx.user.name ?? input.businessName ?? "Admin";
        const nameParts = fullName.trim().split(" ");
        const firstName = nameParts[0] ?? "Admin";
        const lastName = nameParts.slice(1).join(" ") || firstName;
        await createGhlLocationUser({
          locationId: location.id,
          firstName,
          lastName,
          email: input.businessEmail,
          role: "admin",
          companyId: ghlCompanyId,
          token: agencyToken,
        });

        // Update subscription with GHL location
        await db.update(subscriptions).set({
          ghlLocationId: location.id,
          ghlLocationName: location.name,
          ghlProvisionedAt: new Date(),
          ghlStatus: "active",
        }).where(eq(subscriptions.userId, ctx.user.id));

        // Log success
        await db.insert(ghlProvisioningLogs).values({
          userId: ctx.user.id,
          subscriptionId: sub.id,
          action: "create_location",
          status: "success",
          ghlLocationId: location.id,
          responsePayload: { locationId: location.id, locationName: location.name },
        });

        // Salvar integração GHL na tabela de integrations
        const [existingIntegration] = await db.select().from(integrations)
          .where(and(eq(integrations.userId, ctx.user.id), eq(integrations.provider, "ghl")))
          .limit(1);

        if (existingIntegration) {
          await db.update(integrations).set({
            config: { locationId: location.id },
            status: "connected",
            lastCheckedAt: new Date(),
          }).where(eq(integrations.id, existingIntegration.id));
        } else {
          await db.insert(integrations).values({
            userId: ctx.user.id,
            provider: "ghl",
            name: "GS4N",
            config: { locationId: location.id },
            status: "connected",
            lastCheckedAt: new Date(),
          });
        }

        return { success: true, locationId: location.id, locationName: location.name };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await db.update(subscriptions).set({ ghlStatus: "failed" }).where(eq(subscriptions.userId, ctx.user.id));
        await db.insert(ghlProvisioningLogs).values({
          userId: ctx.user.id,
          subscriptionId: sub.id,
          action: "create_location",
          status: "failed",
          errorMessage: errorMsg,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `GS4N provisioning failed: ${errorMsg}` });
      }
    }),

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
    if (!sub) return null;
    const paymentConfirmed = !!(sub.stripeSubscriptionId || sub.stripeCustomerId) &&
      (sub.status === "active" || sub.status === "trialing") &&
      sub.plan !== "free";
    return {
      ghlStatus: sub.ghlStatus,
      ghlLocationId: sub.ghlLocationId,
      ghlLocationName: sub.ghlLocationName,
      paymentConfirmed,
      plan: sub.plan,
      subscriptionStatus: sub.status,
    };
  }),
});

// ─── APP ROUTER ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  onboarding: onboardingRouter,
  crm: crmRouter,
  campaigns: campaignsRouter,
  social: socialRouter,
  funnels: funnelsRouter,
  inbox: inboxRouter,
  ai: aiRouter,
  reports: reportsRouter,
  integrations: integrationsRouter,
   admin: adminRouter,
  billing: billingRouter,
  gs4nProvisioning: ghlProvisioningRouter,
  authOwn: authOwnRouter,
  ghlSync: ghlSyncRouter,
});
export type AppRouter = typeof appRouter;
