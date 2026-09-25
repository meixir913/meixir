import type { Metadata } from "next";

export const metadata: Metadata = { title: "Centres Hiring" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
