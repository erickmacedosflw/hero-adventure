import React from 'react';
import { VoxelPart } from './VoxelPart';

export const ShieldModel = ({ type }: { type: string }) => {
  // ── shd_b1 — Tábua de Madeira (Wood Board) ────────────────────────────────
  if (type === 'shd_b1') {
    return (
      <group rotation={[0, -0.3, 0]}>
        {/* 3 rough wooden planks */}
        <VoxelPart position={[0, 0.00, -0.18]} size={[0.08, 0.80, 0.12]} color="#7c4820" material="leather" />
        <VoxelPart position={[0.01, 0.00, 0.00]} size={[0.08, 0.82, 0.13]} color="#654215" material="leather" />
        <VoxelPart position={[0, 0.00,  0.18]} size={[0.08, 0.80, 0.12]} color="#7c4820" material="leather" />
        {/* Wood grain lines */}
        <VoxelPart position={[0.041, 0.15,-0.18]} size={[0.01, 0.50, 0.03]} color="#5c3010" material="leather" />
        <VoxelPart position={[0.041, 0.15, 0.18]} size={[0.01, 0.50, 0.03]} color="#5c3010" material="leather" />
        {/* Iron crossbar (horizontal banding) */}
        <VoxelPart position={[0.05,  0.25, 0]} size={[0.12, 0.06, 0.56]} color="#6b7280" material="metal" />
        <VoxelPart position={[0.05, -0.25, 0]} size={[0.12, 0.06, 0.56]} color="#6b7280" material="metal" />
        {/* Nails */}
        {[-0.18, 0, 0.18].map((z, i) => (
          <VoxelPart key={i} position={[0.09, 0.25, z]} size={[0.025, 0.025, 0.025]} color="#9ca3af" material="metal" />
        ))}
        {[-0.18, 0, 0.18].map((z, i) => (
          <VoxelPart key={i+3} position={[0.09,-0.25, z]} size={[0.025, 0.025, 0.025]} color="#9ca3af" material="metal" />
        ))}
        {/* Handle on back */}
        <VoxelPart position={[-0.04, 0.00, 0]} size={[0.08, 0.22, 0.06]} color="#451a03" material="leather" />
      </group>
    );
  }
  // ── shd_s1 — Escudo Torre (Tower Shield) ──────────────────────────────────
  if (type === 'shd_s1') {
    return (
      <group rotation={[0, -0.2, 0]}>
        {/* Main body — tall rectangle */}
        <VoxelPart position={[0,  0.05, 0]} size={[0.10, 1.00, 0.62]} color="#334155" material="metal" />
        {/* Inner face plate */}
        <VoxelPart position={[0.02, 0.05, 0]} size={[0.06, 0.90, 0.52]} color="#1e293b" material="metal" />
        {/* Border trim */}
        <VoxelPart position={[0.04,  0.55, 0]} size={[0.10, 0.06, 0.64]} color="#475569" material="metal" />
        <VoxelPart position={[0.04, -0.46, 0]} size={[0.10, 0.06, 0.64]} color="#475569" material="metal" />
        <VoxelPart position={[0.04,  0.05, 0.30]} size={[0.10, 1.04, 0.06]} color="#475569" material="metal" />
        <VoxelPart position={[0.04,  0.05,-0.30]} size={[0.10, 1.04, 0.06]} color="#475569" material="metal" />
        {/* Center vertical stripe */}
        <VoxelPart position={[0.06,  0.05, 0]} size={[0.06, 0.96, 0.06]} color="#64748b" material="metal" />
        {/* Rivets on border */}
        {[0.4, 0.1, -0.2].map((y, i) => (
          <VoxelPart key={i} position={[0.06, y, 0.31]} size={[0.025, 0.025, 0.025]} color="#94a3b8" material="metal" />
        ))}
        {/* Central coat-of-arms boss */}
        <VoxelPart position={[0.06,  0.05, 0]} size={[0.10, 0.20, 0.20]} color="#475569" material="metal" />
        <VoxelPart position={[0.08,  0.05, 0]} size={[0.06, 0.10, 0.10]} color="#94a3b8" material="metal" />
        {/* Bottom point */}
        <VoxelPart position={[0.00, -0.55, 0]} size={[0.09, 0.12, 0.28]} color="#334155" material="metal" rotation={[0.4, 0, 0]} />
        <VoxelPart position={[0.00, -0.64, 0]} size={[0.08, 0.08, 0.12]} color="#334155" material="metal" rotation={[0.5, 0, 0]} />
      </group>
    );
  }
  // ── shd_g1 — Égide Sagrada (Sacred Aegis) ────────────────────────────────
  if (type === 'shd_g1') {
    return (
      <group rotation={[0, -0.2, 0]}>
        {/* Circular body — gilded blue */}
        <VoxelPart position={[0, 0, 0]} size={[0.10, 0.80, 0.80]} color="#1e1b4b" material="metal" />
        <VoxelPart position={[0.01, 0,  0]} size={[0.06, 0.70, 0.70]} color="#1e1b4b" material="metal" />
        {/* Outer gold ring */}
        <VoxelPart position={[0.04,  0.38, 0]} size={[0.10, 0.06, 0.82]} color="#facc15" material="metal" />
        <VoxelPart position={[0.04, -0.38, 0]} size={[0.10, 0.06, 0.82]} color="#facc15" material="metal" />
        <VoxelPart position={[0.04,  0,  0.38]} size={[0.10, 0.82, 0.06]} color="#facc15" material="metal" />
        <VoxelPart position={[0.04,  0, -0.38]} size={[0.10, 0.82, 0.06]} color="#facc15" material="metal" />
        {/* Sun rays */}
        {[0, 0.785, 1.57, 2.355].map((a, i) => (
          <VoxelPart key={i} position={[0.05, Math.sin(a)*0.22, Math.cos(a)*0.22]} size={[0.06, 0.06, 0.18]} color="#fbbf24" material="gem" rotation={[a, 0, 0]} />
        ))}
        {/* Inner gem — sapphire */}
        <VoxelPart position={[0.07, 0, 0]} size={[0.10, 0.22, 0.22]} color="#2563eb" material="gem" />
        <VoxelPart position={[0.09, 0, 0]} size={[0.06, 0.12, 0.12]} color="#60a5fa" material="gem" />
        <VoxelPart position={[0.10, 0, 0]} size={[0.04, 0.06, 0.06]} color="#bfdbfe" material="gem" />
        {/* Handle */}
        <VoxelPart position={[-0.05, 0, 0]} size={[0.08, 0.22, 0.06]} color="#b45309" material="leather" />
      </group>
    );
  }
  return (
    <group>
      <VoxelPart position={[0, 0, 0]} size={[0.10, 0.80, 0.60]} color="#334155" material="metal" />
      <VoxelPart position={[0.04, 0, 0]} size={[0.06, 0.10, 0.10]} color="#64748b" material="metal" />
    </group>
  );
};
