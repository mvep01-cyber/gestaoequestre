"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type LoginFormProps = {
  configured: boolean;
};

export function LoginForm({ configured }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setMessage("Não foi possível entrar. Confira seu e-mail e sua senha.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Falha ao entrar:", error);
      setMessage("O serviço de acesso não está disponível. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <div className="config-message" role="status">
        Configure o PostgreSQL no arquivo <code>.env.local</code>, inicie o banco
        com Docker e aplique o esquema para ativar o acesso.
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label htmlFor="password">Senha</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
      <button className="button button-primary login-submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
