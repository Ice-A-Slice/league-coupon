'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LoginButton from '@/components/auth/LoginButton';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function DesktopHeader() {
  const pathname = usePathname();

  const getLinkClassName = (href: string) => {
    const isActive = pathname === href;
    const baseClasses = "text-sm font-medium cursor-pointer transition-colors";
    
    if (isActive) {
      return `${baseClasses} text-teal-600 dark:text-yellow-400 font-semibold`;
    }
    
    return `${baseClasses} text-muted-foreground hover:text-teal-500 dark:hover:text-yellow-500`;
  };
  return (
    <header className="flex bg-background border-b fixed top-0 left-0 right-0 z-50 h-16 items-center">
      <nav className="container mx-auto flex items-center justify-between px-4">
        {/* Left: Logo + Menu */}
        <div className="flex items-center space-x-8">
          <div className="flex-shrink-0">
            <Link href="/" passHref>
              <Image 
                src="/header_apl_medpil-01-01.png" 
                alt="APL" 
                width={120} 
                height={40} 
                className="cursor-pointer md:w-[120px] w-[160px] h-auto md:ml-0 -ml-4"
                priority
              />
            </Link>
          </div>

          {/* Navigation Menu (Desktop only) */}
          <div className="hidden md:flex items-center space-x-6">
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
          </div>
        </div>

        {/* Right: Theme Toggle + Login Button */}
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <LoginButton />
        </div>
      </nav>
    </header>
  );
} 