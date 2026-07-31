import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "SkillHub Console - Agent Skill Registry",
  description: "Modern management console for Agent Skill Registry. Manage skills, groups, governance, and access control.",
  keywords: ["SkillHub", "Agent", "Skill Registry", "Console"],
};

// The console is an authenticated, frequently-deployed SPA. Next's Full Route
// Cache was serving the prerendered shell with `Cache-Control: s-maxage=
// 31536000`, so browsers/edge caches kept a stale index.html (referencing old
// hashed chunks) after every deployment — users saw the OLD app (e.g. the
// Tools page unwrap bug persisted) until a manual cache clear. Force dynamic
// rendering so HTML is never cached; hashed chunks stay immutable-cached.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
