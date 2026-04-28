import React, { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useInputMode } from '../../game/hooks/useInputMode';
import { onAction } from '../../game/mechanics/inputManager';

const PORTAL_THUMB_MOUNTAIN = new URL('../../game/assets/Scenario/Moutain/cenario_thumbnail_montanha.png', import.meta.url).href;
const PORTAL_THUMB_DUNGEON = new URL('../../game/assets/Scenario/Dungeon/cenario_thumbnail_dungeon.png', import.meta.url).href;
const PORTAL_THUMB_TOWER_3D = new URL('../../game/assets/Scenario/Tower/cenario_thumbnail_torre.png', import.meta.url).href;

export type PortalRegion = 'forest' | 'dungeon' | 'tower';

const PORTAL_DESTINATIONS: { region: PortalRegion; name: string; color: string; thumb: string }[] = [
  { region: 'forest', name: 'Montanha', color: '#b87a3a', thumb: PORTAL_THUMB_MOUNTAIN },
  { region: 'dungeon', name: 'Dungeon', color: '#4d7a96', thumb: PORTAL_THUMB_DUNGEON },
  { region: 'tower', name: 'Torre Heroica', color: '#6d28d9', thumb: PORTAL_THUMB_TOWER_3D },
];

export const PortalInspectCanvas = ({
  currentRegion = 'forest',
  dungeonUnlocked = false,
  towerUnlocked = false,
  onClose,
  onTravelTo,
}: {
  currentRegion?: PortalRegion;
  dungeonUnlocked?: boolean;
  towerUnlocked?: boolean;
  onClose: () => void;
  onTravelTo: (region: PortalRegion) => void;
}) => {
  const { viewport } = useThree();
  const isMobile = (typeof window !== 'undefined' && (window as Window & { electronBridge?: { isElectron: boolean } }).electronBridge?.isElectron)
    ? false
    : viewport.width < 9;
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };

  const panelX = -4.2;
  const panelY = isMobile ? 1.8 : 2.0;
  const distanceFactor = isMobile ? 7.5 : 6.5;

  const visibleDestinations = PORTAL_DESTINATIONS.filter((destination) => destination.region !== currentRegion);

  const { uiProfile } = useInputMode();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedIdxRef = useRef(0);
  selectedIdxRef.current = selectedIdx;

  useEffect(() => {
    if (uiProfile !== 'gamepad') {
      return;
    }

    return onAction((action) => {
      if (action === 'BACK') {
        onClose();
        return;
      }

      if (action === 'NAV_LEFT') {
        setSelectedIdx((index) => Math.max(0, index - 1));
        return;
      }

      if (action === 'NAV_RIGHT') {
        setSelectedIdx((index) => Math.min(visibleDestinations.length - 1, index + 1));
        return;
      }

      if (action === 'CONFIRM') {
        const destination = visibleDestinations[selectedIdxRef.current];
        if (!destination) {
          return;
        }

        const locked = (destination.region === 'dungeon' && !dungeonUnlocked)
          || (destination.region === 'tower' && !towerUnlocked);
        if (!locked) {
          onTravelTo(destination.region);
        }
      }
    });
  }, [dungeonUnlocked, onClose, onTravelTo, towerUnlocked, uiProfile, visibleDestinations]);

  return (
    <Html center sprite distanceFactor={distanceFactor} position={[panelX, panelY, 0.58]} zIndexRange={[210, 0]}>
      <div style={font} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {visibleDestinations.map((destination, index) => {
            const locked = (destination.region === 'dungeon' && !dungeonUnlocked)
              || (destination.region === 'tower' && !towerUnlocked);
            const isGamepadSelected = uiProfile === 'gamepad' && selectedIdx === index && !locked;

            return (
              <div
                key={destination.region}
                onClick={() => {
                  if (!locked) {
                    onTravelTo(destination.region);
                  }
                }}
                style={{
                  width: isMobile ? '120px' : '140px',
                  borderRadius: '16px',
                  background: locked ? 'rgba(0,0,0,0.25)' : `${destination.color}18`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: isGamepadSelected
                    ? `2.5px solid ${destination.color}`
                    : `1.5px solid ${locked ? 'rgba(255,255,255,0.15)' : `${destination.color}80`}`,
                  boxShadow: isGamepadSelected
                    ? `0 0 28px ${destination.color}90, 0 0 0 3px ${destination.color}40, 0 6px 24px rgba(0,0,0,0.55)`
                    : locked
                      ? 'none'
                      : `0 0 20px ${destination.color}45, 0 6px 24px rgba(0,0,0,0.55)`,
                  overflow: 'hidden',
                  cursor: locked ? 'default' : 'pointer',
                  opacity: locked ? 0.45 : 1,
                  transform: isGamepadSelected ? 'translateY(-6px) scale(1.06)' : '',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border 0.18s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(event) => {
                  if (!locked && !isGamepadSelected) {
                    event.currentTarget.style.transform = 'translateY(-5px) scale(1.05)';
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isGamepadSelected) {
                    event.currentTarget.style.transform = '';
                  }
                }}
              >
                <div style={{ width: '100%', height: isMobile ? '90px' : '106px', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={destination.thumb}
                    alt={destination.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      filter: locked ? 'grayscale(70%) brightness(0.45)' : 'brightness(0.88)',
                    }}
                  />
                  {locked && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.35)',
                        fontSize: '22px',
                      }}
                    >
                      {'\u{1F512}'}
                    </div>
                  )}
                  {!locked && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '36px',
                        background: `linear-gradient(to top, ${destination.color}70, transparent)`,
                      }}
                    />
                  )}
                </div>
                <div style={{ padding: '10px 12px 12px', textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 900,
                      color: locked ? 'rgba(255,255,255,0.35)' : destination.color,
                      lineHeight: 1.2,
                      letterSpacing: '0.04em',
                      textShadow: locked ? 'none' : `0 0 14px ${destination.color}90`,
                    }}
                  >
                    {destination.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Html>
  );
};