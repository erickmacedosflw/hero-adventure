import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ENEMY_DATA } from '../constants';
import { getPlayerClassById, PLAYER_CLASSES } from '../game/data/classes';
import { resolveTrackPlaybackSnapshot } from '../game/mechanics/spriteOverlayPlayback';
import type {
  PlayerClassId,
  SpriteFrameRect,
  SpriteMotionPreset,
  SpriteOverlayAnimationDefinition,
  SpritePlaybackMode,
  SpriteTailLoopPattern,
  SpriteTrackAnchorPoint,
  SpriteTrackAnchorTarget,
  SpriteTrackDefinition,
} from '../types';
import { hasRuntimeFbxAssets } from './scene3d/animation';
import { AnimatedClassHero, EnemyCharacter } from './scene3d/characters';

const FPS = 60;
const mkId = () => `track_${Math.random().toString(36).slice(2, 9)}`;
const SPRITE_PROJECT_DIR = 'game/sprites';

const gridFrames = (rows: number, cols: number, w: number, h: number, invertRows: boolean): SpriteFrameRect[] => {
  if (rows <= 0 || cols <= 0 || w <= 0 || h <= 0) return [];
  const fw = w / cols;
  const fh = h / rows;
  const out: SpriteFrameRect[] = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const sourceRow = invertRows ? (rows - 1 - r) : r;
      out.push({ x: c * fw, y: sourceRow * fh, width: fw, height: fh });
    }
  }

  return out;
};

const frameRectFromIndex = (
  index: number,
  rows: number,
  cols: number,
  sheet: { width: number; height: number },
  invertRows: boolean,
): SpriteFrameRect | null => {
  if (index < 0 || rows <= 0 || cols <= 0 || sheet.width <= 0 || sheet.height <= 0) {
    return null;
  }

  const frameWidth = sheet.width / cols;
  const frameHeight = sheet.height / rows;
  const row = Math.floor(index / cols);
  const col = index % cols;
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    return null;
  }

  const sourceRow = invertRows ? (rows - 1 - row) : row;
  return {
    x: col * frameWidth,
    y: sourceRow * frameHeight,
    width: frameWidth,
    height: frameHeight,
  };
};

const buildLuminanceTexture = (sourceTexture: THREE.Texture): THREE.Texture => {
  const sourceImage = sourceTexture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | null
    | undefined;
  if (!sourceImage || typeof document === 'undefined') {
    return sourceTexture.clone();
  }

  const width = (sourceImage as HTMLImageElement).naturalWidth
    || (sourceImage as HTMLCanvasElement).width
    || (sourceImage as ImageBitmap).width
    || 0;
  const height = (sourceImage as HTMLImageElement).naturalHeight
    || (sourceImage as HTMLCanvasElement).height
    || (sourceImage as ImageBitmap).height
    || 0;
  if (width <= 0 || height <= 0) {
    return sourceTexture.clone();
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceTexture.clone();
  }

  context.drawImage(sourceImage as CanvasImageSource, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const luminance = Math.round((0.2126 * r) + (0.7152 * g) + (0.0722 * b));
    pixels[index] = luminance;
    pixels[index + 1] = luminance;
    pixels[index + 2] = luminance;
  }
  context.putImageData(imageData, 0, 0);

  const grayscaleTexture = new THREE.CanvasTexture(canvas);
  grayscaleTexture.colorSpace = sourceTexture.colorSpace;
  grayscaleTexture.needsUpdate = true;
  return grayscaleTexture;
};

const shouldUseLuminanceTint = (tintColor?: string) => (
  (tintColor ?? '#ffffff').toLowerCase() !== '#ffffff'
);

const mkTrack = (name: string, count: number): SpriteTrackDefinition => ({
  id: mkId(),
  name,
  enabled: true,
  spriteRows: 4,
  spriteCols: 4,
  invertRows: false,
  preserveFrameAspect: true,
  useOriginalFrameSize: false,
  originalSizeScale: 0.01,
  startEmptyFrame: true,
  endEmptyFrame: true,
  rotationDeg: 0,
  playbackMode: 'one-shot',
  stopOnLastFrame: true,
  tailLoopEnabled: false,
  tailLoopFrameCount: 4,
  tailLoopRepeats: 0,
  tailLoopPattern: 'forward',
  timelineStartFrame: 0,
  timelineEndFrame: undefined,
  fps: 12,
  frameIndices: Array.from({ length: Math.max(1, count) }, (_, i) => i),
  anchorTarget: 'hero',
  anchorPoint: 'chest',
  // Default a little behind the model on Z so effects start "atras" by default.
  offset3d: [0, 0, -0.35],
  size: [1.2, 1.2],
  renderPriority: 0,
  depthTest: true,
  depthWrite: false,
  motionPreset: 'none',
  motionAmplitude: 0.55,
  motionSpeed: 1,
  blendMode: 'normal',
  opacity: 1,
  tintColor: '#ffffff',
});

const basePos = (_target: SpriteTrackAnchorTarget, point?: SpriteTrackAnchorPoint): [number, number, number] => {
  // Single-model preview: anchor all tracks around the same centered reference model.
  const root: [number, number, number] = [0, 0.1, 0];
  const y = point === 'head' ? 0.95 : point === 'chest' ? 0.45 : point === 'feet' ? -0.8 : 0;
  return [root[0], root[1] + y, root[2]];
};

const motion = (preset: SpriteMotionPreset | undefined, t: number, amp: number, speed: number): [number, number, number] => {
  const k = t * Math.max(0.01, speed);
  if (preset === 'rise') return [0, Math.sin(k * 2.2) * amp, 0];
  if (preset === 'orbit') return [Math.cos(k * 2) * amp, 0, Math.sin(k * 2) * amp];
  if (preset === 'forward') return [0, 0, -Math.sin(k * 1.6) * amp];
  if (preset === 'follow-target') return [Math.sin(k) * amp * 0.2, Math.cos(k * 2) * amp * 0.2, 0];
  if (preset === 'zigzag') return [Math.sin(k * 5) * amp, Math.sin(k * 2.5) * amp * 0.2, 0];
  return [0, 0, 0];
};

const scaleTrackVisualSize = (track: SpriteTrackDefinition, zoom: number): SpriteTrackDefinition => {
  if (track.useOriginalFrameSize) {
    return {
      ...track,
      originalSizeScale: Math.max(0.001, (track.originalSizeScale ?? 0.01) * zoom),
    };
  }
  return {
    ...track,
    size: [
      Math.max(0.1, track.size[0] * zoom),
      Math.max(0.1, track.size[1] * zoom),
    ],
  };
};

const clampTrackFrameIndices = (track: SpriteTrackDefinition, rowsFallback: number, colsFallback: number): number[] => {
  const rows = Math.max(1, track.spriteRows ?? rowsFallback);
  const cols = Math.max(1, track.spriteCols ?? colsFallback);
  const maxIndex = Math.max(0, (rows * cols) - 1);
  const next = (track.frameIndices ?? [])
    .filter((idx) => Number.isInteger(idx))
    .map((idx) => Math.max(0, Math.min(maxIndex, idx)));
  return next.length ? next : [0];
};

const SpriteSheetEditor: React.FC<{
  sheetUrl: string;
  sheetSize: { width: number; height: number };
  rows: number;
  cols: number;
  invertRows: boolean;
  frameCount: number;
  compact?: boolean;
  selectedTrack?: SpriteTrackDefinition;
  onFrameRangeChange: (start: number, end: number) => void;
}> = ({ sheetUrl, sheetSize, rows, cols, invertRows, frameCount, compact = false, selectedTrack, onFrameRangeChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  const getCellIndex = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const cellW = rect.width / Math.max(1, cols);
    const cellH = rect.height / Math.max(1, rows);
    const col = Math.max(0, Math.min(cols - 1, Math.floor(x / cellW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(y / cellH)));
    return row * cols + col;
  };

  useEffect(() => {
    imageRef.current = null;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageVersion((v) => v + 1);
    };
    img.src = sheetUrl;
  }, [sheetUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    if (invertRows) {
      // Keep frame-selection coordinates stable; invert only the drawn image.
      ctx.save();
      ctx.translate(0, height);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, width, height);
    }

    const cellW = width / Math.max(1, cols);
    const cellH = height / Math.max(1, rows);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c += 1) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, height);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r += 1) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(width, r * cellH);
      ctx.stroke();
    }

    if (selectedTrack?.frameIndices?.length) {
      const start = selectedTrack.frameIndices[0];
      const end = selectedTrack.frameIndices[selectedTrack.frameIndices.length - 1];
      const min = Math.max(0, Math.min(start, end));
      const max = Math.min(frameCount - 1, Math.max(start, end));
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      for (let idx = min; idx <= max; idx += 1) {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      }
    }
  }, [cols, frameCount, imageVersion, invertRows, rows, selectedTrack?.frameIndices, sheetUrl]);

  const aspect = sheetSize.width > 0 && sheetSize.height > 0 ? sheetSize.width / sheetSize.height : 1.5;
  const canvasWidth = compact ? 340 : 700;
  const canvasHeight = Math.max(180, Math.round(canvasWidth / Math.max(0.4, aspect)));

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="w-full rounded-xl border border-slate-800 bg-slate-950"
      onMouseDown={(event) => {
        const idx = getCellIndex(event);
        if (idx == null) return;
        setDragStart(idx);
        onFrameRangeChange(idx, idx);
      }}
      onMouseMove={(event) => {
        if (dragStart == null) return;
        const idx = getCellIndex(event);
        if (idx == null) return;
        onFrameRangeChange(dragStart, idx);
      }}
      onMouseUp={() => setDragStart(null)}
      onMouseLeave={() => setDragStart(null)}
    />
  );
};

const TrackSprite: React.FC<{
  tex: THREE.Texture;
  rect: SpriteFrameRect;
  sheet: { width: number; height: number };
  pos: [number, number, number];
  size: [number, number];
  opacity: number;
  depthTest: boolean;
  depthWrite: boolean;
  renderOrder: number;
  blend: 'normal' | 'additive';
  tintColor: string;
  interactive: boolean;
  onTransform: (nextOffset: [number, number, number], nextSize: [number, number]) => void;
  onRotate: (nextRotationDeg: number) => void;
  currentOffset: [number, number, number];
  flipVertical: boolean;
  rotationDeg?: number;
}> = ({ tex, rect, sheet, pos, size, opacity, depthTest, depthWrite, renderOrder, blend, tintColor, interactive, onTransform, onRotate, currentOffset, flipVertical, rotationDeg = 0 }) => {
  const local = useMemo(() => {
    const t = tex.clone();
    t.flipY = false;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }, [tex]);
  const dragRef = useRef<{ x: number; y: number; offset: [number, number, number]; rotationDeg: number } | null>(null);
  const materialRef = useRef<THREE.SpriteMaterial | null>(null);

  useEffect(() => () => local.dispose(), [local]);
  useEffect(() => {
    const insetX = 0;
    const insetY = 0;
    local.repeat.set((rect.width - insetX * 2) / sheet.width, (rect.height - insetY * 2) / sheet.height);
    local.offset.set((rect.x + insetX) / sheet.width, 1 - ((rect.y + rect.height - insetY) / sheet.height));
    local.needsUpdate = true;
  }, [local, rect.height, rect.width, rect.x, rect.y, sheet.height, sheet.width]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.color.set(tintColor || '#ffffff');
    materialRef.current.needsUpdate = true;
  }, [tintColor]);

  return (
    <sprite
      position={pos}
      scale={[size[0], flipVertical ? -size[1] : size[1], 1]}
      renderOrder={renderOrder}
      onPointerDown={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        if (typeof event.nativeEvent?.preventDefault === 'function') {
          event.nativeEvent.preventDefault();
        }
        dragRef.current = {
          x: event.clientX,
          y: event.clientY,
          offset: [...currentOffset] as [number, number, number],
          rotationDeg,
        };
      }}
      onPointerMove={(event) => {
        if (!interactive || !dragRef.current) return;
        event.stopPropagation();
        const nativeButtons = typeof event.nativeEvent?.buttons === 'number' ? event.nativeEvent.buttons : 0;
        const usingRightButton = (nativeButtons & 2) === 2;
        const dx = (event.clientX - dragRef.current.x) * 0.01;
        const dy = (event.clientY - dragRef.current.y) * 0.01;
        if (event.ctrlKey || event.altKey || usingRightButton) {
          const nextRotation = dragRef.current.rotationDeg + ((event.clientX - dragRef.current.x) * 0.6);
          onRotate(nextRotation);
          return;
        }
        const next = [...dragRef.current.offset] as [number, number, number];
        if (event.shiftKey) {
          next[2] = dragRef.current.offset[2] + dy;
        } else {
          next[0] = dragRef.current.offset[0] + dx;
          next[1] = dragRef.current.offset[1] - dy;
        }
        onTransform(next, size);
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerLeave={() => { dragRef.current = null; }}
      onWheel={(event) => {
        if (!interactive) return;
        // Let the preview container handle wheel scaling consistently for all size modes.
        if (!event.shiftKey) return;
      }}
    >
      <spriteMaterial
        ref={materialRef}
        map={local}
        color={tintColor}
        rotation={THREE.MathUtils.degToRad(rotationDeg)}
        transparent
        opacity={opacity}
        depthTest={depthTest}
        depthWrite={depthWrite}
        blending={blend === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </sprite>
  );
};

const Stage: React.FC<{
  sheetUrl: string;
  defaultSheet: { width: number; height: number };
  tracks: SpriteTrackDefinition[];
  elapsedMs: number;
  isPlaying: boolean;
  forceLoop: boolean;
  defaultRows: number;
  defaultCols: number;
  defaultInvertRows: boolean;
  heroClassId: PlayerClassId;
  enemyIndex: number;
  previewReference: 'hero' | 'enemy';
  selectedTrackId?: string;
  flipVertical: boolean;
  lockCameraOrbit: boolean;
  defaultPreserveFrameAspect: boolean;
  onTrackTransform: (trackId: string, offset: [number, number, number], size: [number, number]) => void;
  onTrackRotate: (trackId: string, rotationDeg: number) => void;
}> = ({ sheetUrl, defaultSheet, tracks, elapsedMs, isPlaying, forceLoop, defaultRows, defaultCols, defaultInvertRows, heroClassId, enemyIndex, previewReference, selectedTrackId, flipVertical, lockCameraOrbit, defaultPreserveFrameAspect, onTrackTransform, onTrackRotate }) => {
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
  const textureCacheRef = useRef<Record<string, THREE.Texture>>({});
  const luminanceTextureCacheRef = useRef<Record<string, THREE.Texture>>({});
  const [, setTextureVersion] = useState(0);
  if (!textureLoaderRef.current) {
    textureLoaderRef.current = new THREE.TextureLoader();
  }

  const textureUrls = useMemo(
    () => [...new Set(tracks.map((track) => track.spriteSheetUrl || sheetUrl).filter(Boolean) as string[])].sort(),
    [sheetUrl, tracks],
  );
  const textureUrlsKey = textureUrls.join('|');

  useEffect(() => {
    const loader = textureLoaderRef.current;
    if (!loader) return;
    const cache = textureCacheRef.current;
    let active = true;

    textureUrls.forEach((url) => {
      if (cache[url]) return;
      const texture = loader.load(url, () => {
        if (active) {
          setTextureVersion((v) => v + 1);
        }
      });
      texture.flipY = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      cache[url] = texture;
    });

    const activeUrls = new Set(textureUrls);
    Object.keys(cache).forEach((url) => {
      if (!activeUrls.has(url)) {
        cache[url].dispose();
        delete cache[url];
        const luminanceCache = luminanceTextureCacheRef.current;
        if (luminanceCache[url]) {
          luminanceCache[url].dispose();
          delete luminanceCache[url];
        }
      }
    });

    return () => {
      active = false;
    };
  }, [textureUrlsKey]);

  useEffect(() => () => {
    const cache = textureCacheRef.current;
    Object.values(cache).forEach((texture) => texture.dispose());
    textureCacheRef.current = {};
    const luminanceCache = luminanceTextureCacheRef.current;
    Object.values(luminanceCache).forEach((texture) => texture.dispose());
    luminanceTextureCacheRef.current = {};
  }, []);

  const heroAssets = getPlayerClassById(heroClassId).assets;
  const hero = hasRuntimeFbxAssets(heroAssets) ? heroAssets : null;
  const enemy = ENEMY_DATA[Math.max(0, Math.min(enemyIndex, ENEMY_DATA.length - 1))];
  const enemyAssets = hasRuntimeFbxAssets(enemy.assets) ? enemy.assets : undefined;

  return (
    <Canvas camera={{ position: [1, 1.8, 7.8], fov: 34 }} dpr={[1, 1.4]}>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={1.02} />
      <hemisphereLight intensity={0.72} color="#dbeafe" groundColor="#0f172a" />
      <directionalLight position={[4, 8, 5]} intensity={1.2} />
      <mesh position={[1, -1.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.4, 48]} />
        <meshStandardMaterial color="#0b1220" />
      </mesh>

      {previewReference === 'hero' && hero ? (
        <group position={[0, -1, 0]} rotation={[0, 0.35, 0]}>
          <AnimatedClassHero assets={hero} animationAction="battle-idle" hasWeapon={false} previewLoopAllActions />
        </group>
      ) : null}

      {previewReference === 'enemy' ? (
        <EnemyCharacter
          assets={enemyAssets}
          scale={enemy.scale ?? 1.05}
          attackStyle={enemy.attackStyle ?? 'unarmed'}
          animationActionOverride="battle-idle"
          originPosition={[0, -1, 0]}
          baseRotationY={-Math.PI - 0.35}
        />
      ) : null}

      {tracks.filter((t) => t.enabled).map((track) => {
        const snap = resolveTrackPlaybackSnapshot({ track, elapsedMs, isPlaying, forcePreviewLoop: forceLoop });
        // If preview is paused and timeline starts with empty frame, show first real frame for editing visibility.
        const frameIdx = snap.frameIndex < 0 && !isPlaying
          ? (track.frameIndices.find((idx) => idx >= 0) ?? -1)
          : snap.frameIndex;
        if (frameIdx < 0) return null;

        const trackRows = Math.max(1, track.spriteRows ?? defaultRows);
        const trackCols = Math.max(1, track.spriteCols ?? defaultCols);
        const trackInvertRows = track.invertRows ?? defaultInvertRows;
        const trackPreserveFrameAspect = track.preserveFrameAspect ?? defaultPreserveFrameAspect;
        const trackSheet = track.spriteSheetSize ?? defaultSheet;
        const rect = frameRectFromIndex(frameIdx, trackRows, trackCols, trackSheet, trackInvertRows);
        if (!rect) return null;
        const trackUrl = track.spriteSheetUrl || sheetUrl;
        const baseTexture = textureCacheRef.current[trackUrl];
        if (!baseTexture) return null;
        let texture = baseTexture;
        if (shouldUseLuminanceTint(track.tintColor)) {
          const luminanceCache = luminanceTextureCacheRef.current;
          if (!luminanceCache[trackUrl]) {
            const luminanceTexture = buildLuminanceTexture(baseTexture);
            luminanceTexture.flipY = false;
            luminanceTexture.wrapS = THREE.ClampToEdgeWrapping;
            luminanceTexture.wrapT = THREE.ClampToEdgeWrapping;
            luminanceTexture.minFilter = THREE.LinearMipmapLinearFilter;
            luminanceTexture.magFilter = THREE.LinearFilter;
            luminanceTexture.generateMipmaps = true;
            luminanceTexture.needsUpdate = true;
            luminanceCache[trackUrl] = luminanceTexture;
          }
          texture = luminanceCache[trackUrl];
        }

        const b = basePos(track.anchorTarget, track.anchorPoint);
        const m = motion(track.motionPreset, snap.elapsedWithinCycleMs / 1000, track.motionAmplitude ?? 0.5, track.motionSpeed ?? 1);
        const pos: [number, number, number] = [b[0] + track.offset3d[0] + m[0], b[1] + track.offset3d[1] + m[1], b[2] + track.offset3d[2] + m[2]];
        const aspect = rect.height > 0 ? rect.width / rect.height : 1;
        const baseSize: [number, number] = track.useOriginalFrameSize
          ? [
            Math.max(0.1, rect.width * (track.originalSizeScale ?? 0.01)),
            Math.max(0.1, rect.height * (track.originalSizeScale ?? 0.01)),
          ]
          : track.size;
        const size: [number, number] = trackPreserveFrameAspect
          ? [baseSize[1] * aspect, baseSize[1]]
          : baseSize;

        return (
          <TrackSprite
            key={track.id}
            tex={texture}
            rect={rect}
            sheet={trackSheet}
            pos={pos}
            size={size}
            opacity={Math.max(0, Math.min(1, track.opacity ?? 1))}
            depthTest={track.depthTest ?? true}
            depthWrite={track.depthWrite ?? false}
            renderOrder={track.renderPriority ?? 0}
            blend={track.blendMode ?? 'normal'}
            tintColor={track.tintColor ?? '#ffffff'}
            interactive={lockCameraOrbit && selectedTrackId === track.id}
            currentOffset={track.offset3d}
            flipVertical={flipVertical}
            rotationDeg={track.rotationDeg ?? 0}
            onTransform={(offset, size) => onTrackTransform(track.id, offset, size)}
            onRotate={(nextRotationDeg) => onTrackRotate(track.id, nextRotationDeg)}
          />
        );
      })}
      <OrbitControls
        enabled={!lockCameraOrbit}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
        target={[0, 0.2, 0]}
      />
    </Canvas>
  );
};

export const SpriteAnimationLab: React.FC = () => {
  const [animationName, setAnimationName] = useState('nova_animacao');
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('sprite-sheet.png');
  const [sheet, setSheet] = useState({ width: 1024, height: 1024 });
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [invertRows, setInvertRows] = useState(false);
  const [flipPreviewVertical, setFlipPreviewVertical] = useState(true);
  const [preserveFrameAspect, setPreserveFrameAspect] = useState(true);
  const [playMode, setPlayMode] = useState<'normal' | 'loop'>('normal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [heroClassId, setHeroClassId] = useState<PlayerClassId>(PLAYER_CLASSES[0]?.id ?? 'knight');
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [previewReference, setPreviewReference] = useState<'hero' | 'enemy'>('hero');
  const [lockCameraOrbit, setLockCameraOrbit] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const counterRef = useRef(1);
  const timerRef = useRef<number | null>(null);

  const frames = useMemo(() => gridFrames(rows, cols, sheet.width, sheet.height, invertRows), [rows, cols, sheet.width, sheet.height, invertRows]);
  const [tracks, setTracks] = useState<SpriteTrackDefinition[]>(() => [mkTrack('Track 1', 16)]);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!selectedId && tracks[0]) setSelectedId(tracks[0].id);
  }, [selectedId, tracks]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = window.setInterval(() => setElapsedMs((v) => v + (1000 / FPS)), 1000 / FPS);
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying]);

  const selected = useMemo(() => tracks.find((t) => t.id === selectedId) ?? tracks[0], [selectedId, tracks]);
  const selectedTrackRows = Math.max(1, selected?.spriteRows ?? rows);
  const selectedTrackCols = Math.max(1, selected?.spriteCols ?? cols);
  const selectedTrackInvertRows = selected?.invertRows ?? invertRows;
  const selectedTrackFrameCount = selectedTrackRows * selectedTrackCols;
  const selectedTrackSheetUrl = selected?.spriteSheetUrl ?? '';
  const selectedTrackSheetName = selected?.spriteSheetName ?? 'sprite-sheet.png';
  const selectedTrackSheetSize = selected?.spriteSheetSize ?? sheet;
  const selectedPreviewFrameIndex = selected?.frameIndices?.find((idx) => idx >= 0) ?? 0;
  const selectedPreviewRect = useMemo(
    () => frameRectFromIndex(
      selectedPreviewFrameIndex,
      selectedTrackRows,
      selectedTrackCols,
      selectedTrackSheetSize,
      selectedTrackInvertRows,
    ),
    [
      selectedPreviewFrameIndex,
      selectedTrackCols,
      selectedTrackInvertRows,
      selectedTrackRows,
      selectedTrackSheetSize,
    ],
  );
  const fallbackPreviewTrack = tracks.find((track) => Boolean(track.spriteSheetUrl));
  const primaryExportTrack = tracks.find((track) => Boolean(track.spriteSheetUrl)) ?? tracks[0];
  const primaryExportRows = Math.max(1, primaryExportTrack?.spriteRows ?? rows);
  const primaryExportCols = Math.max(1, primaryExportTrack?.spriteCols ?? cols);
  const primaryExportInvertRows = primaryExportTrack?.invertRows ?? invertRows;
  const primaryExportSheet = primaryExportTrack?.spriteSheetSize ?? sheet;
  const primaryExportFrames = useMemo(
    () => gridFrames(primaryExportRows, primaryExportCols, primaryExportSheet.width, primaryExportSheet.height, primaryExportInvertRows),
    [
      primaryExportCols,
      primaryExportInvertRows,
      primaryExportRows,
      primaryExportSheet.height,
      primaryExportSheet.width,
    ],
  );
  const previewSheetUrl = selected?.spriteSheetUrl || fallbackPreviewTrack?.spriteSheetUrl || sheetUrl;
  const previewSheetSize = selected?.spriteSheetSize || fallbackPreviewTrack?.spriteSheetSize || sheet;
  const statusByTrack = useMemo(() => (
    tracks.reduce<Record<string, string>>((acc, track) => {
      const snapshot = resolveTrackPlaybackSnapshot({
        track,
        elapsedMs,
        isPlaying,
        forcePreviewLoop: playMode === 'loop',
      });
      acc[track.id] = snapshot.playbackMode === 'loop' ? 'looping' : snapshot.status;
      return acc;
    }, {})
  ), [elapsedMs, isPlaying, playMode, tracks]);

  const updateTrack = (id: string, fn: (t: SpriteTrackDefinition) => SpriteTrackDefinition) => {
    setTracks((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  };

  const loadAnimationFromJson = (raw: string) => {
    let parsed: SpriteOverlayAnimationDefinition;
    try {
      parsed = JSON.parse(raw) as SpriteOverlayAnimationDefinition;
    } catch {
      setImportStatus('error');
      setImportMessage('JSON invalido.');
      return;
    }

    const nextName = parsed.name?.trim() || 'nova_animacao';
    const nextSheetSize = parsed.sheetSize ?? { width: 1024, height: 1024 };
    const nextRows = Math.max(1, parsed.frameSource?.rows ?? 1);
    const nextCols = Math.max(1, parsed.frameSource?.cols ?? 1);
    const nextTracksRaw = parsed.spriteTracks ?? [];
    const hasTracks = nextTracksRaw.length > 0;

    const normalizeTrack = (track: SpriteTrackDefinition, index: number): SpriteTrackDefinition => {
      const fallback = mkTrack(track.name?.trim() || `Track ${index + 1}`, nextRows * nextCols);
      const spriteRows = Math.max(1, track.spriteRows ?? nextRows);
      const spriteCols = Math.max(1, track.spriteCols ?? nextCols);
      const normalized: SpriteTrackDefinition = {
        ...fallback,
        ...track,
        id: track.id || mkId(),
        name: track.name?.trim() || `Track ${index + 1}`,
        spriteRows,
        spriteCols,
        spriteSheetSize: track.spriteSheetSize ?? nextSheetSize,
        // Import keeps metadata, but editor waits for per-track upload to render/trim frames.
        spriteSheetUrl: undefined,
        frameIndices: clampTrackFrameIndices({
          ...fallback,
          ...track,
          spriteRows,
          spriteCols,
        }, nextRows, nextCols),
      };
      return normalized;
    };

    const nextTracks = hasTracks
      ? nextTracksRaw.map((track, index) => normalizeTrack(track, index))
      : [mkTrack('Track 1', Math.max(1, nextRows * nextCols))];

    setAnimationName(nextName);
    setRows(nextRows);
    setCols(nextCols);
    setInvertRows(false);
    setSheet(nextSheetSize);
    setSheetName(parsed.spriteSheetName ?? 'sprite-sheet.png');
    setSheetUrl('');
    setHeroClassId(parsed.referencePreview?.heroClassId ?? (PLAYER_CLASSES[0]?.id ?? 'knight'));
    setEnemyIndex(parsed.referencePreview?.enemyIndex ?? 0);
    setPreviewReference(parsed.referencePreview?.previewReference ?? 'hero');
    setTracks(nextTracks);
    setSelectedId(nextTracks[0]?.id ?? '');
    counterRef.current = Math.max(1, nextTracks.length);
    setElapsedMs(0);
    setIsPlaying(false);
    setImportStatus('ok');
    setImportMessage('Animacao carregada. Agora envie as imagens por track para editar visualmente.');
  };

  const exportTracks = useMemo(
    () => tracks.map((track) => ({
      ...track,
      frameIndices: clampTrackFrameIndices(track, rows, cols),
      // Export canonical asset path. Keep URL only when it is not a transient blob URL.
      spriteSheetUrl: track.spriteSheetPath ?? (track.spriteSheetUrl?.startsWith('blob:') ? undefined : track.spriteSheetUrl),
    })),
    [cols, rows, tracks],
  );

  const payload: SpriteOverlayAnimationDefinition = useMemo(() => ({
    id: `sprite_anim_${Date.now()}`,
    version: 1,
    name: animationName.trim() || 'nova_animacao',
    spriteSheetName: primaryExportTrack?.spriteSheetName || selectedTrackSheetName,
    spriteSheetUrl: primaryExportTrack?.spriteSheetPath || primaryExportTrack?.spriteSheetUrl || selectedTrackSheetUrl || undefined,
    referencePreview: {
      previewReference,
      heroClassId,
      enemyIndex,
    },
    sheetSize: primaryExportSheet,
    frameSource: { rows: primaryExportRows, cols: primaryExportCols, frames: primaryExportFrames },
    spriteTracks: exportTracks,
  }), [
    animationName,
    primaryExportTrack,
    primaryExportRows,
    primaryExportCols,
    primaryExportSheet,
    primaryExportFrames,
    selectedTrackSheetName,
    selectedTrackSheetUrl,
    previewReference,
    heroClassId,
    enemyIndex,
    exportTracks,
  ]);

  const exportJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const setFrameRangeForSelectedTrack = (start: number, end: number) => {
    if (!selected) return;
    const min = Math.max(0, Math.min(start, end));
    const max = Math.min(selectedTrackFrameCount - 1, Math.max(start, end));
    const next = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    updateTrack(selected.id, (t) => ({ ...t, frameIndices: next.length ? next : [0] }));
  };

  const addTrack = () => {
    counterRef.current += 1;
    const t = {
      ...mkTrack(`Track ${counterRef.current}`, Math.max(1, rows * cols)),
      spriteRows: rows,
      spriteCols: cols,
      invertRows,
      preserveFrameAspect,
    };
    setTracks((all) => [...all, t]);
    setSelectedId(t.id);
  };

  const duplicateTrack = (trackId: string) => {
    setTracks((all) => {
      const source = all.find((track) => track.id === trackId);
      if (!source) return all;
      counterRef.current += 1;
      const duplicated: SpriteTrackDefinition = {
        ...source,
        id: mkId(),
        name: `${source.name} (copia ${counterRef.current})`,
        frameIndices: [...(source.frameIndices ?? [])],
        offset3d: [...(source.offset3d ?? [0, 0, 0])] as [number, number, number],
        size: [...(source.size ?? [1, 1])] as [number, number],
      };
      const next = [...all, duplicated];
      setSelectedId(duplicated.id);
      return next;
    });
  };

  const removeTrack = (trackId: string) => {
    setTracks((all) => {
      const next = all.filter((t) => t.id !== trackId);
      if (next.length === 0) {
        const fallback = mkTrack('Track 1', Math.max(1, frames.length));
        setSelectedId(fallback.id);
        return [fallback];
      }
      if (selectedId === trackId) {
        setSelectedId(next[0].id);
      }
      return next;
    });
  };

  const onUploadTrackSprite = (trackId: string): React.ChangeEventHandler<HTMLInputElement> => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      updateTrack(trackId, (track) => ({
        ...track,
        spriteSheetName: file.name,
        spriteSheetPath: `${SPRITE_PROJECT_DIR}/${file.name}`,
        spriteSheetUrl: url,
        spriteSheetSize: { width: img.width, height: img.height },
      }));
    };
    img.src = url;
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  const downloadJson = () => {
    const blob = new Blob([exportJson], { type: 'application/json;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    const exportName = (primaryExportTrack?.spriteSheetName || selectedTrackSheetName || sheetName || 'sprite-animation').replace(/\.[^.]+$/, '');
    const animNameForFile = (animationName.trim() || exportName || 'sprite-animation').replace(/[^\w.-]+/g, '_');
    a.download = `${animNameForFile}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
      <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5 xl:order-2">
        <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Preview 3D</span>
            <select value={previewReference} onChange={(e) => setPreviewReference(e.target.value as 'hero' | 'enemy')} className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100">
              <option value="hero">Heroi</option>
              <option value="enemy">Inimigo exemplo</option>
            </select>
            {previewReference === 'hero' ? (
              <select value={heroClassId} onChange={(e) => setHeroClassId(e.target.value as PlayerClassId)} className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100">
                {PLAYER_CLASSES.map((pc) => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
              </select>
            ) : (
              <select value={enemyIndex} onChange={(e) => setEnemyIndex(Number(e.target.value))} className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100">
                {ENEMY_DATA.map((en, i) => <option key={`${en.name}-${i}`} value={i}>{en.name}</option>)}
              </select>
            )}
            <button onClick={() => setPlayMode('normal')} className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100">Normal</button>
            <button onClick={() => setPlayMode('loop')} className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100">Loop</button>
            <button onClick={() => setIsPlaying(true)} className="h-8 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 text-xs text-cyan-100">Play</button>
            <button onClick={() => setIsPlaying(false)} className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100">Pause</button>
            <button onClick={() => { setElapsedMs(0); setIsPlaying(false); }} className="h-8 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2 text-xs text-amber-100">Restart</button>
            <label className="flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={lockCameraOrbit} onChange={(e) => setLockCameraOrbit(e.target.checked)} />
              travar giro 3D
            </label>
            <label className="flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={flipPreviewVertical} onChange={(e) => setFlipPreviewVertical(e.target.checked)} />
              inverter Y
            </label>
          </div>
        </div>
        <div
          className="h-[360px] sm:h-[420px] lg:h-[520px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60"
          onContextMenu={(event) => event.preventDefault()}
          onWheel={(event) => {
            if (!selected || !lockCameraOrbit) return;
            event.preventDefault();
            const fast = event.shiftKey;
            const zoomOut = fast ? 0.9 : 0.96;
            const zoomIn = fast ? 1.1 : 1.04;
            const zoom = event.deltaY > 0 ? zoomOut : zoomIn;
            updateTrack(selected.id, (track) => scaleTrackVisualSize(track, zoom));
          }}
        >
          <Stage
            sheetUrl={previewSheetUrl || ''}
            defaultSheet={previewSheetSize}
            tracks={tracks}
            elapsedMs={elapsedMs}
            isPlaying={isPlaying}
            forceLoop={playMode === 'loop'}
            defaultRows={rows}
            defaultCols={cols}
            defaultInvertRows={invertRows}
            heroClassId={heroClassId}
            enemyIndex={enemyIndex}
            previewReference={previewReference}
            selectedTrackId={selected?.id}
            flipVertical={flipPreviewVertical}
            lockCameraOrbit={lockCameraOrbit}
            defaultPreserveFrameAspect={preserveFrameAspect}
            onTrackTransform={(trackId, offset, size) => {
              updateTrack(trackId, (t) => ({ ...t, offset3d: offset, size }));
            }}
            onTrackRotate={(trackId, rotationDeg) => {
              updateTrack(trackId, (t) => ({ ...t, rotationDeg }));
            }}
          />
        </div>
      </div>

      <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6 xl:order-1 space-y-3">
        <h2 className="font-gamer text-2xl font-black text-white">Sprite Animation Lab</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Importar JSON</div>
          <textarea
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="cole aqui o JSON da animacao"
            className="h-28 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => loadAnimationFromJson(importJsonText)}
              className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
            >
              carregar JSON colado
            </button>
            <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center text-xs text-slate-100">
              abrir arquivo .json
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setImportJsonText(text);
                  loadAnimationFromJson(text);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
          {importStatus !== 'idle' ? (
            <div className={`text-[11px] ${importStatus === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>{importMessage}</div>
          ) : null}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Configuracao Geral</div>
        <input
          value={animationName}
          onChange={(e) => setAnimationName(e.target.value)}
          placeholder="nome geral da animacao"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2 max-h-40 overflow-auto">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Lista de Tracks</div>
          {tracks.map((t) => (
            <div key={t.id} className={`rounded-lg border px-2 py-1 ${selectedId === t.id ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-slate-700 bg-slate-950'}`}>
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setSelectedId(t.id)} className="min-w-0 flex-1 text-left text-xs text-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{t.name}</span>
                    <span className="uppercase tracking-[0.14em] text-slate-400">{statusByTrack[t.id] ?? 'idle'}</span>
                  </div>
                </button>
                <button
                  onClick={() => duplicateTrack(t.id)}
                  className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-100"
                >
                  duplicar
                </button>
                <button
                  onClick={() => removeTrack(t.id)}
                  className="rounded border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-rose-100"
                >
                  remover
                </button>
              </div>
            </div>
          ))}
          <button onClick={addTrack} className="w-full rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-1 text-xs text-fuchsia-100">Add track</button>
        </div>

        {selected ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Edicao da Track: {selected.name}</div>
            <input value={selected.name} onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, name: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />
            <input
              key={`track-file-${selected.id}`}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onClick={(event) => {
                // Allow selecting the same file again (important when creating a new track).
                event.currentTarget.value = '';
              }}
              onChange={onUploadTrackSprite(selected.id)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
            />
            <div className="text-[11px] text-slate-400">sprite da track: {selected.spriteSheetName ?? sheetName}</div>
            <div className="text-[11px] text-slate-500">path exportado: {selected.spriteSheetPath ?? `${SPRITE_PROJECT_DIR}/<arquivo>`}</div>
            {selectedTrackSheetUrl ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <SpriteSheetEditor
                  sheetUrl={selectedTrackSheetUrl}
                  sheetSize={selectedTrackSheetSize}
                  rows={selectedTrackRows}
                  cols={selectedTrackCols}
                  invertRows={selectedTrackInvertRows}
                  frameCount={selectedTrackFrameCount}
                  compact
                  selectedTrack={selected}
                  onFrameRangeChange={setFrameRangeForSelectedTrack}
                />
                <div className="mt-2 text-[11px] text-slate-400">Arraste na mini sheet para definir a faixa de frames da track.</div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">Envie uma imagem para esta track para editar os frames na mini sheet.</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={Math.max(1, selected.spriteRows ?? rows)}
                onChange={(e) => updateTrack(selected.id, (t) => {
                  const nextRows = Math.max(1, Number(e.target.value) || 1);
                  const nextTrack = { ...t, spriteRows: nextRows };
                  return { ...nextTrack, frameIndices: clampTrackFrameIndices(nextTrack, rows, cols) };
                })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <input
                type="number"
                min={1}
                value={Math.max(1, selected.spriteCols ?? cols)}
                onChange={(e) => updateTrack(selected.id, (t) => {
                  const nextCols = Math.max(1, Number(e.target.value) || 1);
                  const nextTrack = { ...t, spriteCols: nextCols };
                  return { ...nextTrack, frameIndices: clampTrackFrameIndices(nextTrack, rows, cols) };
                })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selected.invertRows ?? invertRows}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, invertRows: e.target.checked }))}
              />
              inverter leitura vertical da sheet (track)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selected.preserveFrameAspect ?? preserveFrameAspect}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, preserveFrameAspect: e.target.checked }))}
              />
              manter proporcao real do frame (track)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selected.useOriginalFrameSize ?? false}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, useOriginalFrameSize: e.target.checked }))}
              />
              usar tamanho original do frame da imagem
            </label>
            <input
              type="number"
              step="0.001"
              min={0.001}
              value={selected.originalSizeScale ?? 0.01}
              onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, originalSizeScale: Math.max(0.001, Number(e.target.value) || 0.01) }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={selected.playbackMode} onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, playbackMode: e.target.value as SpritePlaybackMode }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"><option value="one-shot">one-shot</option><option value="loop">loop</option></select>
              <input type="number" min={1} value={selected.fps} onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, fps: Math.max(1, Number(e.target.value) || 1) }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={selected.anchorTarget} onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, anchorTarget: e.target.value as SpriteTrackAnchorTarget }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100">
                <option value="hero">hero</option>
                <option value="enemy">enemy</option>
              </select>
              <select value={selected.anchorPoint ?? 'chest'} onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, anchorPoint: e.target.value as SpriteTrackAnchorPoint }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100">
                <option value="root">root</option>
                <option value="chest">chest</option>
                <option value="head">head</option>
                <option value="feet">feet</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={selected.motionPreset ?? 'none'} onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, motionPreset: e.target.value as SpriteMotionPreset }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100">
                <option value="none">none</option>
                <option value="rise">rise</option>
                <option value="orbit">orbit</option>
                <option value="forward">forward</option>
                <option value="follow-target">follow-target</option>
                <option value="zigzag">zigzag</option>
              </select>
              <input type="number" step="0.1" value={selected.renderPriority ?? 0} onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, renderPriority: Number(e.target.value) || 0 }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateTrack(selected.id, (t) => scaleTrackVisualSize(t, 0.9))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                escala -10%
              </button>
              <button
                onClick={() => updateTrack(selected.id, (t) => scaleTrackVisualSize(t, 1.1))}
                className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
              >
                escala +10%
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.05"
                min={0.1}
                value={selected.size[0]}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, size: [Math.max(0.1, Number(e.target.value) || 0.1), t.size[1]] }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <input
                type="number"
                step="0.05"
                min={0.1}
                value={selected.size[1]}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, size: [t.size[0], Math.max(0.1, Number(e.target.value) || 0.1)] }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
              <input
                type="color"
                value={selected.tintColor ?? '#ffffff'}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, tintColor: e.target.value }))}
                className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                title="cor do sprite (track)"
              />
              <button
                onClick={() => updateTrack(selected.id, (t) => ({ ...t, tintColor: '#ffffff' }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
              >
                cor do sprite (track): resetar para branco
              </button>
            </div>
            <input
              type="number"
              step="1"
              value={selected.rotationDeg ?? 0}
              onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, rotationDeg: Number(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            />
            {selectedTrackSheetUrl && selectedPreviewRect ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">preview rotacao</div>
                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-20 overflow-hidden rounded border border-slate-700 bg-slate-900">
                    <img
                      src={selectedTrackSheetUrl}
                      alt="preview frame"
                      className="absolute left-1/2 top-1/2 select-none pointer-events-none"
                      draggable={false}
                      style={{
                        width: `${selectedTrackSheetSize.width}px`,
                        height: `${selectedTrackSheetSize.height}px`,
                        maxWidth: 'none',
                        transform: `translate(${-selectedPreviewRect.x - (selectedPreviewRect.width / 2)}px, ${-selectedPreviewRect.y - (selectedPreviewRect.height / 2)}px) scale(${Math.max(0.0001, 80 / Math.max(selectedPreviewRect.width, selectedPreviewRect.height))}) rotate(${selected.rotationDeg ?? 0}deg)`,
                        transformOrigin: `${selectedPreviewRect.x + (selectedPreviewRect.width / 2)}px ${selectedPreviewRect.y + (selectedPreviewRect.height / 2)}px`,
                        imageRendering: 'pixelated',
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">frame {selectedPreviewFrameIndex} com giro aplicado</div>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => updateTrack(selected.id, (t) => ({ ...t, rotationDeg: 0 }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                0°
              </button>
              <button
                onClick={() => updateTrack(selected.id, (t) => ({ ...t, rotationDeg: 90 }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                90°
              </button>
              <button
                onClick={() => updateTrack(selected.id, (t) => ({ ...t, rotationDeg: 180 }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                180°
              </button>
              <button
                onClick={() => updateTrack(selected.id, (t) => ({ ...t, rotationDeg: 270 }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                270°
              </button>
              <button
                onClick={() => updateTrack(selected.id, (t) => ({ ...t, rotationDeg: (t.rotationDeg ?? 0) - 90 }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                -90°
              </button>
              <button
                onClick={() => updateTrack(selected.id, (t) => ({ ...t, rotationDeg: (t.rotationDeg ?? 0) + 90 }))}
                className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
              >
                +90°
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selected.stopOnLastFrame !== false}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, stopOnLastFrame: e.target.checked }))}
              />
              stopOnLastFrame
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selected.tailLoopEnabled ?? false}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, tailLoopEnabled: e.target.checked }))}
              />
              loop nos ultimos frames antes de terminar
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={Math.max(1, selected.tailLoopFrameCount ?? 4)}
                onChange={(e) => updateTrack(selected.id, (t) => ({
                  ...t,
                  tailLoopFrameCount: Math.max(1, Number(e.target.value) || 1),
                }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <input
                type="number"
                min={0}
                value={Math.max(0, selected.tailLoopRepeats ?? 0)}
                onChange={(e) => updateTrack(selected.id, (t) => ({
                  ...t,
                  tailLoopRepeats: Math.max(0, Number(e.target.value) || 0),
                }))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
            </div>
            <select
              value={selected.tailLoopPattern ?? 'forward'}
              onChange={(e) => updateTrack(selected.id, (t) => ({
                ...t,
                tailLoopPattern: e.target.value as SpriteTailLoopPattern,
              }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            >
              <option value="forward">loop normal (frente)</option>
              <option value="ping-pong">loop ida e volta</option>
            </select>
            <div className="text-[11px] text-slate-400">
              campos: quantidade de frames finais + repeticoes do loop.
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
              <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">timeline da track (fps global 60)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">inicia no frame</div>
                  <input
                    type="number"
                    min={0}
                    value={Math.max(0, selected.timelineStartFrame ?? 0)}
                    onChange={(e) => updateTrack(selected.id, (t) => ({
                      ...t,
                      timelineStartFrame: Math.max(0, Number(e.target.value) || 0),
                    }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">termina no frame (opcional)</div>
                  <input
                    type="number"
                    min={Math.max(0, selected.timelineStartFrame ?? 0)}
                    value={selected.timelineEndFrame ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      updateTrack(selected.id, (t) => ({
                        ...t,
                        timelineEndFrame: raw === '' ? undefined : Math.max(Math.max(0, t.timelineStartFrame ?? 0), Number(raw) || 0),
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                    placeholder="sem corte"
                  />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selected.startEmptyFrame !== false}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, startEmptyFrame: e.target.checked }))}
              />
              comecar com frame vazio
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selected.endEmptyFrame !== false}
                onChange={(e) => updateTrack(selected.id, (t) => ({ ...t, endEmptyFrame: e.target.checked }))}
              />
              terminar com frame vazio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">frame inicial</div>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, selectedTrackFrameCount - 1)}
                  value={selected.frameIndices[0] ?? 0}
                  onChange={(e) => {
                    const start = Number(e.target.value) || 0;
                    const end = selected.frameIndices[selected.frameIndices.length - 1] ?? start;
                    setFrameRangeForSelectedTrack(start, end);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">frame final</div>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, selectedTrackFrameCount - 1)}
                  value={selected.frameIndices[selected.frameIndices.length - 1] ?? 0}
                  onChange={(e) => {
                    const end = Number(e.target.value) || 0;
                    const start = selected.frameIndices[0] ?? end;
                    setFrameRangeForSelectedTrack(start, end);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
              </div>
            </div>
            <div className="text-xs text-slate-400">Para editar direto no cenario, ative `travar giro 3D`. Com giro 3D destravado, o mouse controla apenas a orbita da camera. `Shift+drag` ajusta profundidade (Z), botoes de 90° giram, e scroll no preview ajusta escala (com `Shift` mais rapido).</div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { void copyJson(); }} className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">{copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Error' : 'Copy JSON'}</button>
          <button onClick={downloadJson} className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Download JSON</button>
        </div>
      </div>
    </section>
  );
};
