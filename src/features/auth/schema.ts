import { z } from "zod";

export const signInSchema = z
  .object({
    email: z
      .email("Enter a valid email address.")
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1, "Enter your password.").max(128),
  })
  .strict();

export const signUpSchema = signInSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(1, "Enter your name.")
      .max(80, "Use at most 80 characters."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(128, "Use at most 128 characters."),
  })
  .strict();

// The form keeps a stable field shape when switching between auth routes.
export const signInFormSchema = signInSchema
  .extend({ name: z.string() })
  .strict();

export type SignInInput = z.input<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type AuthResult =
  | { error: string; fields?: Partial<Record<keyof SignUpInput, string>> }
  | { success: true };
