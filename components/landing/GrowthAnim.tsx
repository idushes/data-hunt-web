export default function GrowthAnim({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-full h-full ${className}`}
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="growthLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
        </linearGradient>
        <filter id="glow-g" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width="400" height="300" fill="#050b14" />

      {/* Grid */}
      <g stroke="#ffffff" strokeOpacity="0.03" strokeWidth="1">
        <line x1="0" y1="75" x2="400" y2="75" />
        <line x1="0" y1="150" x2="400" y2="150" />
        <line x1="0" y1="225" x2="400" y2="225" />
        <line x1="100" y1="0" x2="100" y2="300" />
        <line x1="200" y1="0" x2="200" y2="300" />
        <line x1="300" y1="0" x2="300" y2="300" />
      </g>

      {/* Animated Waves */}
      <path
        d="M-50,250 C50,250 150,150 250,180 C350,210 380,50 450,100 L450,300 L-50,300 Z"
        fill="url(#growthArea)"
      >
        <animate
          attributeName="d"
          values="M-50,250 C50,250 150,150 250,180 C350,210 380,50 450,100 L450,300 L-50,300 Z;
                                 M-50,200 C50,150 150,250 250,120 C350,-10 380,150 450,50 L450,300 L-50,300 Z;
                                 M-50,250 C50,250 150,150 250,180 C350,210 380,50 450,100 L450,300 L-50,300 Z"
          dur="10s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d="M-50,250 C50,250 150,150 250,180 C350,210 380,50 450,100"
        fill="none"
        stroke="url(#growthLine)"
        strokeWidth="4"
        filter="url(#glow-g)"
      >
        <animate
          attributeName="d"
          values="M-50,250 C50,250 150,150 250,180 C350,210 380,50 450,100;
                                 M-50,200 C50,150 150,250 250,120 C350,-10 380,150 450,50;
                                 M-50,250 C50,250 150,150 250,180 C350,210 380,50 450,100"
          dur="10s"
          repeatCount="indefinite"
        />
      </path>

      {/* Particles */}
      <g fill="#22d3ee" opacity="0.8">
        <circle cx="250" cy="180" r="3" filter="url(#glow-g)">
          <animate
            attributeName="cy"
            values="180;120;180"
            dur="10s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="350" cy="130" r="2" filter="url(#glow-g)">
          <animate
            attributeName="cy"
            values="130;60;130"
            dur="10s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cx"
            values="350;360;350"
            dur="7s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}
