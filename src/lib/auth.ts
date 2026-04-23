import { getServerSession } from "next-auth/next";
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
  pages: { signIn: "/workspace" },
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

const DEFAULT_USER_NAME = "__default";

/** 未登录时使用的默认用户 ID；若不存在会创建（并发安全） */
export async function getOrCreateDefaultUser(): Promise<{ id: string; name: string }> {
  const existing = await prisma.user.findUnique({ where: { name: DEFAULT_USER_NAME } });
  if (existing) return { id: existing.id, name: existing.name };
  try {
    const user = await prisma.user.create({
      data: { name: DEFAULT_USER_NAME },
    });
    return { id: user.id, name: user.name };
  } catch {
    const again = await prisma.user.findUnique({ where: { name: DEFAULT_USER_NAME } });
    if (again) return { id: again.id, name: again.name };
    throw new Error("无法创建或获取默认用户");
  }
}

/** 当前用户 ID：已登录用 session，未登录用默认用户 */
export async function getCurrentUserId(): Promise<string> {
  const session = await getSession();
  if (session?.user?.id) return session.user.id;
  const defaultUser = await getOrCreateDefaultUser();
  return defaultUser.id;
}

/** 当前会话：已登录用 session，未登录则返回默认用户的伪 session */
export async function getCurrentSession(): Promise<SessionWithUser> {
  const session = await getSession();
  if (session?.user?.id) return session;
  const defaultUser = await getOrCreateDefaultUser();
  return { user: { id: defaultUser.id, name: defaultUser.name } };
}

export async function getSession(): Promise<SessionWithUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getServerSession(authOptions as any) as Promise<SessionWithUser | null>;
}
