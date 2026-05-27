/**
 * BattleHero2D — substitui AnimatedClassHero no HeroVoxel durante batalha.
 *
 * Converte `playerAnimationAction` em `spriteUrl + spritePosition + animTrigger`
 * para o Sprite2DBillboard, usando os sprites definidos em HEROES_2D.
 *
 * Deve ser montado dentro do <group position={originPosition}> do HeroVoxel,
 * que já posiciona o grupo no chão da cena.
 *   groundY = 0   → chão no nível local do grupo (world Y = originPosition.y)
 *   shadowLightDir = [0, 0, 6] → corresponde a directionalLight position=[0,6,6] (default dungeon)
 *
 * Mapeamento playerAnimationAction → sprite:
 *   idle / battle-idle → sprites.idle        (sem anim)
 *   attack / item      → sprites.attack +1   (volta idle 480ms)
 *   skill  / heal      → sprites.magic  +1   (volta idle 480ms)
 *   defend             → sprites.defense     (pose, sem anim)
 *   defend-hit         → sprites.defense +1  (vibração de dano sobre pose defense)
 *   hit / critical-hit → sprites.damage +1   (volta idle 520ms)
 *   evade              → sprites.idle   +1   (anim transição X — dodge)
 *   death              → sprites.dead + disintegrateTrigger
 */
import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';

import type { PlayerAnimationAction } from '../../types';
import { HEROES_2D } from '../../game/data/heroes2D';
import { Sprite2DBillboard } from './DeveloperEnemy2DScene';

// ── DefenseAura2DInner ───────────────────────────────────────────────────────
// Núcleo do efeito — usa useTexture (precisa de Suspense no pai).
// Brilho pixel-accurate: usa o mapa de cores + canal alpha do PNG do sprite
// para que o glow siga exatamente a silhueta do personagem.
// Ícone de escudo orbita em círculo ao redor do sprite via useFrame.
const DefenseAura2DInner: React.FC<{ scale: number; spriteUrl: string }> = ({ scale, spriteUrl }) => {
  const texture  = useTexture(spriteUrl);
  const glowRef  = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const _piq     = useRef(new THREE.Quaternion());

  // Calcula aspect ratio do sprite para dimensionar o plano de brilho
  const img = texture.image as (HTMLImageElement & { naturalWidth?: number; naturalHeight?: number }) | null;
  const iw  = img?.naturalWidth  ?? img?.width  ?? 512;
  const ih  = img?.naturalHeight ?? img?.height ?? 512;
  const aspect = ih > 0 ? iw / ih : 0.75;

  const cy     = scale / 2;                // centro Y do sprite
  const gw     = scale * aspect * 1.10;   // 10% maior para criar borda ao redor da silhueta
  const gh     = scale * 1.10;
  const radius = scale * 0.54;             // raio de órbita do ícone

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();

    // ── Billboard com compensação do quaternion do pai ──────────────────────
    const mesh = glowRef.current;
    if (mesh) {
      if (mesh.parent) {
        mesh.parent.getWorldQuaternion(_piq.current);
        _piq.current.invert();
        mesh.quaternion.multiplyQuaternions(_piq.current, camera.quaternion);
      } else {
        mesh.quaternion.copy(camera.quaternion);
      }
      // Pulso de intensidade do brilho
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.52 + Math.sin(t * 3.0) * 0.20;
    }

    // ── Ícone orbitando em círculo no plano XY local ─────────────────────────
    const orbit = orbitRef.current;
    if (orbit) {
      orbit.position.set(
        Math.cos(t * 2.0) * radius,
        cy + Math.sin(t * 2.0) * radius,
        0.12,
      );
    }
  });

  return (
    <>
      {/*
        Silhueta brilhante pixel-accurate:
        - `map` usa o canal alpha do PNG → exibe glow apenas nos pixels visíveis
        - `color` tinge de azul (multiplicado com cores do sprite)
        - AdditiveBlending → somado ao cenário como luz, sem bordar retangular
        - Plano 10% maior → aparece como halo/borda ao redor da silhueta
      */}
      <mesh ref={glowRef} position={[0, cy, -0.05]} renderOrder={0}>
        <planeGeometry args={[gw, gh]} />
        <meshBasicMaterial
          map={texture}
          color="#60a5fa"
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Ícone de escudo orbitando ao redor do sprite */}
      <group ref={orbitRef}>
        <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: '#93c5fd',
            filter: 'drop-shadow(0 0 5px #60a5fa) drop-shadow(0 0 14px #3b82f6)',
            lineHeight: 1,
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          </div>
        </Html>
      </group>
    </>
  );
};

// ── DefenseAura2D ─────────────────────────────────────────────────────────────
// Wrapper com Suspense — invisível enquanto a textura ainda não foi carregada
// (na prática a textura já foi carregada pelo Sprite2DBillboard, então resolve
// imediatamente via cache do THREE.Cache).
const DefenseAura2D: React.FC<{ scale: number; visible: boolean; spriteUrl: string }> = ({ scale, visible, spriteUrl }) => {
  if (!visible || !spriteUrl) return null;
  return (
    <Suspense fallback={null}>
      <DefenseAura2DInner scale={scale} spriteUrl={spriteUrl} />
    </Suspense>
  );
};

export interface BattleHero2DProps {
  /** classId do herói (ex: 'knight', 'mage') — deve existir em HEROES_2D */
  classId: string;
  /** effectivePlayerAnimationAction vindo de HeroVoxel */
  animationAction: PlayerAnimationAction;
  /** Quando true, permite pointer events no sprite (necessário para seleção de classe). Default: false */
  interactive?: boolean;
}

export const BattleHero2D: React.FC<BattleHero2DProps> = ({ classId, animationAction, interactive = false }) => {
  const hero = HEROES_2D.find((h) => h.classId === classId);

  const [spriteUrl,          setSpriteUrl]          = useState<string>(hero?.sprites.idle ?? '');
  const [spritePosition,     setSpritePosition]     = useState<string>('idle');
  const [animTrigger,        setAnimTrigger]        = useState(0);
  const [disintegrateTrigger,setDisintegrateTrigger] = useState(0);

  const returnTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  // Limpa timer de retorno ao idle ao desmontar
  useEffect(() => () => {
    if (returnTimerRef.current !== null) window.clearTimeout(returnTimerRef.current);
  }, []);

  useEffect(() => {
    if (!hero) return;

    // Cancelar qualquer retorno-ao-idle pendente antes de processar nova action
    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }

    const returnToIdle = (delay: number) => {
      returnTimerRef.current = window.setTimeout(() => {
        setSpriteUrl(hero.sprites.idle);
        setSpritePosition('idle');
      }, delay);
    };

    switch (animationAction) {
      case 'attack':
      case 'item':
        setSpriteUrl(hero.sprites.attack);
        setSpritePosition('attack');
        setAnimTrigger((v) => v + 1);
        returnToIdle(480);
        break;

      case 'skill':
      case 'heal':
        setSpriteUrl(hero.sprites.magic);
        setSpritePosition('magic');
        setAnimTrigger((v) => v + 1);
        returnToIdle(480);
        break;

      case 'defend':
        // Apenas muda de pose, sem disparar animação
        setSpriteUrl(hero.sprites.defense);
        setSpritePosition('defense');
        break;

      case 'defend-hit':
        // Mantém pose de defesa e vibra (mesma anim de dano)
        setSpriteUrl(hero.sprites.defense);
        setSpritePosition('defense');
        setAnimTrigger((v) => v + 1);
        break;

      case 'hit':
      case 'critical-hit':
        // Aguarda 160ms antes de trocar para o sprite de dano,
        // dando tempo para o sprite de ataque do oponente ser visto.
        returnTimerRef.current = window.setTimeout(() => {
          setSpriteUrl(hero.sprites.damage);
          setSpritePosition('damage');
          setAnimTrigger((v) => v + 1);
          returnTimerRef.current = window.setTimeout(() => {
            setSpriteUrl(hero.sprites.idle);
            setSpritePosition('idle');
          }, 520);
        }, 160);
        break;

      case 'evade':
        // Mantém idle, dispara anim de transição X (dodge visual)
        setSpriteUrl(hero.sprites.idle);
        setSpritePosition('idle');
        setAnimTrigger((v) => v + 1);
        break;

      case 'death':
        setSpriteUrl(hero.sprites.damage);
        setSpritePosition('dead');
        setDisintegrateTrigger((v) => v + 1);
        break;

      default:
        // idle, battle-idle
        setSpriteUrl(hero.sprites.idle);
        setSpritePosition('idle');
        break;
    }
  }, [animationAction, hero]);

  if (!hero) return null;

  return (
    <>
      <Suspense fallback={null}>
        <Sprite2DBillboard
          spriteUrl={spriteUrl}
          heightUnits={hero.scale ?? 2.0}
          shadowLightDir={[0, 0, 6]}
          groundY={0}
          spritePosition={spritePosition}
          animTrigger={animTrigger}
          attackStyle={hero.attackStyle ?? 'melee'}
          disintegrateTrigger={disintegrateTrigger}
          interactive={interactive}
        />
      </Suspense>
      <DefenseAura2D
        scale={hero.scale ?? 2.0}
        visible={animationAction === 'defend' || animationAction === 'defend-hit'}
        spriteUrl={spriteUrl}
      />
    </>
  );
};
