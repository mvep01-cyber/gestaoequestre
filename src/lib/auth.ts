import "server-only";
import { compare } from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { createHash } from "node:crypto";
import { getServerSession } from "next-auth";
import { getPool } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || email.length > 254 || !password || password.length > 200) {
          return null;
        }

        const emailHash = createHash("sha256").update(email).digest("hex");
        const pool = getPool();
        await pool.query(
          "delete from public.login_attempts where attempted_at < now() - interval '24 hours'",
        );
        const attemptCount = await pool.query<{ count: string }>(
          `select count(*)::text as count
           from public.login_attempts
           where email_hash = $1 and attempted_at > now() - interval '15 minutes'`,
          [emailHash],
        );
        if (Number(attemptCount.rows[0]?.count ?? 0) >= 10) {
          return null;
        }

        const result = await pool.query<{
          id: string;
          email: string;
          nome: string;
          senha_hash: string;
        }>(
          `select id, email, nome, senha_hash
           from public.usuarios
           where lower(email) = $1
           limit 1`,
          [email],
        );
        const user = result.rows[0];
        if (!user || !(await compare(password, user.senha_hash))) {
          await pool.query(
            "insert into public.login_attempts (email_hash) values ($1)",
            [emailHash],
          );
          return null;
        }

        await pool.query("delete from public.login_attempts where email_hash = $1", [
          emailHash,
        ]);
        return { id: user.id, email: user.email, name: user.nome };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}
