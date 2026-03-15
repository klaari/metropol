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
  const hasFile = !!process.env.YT_COOKIES_FILE;
  return c.json({ loaded: hasFile });
});
