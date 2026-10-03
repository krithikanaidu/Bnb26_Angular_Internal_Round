import { env } from "./vite-env";

export const config = {
  deepgram: {
    url: env("DEEPGRAM_URL", "https://api.deepgram.com/v1"),
    model: env("DEEPGRAM_MODEL", "nova-2"),
    key: env("DEEPGRAM_API_KEY"),
  },
  r2: {
    bucket: env("R2_BUCKET_NAME"),
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    accountId: env("R2_ACCOUNT_ID"),
    cdn: env("R2_PUBLIC_DOMAIN"),
  },
};
