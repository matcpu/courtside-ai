// LOCAL SYNTHETIC REVIEW HARNESS ONLY. Never deploy this Auth/PostgREST adapter.
// Production Next.js routes are exercised unchanged against in-memory PostgreSQL.
import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { localDatabase, asUser, organizer } from "./lib/local-database.mjs";
import { newSetup } from "../src/lib/launchpad.ts";
const db = await localDatabase();
const users = new Map(),
  sessions = new Map();
const password = "SyntheticPreview!2099";
const addUser = async (email) => {
  const user = {
    id: randomUUID(),
    email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  };
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [user.id, email],
  );
  users.set(email, user);
  return user;
};
const admin = await addUser("launchpad-admin@example.invalid"),
  coach = await addUser("launchpad-coach@example.invalid"),
  outsider = await addUser("launchpad-outsider@example.invalid");
const call = (user, action, p) =>
  asUser(db, user.id, (tx) => organizer(tx, action, p));
const base = {
  ...newSetup(),
  name: "Toronto Community Hoops",
  season: "Spring 2099 · Synthetic Preview",
  city: "Toronto",
  adminContact: "private-organizer@example.invalid",
  start: "2099-03-01",
  end: "2099-06-30",
  opening: "2099-03-07",
  cutoff: "2099-01-01",
  registrationDeadline: "2099-02-01",
  rosterDeadline: "2099-02-15",
  verificationDeadline: "2099-02-28",
  courts: [
    { name: "North Court", venue: "Fictional Community Centre · Toronto" },
    { name: "South Court", venue: "Fictional Community Centre · Toronto" },
  ],
};
const d = await call(admin, "save_draft", {
  id: null,
  league_id: null,
  data: base,
});
const { league_id } = await call(admin, "finish", {
  id: d.id,
  revision: d.revision,
});
await call(admin, "open_registration", { league_id });
const site = {
  theme: "courtside",
  colour: "#164d3b",
  accent: "#d5f58c",
  headline: "More than a game. A place to belong.",
  about:
    "A synthetic community league built around fair competition, thoughtful organization and the people who make youth basketball possible.\n\nThis local review environment contains fictional teams and records only.",
  rules:
    "Respect officials. Support every player. Keep private player information off public channels. All eligibility decisions require authorized human review.",
  contactEmail: "league-contact@example.invalid",
  logo: "",
};
await call(admin, "site_save", { league_id, revision: 0, site });
// Synthetic site publication is an explicit local fixture, never a production action.
await call(admin, "site_publish", {
  league_id,
  revision: 1,
  approved_public: true,
});
await db.query(
  "insert into public.memberships(league_id,user_id,role) values($1,$2,'coach')",
  [league_id, coach.id],
);
const court = (
  await db.query(
    "select id from public.courts where league_id=$1 order by name",
    [league_id],
  )
).rows[0].id;
await asUser(db, admin.id, (tx) =>
  tx.query("select public.league_command($1,'add_availability',$2::jsonb)", [
    league_id,
    JSON.stringify({
      court_id: court,
      starts_at: "2099-03-07T14:00:00Z",
      ends_at: "2099-03-07T19:00:00Z",
    }),
  ]),
);
const rpcNames = new Set([
  "organizer_command",
  "public_launch_site",
  "league_command",
  "league_snapshot",
  "preseason_snapshot",
  "preseason_command",
  "public_leagues",
  "my_leagues",
  "create_demo",
]);
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3301");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const json = (value, status = 200) => {
    res.writeHead(status);
    res.end(JSON.stringify(value));
  };
  try {
    const url = new URL(req.url, "http://127.0.0.1:3302");
    const actor = sessions.get(
      req.headers.authorization?.replace(/^Bearer /, ""),
    );
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 1000000) throw Error("Preview body too large");
    }
    const p = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/__preview")
      return json({
        synthetic: true,
        auth: "Local contract adapter, not hosted Supabase Auth",
        league: league_id,
        slug: (
          await db.query("select slug from public.leagues where id=$1", [
            league_id,
          ])
        ).rows[0].slug,
        accounts: {
          admin: admin.email,
          coach: coach.email,
          outsider: outsider.email,
        },
        password,
      });
    if (
      url.pathname === "/auth/v1/token" ||
      url.pathname === "/auth/v1/signup"
    ) {
      let user = users.get(p.email);
      if (
        url.pathname.endsWith("signup") &&
        !user &&
        /^[a-z0-9._+-]+@example\.invalid$/i.test(p.email) &&
        p.password === password
      )
        user = await addUser(p.email);
      if (!user || p.password !== password)
        return json(
          { message: "Synthetic preview account only", error: "invalid_grant" },
          400,
        );
      const now = Math.floor(Date.now() / 1000),
        token = [
          Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
            "base64url",
          ),
          Buffer.from(
            JSON.stringify({
              sub: user.id,
              role: "authenticated",
              aud: "authenticated",
              exp: now + 3600,
              iat: now,
            }),
          ).toString("base64url"),
          randomBytes(24).toString("base64url"),
        ].join(".");
      sessions.set(token, user);
      return json({
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: randomBytes(24).toString("base64url"),
        user,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return actor
        ? json(actor)
        : json({ message: "Invalid preview session" }, 401);
    if (url.pathname === "/auth/v1/logout") {
      sessions.delete(req.headers.authorization?.replace(/^Bearer /, ""));
      return json({});
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").at(-1);
      if (!rpcNames.has(name))
        return json(
          { message: "RPC not enabled in local preview", code: "42883" },
          404,
        );
      const signature = (
        await db.query(
          "select proargnames names,pronargs nargs,oidvectortypes(proargtypes) types from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname=$1",
          [name],
        )
      ).rows[0];
      if (!signature) throw Error("Unknown preview RPC");
      const names = (signature.names ?? []).slice(0, signature.nargs),
        types = signature.types ? signature.types.split(", ") : [];
      const values = names.map((key, i) =>
        types[i] === "jsonb" ? JSON.stringify(p[key] ?? {}) : (p[key] ?? null),
      );
      const args = names.map((_key, i) => `$${i + 1}::${types[i]}`).join(",");
      const array = ["public_leagues", "my_leagues"].includes(name);
      const result = await asUser(
        db,
        actor?.id ?? null,
        async (tx) =>
          (
            await tx.query(
              array
                ? `select * from public.${name}(${args})`
                : `select public.${name}(${args}) result`,
              values,
            )
          ).rows,
        actor ? "authenticated" : "anon",
      );
      return json(array ? result : result[0].result);
    }
    return json(
      { message: "Not available in this local contract adapter" },
      404,
    );
  } catch (e) {
    return json({ message: e.message, code: e.code ?? "P0001" }, 400);
  }
});
server.listen(3302, "127.0.0.1", () =>
  console.log(
    "Synthetic PostgreSQL/Auth contract adapter: http://127.0.0.1:3302 (local only; no hosted changes)",
  ),
);
const close = () => {
  server.close();
  db.close().then(() => process.exit(0));
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
