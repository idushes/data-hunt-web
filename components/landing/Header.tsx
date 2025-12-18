import Link from 'next/link';

export default function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                        D
                    </div>
                    <span className="text-lg font-bold tracking-wide">DataHunt</span>
                </div>

                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <Link href="#zones" className="hover:text-white transition-colors">Zones</Link>
                    <Link href="#features" className="hover:text-white transition-colors">Features</Link>
                    <Link href="#security" className="hover:text-white transition-colors">Security</Link>
                </nav>

                <div className="flex items-center gap-4">
                    <Link
                        href="/web3-login"
                        className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 backdrop-blur-sm"
                    >
                        Connect Wallet
                    </Link>
                </div>
            </div>
        </header>
    );
}
