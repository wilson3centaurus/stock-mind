import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="border-t border-[#1e1e1e] mt-16 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 relative">
              <Image
                src="/robokorda-logo.jpg"
                alt="RoboKorda"
                fill
                className="object-contain rounded-sm"
              />
            </div>
            <div className="text-xs text-[#555]">
              <span className="text-[#888] font-medium">StockMind</span>
              {' — '}a{' '}
              <a
                href="https://robokorda.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#888] hover:text-white transition-colors underline-offset-2 hover:underline"
              >
                RoboKorda
              </a>{' '}
              initiative
            </div>
          </div>
          <div className="text-xs text-[#444]">
            Smart inventory. Zero guesswork. · {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  );
}
