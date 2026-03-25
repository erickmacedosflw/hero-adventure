import React from 'react';
import { VoxelPart } from './VoxelPart';

export const PotionModel = ({ type }: { type: string }) => {
  // ── pot_1 — Poção Menor (Minor HP) — round red flask ─────────────────
  if (type === 'pot_1') {
    return (
      <group>
        {/* Cork */}
        <VoxelPart position={[0,  0.46, 0]} size={[0.14, 0.08, 0.14]} color="#6b3a1f" material="leather" />
        {/* Neck */}
        <VoxelPart position={[0,  0.34, 0]} size={[0.14, 0.14, 0.14]} color="#f1f5f9" material="gem" opacity={0.55} />
        {/* Liquid in neck */}
        <VoxelPart position={[0,  0.34, 0]} size={[0.09, 0.10, 0.09]} color="#ef4444" material="gem" opacity={0.80} />
        {/* Round body */}
        <VoxelPart position={[0,  0.08, 0]} size={[0.40, 0.40, 0.40]} color="#fee2e2" material="gem" opacity={0.45} />
        <VoxelPart position={[0,  0.08, 0]} size={[0.35, 0.35, 0.35]} color="#ef4444" material="gem" opacity={0.75} />
        {/* Label band */}
        <VoxelPart position={[0.18, 0.08, 0]} size={[0.06, 0.18, 0.36]} color="#ffffff" material="standard" opacity={0.20} />
        {/* Cross icon on label */}
        <VoxelPart position={[0.205, 0.08, 0]} size={[0.02, 0.12, 0.03]} color="#dc2626" material="standard" opacity={0.80} />
        <VoxelPart position={[0.205, 0.08, 0]} size={[0.02, 0.03, 0.12]} color="#dc2626" material="standard" opacity={0.80} />
        {/* Base/bottom facet */}
        <VoxelPart position={[0, -0.15, 0]} size={[0.32, 0.06, 0.32]} color="#f87171" material="gem" opacity={0.60} />
      </group>
    );
  }
  // ── pot_2 — Poção de Mana — tall blue vial ───────────────────────────────
  if (type === 'pot_2') {
    return (
      <group>
        {/* Cork + wax seal */}
        <VoxelPart position={[0,  0.60, 0]} size={[0.12, 0.10, 0.12]} color="#6b3a1f" material="leather" />
        <VoxelPart position={[0,  0.67, 0]} size={[0.14, 0.04, 0.14]} color="#0f172a" material="standard" />
        {/* Neck */}
        <VoxelPart position={[0,  0.44, 0]} size={[0.14, 0.24, 0.14]} color="#bfdbfe" material="gem" opacity={0.50} />
        {/* Mana potion — elongated body */}
        <VoxelPart position={[0,  0.08, 0]} size={[0.30, 0.62, 0.30]} color="#eff6ff" material="gem" opacity={0.40} />
        <VoxelPart position={[0,  0.08, 0]} size={[0.24, 0.56, 0.24]} color="#3b82f6" material="gem" opacity={0.80} />
        {/* Inner glow swirl */}
        <VoxelPart position={[0.10, 0.22, 0]} size={[0.04, 0.20, 0.04]} color="#93c5fd" material="gem" opacity={0.60} rotation={[0, 0, 0.4]} />
        <VoxelPart position={[-0.10, 0.10, 0]} size={[0.04, 0.20, 0.04]} color="#60a5fa" material="gem" opacity={0.60} rotation={[0, 0, -0.4]} />
        {/* Star symbol on glass */}
        <VoxelPart position={[0.14, 0.12, 0]} size={[0.02, 0.06, 0.06]} color="#bfdbfe" material="gem" opacity={0.70} />
        <VoxelPart position={[0.14, 0.12, 0]} size={[0.02, 0.08, 0.02]} color="#bfdbfe" material="gem" opacity={0.70} />
        {/* Base */}
        <VoxelPart position={[0, -0.24, 0]} size={[0.28, 0.06, 0.28]} color="#2563eb" material="gem" opacity={0.70} />
      </group>
    );
  }
  // ── pot_atk — Poção da Fúria — angular orange/fire flask ─────────────────
  if (type === 'pot_atk') {
    return (
      <group>
        {/* Flaming wick / stopper */}
        <VoxelPart position={[0,  0.60, 0]} size={[0.10, 0.14, 0.10]} color="#292524" material="leather" />
        <VoxelPart position={[0,  0.72, 0]} size={[0.06, 0.10, 0.06]} color="#ef4444" material="gem" />
        <VoxelPart position={[0,  0.80, 0]} size={[0.04, 0.08, 0.04]} color="#f97316" material="gem" />
        {/* Neck — angular */}
        <VoxelPart position={[0,  0.46, 0]} size={[0.18, 0.18, 0.18]} color="#431407" material="standard" opacity={0.70} />
        {/* Potion body — hexagonal */}
        <VoxelPart position={[0,  0.12, 0]} size={[0.42, 0.50, 0.42]} color="#7c2d12" material="standard" opacity={0.70} />
        <VoxelPart position={[0,  0.12, 0]} size={[0.36, 0.44, 0.36]} color="#f97316" material="gem" opacity={0.80} />
        {/* Beveled edges for hex feel */}
        <VoxelPart position={[0.18, 0.12, 0.18]} size={[0.08, 0.44, 0.08]} color="#fb923c" material="gem" opacity={0.70} />
        <VoxelPart position={[-0.18,0.12, 0.18]} size={[0.08, 0.44, 0.08]} color="#fb923c" material="gem" opacity={0.70} />
        {/* Flames on glass */}
        <VoxelPart position={[0.19, 0.28, 0]} size={[0.04, 0.14, 0.08]} color="#fbbf24" material="gem" opacity={0.55} />
        <VoxelPart position={[0.19, 0.08, 0]} size={[0.04, 0.10, 0.06]} color="#ef4444" material="gem" opacity={0.55} />
        {/* Base */}
        <VoxelPart position={[0, -0.14, 0]} size={[0.40, 0.08, 0.40]} color="#431407" material="standard" />
        <VoxelPart position={[0, -0.19, 0]} size={[0.30, 0.04, 0.30]} color="#78350f" material="standard" />
      </group>
    );
  }
  // ── pot_def — Tônico de Ferro — green chunky flask ────────────────────────
  if (type === 'pot_def') {
    return (
      <group>
        {/* Wide flat stopper */}
        <VoxelPart position={[0,  0.50, 0]} size={[0.20, 0.06, 0.20]} color="#374151" material="metal" />
        <VoxelPart position={[0,  0.46, 0]} size={[0.14, 0.08, 0.14]} color="#4b5563" material="metal" />
        {/* Short neck */}
        <VoxelPart position={[0,  0.36, 0]} size={[0.18, 0.12, 0.18]} color="#d1fae5" material="gem" opacity={0.50} />
        {/* Wide chubby body */}
        <VoxelPart position={[0,  0.06, 0]} size={[0.48, 0.50, 0.48]} color="#ecfdf5" material="gem" opacity={0.40} />
        <VoxelPart position={[0,  0.06, 0]} size={[0.42, 0.44, 0.42]} color="#10b981" material="gem" opacity={0.80} />
        {/* Shield emblem on glass */}
        <VoxelPart position={[0.215, 0.10, 0]} size={[0.02, 0.18, 0.14]} color="#d1fae5" material="gem" opacity={0.55} />
        <VoxelPart position={[0.215, 0.04, 0]} size={[0.02, 0.08, 0.10]} color="#d1fae5" material="gem" opacity={0.55} rotation={[0.3, 0, 0]} />
        {/* Iron ore chunk floating inside */}
        <VoxelPart position={[0,  0.10, 0]} size={[0.12, 0.12, 0.12]} color="#6b7280" material="metal" opacity={0.50} />
        {/* Base flat */}
        <VoxelPart position={[0, -0.20, 0]} size={[0.46, 0.06, 0.46]} color="#065f46" material="standard" />
        <VoxelPart position={[0, -0.24, 0]} size={[0.36, 0.04, 0.36]} color="#064e3b" material="standard" />
      </group>
    );
  }
  // ── pot_3 — Elixir Prateado — elegant slim silver bottle ─────────────────
  if (type === 'pot_3') {
    return (
      <group>
        {/* Ornate silver cap */}
        <VoxelPart position={[0,  0.70, 0]} size={[0.16, 0.06, 0.16]} color="#cbd5e1" material="metal" />
        <VoxelPart position={[0,  0.76, 0]} size={[0.10, 0.06, 0.10]} color="#94a3b8" material="metal" />
        <VoxelPart position={[0,  0.81, 0]} size={[0.06, 0.04, 0.06]} color="#e2e8f0" material="metal" />
        {/* Elegant slender neck */}
        <VoxelPart position={[0,  0.54, 0]} size={[0.14, 0.22, 0.14]} color="#f8fafc" material="gem" opacity={0.50} />
        {/* Teardrop body */}
        <VoxelPart position={[0,  0.14, 0]} size={[0.36, 0.72, 0.36]} color="#f8fafc" material="gem" opacity={0.40} />
        <VoxelPart position={[0,  0.14, 0]} size={[0.30, 0.66, 0.30]} color="#c084fc" material="gem" opacity={0.75} />
        {/* Silver Elixir inner glow */}
        <VoxelPart position={[0,  0.26, 0]} size={[0.14, 0.30, 0.14]} color="#e9d5ff" material="gem" opacity={0.55} />
        <VoxelPart position={[0,  0.10, 0]} size={[0.10, 0.14, 0.10]} color="#f5d0fe" material="gem" opacity={0.60} />
        {/* Engraved lines on glass */}
        <VoxelPart position={[0.16, 0.30, 0]} size={[0.02, 0.40, 0.02]} color="#d8b4fe" material="gem" opacity={0.60} />
        <VoxelPart position={[0.16, 0.30, 0.10]} size={[0.02, 0.40, 0.02]} color="#d8b4fe" material="gem" opacity={0.60} />
        {/* Base */}
        <VoxelPart position={[0, -0.25, 0]} size={[0.32, 0.06, 0.32]} color="#94a3b8" material="metal" />
      </group>
    );
  }
  // ── pot_4 — Ambrosia Dourada — ornate large golden flask ─────────────────
  if (type === 'pot_4') {
    return (
      <group>
        {/* Ornate golden crown cap */}
        <VoxelPart position={[0,  0.66, 0]} size={[0.22, 0.08, 0.22]} color="#facc15" material="metal" />
        <VoxelPart position={[0,  0.72, 0]} size={[0.14, 0.10, 0.14]} color="#fbbf24" material="metal" />
        {/* Small points of crown */}
        {[0, 0.785, 1.57, 2.355].map((a, i) => (
          <VoxelPart key={i} position={[Math.cos(a)*0.09, 0.78, Math.sin(a)*0.09]} size={[0.04, 0.06, 0.04]} color="#fde68a" material="gem" />
        ))}
        {/* Neck — with gold ring */}
        <VoxelPart position={[0,  0.50, 0]} size={[0.18, 0.20, 0.18]} color="#fef9c3" material="gem" opacity={0.55} />
        <VoxelPart position={[0,  0.41, 0]} size={[0.22, 0.05, 0.22]} color="#facc15" material="metal" />
        {/* Bulbous body */}
        <VoxelPart position={[0,  0.08, 0]} size={[0.54, 0.58, 0.54]} color="#fffbeb" material="gem" opacity={0.42} />
        <VoxelPart position={[0,  0.08, 0]} size={[0.46, 0.50, 0.46]} color="#fbbf24" material="gem" opacity={0.78} />
        {/* Inner divine liquid */}
        <VoxelPart position={[0,  0.16, 0]} size={[0.22, 0.24, 0.22]} color="#fef3c7" material="gem" opacity={0.65} />
        <VoxelPart position={[0,  0.06, 0]} size={[0.16, 0.16, 0.16]} color="#fff7ed" material="gem" opacity={0.70} />
        {/* Gold band at equator */}
        <VoxelPart position={[0,  0.08, 0]} size={[0.56, 0.06, 0.56]} color="#facc15" material="metal" />
        {/* Engraved rune dots */}
        <VoxelPart position={[0.26, 0.22, 0]} size={[0.02, 0.040, 0.040]} color="#fde68a" material="gem" />
        <VoxelPart position={[0.26, 0.00, 0.14]} size={[0.02, 0.040, 0.040]} color="#fde68a" material="gem" />
        {/* Pedestal base */}
        <VoxelPart position={[0, -0.24, 0]} size={[0.46, 0.08, 0.46]} color="#d97706" material="metal" />
        <VoxelPart position={[0, -0.30, 0]} size={[0.52, 0.06, 0.52]} color="#facc15" material="metal" />
      </group>
    );
  }
  const fallbackColor = '#ef4444';
  return (
    <group>
      <VoxelPart position={[0, 0, 0]} size={[0.36, 0.36, 0.36]} color={fallbackColor} material="gem" opacity={0.75} />
      <VoxelPart position={[0, 0.28, 0]} size={[0.14, 0.20, 0.14]} color="#e2e8f0" material="standard" opacity={0.50} />
      <VoxelPart position={[0, 0.43, 0]} size={[0.18, 0.06, 0.18]} color="#451a03" material="leather" />
    </group>
  );
};
