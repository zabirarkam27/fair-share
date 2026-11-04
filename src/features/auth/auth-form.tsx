"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signIn, signUp } from "./actions";
import { signInFormSchema, signUpSchema, type SignUpInput } from "./schema";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const signup = mode === "signup";
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signup ? signUpSchema : signInFormSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  function submit(values: SignUpInput) {
    setError("");
    startTransition(async () => {
      const result = signup
        ? await signUp(values)
        : await signIn({ email: values.email, password: values.password });
      if ("error" in result) {
        setError(result.error);
        for (const [field, message] of Object.entries(result.fields ?? {})) {
          if (
            message &&
            (field === "name" || field === "email" || field === "password")
          )
            form.setError(field, { message });
        }
      }
    });
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-5">
      {signup && (
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            autoComplete="name"
            maxLength={80}
            placeholder="e.g. Rafi Ahmed"
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={
              form.formState.errors.name ? "name-error" : undefined
            }
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p id="name-error" className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="you@example.com"
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={
            form.formState.errors.email ? "email-error" : undefined
          }
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p id="email-error" className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          maxLength={128}
          placeholder={signup ? "At least 10 characters" : "Your password"}
          aria-invalid={!!form.formState.errors.password}
          aria-describedby={
            form.formState.errors.password
              ? "password-error"
              : signup
                ? "password-hint"
                : undefined
          }
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p id="password-error" className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : (
          signup && (
            <p id="password-hint" className="text-xs text-muted-foreground">
              Make it yours. Use 10–128 characters.
            </p>
          )
        )}
      </div>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Just a moment…
          </>
        ) : (
          <>
            {signup ? "Create account" : "Sign in"}
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {signup ? "Already sharing?" : "New around here?"}{" "}
        <Link
          href={signup ? "/login" : "/signup"}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
