
import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Stars, Float, Instances, Instance, PerspectiveCamera, ContactShadows, OrbitControls } from '@react-three/drei';
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
}

// --- VOXEL HELPERS ---
const VoxelPart = ({ position, size, color, offset = [0,0,0], rotation = [0,0,0] }: any) => (
  <mesh 
    position={[position[0] + offset[0], position[1] + offset[1], position[2] + offset[2]]} 
    rotation={rotation}
    castShadow 
    receiveShadow
  >
    <boxGeometry args={size} />
    <meshStandardMaterial 
        color={color} 
        roughness={0.8} 
        metalness={0.1}
        flatShading={true}
    />
  </mesh>
);

// --- EQUIPMENT MODELS ---

const WeaponModel = ({ type }: { type?: string }) => {
  // Default: Rusty Sword
  if (!type || type === 'wep_1') { // Adaga / Default
    return (
      <group position={[0.4, 0.8, 0.2]} rotation={[0.2, 0, 0]}>
         <VoxelPart position={[0, 0, 0]} size={[0.1, 0.3, 0.1]} color="#5d4037" /> {/* Hilt */}
         <VoxelPart position={[0, 0.2, 0]} size={[0.2, 0.1, 0.1]} color="#a1a1aa" /> {/* Guard */}
         <VoxelPart position={[0, 0.5, 0]} size={[0.08, 0.6, 0.05]} color="#e4e4e7" /> {/* Blade */}
      </group>
    );
  }
  
  if (type === 'wep_2') { // Espada Longa
     return (
      <group position={[0.4, 0.8, 0.2]} rotation={[0.2, 0, 0]}>
         <VoxelPart position={[0, -0.1, 0]} size={[0.1, 0.4, 0.1]} color="#3f2c22" /> {/* Hilt Long */}
         <VoxelPart position={[0, 0.2, 0]} size={[0.4, 0.1, 0.15]} color="#fbbf24" /> {/* Gold Guard */}
         <VoxelPart position={[0, 0.8, 0]} size={[0.18, 1.3, 0.08]} color="#cbd5e1" /> {/* Long Blade */}
         <VoxelPart position={[0, 0.8, 0]} size={[0.05, 1.3, 0.1]} color="#94a3b8" /> {/* Ridge */}
      </group>
     );
  }

  if (type === 'wep_3') { // Katana Sombria
     return (
      <group position={[0.4, 0.8, 0.2]} rotation={[0.4, 0, 0]}>
         <VoxelPart position={[0, -0.1, 0]} size={[0.08, 0.5, 0.08]} color="#171717" /> {/* Hilt Black */}
         <VoxelPart position={[0, 0.2, 0]} size={[0.2, 0.05, 0.2]} color="#b91c1c" /> {/* Guard Red */}
         {/* Curved Blade approximation */}
         <VoxelPart position={[0, 0.5, 0.05]} size={[0.06, 0.5, 0.05]} color="#525252" /> 
         <VoxelPart position={[0, 0.9, 0.1]} size={[0.06, 0.5, 0.05]} color="#525252" rotation={[0.1, 0, 0]}/> 
         <VoxelPart position={[0, 1.3, 0.18]} size={[0.06, 0.4, 0.05]} color="#737373" rotation={[0.2, 0, 0]}/> 
      </group>
     );
  }

  return null;
};

const ShieldModel = ({ type }: { type?: string }) => {
    if (!type) return null;

    if (type === 'shd_1') { // Madeira
        return (
            <group position={[-0.6, 1.0, 0.2]} rotation={[0, Math.PI/2, 0]}>
                <VoxelPart position={[0, 0, 0]} size={[0.6, 0.6, 0.1]} color="#78350f" />
                <VoxelPart position={[0, 0, 0.05]} size={[0.5, 0.5, 0.05]} color="#92400e" />
                <VoxelPart position={[0, 0, 0.08]} size={[0.2, 0.2, 0.05]} color="#525252" />
            </group>
        )
    }

    if (type === 'shd_2') { // Torre
        return (
            <group position={[-0.6, 0.8, 0.3]} rotation={[0, Math.PI/2, 0]}>
                <VoxelPart position={[0, 0, 0]} size={[0.8, 1.2, 0.1]} color="#334155" />
                <VoxelPart position={[0, 0.2, 0.05]} size={[0.6, 0.6, 0.05]} color="#94a3b8" />
                <VoxelPart position={[0, -0.4, 0.05]} size={[0.6, 0.2, 0.05]} color="#94a3b8" />
            </group>
        )
    }
    return null;
}

const ArmorVisuals = ({ type, bodyPart }: { type?: string, bodyPart: 'head' | 'chest' | 'legs' }) => {
    const colors = {
        default: { main: '#1e3a8a', sec: '#bfdbfe' },
        arm_1: { main: '#15803d', sec: '#86efac' }, // Túnica (Green)
        arm_2: { main: '#475569', sec: '#94a3b8' }, // Aço (Grey)
        arm_3: { main: '#7f1d1d', sec: '#fca5a5' }, // Samurai (Red)
        // Helmets
        hlm_1: { main: '#78350f', sec: '#a8a29e' },
        hlm_2: { main: '#334155', sec: '#94a3b8' },
        // Legs
        leg_1: { main: '#57534e', sec: '#78716c' },
        leg_2: { main: '#334155', sec: '#64748b' },
    };

    const selectedColor = colors[type as keyof typeof colors] || colors.default;

    if (bodyPart === 'chest') {
        // Se não tiver armadura, renderiza o padrão
        const finalColor = type ? selectedColor : { main: '#1e3a8a', sec: '#bfdbfe' };
        return (
            <>
                <VoxelPart position={[0, 1.0, 0]} size={[0.5, 0.7, 0.3]} color={finalColor.main} />
                <VoxelPart position={[0, 1.0, 0.16]} size={[0.3, 0.5, 0.05]} color={finalColor.sec} />
                {(type === 'arm_2' || type === 'arm_3') && (
                    <>
                        <VoxelPart position={[-0.35, 1.3, 0]} size={[0.3, 0.15, 0.3]} color={finalColor.sec} />
                        <VoxelPart position={[0.35, 1.3, 0]} size={[0.3, 0.15, 0.3]} color={finalColor.sec} />
                    </>
                )}
            </>
        )
    }
    
    if (bodyPart === 'head' && type) {
         // Hood
         if (type === 'hlm_1') {
            return (
                <>
                   <VoxelPart position={[0, 1.9, -0.1]} size={[0.6, 0.6, 0.6]} color={selectedColor.main} />
                   <VoxelPart position={[0, 2.2, -0.1]} size={[0.2, 0.2, 0.6]} color={selectedColor.main} rotation={[-0.2,0,0]} />
                </>
            )
         }
         // Helm
         if (type === 'hlm_2') {
             return (
                 <>
                    <VoxelPart position={[0, 1.8, 0]} size={[0.55, 0.55, 0.55]} color={selectedColor.main} />
                    <VoxelPart position={[0, 1.9, 0.28]} size={[0.1, 0.4, 0.1]} color={selectedColor.sec} />
                    <VoxelPart position={[0, 2.0, 0]} size={[0.1, 0.1, 0.6]} color={selectedColor.sec} />
                 </>
             )
         }
         return null;
    }

    if (bodyPart === 'legs') {
        const legColor = type ? selectedColor.main : "#1e3a8a";
        return (
            <>
                 <VoxelPart position={[-0.15, 0.3, 0]} size={[0.2, 0.6, 0.25]} color={legColor} />
                 <VoxelPart position={[0.15, 0.3, 0]} size={[0.2, 0.6, 0.25]} color={legColor} />
                 
                 {/* Feet/Boots */}
                 <VoxelPart position={[-0.15, 0.05, 0.05]} size={[0.22, 0.15, 0.35]} color={type ? selectedColor.sec : '#0f172a'} />
                 <VoxelPart position={[0.15, 0.05, 0.05]} size={[0.22, 0.15, 0.35]} color={type ? selectedColor.sec : '#0f172a'} />
            </>
        )
    }

    return null;
}

const HeroVoxel = ({ isAttacking, weaponId, armorId, helmetId, legsId, shieldId }: { 
    isAttacking: boolean, weaponId?: string, armorId?: string, helmetId?: string, legsId?: string, shieldId?: string 
}) => {
  const group = useRef<THREE.Group>(null);
  const weaponRef = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (group.current) {
      const t = state.clock.elapsedTime;
      
      if (isAttacking) {
         group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0.5, 0.2);
         
         const dist = Math.abs(group.current.position.x - (-2));
         const jumpHeight = Math.sin(dist * 1.2) * 0.8;
         group.current.position.y = -1 + jumpHeight;
         
         group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -0.3, 0.2);

         if (weaponRef.current) {
            weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, -Math.PI / 1.5, 0.3);
            weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, -1.5, 0.3);
         }
         if (shieldRef.current) {
             shieldRef.current.rotation.y = THREE.MathUtils.lerp(shieldRef.current.rotation.y, 1, 0.2);
         }
      } else {
         group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -2, 0.1);
         group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1 + Math.sin(t * 3) * 0.05, 0.1);
         group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
         
         if (weaponRef.current) {
            weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.1);
            weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, Math.sin(t * 2) * 0.1, 0.1);
         }
         if (shieldRef.current) {
             shieldRef.current.rotation.y = THREE.MathUtils.lerp(shieldRef.current.rotation.y, 0, 0.1);
         }
      }
    }
  });

  return (
    <group ref={group} position={[-2, -1, 0]} rotation={[0, Math.PI / 6, 0]}>
      {/* Head Group */}
      <group>
        <VoxelPart position={[0, 1.6, 0]} size={[0.5, 0.5, 0.5]} color="#fcd34d" /> {/* Face */}
        {!helmetId && (
             <>
                <VoxelPart position={[0, 1.8, 0]} size={[0.6, 0.2, 0.6]} color="#f59e0b" /> 
                <VoxelPart position={[-0.3, 1.6, 0]} size={[0.1, 0.5, 0.6]} color="#f59e0b" />
                <VoxelPart position={[0.3, 1.6, 0]} size={[0.1, 0.5, 0.6]} color="#f59e0b" />
                <VoxelPart position={[0, 1.6, -0.3]} size={[0.6, 0.5, 0.1]} color="#f59e0b" />
             </>
        )}
        
        <VoxelPart position={[-0.15, 1.6, 0.26]} size={[0.08, 0.08, 0.05]} color="#000000" />
        <VoxelPart position={[0.15, 1.6, 0.26]} size={[0.08, 0.08, 0.05]} color="#000000" />
        
        <ArmorVisuals type={helmetId} bodyPart="head" />
      </group>

      <ArmorVisuals type={armorId} bodyPart="chest" />
      <VoxelPart position={[-0.4, 1.1, 0]} size={[0.25, 0.6, 0.25]} color="#1e3a8a" />
      <VoxelPart position={[0.4, 1.1, 0]} size={[0.25, 0.6, 0.25]} color="#1e3a8a" />

      <group ref={weaponRef}>
          <WeaponModel type={weaponId} />
      </group>
      <group ref={shieldRef}>
          <ShieldModel type={shieldId} />
      </group>

      <ArmorVisuals type={legsId} bodyPart="legs" />
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={2} blur={2} far={2} />
    </group>
  );
};

const EnemyVoxel = ({ color, scale, isAttacking, isDead, type = 'beast' }: any) => {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (group.current) {
      if (isDead) {
         group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.PI/2, 0.1);
         group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1.5, 0.1);
      } else {
         const t = state.clock.elapsedTime;
         group.current.rotation.z = 0;
         
         if (isAttacking) {
            group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -0.5, 0.15);
         } else {
            group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 2, 0.05);
            // Different idle animations based on type
            if (type === 'undead') {
                group.current.position.y = -0.2 + Math.sin(t * 1.5) * 0.3; // Float high
            } else {
                group.current.position.y = -0.5 + Math.sin(t * 3) * 0.05; // Grounded breathe
            }
            
            const breathe = 1 + Math.sin(t * 3) * 0.03;
            group.current.scale.set(scale * breathe, scale * breathe, scale * breathe);
         }
      }
    }
  });

  // --- MONSTER MODELS ---
  
  // 1. HUMANOID (Orc, Goblin, Knight)
  if (type === 'humanoid') {
      return (
        <group ref={group} position={[2, -0.5, 0]} rotation={[0, -Math.PI / 6, 0]} scale={scale}>
           <VoxelPart position={[0, 0.2, 0]} size={[0.6, 0.7, 0.4]} color={color} /> {/* Chest */}
           <VoxelPart position={[0, 0.8, 0]} size={[0.4, 0.4, 0.4]} color={color} /> {/* Head */}
           
           {/* Arms */}
           <VoxelPart position={[-0.4, 0.2, 0]} size={[0.2, 0.6, 0.2]} color={color} />
           <VoxelPart position={[0.4, 0.2, 0]} size={[0.2, 0.6, 0.2]} color={color} />
           
           {/* Legs */}
           <VoxelPart position={[-0.2, -0.5, 0]} size={[0.2, 0.6, 0.2]} color="#333" />
           <VoxelPart position={[0.2, -0.5, 0]} size={[0.2, 0.6, 0.2]} color="#333" />

           {/* Eyes */}
           <mesh position={[-0.1, 0.85, 0.21]}>
             <planeGeometry args={[0.08, 0.08]} />
             <meshBasicMaterial color="#ff0000" />
           </mesh>
           <mesh position={[0.1, 0.85, 0.21]}>
             <planeGeometry args={[0.08, 0.08]} />
             <meshBasicMaterial color="#ff0000" />
           </mesh>
           
           <ContactShadows position={[0, -0.8, 0]} opacity={0.6} scale={2} blur={2} />
        </group>
      )
  }

  // 2. BEAST (Wolf, Boar, Slime)
  if (type === 'beast') {
      return (
        <group ref={group} position={[2, -0.5, 0]} rotation={[0, -Math.PI / 6, 0]} scale={scale}>
           {/* Horizontal Body */}
           <VoxelPart position={[0, 0, 0]} size={[0.6, 0.5, 0.9]} color={color} /> 
           <VoxelPart position={[0, 0.3, -0.3]} size={[0.4, 0.4, 0.5]} color={color} /> {/* Head/Hump */}

           {/* Legs */}
           <VoxelPart position={[-0.3, -0.4, 0.3]} size={[0.15, 0.4, 0.15]} color={color} />
           <VoxelPart position={[0.3, -0.4, 0.3]} size={[0.15, 0.4, 0.15]} color={color} />
           <VoxelPart position={[-0.3, -0.4, -0.3]} size={[0.15, 0.4, 0.15]} color={color} />
           <VoxelPart position={[0.3, -0.4, -0.3]} size={[0.15, 0.4, 0.15]} color={color} />

           {/* Eyes */}
           <mesh position={[-0.15, 0.3, -0.56]}>
             <planeGeometry args={[0.1, 0.1]} />
             <meshBasicMaterial color="#fbbf24" />
           </mesh>
           <mesh position={[0.15, 0.3, -0.56]}>
             <planeGeometry args={[0.1, 0.1]} />
             <meshBasicMaterial color="#fbbf24" />
           </mesh>

           <ContactShadows position={[0, -0.6, 0]} opacity={0.6} scale={2.5} blur={2} />
        </group>
      )
  }

  // 3. UNDEAD (Ghost, Skeleton - Floating bits)
  return (
    <group ref={group} position={[2, -0.5, 0]} rotation={[0, -Math.PI / 6, 0]} scale={scale}>
      <VoxelPart position={[0, 0.5, 0]} size={[0.5, 0.6, 0.4]} color={color} /> {/* Ribcage/Torso */}
      <VoxelPart position={[0, 1.0, 0]} size={[0.35, 0.35, 0.35]} color="#e2e8f0" /> {/* Skull */}
      
      {/* Floating hands */}
      <Float speed={4} rotationIntensity={0.5} floatIntensity={1}>
         <VoxelPart position={[0.6, 0.5, 0.2]} size={[0.15, 0.4, 0.15]} color={color} />
         <VoxelPart position={[-0.6, 0.5, 0.2]} size={[0.15, 0.4, 0.15]} color={color} />
      </Float>
      
      {/* Tattered Robes / Lower body */}
      <VoxelPart position={[0, -0.2, 0]} size={[0.4, 0.6, 0.3]} color={color} />

      {/* Glowing Eyes */}
      <mesh position={[-0.1, 1.0, 0.18]}>
         <planeGeometry args={[0.08, 0.08]} />
         <meshBasicMaterial color="#a855f7" />
      </mesh>
      <mesh position={[0.1, 1.0, 0.18]}>
         <planeGeometry args={[0.08, 0.08]} />
         <meshBasicMaterial color="#a855f7" />
      </mesh>
      
      <ContactShadows position={[0, -1.0, 0]} opacity={0.4} scale={2} blur={3} />
    </group>
  );
};

const ParticleSystem = ({ particles }: { particles: Particle[] }) => (
    <group>
        {particles.map(p => <MeshParticle key={p.id} {...p} />)}
    </group>
);

const MeshParticle = ({ position, color, velocity, scale }: Particle) => {
    const ref = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const [active, setActive] = useState(true);

    useFrame((_, delta) => {
        if(ref.current && active) {
            ref.current.position.x += velocity[0] * delta;
            ref.current.position.y += velocity[1] * delta;
            ref.current.position.z += velocity[2] * delta;
            
            ref.current.rotation.x += delta * 5;
            ref.current.rotation.y += delta * 5;

            ref.current.scale.multiplyScalar(0.90); // Faster shrink
            
            // Flash effect: Light intensity drops quickly
            if (lightRef.current) {
                lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, 0, delta * 10);
            }

            if(ref.current.scale.x < 0.01) setActive(false);
        }
    });

    if(!active) return null;

    return (
        <mesh ref={ref} position={position} scale={scale}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial 
                color={color} 
                emissive={color} 
                emissiveIntensity={3}
                toneMapped={false}
                transparent 
                opacity={0.9} 
                flatShading={true}
            />
            {/* High intensity, fast decay light for flash effect */}
            <pointLight ref={lightRef} distance={5} intensity={5} color={color} decay={2} />
        </mesh>
    )
};

const DungeonEnvironment = () => (
    <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
            <planeGeometry args={[100, 20]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.2} />
        </mesh>
        
        <Instances range={10}>
            <boxGeometry args={[1, 10, 1]} />
            <meshStandardMaterial color="#334155" />
            <Instance position={[-6, 2, -5]} rotation={[0.1, 0, 0.2]} />
            <Instance position={[6, 1, -8]} rotation={[-0.1, 0, -0.2]} />
        </Instances>

        <Stars radius={30} depth={50} count={2000} factor={3} saturation={0} fade speed={1} />
    </group>
);

// --- MAIN SCENE EXPORT ---
export const GameScene: React.FC<SceneProps> = ({ enemyColor, enemyScale, turnState, isPlayerAttacking, isEnemyAttacking, particles, equippedWeaponId, equippedArmorId, equippedHelmetId, equippedLegsId, equippedShieldId, enemyType }) => {
  return (
    <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-800 to-black">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault position={[0, 0.5, 6]} fov={45} />
        
        <ambientLight intensity={1.0} />
        <hemisphereLight intensity={0.5} groundColor="#111" color="#fff" />
        
        <pointLight position={[2, 5, 5]} intensity={2} castShadow color="#fff" />
        <spotLight position={[-5, 8, 0]} intensity={2} angle={0.6} penumbra={0.5} color="#60a5fa" castShadow />

        <DungeonEnvironment />
        
        <HeroVoxel 
            isAttacking={isPlayerAttacking} 
            weaponId={equippedWeaponId} 
            armorId={equippedArmorId}
            helmetId={equippedHelmetId}
            legsId={equippedLegsId}
            shieldId={equippedShieldId}
        />
        
        <EnemyVoxel 
            color={enemyColor} 
            scale={enemyScale} 
            isAttacking={isEnemyAttacking} 
            isDead={false}
            type={enemyType}
        />

        <ParticleSystem particles={particles} />
        
        <Environment preset="night" />
        <fog attach="fog" args={['#0f172a', 5, 25]} />
      </Canvas>
    </div>
  );
};

// --- SHOP PREVIEW EXPORT ---
export const ItemPreviewCanvas = ({ itemType, itemId }: { itemType: string, itemId: string }) => {
    return (
        <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
            <ambientLight intensity={1.5} />
            <pointLight position={[2, 2, 2]} intensity={2} />
            <Float speed={4} rotationIntensity={1} floatIntensity={0.5}>
                <group scale={1.2} rotation={[0, -0.5, 0]}>
                   {itemType === 'weapon' && (
                       <group position={[-0.4, -0.5, 0]}>
                           <WeaponModel type={itemId} />
                       </group>
                   )}
                   {itemType === 'shield' && (
                       <group position={[0, -0.5, 0]}>
                           <ShieldModel type={itemId} />
                       </group>
                   )}
                   {itemType === 'armor' && (
                       <group position={[0, -1, 0]}>
                           <ArmorVisuals type={itemId} bodyPart="chest" />
                       </group>
                   )}
                   {itemType === 'helmet' && (
                       <group position={[0, -1.8, 0]}>
                           <ArmorVisuals type={itemId} bodyPart="head" />
                       </group>
                   )}
                   {itemType === 'legs' && (
                       <group position={[0, -0.5, 0]}>
                           <ArmorVisuals type={itemId} bodyPart="legs" />
                       </group>
                   )}
                   {itemType === 'potion' && (
                       <group position={[0, -0.5, 0]}>
                           <mesh position={[0, 0, 0]}>
                               <sphereGeometry args={[0.5, 16, 16]} />
                               <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={0.5} transparent opacity={0.8} roughness={0.2} flatShading={true} />
                           </mesh>
                           <mesh position={[0, 0.6, 0]}>
                               <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
                               <meshStandardMaterial color="#86efac" transparent opacity={0.6} />
                           </mesh>
                           <mesh position={[0, 0.9, 0]}>
                               <cylinderGeometry args={[0.25, 0.25, 0.1]} />
                               <meshStandardMaterial color="#57534e" />
                           </mesh>
                       </group>
                   )}
                </group>
            </Float>
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={4} />
        </Canvas>
    )
}
