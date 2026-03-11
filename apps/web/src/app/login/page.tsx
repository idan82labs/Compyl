import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">ReviewLayer</h1>
        <LoginForm />
      </div>
    </main>
  );
}
