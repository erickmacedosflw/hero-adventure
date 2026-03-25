import React from 'react';
import { VoxelPart } from './VoxelPart';

export const MaterialModel = ({ type }: { type: string }) => {
  // ── mat_wood — Madeira ────────────────────────────────────────────────────
  if (type === 'mat_wood') {
    return (
      <group rotation={[0.2, 0.4, 0]}>
        {/* Log body with bark */}
        <VoxelPart position={[0, 0, 0]} size={[0.26, 0.54, 0.26]} color="#7c4820" material="leather" />
        {/* Bark ridges */}
        <VoxelPart position={[0.12, 0, 0.08]} size={[0.04, 0.54, 0.04]} color="#5c3010" material="leather" />
        <VoxelPart position={[-0.10, 0.05, 0.12]} size={[0.04, 0.46, 0.04]} color="#92500a" material="leather" />
        <VoxelPart position={[0.06, -0.04, -0.12]} size={[0.04, 0.50, 0.04]} color="#5c3010" material="leather" />
        {/* End grain (top face) — lighter wood */}
        <VoxelPart position={[0, 0.28, 0]} size={[0.24, 0.04, 0.24]} color="#a16207" material="standard" />
        <VoxelPart position={[0, 0.28, 0]} size={[0.12, 0.042, 0.12]} color="#ca8a04" material="standard" />
        <VoxelPart position={[0, 0.28, 0]} size={[0.04, 0.044, 0.04]} color="#d97706" material="standard" />
        {/* Moss patch */}
        <VoxelPart position={[-0.12, 0.10, 0.10]} size={[0.06, 0.10, 0.06]} color="#4d7c0f" material="cloth" opacity={0.75} />
        <VoxelPart position={[0.08, -0.10, 0.12]} size={[0.05, 0.06, 0.05]} color="#65a30d" material="cloth" opacity={0.65} />
      </group>
    );
  }
  // ── mat_bone — Osso ───────────────────────────────────────────────────────
  if (type === 'mat_bone') {
    return (
      <group rotation={[0, 0, 0.3]}>
        {/* Shaft */}
        <VoxelPart position={[0, 0, 0]} size={[0.10, 0.55, 0.10]} color="#e8e0d0" material="bone" />
        {/* Epiphysis ends — knobbed */}
        <VoxelPart position={[0,  0.32, 0]} size={[0.20, 0.16, 0.18]} color="#f1ece0" material="bone" />
        <VoxelPart position={[0.08, 0.38, 0.06]} size={[0.06, 0.10, 0.06]} color="#f8f3ea" material="bone" />
        <VoxelPart position={[-0.08, 0.38, -0.06]} size={[0.06, 0.10, 0.06]} color="#f8f3ea" material="bone" />
        <VoxelPart position={[0, -0.32, 0]} size={[0.20, 0.16, 0.18]} color="#f1ece0" material="bone" />
        <VoxelPart position={[0.08, -0.38, 0.06]} size={[0.06, 0.10, 0.06]} color="#f8f3ea" material="bone" />
        {/* Marrow detail — reddish hollow hint */}
        <VoxelPart position={[0.04, 0.10, 0.04]} size={[0.03, 0.30, 0.03]} color="#d4a5a5" material="standard" opacity={0.40} />
        {/* Surface crack */}
        <VoxelPart position={[0.05, 0, 0.04]} size={[0.012, 0.20, 0.012]} color="#c8bfad" material="bone" />
      </group>
    );
  }
  // ── mat_slime — Gosma ─────────────────────────────────────────────────────
  if (type === 'mat_slime') {
    return (
      <group>
        {/* Main blob */}
        <VoxelPart position={[0, -0.06, 0]} size={[0.44, 0.32, 0.44]} color="#10b981" material="gem" opacity={0.80} />
        {/* Upper dome */}
        <VoxelPart position={[0,  0.10, 0]} size={[0.32, 0.22, 0.32]} color="#34d399" material="gem" opacity={0.75} />
        <VoxelPart position={[0,  0.22, 0]} size={[0.18, 0.14, 0.18]} color="#6ee7b7" material="gem" opacity={0.65} />
        {/* Bubbles */}
        <VoxelPart position={[0.16, 0.24, 0.10]} size={[0.08, 0.08, 0.08]} color="#a7f3d0" material="gem" opacity={0.55} />
        <VoxelPart position={[-0.12, 0.18, 0.14]} size={[0.06, 0.06, 0.06]} color="#a7f3d0" material="gem" opacity={0.60} />
        <VoxelPart position={[0.05, 0.28, -0.12]} size={[0.05, 0.05, 0.05]} color="#d1fae5" material="gem" opacity={0.50} />
        {/* Bottom flat spread */}
        <VoxelPart position={[0, -0.20, 0]} size={[0.52, 0.06, 0.52]} color="#059669" material="gem" opacity={0.65} />
        {/* Highlight */}
        <VoxelPart position={[0.12, 0.26, 0.10]} size={[0.04, 0.04, 0.02]} color="#ecfdf5" material="gem" opacity={0.80} />
      </group>
    );
  }
  // ── mat_cloth — Retalho de Pano ───────────────────────────────────────────
  if (type === 'mat_cloth') {
    return (
      <group rotation={[0, 0.5, 0.1]}>
        {/* Main fabric layers */}
        <VoxelPart position={[0,  0.04, 0]} size={[0.54, 0.06, 0.42]} color="#94a3b8" material="cloth" />
        <VoxelPart position={[0.04, 0.10, -0.04]} size={[0.46, 0.06, 0.38]} color="#7f8ea3" material="cloth" rotation={[0.0, 0.1, 0.1]} />
        <VoxelPart position={[-0.04, 0.16, 0.04]} size={[0.42, 0.06, 0.36]} color="#a8b5c4" material="cloth" rotation={[-0.05, -0.1, -0.05]} />
        {/* Torn edge detail */}
        <VoxelPart position={[0.25, 0.04, 0.12]} size={[0.04, 0.06, 0.04]} color="#64748b" material="cloth" rotation={[0, 0, 0.3]} />
        <VoxelPart position={[0.28, 0.04, 0.04]} size={[0.03, 0.06, 0.05]} color="#64748b" material="cloth" rotation={[0, 0, -0.2]} />
        <VoxelPart position={[0.26, 0.04,-0.10]} size={[0.04, 0.06, 0.04]} color="#64748b" material="cloth" rotation={[0, 0, 0.4]} />
        {/* Thread */}
        <VoxelPart position={[0, 0.04, 0.22]} size={[0.40, 0.02, 0.02]} color="#475569" material="cloth" />
        <VoxelPart position={[-0.24, 0.04, 0.02]} size={[0.02, 0.02, 0.40]} color="#475569" material="cloth" />
      </group>
    );
  }
  // ── mat_iron — Fragmento de Ferro ─────────────────────────────────────────
  if (type === 'mat_iron') {
    return (
      <group rotation={[0.2, 0.3, 0.1]}>
        {/* Main ingot body */}
        <VoxelPart position={[0, 0, 0]} size={[0.38, 0.22, 0.28]} color="#64748b" material="metal" />
        {/* Facets */}
        <VoxelPart position={[0, 0.12, 0]} size={[0.36, 0.04, 0.26]} color="#94a3b8" material="metal" />
        <VoxelPart position={[0.18, 0, 0]} size={[0.04, 0.20, 0.26]} color="#4b5563" material="metal" />
        <VoxelPart position={[-0.18, 0, 0.06]} size={[0.04, 0.18, 0.18]} color="#4b5563" material="metal" />
        {/* Rust patches */}
        <VoxelPart position={[0.10, 0.12, 0.10]} size={[0.08, 0.042, 0.06]} color="#92400e" material="leather" />
        <VoxelPart position={[-0.12, 0.12, -0.08]} size={[0.06, 0.042, 0.05]} color="#78350f" material="leather" />
        {/* Chipped corner */}
        <VoxelPart position={[0.14, 0.06, 0.12]} size={[0.08, 0.12, 0.08]} color="#475569" material="metal" rotation={[0.3, 0, 0.3]} />
        {/* Metallic sheen highlight */}
        <VoxelPart position={[0, 0.12, 0]} size={[0.12, 0.042, 0.10]} color="#cbd5e1" material="metal" />
        {/* Inclusions */}
        <VoxelPart position={[-0.06, 0, -0.10]} size={[0.04, 0.04, 0.04]} color="#374151" material="metal" />
        <VoxelPart position={[0.08, -0.04, 0.08]} size={[0.04, 0.04, 0.04]} color="#374151" material="metal" />
      </group>
    );
  }
  // ── mat_gold — Pepita de Ouro ─────────────────────────────────────────────
  if (type === 'mat_gold') {
    return (
      <group rotation={[0.1, 0.5, 0.15]}>
        {/* Main nugget body */}
        <VoxelPart position={[0,  0, 0]} size={[0.30, 0.24, 0.26]} color="#facc15" material="metal" />
        {/* Crystalline facets */}
        <VoxelPart position={[0.12, 0.08, 0.08]} size={[0.10, 0.12, 0.10]} color="#fbbf24" material="metal" />
        <VoxelPart position={[-0.10, 0.06,-0.10]} size={[0.12, 0.10, 0.10]} color="#f59e0b" material="metal" />
        <VoxelPart position={[0.06,-0.08, 0.10]} size={[0.12, 0.10, 0.08]} color="#d97706" material="metal" />
        {/* Bright facet highlights */}
        <VoxelPart position={[0.04, 0.14, 0.04]} size={[0.08, 0.04, 0.08]} color="#fef08a" material="metal" />
        <VoxelPart position={[-0.08, 0.10,-0.04]} size={[0.06, 0.04, 0.06]} color="#fef9c3" material="metal" />
        {/* Sparkle gems */}
        <VoxelPart position={[0.14, 0.12, 0.12]} size={[0.04, 0.04, 0.04]} color="#fef3c7" material="gem" />
        <VoxelPart position={[-0.12,-0.05, 0.12]} size={[0.03, 0.03, 0.03]} color="#fde68a" material="gem" />
        {/* Dark crevice */}
        <VoxelPart position={[0.02,-0.02, 0.02]} size={[0.04, 0.14, 0.04]} color="#78350f" material="standard" opacity={0.40} />
      </group>
    );
  }
  return <VoxelPart position={[0, 0, 0]} size={[0.3, 0.3, 0.3]} color="#94a3b8" material="metal" />;
};
