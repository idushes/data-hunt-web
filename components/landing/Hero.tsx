import Link from 'next/link';
import HeroAnim from './HeroAnim';

export default function Hero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-blue-400 mb-6">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Live Blockchain Data
                </div>

                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl">
                    Master Your <span className="text-gradient-primary">Crypto Portfolio</span> with Precision
                </h1>

                <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
                    The ultimate system to organize your investments into Growth, Stability, and Yield zones.
                    Track buy prices, calculate LP yields, and simulate portfolio performance.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Link
                        href="/web3-login"
                        className="px-8 py-3 text-base font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                    >
                        Start Portfolio
                    </Link>
                    <a
                        href="#features"
                        className="px-8 py-3 text-base font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all"
                    >
                        Explore Features
                    </a>
                </div>

                {/* Dashboard Placeholder / Visual */}
                <div className="mt-20 w-full max-w-5xl glass-panel rounded-2xl p-2 border border-white/10 shadow-2xl relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 rounded-2xl pointer-events-none" />
                    <div className="bg-[#0A0A0A] rounded-xl overflow-hidden aspect-[16/9] md:aspect-[21/9] flex items-center justify-center relative group">
                        <HeroAnim className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" />
                    </div>
                </div>
            </div>
        </section>
    );
}
