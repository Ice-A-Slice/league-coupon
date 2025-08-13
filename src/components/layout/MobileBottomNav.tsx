'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MobileBottomNav() {
  const pathname = usePathname();

  const getLinkClassName = (href: string) => {
    const isActive = pathname === href;
    const baseClasses = "text-xs font-medium cursor-pointer p-2 transition-colors";
    
    if (isActive) {
      return `${baseClasses} text-teal-600 dark:text-yellow-400 font-semibold`;
    }
    
    return `${baseClasses} text-muted-foreground hover:text-teal-500 dark:hover:text-yellow-500`;
  };
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t h-16 z-50 flex items-center justify-around">
      <Link href="/" passHref>
        <span className={getLinkClassName('/')}>
          Coupon
        </span>
      </Link>
      <Link href="/standings" passHref>
        <span className={getLinkClassName('/standings')}>
          Standings
        </span>
      </Link>
      <Link href="/answers" passHref>
        <span className={getLinkClassName('/answers')}>
          Answers
        </span>
      </Link>
      <Link href="/hall-of-fame" passHref>
        <span className={getLinkClassName('/hall-of-fame')}>
          Hall of Fame
        </span>
      </Link>
      <Link href="/rules" passHref>
        <span className={getLinkClassName('/rules')}>
          Rules
        </span>
      </Link>
    </nav>
  );
} 