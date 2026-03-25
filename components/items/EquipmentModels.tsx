import React from 'react';
import { VoxelPart } from './VoxelPart';

export const HelmetModel = ({ type }: { type: string }) => {
  if (type === 'hlm_b1') {
    return (
      <group>
        <VoxelPart position={[0, 0.10, 0]} size={[0.46, 0.50, 0.46]} color="#64748b" material="cloth" />
        <VoxelPart position={[0, 0.08, 0.22]} size={[0.38, 0.40, 0.06]} color="#475569" material="cloth" />
        <VoxelPart position={[0, 0.38, -0.04]} size={[0.40, 0.14, 0.52]} color="#64748b" material="cloth" rotation={[-0.1, 0, 0]} />
        <VoxelPart position={[0, 0.48, -0.12]} size={[0.30, 0.12, 0.40]} color="#475569" material="cloth" rotation={[-0.2, 0, 0]} />
        <VoxelPart position={[-0.26, -0.08, -0.04]} size={[0.06, 0.32, 0.38]} color="#64748b" material="cloth" />
        <VoxelPart position={[ 0.26, -0.08, -0.04]} size={[0.06, 0.32, 0.38]} color="#64748b" material="cloth" />
        <VoxelPart position={[0, -0.22, -0.08]} size={[0.42, 0.12, 0.36]} color="#475569" material="cloth" />
        <VoxelPart position={[0, 0.48, 0.04]} size={[0.02, 0.50, 0.02]} color="#94a3b8" material="cloth" />
      </group>
    );
  }
  if (type === 'hlm_s1') {
    return (
      <group>
        <VoxelPart position={[0,  0.18, 0]} size={[0.50, 0.44, 0.52]} color="#4b5563" material="metal" />
        <VoxelPart position={[-0.28, -0.02, 0.06]} size={[0.06, 0.32, 0.32]} color="#374151" material="metal" />
        <VoxelPart position={[ 0.28, -0.02, 0.06]} size={[0.06, 0.32, 0.32]} color="#374151" material="metal" />
        <VoxelPart position={[0,  0.06, 0.24]} size={[0.50, 0.08, 0.08]} color="#64748b" material="metal" />
        <VoxelPart position={[-0.14,  0.06, 0.28]} size={[0.10, 0.04, 0.04]} color="#111827" material="standard" />
        <VoxelPart position={[ 0.14,  0.06, 0.28]} size={[0.10, 0.04, 0.04]} color="#111827" material="standard" />
        <VoxelPart position={[0, -0.05, 0.26]} size={[0.04, 0.14, 0.04]} color="#6b7280" material="metal" />
        <VoxelPart position={[0,  0.44, 0.02]} size={[0.08, 0.08, 0.44]} color="#6b7280" material="metal" />
        <VoxelPart position={[0,  0.56, 0.06]} size={[0.10, 0.16, 0.36]} color="#dc2626" material="cloth" />
        <VoxelPart position={[0,  0.64, 0.04]} size={[0.08, 0.14, 0.28]} color="#ef4444" material="cloth" />
        <VoxelPart position={[0,  0.68, 0.02]} size={[0.06, 0.08, 0.18]} color="#fca5a5" material="cloth" />
        <VoxelPart position={[0, -0.20, 0]} size={[0.54, 0.06, 0.54]} color="#6b7280" material="metal" />
        <VoxelPart position={[0, -0.28, 0]} size={[0.50, 0.06, 0.50]} color="#64748b" material="metal" />
        <VoxelPart position={[0.24,  0.18, 0.24]} size={[0.025, 0.025, 0.025]} color="#94a3b8" material="metal" />
        <VoxelPart position={[-0.24, 0.18, 0.24]} size={[0.025, 0.025, 0.025]} color="#94a3b8" material="metal" />
      </group>
    );
  }
  if (type === 'hlm_g1') {
    return (
      <group>
        <VoxelPart position={[0,  0.10, 0]} size={[0.48, 0.36, 0.48]} color="#1e1b4b" material="metal" />
        <VoxelPart position={[0,  0.10, 0]} size={[0.42, 0.30, 0.42]} color="#312e81" material="metal" />
        <VoxelPart position={[0, -0.08, 0]} size={[0.54, 0.10, 0.54]} color="#4c1d95" material="metal" />
        {[0, 0.628, 1.257, 1.885, 2.513].map((a, i) => {
          const r = 0.20; const h = i % 2 === 0 ? 0.42 : 0.26;
          return (
            <group key={i} position={[Math.cos(a)*r, 0.04, Math.sin(a)*r]}>
              <VoxelPart position={[0, 0, 0]} size={[0.06, h, 0.06]} color="#6d28d9" material="metal" />
              <VoxelPart position={[0, h*0.5+0.02, 0]} size={[0.04, 0.06, 0.04]} color={i % 2 === 0 ? "#a78bfa" : "#7c3aed"} material="gem" />
            </group>
          );
        })}
        <VoxelPart position={[-0.14, 0.04, 0.22]} size={[0.10, 0.10, 0.06]} color="#000" material="standard" />
        <VoxelPart position={[ 0.14, 0.04, 0.22]} size={[0.10, 0.10, 0.06]} color="#000" material="standard" />
        <VoxelPart position={[-0.14, 0.04, 0.24]} size={[0.06, 0.06, 0.04]} color="#a855f7" material="gem" />
        <VoxelPart position={[ 0.14, 0.04, 0.24]} size={[0.06, 0.06, 0.04]} color="#a855f7" material="gem" />
        <VoxelPart position={[0, -0.14, 0.16]} size={[0.30, 0.10, 0.08]} color="#1e1b4b" material="metal" />
      </group>
    );
  }
  return <VoxelPart position={[0, 0, 0]} size={[0.46, 0.40, 0.46]} color="#64748b" material="metal" />;
};

export const ArmorModel = ({ type }: { type: string }) => {
  if (type === 'arm_b1') {
    return (
      <group>
        <VoxelPart position={[0,  0.10, 0]} size={[0.52, 0.58, 0.30]} color="#78350f" material="leather" />
        <VoxelPart position={[0,  0.14, 0.15]} size={[0.08, 0.40, 0.04]} color="#451a03" material="leather" />
        <VoxelPart position={[0,  0.24, 0.16]} size={[0.10, 0.06, 0.03]} color="#92400e" material="metal" />
        <VoxelPart position={[0,  0.06, 0.16]} size={[0.10, 0.06, 0.03]} color="#92400e" material="metal" />
        <VoxelPart position={[-0.30, 0.30, 0]} size={[0.10, 0.18, 0.32]} color="#92400e" material="leather" />
        <VoxelPart position={[ 0.30, 0.30, 0]} size={[0.10, 0.18, 0.32]} color="#92400e" material="leather" />
        <VoxelPart position={[-0.28, 0.10, 0]} size={[0.06, 0.36, 0.28]} color="#78350f" material="leather" />
        <VoxelPart position={[ 0.28, 0.10, 0]} size={[0.06, 0.36, 0.28]} color="#78350f" material="leather" />
        <VoxelPart position={[-0.14,-0.22, 0.02]} size={[0.10, 0.12, 0.28]} color="#6b3a1f" material="cloth" />
        <VoxelPart position={[ 0.14,-0.22, 0.02]} size={[0.10, 0.12, 0.28]} color="#6b3a1f" material="cloth" />
        <VoxelPart position={[0,   -0.24, 0.02]} size={[0.10, 0.12, 0.28]} color="#7c4820" material="cloth" />
        <VoxelPart position={[0,  0.42, 0.06]} size={[0.44, 0.08, 0.22]} color="#6b3a1f" material="leather" />
      </group>
    );
  }
  if (type === 'arm_s1') {
    return (
      <group>
        <VoxelPart position={[0,  0.08, 0]} size={[0.54, 0.62, 0.32]} color="#4b5563" material="metal" />
        <VoxelPart position={[0,  0.08, 0.16]} size={[0.50, 0.56, 0.02]} color="#374151" material="metal" />
        {[-0.16, 0, 0.16].map((x, i) =>
          [-0.12, 0.08, 0.28].map((y, j) => (
            <VoxelPart key={i*3+j} position={[x, y, 0.17]} size={[0.06, 0.06, 0.02]} color="#6b7280" material="metal" rotation={[0, 0, 0.785]} />
          ))
        )}
        <VoxelPart position={[-0.32, 0.32, 0]} size={[0.10, 0.20, 0.34]} color="#374151" material="metal" />
        <VoxelPart position={[ 0.32, 0.32, 0]} size={[0.10, 0.20, 0.34]} color="#374151" material="metal" />
        <VoxelPart position={[-0.32, 0.34, 0.04]} size={[0.12, 0.14, 0.28]} color="#6b7280" material="metal" />
        <VoxelPart position={[ 0.32, 0.34, 0.04]} size={[0.12, 0.14, 0.28]} color="#6b7280" material="metal" />
        <VoxelPart position={[0, -0.24, 0.04]} size={[0.56, 0.08, 0.26]} color="#1c1414" material="leather" />
        <VoxelPart position={[0, -0.24, 0.16]} size={[0.10, 0.08, 0.04]} color="#6b7280" material="metal" />
        <VoxelPart position={[0,  0.42, 0.06]} size={[0.46, 0.10, 0.22]} color="#4b5563" material="metal" />
      </group>
    );
  }
  if (type === 'arm_g1') {
    return (
      <group>
        <VoxelPart position={[0,  0.10, 0]} size={[0.56, 0.62, 0.30]} color="#1e1b4b" material="metal" />
        <VoxelPart position={[0,  0.16, 0.15]} size={[0.48, 0.52, 0.04]} color="#2d2b6e" material="metal" />
        <VoxelPart position={[0,  0.24, 0.18]} size={[0.08, 0.18, 0.03]} color="#6366f1" material="gem" />
        <VoxelPart position={[0,  0.24, 0.18]} size={[0.22, 0.05, 0.03]} color="#6366f1" material="gem" />
        <VoxelPart position={[0.14, 0.10, 0.18]} size={[0.05, 0.12, 0.03]} color="#818cf8" material="gem" />
        <VoxelPart position={[-0.14, 0.10, 0.18]} size={[0.05, 0.12, 0.03]} color="#818cf8" material="gem" />
        <VoxelPart position={[0,  0.16, 0.18]} size={[0.10, 0.10, 0.04]} color="#4f46e5" material="gem" />
        <VoxelPart position={[0,  0.16, 0.19]} size={[0.06, 0.06, 0.03]} color="#a5b4fc" material="gem" />
        <VoxelPart position={[-0.32, 0.32, 0.02]} size={[0.12, 0.22, 0.32]} color="#1e1b4b" material="metal" />
        <VoxelPart position={[ 0.32, 0.32, 0.02]} size={[0.12, 0.22, 0.32]} color="#1e1b4b" material="metal" />
        <VoxelPart position={[-0.32, 0.40, 0.12]} size={[0.14, 0.10, 0.18]} color="#312e81" material="metal" />
        <VoxelPart position={[ 0.32, 0.40, 0.12]} size={[0.14, 0.10, 0.18]} color="#312e81" material="metal" />
        <VoxelPart position={[0,  0.42, 0.14]} size={[0.56, 0.06, 0.07]} color="#7c3aed" material="metal" />
        <VoxelPart position={[0, -0.18, 0.14]} size={[0.56, 0.06, 0.07]} color="#7c3aed" material="metal" />
        <VoxelPart position={[0,  0.46, 0.06]} size={[0.40, 0.10, 0.24]} color="#2d2b6e" material="metal" />
      </group>
    );
  }
  return <VoxelPart position={[0, 0, 0]} size={[0.52, 0.60, 0.30]} color="#4b5563" material="metal" />;
};

export const LegsModel = ({ type }: { type: string }) => {
  if (type === 'leg_b1') {
    return (
      <group>
        <VoxelPart position={[-0.14,  0.28, 0]} size={[0.20, 0.54, 0.22]} color="#64748b" material="cloth" />
        <VoxelPart position={[-0.14,  -0.04, 0.02]} size={[0.22, 0.18, 0.28]} color="#451a03" material="leather" />
        <VoxelPart position={[-0.14, -0.14, 0.08]} size={[0.20, 0.06, 0.32]} color="#451a03" material="leather" />
        <VoxelPart position={[ 0.14,  0.28, 0]} size={[0.20, 0.54, 0.22]} color="#64748b" material="cloth" />
        <VoxelPart position={[ 0.14,  -0.04, 0.02]} size={[0.22, 0.18, 0.28]} color="#451a03" material="leather" />
        <VoxelPart position={[ 0.14, -0.14, 0.08]} size={[0.20, 0.06, 0.32]} color="#451a03" material="leather" />
        <VoxelPart position={[-0.14, 0.02, 0.16]} size={[0.08, 0.14, 0.02]} color="#78350f" material="leather" />
        <VoxelPart position={[ 0.14, 0.02, 0.16]} size={[0.08, 0.14, 0.02]} color="#78350f" material="leather" />
        <VoxelPart position={[0,  0.57, 0]} size={[0.44, 0.08, 0.24]} color="#475569" material="cloth" />
      </group>
    );
  }
  if (type === 'leg_s1') {
    return (
      <group>
        <VoxelPart position={[-0.15,  0.32, 0.02]} size={[0.22, 0.46, 0.24]} color="#4b5563" material="metal" />
        <VoxelPart position={[ 0.15,  0.32, 0.02]} size={[0.22, 0.46, 0.24]} color="#4b5563" material="metal" />
        <VoxelPart position={[-0.15,  0.08, 0.12]} size={[0.24, 0.12, 0.10]} color="#64748b" material="metal" />
        <VoxelPart position={[ 0.15,  0.08, 0.12]} size={[0.24, 0.12, 0.10]} color="#64748b" material="metal" />
        <VoxelPart position={[-0.15, -0.14, 0.04]} size={[0.22, 0.32, 0.22]} color="#374151" material="metal" />
        <VoxelPart position={[ 0.15, -0.14, 0.04]} size={[0.22, 0.32, 0.22]} color="#374151" material="metal" />
        <VoxelPart position={[-0.15, -0.14, 0.13]} size={[0.18, 0.30, 0.04]} color="#6b7280" material="metal" />
        <VoxelPart position={[ 0.15, -0.14, 0.13]} size={[0.18, 0.30, 0.04]} color="#6b7280" material="metal" />
        <VoxelPart position={[-0.15, -0.33, 0.06]} size={[0.22, 0.10, 0.30]} color="#4b5563" material="metal" />
        <VoxelPart position={[ 0.15, -0.33, 0.06]} size={[0.22, 0.10, 0.30]} color="#4b5563" material="metal" />
        <VoxelPart position={[-0.15, -0.36, 0.18]} size={[0.20, 0.08, 0.08]} color="#6b7280" material="metal" rotation={[0.3, 0, 0]} />
        <VoxelPart position={[ 0.15, -0.36, 0.18]} size={[0.20, 0.08, 0.08]} color="#6b7280" material="metal" rotation={[0.3, 0, 0]} />
        <VoxelPart position={[-0.22, 0.22, 0.14]} size={[0.025, 0.025, 0.025]} color="#94a3b8" material="metal" />
        <VoxelPart position={[ 0.22, 0.22, 0.14]} size={[0.025, 0.025, 0.025]} color="#94a3b8" material="metal" />
        <VoxelPart position={[0,  0.58, 0]} size={[0.46, 0.08, 0.26]} color="#4b5563" material="metal" />
      </group>
    );
  }
  return <VoxelPart position={[0, 0, 0]} size={[0.36, 0.70, 0.22]} color="#4b5563" material="metal" />;
};
