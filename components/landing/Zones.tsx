export default function Zones() {
    const zones = [
        {
            title: 'Growth Zone',
            description: 'High-risk, high-reward assets. Track volatility and potential upside with precision.',
            image: '/assets/growth-visual.png',
            gradient: 'from-blue-500 to-cyan-400'
        },
        {
            title: 'Stability Zone',
            description: 'Stablecoins and low-risk assets. The bedrock of your portfolio against market turbulence.',
            image: '/assets/stability-visual.png',
            gradient: 'from-purple-500 to-pink-500'
        },
        {
            title: 'Yield Zone',
            description: 'Liquidity pools and staking. Automatically calculate APY/APR and farming rewards.',
            image: '/assets/yield-visual.png',
            gradient: 'from-green-500 to-emerald-400'
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
                        <div key={index} className="group glass-panel p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-2 overflow-hidden relative">

                            <div className="h-48 w-full mb-6 relative rounded-xl overflow-hidden">
                                <div className={`absolute inset-0 bg-gradient-to-br ${zone.gradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
                                <img
                                    src={zone.image}
                                    alt={zone.title}
                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                                />
                            </div>

                            <h3 className="text-2xl font-bold mb-3">{zone.title}</h3>
                            <p className="text-gray-400 leading-relaxed relative z-10">
                                {zone.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
