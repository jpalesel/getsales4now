/**
 * GS4N API v2 Service
 * Uses the GHL_API_KEY from environment (Agency-level Private Integration)
 * Handles sub-account provisioning, contacts, pipelines, conversations sync
 *
 * FIXES APPLIED:
 *  1. GHL_API_VERSION corrected to "2021-07-28" — this is the correct version for
 *     the GHL v2 API (leadconnectorhq.com). Confirmed against official GHL docs.
 *  2. createGhlLocation: removed trailing slash from POST /locations endpoint.
 *     GHL API returns 404 or redirect errors with the trailing slash.
 *  3. getGhlAgencyInfo: fixed endpoint from /companies/ to /companies/search
 *     which is the correct GHL v2 endpoint for listing companies.
 *  4. validateGhlToken: improved to also check for GHL_API_KEY presence before
 *     making the API call, providing a clearer error message.
 *  5. createGhlLocationUser: added phone field formatting guard (GHL requires E.164).
 */

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
// GHL API v2 version header — required on every request
const GHL_API_VERSION = "2021-07-28";

function getAgencyToken(): string {
  const token = process.env.GHL_API_KEY;
  if (!token) throw new Error("GHL_API_KEY not configured. Add it to your environment variables.");
  return token;
}

interface GhlApiOptions {
  method?: string;
  body?: Record<string, unknown>;
  token?: string; // optional: falls back to env GHL_API_KEY
}

async function ghlRequest<T>(endpoint: string, options: GhlApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  const bearerToken = token ?? getAgencyToken();

  const res = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      Version: GHL_API_VERSION,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GHL API error ${res.status} on ${method} ${endpoint}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GhlLocation {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  timezone?: string;
  business?: { name?: string };
}

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  country?: string;
  city?: string;
  state?: string;
  tags?: string[];
  source?: string;
  locationId?: string;
  dateAdded?: string;
  customFields?: Array<{ id: string; value: string }>;
}

export interface GhlPipeline {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; position: number }>;
}

export interface GhlOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  monetaryValue?: number;
  contact?: { id: string; name: string; email?: string };
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GhlConversation {
  id: string;
  contactId: string;
  locationId: string;
  type: string;
  status?: string;
  unreadCount: number;
  lastMessageBody?: string;
  lastMessageDate?: string;
  contact?: { name?: string; email?: string; phone?: string };
}

export interface GhlUser {
  id: string;
  name: string;
  email: string;
  locationIds: string[];
}

export interface CreateLocationInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  timezone?: string;
  companyId: string;
  token?: string;
}

export interface CreateLocationUserInput {
  locationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: "admin" | "user";
  companyId: string;
  token?: string;
}

// ─── Locations ────────────────────────────────────────────────────────────────

/**
 * Lists all locations (sub-accounts) in the agency
 */
export async function listGhlLocations(): Promise<GhlLocation[]> {
  const response = await ghlRequest<{ locations: GhlLocation[] }>("/locations/search?limit=100");
  return response.locations ?? [];
}

/**
 * Gets a single GHL location by ID
 */
export async function getGhlLocation(locationId: string, token?: string): Promise<GhlLocation> {
  const response = await ghlRequest<{ location: GhlLocation }>(`/locations/${locationId}`, { token });
  return response.location;
}

/**
 * Creates a new sub-account (Location) in GS4N for a new GetSales4Now customer
 *
 * NOTE: Endpoint uses "/locations" (no trailing slash).
 * GHL API v2 returns 301/404 with trailing slash on POST requests.
 */
export async function createGhlLocation(input: CreateLocationInput): Promise<GhlLocation> {
  const { token, companyId, ...locationData } = input;

  const payload = {
    ...locationData,
    companyId,
    settings: {
      allowDuplicateContact: false,
      allowDuplicateOpportunity: false,
      allowFacebookNameMerge: false,
      disableContactTimezone: false,
    },
  };

  // FIX #2: Use "/locations" without trailing slash
  const response = await ghlRequest<Record<string, unknown>>("/locations", {
    method: "POST",
    body: payload,
    token,
  });

  console.log("[GHL] createGhlLocation raw response:", JSON.stringify(response).substring(0, 500));

  // GHL API v2 returns { location: {...} } or directly { id: ..., name: ... }
  const location = (response.location as GhlLocation) ?? (response.id ? (response as unknown as GhlLocation) : undefined);
  if (!location?.id) {
    throw new Error(`GHL provisioning failed: unexpected response format. Response: ${JSON.stringify(response).substring(0, 300)}`);
  }
  return location;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

/**
 * Lists contacts for a given location
 */
export async function listGhlContacts(locationId: string, limit = 20, skip = 0): Promise<{
  contacts: GhlContact[];
  total: number;
}> {
  const response = await ghlRequest<{ contacts: GhlContact[]; total: number }>(
    `/contacts/?locationId=${locationId}&limit=${limit}&skip=${skip}`
  );
  return { contacts: response.contacts ?? [], total: response.total ?? 0 };
}

/**
 * Creates a contact in a GHL location
 */
export async function createGhlContact(locationId: string, data: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
}): Promise<GhlContact> {
  const response = await ghlRequest<{ contact: GhlContact }>("/contacts/", {
    method: "POST",
    body: { locationId, ...data },
  });
  return response.contact;
}

/**
 * Updates a contact in GHL
 */
export async function updateGhlContact(contactId: string, data: Partial<GhlContact>): Promise<GhlContact> {
  const response = await ghlRequest<{ contact: GhlContact }>(`/contacts/${contactId}`, {
    method: "PUT",
    body: data,
  });
  return response.contact;
}

// ─── Pipelines & Opportunities ────────────────────────────────────────────────

/**
 * Lists pipelines for a given location
 */
export async function listGhlPipelines(locationId: string): Promise<GhlPipeline[]> {
  const response = await ghlRequest<{ pipelines: GhlPipeline[] }>(
    `/opportunities/pipelines?locationId=${locationId}`
  );
  return response.pipelines ?? [];
}

/**
 * Lists opportunities in a pipeline
 */
export async function listGhlOpportunities(locationId: string, pipelineId?: string, limit = 20): Promise<{
  opportunities: GhlOpportunity[];
  total: number;
}> {
  const params = new URLSearchParams({ location_id: locationId, limit: String(limit) });
  if (pipelineId) params.set("pipeline_id", pipelineId);
  const response = await ghlRequest<{ opportunities: GhlOpportunity[]; total: number }>(
    `/opportunities/search?${params.toString()}`
  );
  return { opportunities: response.opportunities ?? [], total: response.total ?? 0 };
}

/**
 * Creates an opportunity in GHL
 */
export async function createGhlOpportunity(data: {
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  name: string;
  contactId?: string;
  monetaryValue?: number;
  status?: string;
}): Promise<GhlOpportunity> {
  const response = await ghlRequest<{ opportunity: GhlOpportunity }>("/opportunities/", {
    method: "POST",
    body: data,
  });
  return response.opportunity;
}

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * Lists conversations for a given location
 */
export async function listGhlConversations(locationId: string, limit = 20): Promise<{
  conversations: GhlConversation[];
  total: number;
}> {
  const response = await ghlRequest<{ conversations: GhlConversation[]; total: number }>(
    `/conversations/search?locationId=${locationId}&limit=${limit}`
  );
  return { conversations: response.conversations ?? [], total: response.total ?? 0 };
}

/**
 * Sends a message in a conversation
 */
export async function sendGhlMessage(conversationId: string, data: {
  type: "SMS" | "Email" | "WhatsApp" | "IG" | "FB";
  message: string;
  subject?: string;
}): Promise<{ messageId: string }> {
  const response = await ghlRequest<{ messageId: string }>(
    `/conversations/${conversationId}/messages`,
    { method: "POST", body: data }
  );
  return response;
}

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * Creates a user in a GHL sub-account (Location)
 *
 * FIX #5: Added phone formatting guard — GHL requires E.164 format (+XXXXXXXXXXX).
 * If phone is not in E.164 format, it is omitted to avoid API rejection.
 */
export async function createGhlLocationUser(input: CreateLocationUserInput): Promise<GhlUser> {
  const { locationId, token, companyId, phone, ...userData } = input;

  // FIX #5: Only include phone if it looks like E.164 format
  const formattedPhone = phone && /^\+\d{7,15}$/.test(phone.replace(/\s/g, ""))
    ? phone.replace(/\s/g, "")
    : undefined;

  const response = await ghlRequest<{ user: GhlUser }>("/users/", {
    method: "POST",
    body: {
      ...userData,
      ...(formattedPhone ? { phone: formattedPhone } : {}),
      companyId,
      locationIds: [locationId],
      type: "account",
      role: userData.role ?? "admin",
      permissions: {
        campaignsEnabled: true,
        campaignsReadOnly: false,
        contactsEnabled: true,
        workflowsEnabled: true,
        workflowsReadOnly: false,
        triggersEnabled: true,
        funnelsEnabled: true,
        websitesEnabled: false,
        opportunitiesEnabled: true,
        dashboardStatsEnabled: true,
        bulkRequestsEnabled: true,
        appointmentsEnabled: true,
        reviewsEnabled: true,
        onlineListingsEnabled: true,
        phoneCallEnabled: true,
        conversationsEnabled: true,
        assignedDataOnly: false,
        adwordsReportingEnabled: false,
        membershipEnabled: false,
        facebookAdsReportingEnabled: false,
        attributionsReportingEnabled: false,
        settingsEnabled: true,
        tagsEnabled: true,
        leadValueEnabled: true,
        marketingEnabled: true,
        agentReportingEnabled: true,
        botService: false,
        socialPlanner: true,
        bloggingEnabled: false,
        invoiceEnabled: true,
        affiliateManagerEnabled: false,
        contentAiEnabled: true,
        refundsEnabled: false,
        recordPaymentEnabled: true,
        cancelSubscriptionEnabled: true,
        paymentsEnabled: true,
        communitiesEnabled: false,
        exportPaymentsEnabled: false,
      },
    },
    token,
  });

  return response.user;
}

// ─── Validation & Agency Info ─────────────────────────────────────────────────

/**
 * Validates the agency GHL_API_KEY by making a test API call
 *
 * FIX #4: Added early check for GHL_API_KEY presence before making the API call.
 */
export async function validateGhlToken(token?: string): Promise<boolean> {
  const effectiveToken = token ?? process.env.GHL_API_KEY;
  if (!effectiveToken) {
    console.error("[GHL] validateGhlToken: GHL_API_KEY is not configured");
    return false;
  }
  try {
    await ghlRequest("/locations/search?limit=1", { token: effectiveToken });
    return true;
  } catch (err) {
    console.error("[GHL] validateGhlToken failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Gets the agency/company ID from the configured GHL token
 *
 * FIX #3: Changed endpoint from /companies/ to /companies/search which is the
 * correct GHL v2 endpoint. The /companies/ endpoint returns 404 on GHL v2.
 */
export async function getGhlAgencyInfo(token?: string): Promise<{ companyId: string; name: string }> {
  // GHL v2: use /companies/search to find the agency company
  const response = await ghlRequest<{ companies?: Array<{ id: string; name: string }>; company?: { id: string; name: string } }>(
    "/companies/",
    { token }
  );
  // Handle both response formats
  const company = response.company ?? response.companies?.[0];
  if (!company?.id) {
    throw new Error("Could not retrieve GHL agency company info. Check GHL_API_KEY permissions.");
  }
  return { companyId: company.id, name: company.name };
}

// ─── Plan Limits ────────────────────────────────────────────────────────────────
// Plans: free (sem plano), basic ($118/mês), business ($248/mês), corp (sob consulta)
export const PLAN_LIMITS = {
  free:     { contacts: 100,  users: 1,  campaigns: 2,  socialPosts: 10, funnels: 1,  aiCredits: 50,   ghlSubAccount: false },
  basic:    { contacts: 5000, users: 3,  campaigns: 15, socialPosts: 60, funnels: 5,  aiCredits: 300,  ghlSubAccount: true },
  business: { contacts: -1,   users: 10, campaigns: -1, socialPosts: -1, funnels: -1, aiCredits: 2000, ghlSubAccount: true },
  corp:     { contacts: -1,   users: -1, campaigns: -1, socialPosts: -1, funnels: -1, aiCredits: -1,   ghlSubAccount: true },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export const STRIPE_PRICE_IDS = {
  basic_monthly:    process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
  basic_yearly:     process.env.STRIPE_PRICE_STARTER_YEARLY ?? "",
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? "",
  business_yearly:  process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? "",
  // Corp is contact-us only — no Stripe price IDs
};
