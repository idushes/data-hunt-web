export default function StabilityAnim({ className = '' }: { className?: string }) {
    return (
        <svg className={`w-full h-full ${className}`} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="stabGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <filter id="glow-s" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="10" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            <rect width="400" height="300" fill="#0a0514" />
            
            {/* Background pulsating circles */}
            <circle cx="200" cy="150" r="80" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.2">
                <animate attributeName="r" values="80;120;80" dur="6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.2;0;0.2" dur="6s" repeatCount="indefinite" />
            </circle>
            <circle cx="200" cy="150" r="60" fill="none" stroke="#ec4899" strokeWidth="1" opacity="0.3">
                <animate attributeName="r" values="60;100;60" dur="6s" repeatCount="indefinite" begin="-2s" />
                <animate attributeName="opacity" values="0.3;0;0.3" dur="6s" repeatCount="indefinite" begin="-2s" />
            </circle>
            
            {/* Shield / Hexagon Shape */}
            <g transform="translate(200, 150)">
                {/* Outer rotating hex */}
                <polygon points="0,-40 34.6,-20 34.6,20 0,40 -34.6,20 -34.6,-20" fill="none" stroke="#a855f7" strokeWidth="2" strokeOpacity="0.5">
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
                </polygon>
                
                {/* Core stable hex */}
                <polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" fill="url(#stabGrad)" filter="url(#glow-s)">
                    <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
                </polygon>
                
                {/* Inner symbol */}
                <rect x="-8" y="-8" width="16" height="16" fill="#ffffff" rx="2" opacity="0.9">
                    <animateTransform attributeName="transform" type="rotate" from="45" to="-315" dur="10s" repeatCount="indefinite" />
                </rect>
            </g>

            {/* Stable horizontal line passing through */}
            <line x1="0" y1="150" x2="400" y2="150" stroke="#ec4899" strokeWidth="1" opacity="0.3" />
            <line x1="-100" y1="150" x2="-60" y2="150" stroke="#ffffff" strokeWidth="2" filter="url(#glow-s)">
                <animate attributeName="x1" values="-100;450" dur="4s" repeatCount="indefinite" />
                <animate attributeName="x2" values="-60;490" dur="4s" repeatCount="indefinite" />
            </line>
        </svg>
    );
}
