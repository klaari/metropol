import { Hono } from "hono";
import { clerkAuth } from "../middleware/auth";

type AuthEnv = { Variables: { userId: string } };
export const cookiesRoute = new Hono<AuthEnv>();
cookiesRoute.use("/cookies", clerkAuth);

cookiesRoute.post("/cookies", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("cookies") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  const text = await file.text();
  if (!text.includes("youtube.com")) {
    return c.json({ error: "Does not look like a YouTube cookies file" }, 400);
  }

  const path = "/tmp/yt-cookies.txt";
  await Bun.write(path, text);
  process.env.YT_COOKIES_FILE = path;
  console.log("[cookies] Updated YouTube cookies file");

  return c.json({ ok: true });
});

cookiesRoute.get("/cookies", async (c) => {
  const path = process.env.YT_COOKIES_FILE;
  if (!path) return c.json({ loaded: false });

  const file = Bun.file(path);
  const exists = await file.exists();
  let lines = 0;
  let size = 0;
  let domains: string[] = [];
  if (exists) {
    const text = await file.text();
    size = file.size;
    const allLines = text.split("\n");
    lines = allLines.filter((l) => l.trim() && !l.startsWith("#")).length;
    domains = [
      ...new Set(
        allLines
          .filter((l) => l.trim() && !l.startsWith("#"))
          .map((l) => l.split("\t")[0])
          .filter(Boolean),
      ),
    ];
  }

  return c.json({ loaded: exists, path, size, cookieLines: lines, domains });
});
