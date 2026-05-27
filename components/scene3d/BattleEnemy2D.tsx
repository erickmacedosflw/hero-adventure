/**
 * BattleEnemy2D — renderizador de inimigo 2D para batalha.
 *
 * Converte `enemyAnimationAction` em `spriteUrl + spritePosition + animTrigger`
 * para o Sprite2DBillboard, usando os sprites definidos em enemies2D.ts.
 *
 * Sprites são espelhados horizontalmente (flipX) para que o inimigo
 * encaro o herói (que fica à esquerda da cena).
 *
 * Deve ser montado dentro de um <group> já posicionado no chão da cena.
 *   groundY = 0   → chão no nível local do grupo
 *
 * Mapeamento enemyAnimationAction → sprite:
 *   idle / battle-idle → sprites.idle        (sem anim)
 *   attack / item      → sprites.attack +1   (volta idle 480ms)
 *   skill  / heal      → sprites.magic  +1   (volta idle 480ms)
 *   defend             → sprites.defense     (pose, sem anim)
 *   defend-hit         → sprites.defense +1  (vibração de dano sobre pose defense)
 *   hit / critical-hit → sprites.damage +1   (volta idle 520ms)
 *   evade              → sprites.idle   +1   (anim dodge)
 *   death              → sprites.dead + disintegrateTrigger
 */
import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';

import type { PlayerAnimationAction } from '../../types';
import { ENEMIES_2D } from '../../game/data/enemies2D';
import { useBattleAnimationStore } from '../../game/stores/battleAnimationStore';
import { Sprite2DBillboard } from './DeveloperEnemy2DScene';

// ── DefenseAura2DInner ────────────────────────────────────────────────
// Núcleo do efeito de defesa — usa useTexture (precisa de Suspense no pai).
const EnemyDefenseAura2DInner: React.FC<{ scale: number; spriteUrl: string }> = ({ scale, spriteUrl }) => {
  const texture  = useTexture(spriteUrl);
  const glowRef  = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const _piq     = useRef(new THREE.Quaternion());

  const img = texture.image as (HTMLImageElement & { naturalWidth?: number; naturalHeight?: number }) | null;
  const iw  = img?.naturalWidth  ?? img?.width  ?? 512;
  const ih  = img?.naturalHeight ?? img?.height ?? 512;
  const aspect = ih > 0 ? iw / ih : 0.75;

  const cy     = scale / 2;
  const gw     = scale * aspect * 1.10;
  const gh     = scale * 1.10;
  const radius = scale * 0.54;

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const mesh = glowRef.current;
    if (mesh) {
      if (mesh.parent) {
        mesh.parent.getWorldQuaternion(_piq.current);
        _piq.current.invert();
        mesh.quaternion.multiplyQuaternions(_piq.current, camera.quaternion);
      } else {
        mesh.quaternion.copy(camera.quaternion);
      }
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.52 + Math.sin(t * 3.0) * 0.20;
    }
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

const EnemyDefenseAura2D: React.FC<{ scale: number; visible: boolean; spriteUrl: string }> = ({ scale, visible, spriteUrl }) => {
  if (!visible || !spriteUrl) return null;
  return (
    <Suspense fallback={null}>
      <EnemyDefenseAura2DInner scale={scale} spriteUrl={spriteUrl} />
    </Suspense>
  );
};

// ── BattleEnemy2D ────────────────────────────────────────────────────────────────

export interface BattleEnemy2DProps {
  /** id do Enemy2DTemplate (ex: 'aguia_comum', 'lobo_comum', 'orc_barbaro_comum') */
  templateId: string;
  /**
   * Substituição da action vinda do store — útil para preview no dev console.
   * Se não fornecido, lê `enemyAnimationAction` do useBattleAnimationStore.
   */
  animationAction?: PlayerAnimationAction;
  /** Quando true, permite pointer events no sprite. Default: false */
  interactive?: boolean;
  /** Chamado ao clicar/tocar no sprite (pixel-preciso via alphaRaycast). */
  onSelect?: () => void;
  /** Chamado quando o hover state muda. */
  onHoverChange?: (hovered: boolean) => void;
}

export const BattleEnemy2D: React.FC<BattleEnemy2DProps> = ({
  templateId,
  animationAction: actionProp,
  interactive = false,
  onSelect,
  onHoverChange,
}) => {
  const storeAction = useBattleAnimationStore((s) => s.enemyAnimationAction);
  const animationAction: PlayerAnimationAction = actionProp ?? storeAction;

  const enemy = ENEMIES_2D.find((e) => e.id === templateId);

  // Pré-carrega todas as 6 texturas do template assim que o templateId é conhecido,
  // evitando o delay/flash na primeira troca de sprite em batalha.
  useEffect(() => {
    if (!enemy) return;
    Object.values(enemy.sprites).forEach((url) => useTexture.preload(url));
  }, [enemy]);

  const [spriteUrl,           setSpriteUrl]           = useState<string>(enemy?.sprites.idle ?? '');
  const [spritePosition,      setSpritePosition]      = useState<string>('idle');
  const [animTrigger,         setAnimTrigger]         = useState(0);
  const [disintegrateTrigger, setDisintegrateTrigger] = useState(0);
  const [spawnTrigger,        setSpawnTrigger]        = useState(1); // 1 on mount → dispara materialize

  const prevTemplateIdRef = useRef(templateId);
  useEffect(() => {
    if (templateId !== prevTemplateIdRef.current) {
      prevTemplateIdRef.current = templateId;
      setSpawnTrigger((v) => v + 1);
    }
  }, [templateId]);

  const returnTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => () => {
    if (returnTimerRef.current !== null) window.clearTimeout(returnTimerRef.current);
  }, []);

  useEffect(() => {
    if (!enemy) return;

    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }

    const returnToIdle = (delay: number) => {
      returnTimerRef.current = window.setTimeout(() => {
        setSpriteUrl(enemy.sprites.idle);
        setSpritePosition('idle');
      }, delay);
    };

    switch (animationAction) {
      case 'attack':
      case 'item':
        setSpriteUrl(enemy.sprites.attack);
        setSpritePosition('attack');
        setAnimTrigger((v) => v + 1);
        returnToIdle(480);
        break;

      case 'skill':
      case 'heal':
        setSpriteUrl(enemy.sprites.magic);
        setSpritePosition('magic');
        setAnimTrigger((v) => v + 1);
        returnToIdle(480);
        break;

      case 'defend':
        setSpriteUrl(enemy.sprites.defense);
        setSpritePosition('defense');
        break;

      case 'defend-hit':
        setSpriteUrl(enemy.sprites.defense);
        setSpritePosition('defense');
        setAnimTrigger((v) => v + 1);
        break;

      case 'hit':
      case 'critical-hit':
        // Aguarda 160ms antes de trocar para o sprite de dano,
        // dando tempo para o sprite de ataque do oponente ser visto.
        returnTimerRef.current = window.setTimeout(() => {
          setSpriteUrl(enemy.sprites.damage);
          setSpritePosition('damage');
          setAnimTrigger((v) => v + 1);
          returnTimerRef.current = window.setTimeout(() => {
            setSpriteUrl(enemy.sprites.idle);
            setSpritePosition('idle');
          }, 520);
        }, 160);
        break;

      case 'evade':
        setSpriteUrl(enemy.sprites.idle);
        setSpritePosition('idle');
        setAnimTrigger((v) => v + 1);
        break;

      case 'death':
        setSpriteUrl(enemy.sprites.damage);
        setSpritePosition('dead');
        setDisintegrateTrigger((v) => v + 1);
        break;

      default:
        setSpriteUrl(enemy.sprites.idle);
        setSpritePosition('idle');
        break;
    }
  }, [animationAction, enemy]);

  if (!enemy) return null;

  const isDefending = animationAction === 'defend' || animationAction === 'defend-hit';
  const hasSelect = !!onSelect;

  return (
    <>
      <group
        onClick={hasSelect ? (e) => { e.stopPropagation(); onSelect!(); } : undefined}
        onPointerDown={hasSelect ? (e) => { e.stopPropagation(); onSelect!(); } : undefined}
        onPointerEnter={onHoverChange ? (e) => { e.stopPropagation(); onHoverChange(true); if (typeof document !== 'undefined') document.body.style.cursor = 'pointer'; } : undefined}
        onPointerLeave={onHoverChange ? (e) => { e.stopPropagation(); onHoverChange(false); if (typeof document !== 'undefined') document.body.style.cursor = ''; } : undefined}
      >
        <Suspense fallback={null}>
          <Sprite2DBillboard
            spriteUrl={spriteUrl}
            heightUnits={enemy.scale ?? 2.0}
            shadowLightDir={[0, 0, 6]}
            groundY={0}
            spritePosition={spritePosition}
            animTrigger={animTrigger}
            attackStyle={enemy.attackStyle ?? 'melee'}
            disintegrateTrigger={disintegrateTrigger}
            spawnTrigger={spawnTrigger}
            interactive={interactive || hasSelect}
            flipX
          />
        </Suspense>
      </group>
      <EnemyDefenseAura2D
        scale={enemy.scale ?? 2.0}
        visible={isDefending}
        spriteUrl={spriteUrl}
      />
    </>
  );
};
