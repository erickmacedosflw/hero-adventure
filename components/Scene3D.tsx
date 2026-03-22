import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, PerspectiveCamera, ContactShadows, OrbitControls, BakeShadows } from '@react-three/drei';
import * as THREE from 'three';
import { TurnState, Particle } from '../types';

interface SceneProps {
  enemyColor: string;
  enemyScale: number;
  turnState: TurnState;
  isPlayerAttacking: boolean;
  isEnemyAttacking: boolean;
  particles: Particle[];
  equippedWeaponId?: string;
  equippedArmorId?: string;
  equippedHelmetId?: string;
  equippedLegsId?: string;
  equippedShieldId?: string;
  enemyType?: 'beast' | 'humanoid' | 'undead';
  isPlayerDefending?: boolean;
  isEnemyDefending?: boolean;
  isPlayerHit?: boolean;
  isEnemyHit?: boolean;
  screenShake?: number;
  isLevelingUp?: boolean;
  stage?: number;
}

// --- CORE VOXEL ENGINE ---

type VoxelMaterial = 'standard' | 'metal' | 'cloth' | 'skin' | 'gem' | 'leather' | 'bone';

interface VoxelProps {
    position: [number, number, number];
    size: [number, number, number];
    color: string;
    rotation?: [number, number, number];
    material?: VoxelMaterial;
    opacity?: number;
    emissive?: string;
    emissiveIntensity?: number;
}

const VoxelPart: React.FC<VoxelProps> = ({ position, size, color, rotation = [0, 0, 0], material = 'standard', opacity = 1, emissive, emissiveIntensity = 0 }) => {
  const matProps = useMemo(() => {
    const base = { 
      color: color, 
      transparent: opacity < 1, 
      opacity: opacity, 
      flatShading: true,
      emissive: emissive || new THREE.Color(0,0,0),
      emissiveIntensity: emissiveIntensity
    };
    switch (material) {
      case 'metal': return { ...base, roughness: 0.2, metalness: 0.8 };
      case 'gem': return { ...base, roughness: 0.1, metalness: 0.1, emissive: color, emissiveIntensity: 0.4 };
      case 'skin': return { ...base, roughness: 0.8, metalness: 0.0 };
      case 'cloth': return { ...base, roughness: 1.0, metalness: 0.0 };
      case 'leather': return { ...base, roughness: 0.6, metalness: 0.1 };
      case 'bone': return { ...base, roughness: 0.5, metalness: 0.0 };
      default: return { ...base, roughness: 0.7, metalness: 0.1 };
    }
  }, [color, material, opacity]);

  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...matProps} />
    </mesh>
  );
};

// --- HIGH DETAIL PLAYER MODEL ---

const HeroBody = ({ armorId, legsId, helmetId, weaponId, shieldId, isAttacking }: any) => {
  const skinColor = "#fcd34d";
  const hairColor = "#78350f";
  
  const armorColor = armorId?.includes('_g') ? '#7c2d12' : armorId?.includes('_s') ? '#334155' : armorId ? '#451a03' : '#1e40af';
  const metalColor = armorId?.includes('_g') ? '#fbbf24' : '#94a3b8';
  const pantsColor = legsId ? '#1e293b' : '#1e3a8a';

  return (
    <group>
      {/* --- LEGS & FEET --- */}
      <group position={[0, 0, 0]}>
        {/* L Leg Detailed */}
        <group position={[-0.12, 0, 0]}>
          <VoxelPart position={[0, 0.45, 0]} size={[0.16, 0.3, 0.16]} color={pantsColor} material="cloth" /> {/* Thigh */}
          <VoxelPart position={[0, 0.3, 0.05]} size={[0.18, 0.1, 0.1]} color={pantsColor} material="cloth" /> {/* Knee */}
          <VoxelPart position={[0, 0.15, 0]} size={[0.14, 0.3, 0.14]} color={pantsColor} material="cloth" /> {/* Calf */}
          <VoxelPart position={[0, 0.05, 0.05]} size={[0.18, 0.1, 0.25]} color="#0f172a" material="leather" /> {/* Foot */}
          {legsId && <VoxelPart position={[0, 0.25, 0.04]} size={[0.2, 0.4, 0.18]} color={metalColor} material="metal" />}
        </group>
        
        {/* R Leg Detailed */}
        <group position={[0.12, 0, 0]}>
          <VoxelPart position={[0, 0.45, 0]} size={[0.16, 0.3, 0.16]} color={pantsColor} material="cloth" />
          <VoxelPart position={[0, 0.3, 0.05]} size={[0.18, 0.1, 0.1]} color={pantsColor} material="cloth" />
          <VoxelPart position={[0, 0.15, 0]} size={[0.14, 0.3, 0.14]} color={pantsColor} material="cloth" />
          <VoxelPart position={[0, 0.05, 0.05]} size={[0.18, 0.1, 0.25]} color="#0f172a" material="leather" />
          {legsId && <VoxelPart position={[0, 0.25, 0.04]} size={[0.2, 0.4, 0.18]} color={metalColor} material="metal" />}
        </group>
      </group>

      {/* --- TORSO & ARMS --- */}
      <group position={[0, 0.9, 0]}>
        {/* Torso Base - More detailed segments */}
        <VoxelPart position={[0, 0.1, 0]} size={[0.45, 0.4, 0.25]} color={armorColor} material={armorId ? 'metal' : 'cloth'} /> {/* Upper Torso */}
        <VoxelPart position={[0, -0.15, 0]} size={[0.4, 0.2, 0.22]} color={armorColor} material={armorId ? 'metal' : 'cloth'} /> {/* Lower Torso */}
        
        {/* Belt & Buckle */}
        <VoxelPart position={[0, -0.25, 0]} size={[0.47, 0.08, 0.27]} color="#451a03" material="leather" />
        <VoxelPart position={[0, -0.25, 0.14]} size={[0.1, 0.1, 0.05]} color="#facc15" material="metal" />
        
        {/* Chest Detail */}
        {armorId && (
          <>
            <VoxelPart position={[0, 0.1, 0.13]} size={[0.35, 0.3, 0.04]} color={metalColor} material="metal" />
            <VoxelPart position={[0, 0.1, 0.15]} size={[0.1, 0.2, 0.02]} color="#facc15" material="metal" /> {/* Emblem */}
          </>
        )}

        {/* L Arm (Shield Arm) - Segmented */}
        <group position={[-0.32, 0.1, 0]} rotation={[0, 0, 0.2]}>
          <VoxelPart position={[0, 0.1, 0]} size={[0.18, 0.18, 0.18]} color={skinColor} material="skin" /> {/* Shoulder */}
          <VoxelPart position={[0, -0.1, 0]} size={[0.14, 0.25, 0.14]} color={skinColor} material="skin" /> {/* Bicep */}
          <VoxelPart position={[0, -0.3, 0]} size={[0.12, 0.2, 0.12]} color={skinColor} material="skin" /> {/* Forearm */}
          <VoxelPart position={[0, -0.42, 0]} size={[0.14, 0.08, 0.14]} color={skinColor} material="skin" /> {/* Hand */}
          {armorId && <VoxelPart position={[0, 0.1, 0]} size={[0.22, 0.22, 0.22]} color={metalColor} material="metal" />}
          {shieldId && (
            <group position={[-0.15, -0.15, 0.1]} rotation={[0, -1.2, 0]}>
              <ShieldModel type={shieldId} />
            </group>
          )}
        </group>

        {/* R Arm (Weapon Arm) - Segmented */}
        <group position={[0.32, 0.1, 0]} rotation={[isAttacking ? -1.2 : 0, 0, -0.2]}>
          <VoxelPart position={[0, 0.1, 0]} size={[0.18, 0.18, 0.18]} color={skinColor} material="skin" />
          <VoxelPart position={[0, -0.1, 0]} size={[0.14, 0.25, 0.14]} color={skinColor} material="skin" />
          <VoxelPart position={[0, -0.3, 0]} size={[0.12, 0.2, 0.12]} color={skinColor} material="skin" />
          <VoxelPart position={[0, -0.42, 0]} size={[0.14, 0.08, 0.14]} color={skinColor} material="skin" />
          {armorId && <VoxelPart position={[0, 0.1, 0]} size={[0.22, 0.22, 0.22]} color={metalColor} material="metal" />}
          {weaponId && (
            <group position={[0.1, -0.4, 0.1]} rotation={[1.5, 0, 0]}>
               <WeaponModel type={weaponId} />
            </group>
          )}
        </group>
      </group>

      {/* --- HEAD --- */}
      <group position={[0, 1.45, 0]}>
        {/* Head Base */}
        <VoxelPart position={[0, 0, 0]} size={[0.4, 0.4, 0.4]} color={skinColor} material="skin" />
        
        {/* Face Details */}
        <VoxelPart position={[0, -0.05, 0.2]} size={[0.08, 0.04, 0.04]} color="#e11d48" material="skin" opacity={0.6} /> {/* Mouth */}
        <VoxelPart position={[0, 0.05, 0.21]} size={[0.06, 0.08, 0.04]} color={skinColor} material="skin" /> {/* Nose */}
        
        {/* Eyes */}
        <group position={[0, 0.1, 0.2]}>
          <VoxelPart position={[-0.1, 0, 0]} size={[0.08, 0.08, 0.04]} color="#000" />
          <VoxelPart position={[0.1, 0, 0]} size={[0.08, 0.08, 0.04]} color="#000" />
          <VoxelPart position={[-0.11, 0.01, 0.01]} size={[0.03, 0.03, 0.04]} color="#fff" />
          <VoxelPart position={[0.09, 0.01, 0.01]} size={[0.03, 0.03, 0.04]} color="#fff" />
        </group>
        
        {/* Hair / Helmet */}
        {helmetId ? (
          <group>
             <VoxelPart position={[0, 0.1, 0]} size={[0.45, 0.45, 0.45]} color={armorColor} material="metal" />
             <VoxelPart position={[0, 0.05, 0.2]} size={[0.3, 0.1, 0.05]} color="#000" /> {/* Visor slit */}
             {helmetId.includes('_g') && <VoxelPart position={[0, 0.35, 0]} size={[0.1, 0.2, 0.1]} color="#facc15" material="metal" />}
          </group>
        ) : (
          <group>
             <VoxelPart position={[0, 0.22, 0]} size={[0.45, 0.12, 0.45]} color={hairColor} />
             <VoxelPart position={[0, 0, -0.2]} size={[0.45, 0.4, 0.1]} color={hairColor} />
             <VoxelPart position={[0.2, 0.2, 0]} size={[0.1, 0.2, 0.1]} color={hairColor} rotation={[0,0,0.4]} />
             <VoxelPart position={[-0.2, 0.2, 0]} size={[0.1, 0.2, 0.1]} color={hairColor} rotation={[0,0,-0.4]} />
             <VoxelPart position={[0, 0.2, 0.2]} size={[0.4, 0.1, 0.1]} color={hairColor} /> {/* Bangs */}
          </group>
        )}
      </group>
    </group>
  );
};

// --- WEAPON & SHIELD MODELS ---

const WeaponModel = ({ type }: { type: string }) => {
  if (type.includes('wep_b1')) { // Dagger
    return (
      <group>
        <VoxelPart position={[0, -0.2, 0]} size={[0.08, 0.2, 0.08]} color="#451a03" material="leather" />
        <VoxelPart position={[0, -0.05, 0]} size={[0.2, 0.04, 0.1]} color="#94a3b8" material="metal" />
        <VoxelPart position={[0, 0.25, 0]} size={[0.08, 0.5, 0.02]} color="#e2e8f0" material="metal" />
      </group>
    );
  }
  if (type.includes('wep_b2')) { // Axe
    return (
      <group>
        <VoxelPart position={[0, 0, 0]} size={[0.06, 0.8, 0.06]} color="#451a03" material="leather" />
        <VoxelPart position={[0.15, 0.3, 0]} size={[0.3, 0.4, 0.04]} color="#94a3b8" material="metal" />
        <VoxelPart position={[0.3, 0.3, 0]} size={[0.05, 0.5, 0.02]} color="#cbd5e1" material="metal" />
      </group>
    );
  }
  if (type.includes('wep_s')) { // Steel Sword
    return (
      <group>
        <VoxelPart position={[0, -0.2, 0]} size={[0.08, 0.3, 0.08]} color="#1e293b" material="leather" />
        <VoxelPart position={[0, 0, 0]} size={[0.3, 0.06, 0.1]} color="#64748b" material="metal" />
        <VoxelPart position={[0, 0.5, 0]} size={[0.12, 1.0, 0.04]} color="#94a3b8" material="metal" />
        <VoxelPart position={[0, 0.5, 0]} size={[0.04, 0.9, 0.06]} color="#475569" material="metal" />
      </group>
    );
  }
  if (type.includes('wep_g')) { // Legendary Katana
    return (
      <group>
        <VoxelPart position={[0, -0.2, 0]} size={[0.06, 0.4, 0.06]} color="#1e1b4b" material="cloth" />
        <VoxelPart position={[0, 0.05, 0]} size={[0.15, 0.05, 0.15]} color="#facc15" material="metal" />
        <VoxelPart position={[0, 0.7, 0]} size={[0.08, 1.4, 0.02]} color="#f8fafc" material="metal" />
        <VoxelPart position={[0, 0.7, 0]} size={[0.02, 1.4, 0.04]} color="#6366f1" material="gem" />
      </group>
    );
  }
  return <VoxelPart position={[0, 0.2, 0]} size={[0.1, 0.6, 0.1]} color="#fff" />;
};

const ShieldModel = ({ type }: { type: string }) => {
  const isGold = type.includes('_g');
  const isSilver = type.includes('_s');
  const baseColor = isGold ? '#78350f' : isSilver ? '#334155' : '#451a03';
  const trimColor = isGold ? '#facc15' : isSilver ? '#94a3b8' : '#78350f';

  return (
    <group>
      <VoxelPart position={[0, 0, 0]} size={[0.1, 0.8, 0.6]} color={baseColor} material="metal" />
      <VoxelPart position={[0.02, 0, 0]} size={[0.1, 0.7, 0.5]} color={baseColor} material="metal" />
      <VoxelPart position={[0.04, 0.38, 0]} size={[0.1, 0.06, 0.62]} color={trimColor} material="metal" />
      <VoxelPart position={[0.04, -0.38, 0]} size={[0.1, 0.06, 0.62]} color={trimColor} material="metal" />
      <VoxelPart position={[0.04, 0, 0.28]} size={[0.1, 0.82, 0.06]} color={trimColor} material="metal" />
      <VoxelPart position={[0.04, 0, -0.28]} size={[0.1, 0.82, 0.06]} color={trimColor} material="metal" />
      <VoxelPart position={[0.06, 0, 0]} size={[0.1, 0.2, 0.2]} color={trimColor} material="metal" rotation={[Math.PI / 4, 0, 0]} />
    </group>
  );
};

const PotionModel = ({ type }: { type: string }) => {
  const liquidColor = type === 'pot_1' ? '#ef4444' : type === 'pot_2' ? '#3b82f6' : type === 'pot_atk' ? '#f97316' : '#10b981';
  return (
    <group>
      <VoxelPart position={[0, 0, 0]} size={[0.4, 0.4, 0.4]} color={liquidColor} material="gem" opacity={0.7} />
      <VoxelPart position={[0, 0.3, 0]} size={[0.15, 0.25, 0.15]} color="#e2e8f0" material="standard" opacity={0.5} />
      <VoxelPart position={[0, 0.45, 0]} size={[0.2, 0.05, 0.2]} color="#451a03" material="leather" />
    </group>
  );
};

// --- ENEMY MODELS ---

const BeastModel = ({ color }: { color: string }) => (
  <group position={[0, 0.4, 0]}>
    {/* Body - Main Torso */}
    <VoxelPart position={[0, 0, 0]} size={[0.6, 0.55, 0.9]} color={color} material="leather" />
    <VoxelPart position={[0, 0.1, -0.45]} size={[0.45, 0.35, 0.2]} color={color} material="leather" /> {/* Tail base */}
    <VoxelPart position={[0, 0.35, -0.6]} size={[0.12, 0.5, 0.12]} color={color} material="leather" rotation={[0.6, 0, 0]} /> {/* Tail */}
    
    {/* Head Complex */}
    <group position={[0, 0.25, 0.5]}>
      <VoxelPart position={[0, 0.1, 0]} size={[0.48, 0.48, 0.48]} color={color} material="leather" />
      <VoxelPart position={[0, -0.1, 0.25]} size={[0.32, 0.22, 0.35]} color={color} material="leather" /> {/* Snout */}
      <VoxelPart position={[0, -0.18, 0.42]} size={[0.22, 0.06, 0.12]} color="#000" material="leather" /> {/* Nose */}
      
      {/* Jaw */}
      <VoxelPart position={[0, -0.25, 0.2]} size={[0.3, 0.1, 0.3]} color={color} material="leather" rotation={[0.2, 0, 0]} />
      <VoxelPart position={[0.1, -0.2, 0.35]} size={[0.04, 0.1, 0.04]} color="#fff" material="bone" /> {/* Tooth L */}
      <VoxelPart position={[-0.1, -0.2, 0.35]} size={[0.04, 0.1, 0.04]} color="#fff" material="bone" /> {/* Tooth R */}

      {/* Ears - Detailed */}
      <group position={[0.2, 0.3, 0]} rotation={[0, 0, -0.4]}>
        <VoxelPart position={[0, 0, 0]} size={[0.12, 0.25, 0.1]} color={color} material="leather" />
        <VoxelPart position={[0, 0, 0.02]} size={[0.08, 0.2, 0.02]} color="#451a03" material="skin" />
      </group>
      <group position={[-0.2, 0.3, 0]} rotation={[0, 0, 0.4]}>
        <VoxelPart position={[0, 0, 0]} size={[0.12, 0.25, 0.1]} color={color} material="leather" />
        <VoxelPart position={[0, 0, 0.02]} size={[0.08, 0.2, 0.02]} color="#451a03" material="skin" />
      </group>
      
      {/* Eyes - Glowing with detail */}
      <VoxelPart position={[0.14, 0.18, 0.22]} size={[0.1, 0.1, 0.06]} color="#facc15" material="gem" />
      <VoxelPart position={[-0.14, 0.18, 0.22]} size={[0.1, 0.1, 0.06]} color="#facc15" material="gem" />
      <VoxelPart position={[0.14, 0.18, 0.26]} size={[0.04, 0.04, 0.02]} color="#fff" material="gem" />
      <VoxelPart position={[-0.14, 0.18, 0.26]} size={[0.04, 0.04, 0.02]} color="#fff" material="gem" />
    </group>

    {/* Legs - Muscular */}
    <group>
      {/* Front L */}
      <VoxelPart position={[0.25, -0.25, 0.38]} size={[0.2, 0.45, 0.2]} color={color} material="leather" />
      <VoxelPart position={[0.25, -0.45, 0.45]} size={[0.22, 0.1, 0.25]} color="#1e293b" material="leather" /> {/* Paw */}
      {/* Front R */}
      <VoxelPart position={[-0.25, -0.25, 0.38]} size={[0.2, 0.45, 0.2]} color={color} material="leather" />
      <VoxelPart position={[-0.25, -0.45, 0.45]} size={[0.22, 0.1, 0.25]} color="#1e293b" material="leather" />
      {/* Back L */}
      <VoxelPart position={[0.25, -0.25, -0.38]} size={[0.2, 0.45, 0.2]} color={color} material="leather" />
      <VoxelPart position={[0.25, -0.45, -0.42]} size={[0.22, 0.1, 0.25]} color="#1e293b" material="leather" />
      {/* Back R */}
      <VoxelPart position={[-0.25, -0.25, -0.38]} size={[0.2, 0.45, 0.2]} color={color} material="leather" />
      <VoxelPart position={[-0.25, -0.45, -0.42]} size={[0.22, 0.1, 0.25]} color="#1e293b" material="leather" />
    </group>
    
    {/* Spikes / Fur Detail */}
    <VoxelPart position={[0, 0.3, 0.15]} size={[0.12, 0.15, 0.12]} color="#fff" material="bone" rotation={[0.6, 0, 0]} />
    <VoxelPart position={[0, 0.32, -0.05]} size={[0.12, 0.18, 0.12]} color="#fff" material="bone" rotation={[0.6, 0, 0]} />
    <VoxelPart position={[0, 0.3, -0.25]} size={[0.12, 0.15, 0.12]} color="#fff" material="bone" rotation={[0.6, 0, 0]} />
    <VoxelPart position={[0.15, 0.25, 0]} size={[0.08, 0.1, 0.4]} color="#fff" material="bone" rotation={[0, 0, 0.4]} opacity={0.3} />
    <VoxelPart position={[-0.15, 0.25, 0]} size={[0.08, 0.1, 0.4]} color="#fff" material="bone" rotation={[0, 0, -0.4]} opacity={0.3} />
  </group>
);

const HumanoidModel = ({ color }: { color: string }) => (
  <group position={[0, 0.8, 0]}>
    {/* Legs - Detailed Armor */}
    <VoxelPart position={[-0.14, -0.5, 0]} size={[0.2, 0.6, 0.2]} color="#1e293b" material="cloth" />
    <VoxelPart position={[0.14, -0.5, 0]} size={[0.2, 0.6, 0.2]} color="#1e293b" material="cloth" />
    <VoxelPart position={[-0.14, -0.4, 0.05]} size={[0.22, 0.4, 0.22]} color={color} material="metal" /> {/* Greaves */}
    <VoxelPart position={[0.14, -0.4, 0.05]} size={[0.22, 0.4, 0.22]} color={color} material="metal" />
    <VoxelPart position={[-0.14, -0.75, 0.08]} size={[0.22, 0.12, 0.28]} color="#0f172a" material="leather" />
    <VoxelPart position={[0.14, -0.75, 0.08]} size={[0.22, 0.12, 0.28]} color="#0f172a" material="leather" />

    {/* Torso - Heavy Armor */}
    <VoxelPart position={[0, 0, 0]} size={[0.55, 0.75, 0.35]} color={color} material="metal" />
    <VoxelPart position={[0, 0.1, 0.18]} size={[0.4, 0.45, 0.06]} color="#94a3b8" material="metal" /> {/* Chest plate */}
    <VoxelPart position={[0, 0.1, 0.2]} size={[0.1, 0.3, 0.05]} color="#facc15" material="metal" /> {/* Emblem */}
    <VoxelPart position={[0, -0.32, 0]} size={[0.58, 0.12, 0.38]} color="#451a03" material="leather" /> {/* Belt */}

    {/* Arms - Gauntlets */}
    <group position={[-0.38, 0.1, 0]} rotation={[0, 0, 0.2]}>
      <VoxelPart position={[0, -0.15, 0]} size={[0.22, 0.55, 0.22]} color={color} material="metal" />
      <VoxelPart position={[0, -0.3, 0]} size={[0.25, 0.25, 0.25]} color="#94a3b8" material="metal" /> {/* Gauntlet */}
      <VoxelPart position={[0, 0.15, 0]} size={[0.3, 0.25, 0.3]} color="#94a3b8" material="metal" /> {/* Pauldron */}
    </group>
    <group position={[0.38, 0.1, 0]} rotation={[-0.6, 0, -0.2]}>
      <VoxelPart position={[0, -0.15, 0]} size={[0.22, 0.55, 0.22]} color={color} material="metal" />
      <VoxelPart position={[0, -0.3, 0]} size={[0.25, 0.25, 0.25]} color="#94a3b8" material="metal" />
      <VoxelPart position={[0, 0.15, 0]} size={[0.3, 0.25, 0.3]} color="#94a3b8" material="metal" />
      {/* Heavy Enemy Weapon */}
      <group position={[0.1, -0.5, 0.3]} rotation={[1.5, 0, 0]}>
         <VoxelPart position={[0, 0, 0]} size={[0.08, 1.0, 0.08]} color="#451a03" material="leather" />
         <VoxelPart position={[0, 0.5, 0]} size={[0.4, 0.5, 0.08]} color="#64748b" material="metal" />
         <VoxelPart position={[0, 0.5, 0.05]} size={[0.1, 0.4, 0.02]} color="#facc15" material="metal" />
      </group>
    </group>

    {/* Head - Full Helmet */}
    <group position={[0, 0.55, 0]}>
      <VoxelPart position={[0, 0, 0]} size={[0.38, 0.38, 0.38]} color="#d1d5db" material="skin" />
      <VoxelPart position={[0, 0.1, 0]} size={[0.45, 0.4, 0.45]} color={color} material="metal" /> {/* Helmet */}
      <VoxelPart position={[0, 0.05, 0.2]} size={[0.32, 0.12, 0.06]} color="#000" /> {/* Visor */}
      <VoxelPart position={[0.12, 0.05, 0.22]} size={[0.06, 0.06, 0.02]} color="#ef4444" material="gem" /> {/* Eye L */}
      <VoxelPart position={[-0.12, 0.05, 0.22]} size={[0.06, 0.06, 0.02]} color="#ef4444" material="gem" /> {/* Eye R */}
      {/* Plume */}
      <VoxelPart position={[0, 0.35, -0.1]} size={[0.08, 0.3, 0.3]} color="#ef4444" material="cloth" rotation={[-0.4, 0, 0]} />
    </group>
  </group>
);

const UndeadModel = ({ color }: { color: string }) => (
  <group position={[0, 0.9, 0]}>
    {/* Skeletal Structure */}
    <VoxelPart position={[0, 0, 0]} size={[0.12, 0.85, 0.12]} color="#f1f5f9" material="bone" />
    {/* Ribcage */}
    <VoxelPart position={[0, 0.25, 0]} size={[0.45, 0.06, 0.22]} color="#f1f5f9" material="bone" />
    <VoxelPart position={[0, 0.15, 0]} size={[0.4, 0.06, 0.2]} color="#f1f5f9" material="bone" />
    <VoxelPart position={[0, 0.05, 0]} size={[0.35, 0.06, 0.18]} color="#f1f5f9" material="bone" />
    <VoxelPart position={[0, -0.05, 0]} size={[0.3, 0.06, 0.15]} color="#f1f5f9" material="bone" />
    
    {/* Tattered Robe & Cape */}
    <VoxelPart position={[0, -0.2, 0]} size={[0.48, 0.75, 0.32]} color={color} material="cloth" opacity={0.85} />
    <VoxelPart position={[0, -0.65, 0]} size={[0.42, 0.4, 0.28]} color={color} material="cloth" opacity={0.6} />
    <VoxelPart position={[0, 0, -0.2]} size={[0.6, 1.2, 0.05]} color="#1e1b4b" material="cloth" rotation={[0.1, 0, 0]} opacity={0.8} /> {/* Cape */}
    
    {/* Bony Arms */}
    <group position={[-0.28, 0.25, 0]} rotation={[0, 0, 0.6]}>
       <VoxelPart position={[0, -0.25, 0]} size={[0.08, 0.6, 0.08]} color="#f1f5f9" material="bone" />
       <VoxelPart position={[0, 0, 0]} size={[0.18, 0.18, 0.18]} color={color} material="cloth" /> {/* Shoulder rag */}
       <VoxelPart position={[0, -0.5, 0]} size={[0.1, 0.15, 0.1]} color="#f1f5f9" material="bone" /> {/* Hand */}
    </group>
    <group position={[0.28, 0.25, 0]} rotation={[0, 0, -0.6]}>
       <VoxelPart position={[0, -0.25, 0]} size={[0.08, 0.6, 0.08]} color="#f1f5f9" material="bone" />
       <VoxelPart position={[0, 0, 0]} size={[0.18, 0.18, 0.18]} color={color} material="cloth" />
       <VoxelPart position={[0, -0.5, 0]} size={[0.1, 0.15, 0.1]} color="#f1f5f9" material="bone" />
    </group>

    {/* Skull - Highly Detailed */}
    <group position={[0, 0.6, 0]}>
      <VoxelPart position={[0, 0, 0]} size={[0.35, 0.35, 0.35]} color="#f1f5f9" material="bone" />
      <VoxelPart position={[0, -0.12, 0.12]} size={[0.28, 0.18, 0.18]} color="#f1f5f9" material="bone" /> {/* Jaw */}
      <VoxelPart position={[0.08, -0.18, 0.2]} size={[0.02, 0.06, 0.02]} color="#fff" material="bone" /> {/* Tooth */}
      <VoxelPart position={[-0.08, -0.18, 0.2]} size={[0.02, 0.06, 0.02]} color="#fff" material="bone" />
      
      {/* Eye Sockets */}
      <VoxelPart position={[0.1, 0.06, 0.14]} size={[0.1, 0.1, 0.06]} color="#000" />
      <VoxelPart position={[-0.1, 0.06, 0.14]} size={[0.1, 0.1, 0.06]} color="#000" />
      
      {/* Ethereal Glow */}
      <VoxelPart position={[0.1, 0.06, 0.16]} size={[0.05, 0.05, 0.05]} color="#a855f7" material="gem" />
      <VoxelPart position={[-0.1, 0.06, 0.16]} size={[0.05, 0.05, 0.05]} color="#a855f7" material="gem" />
      <VoxelPart position={[0.1, 0.06, 0.18]} size={[0.02, 0.02, 0.02]} color="#fff" material="gem" />
      <VoxelPart position={[-0.1, 0.06, 0.18]} size={[0.02, 0.02, 0.02]} color="#fff" material="gem" />

      {/* Tattered Hood */}
      <VoxelPart position={[0, 0.12, -0.08]} size={[0.42, 0.42, 0.42]} color={color} material="cloth" opacity={0.8} />
      <VoxelPart position={[0, 0.3, -0.1]} size={[0.1, 0.4, 0.4]} color={color} material="cloth" rotation={[-0.5, 0, 0]} opacity={0.7} />
    </group>
  </group>
);

// --- MAIN COMPONENTS ---

const HeroVoxel = ({ isAttacking, isDefending, weaponId, armorId, helmetId, legsId, shieldId, isLevelingUp, isHit }: any) => {
  const group = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Group>(null);
  const flashRef = useRef<number>(0);

  useFrame((state) => {
    if (group.current) {
      const t = state.clock.elapsedTime;
      
      // Idle/Action movement
      if (isAttacking) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0.5, 0.2);
        group.current.position.y = -1 + Math.sin(Math.PI * (group.current.position.x + 2) / 2.5) * 0.5;
      } else if (isDefending) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -1.5, 0.1);
        group.current.position.y = -1.1;
        group.current.rotation.x = 0.2;
      } else {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -2, 0.1);
        group.current.position.y = -1 + Math.sin(t * 2) * 0.03;
        group.current.rotation.x = 0;
      }

      // Level Up Effect
      if (isLevelingUp) {
        group.current.rotation.y += 0.5;
        group.current.position.y += 0.05;
      }

      // Hit Flash
      if (isHit) {
        flashRef.current = 1;
      } else {
        flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.1);
      }
      
      group.current.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.emissive = new THREE.Color(isHit ? "#ffffff" : "#000000");
          child.material.emissiveIntensity = flashRef.current * 2;
        }
      });
    }

    if (shieldRef.current) {
      shieldRef.current.visible = isDefending;
      shieldRef.current.rotation.y += 0.05;
      shieldRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
    }
  });

  return (
    <group>
      <group ref={group} position={[-2, -1, 0]} rotation={[0, 0.5, 0]}>
        <HeroBody 
          armorId={armorId} 
          legsId={legsId} 
          helmetId={helmetId} 
          weaponId={weaponId} 
          shieldId={shieldId} 
          isAttacking={isAttacking} 
        />
        {isLevelingUp && (
          <group position={[0, 1, 0]}>
            <VoxelPart position={[0, 0, 0]} size={[1.5, 0.1, 1.5]} color="#facc15" material="gem" opacity={0.6} />
            <VoxelPart position={[0, 0.5, 0]} size={[1, 0.1, 1]} color="#facc15" material="gem" opacity={0.4} />
          </group>
        )}
        <ContactShadows opacity={0.4} scale={3} blur={2.4} far={2} />
      </group>
      
      {/* Energy Shield Effect */}
      <group ref={shieldRef} position={[-1.5, -0.5, 0]}>
        <mesh>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.2} wireframe />
        </mesh>
        <mesh scale={0.9}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.1} />
        </mesh>
      </group>
    </group>
  );
};

const EnemyVoxel = ({ color, scale, isAttacking, isDefending, type = 'beast', isHit }: any) => {
  const group = useRef<THREE.Group>(null);
  const flashRef = useRef<number>(0);

  useFrame((state) => {
    if (group.current) {
      const t = state.clock.elapsedTime;
      
      // Attack animation
      if (isAttacking) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -0.5, 0.2);
        group.current.rotation.z = Math.sin(t * 20) * 0.1;
      } else if (isDefending) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 1.5, 0.1);
        group.current.position.y = -1.1;
        group.current.rotation.x = 0.2;
      } else {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 2, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
        group.current.rotation.x = 0;
        
        // Type-specific Idle Animations
        if (type === 'beast') {
          group.current.position.y = -1 + Math.sin(t * 4) * 0.08; // Heavy breathing
          group.current.rotation.x = Math.sin(t * 2) * 0.05; // Prowling tilt
        } else if (type === 'humanoid') {
          group.current.position.y = -1 + Math.sin(t * 2) * 0.03; // Steady breathing
          group.current.rotation.y = -0.5 + Math.sin(t * 1.5) * 0.05; // Looking around
        } else if (type === 'undead') {
          group.current.position.y = -0.8 + Math.sin(t * 3) * 0.15; // Floating
          group.current.rotation.z = Math.sin(t * 2) * 0.1; // Swaying
          group.current.rotation.x = Math.sin(t * 1.2) * 0.1; // Erratic tilt
        }
      }

      // Hit Flash
      if (isHit) {
        flashRef.current = 1;
      } else {
        flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.1);
      }
      
      group.current.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.emissive = new THREE.Color(isHit ? "#ffffff" : "#000000");
          child.material.emissiveIntensity = flashRef.current * 2;
        }
      });

      const breathe = 1 + Math.sin(t * 3) * 0.02;
      const finalScale = scale * (type === 'undead' ? 0.9 : 1.0); // Undead slightly smaller base
      group.current.scale.set(finalScale * breathe, finalScale * breathe, finalScale * breathe);
    }
  });

  return (
    <group ref={group} position={[2, -1, 0]} rotation={[0, -0.5, 0]}>
      {type === 'beast' && <BeastModel color={color} />}
      {type === 'humanoid' && <HumanoidModel color={color} />}
      {type === 'undead' && <UndeadModel color={color} />}
      <ContactShadows opacity={0.4} scale={3} blur={2.4} far={2} />
    </group>
  );
};

const MeshParticle: React.FC<Particle> = ({ position, color, velocity }) => {
    const ref = useRef<THREE.Mesh>(null);
    const [alive, setAlive] = useState(true);

    useFrame((_, delta) => {
        if(ref.current && alive) {
            ref.current.position.x += velocity[0] * delta;
            ref.current.position.y += velocity[1] * delta;
            ref.current.position.z += velocity[2] * delta;
            ref.current.scale.multiplyScalar(0.95);
            if(ref.current.scale.x < 0.01) setAlive(false);
        }
    });

    if(!alive) return null;

    return (
        <mesh ref={ref} position={position}>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
    );
};

const GrassFloor = () => {
    const tiles = useMemo(() => {
        const arr = [];
        // Extend floor further back to cover mountains
        for(let x = -40; x <= 40; x += 4) {
            for(let z = -50; z <= 20; z += 4) {
                const h = 0.1 + Math.random() * 0.1;
                const greens = ["#166534", "#15803d", "#14532d", "#166534"];
                const color = greens[Math.floor(Math.random() * greens.length)];
                arr.push(
                    <VoxelPart 
                        key={`${x}-${z}`} 
                        position={[x, -1.1, z]} 
                        size={[3.9, h, 3.9]} 
                        color={color} 
                        material="standard" 
                    />
                );
            }
        }
        return arr;
    }, []);
    return <group>{tiles}</group>;
};

const Tree = ({ position, scale = 1 }: { position: [number, number, number], scale?: number }) => {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <VoxelPart position={[0, 0.5, 0]} size={[0.3, 1, 0.3]} color="#451a03" material="leather" />
      {/* Leaves */}
      <group position={[0, 1.2, 0]}>
        <VoxelPart position={[0, 0.4, 0]} size={[1.2, 0.8, 1.2]} color="#15803d" material="cloth" />
        <VoxelPart position={[0, 1.0, 0]} size={[0.8, 0.6, 0.8]} color="#166534" material="cloth" />
        <VoxelPart position={[0, 1.4, 0]} size={[0.4, 0.4, 0.4]} color="#14532d" material="cloth" />
      </group>
    </group>
  );
};

const Cloud = ({ position, speed }: { position: [number, number, number], speed: number }) => {
  const ref = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.x = ((position[0] + state.clock.elapsedTime * speed + 15) % 30) - 15;
    }
  });

  return (
    <group ref={ref} position={position}>
      <VoxelPart position={[0, 0, 0]} size={[1.2, 0.4, 0.8]} color="#ffffff" opacity={0.8} />
      <VoxelPart position={[0.4, 0.2, 0]} size={[0.8, 0.4, 0.6]} color="#ffffff" opacity={0.8} />
      <VoxelPart position={[-0.4, 0.1, 0.2]} size={[0.6, 0.3, 0.5]} color="#ffffff" opacity={0.8} />
    </group>
  );
};

const DayNightCycle = ({ containerRef, onTimeUpdate }: { containerRef: React.RefObject<HTMLDivElement | null>, onTimeUpdate: (time: string) => void }) => {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Group>(null);

  const cloudData = useMemo(() => [
    { pos: [-10, 6, -15] as [number, number, number], speed: 0.05 },
    { pos: [0, 7, -18] as [number, number, number], speed: 0.03 },
    { pos: [8, 5, -16] as [number, number, number], speed: 0.07 },
    { pos: [-5, 8, -20] as [number, number, number], speed: 0.02 },
    { pos: [12, 6.5, -17] as [number, number, number], speed: 0.04 },
  ], []);

  useFrame((state) => {
    // 1 day = 1440 game minutes. 1 real second = 2 game minutes.
    // Start at 12:00 (720 minutes offset)
    const cycleDuration = 1440; 
    const gameTimeMultiplier = 2; // 2x faster
    const t = ((state.clock.elapsedTime * gameTimeMultiplier + 720) / cycleDuration) % 1;
    
    // Calculate HH:MM
    const totalMinutes = Math.floor(t * 1440);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    onTimeUpdate(timeString);

    // Time phases: 0-1
    let ambientIntensity = 0.5;
    let sunIntensity = 1;
    let sunColor = new THREE.Color("#ffffff");
    let skyColor = new THREE.Color("#ffffff");
    let sunPos = new THREE.Vector3(5, 5, 5);
    let moonPos = new THREE.Vector3(-5, -5, -5);
    let bgColor = "#020617";
    let cloudColor = new THREE.Color("#ffffff");
    let cloudOpacity = 0.8;

    // Calculate Sun and Moon positions in a circle
    // Offset so 0.25 (06:00) is sunrise (x=25, y=0), 0.5 (12:00) is noon (x=0, y=15)
    const angle = t * Math.PI * 2 - Math.PI / 2; 
    sunPos.set(Math.cos(angle) * 25, Math.sin(angle) * 15, -15);
    moonPos.set(Math.cos(angle + Math.PI) * 25, Math.sin(angle + Math.PI) * 15, -15);

    // Refined color logic based on t (0 to 1)
    if (t >= 0.2 && t < 0.35) { // Dawn (04:48 - 08:24)
      const p = (t - 0.2) / 0.15;
      ambientIntensity = THREE.MathUtils.lerp(0.3, 0.6, p);
      sunIntensity = THREE.MathUtils.lerp(0.3, 2.0, p);
      sunColor.lerpColors(new THREE.Color("#1e3a8a"), new THREE.Color("#ff7e5f"), p);
      skyColor.lerpColors(new THREE.Color("#020617"), new THREE.Color("#7dd3fc"), p);
      // Use a more vibrant dawn transition for background
      const dawnColors = ["#020617", "#1e1b4b", "#4c1d95", "#7c2d12", "#7dd3fc"];
      const colorIdx = Math.min(Math.floor(p * dawnColors.length), dawnColors.length - 1);
      bgColor = dawnColors[colorIdx];
      cloudColor.lerpColors(new THREE.Color("#475569"), new THREE.Color("#ffffff"), p);
    } else if (t >= 0.35 && t < 0.65) { // Day (08:24 - 15:36)
      ambientIntensity = 0.6;
      sunIntensity = 2.0;
      sunColor.set("#ffffff");
      skyColor.set("#7dd3fc");
      bgColor = "#7dd3fc"; // Vibrant sky blue
      cloudColor.set("#ffffff");
    } else if (t >= 0.65 && t < 0.8) { // Sunset (15:36 - 19:12)
      const p = (t - 0.65) / 0.15;
      ambientIntensity = THREE.MathUtils.lerp(0.6, 0.3, p);
      sunIntensity = THREE.MathUtils.lerp(2.0, 0.5, p);
      sunColor.lerpColors(new THREE.Color("#ffffff"), new THREE.Color("#f97316"), p);
      skyColor.lerpColors(new THREE.Color("#7dd3fc"), new THREE.Color("#020617"), p);
      // Use a more vibrant sunset transition for background
      const sunsetColors = ["#7dd3fc", "#fcd34d", "#f97316", "#7c2d12", "#1e1b4b", "#020617"];
      const colorIdx = Math.min(Math.floor(p * sunsetColors.length), sunsetColors.length - 1);
      bgColor = sunsetColors[colorIdx];
      cloudColor.lerpColors(new THREE.Color("#ffffff"), new THREE.Color("#f97316"), p);
    } else { // Night
      ambientIntensity = 0.3;
      sunIntensity = 0.4;
      sunColor.set("#1e3a8a");
      skyColor.set("#020617");
      bgColor = "#020617";
      cloudColor.set("#475569");
      cloudOpacity = 0.4;
    }

    if (ambientRef.current) ambientRef.current.intensity = ambientIntensity;
    if (hemiRef.current) {
      hemiRef.current.intensity = ambientIntensity * 0.5;
      hemiRef.current.color.copy(skyColor);
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = sunIntensity;
      sunLightRef.current.color.copy(sunColor);
      sunLightRef.current.position.copy(sunPos);
    }
    
    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunPos);
      // Hide sun when below horizon
      sunMeshRef.current.scale.setScalar(sunPos.y > -1 ? 1 : 0);
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonPos);
      // Hide moon when below horizon
      moonMeshRef.current.scale.setScalar(moonPos.y > -1 ? 1 : 0);
    }

    if (containerRef.current) {
      containerRef.current.style.backgroundColor = bgColor;
    }
    state.scene.background = new THREE.Color(bgColor);

    if (cloudsRef.current) {
      cloudsRef.current.children.forEach((cloudGroup: any) => {
        cloudGroup.children.forEach((voxel: any) => {
          if (voxel.material) {
            voxel.material.color.copy(cloudColor);
            voxel.material.opacity = cloudOpacity;
            voxel.material.transparent = cloudOpacity < 1;
          }
        });
      });
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} />
      <hemisphereLight ref={hemiRef} groundColor="#475569" />
      <directionalLight 
        ref={sunLightRef} 
        castShadow 
        shadow-mapSize={[4096, 4096]} 
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
      />
      
      {/* Visual Sun */}
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={2} />
      </mesh>

      {/* Visual Moon */}
      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#94a3b8" emissiveIntensity={0.5} />
      </mesh>

      {/* Drifting Clouds */}
      <group ref={cloudsRef}>
        {cloudData.map((c, i) => (
          <Cloud key={i} position={c.pos} speed={c.speed} />
        ))}
      </group>

      <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
    </>
  );
};

const BattlePlatform = () => {
  return (
    <group position={[0, -1.15, 0]}>
      {/* Main Arena */}
      <VoxelPart position={[0, 0, 0]} size={[12, 0.2, 8]} color="#334155" material="standard" />
      <VoxelPart position={[0, 0.05, 0]} size={[11.5, 0.1, 7.5]} color="#1e293b" material="standard" />
      
      {/* Decorative Edges */}
      <VoxelPart position={[0, 0.1, 3.9]} size={[12.2, 0.3, 0.2]} color="#475569" material="metal" />
      <VoxelPart position={[0, 0.1, -3.9]} size={[12.2, 0.3, 0.2]} color="#475569" material="metal" />
      <VoxelPart position={[6.1, 0.1, 0]} size={[0.2, 0.3, 8.2]} color="#475569" material="metal" />
      <VoxelPart position={[-6.1, 0.1, 0]} size={[0.2, 0.3, 8.2]} color="#475569" material="metal" />

      {/* Corner Pillars */}
      {[[-6, 4], [6, 4], [-6, -4], [6, -4]].map((pos, i) => (
        <group key={i} position={[pos[0], 0.5, pos[1]]}>
          <VoxelPart position={[0, 0, 0]} size={[0.6, 1, 0.6]} color="#1e293b" material="standard" />
          <VoxelPart position={[0, 0.6, 0]} size={[0.4, 0.2, 0.4]} color="#facc15" material="gem" emissive="#facc15" emissiveIntensity={1} />
        </group>
      ))}
    </group>
  );
};

const CameraController = ({ screenShake }: { screenShake?: number }) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame((state) => {
    if (cameraRef.current && screenShake) {
      const shake = screenShake;
      cameraRef.current.position.x = (Math.random() - 0.5) * shake;
      cameraRef.current.position.y = 4 + (Math.random() - 0.5) * shake;
    } else if (cameraRef.current) {
      cameraRef.current.position.x = THREE.MathUtils.lerp(cameraRef.current.position.x, 0, 0.1);
      cameraRef.current.position.y = THREE.MathUtils.lerp(cameraRef.current.position.y, 4, 0.1);
    }
    if (cameraRef.current) {
      cameraRef.current.lookAt(0, 0, 0);
    }
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 4, 12]} fov={45} />;
};

export const GameScene: React.FC<SceneProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameTime, setGameTime] = useState("12:00");

  const bgColor = useMemo(() => {
    const stage = props.stage || 1;
    const colors = ['#020617', '#0c0a09', '#050505', '#1e1b4b', '#450a0a'];
    return colors[(stage - 1) % colors.length];
  }, [props.stage]);

  const trees = useMemo(() => [
    { pos: [-8, -1.1, -2], scale: 1.2 },
    { pos: [-12, -1.1, 1], scale: 1.5 },
    { pos: [10, -1.1, -1], scale: 1.3 },
    { pos: [14, -1.1, 2], scale: 1.1 },
    { pos: [-15, -1.1, -5], scale: 1.4 },
    { pos: [18, -1.1, -3], scale: 1.6 },
    { pos: [-5, -1.1, -8], scale: 1.0 },
    { pos: [5, -1.1, -10], scale: 1.2 },
    { pos: [0, -1.1, -12], scale: 1.8 },
    { pos: [-20, -1.1, 0], scale: 2.0 },
    { pos: [20, -1.1, 5], scale: 1.5 },
    { pos: [-25, -1.1, -10], scale: 1.8 },
    { pos: [25, -1.1, -8], scale: 1.4 },
    { pos: [-30, -1.1, -5], scale: 2.2 },
    { pos: [30, -1.1, 0], scale: 1.9 },
  ], []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 transition-colors duration-1000" style={{ backgroundColor: bgColor }}>
      {/* Time Display Overlay */}
      <div className="absolute top-6 left-6 z-10 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1 rounded-full flex items-center gap-3 pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-mono text-white text-sm tracking-widest">{gameTime}</span>
      </div>

      <Canvas shadows>
        <CameraController screenShake={props.screenShake} />
        <DayNightCycle containerRef={containerRef} onTimeUpdate={setGameTime} />
        <pointLight position={[-5, 2, -2]} intensity={0.5} color="#3b82f6" />
        
        <GrassFloor />
        <BattlePlatform />

        {/* Background Trees */}
        <group>
          {trees.map((t, i) => (
            <Tree key={i} position={t.pos as any} scale={t.scale} />
          ))}
        </group>
        
        <HeroVoxel 
          isAttacking={props.isPlayerAttacking}
          isDefending={props.isPlayerDefending}
          weaponId={props.equippedWeaponId}
          armorId={props.equippedArmorId}
          helmetId={props.equippedHelmetId}
          legsId={props.equippedLegsId}
          shieldId={props.equippedShieldId}
          isLevelingUp={props.isLevelingUp}
          isHit={props.isPlayerHit}
        />
        
        <EnemyVoxel 
          color={props.enemyColor}
          scale={props.enemyScale}
          isAttacking={props.isEnemyAttacking}
          isDefending={props.isEnemyDefending}
          type={props.enemyType}
          isHit={props.isEnemyHit}
        />

        {props.particles.map(p => <MeshParticle key={p.id} {...p} />)}
      </Canvas>
    </div>
  );
};

const MaterialModel = ({ type }: { type: string }) => {
  if (type === 'mat_wood') return <VoxelPart position={[0, 0, 0]} size={[0.2, 0.6, 0.2]} color="#78350f" material="leather" />;
  if (type === 'mat_bone') return <VoxelPart position={[0, 0, 0]} size={[0.15, 0.5, 0.15]} color="#f1f5f9" material="bone" />;
  if (type === 'mat_slime') return <VoxelPart position={[0, 0, 0]} size={[0.4, 0.3, 0.4]} color="#10b981" material="gem" opacity={0.8} />;
  if (type === 'mat_cloth') return <VoxelPart position={[0, 0, 0]} size={[0.5, 0.1, 0.5]} color="#94a3b8" material="cloth" />;
  if (type === 'mat_iron') return <VoxelPart position={[0, 0, 0]} size={[0.3, 0.3, 0.3]} color="#64748b" material="metal" />;
  if (type === 'mat_gold') return <VoxelPart position={[0, 0, 0]} size={[0.2, 0.2, 0.2]} color="#facc15" material="metal" />;
  return <VoxelPart position={[0, 0, 0]} size={[0.3, 0.3, 0.3]} color="#fff" />;
};

export const ItemPreviewCanvas = ({ itemType, itemId }: { itemType: string, itemId: string }) => {
    return (
        <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [0, 0, 4], fov: 40 }}>
            <ambientLight intensity={1} />
            <pointLight position={[2, 2, 2]} intensity={2} />
            <group scale={1.5}>
               {itemType === 'weapon' && <WeaponModel type={itemId} />}
               {itemType === 'shield' && <ShieldModel type={itemId} />}
               {itemType === 'potion' && <PotionModel type={itemId} />}
               {itemType === 'material' && <MaterialModel type={itemId} />}
               {(itemType === 'armor' || itemType === 'helmet' || itemType === 'legs') && (
                  <group position={[0, -1, 0]}>
                     <HeroBody 
                        armorId={itemType === 'armor' ? itemId : undefined}
                        helmetId={itemType === 'helmet' ? itemId : undefined}
                        legsId={itemType === 'legs' ? itemId : undefined}
                     />
                  </group>
               )}
            </group>
            <OrbitControls enableZoom={false} autoRotate />
        </Canvas>
    );
};
