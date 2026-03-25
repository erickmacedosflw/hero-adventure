import React, { useContext } from 'react';
import * as THREE from 'three';

export const PreviewRenderContext = React.createContext(false);

export type VoxelMaterial = 'standard' | 'metal' | 'cloth' | 'skin' | 'gem' | 'leather' | 'bone';

export interface VoxelProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  material?: VoxelMaterial;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export const VoxelPart: React.FC<VoxelProps> = ({
  position, size, color, rotation = [0, 0, 0], material = 'standard',
  opacity = 1, emissive, emissiveIntensity = 0, castShadow = true, receiveShadow = true,
}) => {
  const isPreviewRender = useContext(PreviewRenderContext);
  const effectiveEmissive = material === 'gem' ? color : (emissive ?? '#000000');
  const effectiveEmissiveIntensity = material === 'gem' ? 0.35 : emissiveIntensity;
  const baseMaterialProps = {
    color,
    transparent: opacity < 1,
    opacity,
    flatShading: true,
    emissive: effectiveEmissive,
    emissiveIntensity: effectiveEmissiveIntensity,
  };

  let materialProps: Record<string, unknown> = { ...baseMaterialProps, roughness: 0.7, metalness: 0.1 };

  if (material === 'metal') {
    materialProps = { ...baseMaterialProps, roughness: 0.22, metalness: 0.82 };
  } else if (material === 'gem') {
    materialProps = { ...baseMaterialProps, roughness: 0.1, metalness: 0.08, emissive: color, emissiveIntensity: 0.45 };
  } else if (material === 'skin') {
    materialProps = { ...baseMaterialProps, roughness: 0.82, metalness: 0.02 };
  } else if (material === 'cloth') {
    materialProps = { ...baseMaterialProps, roughness: 0.98, metalness: 0.0 };
  } else if (material === 'leather') {
    materialProps = { ...baseMaterialProps, roughness: 0.62, metalness: 0.05 };
  } else if (material === 'bone') {
    materialProps = { ...baseMaterialProps, roughness: 0.52, metalness: 0.0 };
  }

  return (
    <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      {isPreviewRender ? (
        <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
      ) : (
        <meshStandardMaterial {...(materialProps as THREE.MeshStandardMaterialParameters)} />
      )}
    </mesh>
  );
};
