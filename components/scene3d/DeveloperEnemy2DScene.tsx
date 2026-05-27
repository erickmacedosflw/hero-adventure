/**
 * DeveloperEnemy2DScene
 *
 * Cena 3D (react-three-fiber) que exibe um sprite 2D de inimigo sobre
 * um ambiente de batalha estilizado, igual ao DeveloperMonsterSceneRenderer
 * mas sem modelo 3D — usa um <mesh> plane com textura PNG transparente.
 */
import React, { Suspense, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { getRenderPowerPreference, getRenderQualityProfile } from './environment';

// ── Análise dos pixels reais do PNG do sprite ────────────────────────────────
// Faz UMA única leitura do ImageData (canal RGBA pixel a pixel) e retorna:
//   normalMap          → textura de relevo gerada via filtro Sobel (claro = elevado, escuro = côncavo)
//   bottomTrimFraction → fração de linhas transparentes na base da imagem,
//                        usada para fazer o pixel visível mais baixo tocar o chão.
interface SpriteAnalysis {
  normalMap: THREE.CanvasTexture | null;
  bottomTrimFraction: number;
  /** Dados RGBA brutos do PNG para raycast sensível ao canal alfa */
  alphaData: { data: Uint8ClampedArray; width: number; height: number } | null;
}

export function analyzeSpritePixels(texture: THREE.Texture, normalStrength = 4.0): SpriteAnalysis {
  try {
    const img = texture.image as HTMLImageElement | ImageBitmap | null;
    if (!img) return { normalMap: null, bottomTrimFraction: 0, alphaData: null };

    // Dimensões reais do PNG
    const w = (img as HTMLImageElement).naturalWidth  ?? (img as ImageBitmap).width;
    const h = (img as HTMLImageElement).naturalHeight ?? (img as ImageBitmap).height;
    if (!w || !h) return { normalMap: null, bottomTrimFraction: 0, alphaData: null };

    // Desenha o PNG num canvas temporário e lê os pixels RGBA reais
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img as CanvasImageSource, 0, 0);
    const src = ctx.getImageData(0, 0, w, h);
    const px  = src.data; // Uint8ClampedArray: [R,G,B,A, R,G,B,A, ...]

    // ── 1. Bottom trim: escaneia os pixels reais de baixo para cima ──────────
    let bottomTrimFraction = 0;
    outer: for (let row = h - 1; row >= 0; row--) {
      for (let col = 0; col < w; col++) {
        if (px[(row * w + col) * 4 + 3] > 10) {    // alpha do pixel PNG
          bottomTrimFraction = (h - 1 - row) / h;  // fração de linhas transparentes abaixo
          break outer;
        }
      }
    }

    // ── 2. Normal map via Sobel sobre a luminância dos pixels PNG ─────────────
    const lum = (x: number, y: number): number => {
      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(h - 1, y));
      const i = (y * w + x) * 4;
      if (px[i + 3] < 10) return 128;              // pixel transparente → neutro
      return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    };

    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tl = lum(x-1,y-1), tm = lum(x,y-1), tr = lum(x+1,y-1);
        const ml = lum(x-1,y  ),                   mr = lum(x+1,y  );
        const bl = lum(x-1,y+1), bm = lum(x,y+1), br = lum(x+1,y+1);
        const dx = (tr + 2*mr + br) - (tl + 2*ml + bl);
        const dy = (bl + 2*bm + br) - (tl + 2*tm + tr);
        const nx = -(dx / 255) * normalStrength;
        const ny =  (dy / 255) * normalStrength;
        const nz = 1.0;
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        const i = (y * w + x) * 4;
        out[i    ] = ((nx / len) * 0.5 + 0.5) * 255;
        out[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        out[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        out[i + 3] = 255;
      }
    }
    ctx.putImageData(new ImageData(out, w, h), 0, 0);
    const normalMap = new THREE.CanvasTexture(canvas);

    // px ainda contém os dados RGBA originais (out é array separado; canvas foi sobrescrito mas px não)
    return { normalMap, bottomTrimFraction, alphaData: { data: px, width: w, height: h } };
  } catch {
    return { normalMap: null, bottomTrimFraction: 0, alphaData: null };
  }
}

// ── Inner: sprite renderizado como plane Three.js ─────────────────────────────

export interface Sprite2DBillboardProps {
  spriteUrl: string;
  heightUnits: number;
  /** Projeção horizontal da luz direcional para orientar o shadow caster (default: [-3,0,-5]) */
  shadowLightDir?: [number, number, number];
  /** Y do chão onde o pixel mais baixo do sprite toca (default: -1.12) */
  groundY?: number;
  /** Posição do sprite ('attack' | 'damage' | 'dead' | ...) — controla qual animação tocar */
  spritePosition?: string;
  /** Incremente para disparar a animação novamente para a mesma posição */
  animTrigger?: number;
  /** 'melee' (padrão): windup + lunge; 'ranged': recua e solta como se lançasse projétil */
  attackStyle?: 'melee' | 'ranged';
  /** Incremente para disparar animação de morte com flash branco + desintegração */
  disintegrateTrigger?: number;
  /** Quando true, o mesh principal responde a raycasts (permite clicar no sprite para selecionar). Default: false */
  interactive?: boolean;
  /** Quando true, espelha o sprite horizontalmente (inimigos que encaram o herói à esquerda). Default: false */
  flipX?: boolean;
}

/** @deprecated use Sprite2DBillboard */
type Sprite2DCharacterProps = Sprite2DBillboardProps;

export const Sprite2DBillboard: React.FC<Sprite2DBillboardProps> = ({
  spriteUrl,
  heightUnits,
  // shadowLightDir ignorado — disco horizontal não precisa de orientação
  groundY = -1.12,
  spritePosition,
  animTrigger,
  attackStyle = 'melee',
  disintegrateTrigger,
  interactive = false,
  flipX = false,
}) => {
  const texture = useTexture(spriteUrl);
  const meshRef   = useRef<THREE.Mesh>(null); // billboard visual (segue câmera)
  const groupRef  = useRef<THREE.Group>(null); // wrapper animado
  // { type, startTime } — startTime=-1 significa «iniciar no próximo frame»
  const animRef   = useRef<{ type: string; startTime: number; holding?: boolean; holdX?: number; holdY?: number; holdZ?: number } | null>(null);
  const mountedRef = useRef(false); // evita animação na montagem inicial
  const spritePositionRef = useRef(spritePosition); // leitura síncrona da posição atual
  spritePositionRef.current = spritePosition;
  const materialRef      = useRef<THREE.MeshStandardMaterial>(null);
  const materialDirtyRef = useRef(false); // true quando disintegrate modificou o material

  const { width, height } = useMemo(() => {
    if (texture.image && texture.image.width && texture.image.height) {
      const aspect = texture.image.width / texture.image.height;
      return { width: heightUnits * aspect, height: heightUnits };
    }
    return { width: heightUnits, height: heightUnits };
  }, [texture, heightUnits]);

  // Lê os pixels reais do PNG uma única vez:
  // normalMap      = relevo calculado da luminância pixel a pixel
  // bottomTrimFraction = fração de linhas transparentes na base → faz pixel visível tocar o chão
  // alphaData      = canal alfa bruto do PNG para raycast pixel-preciso
  const { normalMap, bottomTrimFraction, alphaData } = useMemo(
    () => analyzeSpritePixels(texture, 4.0),
    [texture],
  );
  // Ref estável: permite que alphaRaycast leia o dado mais recente sem recriar o callback
  const alphaDataRef = useRef(alphaData);
  alphaDataRef.current = alphaData;

  // bottomTrim * height = altura (em unidades 3D) das linhas transparentes na base do PNG
  // Descer o plane por esse valor faz o pixel visível mais baixo coincidir com o chão (groundY)
  const spriteCenterY = height / 2 + groundY - bottomTrimFraction * height;

  // Dispara animação ao mudar de posição ou ao clicar no mesmo botão novamente
  useEffect(() => {
    if (animTrigger === undefined || !spritePosition) return;
    if (spritePosition === 'attack' || spritePosition === 'damage' || spritePosition === 'dead') {
      animRef.current = { type: spritePosition, startTime: -1 };
    } else if (spritePosition === 'defense') {
      // Defesa absorve o impacto com a mesma vibração de dano
      animRef.current = { type: 'damage', startTime: -1 };
    } else {
      animRef.current = null;
    }
  }, [animTrigger, spritePosition]);

  // Transição suave sempre que o sprite mudar (exceto na montagem inicial)
  // Pula se for uma animação de ação — o efeito acima já definiu o tipo correto
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const pos = spritePositionRef.current;
    if (pos === 'attack' || pos === 'damage' || pos === 'dead' || pos === 'defense') return;
    animRef.current = { type: 'transition', startTime: -1 };
  }, [spriteUrl]);

  // Dispara desintegração ao incrementar o trigger (independente do spritePosition)
  useEffect(() => {
    if (!disintegrateTrigger) return;
    animRef.current = { type: 'disintegrate', startTime: -1 };
  }, [disintegrateTrigger]);

  // ── Raycast pixel-preciso ────────────────────────────────────────────────
  // Chama o raycast padrão do Mesh para obter o UV do ponto de acerto,
  // depois rejeita hits cujo pixel PNG tem alfa < 10 (área transparente).
  // Isso garante que hover/clique só reconhece pixels visíveis do sprite,
  // igual ao comportamento natural de um modelo 3D com geometria real.
  const alphaRaycast = useCallback(
    (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const prev = intersects.length;
      // Raycast padrão do Three.js (não recursivo — não chama alphaRaycast)
      THREE.Mesh.prototype.raycast.call(mesh, raycaster, intersects);
      const ad = alphaDataRef.current;
      if (!ad) return; // sem dados → mantém todos os hits
      // Filtra os novos hits com base no alfa do pixel PNG no UV do acerto
      for (let i = intersects.length - 1; i >= prev; i--) {
        const uv = intersects[i].uv;
        if (!uv) continue;
        // UV (0,0) = canto inferior esquerdo; pixel (0,0) = canto superior esquerdo → inverter Y
        const pixX = Math.min(Math.floor(uv.x * ad.width),          ad.width  - 1);
        const pixY = Math.min(Math.floor((1 - uv.y) * ad.height),   ad.height - 1);
        if (ad.data[(pixY * ad.width + pixX) * 4 + 3] < 10) intersects.splice(i, 1);
      }
    },
    [], // estável — usa refs internamente, não precisa de dependências
  );

  // ── Billboard + Animações ─────────────────────────────────────────────────
  // O sprite visual (meshRef) deve sempre encarar a câmera em espaço de mundo.
  // Fórmula correta quando o grupo pai tem rotação:
  //   mesh.worldQuat = parent.worldQuat × mesh.localQuat
  //   → mesh.localQuat = inv(parent.worldQuat) × camera.worldQuat
  // Usar apenas `mesh.quaternion.copy(camera.quaternion)` funciona só se o pai
  // não tiver rotação; com rotationY no pai (ex: ClassSelectionScreen, Scene3D)
  // o sprite ficaria torto. A compensação abaixo corrige isso sem custo de GC
  // (quaternion reutilizado via ref).
  const _parentInvQuat = useRef(new THREE.Quaternion());

  useFrame(({ camera, clock }) => {
    if (meshRef.current) {
      const mesh = meshRef.current;
      if (mesh.parent) {
        mesh.parent.getWorldQuaternion(_parentInvQuat.current);
        _parentInvQuat.current.invert();
        mesh.quaternion.multiplyQuaternions(_parentInvQuat.current, camera.quaternion);
      } else {
        mesh.quaternion.copy(camera.quaternion);
      }
    }
    // ── Animações de posição ──────────────────────────────────────────────────
    if (!groupRef.current) return;
    const anim = animRef.current;
    if (!anim) {
      // Reseta material caso disintegrate tenha terminado
      if (materialDirtyRef.current && materialRef.current) {
        materialRef.current.opacity = 1;
        materialRef.current.emissive.setRGB(0, 0, 0);
        materialRef.current.emissiveIntensity = 1;
        materialDirtyRef.current = false;
      }
      groupRef.current.position.set(0, 0, 0);
      return;
    }
    // Outra animação começou enquanto material estava sujo — restaura antes de prosseguir
    if (anim.type !== 'disintegrate' && materialDirtyRef.current && materialRef.current) {
      materialRef.current.opacity = 1;
      materialRef.current.emissive.setRGB(0, 0, 0);
      materialRef.current.emissiveIntensity = 1;
      materialDirtyRef.current = false;
    }
    if (anim.startTime < 0) anim.startTime = clock.getElapsedTime();
    const t = clock.getElapsedTime() - anim.startTime;
    let dx = 0, dy = 0, dz = 0;
    if (anim.type === 'attack') {
      if (attackStyle === 'ranged') {
        // Ranged: avanço leve (-X) → impulso forte para trás (+X, recuo do lançamento) → retorna
        const t1 = 0.08, t2 = 0.18, dur = 0.38;
        if (t < t1) {
          dx = -0.08 * (t / t1);                                // avanço leve (-X)
        } else if (t < t2) {
          const p = (t - t1) / (t2 - t1);
          dx = -0.08 * (1 - p) + 0.28 * p;                     // impulso para trás (+X)
        } else if (t < dur) {
          const p = (t - t2) / (dur - t2);
          dx = 0.28 * (1 - p * p);                              // retorna suave
        } else { animRef.current = null; }
      } else {
        // Melee: windup em +X (para trás) → lunge em -X (ataque para frente) → retorna
        const t1 = 0.12, t2 = 0.25, dur = 0.42;
        if (t < t1) {
          dx = 0.22 * (t / t1);                                 // recua (+X)
        } else if (t < t2) {
          const p = (t - t1) / (t2 - t1);
          dx = 0.22 * (1 - p) - 0.32 * p;                      // dispara (-X)
        } else if (t < dur) {
          const p = (t - t2) / (dur - t2);
          dx = -0.32 * (1 - p * p);                             // retorna suave
        } else { animRef.current = null; }
      }
    } else if (anim.type === 'damage') {
      // Vibração lateral de alta frequência com decaimento
      const dur = 0.45;
      if (t < dur) { dx = 0.08 * Math.sin(t * 36) * (1 - t / dur); }
      else { animRef.current = null; }
    } else if (anim.type === 'dead') {
      // Fica no mesmo lugar (sem XZ), treme no Y e volta à posição original
      const dur = 0.75;
      if (t < dur) {
        dy = 0.04 * Math.sin(t * 10) * (1 - t / dur); // tremor suave no Y
      } else {
        animRef.current = null; // retorna à posição sem hold
      }
    } else if (anim.type === 'transition') {
      // Leve balanço no X ao trocar de sprite — indica transição visual sem parecer salto
      const dur = 0.28;
      if (t < dur) {
        dx = 0.055 * Math.sin((t / dur) * Math.PI);
      } else {
        animRef.current = null;
      }
    } else if (anim.type === 'disintegrate') {
      // Flash branco → desintegração: opacidade a zero + sobe levemente
      const mat = materialRef.current;
      if (!mat) { animRef.current = null; }
      else {
        materialDirtyRef.current = true;
        const phase1 = 0.22;  // duração do flash branco
        const totalDur = 1.05;
        if (t < phase1) {
          const p = t / phase1;
          mat.emissive.setRGB(1, 1, 1);
          mat.emissiveIntensity = p * 3.2;
          mat.opacity = 1;
        } else if (t < totalDur) {
          const p = (t - phase1) / (totalDur - phase1);
          mat.emissive.setRGB(1, 1, 1);
          mat.emissiveIntensity = 3.2 * (1 - p * 0.6);
          mat.opacity = Math.max(0, 1 - p);
          dy = 0.1 * p; // sobe levemente enquanto desaparece
        } else {
          mat.opacity = 0;
          animRef.current = null; // mantém invisível até próxima ação resetar
        }
      }
    } else {
      animRef.current = null;
    }
    groupRef.current.position.x = dx;
    groupRef.current.position.y = dy;
    groupRef.current.position.z = dz;
  });

  return (
    <group ref={groupRef}>
      {/* Sprite visual: billboard que acompanha a câmera (quaternion copia câmera a cada frame). */}
      {/* interactive=true → alphaRaycast: só pixels visíveis (alfa ≥ 10) registram hover/clique. */}
      <mesh ref={meshRef} position={[0, spriteCenterY, 0]} scale={[flipX ? -1 : 1, 1, 1]} raycast={interactive ? alphaRaycast : () => null}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          ref={materialRef}
          map={texture}
          normalMap={normalMap ?? undefined}
          normalScale={new THREE.Vector2(0.45, 0.45)}
          transparent
          alphaTest={0.1}
          side={THREE.FrontSide}
          roughness={0.88}
          metalness={0.0}
          toneMapped={false}
        />
      </mesh>

      {/*
        Shadow disc: disco horizontal plano no chão.
        ContactShadows olha de cima e vê o disco de frente (área plena) → sombra forte.
        opacity=0 → invisível na cena; castShadow → capturado pelo ContactShadows.
      */}
      <mesh position={[0, groundY + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow raycast={() => null}>
        <circleGeometry args={[width * 0.42, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ── Fallback enquanto a textura carrega ───────────────────────────────────────

const SpritePlaceholder: React.FC<{ heightUnits: number }> = ({ heightUnits }) => (
  <mesh position={[0, heightUnits / 2 - 1.12, 0]}>
    <planeGeometry args={[heightUnits * 0.6, heightUnits]} />
    <meshBasicMaterial color="#1e293b" transparent opacity={0.4} side={THREE.DoubleSide} />
  </mesh>
);
// ── Luz dinâmica orbital ────────────────────────────────────────────────────

const DynamicOrbitalLight: React.FC = () => {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // Z sempre negativo → luz permanece na frente do sprite (câmera em -Z), iluminando a face visível
    ref.current.position.set(
      Math.sin(t * 0.65) * 3.0,
      2.2 + Math.sin(t * 0.38) * 0.8,
      -(1.8 + Math.abs(Math.cos(t * 0.55)) * 2.0),
    );
    ref.current.intensity = 1.1 + Math.sin(t * 1.1) * 0.25;
  });
  return <pointLight ref={ref} color="#a78bfa" distance={12} />;
};

// ── Anel de luz de borda (rim light fixo) ─────────────────────────────────

const RimLight: React.FC = () => {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.intensity = 0.6 + Math.sin(t * 0.9 + Math.PI) * 0.25;
  });
  return <pointLight ref={ref} position={[0, 1.0, 2.5]} color="#38bdf8" distance={8} />;
};
// ── Exported scene component ──────────────────────────────────────────────────

export interface DeveloperEnemy2DSceneProps {
  spriteUrl: string;
  scale?: number; // altura em unidades Three.js (default 2.0)
  spritePosition?: string;
  animTrigger?: number;
  attackStyle?: 'melee' | 'ranged';
  disintegrateTrigger?: number;
}

export const DeveloperEnemy2DScene: React.FC<DeveloperEnemy2DSceneProps> = ({
  spriteUrl,
  scale = 2.0,
  spritePosition,
  animTrigger,
  attackStyle,
  disintegrateTrigger,
}) => {
  const quality      = useMemo(() => getRenderQualityProfile(), []);
  const powerPref    = useMemo(() => getRenderPowerPreference(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.14),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: powerPref }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 10, 26]} />

        <PerspectiveCamera
          makeDefault
          position={[0, 1.55, -8.4]}
          fov={36}
          onUpdate={(cam) => cam.lookAt(0, 0.2, 0)}
        />

        {/* Iluminação — ambient suavizado para não lavar o sprite */}
        <ambientLight intensity={0.52} color="#f8fafc" />
        <hemisphereLight intensity={0.74} color="#e2e8f0" groundColor="#0f172a" />

        {/* Luz diagonal: ilumina o sprite E projeta sombra diagonal no chão.
            Posição [-3, 6, -5] (mesmo lado -Z que a câmera) → sombra cai em
            direção ao +Z (para o fundo da cena, atrás do sprite na visão da câmera),
            dando profundidade e indicando a direção da luz. */}
        <directionalLight
          position={[-3, 6, -5]}
          intensity={0.78}
          color="#f8fafc"
          castShadow
          shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        />
        <pointLight position={[3, 2.4, -2.2]}   intensity={1.05} color="#67e8f9" distance={12} />
        <pointLight position={[-2.4, 2.1, -1.4]} intensity={0.9}  color="#fb923c" distance={10} />
        <DynamicOrbitalLight />
        <RimLight />

        {/* Plataforma de chão */}
        <group position={[0, -1.12, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[3.8, 48]} />
            <meshStandardMaterial color="#334155" roughness={0.82} metalness={0.08} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.5, 3.2, 48]} />
            <meshStandardMaterial
              color="#67e8f9"
              emissive="#22d3ee"
              emissiveIntensity={0.36}
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* Sprite 2D */}
        <Suspense fallback={<SpritePlaceholder heightUnits={scale} />}>
          <Sprite2DBillboard
            spriteUrl={spriteUrl}
            heightUnits={scale}
            spritePosition={spritePosition}
            animTrigger={animTrigger}
            attackStyle={attackStyle}
            disintegrateTrigger={disintegrateTrigger}
          />
        </Suspense>

        {/* Controles de câmera */}
        <OrbitControls
          makeDefault
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0.2, 0]}
          enablePan={false}
        />
      </Canvas>
    </div>
  );
};
