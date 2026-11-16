import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

export const instant = false;

export default async function LoginPage() {
  const configured = isDatabaseConfigured();
  const session = configured ? await getSession() : null;
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">
          CV
        </div>
        <span className="eyebrow">Gestão equestre simples</span>
        <h1>Bem-vindo ao Campo Vivo</h1>
        <p>Entre para cuidar da rotina do seu centro ou haras.</p>
        <LoginForm configured={configured} />
        <p className="login-help">
          Acesso somente para usuários cadastrados pelo administrador do centro.
        </p>
      </section>
    </main>
  );
}
