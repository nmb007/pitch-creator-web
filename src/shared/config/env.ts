import { z } from "zod";

const EnvSchema = z.object({
  apiBaseUrl: z.url(),
});

function readEnv() {
  const parsed = EnvSchema.safeParse({
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
  if (!parsed.success) {
    throw new Error("Set NEXT_PUBLIC_API_BASE_URL to the FastAPI origin.");
  }
  return Object.freeze(parsed.data);
}

export const env = readEnv();
