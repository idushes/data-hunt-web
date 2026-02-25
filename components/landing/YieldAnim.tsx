export default function YieldAnim({ className = '' }: { className?: string }) {
    return (
        <svg className={`w-full h-full ${className}`} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="yieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                <filter id="glow-y" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            <rect width="400" height="300" fill="#02120a" />
            
            {/* Liquidity waves */}
            <g opacity="0.2">
                <path d="M0,200 Q100,150 200,200 T400,200 L400,300 L0,300 Z" fill="#10b981">
                    <animate attributeName="d" values="M0,200 Q100,150 200,200 T400,200 L400,300 L0,300 Z; M0,200 Q100,250 200,200 T400,200 L400,300 L0,300 Z; M0,200 Q100,150 200,200 T400,200 L400,300 L0,300 Z" dur="8s" repeatCount="indefinite" />
                </path>
                <path d="M0,220 Q100,270 200,220 T400,220 L400,300 L0,300 Z" fill="#34d399" opacity="0.5">
                    <animate attributeName="d" values="M0,220 Q100,270 200,220 T400,220 L400,300 L0,300 Z; M0,220 Q100,170 200,220 T400,220 L400,300 L0,300 Z; M0,220 Q100,270 200,220 T400,220 L400,300 L0,300 Z" dur="6s" repeatCount="indefinite" />
                </path>
            </g>

            {/* Farming/Yield symbols: Stacking coins */}
            <g transform="translate(200, 150)">
                {/* Back circle */}
                <circle cx="0" cy="0" r="70" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="10 5" opacity="0.5">
                    <animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="30s" repeatCount="indefinite" />
                </circle>

                {/* Stacks */}
                {[0, 1, 2].map((i) => (
                    <g key={i}>
                        <animateTransform attributeName="transform" type="translate" values={`0,0; 0,-5; 0,0`} dur="4s" begin={`${i*0.5}s`} repeatCount="indefinite" />
                        <g transform={`translate(0, ${20 - i * 15})`}>
                            {/* Coin Depth */}
                            <path d="M-30,0 L-30,5 A30,10 0 0,0 30,5 L30,0 A30,10 0 0,1 -30,0 Z" fill="#059669" opacity="0.8" />
                            {/* Coin Top */}
                            <ellipse cx="0" cy="0" rx="30" ry="10" fill="url(#yieldGrad)" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.3" filter={i === 2 ? 'url(#glow-y)' : ''} />
                        </g>
                    </g>
                ))}

                {/* Sparkling pluses */}
                <g fill="#ffffff" opacity="0" filter="url(#glow-y)">
                    <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0s" repeatCount="indefinite" />
                    <path d="M25,-30 h4 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 z" transform="scale(0.5)" />
                </g>
                <g fill="#ffffff" opacity="0" filter="url(#glow-y)">
                    <animate attributeName="opacity" values="0;1;0" dur="3s" begin="1s" repeatCount="indefinite" />
                    <path d="M-35,10 h4 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 z" transform="scale(0.5)" />
                </g>
            </g>
        </svg>
    );
}
