import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metropol",
  description: "Your music library",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-black text-white">
          <Nav />
          <main className="max-w-3xl mx-auto pb-20 sm:pb-0">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
