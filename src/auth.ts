export interface User {
  discord_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SessionPayload extends User {
  exp: number;
}

const DISCORD_API = "https://discord.com/api/v10";
const SESSION_DAYS = 7;

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlEncodeBuffer(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signJWT(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64urlEncodeBuffer(sig)}`;
}

export async function verifyJWT(
  token: string,
  secret: string,
): Promise<SessionPayload> {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) throw new Error("invalid token");

  const key = await hmacKey(secret);
  const sigBytes = Uint8Array.from(base64urlDecode(sig), (c) =>
    c.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(`${header}.${body}`),
  );
  if (!valid) throw new Error("invalid signature");

  const payload: SessionPayload = JSON.parse(base64urlDecode(body));
  if (payload.exp < Date.now() / 1000) throw new Error("token expired");
  return payload;
}

export function makeSessionPayload(user: User): SessionPayload {
  return {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  };
}

export function discordAuthURL(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord token exchange failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function getDiscordUser(accessToken: string): Promise<User> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
  return {
    discord_id: data.id,
    username: data.username,
    display_name: data.global_name || data.username,
    avatar: data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=64`
      : null,
  };
}

export async function isGuildMember(
  accessToken: string,
  guildId: string,
): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const guilds = (await res.json()) as { id: string }[];
  return guilds.some((g) => g.id === guildId);
}

export function avatarURL(user: User): string {
  return (
    user.avatar ||
    `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.discord_id) >> 22n) % 6n}.png`
  );
}
