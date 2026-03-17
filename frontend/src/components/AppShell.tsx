"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const isSetupPage = pathname === "/setup";

  useEffect(() => {
    if (isSetupPage) { setChecked(true); return; }
    fetch("/api/settings/health")
      .then((r) => r.json())
      .then((data) => {
        if (!data.setup_complete) {
          router.push("/setup");
        }
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [pathname]);

  if (!checked) return (
    <div className="flex h-screen items-center justify-center bg-dark-900">
      <div className="text-slate-400">Loading...</div>
    </div>
  );

  if (isSetupPage) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
