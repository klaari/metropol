import { Hono } from "hono";
import { clerkAuth } from "../middleware/auth";
import { uploadToR2, downloadFromR2 } from "../lib/r2";

const R2_COOKIES_KEY = (userId: string) => `cookies/${userId}/yt-cookies.txt`;

function localCookiesPath(userId: string) {
  return `/tmp/yt-cookies-${userId}.txt`;
}

type AuthEnv = { Variables: { userId: string } };
export const cookiesRoute = new Hono<AuthEnv>();
cookiesRoute.use("/cookies", clerkAuth);

cookiesRoute.post("/cookies", async (c) => {
  const userId = c.get("userId");
  const formData = await c.req.formData();
  const file = formData.get("cookies") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  const text = await file.text();
  if (!text.includes("youtube.com")) {
    return c.json({ error: "Does not look like a YouTube cookies file" }, 400);
  }

  // Persist to R2
  await uploadToR2(
    R2_COOKIES_KEY(userId),
    new TextEncoder().encode(text),
    "text/plain",
  );

  // Write local cache for immediate use
  const path = localCookiesPath(userId);
  await Bun.write(path, text);
  console.log(`[cookies] Updated YouTube cookies for user ${userId}`);

  return c.json({ ok: true });
});

cookiesRoute.get("/cookies", async (c) => {
  const userId = c.get("userId");
  const path = localCookiesPath(userId);
  const localFile = Bun.file(path);

  // Check local cache first, then R2
  if (await localFile.exists()) {
    return c.json({ loaded: true });
  }

  const r2Content = await downloadFromR2(R2_COOKIES_KEY(userId));
  if (r2Content) {
    // Restore local cache from R2
    await Bun.write(path, r2Content);
    return c.json({ loaded: true });
  }

  return c.json({ loaded: false });
});

/**
 * Load a user's cookies from R2 to local disk.
 * Called before yt-dlp runs to ensure cookies are available.
 */
export async function loadUserCookies(
  userId: string,
): Promise<string | null> {
  const path = localCookiesPath(userId);
  const localFile = Bun.file(path);

  if (await localFile.exists()) return path;

  const r2Content = await downloadFromR2(R2_COOKIES_KEY(userId));
  if (!r2Content) return null;

  await Bun.write(path, r2Content);
  return path;
}
