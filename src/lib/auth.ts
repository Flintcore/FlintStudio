import { getServerSession } from "next-auth/next";
import NextAuth from "next-auth/next";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; image?: string | null };
  }
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  useSecureCookies: (process.env.NEXTAUTH_URL || "").startsWith("https://"),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { name: credentials.username },
        });
        if (!user?.password) return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  pages: { signIn: "/auth/signin" },
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: { id?: string; [key: string]: unknown };
      user?: { id: string };
    }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: { user?: { id?: string } };
      token: { id?: string };
    }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};

export interface SessionWithUser {
  user: { id: string; name?: string | null; image?: string | null };
}

export async function getSession(): Promise<SessionWithUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getServerSession(authOptions as any) as Promise<SessionWithUser | null>;
}
