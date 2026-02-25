export default function HeroAnim({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-full h-full ${className}`}
      viewBox="0 0 1000 400"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="glow-hero-net" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <rect width="1000" height="400" fill="#030712" />

      {/* Subtle Isometric Grid */}
      <g stroke="#ffffff" strokeWidth="1" strokeOpacity="0.03">
        {[...Array(20)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="-500"
            y1={i * 40}
            x2="1500"
            y2="400 + i * 40"
          />
        ))}
        {[...Array(40)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * 40}
            y1="-200"
            x2="i * 40 - 500"
            y2="600"
          />
        ))}
      </g>

      {/* Blockchain Network Graph */}
      <g transform="translate(50, 50)">
        {/* Edges */}
        <g stroke="url(#edgeGrad)" strokeWidth="2" fill="none" opacity="0.6">
          {/* Define paths for data to travel on */}
          <path id="path1" d="M100,50 L300,120 L450,80 L650,200 L850,150" />
          <path
            id="path2"
            d="M200,250 L300,120 L500,280 L650,200 L800,300 L950,200"
          />
          <path
            id="path3"
            d="M50,180 L200,250 L400,150 L500,280 L700,250 L850,150"
          />
          <path d="M400,150 L450,80" strokeDasharray="5,5" />
          <path d="M650,200 L700,250" strokeDasharray="5,5" />
          <path d="M100,50 L50,180" strokeDasharray="5,5" />
        </g>

        {/* Animated Data Packets (Pulses moving along paths) */}
        <circle r="4" fill="#60a5fa" filter="url(#glow-hero-net)">
          <animateMotion dur="8s" repeatCount="indefinite">
            <mpath href="#path1" />
          </animateMotion>
        </circle>
        <circle r="4" fill="#a78bfa" filter="url(#glow-hero-net)">
          <animateMotion dur="10s" repeatCount="indefinite">
            <mpath href="#path2" />
          </animateMotion>
        </circle>
        <circle r="4" fill="#34d399" filter="url(#glow-hero-net)">
          <animateMotion dur="12s" repeatCount="indefinite">
            <mpath href="#path3" />
          </animateMotion>
        </circle>

        {/* Nodes */}
        <g>
          {/* Path 1 Nodes */}
          <circle cx="100" cy="50" r="25" fill="url(#nodeGrad)">
            <animate
              attributeName="r"
              values="25;35;25"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="300" cy="120" r="30" fill="url(#nodeGrad)">
            <animate
              attributeName="r"
              values="30;40;30"
              dur="5s"
              begin="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="450" cy="80" r="20" fill="url(#nodeGrad)" />
          <circle cx="650" cy="200" r="40" fill="url(#nodeGrad)">
            <animate
              attributeName="r"
              values="40;55;40"
              dur="6s"
              begin="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="850" cy="150" r="25" fill="url(#nodeGrad)" />

          {/* Path 2 Nodes */}
          <circle cx="200" cy="250" r="35" fill="url(#nodeGrad)">
            <animate
              attributeName="r"
              values="35;45;35"
              dur="5s"
              begin="3s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="500" cy="280" r="20" fill="url(#nodeGrad)" />
          <circle cx="800" cy="300" r="30" fill="url(#nodeGrad)">
            <animate
              attributeName="r"
              values="30;40;30"
              dur="4s"
              begin="0.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="950" cy="200" r="20" fill="url(#nodeGrad)" />

          {/* Path 3 Nodes */}
          <circle cx="50" cy="180" r="20" fill="url(#nodeGrad)" />
          <circle cx="400" cy="150" r="25" fill="url(#nodeGrad)" />
          <circle cx="700" cy="250" r="25" fill="url(#nodeGrad)" />
        </g>

        {/* Core Network Hub */}
        <g transform="translate(650, 200)">
          <circle r="15" fill="#ffffff" filter="url(#glow-hero-net)">
            <animate
              attributeName="opacity"
              values="0.8;1;0.8"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          {/* Rotating Scanner Ring */}
          <circle
            r="45"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
            strokeDasharray="30 20 10 10"
            opacity="0.6"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur="8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            r="55"
            fill="none"
            stroke="#a78bfa"
            strokeWidth="1"
            strokeDasharray="50 30"
            opacity="0.3"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360"
              to="0"
              dur="12s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Secondary Hub */}
        <g transform="translate(300, 120)">
          <circle r="8" fill="#ffffff" filter="url(#glow-hero-net)">
            <animate
              attributeName="opacity"
              values="0.5;0.9;0.5"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            r="35"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1"
            strokeDasharray="20 10"
            opacity="0.5"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="-360"
              dur="10s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </g>

      {/* Floating digital particles */}
      <g
        fill="#ffffff"
        opacity="0.4"
        fontFamily="monospace"
        fontSize="8"
        filter="url(#glow-hero-net)"
      >
        <text x="150" y="320">
          <animate
            attributeName="opacity"
            values="0;0.6;0"
            dur="3s"
            repeatCount="indefinite"
          />
          01
        </text>
        <text x="600" y="80">
          <animate
            attributeName="opacity"
            values="0;0.5;0"
            dur="4s"
            begin="1s"
            repeatCount="indefinite"
          />
          0x
        </text>
        <text x="820" y="250">
          <animate
            attributeName="opacity"
            values="0;0.7;0"
            dur="2s"
            begin="2s"
            repeatCount="indefinite"
          />
          10
        </text>
        <text x="400" y="280">
          <animate
            attributeName="opacity"
            values="0;0.4;0"
            dur="5s"
            begin="0.5s"
            repeatCount="indefinite"
          />
          11
        </text>
      </g>
    </svg>
  );
}
