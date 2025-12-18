export default function Zones() {
    const zones = [
        {
            title: 'Growth Zone',
            description: 'High-risk, high-reward assets. Track volatility and potential upside with precision.',
            gradient: 'from-blue-500 to-cyan-400',
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
            )
        },
        {
            title: 'Stability Zone',
            description: 'Stablecoins and low-risk assets. The bedrock of your portfolio against market turbulence.',
            gradient: 'from-purple-500 to-pink-500',
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            )
        },
        {
            title: 'Yield Zone',
            description: 'Liquidity pools and staking. Automatically calculate APY/APR and farming rewards.',
            gradient: 'from-green-500 to-emerald-400',
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        }
    ];

    return (
        <section id="zones" className="py-24 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-black via-blue-900/5 to-black pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-4">
                        The <span className="text-gradient-gold">Trinity System</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Divide and conquer. Our proprietary system separates your portfolio into three strategic buckets for optimal balance.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {zones.map((zone, index) => (
                        <div key={index} className="group glass-panel p-8 rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-2">
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${zone.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                {zone.icon}
                            </div>
                            <h3 className="text-2xl font-bold mb-3">{zone.title}</h3>
                            <p className="text-gray-400 leading-relaxed">
                                {zone.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
