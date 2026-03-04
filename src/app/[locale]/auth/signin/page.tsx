import { redirect } from "next/navigation";

/** 已取消登录；直接进入工作台 */
export default function SignInPage() {
  redirect("/workspace");
}
