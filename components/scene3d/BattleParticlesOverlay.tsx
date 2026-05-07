/**
 * BattleParticlesOverlay
 * ─────────────────────
 * PixiJS v8 fullscreen overlay that renders 2D particle bursts during battle:
 *   • Crit hit  → gold/amber radial explosion
 *   • Skill use → violet/magenta drift burst
 *   • Enemy death → red/white downward explosion
 *
 * Uses @pixi/react 8.x (Application + extend + useTick).
 * Mounts as an absolute overlay over the battle canvas (pointer-events: none).
 */
import React, { useEffect, useRef } from 'react';
import { Application, extend, useTick } from '@pixi/react';
import { Application as PixiApplication, Container, Graphics, Ticker } from 'pixi.js';
import type { FloatingText } from '../../types';
import { useBattleVfxStore } from '../../game/stores/battleVfxStore';

// ── Register PixiJS components used via JSX ────────────────────────────────
extend({ Container, Graphics });

// ── Internal types ─────────────────────────────────────────────────────────
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    radius: number;
    color: number;
    gravity: number;
}

// ── Shared particle pool (singleton per app instance) ─────────────────────
const makeParticles = (): Particle[] => [];

// ── Screen position helpers ────────────────────────────────────────────────
// Mirror constants from FloatingTextOverlay: enemy 72%/33%, player 28%/37%
const screenPos = (target: 'player' | 'enemy') => ({
    x: (target === 'enemy' ? 0.72 : 0.28) * window.innerWidth,
    y: (target === 'enemy' ? 0.33 : 0.37) * window.innerHeight,
});

// ── Spawn helpers ──────────────────────────────────────────────────────────
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function spawnCritBurst(particles: Particle[], x: number, y: number) {
    const count = 28;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
        const speed = rand(120, 280);
        // Gold/amber palette
        const colors = [0xfbbf24, 0xf59e0b, 0xfde68a, 0xffd700, 0xffa500];
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: rand(0.35, 0.65),
            maxLife: rand(0.35, 0.65),
            radius: rand(2.5, 6),
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity: 80,
        });
    }
}

function spawnMagicBurst(particles: Particle[], x: number, y: number) {
    const count = 22;
    for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(60, 160);
        // Violet/magenta palette
        const colors = [0xc026d3, 0xa21caf, 0xe879f9, 0x8b5cf6, 0xd946ef];
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - rand(20, 80), // slight upward bias
            life: rand(0.55, 0.95),
            maxLife: rand(0.55, 0.95),
            radius: rand(3, 7),
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity: 40,
        });
    }
}

function spawnDeathBurst(particles: Particle[], x: number, y: number) {
    const count = 35;
    for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(80, 240);
        // Dark red + white palette
        const colors = [0xef4444, 0xb91c1c, 0xfca5a5, 0xffffff, 0xdc2626];
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed + rand(30, 120), // downward bias
            life: rand(0.45, 0.85),
            maxLife: rand(0.45, 0.85),
            radius: rand(2, 7),
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity: 180,
        });
    }
}

// ── Inner PixiJS scene that runs the simulation ────────────────────────────
interface ParticleSceneProps {
    particlesRef: React.MutableRefObject<Particle[]>;
}

const ParticleScene: React.FC<ParticleSceneProps> = ({ particlesRef }) => {
    const gfxRef = useRef<Graphics | null>(null);

    useTick((ticker: Ticker) => {
        const dt = ticker.deltaMS / 1000; // seconds
        const particles = particlesRef.current;
        const gfx = gfxRef.current;
        if (!gfx) return;

        // Advance physics
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
        }

        // Redraw all
        gfx.clear();
        for (const p of particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            gfx.circle(p.x, p.y, p.radius * alpha);
            gfx.fill({ color: p.color, alpha });
        }
    });

    return <pixiGraphics ref={gfxRef} />;
};

// ── Public component ───────────────────────────────────────────────────────
interface BattleParticlesOverlayProps {
    enemyDeathToken?: number;
}

export const BattleParticlesOverlay: React.FC<BattleParticlesOverlayProps> = ({
    enemyDeathToken = 0,
}) => {
    const particlesRef = useRef<Particle[]>(makeParticles());
    const prevTextsLenRef = useRef(0);
    const prevDeathTokenRef = useRef(enemyDeathToken);
    // Stable memoized props — prevent new object references causing @pixi/react prop diffs
    const appStyle = useRef({ width: '100%', height: '100%' }).current;
    const appWidth = useRef(window.innerWidth).current;
    const appHeight = useRef(window.innerHeight).current;

    // Cap PixiJS ticker to 30fps — prevents it competing with Three.js at 60fps
    useEffect(() => {
        Ticker.shared.maxFPS = 30;
        return () => { Ticker.shared.maxFPS = 0; };
    }, []);

    // Subscribe to floatingTexts OUTSIDE React render cycle — no re-renders on text spawn/prune
    useEffect(() => {
        const unsub = useBattleVfxStore.subscribe((state, prevState) => {
            const curr = state.floatingTexts;
            const prev = prevState.floatingTexts;
            if (curr === prev || curr.length <= prev.length) return;
            const newEntries = curr.slice(prev.length);
            prevTextsLenRef.current = curr.length;
            for (const t of newEntries) {
                const pos = screenPos(t.target);
                if (t.type === 'crit') {
                    spawnCritBurst(particlesRef.current, pos.x, pos.y);
                } else if (t.type === 'skill') {
                    spawnMagicBurst(particlesRef.current, pos.x, pos.y);
                }
            }
        });
        return unsub;
    }, []);

    // Detect enemy death
    useEffect(() => {
        if (enemyDeathToken === prevDeathTokenRef.current) return;
        prevDeathTokenRef.current = enemyDeathToken;
        if (enemyDeathToken <= 0) return;
        const pos = screenPos('enemy');
        spawnDeathBurst(particlesRef.current, pos.x, pos.y);
    }, [enemyDeathToken]);

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 45,
            }}
        >
            <Application
                width={appWidth}
                height={appHeight}
                backgroundAlpha={0}
                antialias={false}
                style={appStyle}
            >
                <pixiContainer>
                    <ParticleScene particlesRef={particlesRef} />
                </pixiContainer>
            </Application>
        </div>
    );
};
