import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t h-16 z-50 flex items-center justify-around">
      <Link href="/" passHref>
        <span className="text-xs font-medium text-muted-foreground hover:text-primary cursor-pointer p-2">
          Coupon
        </span>
      </Link>
      <Link href="/standings" passHref>
        <span className="text-xs font-medium text-muted-foreground hover:text-primary cursor-pointer p-2">
          Standings
        </span>
      </Link>
      <Link href="/answers" passHref>
        <span className="text-xs font-medium text-muted-foreground hover:text-primary cursor-pointer p-2">
          Answers
        </span>
      </Link>
      <Link href="/hall-of-fame" passHref>
        <span className="text-xs font-medium text-muted-foreground hover:text-primary cursor-pointer p-2">
          Hall of Fame
        </span>
      </Link>
      <div className="flex items-center justify-center p-2">
        <ThemeToggle />
      </div>
    </nav>
  );
} 