import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Snapshot } from "./domain";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function db(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new ApiError("Database connection is not configured", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });
}
export async function authenticate(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError("Sign in to continue", 401);
  const client = db(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new ApiError("Your session has expired. Sign in again.", 401);
  return { client, user: data.user };
}
export async function snapshot(client: SupabaseClient, league: string) {
  z.uuid().parse(league);
  const { data, error } = await client.rpc("league_snapshot", {
    p_league: league,
    p_public: false,
  });
  if (error) throw new ApiError("League access denied", 403);
  return data as Snapshot;
}
export function admin(s: Snapshot) {
  if (s.role !== "admin")
    throw new ApiError("Administrator access required", 403);
}
export async function reserveAI(
  client: SupabaseClient,
  league: string,
  purpose: string,
) {
  const { error } = await client.rpc("reserve_ai", {
    p_league: league,
    p_purpose: purpose,
  });
  if (error)
    throw new ApiError(
      "AI request limit reached or league access denied. Try again later.",
      429,
    );
}
export async function command(
  client: SupabaseClient,
  league: string | null,
  action: string,
  payload: unknown = {},
) {
  const { data, error } = await client.rpc("league_command", {
    p_league: league,
    p_action: action,
    p_payload: payload,
  });
  if (error) {
    const msg = error.message;
    if (error.code === "42501")
      throw new ApiError("You do not have permission for this action", 403);
    if (error.code === "23505")
      throw new ApiError(
        "This record already exists. Duplicate submissions are blocked.",
        409,
      );
    throw new ApiError(
      msg.replace(/\b[\w.+-]+@[\w.-]+\b/g, "[private address]"),
      400,
    );
  }
  return data;
}
export async function body(request: Request, max = 1000000) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) throw new ApiError("Request is too large", 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > max)
    throw new ApiError("Request is too large", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("Invalid JSON");
  }
}
export function fail(e: unknown) {
  if (e instanceof z.ZodError)
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 },
    );
  if (e instanceof ApiError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json(
    { error: "The operation could not be completed. Please retry." },
    { status: 500 },
  );
}
