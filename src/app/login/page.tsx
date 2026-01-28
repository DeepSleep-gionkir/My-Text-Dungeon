import { redirect } from "next/navigation";
import LoginClient from "@/app/login/LoginClient";
import { getSessionCookie, verifySessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const sessionCookie = await getSessionCookie();
  if (sessionCookie) {
    const decoded = await verifySessionCookie(sessionCookie);
    if (decoded) redirect("/");
  }
  return <LoginClient />;
}
