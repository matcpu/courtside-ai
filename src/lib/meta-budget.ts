import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./server";
export type MetaBudgetContext = {
  league: string;
  actor: string;
  caseId?: string;
};
export type MetaBudgetRPC = (
  action: string,
  payload: Record<string, unknown>,
) => Promise<Record<string, any>>;
/** Server/operator only. The RPC is unavailable to browsers and anonymous clients. */
export const metaBudgetRPC: MetaBudgetRPC = async (action, payload) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url !== "https://xdmkgoradmbnjofmbojs.supabase.co" || !key)
    throw new ApiError(
      "Cumulative Meta spending controls are unavailable; inference stopped",
      503,
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("meta_finance", {
    p_action: action,
    p_payload: payload,
  });
  if (error)
    throw new ApiError(
      "Meta spending control stopped this request: " + error.message,
      409,
    );
  return data;
};
