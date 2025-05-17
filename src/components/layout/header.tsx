
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
          TipSplit
        </Link>
        {/* Future navigation items can go here */}
      </div>
    </header>
  );
}
