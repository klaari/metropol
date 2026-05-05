// Side-effect module: sets test env vars before any module that calls
// `required()` in lib/env.ts is loaded. Must be imported FIRST in test files.
process.env.CLERK_SECRET_KEY = "test-clerk";
process.env.DATABASE_URL = "postgres://test/test";
process.env.R2_ENDPOINT = "https://r2.test";
process.env.R2_ACCESS_KEY = "test";
process.env.R2_SECRET_KEY = "test";
process.env.R2_BUCKET = "test";
process.env.DISCOGS_TOKEN = "test-token";
process.env.DISCOGS_USERNAME = "kair";
