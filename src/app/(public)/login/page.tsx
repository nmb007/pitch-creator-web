import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <img src="/logo.png?v=2" alt="" width={72} height={72} className="h-[72px] w-[72px]" />
        <p className="mt-3 text-lg font-semibold tracking-tight text-[var(--ink)]">Pitch Creator</p>
      </div>
      <h1 className="mt-8 text-center text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-center text-sm text-stone-600">
        Use your registered email to sign in. If you don&apos;t have an account yet, please contact your administrator.
      </p>
      <LoginForm />
    </main>
  );
}
