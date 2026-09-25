import type { Metadata } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Hire Me ECE — Career Dashboard", template: "%s · Hire Me ECE" },
  description:
    "Find new early childhood jobs every morning, see which centres are hiring, write letters matched to each centre, and rehearse interviews face to face with an AI interviewer.",
  openGraph: {
    title: "Hire Me ECE — Career Dashboard",
    description: "The career dashboard for early childhood educators in Australia.",
    siteName: "Hire Me ECE",
    locale: "en_AU",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
