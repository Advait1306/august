import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="w-full flex flex-row items-center justify-between">
      <Link href="/" className="group">
        <Image
          src="/icon.svg"
          width={28}
          height={28}
          alt="August"
          className="rounded transition-transform duration-300 group-hover:scale-105"
        />
      </Link>
      <nav className="flex items-center gap-6">
        <Link
          href="/library"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Library
        </Link>
        <Link
          href="/download"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Download
        </Link>
      </nav>
    </header>
  );
}
