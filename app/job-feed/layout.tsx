import type { Metadata } from "next";

export const metadata: Metadata = { title: "ECE Job Feed" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
