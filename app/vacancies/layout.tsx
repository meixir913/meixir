import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vacancies" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
