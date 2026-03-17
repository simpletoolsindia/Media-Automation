"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Download,
  FolderOpen,
  MessageSquare,
  Settings,
  Tv,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Requests", icon: Search },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/organizer", label: "Organizer", icon: FolderOpen },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
            <Tv size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">Media Organizor</h1>
            <p className="text-xs text-slate-500">AI Media Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                active
                  ? "bg-accent-500 text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-dark-700"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-700">
        <p className="text-xs text-slate-600 text-center">
          Powered by Claude claude-opus-4-6
        </p>
      </div>
    </aside>
  );
}
