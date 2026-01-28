import { redirect } from "next/navigation";
import { getSessionCookie, verifySessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) redirect("/login");
  const decoded = await verifySessionCookie(sessionCookie);
  if (!decoded) redirect("/login");
  return <>{children}</>;
}
