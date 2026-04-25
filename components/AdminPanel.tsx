/**
 * AdminPanel — painel de testes acessível via ?admin=true na URL.
 * Permite alterar parâmetros do jogo em tempo real para facilitar QA.
 */
import React, { useState } from 'react';
import { X, ChevronUp, ChevronDown, Settings } from 'lucide-react';
import { Player, Item } from '../types';
import { ALL_ITEMS } from '../constants';

export interface AdminPanelProps {
  player: Player;
  stage: number;
  dungeonEvolution: number;
  towerEssence: number;

  onSetLevel: (level: number) => void;
  onSetStage: (stage: number) => void;
  onSetDungeonEvolution: (evo: number) => void;
  onAddGold: (amount: number) => void;
  onAddDiamonds: (amount: number) => void;
  onAddEssence: (amount: number) => void;
  onForceEquip: (item: Item) => void;
}

const BTN = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => {
  const { label, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        padding: '4px 10px',
        background: '#1e293b',
        border: '1px solid #475569',
        borderRadius: 5,
        color: '#e2e8f0',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        ...rest.style,
      }}
    >
      {label}
    </button>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <span style={{ width: 130, fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{label}</span>
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
  </div>
);

const ITEM_CATEGORIES: { label: string; filter: (i: Item) => boolean }[] = [
  { label: 'Armas', filter: (i) => i.type === 'weapon' },
  { label: 'Armaduras', filter: (i) => i.type === 'armor' },
  { label: 'Capacetes', filter: (i) => i.type === 'helmet' },
  { label: 'Pernas', filter: (i) => i.type === 'legs' },
  { label: 'Escudos', filter: (i) => i.type === 'shield' },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  player,
  stage,
  dungeonEvolution,
  towerEssence,
  onSetLevel,
  onSetStage,
  onSetDungeonEvolution,
  onAddGold,
  onAddDiamonds,
  onAddEssence,
  onForceEquip,
}) => {
  const [open, setOpen] = useState(false);
  const [itemCategory, setItemCategory] = useState(0);

  const items = ALL_ITEMS.filter(ITEM_CATEGORIES[itemCategory].filter);

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 16,
    left: 16,
    zIndex: 9999,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: -6,
    right: -6,
    background: '#ef4444',
    color: '#fff',
    borderRadius: '50%',
    width: 16,
    height: 16,
    fontSize: 9,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const triggerStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(15,23,42,0.92)',
    border: '2px solid #f59e0b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 12px #f59e0b66',
    position: 'relative',
  };

  const modalStyle: React.CSSProperties = {
    width: 340,
    background: 'rgba(15,23,42,0.97)',
    backdropFilter: 'blur(20px)',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
    marginBottom: 8,
    maxHeight: '80vh',
    overflowY: 'auto',
  };

  return (
    <div style={panelStyle}>
      {open && (
        <div style={modalStyle}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b', letterSpacing: 1 }}>⚙ ADMIN PANEL</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={16} />
            </button>
          </div>

          {/* Status */}
          <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            <span>Nv <b style={{ color: '#e2e8f0' }}>{player.level}</b></span>
            <span>Fase <b style={{ color: '#e2e8f0' }}>{stage}</b></span>
            <span>Dungeon <b style={{ color: '#e2e8f0' }}>{dungeonEvolution}</b></span>
            <span>Ouro <b style={{ color: '#fbbf24' }}>{player.gold}</b></span>
            <span>Diamantes <b style={{ color: '#67e8f9' }}>{player.diamonds}</b></span>
            <span>Essência <b style={{ color: '#a78bfa' }}>{towerEssence}</b></span>
          </div>

          {/* Nível do herói */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Herói</div>
            <Row label={`Nível (${player.level})`}>
              {[1, 3, 5, 8, 10, 12, 15, 20].map(lvl => (
                <BTN key={lvl} label={`${lvl}`} onClick={() => onSetLevel(lvl)}
                  style={player.level === lvl ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}} />
              ))}
            </Row>
            <Row label="Nível custom">
              <input
                type="number" min={1} max={99}
                defaultValue={player.level}
                style={{ width: 60, padding: '3px 6px', background: '#1e293b', border: '1px solid #475569', borderRadius: 5, color: '#e2e8f0', fontSize: 12 }}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (v >= 1 && v <= 99) onSetLevel(v);
                }}
              />
            </Row>
          </div>

          {/* Fases */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Fases</div>
            <Row label={`Caça (${stage})`}>
              {[1, 3, 5, 8, 10, 15, 20].map(s => (
                <BTN key={s} label={`${s}`} onClick={() => onSetStage(s)}
                  style={stage === s ? { borderColor: '#38bdf8', color: '#38bdf8' } : {}} />
              ))}
            </Row>
            <Row label={`Dungeon (${dungeonEvolution})`}>
              {[0, 1, 2, 3, 4, 5].map(d => (
                <BTN key={d} label={`${d}`} onClick={() => onSetDungeonEvolution(d)}
                  style={dungeonEvolution === d ? { borderColor: '#38bdf8', color: '#38bdf8' } : {}} />
              ))}
            </Row>
          </div>

          {/* Recursos */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Recursos</div>
            <Row label="Ouro">
              {[500, 2000, 10000, 50000].map(a => (
                <BTN key={a} label={`+${a}`} onClick={() => onAddGold(a)} />
              ))}
            </Row>
            <Row label="Diamantes">
              {[5, 20, 100].map(a => (
                <BTN key={a} label={`+${a}`} onClick={() => onAddDiamonds(a)} />
              ))}
            </Row>
            <Row label="Essência">
              {[50, 200, 1000].map(a => (
                <BTN key={a} label={`+${a}`} onClick={() => onAddEssence(a)} />
              ))}
            </Row>
          </div>

          {/* Equipamentos */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Equipar Item da Loja</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {ITEM_CATEGORIES.map((cat, idx) => (
                <button key={cat.label} onClick={() => setItemCategory(idx)}
                  style={{
                    padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    background: itemCategory === idx ? '#312e81' : '#1e293b',
                    border: `1px solid ${itemCategory === idx ? '#a78bfa' : '#475569'}`,
                    color: itemCategory === idx ? '#a78bfa' : '#94a3b8',
                  }}>
                  {cat.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
              {items.map(item => (
                <button key={item.id} onClick={() => onForceEquip(item)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 8px', background: '#1e293b', border: '1px solid #334155',
                    borderRadius: 6, cursor: 'pointer', color: '#e2e8f0', fontSize: 11,
                    textAlign: 'left',
                  }}>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: item.rarity === 'gold' ? '#78350f' : item.rarity === 'silver' ? '#1e3a5f' : '#431407',
                    color: item.rarity === 'gold' ? '#fbbf24' : item.rarity === 'silver' ? '#7dd3fc' : '#fb923c',
                  }}>
                    {item.rarity} • {item.name.includes('+') ? item.name : `Nv${item.minLevel}`}
                  </span>
                </button>
              ))}
              {items.length === 0 && <span style={{ color: '#64748b', fontSize: 11 }}>Nenhum item.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <div style={triggerStyle} onClick={() => setOpen(v => !v)}>
        <Settings size={20} color="#f59e0b" />
        <span style={badgeStyle}>A</span>
      </div>
    </div>
  );
};
