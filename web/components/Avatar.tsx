import type { Agent } from "@/lib/data";

export default function Avatar({ shape, size = 44 }: { shape: Agent["shape"]; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth="1.6">
        {shape === "circle" && <circle cx="12" cy="12" r="7" />}
        {shape === "triangle" && <path d="M12 5 20 19H4Z" />}
        {shape === "square" && <rect x="5" y="5" width="14" height="14" rx="2" />}
        {shape === "ring" && (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>)}
      </svg>
    </span>
  );
}
