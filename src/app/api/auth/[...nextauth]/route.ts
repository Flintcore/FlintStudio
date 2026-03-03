import NextAuth from "next-auth/next";
import { authOptions } from "@/lib/auth";

// NextAuth 有多个重载，仅传 options 时需断言以选用正确重载
const handler = (NextAuth as unknown as (opts: typeof authOptions) => { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> })(authOptions);

export const GET = handler.GET;
export const POST = handler.POST;
