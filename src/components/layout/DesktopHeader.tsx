import Link from 'next/link';

export function DesktopHeader() {
  return (
    <header className="hidden md:flex bg-background border-b fixed top-0 left-0 right-0 z-50 h-16 items-center">
      <nav className="container mx-auto flex items-center justify-between px-4">
        <Link href="/" passHref>
          <span className="text-lg font-semibold cursor-pointer">TippSlottet</span>
        </Link>
        <div className="flex items-center space-x-6">
          <Link href="/" passHref>
            <span className="text-sm font-medium text-muted-foreground hover:text-primary cursor-pointer">
              Kupong
            </span>
          </Link>
          <Link href="/standings" passHref>
            <span className="text-sm font-medium text-muted-foreground hover:text-primary cursor-pointer">
              Tabell
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
} 