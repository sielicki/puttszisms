import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  discordAuthURL,
  exchangeCode,
  getDiscordUser,
  isGuildMember,
  makeSessionPayload,
  type SessionPayload,
  signJWT,
  verifyJWT,
} from "./auth";
import {
  type CommentRow,
  errorPage,
  homePage,
  loginPage,
  newQuotePage,
  notMemberPage,
  type PickerUser,
  type QuoteRow,
  quoteDetailPage,
} from "./html";

type Bindings = {
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_GUILD_ID: string;
  JWT_SECRET: string;
};

type Variables = {
  user: SessionPayload;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const REDIRECT_PATH = "/callback";

function redirectURI(c: { req: { url: string } }): string {
  const u = new URL(c.req.url);
  return `${u.origin}${REDIRECT_PATH}`;
}

// CSRF protection — reject cross-origin POSTs
app.use("*", async (c, next) => {
  if (c.req.method === "POST") {
    const origin = c.req.header("origin");
    const expected = new URL(c.req.url).origin;
    if (!origin || origin !== expected) {
      return c.html(errorPage("Invalid request origin."), 403);
    }
  }
  return next();
});

// Auth middleware — skip for login/callback routes
app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (["/login", "/callback", "/favicon.ico"].includes(path)) return next();

  const token = getCookie(c, "session");
  if (!token) return c.html(loginPage());

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    c.set("user", payload);
    return next();
  } catch {
    deleteCookie(c, "session");
    return c.html(loginPage());
  }
});

// --- Auth routes ---

app.get("/login", (c) => {
  const uri = redirectURI(c);
  console.log("login redirect_uri:", uri);
  return c.redirect(discordAuthURL(c.env.DISCORD_CLIENT_ID, uri));
});

app.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.html(errorPage("Missing authorization code"), 400);

  const uri = redirectURI(c);
  console.log("callback redirect_uri:", uri);
  try {
    const accessToken = await exchangeCode(
      code,
      c.env.DISCORD_CLIENT_ID,
      c.env.DISCORD_CLIENT_SECRET,
      uri,
    );

    const member = await isGuildMember(accessToken, c.env.DISCORD_GUILD_ID);
    if (!member) return c.html(notMemberPage(), 403);

    const user = await getDiscordUser(accessToken);

    // Upsert user in DB
    await c.env.DB.prepare(
      `INSERT INTO users (discord_id, username, display_name, avatar, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(discord_id) DO UPDATE SET
         username=excluded.username,
         display_name=excluded.display_name,
         avatar=excluded.avatar,
         updated_at=datetime('now')`,
    )
      .bind(user.discord_id, user.username, user.display_name, user.avatar)
      .run();

    const jwt = await signJWT(makeSessionPayload(user), c.env.JWT_SECRET);
    setCookie(c, "session", jwt, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 7 * 86400,
    });

    return c.redirect("/");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("OAuth callback error:", msg);
    return c.html(errorPage("Authentication failed. Please try again."), 500);
  }
});

app.get("/logout", (c) => {
  deleteCookie(c, "session");
  return c.redirect("/");
});

// --- Quote routes ---

const QUOTE_SELECT = `
  SELECT q.*,
    u.display_name as submitter_name,
    u.avatar as submitter_avatar,
    COALESCE(AVG(r.stars), NULL) as avg_stars,
    COUNT(DISTINCT r.user_id) as rating_count,
    (SELECT COUNT(*) FROM comments WHERE quote_id = q.id) as comment_count
  FROM quotes q
  JOIN users u ON q.submitted_by = u.discord_id
  LEFT JOIN ratings r ON r.quote_id = q.id
`;

app.get("/", async (c) => {
  const sort = c.req.query("sort") || "newest";
  let orderBy: string;
  switch (sort) {
    case "rating":
      orderBy = "avg_stars DESC NULLS LAST, q.created_at DESC";
      break;
    case "comments":
      orderBy = "comment_count DESC, q.created_at DESC";
      break;
    default:
      orderBy = "q.created_at DESC";
  }

  const { results } = await c.env.DB.prepare(
    `${QUOTE_SELECT} GROUP BY q.id ORDER BY ${orderBy} LIMIT 100`,
  ).all<QuoteRow>();

  return c.html(homePage(results, c.get("user"), sort));
});

app.get("/quotes/new", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT discord_id, display_name, avatar FROM users ORDER BY display_name`,
  ).all<PickerUser>();
  return c.html(newQuotePage(c.get("user"), results));
});

app.post("/quotes", async (c) => {
  const body = await c.req.parseBody();
  const text = (body.text as string)?.trim();
  const attributedTo = (body.attributed_to as string)?.trim() || "Puttsz";
  const context = (body.context as string)?.trim() || null;
  const dateSaid = body.date_said as string;

  if (!text || !dateSaid) {
    return c.html(
      errorPage("Quote text and date are required.", c.get("user")),
      400,
    );
  }

  const user = c.get("user");
  const result = await c.env.DB.prepare(
    `INSERT INTO quotes (text, attributed_to, context, date_said, submitted_by) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(text, attributedTo, context, dateSaid, user.discord_id)
    .run();

  return c.redirect(`/quotes/${result.meta.last_row_id}`);
});

app.get("/quotes/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const user = c.get("user");

  const quote = await c.env.DB.prepare(
    `${QUOTE_SELECT} WHERE q.id = ? GROUP BY q.id`,
  )
    .bind(id)
    .first<QuoteRow>();

  if (!quote) return c.html(errorPage("Quote not found.", user), 404);

  const { results: comments } = await c.env.DB.prepare(
    `SELECT c.*, u.username, u.display_name, u.avatar, u.discord_id
     FROM comments c JOIN users u ON c.user_id = u.discord_id
     WHERE c.quote_id = ? ORDER BY c.created_at ASC`,
  )
    .bind(id)
    .all<CommentRow>();

  const userRating = await c.env.DB.prepare(
    `SELECT stars FROM ratings WHERE quote_id = ? AND user_id = ?`,
  )
    .bind(id, user.discord_id)
    .first<{ stars: number }>();

  return c.html(
    quoteDetailPage(quote, comments, userRating?.stars ?? null, user),
  );
});

app.post("/quotes/:id/rate", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.parseBody();
  const stars = parseInt(body.stars as string, 10);

  if (Number.isNaN(stars) || stars < 1 || stars > 5) {
    return c.redirect(`/quotes/${id}`);
  }

  await c.env.DB.prepare(
    `INSERT INTO ratings (quote_id, user_id, stars) VALUES (?, ?, ?)
     ON CONFLICT(quote_id, user_id) DO UPDATE SET stars=excluded.stars`,
  )
    .bind(id, c.get("user").discord_id, stars)
    .run();

  return c.redirect(`/quotes/${id}`);
});

app.post("/quotes/:id/comments", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.parseBody();
  const text = (body.text as string)?.trim();

  if (!text) return c.redirect(`/quotes/${id}`);

  await c.env.DB.prepare(
    `INSERT INTO comments (quote_id, user_id, text) VALUES (?, ?, ?)`,
  )
    .bind(id, c.get("user").discord_id, text)
    .run();

  return c.redirect(`/quotes/${id}`);
});

export default app;
