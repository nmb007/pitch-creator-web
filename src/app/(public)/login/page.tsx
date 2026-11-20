import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-stone-600">
        Use the email on your account. There is no public registration.
      </p>
      <LoginForm />
    </main>
  );
}
