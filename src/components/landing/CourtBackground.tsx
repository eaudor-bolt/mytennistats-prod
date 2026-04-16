export default function CourtBackground({ opacity = 1 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity }}>
      <svg
        viewBox="0 0 1200 680"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="courtFadeTop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050d1a" stopOpacity="1" />
            <stop offset="30%" stopColor="#050d1a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#050d1a" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="sideFadeLeft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#050d1a" stopOpacity="1" />
            <stop offset="15%" stopColor="#050d1a" stopOpacity="0" />
            <stop offset="85%" stopColor="#050d1a" stopOpacity="0" />
            <stop offset="100%" stopColor="#050d1a" stopOpacity="1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1200" height="680" fill="#0B3461" />
        <rect x="70" y="60" width="1060" height="560" fill="#0F4A8E" rx="2" />
        <rect x="156" y="110" width="888" height="460" fill="#1968BE" />
        <rect x="156" y="110" width="444" height="460" fill="#1A6FC4" />
        <rect x="600" y="110" width="444" height="460" fill="#1A6FC4" />

        <rect x="156" y="110" width="888" height="2.5" fill="white" opacity="0.95" />
        <rect x="156" y="567.5" width="888" height="2.5" fill="white" opacity="0.95" />
        <rect x="156" y="110" width="2.5" height="460" fill="white" opacity="0.95" />
        <rect x="1041.5" y="110" width="2.5" height="460" fill="white" opacity="0.95" />
        <rect x="156" y="164" width="888" height="1.8" fill="white" opacity="0.85" />
        <rect x="156" y="514" width="888" height="1.8" fill="white" opacity="0.85" />
        <rect x="598.5" y="110" width="3" height="460" fill="white" opacity="0.9" />
        <rect x="593" y="104" width="14" height="8" fill="white" opacity="0.4" rx="2" />
        <rect x="593" y="568" width="14" height="8" fill="white" opacity="0.4" rx="2" />

        {Array.from({ length: 24 }, (_, i) => (
          <rect
            key={i}
            x={598.5}
            y={110 + i * (460 / 24)}
            width={3}
            height={1}
            fill="white"
            opacity={0.15}
          />
        ))}

        <rect x="408" y="164" width="2" height="352" fill="white" opacity="0.85" />
        <rect x="790" y="164" width="2" height="352" fill="white" opacity="0.85" />
        <rect x="408" y="338" width="384" height="1.8" fill="white" opacity="0.85" />
        <rect x="156" y="338" width="16" height="1.5" fill="white" opacity="0.7" />
        <rect x="1028" y="338" width="16" height="1.5" fill="white" opacity="0.7" />

        <rect x="0" y="0" width="1200" height="680" fill="url(#sideFadeLeft)" />
        <rect x="0" y="0" width="1200" height="680" fill="url(#courtFadeTop)" />
      </svg>
    </div>
  );
}

export function CourtLinePattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        viewBox="0 0 1200 400"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        opacity="0.07"
      >
        <rect x="100" y="40" width="1000" height="320" fill="none" stroke="white" strokeWidth="1.5" />
        <rect x="100" y="80" width="1000" height="240" fill="none" stroke="white" strokeWidth="1" />
        <line x1="600" y1="40" x2="600" y2="360" stroke="white" strokeWidth="1.5" />
        <line x1="340" y1="80" x2="340" y2="320" stroke="white" strokeWidth="1" />
        <line x1="860" y1="80" x2="860" y2="320" stroke="white" strokeWidth="1" />
        <line x1="340" y1="200" x2="860" y2="200" stroke="white" strokeWidth="1" />
        <line x1="100" y1="200" x2="116" y2="200" stroke="white" strokeWidth="1" />
        <line x1="1084" y1="200" x2="1100" y2="200" stroke="white" strokeWidth="1" />
      </svg>
    </div>
  );
}
