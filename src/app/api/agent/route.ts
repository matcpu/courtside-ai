import { NextResponse } from "next/server";
import { z } from "zod";
import {
  admin,
  ApiError,
  authenticate,
  body,
  command,
  fail,
  snapshot,
  reserveAI,
} from "@/lib/server";
import {
  dataBoundary,
  metaModel,
  metaIsEnabled,
  metaReceipt,
} from "@/lib/meta";
import { recordMetaEvidence, redactCoachContext } from "@/lib/meta-evidence";
import { operationsTools, executeOperationTool } from "@/lib/operations-agent";
import { draftSchedule } from "../schedule/route";
import { assertMetaScope, controlledMetaRequest } from "@/lib/meta-control";
export const maxDuration = 60;
type ProviderOutput = {
  type: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  content?: { type: string; text?: string }[];
};
export async function POST(request: Request) {
  let run: string | undefined,
    context: Awaited<ReturnType<typeof authenticate>> | undefined,
    league: string | undefined;
  const trace: { tool: string; arguments?: unknown; outcome: unknown }[] = [];
  try {
    context = await authenticate(request);
    const b = z
      .object({ league: z.uuid(), objective: z.string().min(5).max(1000) })
      .parse(await body(request));
    league = b.league;
    const initialSnapshot = await snapshot(context.client, league);
    admin(initialSnapshot);
    if (!metaIsEnabled())
      throw new ApiError(
        "Meta requests are disabled. No API call was made.",
        503,
      );
    assertMetaScope("operations", league, context.user.id);
    const started = await context.client.rpc("record_workflow", {
      p_league: league,
      p_run: null,
      p_status: "running",
      p_steps: [],
    });
    if (started.error)
      throw new ApiError("Could not start an auditable operations run", 500);
    run = started.data;
    const input: unknown[] = [
        {
          role: "user",
          content: `League data revision: ${initialSnapshot.league.data_revision}. Operator objective: ${redactCoachContext(b.objective)}`,
        },
      ],
      used = new Set<string>(),
      deadline = Date.now() + 50000;
    for (let turn = 0; turn < 8 && Date.now() < deadline; turn++) {
      await reserveAI(context.client, league, "agent_turn");
      const requestBody = {
        model: metaModel(),
        store: false,
        instructions:
          dataBoundary +
          " You coordinate league administration. Choose tools to achieve the operator objective: inspect the league, investigate a suspected mismatch with verified team history, check preseason readiness, and prepare evidence-based proposals or feasible schedule drafts. Prioritize inconsistent competition and actionable next steps. You must inspect successfully before acting and investigate history before proposing balance. Each mutating tool may run at most once. A schedule uses CURRENT APPROVED divisions only: proposed moves require a human decision and another scheduling run afterward. Never approve placements, results, division moves or publication. Never send messages or inspect guardian documents. Preserve literal identifiers supplied by the operator; never substitute a placeholder or another UUID. Use canonical teamName/fromDivision/toDivision from actual proposal results, always associated with their returned IDs; do not reconstruct names from memory. Distinguish individually investigated teams from additional deterministic candidates. Batch independent inspections when useful. Be concise and do not repeat full league listings. Finish with at most 200 words citing actual successes, blocked actions, saved IDs and the next human decision. Stop at human approval. Do not claim a blocked tool succeeded.",
        tools: operationsTools,
        tool_choice: "auto",
        input,
        max_output_tokens: 2500,
        reasoning: { effort: "low" },
      };
      const serializedRequest = JSON.stringify(requestBody),
        requestSnapshot = JSON.parse(serializedRequest);
      const result = await controlledMetaRequest(
        requestSnapshot,
        "operations",
        deadline - Date.now(),
        { league, actor: context.user.id },
      );
      if (result.status !== "completed")
        throw new ApiError("Meta agent response was incomplete", 502);
      const output = (result.output ?? []) as ProviderOutput[],
        calls = output.filter((o) => o.type === "function_call");
      const message = output
        .filter((o) => o.type === "message")
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("");
      if (calls.length > 8)
        throw new ApiError("The agent exceeded its bounded tool budget", 502);
      input.push(...output);
      const turnTrace: typeof trace = [];
      for (let index = 0; index < calls.length; index++) {
        const call = calls[index];
        let outcome: unknown;
        try {
          if (index >= 3 || Date.now() >= deadline)
            throw new Error("This turn reached its bounded tool budget");
          outcome = await executeOperationTool(
            call.name ?? "",
            call.arguments ?? "{}",
            used,
            {
              snapshot: () => snapshot(context!.client, league!),
              propose: () =>
                command(context!.client, league!, "propose_balance"),
              draft: (round) =>
                draftSchedule(context!.client, league!, round, false),
            },
          );
        } catch (e) {
          outcome = { error: e instanceof Error ? e.message : "Tool failed" };
        }
        let args: unknown = {};
        try {
          args = JSON.parse(call.arguments ?? "{}");
        } catch {
          args = { invalid: true };
        }
        const entry = {
          tool: call.name ?? "unknown",
          arguments: args,
          outcome,
        };
        trace.push(entry);
        turnTrace.push(entry);
        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(outcome),
        });
      }
      await recordMetaEvidence(
        league,
        context.user.id,
        "operations",
        run!,
        metaReceipt(result, requestSnapshot, {
          message,
          calls: calls.map((c) => ({
            name: c.name,
            arguments: c.arguments,
            call_id: c.call_id,
          })),
        }),
        turnTrace,
      );
      const saved = await context.client.rpc("record_workflow", {
        p_league: league,
        p_run: run,
        p_status: calls.length ? "running" : "awaiting_approval",
        p_steps: trace,
      });
      if (saved.error)
        throw new ApiError(
          "Agent actions were saved, but its workflow receipt needs review",
          502,
        );
      if (!calls.length)
        return NextResponse.json({
          run,
          trace,
          message,
          requiresHumanApproval: true,
          providerEvidence: true,
        });
    }
    await context.client.rpc("record_workflow", {
      p_league: league,
      p_run: run,
      p_status: "awaiting_approval",
      p_steps: trace,
    });
    return NextResponse.json({
      run,
      trace,
      message:
        "The bounded operations run stopped. Review saved evidence, proposals and schedule drafts. Human approval is still required.",
      requiresHumanApproval: true,
      providerEvidence: true,
    });
  } catch (e) {
    if (run && context && league)
      await context.client.rpc("record_workflow", {
        p_league: league,
        p_run: run,
        p_status: "failed",
        p_steps: [
          ...trace,
          { tool: "agent", outcome: "Provider or workflow error" },
        ],
      });
    return fail(e);
  }
}
