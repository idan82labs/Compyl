import { Logo } from "@compyl/ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: "var(--compyl-bg)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
