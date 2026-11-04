"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth/server";
import { signInSchema, signUpSchema, type AuthResult } from "./schema";

function failure(error: unknown): AuthResult {
  if (error instanceof APIError) {
    if (error.statusCode === 429)
      return {
        error: "Too many attempts. Please wait a minute and try again.",
      };
    // Avoid leaking whether the address is registered or which credential failed.
    return {
      error:
        "We could not sign you in or create that account. Check your details and try again.",
    };
  }
  console.error(
    "Authentication request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return { error: "We could not connect right now. Please try again shortly." };
}

export async function signIn(input: unknown): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: "Check your email and password." };
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return failure(error);
  }
  redirect("/dashboard");
}

export async function signUp(input: unknown): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Partial<Record<"name" | "email" | "password", string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "name" || key === "email" || key === "password")
        fields[key] ??= issue.message;
    }
    return { error: "Check the highlighted details.", fields };
  }
  try {
    await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return failure(error);
  }
  redirect("/dashboard");
}

export async function signOut(): Promise<AuthResult> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    return failure(error);
  }
  redirect("/login");
}
