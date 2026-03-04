import { redirect } from "next/navigation";

/**
 * 根路径直接进工作台，不经过语言页，避免出现登录/注册页或 405。
 */
export default function RootPage() {
  redirect("/workspace");
}
