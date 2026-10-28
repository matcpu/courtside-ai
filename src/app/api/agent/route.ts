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
import { dataBoundary, metaModel, metaIsEnabled } from "@/lib/meta";
import { draftSchedule } from "../schedule/route";
export const maxDuration = 60;
const tools = [
  {
    type: "function",
    name: "inspect_league",
    description:
      "Read team ratings, verified result summaries and available court time.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "propose_balance",
    description:
      "Run deterministic evidence checks and save division recommendations. Does not approve any move.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "draft_schedule",
    description:
      "Generate a constraint checked future schedule draft. Does not publish.",
    parameters: {
      type: "object",
      properties: { round: { type: "integer", minimum: 0, maximum: 499 } },
      required: ["round"],
      additionalProperties: false,
    },
    strict: true,
  },
];
export async function POST(request: Request) {
  let run: string | undefined;
  let context: Awaited<ReturnType<typeof authenticate>> | undefined;
  let league: string | undefined;
  const trace: { tool: string; outcome: unknown }[] = [];
  try {
    context = await authenticate(request);
    const b = z
      .object({ league: z.uuid(), objective: z.string().min(5).max(1000) })
      .parse(await body(request));
    league = b.league;
    admin(await snapshot(context.client, league));
    const key = process.env.MODEL_API_KEY;
    if (!key)
      throw new ApiError(
        "Connect Meta to run the league operations agent.",
        503,
      );
    if (!metaIsEnabled())
      throw new ApiError(
        "Meta requests are disabled while credits are pending. No API call was made.",
        503,
      );
    const started = await context.client.rpc("record_workflow", {
      p_league: league,
      p_run: null,
      p_status: "running",
      p_steps: [],
    });
    if (started.error) throw new ApiError(started.error.message, 429);
    run = started.data;
    const input: unknown[] = [{ role: "user", content: b.objective }];
    const deadline = Date.now() + 48000;
    const used = new Set<string>();
    for (let turn = 0; turn < 4 && Date.now() < deadline; turn++) {
      await reserveAI(context.client, league, "agent_turn");
      const response = await fetch("https://api.meta.ai/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: metaModel(),
          store: false,
          instructions:
            dataBoundary +
            " You are Courtside league operations coordinator. Inspect the league before acting. Choose the tools needed for the operator objective. Run each mutating tool at most once. Never approve placements, results, division moves or schedules; stop at human approval. Never send messages. Explain what succeeded and what needs approval. Do not claim a blocked operation succeeded.",
          tools,
          input,
          max_output_tokens: 2500,
        }),
        signal: AbortSignal.timeout(
          Math.max(1000, Math.min(20000, deadline - Date.now())),
        ),
      });
      if (!response.ok)
        throw new ApiError(
          `Meta agent request failed (${response.status}). Saved actions remain in the audit log.`,
          502,
        );
      const result = await response.json();
      if (result.status !== "completed")
        throw new ApiError("Meta agent response was incomplete", 502);
      input.push(...(result.output ?? []));
      const calls = (result.output ?? []).filter(
        (o: { type: string }) => o.type === "function_call",
      );
      if (!calls.length) {
        const message = (result.output ?? [])
          .filter((o: { type: string }) => o.type === "message")
          .flatMap((o: { content: { text?: string }[] }) => o.content)
          .map((c: { text?: string }) => c.text ?? "")
          .join("");
        await context.client.rpc("record_workflow", {
          p_league: league,
          p_run: run,
          p_status: "awaiting_approval",
          p_steps: trace,
        });
        return NextResponse.json({
          run,
          trace,
          message,
          requiresHumanApproval: true,
        });
      }
      for (const call of calls.slice(0, 3)) {
        let outcome: unknown;
        try {
          if (!tools.some((t) => t.name === call.name))
            throw new Error("Unknown tool");
          if (call.name !== "inspect_league" && used.has(call.name))
            throw new Error("This tool already ran");
          if (call.name !== "inspect_league" && !used.has("inspect_league"))
            throw new Error("Inspect the league first");
          used.add(call.name);
          if (call.name === "inspect_league") {
            const s = await snapshot(context.client, league);
            outcome = {
              teams: s.teams.map((t) => ({
                name: t.name,
                rating: t.rating,
                status: t.status,
                division: s.divisions.find((d) => d.id === t.division_id)?.name,
              })),
              verifiedResults: s.games.filter((g) => g.status === "confirmed"),
              confirmedSlots: s.availability.filter((a) => a.confirmed),
              pendingMoves: s.proposals.filter((p) => p.status === "pending"),
              publishedVersion:
                s.versions.find((v) => v.status === "published")?.number ?? 0,
            };
          } else if (call.name === "propose_balance") {
            await command(context.client, league, "propose_balance");
            outcome = (await snapshot(context.client, league)).proposals.filter(
              (p) => p.status === "pending",
            );
          } else {
            const args = z
              .object({ round: z.number().int().min(0).max(499) })
              .parse(JSON.parse(call.arguments));
            outcome = await draftSchedule(
              context.client,
              league,
              args.round,
              false,
            );
          }
        } catch (e) {
          outcome = { error: e instanceof Error ? e.message : "Tool failed" };
        }
        trace.push({ tool: call.name, outcome });
        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(outcome),
        });
      }
      await context.client.rpc("record_workflow", {
        p_league: league,
        p_run: run,
        p_status: "running",
        p_steps: trace,
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
        "The bounded workflow stopped. Review saved proposals and drafts before approval.",
      requiresHumanApproval: true,
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
