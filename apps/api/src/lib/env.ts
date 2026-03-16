function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT || "3000"),
  clerkSecretKey: required("CLERK_SECRET_KEY"),
  databaseUrl: required("DATABASE_URL"),
  r2Endpoint: required("R2_ENDPOINT"),
  r2AccessKey: required("R2_ACCESS_KEY"),
  r2SecretKey: required("R2_SECRET_KEY"),
  r2Bucket: required("R2_BUCKET"),
  apiKey: process.env.API_KEY || null,
} as const;
