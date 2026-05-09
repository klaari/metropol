import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <h1 className="text-4xl font-semibold mb-2">404</h1>
      <p className="text-ink/70 mb-6">This page doesn&apos;t exist.</p>
      <Link href="/library" className="underline">
        Back to your library
      </Link>
    </div>
  );
}
