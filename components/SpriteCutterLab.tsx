import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Eraser, FlipHorizontal, FolderOpen, RotateCcw, Scissors, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type SpritePositionId = 'idle' | 'attack' | 'defense' | 'magic' | 'damage' | 'dead';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface SpritePositionDef {
  id: SpritePositionId;
  label: string;
}

interface SavedSprite {
  position: SpritePositionId;
  dataUrl: string;
}

interface CutRegion {
  position: SpritePositionId;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRITE_POSITIONS: SpritePositionDef[] = [
  { id: 'idle',    label: 'Idle' },
  { id: 'attack',  label: 'Ataque' },
  { id: 'defense', label: 'Defesa' },
  { id: 'magic',   label: 'Magia' },
  { id: 'damage',  label: 'Dano' },
  { id: 'dead',    label: 'Morto' },
];

const MAX_DISPLAY_H = 480;
// Extra canvas space around the image so the crop box can freely extend beyond it
const CANVAS_PAD = 350;

// 8 resize handles: 4 corners (10×10) + 4 edge midpoints (16×6 / 6×16)
const RESIZE_HANDLES: Array<{ id: ResizeHandle; cursor: string; style: React.CSSProperties }> = [
  { id: 'nw', cursor: 'nw-resize', style: { top: -5,  left: -5,  width: 10, height: 10 } },
  { id: 'ne', cursor: 'ne-resize', style: { top: -5,  right: -5, width: 10, height: 10 } },
  { id: 'sw', cursor: 'sw-resize', style: { bottom: -5, left: -5, width: 10, height: 10 } },
  { id: 'se', cursor: 'se-resize', style: { bottom: -5, right: -5, width: 10, height: 10 } },
  { id: 'n',  cursor: 'n-resize',  style: { top: -3,    left: '50%', transform: 'translateX(-50%)', width: 20, height: 6 } },
  { id: 's',  cursor: 's-resize',  style: { bottom: -3, left: '50%', transform: 'translateX(-50%)', width: 20, height: 6 } },
  { id: 'w',  cursor: 'w-resize',  style: { left: -3,  top: '50%', transform: 'translateY(-50%)', width: 6, height: 20 } },
  { id: 'e',  cursor: 'e-resize',  style: { right: -3, top: '50%', transform: 'translateY(-50%)', width: 6, height: 20 } },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Minimal ZIP creator (STORED / no compression) ─────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  const localOffsets: number[] = [];
  let localSize = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    localOffsets.push(localSize);

    const lh = new DataView(new ArrayBuffer(30 + nameBytes.length));
    lh.setUint32(0,  0x04034b50, true); // signature
    lh.setUint16(4,  20,         true); // version needed
    lh.setUint16(6,  0,          true); // flags
    lh.setUint16(8,  0,          true); // STORED
    lh.setUint16(10, 0,          true); // mod time
    lh.setUint16(12, 0,          true); // mod date
    lh.setUint32(14, crc,              true);
    lh.setUint32(18, file.data.length, true); // compressed size
    lh.setUint32(22, file.data.length, true); // uncompressed size
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0,          true); // extra length
    new Uint8Array(lh.buffer, 30).set(nameBytes);
    localParts.push(new Uint8Array(lh.buffer), file.data);
    localSize += 30 + nameBytes.length + file.data.length;

    const cd = new DataView(new ArrayBuffer(46 + nameBytes.length));
    cd.setUint32(0,  0x02014b50, true); // signature
    cd.setUint16(4,  20,         true);
    cd.setUint16(6,  20,         true);
    cd.setUint16(8,  0,          true);
    cd.setUint16(10, 0,          true);
    cd.setUint16(12, 0,          true);
    cd.setUint16(14, 0,          true);
    cd.setUint32(16, crc,              true);
    cd.setUint32(20, file.data.length, true);
    cd.setUint32(24, file.data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint16(30, 0, true); // extra
    cd.setUint16(32, 0, true); // comment
    cd.setUint16(34, 0, true); // disk start
    cd.setUint16(36, 0, true); // internal attr
    cd.setUint32(38, 0, true); // external attr
    cd.setUint32(42, localOffsets[localOffsets.length - 1], true);
    new Uint8Array(cd.buffer, 46).set(nameBytes);
    cdParts.push(new Uint8Array(cd.buffer));
  }

  const cdSize = cdParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0,  0x06054b50,   true); // signature
  eocd.setUint16(4,  0,            true);
  eocd.setUint16(6,  0,            true);
  eocd.setUint16(8,  files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cdSize,       true);
  eocd.setUint32(16, localSize,    true);
  eocd.setUint16(20, 0,            true);

  return new Blob([...localParts, ...cdParts, eocd.buffer], { type: 'application/zip' });
}

// ── NumericInput ──────────────────────────────────────────────────────────────

function NumericInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(isNaN(v) ? 0 : v);
        }}
        className="w-28 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-400/50 focus:outline-none"
      />
    </div>
  );
}

// ── SpriteCutterLab ───────────────────────────────────────────────────────────

export function SpriteCutterLab() {
  const [characterId, setCharacterId] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [cropW, setCropW] = useState(128);
  const [cropH, setCropH] = useState(128);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [savedSprites, setSavedSprites] = useState<SavedSprite[]>([]);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState('');
  const [flipH, setFlipH] = useState(false);

  const [cuts, setCuts] = useState<CutRegion[]>([]);
  const [eraseMode, setEraseMode] = useState(false);
  const [brushRadius, setBrushRadius] = useState(20);
  const [eraseGroups, setEraseGroups] = useState<Array<Array<{ x: number; y: number; r: number }>>>([]);

  const dragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, cropXStart: 0, cropYStart: 0 });
  const resizing = useRef<{
    handle: ResizeHandle;
    startMouseX: number; startMouseY: number;
    startCropX: number;  startCropY: number;
    startCropW: number;  startCropH: number;
  } | null>(null);
  const erasing = useRef(false);
  const currentStrokeRef = useRef<Array<{ x: number; y: number; r: number }>>([]);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cleanup object URL and timers on unmount
  useEffect(() => {
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, []);

  // Scale image to fit a 640×MAX_DISPLAY_H container at zoom=1
  const baseScale =
    imageSize.w > 0
      ? Math.min(640 / imageSize.w, MAX_DISPLAY_H / imageSize.h, 1)
      : 1;
  const displayScale = baseScale * zoom;
  const displayW = Math.round(imageSize.w * displayScale);
  const displayH = Math.round(imageSize.h * displayScale);

  // Crop box in display coordinates (offset by CANVAS_PAD so image is centered)
  const boxLeft = CANVAS_PAD + Math.round(cropX * displayScale);
  const boxTop  = CANVAS_PAD + Math.round(cropY * displayScale);
  const boxW    = Math.round(cropW * displayScale);
  const boxH    = Math.round(cropH * displayScale);

  // Scroll container to center the image whenever a new image is loaded
  useEffect(() => {
    if (!imageUrl || !containerRef.current) return;
    const el = containerRef.current;
    requestAnimationFrame(() => {
      el.scrollLeft = (el.scrollWidth  - el.clientWidth)  / 2;
      el.scrollTop  = (el.scrollHeight - el.clientHeight) / 2;
    });
  }, [imageUrl]);

  // Re-render display canvas when the image, cuts, or erase strokes change
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !imgRef.current) return;
    canvas.width  = imageSize.w;
    canvas.height = imageSize.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, imageSize.w, imageSize.h);
    ctx.drawImage(imgRef.current, 0, 0);
    // Erase confirmed cut regions
    for (const cut of cuts) {
      ctx.clearRect(cut.x, cut.y, cut.w, cut.h);
    }
    // Apply manual erase strokes
    const allStrokes = eraseGroups.flat();
    if (allStrokes.length > 0) {
      ctx.globalCompositeOperation = 'destination-out';
      for (const s of allStrokes) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [imageSize, cuts, eraseGroups]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      setCropX(0);
      setCropY(0);
      setZoom(1);
      setCuts([]);
      setSavedSprites([]);
      setCurrentStep(0);
      setEraseGroups([]);
      setEraseMode(false);
    };
    img.src = url;
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    // reset file input so same file can be re-uploaded
    e.target.value = '';
  }, []);

  const handleCropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        cropXStart: cropX,
        cropYStart: cropY,
      };
    },
    [cropX, cropY],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // ── Resize ─────────────────────────────────────────────────────
      if (resizing.current) {
        const r = resizing.current;
        const dx = (e.clientX - r.startMouseX) / displayScale;
        const dy = (e.clientY - r.startMouseY) / displayScale;
        const h = r.handle;
        let newX = r.startCropX, newY = r.startCropY;
        let newW = r.startCropW, newH = r.startCropH;
        if (h === 'nw' || h === 'w' || h === 'sw') { newX = r.startCropX + dx; newW = r.startCropW - dx; }
        if (h === 'ne' || h === 'e' || h === 'se') {                            newW = r.startCropW + dx; }
        if (h === 'nw' || h === 'n' || h === 'ne') { newY = r.startCropY + dy; newH = r.startCropH - dy; }
        if (h === 'sw' || h === 's' || h === 'se') {                            newH = r.startCropH + dy; }
        if (newW >= 1) { setCropX(Math.round(newX)); setCropW(Math.round(newW)); }
        if (newH >= 1) { setCropY(Math.round(newY)); setCropH(Math.round(newH)); }
        return;
      }
      // ── Move ──────────────────────────────────────────────────────
      if (!dragging.current) return;
      const dxOrig = (e.clientX - dragStart.current.mouseX) / displayScale;
      const dyOrig = (e.clientY - dragStart.current.mouseY) / displayScale;
      setCropX(Math.round(dragStart.current.cropXStart + dxOrig));
      setCropY(Math.round(dragStart.current.cropYStart + dyOrig));
    };
    const onUp = () => {
      dragging.current = false;
      resizing.current = null;
      // Commit any in-progress erase stroke to history
      if (currentStrokeRef.current.length > 0) {
        const stroke = [...currentStrokeRef.current];
        setEraseGroups((prev) => [...prev, stroke]);
        currentStrokeRef.current = [];
      }
      erasing.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [displayScale]);

  const confirmSprite = useCallback(() => {
    if (!imgRef.current || !imageUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (flipH) {
      ctx.translate(cropW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(imgRef.current, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    // Apply eraser strokes so erased areas stay transparent in the exported PNG
    const allStrokes = eraseGroups.flat();
    if (allStrokes.length > 0) {
      ctx.save();
      ctx.resetTransform(); // work in canvas-local (crop) coordinates
      ctx.globalCompositeOperation = 'destination-out';
      for (const s of allStrokes) {
        const ex = s.x - cropX;
        const ey = s.y - cropY;
        ctx.beginPath();
        ctx.arc(flipH ? cropW - ex : ex, ey, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    const dataUrl = canvas.toDataURL('image/png');
    const positionId = SPRITE_POSITIONS[currentStep].id;

    const updatedSprites: SavedSprite[] = [
      ...savedSprites.filter((s) => s.position !== positionId),
      { position: positionId, dataUrl },
    ];
    setSavedSprites(updatedSprites);

    // Advance to the next unsaved step after current
    const savedSet = new Set(updatedSprites.map((s) => s.position));
    const nextAfter = SPRITE_POSITIONS.findIndex((p, i) => i > currentStep && !savedSet.has(p.id));
    if (nextAfter !== -1) {
      setCurrentStep(nextAfter);
      return;
    }
    // Wrap: find first unsaved before current
    const firstUnsaved = SPRITE_POSITIONS.findIndex((p) => !savedSet.has(p.id));
    if (firstUnsaved !== -1) {
      setCurrentStep(firstUnsaved);
    }
  }, [imageUrl, cropX, cropY, cropW, cropH, currentStep, savedSprites, flipH, eraseGroups]);

  const deleteSprite = useCallback((positionId: SpritePositionId) => {
    setSavedSprites((prev) => prev.filter((s) => s.position !== positionId));
    const stepIdx = SPRITE_POSITIONS.findIndex((p) => p.id === positionId);
    setCurrentStep(stepIdx);
  }, []);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation(); // prevent triggering the move drag
      resizing.current = {
        handle,
        startMouseX: e.clientX, startMouseY: e.clientY,
        startCropX: cropX,      startCropY: cropY,
        startCropW: cropW,      startCropH: cropH,
      };
    },
    [cropX, cropY, cropW, cropH],
  );

  // ── Eraser ───────────────────────────────────────────────────────────────

  /** Paint one erase circle directly on the display canvas (image px coords). */
  const paintErasePoint = useCallback((imgX: number, imgY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    currentStrokeRef.current.push({ x: imgX, y: imgY, r: brushRadius });
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(imgX, imgY, brushRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }, [brushRadius]);

  const handleEraseMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      erasing.current = true;
      currentStrokeRef.current = [];
      const rect = e.currentTarget.getBoundingClientRect();
      paintErasePoint(
        (e.clientX - rect.left - CANVAS_PAD) / displayScale,
        (e.clientY - rect.top  - CANVAS_PAD) / displayScale,
      );
    },
    [displayScale, paintErasePoint],
  );

  const handleEraseMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!erasing.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      paintErasePoint(
        (e.clientX - rect.left - CANVAS_PAD) / displayScale,
        (e.clientY - rect.top  - CANVAS_PAD) / displayScale,
      );
    },
    [displayScale, paintErasePoint],
  );

  const handleEraseMouseUp = useCallback(() => {
    if (!erasing.current) return;
    erasing.current = false;
    if (currentStrokeRef.current.length > 0) {
      const stroke = [...currentStrokeRef.current];
      setEraseGroups((prev) => [...prev, stroke]);
      currentStrokeRef.current = [];
    }
  }, []);

  const undoErase = useCallback(() => {
    setEraseGroups((prev) => prev.slice(0, -1));
  }, []);

  const clearErases = useCallback(() => {
    setEraseGroups([]);
  }, []);

  /** Gera ZIP com pasta interna e baixa (ou oferece "Salvar como" via FSA). */
  const downloadAsZip = useCallback(async (name: string) => {
    const files = await Promise.all(
      savedSprites.map(async (sprite) => {
        const ab = await dataUrlToBlob(sprite.dataUrl).arrayBuffer();
        return { name: `${name}/${name}_${sprite.position}.png`, data: new Uint8Array(ab) };
      }),
    );
    const zipBlob = makeZip(files);
    const zipName = `${name}.zip`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: zipName,
          types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(zipBlob);
        await writable.close();
        return;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        // Fall through to standard download
      }
    }

    // Fallback: download para pasta padrão do navegador
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [savedSprites]);

  const exportFolder = useCallback(async () => {
    if (savedSprites.length !== SPRITE_POSITIONS.length) return;
    const name = characterId.trim().replace(/\s+/g, '_') || 'personagem';
    setExportStatus('exporting');
    setExportError('');

    // ── Tier 1: Electron native dialog + fs.writeFile ─────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (window as any).electronBridge;
    if (typeof bridge?.saveSprites === 'function') {
      try {
        const result = await bridge.saveSprites(name, savedSprites) as {
          success: boolean;
          canceled?: boolean;
          path?: string;
        };
        if (result.canceled) { setExportStatus('idle'); return; }
        if (result.success) {
          setExportStatus('success');
          exportTimerRef.current = setTimeout(() => setExportStatus('idle'), 4000);
          return;
        }
      } catch (err: unknown) {
        setExportError(err instanceof Error ? err.message : String(err));
        setExportStatus('error');
        return;
      }
    }

    // ── Tier 2: File System Access API (web / navegador) ──────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).showDirectoryPicker === 'function') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker();
        const charDir = await dirHandle.getDirectoryHandle(name, { create: true });
        for (const sprite of savedSprites) {
          const fileName = `${name}_${sprite.position}.png`;
          const fileHandle = await charDir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(dataUrlToBlob(sprite.dataUrl));
          await writable.close();
        }
        setExportStatus('success');
        exportTimerRef.current = setTimeout(() => setExportStatus('idle'), 4000);
        return;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setExportStatus('idle');
          return;
        }
        // Fall through to individual download fallback
      }
    }

    // ── Tier 3: Fallback – gera ZIP ("Salvar como" ou download direto) ──────
    try {
      await downloadAsZip(name);
      setExportStatus('success');
      exportTimerRef.current = setTimeout(() => setExportStatus('idle'), 4000);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setExportStatus('idle');
        return;
      }
      setExportError(err instanceof Error ? err.message : String(err));
      setExportStatus('error');
    }
  }, [characterId, savedSprites, downloadAsZip]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const allSaved = savedSprites.length === SPRITE_POSITIONS.length;
  const getSaved = (posId: SpritePositionId) => savedSprites.find((s) => s.position === posId);
  const currentPos = SPRITE_POSITIONS[currentStep];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-6 space-y-6">

      {/* ── Header ── */}
      <div className="game-surface rounded-[1.75rem] border border-cyan-400/10 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="game-icon-badge h-12 w-12 shrink-0 text-cyan-300">
            <Scissors size={22} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/75">
              Developer Tool
            </div>
            <h2 className="mt-1 font-gamer text-2xl font-black text-white">Sprite Cutter Lab</h2>
            <p className="mt-2 text-sm text-slate-400">
              Carregue uma sprite sheet com as 6 posições do personagem, recorte cada posição passo a
              passo e exporte a pasta com os PNGs nomeados automaticamente.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          {/* Character ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              ID do Personagem
            </label>
            <input
              type="text"
              value={characterId}
              onChange={(e) =>
                setCharacterId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
              }
              placeholder="ex: rato_comum"
              className="min-w-[220px] rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>

          {/* Upload button */}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm font-black uppercase tracking-[0.15em] text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200">
            <Scissors size={14} />
            {imageUrl ? 'Trocar Imagem' : 'Carregar Sprite Sheet'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>

          {imageUrl && (
            <span className="text-xs text-slate-500">
              {imageSize.w} × {imageSize.h} px
            </span>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {!imageUrl && (
        <div className="game-surface flex flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-dashed border-slate-700 p-16 text-center">
          <div className="game-icon-badge h-16 w-16 text-slate-600">
            <Scissors size={28} />
          </div>
          <div>
            <div className="text-base font-black text-slate-500">Nenhuma sprite sheet carregada</div>
            <div className="mt-1 text-sm text-slate-600">
              Preencha o ID do personagem e clique em "Carregar Sprite Sheet" para começar
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      {imageUrl && (
        <>
          {/* ── Stepper ── */}
          <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              Posições do Personagem
            </div>
            <div className="flex flex-wrap gap-2">
              {SPRITE_POSITIONS.map((pos, i) => {
                const saved = getSaved(pos.id);
                const isActive = i === currentStep;
                return (
                  <button
                    key={pos.id}
                    onClick={() => setCurrentStep(i)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] transition-colors ${
                      isActive
                        ? 'border-orange-500/40 bg-orange-500/15 text-orange-200'
                        : saved
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                        : 'border-slate-700 bg-slate-950/70 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {saved && !isActive ? (
                      <Check size={11} />
                    ) : (
                      <span className="font-mono text-[10px] opacity-60">{i + 1}</span>
                    )}
                    {pos.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Crop Tool + Sprite List ── */}
          <div className="grid gap-6 xl:grid-cols-[1fr_290px]">

            {/* Crop Tool */}
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5">

              {/* Crop header */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Recortando:{' '}
                    <span className="text-orange-300">{currentPos.label}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Arraste o quadro laranja para posicionar o recorte
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
                    className="rounded-lg border border-slate-700 bg-slate-950/70 p-1.5 text-slate-400 transition-colors hover:text-white"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span className="w-12 text-center font-mono text-xs text-slate-400">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(8, parseFloat((z + 0.25).toFixed(2))))}
                    className="rounded-lg border border-slate-700 bg-slate-950/70 p-1.5 text-slate-400 transition-colors hover:text-white"
                  >
                    <ZoomIn size={13} />
                  </button>
                </div>
              </div>

              {/* Image + crop overlay */}
              <div
                ref={containerRef}
                className="overflow-auto rounded-xl border border-slate-800"
                style={{
                  maxHeight: MAX_DISPLAY_H,
                  background:
                    'repeating-conic-gradient(#161b22 0% 25%, #0d1117 0% 50%) 0 0 / 16px 16px',
                }}
              >
                <div style={{ position: 'relative', width: displayW + 2 * CANVAS_PAD, height: displayH + 2 * CANVAS_PAD }}>
                  {/* Display canvas — draws the image and erases confirmed cut regions */}
                  <canvas
                    ref={displayCanvasRef}
                    style={{
                      position: 'absolute',
                      left: CANVAS_PAD,
                      top: CANVAS_PAD,
                      width: displayW,
                      height: displayH,
                      userSelect: 'none',
                      imageRendering: 'pixelated',
                    }}
                  />

                  {/* Darkening strips surrounding the crop box (4 rects = no overlay on crop area) */}
                  {/* Top */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      right: 0,
                      height: boxTop,
                      background: 'rgba(0,0,0,0.55)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Bottom */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: boxTop + boxH,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0,0,0,0.55)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Left */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: boxTop,
                      width: boxLeft,
                      height: boxH,
                      background: 'rgba(0,0,0,0.55)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Right */}
                  <div
                    style={{
                      position: 'absolute',
                      left: boxLeft + boxW,
                      top: boxTop,
                      right: 0,
                      height: boxH,
                      background: 'rgba(0,0,0,0.55)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Crop box */}
                  <div
                    onMouseDown={handleCropMouseDown}
                    style={{
                      position: 'absolute',
                      left: boxLeft,
                      top: boxTop,
                      width: boxW,
                      height: boxH,
                      cursor: 'move',
                      outline: '2px solid #f97316',
                      outlineOffset: '-1px',
                      boxSizing: 'border-box',
                    }}
                  >
{/* Resize handles (4 corners + 4 edge midpoints) */}
                  {RESIZE_HANDLES.map((h) => (
                    <div
                      key={h.id}
                      onMouseDown={(e) => handleResizeMouseDown(e, h.id)}
                      style={{
                        position: 'absolute',
                        background: '#f97316',
                        borderRadius: 2,
                        cursor: h.cursor,
                        zIndex: 10,
                        ...h.style,
                        }}
                      />
                    ))}

                    {/* Position label inside crop box */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(249,115,22,0.92)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                        padding: '2px 6px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        textTransform: 'uppercase',
                      }}
                    >
                      {currentPos.label}
                    </div>
                  </div>

                  {/* Erase overlay — sits above everything, intercepts all mouse events */}
                  {eraseMode && (
                    <div
                      style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 30 }}
                      onMouseDown={handleEraseMouseDown}
                      onMouseMove={handleEraseMouseMove}
                      onMouseUp={handleEraseMouseUp}
                      onMouseLeave={handleEraseMouseUp}
                    />
                  )}
                </div>
              </div>

              {/* Crop controls */}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <NumericInput
                  label="X"
                  value={cropX}
                  onChange={(v) => setCropX(v)}
                />
                <NumericInput
                  label="Y"
                  value={cropY}
                  onChange={(v) => setCropY(v)}
                />
                <NumericInput
                  label="Largura"
                  value={cropW}
                  onChange={(v) => setCropW(Math.max(0, v))}
                />
                <NumericInput
                  label="Altura"
                  value={cropH}
                  onChange={(v) => setCropH(Math.max(0, v))}
                />

                {/* Flip horizontal toggle */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Espelhar
                  </span>
                  <button
                    onClick={() => setFlipH((f) => !f)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] transition-colors ${
                      flipH
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                        : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    <FlipHorizontal size={13} />
                    {flipH ? 'Ativo' : 'Off'}
                  </button>
                </div>

                {/* Eraser mode toggle */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Apagador
                  </span>
                  <button
                    onClick={() => setEraseMode((m) => !m)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] transition-colors ${
                      eraseMode
                        ? 'border-red-500/40 bg-red-500/15 text-red-200'
                        : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    <Eraser size={13} />
                    {eraseMode ? 'Ativo' : 'Off'}
                  </button>
                </div>

                {eraseMode && (
                  <>
                    <NumericInput
                      label="Raio (px)"
                      value={brushRadius}
                      onChange={(v) => setBrushRadius(Math.max(1, v))}
                    />
                    {eraseGroups.length > 0 && (
                      <button
                        onClick={undoErase}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
                      >
                        <RotateCcw size={12} />
                        Desfazer
                      </button>
                    )}
                    {eraseGroups.length > 0 && (
                      <button
                        onClick={clearErases}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-950/20 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-red-400 transition-colors hover:text-red-200"
                      >
                        <Trash2 size={12} />
                        Limpar Tudo
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={confirmSprite}
                  className="inline-flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/15 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-orange-200 transition-colors hover:bg-orange-500/25"
                >
                  <Check size={14} />
                  Confirmar Sprite
                </button>
              </div>
            </div>

            {/* Sprite List */}
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5">
              <div className="mb-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Sprites Salvos{' '}
                <span className="text-slate-300">
                  ({savedSprites.length}/{SPRITE_POSITIONS.length})
                </span>
              </div>

              <div className="space-y-2">
                {SPRITE_POSITIONS.map((pos, i) => {
                  const saved = getSaved(pos.id);
                  const isActive = i === currentStep;
                  return (
                    <div
                      key={pos.id}
                      className={`flex items-center gap-2.5 rounded-xl border p-2 transition-colors ${
                        isActive
                          ? 'border-orange-500/30 bg-orange-500/[0.08]'
                          : saved
                          ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
                          : 'border-slate-800 bg-slate-950/30'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700"
                        style={{
                          background:
                            'repeating-conic-gradient(#1a2030 0% 25%, #111520 0% 50%) 0 0 / 8px 8px',
                        }}
                      >
                        {saved ? (
                          <img
                            src={saved.dataUrl}
                            alt={pos.id}
                            className="max-h-full max-w-full"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : (
                          <span className="font-mono text-[10px] font-black text-slate-700">
                            {i + 1}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-black uppercase tracking-[0.12em] ${
                            saved ? 'text-slate-200' : 'text-slate-600'
                          }`}
                        >
                          {pos.label}
                        </div>
                        {saved && characterId && (
                          <div className="mt-0.5 truncate text-[10px] text-slate-500">
                            {characterId}_{pos.id}.png
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      {saved ? (
                        <button
                          onClick={() => deleteSprite(pos.id)}
                          title="Deletar e refazer"
                          className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setCurrentStep(i)}
                          title="Ir para esta posição"
                          className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-slate-600 transition-colors hover:border-cyan-400/40 hover:text-cyan-400"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Export ── */}
          <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Exportar Pasta
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {allSaved
                    ? `Todos os sprites prontos para "${characterId || 'personagem'}". Escolha onde criar a pasta.`
                    : `Salve todas as ${SPRITE_POSITIONS.length} posições para exportar. (${savedSprites.length}/${SPRITE_POSITIONS.length} prontos)`}
                </p>
              </div>
              <button
                onClick={exportFolder}
                disabled={!allSaved || exportStatus === 'exporting'}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-5 py-2.5 text-sm font-black uppercase tracking-[0.18em] text-cyan-200 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FolderOpen size={16} />
                {exportStatus === 'exporting'
                  ? 'Exportando...'
                  : exportStatus === 'success'
                  ? 'Exportado!'
                  : 'Gerar Pasta'}
              </button>
            </div>

            {exportStatus === 'error' && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                Erro ao exportar: {exportError}
              </div>
            )}

            {exportStatus === 'success' && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                ✓ {SPRITE_POSITIONS.length} sprites de <strong>"{characterId || 'personagem'}"</strong> exportados com sucesso!
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
