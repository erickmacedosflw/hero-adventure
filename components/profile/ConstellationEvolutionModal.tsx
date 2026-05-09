import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Heart,
    Orbit,
    RefreshCw,
    Shield,
    Sparkles,
    Star,
    Sword,
    WandSparkles,
    Wind,
    X,
    Zap,
} from 'lucide-react';
import { getPlayerClassById } from '../../game/data/classes';
import { getConstellationByClassId, CONSTELLATION_SKILLS } from '../../game/data/classTalents';
import { canUnlockTalentNode } from '../../game/mechanics/classProgression';
import type { ClassTalentTrail, Player, Skill, TalentNode, TalentNodeEffect } from '../../types';

const CONSTELLATION_ICON_URL = new URL('../../game/assets/Icons/Menu/Icone_Constelacao.png', import.meta.url).href;
const BANNER_CONSTELLATION_URL = new URL('../../game/assets/Imagens/Banner_Constelacao.png', import.meta.url).href;

interface ConstellationEvolutionModalProps {
    player: Player;
    onClose: () => void;
    onUnlockTalent: (nodeId: string) => void;
    onResetTalents: () => void;
    isClosing?: boolean;
}

// ---- shared style helpers --------------------------------------------------

const STAT_LABELS: Record<string, string> = {
    hp: 'Vida',
    maxHp: 'Vida Máxima',
    mp: 'Mana',
    maxMp: 'Mana Máxima',
    atk: 'Ataque',
    def: 'Defesa',
    magicDef: 'Defesa Mágica',
    magic: 'Poder Mágico',
    speed: 'Velocidade',
    luck: 'Sorte',
};

const BONUS_LABELS: Record<string, string> = {
    physicalDamage: 'Dano Físico',
    magicDamage: 'Dano Mágico',
    critChance: 'Crítico',
    critDamage: 'Dano Crítico',
    lifeSteal: 'Roubo de Vida',
    damageReduction: 'Redução de Dano',
    markedDamage: 'Dano em Marcados',
};

const NODE_TYPE_LABELS: Record<NonNullable<TalentNode['nodeType']>, string> = {
    attribute: 'Atributo',
    passive: 'Passivo',
    skill: 'Habilidade',
};

const NODE_SIZE_BY_TYPE: Record<NonNullable<TalentNode['nodeType']>, number> = {
    attribute: 50,
    passive: 56,
    skill: 70,
};

const LOCKED_FILL = 'rgba(140,150,165,0.18)';
const LOCKED_STROKE = 'rgba(210,218,230,0.45)';
const LOCKED_ICON = 'rgba(220,228,240,0.55)';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatStatusKind = (kind: string): string => {
    const map: Record<string, string> = {
        burn: 'Queimadura',
        bleed: 'Sangramento',
        poison: 'Veneno',
        stun: 'Atordoamento',
        marked: 'Marcado',
        slow: 'Lentidão',
        chill: 'Resfriamento',
        weakness: 'Fraqueza',
        regen: 'Regeneração',
    };
    return map[kind] ?? kind;
};

const SkillStat: React.FC<{ label: string; value: string; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div
        style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '7px 9px',
            textAlign: 'center',
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
            {icon}
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#94a3b8' }}>{label}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
    </div>
);

const SkillEffectLine: React.FC<{ color: string; text: string }> = ({ color, text }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: color, flexShrink: 0 }} />
        <span>{text}</span>
    </div>
);

const getEffectSummary = (effects: TalentNodeEffect[]): string[] => {
    const lines: string[] = [];
    effects.forEach((effect) => {
        if (effect.stats) {
            Object.entries(effect.stats).forEach(([key, value]) => {
                if (!value) return;
                const label = STAT_LABELS[key] ?? key;
                lines.push(`${value > 0 ? '+' : ''}${value} ${label}`);
            });
        }
        if (effect.bonuses) {
            Object.entries(effect.bonuses).forEach(([key, value]) => {
                if (!value) return;
                const label = BONUS_LABELS[key] ?? key;
                lines.push(`${value > 0 ? '+' : ''}${formatPercent(value)} ${label}`);
            });
        }
        if (effect.unlockSkillId) {
            lines.push(`Desbloqueia habilidade especial`);
        }
    });
    return lines;
};

const StatIcon: React.FC<{ stat: string; size: number; color: string }> = ({ stat, size, color }) => {
    const props = { size, color, strokeWidth: 2.4 } as const;
    switch (stat) {
        case 'hp':
        case 'maxHp':
            return <Heart {...props} />;
        case 'mp':
        case 'maxMp':
            return <Sparkles {...props} />;
        case 'atk':
            return <Sword {...props} />;
        case 'def':
        case 'magicDef':
            return <Shield {...props} />;
        case 'magic':
            return <WandSparkles {...props} />;
        case 'speed':
            return <Wind {...props} />;
        case 'luck':
            return <Star {...props} />;
        default:
            return <Zap {...props} />;
    }
};

const pickPrimaryStat = (node: TalentNode): string | null => {
    for (const effect of node.effects) {
        if (effect.stats) {
            const key = Object.keys(effect.stats)[0];
            if (key) return key;
        }
    }
    return null;
};

// ---- node shape (SVG) ------------------------------------------------------

type ShapeVariant = NonNullable<TalentNode['shapeVariant']>;

const NodeShape: React.FC<{
    variant: ShapeVariant;
    size: number;
    fill: string;
    stroke: string;
    strokeWidth?: number;
}> = ({ variant, size, fill, stroke, strokeWidth = 2 }) => {
    const half = size / 2;
    const points = useMemo(() => {
        if (variant === 'diamond') {
            return [
                [half, 2],
                [size - 2, half],
                [half, size - 2],
                [2, half],
            ]
                .map((p) => p.join(','))
                .join(' ');
        }
        if (variant === 'hex') {
            const r = half - 2;
            const cx = half;
            const cy = half;
            const angles = [0, 60, 120, 180, 240, 300].map((a) => (a + 30) * (Math.PI / 180));
            return angles
                .map((rad) => `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`)
                .join(' ');
        }
        // star
        const rOuter = half - 2;
        const rInner = rOuter * 0.46;
        const cx = half;
        const cy = half;
        const arr: string[] = [];
        for (let i = 0; i < 10; i += 1) {
            const r = i % 2 === 0 ? rOuter : rInner;
            const a = (-90 + i * 36) * (Math.PI / 180);
            arr.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
        }
        return arr.join(' ');
    }, [variant, size, half]);

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
            <polygon points={points} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
        </svg>
    );
};

// ---- layout ----------------------------------------------------------------

const TRAIL_X = [110, 320, 530];  // wider spacing
const TOP_Y = 80;
const BOTTOM_Y = 760;
const ORIGIN_Y = 850;
const VIEW_W = 640;
const VIEW_H = 920;

const stageY = (stage: number) => {
    const t = (stage - 1) / 6;
    return BOTTOM_Y - (BOTTOM_Y - TOP_Y) * t;
};

// ---- main component --------------------------------------------------------

export const ConstellationEvolutionModal: React.FC<ConstellationEvolutionModalProps> = ({
    player,
    onClose,
    onUnlockTalent,
    onResetTalents,
    isClosing,
}) => {
    const constellation = getConstellationByClassId(player.classId);
    const playerClass = getPlayerClassById(player.classId);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [confirmReset, setConfirmReset] = useState(false);
    // unlock animation: tracks the node currently playing the unlock VFX so we
    // can render the beam + burst overlay and close the popup with a flourish.
    const [unlockAnim, setUnlockAnim] = useState<{
        nodeId: string;
        trailIndex: number;
        targetX: number;
        targetY: number;
        color: string;
    } | null>(null);
    const [popupClosing, setPopupClosing] = useState(false);

    // ---- zoom & pan state ----
    const MIN_SCALE = 0.6;
    const MAX_SCALE = 3.0;
    const INITIAL_VIEW = { x: 0, y: -120, scale: 1.2 };
    const [view, setView] = useState(INITIAL_VIEW);
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
    const pinchStateRef = useRef<{ pointers: Map<number, { x: number; y: number }>; startDistance: number; startScale: number } | null>(null);
    const justDraggedRef = useRef(false);

    const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

    const zoomBy = (factor: number, focusX?: number, focusY?: number) => {
        setView((prev) => {
            const next = clampScale(prev.scale * factor);
            const ratio = next / prev.scale;
            const fx = focusX ?? 0;
            const fy = focusY ?? 0;
            return {
                x: fx - (fx - prev.x) * ratio,
                y: fy - (fy - prev.y) * ratio,
                scale: next,
            };
        });
    };

    const resetView = () => setView(INITIAL_VIEW);
    void resetView;

    const onWheelNative = useRef<((e: WheelEvent) => void) | null>(null);
    onWheelNative.current = (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const fx = e.clientX - rect.left - rect.width / 2;
        const fy = e.clientY - rect.top - rect.height / 2;
        zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, fx, fy);
    };

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => onWheelNative.current?.(e);
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!canvasRef.current) return;
        // Don't capture: we want children (the SVG nodes) to keep receiving
        // their own pointer/click events. We track drag state manually.
        if (pinchStateRef.current) {
            pinchStateRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            return;
        }
        if (dragStateRef.current && dragStateRef.current.pointerId !== e.pointerId) {
            // upgrade to pinch
            const a = { x: dragStateRef.current.startX, y: dragStateRef.current.startY };
            const b = { x: e.clientX, y: e.clientY };
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            pinchStateRef.current = {
                pointers: new Map([
                    [dragStateRef.current.pointerId, a],
                    [e.pointerId, b],
                ]),
                startDistance: dist,
                startScale: view.scale,
            };
            dragStateRef.current = null;
            return;
        }
        dragStateRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            viewX: view.x,
            viewY: view.y,
            moved: false,
        };
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (pinchStateRef.current) {
            pinchStateRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const pts = Array.from(pinchStateRef.current.pointers.values());
            if (pts.length >= 2) {
                const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const factor = dist / pinchStateRef.current.startDistance;
                const newScale = clampScale(pinchStateRef.current.startScale * factor);
                setView((prev) => ({ ...prev, scale: newScale }));
            }
            return;
        }
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
            drag.moved = true;
            // Capture pointer once movement starts so subsequent moves keep
            // flowing even if cursor leaves the canvas. Children won't be
            // receiving clicks during a drag anyway, which is what we want.
            if (canvasRef.current && !canvasRef.current.hasPointerCapture(e.pointerId)) {
                try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
            }
            setView({ x: drag.viewX + dx, y: drag.viewY + dy, scale: view.scale });
        }
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (pinchStateRef.current) {
            pinchStateRef.current.pointers.delete(e.pointerId);
            if (pinchStateRef.current.pointers.size < 2) pinchStateRef.current = null;
        }
        if (dragStateRef.current && dragStateRef.current.pointerId === e.pointerId) {
            if (dragStateRef.current.moved) {
                justDraggedRef.current = true;
                window.setTimeout(() => { justDraggedRef.current = false; }, 80);
            }
            dragStateRef.current = null;
        }
        if (canvasRef.current && canvasRef.current.hasPointerCapture(e.pointerId)) {
            try { canvasRef.current.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        }
    };

    const isPanning = () => justDraggedRef.current || (dragStateRef.current !== null && dragStateRef.current.moved);

    const trails = constellation.trails;

    const unlockedSet = useMemo(() => new Set(player.unlockedTalentNodeIds), [player.unlockedTalentNodeIds]);
    const totalUnlocked = trails.reduce(
        (sum, t) => sum + t.nodes.filter((n) => unlockedSet.has(n.id)).length,
        0,
    );
    const totalNodes = trails.reduce((s, t) => s + t.nodes.length, 0);
    const availablePoints = Math.max(0, player.talentPoints);

    const selectedNode = useMemo<{ node: TalentNode; trail: ClassTalentTrail } | null>(() => {
        if (!selectedNodeId) return null;
        for (const trail of trails) {
            const node = trail.nodes.find((n) => n.id === selectedNodeId);
            if (node) return { node, trail };
        }
        return null;
    }, [selectedNodeId, trails]);

    const classColor = playerClass?.visualProfile?.secondaryColor ?? '#a5b4fc';
    const classTertiary = playerClass?.visualProfile?.tertiaryColor ?? classColor;

    // ---- render helpers ----

    const renderNodeIcon = (node: TalentNode, size: number, color: string): React.ReactNode => {
        const nodeType = node.nodeType ?? 'attribute';
        if (nodeType === 'attribute') {
            const stat = pickPrimaryStat(node) ?? 'atk';
            return <StatIcon stat={stat} size={size} color={color} />;
        }
        if (nodeType === 'passive') {
            return <Zap size={size} color={color} strokeWidth={2.4} />;
        }
        const skillIcon = skillIdsByNode.get(node.id)?.icon;
        if (skillIcon) {
            return <img src={skillIcon} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 4 }} alt="" />;
        }
        return <Sparkles size={size} color={color} strokeWidth={2.4} />;
    };

    const renderNode = (node: TalentNode, trail: ClassTalentTrail, x: number, y: number) => {
        const isUnlocked = unlockedSet.has(node.id);
        const check = canUnlockTalentNode(player, node.id);
        const isAvailable = check.ok;
        const variant: ShapeVariant = node.shapeVariant ?? 'diamond';
        const nodeType = node.nodeType ?? 'attribute';
        const size = NODE_SIZE_BY_TYPE[nodeType];
        const isSelected = selectedNodeId === node.id;

        const fill = isUnlocked ? `${trail.color}E6` : isAvailable ? 'rgba(28,32,46,0.85)' : LOCKED_FILL;
        const stroke = isUnlocked ? '#ffffff' : isAvailable ? 'rgba(255,255,255,0.7)' : LOCKED_STROKE;
        const iconColor = isUnlocked ? '#ffffff' : isAvailable ? '#e2e8f0' : LOCKED_ICON;

        const iconNode = renderNodeIcon(node, Math.round(size * (nodeType === 'skill' ? 0.44 : 0.38)), iconColor);

        return (
            <g
                key={node.id}
                transform={`translate(${x - size / 2}, ${y - size / 2})`}
                style={{ cursor: 'pointer' }}
                className={`constellation-node ${isUnlocked ? 'is-unlocked' : ''} ${isAvailable ? 'is-available' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isPanning()) return;
                    setSelectedNodeId(node.id);
                }}
            >
                {isUnlocked && (
                    <circle
                        className="node-halo"
                        cx={size / 2}
                        cy={size / 2}
                        r={size / 2 + 6}
                        fill="none"
                        stroke={trail.color}
                        strokeOpacity={0.35}
                        strokeWidth={2}
                    />
                )}
                {isSelected && (
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={size / 2 + 10}
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity={0.85}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                    />
                )}
                {(nodeType === 'skill' && skillIdsByNode.get(node.id)?.icon) ? (
                    <>
                        <defs>
                            <clipPath id={`skill-clip-${node.id}`}>
                                <rect x={2} y={2} width={size - 4} height={size - 4} rx={Math.round((size - 4) * 0.24)} />
                            </clipPath>
                        </defs>
                        <rect x={2} y={2} width={size - 4} height={size - 4} rx={Math.round((size - 4) * 0.24)} fill={fill} />
                        <image
                            href={skillIdsByNode.get(node.id)!.icon!}
                            x={2} y={2} width={size - 4} height={size - 4}
                            clipPath={`url(#skill-clip-${node.id})`}
                            preserveAspectRatio="xMidYMid slice"
                        />
                        <rect x={2} y={2} width={size - 4} height={size - 4} rx={Math.round((size - 4) * 0.24)} fill="none" stroke="white" strokeWidth={2.5} strokeOpacity={isUnlocked ? 0.9 : 0.45} />
                    </>
                ) : (
                    <>
                        <NodeShape variant={variant} size={size} fill={fill} stroke={stroke} strokeWidth={2.2} />
                        <foreignObject x={0} y={0} width={size} height={size} style={{ pointerEvents: 'none' }}>
                            <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {iconNode}
                            </div>
                        </foreignObject>
                    </>
                )}
            </g>
        );
    };

    // Connector path between two points (smooth curve)
    const renderConnector = (
        key: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: string,
        active: boolean,
    ) => {
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
        return (
            <path
                key={key}
                d={d}
                fill="none"
                stroke={active ? color : 'rgba(180,190,210,0.22)'}
                strokeWidth={active ? 2.4 : 1.6}
                strokeLinecap="round"
                className={active ? 'constellation-connector-active' : ''}
                style={{ filter: active ? `drop-shadow(0 0 6px ${color}55)` : 'none' }}
            />
        );
    };

    // ---- node selection detail (popup) ----

    const skillIdsByNode = useMemo(() => {
        const map = new Map<string, Skill>();
        for (const trail of trails) {
            for (const node of trail.nodes) {
                for (const effect of node.effects) {
                    if (effect.unlockSkillId) {
                        const skill = CONSTELLATION_SKILLS.find((s) => s.id === effect.unlockSkillId);
                        if (skill) map.set(node.id, skill);
                    }
                }
            }
        }
        return map;
    }, [trails]);

    const trailIndexById = useMemo(() => {
        const map = new Map<string, number>();
        trails.forEach((trail, idx) => map.set(trail.id, idx));
        return map;
    }, [trails]);

    const triggerUnlockAnimation = (node: TalentNode, trail: ClassTalentTrail) => {
        const trailIndex = trailIndexById.get(trail.id) ?? 0;
        const targetX = TRAIL_X[trailIndex];
        const targetY = stageY(node.stage ?? 1);
        setUnlockAnim({ nodeId: node.id, trailIndex, targetX, targetY, color: trail.color });
        // popup fades out first
        setPopupClosing(true);
        window.setTimeout(() => {
            setSelectedNodeId(null);
            setPopupClosing(false);
        }, 220);
        // unlock the node midway through the beam animation
        window.setTimeout(() => {
            onUnlockTalent(node.id);
        }, 520);
        // clear overlay after the burst finishes
        window.setTimeout(() => {
            setUnlockAnim(null);
        }, 1100);
    };

    const renderNodeDetailPopup = () => {
        if (!selectedNode) return null;
        const { node, trail } = selectedNode;
        const isUnlocked = unlockedSet.has(node.id);
        const check = canUnlockTalentNode(player, node.id);
        const isAvailable = check.ok;
        const nodeType = node.nodeType ?? 'attribute';
        const benefits = getEffectSummary(node.effects);
        const skill = skillIdsByNode.get(node.id);

        return (
            <div
                onClick={() => {
                    if (popupClosing) return;
                    setPopupClosing(true);
                    window.setTimeout(() => {
                        setSelectedNodeId(null);
                        setPopupClosing(false);
                    }, 180);
                }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(6,8,18,0.55)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    padding: 16,
                    animation: `${popupClosing ? 'constellationBackdropOut' : 'constellationBackdropIn'} 0.18s ease-out both`,
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '100%',
                        maxWidth: 460,
                        maxHeight: '88%',
                        overflowY: 'auto',
                        borderRadius: 18,
                        padding: 22,
                        background: `linear-gradient(160deg, rgba(20,24,38,0.96), rgba(10,12,22,0.96))`,
                        border: `1.5px solid ${trail.color}66`,
                        boxShadow: `0 18px 60px rgba(0,0,0,0.6), 0 0 0 1px ${trail.color}22 inset`,
                        position: 'relative',
                        animation: `${popupClosing ? 'constellationPopOut' : 'constellationFadeIn'} 0.22s cubic-bezier(0.22,1,0.36,1) both`,
                    }}
                >
                    <button
                        onClick={() => {
                            setPopupClosing(true);
                            window.setTimeout(() => {
                                setSelectedNodeId(null);
                                setPopupClosing(false);
                            }, 180);
                        }}
                        aria-label="Fechar"
                        style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 8,
                            width: 30,
                            height: 30,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#cbd5e1',
                        }}
                    >
                        <X size={16} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                        <div
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 16,
                                background: isUnlocked
                                    ? `linear-gradient(140deg, ${trail.color}cc, ${trail.color}55)`
                                    : `linear-gradient(140deg, ${trail.color}33, rgba(255,255,255,0.04))`,
                                border: (nodeType === 'skill' && skill?.icon) ? '2px solid rgba(255,255,255,0.88)' : `1.5px solid ${trail.color}88`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                overflow: 'hidden',
                                boxShadow: nodeType === 'skill' ? `0 0 22px ${trail.color}66` : 'none',
                            }}
                        >
                            {(nodeType === 'skill' && skill?.icon)
                                ? <img src={skill.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                : renderNodeIcon(node, 32, isUnlocked ? '#ffffff' : '#e2e8f0')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    letterSpacing: 1.4,
                                    textTransform: 'uppercase',
                                    color: trail.color,
                                    marginBottom: 4,
                                }}
                            >
                                {NODE_TYPE_LABELS[nodeType]} · {trail.name}
                            </div>
                            <div
                                style={{
                                    fontSize: nodeType === 'skill' ? 22 : 18,
                                    fontWeight: 900,
                                    color: '#f8fafc',
                                    lineHeight: 1.15,
                                    textShadow: nodeType === 'skill' ? `0 2px 14px ${trail.color}88` : 'none',
                                    letterSpacing: nodeType === 'skill' ? 0.3 : 0,
                                }}
                            >
                                {nodeType === 'skill' && skill ? skill.name : node.title}
                            </div>
                        </div>
                    </div>

                    {/* skill detail block --------------------------------- */}
                    {nodeType === 'skill' && skill && (
                        <div
                            style={{
                                background: `linear-gradient(150deg, ${trail.color}1f, rgba(255,255,255,0.02))`,
                                border: `1px solid ${trail.color}55`,
                                borderRadius: 14,
                                padding: '12px 14px',
                                marginBottom: 14,
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 8,
                                    marginBottom: 10,
                                }}
                            >
                                <SkillStat
                                    label="Mana"
                                    value={`${skill.manaCost}`}
                                    color="#60a5fa"
                                    icon={<Sparkles size={13} color="#60a5fa" />}
                                />
                                <SkillStat
                                    label="Multi. Dano"
                                    value={`${skill.damageMult.toFixed(1)}x`}
                                    color={trail.color}
                                    icon={skill.type === 'heal' ? <Heart size={13} color={trail.color} /> : skill.type === 'magic' ? <WandSparkles size={13} color={trail.color} /> : <Sword size={13} color={trail.color} />}
                                />
                                <SkillStat
                                    label="Tipo"
                                    value={skill.type === 'physical' ? 'Físico' : skill.type === 'magic' ? 'Mágico' : 'Cura'}
                                    color="#cbd5e1"
                                    icon={<Zap size={13} color="#cbd5e1" />}
                                />
                            </div>
                            {skill.description && (
                                <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.45 }}>
                                    {skill.description}
                                </p>
                            )}
                            <div style={{ display: 'grid', gap: 5 }}>
                                {skill.statusEffect && (
                                    <SkillEffectLine
                                        color={trail.color}
                                        text={`Aplica ${formatStatusKind(skill.statusEffect.kind)} (${Math.round(skill.statusEffect.chance * 100)}% · ${skill.statusEffect.duration} turnos · força ${Math.round(skill.statusEffect.potency * 100)}%)`}
                                    />
                                )}
                                {skill.buffEffect && (
                                    <SkillEffectLine
                                        color={trail.color}
                                        text={`Buff de ${skill.buffEffect.kind === 'atk' ? 'Ataque' : 'Defesa'}: +${Math.round(skill.buffEffect.modifier * 100)}% por ${skill.buffEffect.duration} turnos`}
                                    />
                                )}
                                {skill.resourceEffect && (
                                    <SkillEffectLine
                                        color={trail.color}
                                        text={[
                                            skill.resourceEffect.cost ? `Consome ${skill.resourceEffect.cost} ${skill.resourceLabel ?? 'Recurso'}` : null,
                                            skill.resourceEffect.gain ? `+${skill.resourceEffect.gain} ${skill.resourceLabel ?? 'Recurso'}` : null,
                                            skill.resourceEffect.consumeAll ? `Consome todo ${skill.resourceLabel ?? 'Recurso'}` : null,
                                            skill.resourceEffect.bonusDamagePerPoint ? `+${Math.round(skill.resourceEffect.bonusDamagePerPoint * 100)}% dano por ponto` : null,
                                        ].filter(Boolean).join(' · ')}
                                    />
                                )}
                                {skill.minLevel > 1 && (
                                    <SkillEffectLine
                                        color="#94a3b8"
                                        text={`Nível mínimo: ${skill.minLevel}`}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {node.description && nodeType !== 'skill' && (
                        <p
                            style={{
                                fontSize: 13,
                                color: '#cbd5e1',
                                lineHeight: 1.5,
                                margin: '0 0 14px',
                            }}
                        >
                            {node.description}
                        </p>
                    )}

                    {benefits.length > 0 && (
                        <div
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 12,
                                padding: '10px 12px',
                                marginBottom: 14,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    letterSpacing: 1.2,
                                    textTransform: 'uppercase',
                                    color: '#94a3b8',
                                    marginBottom: 6,
                                }}
                            >
                                {nodeType === 'skill' ? 'Bônus extras' : 'Benefícios'}
                            </div>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
                                {benefits.map((b, i) => (
                                    <li
                                        key={i}
                                        style={{
                                            fontSize: 13,
                                            color: '#e2e8f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: 99,
                                                background: trail.color,
                                                flexShrink: 0,
                                            }}
                                        />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {isUnlocked ? (
                        <div
                            style={{
                                textAlign: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                color: trail.color,
                                padding: '10px 12px',
                                background: `${trail.color}1a`,
                                border: `1px solid ${trail.color}55`,
                                borderRadius: 10,
                            }}
                        >
                            Nó já liberado
                        </div>
                    ) : (
                        <button
                            disabled={!isAvailable || availablePoints <= 0 || unlockAnim !== null}
                            onClick={() => {
                                if (!isAvailable || availablePoints <= 0 || unlockAnim !== null) return;
                                triggerUnlockAnimation(node, trail);
                            }}
                            className="constellation-unlock-btn"
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: 10,
                                border: `1.5px solid ${isAvailable && availablePoints > 0 ? trail.color : 'rgba(255,255,255,0.1)'}`,
                                background: isAvailable && availablePoints > 0
                                    ? `linear-gradient(135deg, ${trail.color}, ${trail.color}88)`
                                    : 'rgba(255,255,255,0.04)',
                                color: isAvailable && availablePoints > 0 ? '#0b0f1c' : '#64748b',
                                fontSize: 13,
                                fontWeight: 800,
                                letterSpacing: 0.6,
                                textTransform: 'uppercase',
                                cursor: isAvailable && availablePoints > 0 ? 'pointer' : 'not-allowed',
                                boxShadow: isAvailable && availablePoints > 0 ? `0 6px 20px ${trail.color}55` : 'none',
                                transition: 'transform 0.12s ease-out, box-shadow 0.18s ease-out, filter 0.18s ease-out',
                            }}
                        >
                            {!isAvailable
                                ? 'Indisponível'
                                : availablePoints <= 0
                                    ? 'Sem pontos'
                                    : `Liberar Nó (1 pt)`}
                        </button>
                    )}
                    {!isUnlocked && !isAvailable && check.ok === false && (
                        <div
                            style={{
                                marginTop: 8,
                                fontSize: 11.5,
                                color: '#94a3b8',
                                textAlign: 'center',
                            }}
                        >
                            {check.reason}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 z-[210] flex items-end lg:items-center justify-center pointer-events-auto lg:p-4"
            style={{
                background: 'rgba(4,6,14,0.72)',
                backdropFilter: 'blur(28px) saturate(140%)',
                WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                animation: `${isClosing ? 'constellationBackdropOut' : 'constellationBackdropIn'} 0.22s ease-out both`,
                pointerEvents: 'auto',
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`constellation-panel${isClosing ? ' constellation-panel--closing' : ''}`}
                style={{
                    width: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                    background: `radial-gradient(circle at 18% 12%, ${classColor}18, transparent 50%), radial-gradient(circle at 82% 90%, ${classTertiary}12, transparent 50%), linear-gradient(160deg, rgba(14,17,28,0.45), rgba(8,10,18,0.50))`,
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                    border: `1.5px solid ${classColor}44`,
                    boxShadow: `0 30px 90px rgba(0,0,0,0.55), 0 0 0 1px ${classColor}18 inset`,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <style>{`
                    @keyframes constellationModalIn {
                        from { opacity: 0; transform: translateY(12px) scale(0.96); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    @keyframes constellationModalOut {
                        from { opacity: 1; transform: translateY(0) scale(1); }
                        to { opacity: 0; transform: translateY(8px) scale(0.97); }
                    }
                    @keyframes constellationBackdropIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes constellationBackdropOut {
                        from { opacity: 1; }
                        to { opacity: 0; }
                    }
                    @keyframes constellationNodePulse {
                        0%, 100% { opacity: 0.55; }
                        50% { opacity: 1; }
                    }
                    @keyframes constellationConnectorFlow {
                        from { stroke-dashoffset: 0; }
                        to { stroke-dashoffset: -40; }
                    }
                    @keyframes constellationFadeIn {
                        from { opacity: 0; transform: translateY(6px) scale(0.96); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    @keyframes constellationPopOut {
                        from { opacity: 1; transform: translateY(0) scale(1); }
                        to { opacity: 0; transform: translateY(4px) scale(0.95); }
                    }
                    @keyframes constellationBeamDraw {
                        from { stroke-dashoffset: 1000; }
                        to { stroke-dashoffset: 0; }
                    }
                    @keyframes constellationBurst {
                        0% { transform: scale(0.4); opacity: 0; }
                        25% { opacity: 1; }
                        100% { transform: scale(2.6); opacity: 0; }
                    }
                    @keyframes constellationBurstCore {
                        0% { transform: scale(0.5); opacity: 0; }
                        20% { transform: scale(1.6); opacity: 1; }
                        60% { transform: scale(1); opacity: 1; }
                        100% { transform: scale(1); opacity: 0; }
                    }
                    @keyframes constellationSpark {
                        0% { transform: translate(0, 0) scale(0); opacity: 0; }
                        20% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    .constellation-node { transition: filter 0.18s ease-out; }
                    .constellation-node polygon { transition: stroke 0.18s ease-out, filter 0.18s ease-out; }
                    .constellation-node:hover { filter: brightness(1.18) drop-shadow(0 0 8px rgba(255,255,255,0.45)); }
                    .constellation-node:hover polygon { stroke: #ffffff; }
                    .constellation-node.is-unlocked .node-halo { animation: constellationNodePulse 2.4s ease-in-out infinite; }
                    .constellation-connector-active { stroke-dasharray: 6 4; animation: constellationConnectorFlow 1.6s linear infinite; }
                    .constellation-pop { animation: constellationFadeIn 0.22s cubic-bezier(0.22,1,0.36,1); }
                    .constellation-unlock-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.08); }
                    .constellation-unlock-btn:not(:disabled):active { transform: translateY(0) scale(0.98); }
                    @keyframes constNebulaPulse { 0%,100% { opacity:0.72; } 50% { opacity:1; } }
                    .cst-canvas-nebula { animation: constNebulaPulse 8s ease-in-out infinite; }
                    @keyframes constStarTwinkle { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
                    .cst-canvas-stars::before {
                        content:'';
                        position:absolute; inset:0; border-radius:inherit; pointer-events:none;
                        background-image:
                            radial-gradient(circle at 8% 14%, rgba(255,255,255,0.92) 1.2px, transparent 2.3px),
                            radial-gradient(circle at 74% 21%, rgba(255,255,255,0.88) 1.1px, transparent 2.1px),
                            radial-gradient(circle at 41% 7%,  rgba(255,255,255,0.95) 1.3px, transparent 2.5px),
                            radial-gradient(circle at 87% 64%, rgba(255,255,255,0.85) 1.0px, transparent 1.9px),
                            radial-gradient(circle at 23% 77%, rgba(255,255,255,0.90) 1.2px, transparent 2.3px),
                            radial-gradient(circle at 55% 47%, rgba(220,225,255,0.88) 1.1px, transparent 2.1px),
                            radial-gradient(circle at 36% 31%, rgba(255,255,255,0.82) 1.0px, transparent 1.9px),
                            radial-gradient(circle at 63% 88%, rgba(255,255,255,0.86) 1.1px, transparent 2.1px),
                            radial-gradient(circle at 16% 36%, rgba(255,255,255,0.72) 0.8px, transparent 1.7px),
                            radial-gradient(circle at 31% 54%, rgba(255,255,255,0.68) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 49% 71%, rgba(200,210,255,0.70) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 66% 16%, rgba(255,255,255,0.75) 0.8px, transparent 1.7px),
                            radial-gradient(circle at 81% 41%, rgba(255,255,255,0.65) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 93% 29%, rgba(255,255,255,0.70) 0.8px, transparent 1.7px),
                            radial-gradient(circle at 9%  56%, rgba(255,255,255,0.68) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 26% 16%, rgba(255,250,220,0.72) 0.8px, transparent 1.7px),
                            radial-gradient(circle at 53% 91%, rgba(255,255,255,0.62) 0.6px, transparent 1.3px),
                            radial-gradient(circle at 79% 79%, rgba(220,225,255,0.68) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 13% 89%, rgba(255,255,255,0.62) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 69% 56%, rgba(255,255,255,0.70) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 46% 23%, rgba(255,255,255,0.66) 0.6px, transparent 1.3px),
                            radial-gradient(circle at 91% 83%, rgba(255,255,255,0.60) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 4%  31%, rgba(255,255,255,0.65) 0.6px, transparent 1.3px),
                            radial-gradient(circle at 19% 61%, rgba(255,255,255,0.45) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 33% 41%, rgba(255,255,255,0.42) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 59% 26%, rgba(255,255,255,0.48) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 71% 69%, rgba(200,210,255,0.45) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 86% 13%, rgba(255,255,255,0.50) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 41% 86%, rgba(255,255,255,0.40) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 11% 73%, rgba(255,255,255,0.44) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 61% 43%, rgba(255,255,255,0.46) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 29% 93%, rgba(255,255,255,0.38) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 96% 56%, rgba(255,255,255,0.42) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 21% 29%, rgba(255,255,255,0.44) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 51% 61%, rgba(210,220,255,0.40) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 73% 36%, rgba(255,255,255,0.45) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 39% 49%, rgba(255,255,255,0.42) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 83% 86%, rgba(255,255,255,0.38) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 7%  43%, rgba(255,255,255,0.44) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 23% 11%, rgba(255,255,255,0.30) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 37% 66%, rgba(255,255,255,0.28) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 56% 16%, rgba(255,255,255,0.32) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 76% 49%, rgba(255,255,255,0.28) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 91% 11%, rgba(255,255,255,0.30) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 6%  26%, rgba(255,255,255,0.26) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 46% 96%, rgba(255,255,255,0.28) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 81% 63%, rgba(255,255,255,0.30) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 15% 41%, rgba(255,255,255,0.26) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 63% 31%, rgba(220,225,255,0.28) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 29% 76%, rgba(255,255,255,0.26) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 96% 36%, rgba(255,255,255,0.30) 0.4px, transparent 0.8px),
                            radial-gradient(circle at 43% 16%, rgba(255,255,255,0.28) 0.4px, transparent 0.8px);
                    }
                    .cst-canvas-stars::after {
                        content:'';
                        position:absolute; inset:0; border-radius:inherit; pointer-events:none;
                        background-image:
                            radial-gradient(circle at 8% 14%, rgba(255,255,255,0.92) 1.2px, transparent 2.3px),
                            radial-gradient(circle at 41% 7%,  rgba(255,255,255,0.95) 1.3px, transparent 2.5px),
                            radial-gradient(circle at 55% 47%, rgba(220,225,255,0.88) 1.1px, transparent 2.1px),
                            radial-gradient(circle at 66% 16%, rgba(255,255,255,0.75) 0.8px, transparent 1.7px),
                            radial-gradient(circle at 31% 54%, rgba(255,255,255,0.68) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 79% 79%, rgba(220,225,255,0.68) 0.7px, transparent 1.5px),
                            radial-gradient(circle at 86% 13%, rgba(255,255,255,0.50) 0.5px, transparent 1.0px),
                            radial-gradient(circle at 73% 36%, rgba(255,255,255,0.45) 0.5px, transparent 1.0px);
                        animation: constStarTwinkle 3.5s ease-in-out infinite;
                        animation-delay: -1.8s;
                    }
                    /* ── responsive shell: bottom-sheet (mobile) / centered modal (desktop) ── */
                    .constellation-panel { border-radius: 24px 24px 0 0; height: 88dvh; max-height: 88dvh; animation: constellationSheetIn 0.36s cubic-bezier(0.22,1,0.36,1) both; }
                    .constellation-panel--closing { animation: constellationSheetOut 0.28s cubic-bezier(0.4,0,1,1) both; }
                    @keyframes constellationSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
                    @keyframes constellationSheetOut { from { transform: translateY(0); } to { transform: translateY(100%); } }
                    @media (min-width: 1024px) {
                        .constellation-panel { border-radius: 22px; height: 90dvh; max-height: 90dvh; max-width: 640px; width: 100%; animation: constellationModalIn 0.28s cubic-bezier(0.22,1,0.36,1) both; }
                        .constellation-panel--closing { animation: constellationModalOut 0.28s cubic-bezier(0.22,1,0.36,1) both; }
                    }
                `}</style>
                {/* ── BANNER HEADER ── */}
                <div className="relative shrink-0 rounded-t-[24px] sm:rounded-t-[22px] overflow-hidden" style={{ height: 148 }}>
                    {/* BG image */}
                    <div className="absolute inset-0"
                        style={{ backgroundImage: `url(${BANNER_CONSTELLATION_URL})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    {/* Dark overlay */}
                    <div className="absolute inset-0"
                        style={{ background: 'linear-gradient(180deg, rgba(4,4,14,0.55) 0%, rgba(4,4,14,0.78) 100%)' }} />
                    {/* Bottom fade to panel */}
                    <div className="absolute bottom-0 inset-x-0 h-16"
                        style={{ background: 'linear-gradient(0deg, rgba(10,12,22,0.95) 0%, transparent 100%)' }} />
                    {/* Drag handle — mobile only */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/25 lg:hidden" />
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        aria-label="Fechar"
                        style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            zIndex: 30,
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.18)',
                            background: 'rgba(10,12,22,0.6)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            color: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        }}
                    >
                        <X size={18} />
                    </button>
                    {/* Title row — bottom-left */}
                    <div style={{ position: 'absolute', bottom: 12, left: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `linear-gradient(140deg, ${classColor}55, ${classTertiary}33)`,
                                border: '1.5px solid rgba(255,255,255,0.7)',
                                boxShadow: '0 0 10px rgba(255,255,255,0.15)',
                            }}
                        >
                            <img src={CONSTELLATION_ICON_URL} alt="Constelacao" style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(148,163,184,0.9)', lineHeight: 1, marginBottom: 3 }}>
                                Constelações de Evolução
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: classColor, letterSpacing: 0.4, textShadow: `0 2px 10px ${classColor}66`, lineHeight: 1.1 }}>
                                {constellation.name}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Points & reset bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderBottom: `1px solid ${classColor}22`,
                    flexShrink: 0,
                    flexWrap: 'wrap',
                    rowGap: 6,
                }}>
                    {/* Left: constellation name badge + progress */}
                    <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{
                            padding: '3px 10px',
                            borderRadius: 8,
                            background: `${classColor}1e`,
                            border: `1px solid ${classColor}44`,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: 0.8,
                            color: classColor,
                            whiteSpace: 'nowrap',
                            textShadow: `0 0 8px ${classColor}55`,
                            flexShrink: 0,
                        }}>
                            {constellation.name}
                        </div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {totalUnlocked} / {totalNodes} desbloqueados
                        </div>
                    </div>
                    {/* Right: points counter + reset button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 11px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                            <Sparkles size={13} color={classColor} />
                            <div style={{ fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, lineHeight: 1 }}>Pts</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>{availablePoints}</div>
                        </div>
                        <button
                            onClick={() => {
                                if (totalUnlocked === 0) return;
                                if (confirmReset) {
                                    onResetTalents();
                                    setConfirmReset(false);
                                    setSelectedNodeId(null);
                                } else {
                                    setConfirmReset(true);
                                    window.setTimeout(() => setConfirmReset(false), 2500);
                                }
                            }}
                            disabled={totalUnlocked === 0}
                            style={{
                                padding: '7px 12px',
                                borderRadius: 8,
                                border: `1px solid ${confirmReset ? '#f87171aa' : 'rgba(255,255,255,0.12)'}`,
                                background: confirmReset ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.04)',
                                color: confirmReset ? '#fca5a5' : '#cbd5e1',
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: 0.4,
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: totalUnlocked === 0 ? 'not-allowed' : 'pointer',
                                opacity: totalUnlocked === 0 ? 0.5 : 1,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <RefreshCw size={13} />
                            {confirmReset ? 'Confirmar' : 'Redistribuir'}
                        </button>
                    </div>
                </div>

                {/* Body: tree canvas — fills all remaining space */}
                <div
                    style={{
                        flex: 1,
                        overflow: 'hidden',
                        position: 'relative',
                        minHeight: 0,
                    }}
                >
                    {/* SVG tree (zoom + pan) */}
                    <div
                        ref={canvasRef}
                        className="cst-canvas-stars"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            borderRadius: '0 0 24px 24px',
                            background: `radial-gradient(ellipse at 28% 60%, ${classColor}1a 0%, transparent 50%), radial-gradient(ellipse at 75% 30%, ${classTertiary}14 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.08), transparent 60%), linear-gradient(160deg, #04030e 0%, #060415 40%, #03020a 100%)`,
                            border: '1px solid rgba(255,255,255,0.06)',
                            cursor: dragStateRef.current?.moved ? 'grabbing' : 'grab',
                            touchAction: 'none',
                            userSelect: 'none',
                        }}
                    >
                        {/* ── Trail pills + total overlay ── */}
                        <div style={{
                            position: 'absolute',
                            top: 10,
                            left: 0,
                            right: 0,
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            pointerEvents: 'none',
                        }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', padding: '0 12px' }}>
                                {trails.map((trail) => {
                                    const count = trail.nodes.filter((n) => unlockedSet.has(n.id)).length;
                                    return (
                                        <div key={trail.id} style={{
                                            padding: '4px 10px',
                                            borderRadius: 99,
                                            background: `${trail.color}22`,
                                            border: `1px solid ${trail.color}55`,
                                            backdropFilter: 'blur(6px)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                        }}>
                                            <span style={{ width: 7, height: 7, borderRadius: 99, background: trail.color, boxShadow: `0 0 8px ${trail.color}`, flexShrink: 0 }} />
                                            <span style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: 0.2 }}>{trail.name}</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: trail.color }}>{count}/{trail.nodes.length}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>
                                {totalUnlocked} / {totalNodes} nós liberados
                            </div>
                        </div>

                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                                transformOrigin: '50% 50%',
                                transition: dragStateRef.current ? 'none' : 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                            }}
                        >
                    <svg
                        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'block',
                        }}
                    >
                        <defs>
                            <radialGradient id="originGlow" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={classColor} stopOpacity="0.7" />
                                <stop offset="100%" stopColor={classColor} stopOpacity="0" />
                            </radialGradient>
                        </defs>

                        {/* connectors origin → stage 1 (each trail) */}
                        {trails.map((trail, ti) => {
                            const stage1Node = trail.nodes.find((n) => n.stage === 1);
                            if (!stage1Node) return null;
                            const x = TRAIL_X[ti];
                            const y = stageY(1);
                            const active = unlockedSet.has(stage1Node.id);
                            return renderConnector(
                                `origin-${trail.id}`,
                                VIEW_W / 2,
                                ORIGIN_Y,
                                x,
                                y,
                                trail.color,
                                active,
                            );
                        })}

                        {/* connectors stage→stage+1 within each trail */}
                        {trails.map((trail, ti) => {
                            const x = TRAIL_X[ti];
                            const lines: React.ReactNode[] = [];
                            for (let s = 1; s < 7; s += 1) {
                                const a = trail.nodes.find((n) => n.stage === s);
                                const b = trail.nodes.find((n) => n.stage === s + 1);
                                if (!a || !b) continue;
                                const active = unlockedSet.has(a.id) && unlockedSet.has(b.id);
                                lines.push(
                                    renderConnector(
                                        `v-${trail.id}-${s}`,
                                        x,
                                        stageY(s),
                                        x,
                                        stageY(s + 1),
                                        trail.color,
                                        active,
                                    ),
                                );
                            }
                            return <g key={`vlines-${trail.id}`}>{lines}</g>;
                        })}

                        {/* origin orb */}
                        <circle cx={VIEW_W / 2} cy={ORIGIN_Y} r={36} fill="url(#originGlow)" />
                        <circle
                            cx={VIEW_W / 2}
                            cy={ORIGIN_Y}
                            r={22}
                            fill={`${classColor}33`}
                            stroke={classColor}
                            strokeWidth={2}
                        />
                        <foreignObject x={VIEW_W / 2 - 14} y={ORIGIN_Y - 14} width={28} height={28}>
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Orbit size={20} color={classColor} strokeWidth={2.4} />
                            </div>
                        </foreignObject>

                        {/* nodes */}
                        {trails.map((trail, ti) =>
                            trail.nodes.map((node) => {
                                const x = TRAIL_X[ti];
                                const y = stageY(node.stage ?? 1);
                                return renderNode(node, trail, x, y);
                            }),
                        )}

                        {/* unlock animation overlay -------------------- */}
                        {unlockAnim && (() => {
                            const { targetX, targetY, color } = unlockAnim;
                            const originX = VIEW_W / 2;
                            // beam path: origin orb → trail base → up to target node
                            const baseY = stageY(1);
                            const beamD = `M ${originX} ${ORIGIN_Y} L ${targetX} ${baseY} L ${targetX} ${targetY}`;
                            return (
                                <g style={{ pointerEvents: 'none' }}>
                                    {/* glowing beam */}
                                    <path
                                        d={beamD}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={4}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray="1000"
                                        style={{
                                            filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color}88)`,
                                            animation: 'constellationBeamDraw 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
                                        }}
                                    />
                                    {/* outer halo blooming on the target */}
                                    <circle
                                        cx={targetX}
                                        cy={targetY}
                                        r={50}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={3}
                                        opacity={0}
                                        style={{
                                            transformBox: 'fill-box',
                                            transformOrigin: 'center',
                                            animation: 'constellationBurst 0.85s cubic-bezier(0.16,1,0.3,1) 0.45s forwards',
                                            filter: `drop-shadow(0 0 14px ${color})`,
                                        }}
                                    />
                                    <circle
                                        cx={targetX}
                                        cy={targetY}
                                        r={32}
                                        fill={color}
                                        opacity={0}
                                        style={{
                                            transformBox: 'fill-box',
                                            transformOrigin: 'center',
                                            animation: 'constellationBurstCore 0.7s cubic-bezier(0.16,1,0.3,1) 0.45s forwards',
                                            filter: `drop-shadow(0 0 22px ${color})`,
                                            mixBlendMode: 'screen',
                                        }}
                                    />
                                    {/* radial sparks */}
                                    {[0, 60, 120, 180, 240, 300].map((angle) => {
                                        const rad = (angle * Math.PI) / 180;
                                        const dx = Math.cos(rad) * 38;
                                        const dy = Math.sin(rad) * 38;
                                        return (
                                            <circle
                                                key={angle}
                                                cx={targetX}
                                                cy={targetY}
                                                r={4}
                                                fill="#ffffff"
                                                opacity={0}
                                                style={{
                                                    transformBox: 'fill-box',
                                                    transformOrigin: 'center',
                                                    animation: `constellationSpark 0.65s ease-out 0.5s forwards`,
                                                    transform: `translate(${dx}px, ${dy}px)`,
                                                    filter: `drop-shadow(0 0 6px ${color})`,
                                                }}
                                            />
                                        );
                                    })}
                                </g>
                            );
                        })()}
                    </svg>
                        </div>
                    </div>
                </div>

                {renderNodeDetailPopup()}
            </div>
        </div>
    );
};

export default ConstellationEvolutionModal;
