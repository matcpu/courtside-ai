// LOCAL SYNTHETIC REVIEW HARNESS ONLY. Never deploy this Auth/PostgREST adapter.
// Production Next.js routes are exercised unchanged against in-memory PostgreSQL.
import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { localDatabase, asUser, organizer } from "./lib/local-database.mjs";
import { newSetup } from "../src/lib/launchpad.ts";
const reviewPort = Number(process.env.LAUNCHPAD_REVIEW_BACKEND_PORT ?? 3302);
const frontendPort = Number(process.env.LAUNCHPAD_REVIEW_FRONTEND_PORT ?? 3301);
if (
  ![reviewPort, frontendPort].every(
    (p) => Number.isInteger(p) && p >= 1024 && p <= 65535,
  )
)
  throw Error("Invalid loopback review ports");
const backendOrigin = `http://127.0.0.1:${reviewPort}`;
const db = await localDatabase();
const objects = new Map(),
  storageTokens = new Map();
const serviceKey = "synthetic-local-storage-service-only";
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
let sportsFixtures;
if (process.env.LAUNCHPAD_REVIEW_SPORTS === "true") {
  const { sportsReviewFixtures } =
    await import("./lib/sports-review-fixtures.mjs");
  sportsFixtures = {};
  for (const size of ["desktop", "mobile"])
    sportsFixtures[size] = await sportsReviewFixtures(db, admin, coach, size);
}
const call = (user, action, p) =>
  asUser(db, user.id, (tx) => organizer(tx, action, p));
const base = {
  ...newSetup(),
  allowedDocumentTypes: ["birth_certificate", "passport", "government_id"],
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
  "sport_capabilities",
  "organizer_command",
  "public_launch_site",
  "league_command",
  "league_snapshot",
  "preseason_snapshot",
  "preseason_command",
  "public_leagues",
  "my_leagues",
  "create_demo",
  "guardian_gateway",
  "document_maintenance",
  "finalize_age_upload",
  "document_screening",
]);
const server = http.createServer(async (req, res) => {
  const allowedOrigins = new Set([
    `http://127.0.0.1:${frontendPort}`,
    `http://localhost:${frontendPort}`,
  ]);
  if (allowedOrigins.has(req.headers.origin))
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-upsert,cache-control",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
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
    const url = new URL(req.url, backendOrigin);
    const actor = sessions.get(
      req.headers.authorization?.replace(/^Bearer /, ""),
    );
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 7 * 1024 * 1024) throw Error("Preview body too large");
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const isService = req.headers.authorization === "Bearer " + serviceKey;
    if (url.pathname.startsWith("/storage/v1/")) {
      const path = url.pathname
        .replace(
          /^\/storage\/v1\/object\/(?:upload\/sign|sign|authenticated)\//,
          "",
        )
        .replace(/^\/storage\/v1\/object\//, "");
      const [bucket, ...objectParts] = path.split("/");
      const objectName = objectParts.join("/");
      const mayRead = async () =>
        actor &&
        (
          await asUser(db, actor.id, (tx) =>
            tx.query(
              "select id from storage.objects where bucket_id=$1 and name=$2",
              [bucket, objectName],
            ),
          )
        ).rows.length > 0;
      if (
        req.method === "POST" &&
        /\/(upload\/sign|sign)\//.test(url.pathname)
      ) {
        if (
          !isService &&
          (url.pathname.includes("/upload/sign/") || !(await mayRead()))
        )
          return json({ message: "Private storage" }, 403);
        const token = randomBytes(24).toString("hex");
        const upload = url.pathname.includes("/upload/sign/");
        storageTokens.set(token, {
          path,
          upload,
          expires: Date.now() + (upload ? 7200000 : 60000),
        });
        return json(
          upload
            ? { url: `/object/upload/sign/${path}?token=${token}`, token }
            : { signedURL: `/object/sign/${path}?token=${token}` },
        );
      }
      if (req.method === "POST" && !url.pathname.includes("/sign/")) {
        if (!actor || bucket !== "scoresheets")
          return json({ message: "Private storage" }, 403);
        const form = await new Response(bytes, {
          headers: { "Content-Type": req.headers["content-type"] },
        }).formData();
        const file = [...form.values()].find((v) => typeof v !== "string");
        if (
          !file ||
          file.size > 6 * 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp"].includes(file.type)
        )
          return json({ message: "Invalid scoresheet image" }, 400);
        // Exercise actual PostgreSQL Storage RLS, not a client demo flag.
        await asUser(db, actor.id, (tx) =>
          tx.query(
            "insert into storage.objects(bucket_id,name,owner,metadata) values($1,$2,$3,$4)",
            [
              bucket,
              objectName,
              actor.id,
              JSON.stringify({ mimetype: file.type, size: file.size }),
            ],
          ),
        );
        objects.set(path, {
          bytes: Buffer.from(await file.arrayBuffer()),
          mime: file.type,
        });
        return json({ Key: path, Id: path });
      }
      const capability = storageTokens.get(url.searchParams.get("token"));
      const signed =
        capability?.path === path && capability.expires > Date.now();
      if (req.method === "PUT" && url.pathname.includes("/upload/sign/")) {
        if (!signed || !capability.upload)
          return json({ message: "Invalid upload capability" }, 403);
        let content = bytes,
          mime = req.headers["content-type"];
        if (mime?.includes("multipart/form-data")) {
          const form = await new Response(bytes, {
            headers: { "Content-Type": mime },
          }).formData();
          const file = [...form.values()].find((v) => typeof v !== "string");
          if (!file) return json({ message: "Missing image" }, 400);
          content = Buffer.from(await file.arrayBuffer());
          mime = file.type;
        }
        if (objects.has(path))
          return json({ message: "Object already exists" }, 409);
        objects.set(path, { bytes: content, mime });
        const [bucket, ...parts] = path.split("/");
        await db.query(
          "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",
          [
            bucket,
            parts.join("/"),
            JSON.stringify({ mimetype: mime, size: content.length }),
          ],
        );
        return json({ Key: path });
      }
      if (req.method === "GET") {
        if (!isService && !(signed && !capability.upload) && !(await mayRead()))
          return json({ message: "Private storage" }, 403);
        const item = objects.get(path);
        if (!item) return json({ message: "Not found" }, 404);
        res.writeHead(200, {
          "Content-Type": item.mime,
          "Cache-Control": "private, no-store",
        });
        return res.end(item.bytes);
      }
      if (req.method === "DELETE" && isService) {
        const p = JSON.parse(bytes.toString());
        const bucket = url.pathname.split("/").at(-1);
        for (const name of p.prefixes ?? []) {
          objects.delete(bucket + "/" + name);
          await db.query(
            "delete from storage.objects where bucket_id=$1 and name=$2",
            [bucket, name],
          );
        }
        return json([]);
      }
      return json({ message: "Private storage" }, 403);
    }
    const p = bytes.length ? JSON.parse(bytes.toString()) : {};
    if (url.pathname === "/__preview")
      return json({
        synthetic: true,
        sports: sportsFixtures,
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
        isService ? "service_role" : actor ? "authenticated" : "anon",
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
server.listen(reviewPort, "127.0.0.1", () =>
  console.log(
    `Synthetic PostgreSQL/Auth contract adapter: ${backendOrigin} (local only; no hosted changes)`,
  ),
);
const close = () => {
  server.close();
  db.close().then(() => process.exit(0));
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
