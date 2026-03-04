import { redirect } from "next/navigation";

/** 已取消注册；直接进入工作台 */
export default function SignUpPage() {
  redirect("/workspace");
}
