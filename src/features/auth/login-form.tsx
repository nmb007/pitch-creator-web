"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import { apiClient } from "@/shared/api/client";
import { setSession } from "@/shared/session/session-store";

const LoginSchema = z.object({
  username: z.email(),
  password: z.string().min(1, "Enter the password."),
});

type LoginValues = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    try {
      const { data } = await apiClient.POST("/v1/auth/login", { body: values });
      if (!data) {
        throw new Error("Login did not return a token.");
      }
      setSession(data.access_token);
      router.replace("/decks");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign-in failed.");
    }
  }

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          className="rounded border border-stone-300 bg-white px-3 py-2"
          type="email"
          autoComplete="username"
          {...form.register("username")}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          className="rounded border border-stone-300 bg-white px-3 py-2"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        className="rounded bg-emerald-900 px-4 py-2 text-white disabled:opacity-60"
        type="submit"
        disabled={form.formState.isSubmitting}
      >
        Sign in
      </button>
    </form>
  );
}
