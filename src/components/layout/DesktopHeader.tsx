import Link from 'next/link';
import Image from 'next/image';
import LoginButton from '@/components/auth/LoginButton';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function DesktopHeader() {
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
            <span className="text-sm font-medium text-muted-foreground hover:text-primary cursor-pointer">
              Coupon
            </span>
          </Link>
          <Link href="/standings" passHref>
            <span className="text-sm font-medium text-muted-foreground hover:text-primary cursor-pointer">
              Standings
            </span>
          </Link>
          <Link href="/answers" passHref>
            <span className="text-sm font-medium text-muted-foreground hover:text-primary cursor-pointer">
              Answers
            </span>
          </Link>
          <Link href="/hall-of-fame" passHref>
            <span className="text-sm font-medium text-muted-foreground hover:text-primary cursor-pointer">
              Hall of Fame
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