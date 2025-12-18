export default function Features() {
    const features = [
        {
            title: "Direct Blockchain Data",
            description: "No cached APIs. We pull data directly from the blockchain to ensure 100% accuracy and real-time updates.",
            icon: "🔗"
        },
        {
            title: "Avg. Buy Price Calculation",
            description: "Smart algorithms track your historical transactions to determine your true average entry price.",
            icon: "📊"
        },
        {
            title: "Hack Notifications",
            description: "Instant alerts if any asset in your portfolio is involved in a protocol hack or security breach.",
            icon: "🚨"
        },
        {
            title: "Portfolio Simulation",
            description: "Run scenarios to see how price changes in volatile assets impact your overall portfolio value.",
            icon: "🎲"
        },
        {
            title: "Multi-Account Support",
            description: "Connect and manage multiple wallets and exchanges in a single unified dashboard.",
            icon: "👥"
        },
        {
            title: "Yield Tracking",
            description: "Automated calculation of impermanent loss and farming rewards in liquidity pools.",
            icon: "🌾"
        }
    ];

    return (
        <section id="features" className="py-24 bg-black/50">
            <div className="max-w-7xl mx-auto px-6">
                <div className="mb-16">
                    <span className="text-blue-500 font-semibold tracking-wider text-sm uppercase">Powerful Features</span>
                    <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6">Built for the Serious Investor</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div key={index} className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                            <div className="text-4xl mb-4">{feature.icon}</div>
                            <h3 className="text-xl font-bold mb-2 text-white">{feature.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
