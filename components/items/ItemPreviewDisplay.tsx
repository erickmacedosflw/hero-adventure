import React from 'react';
import type { Item } from '../../types';

type TonePalette = {
  bg: string;
  orb: string;
  glow: string;
  edge: string;
  accent: string;
  accentSoft: string;
  metal: string;
  shadow: string;
};

const getRarityColors = (rarity: Item['rarity']) => {
  switch (rarity) {
    case 'gold':
      return {
        border: 'rgba(245, 195, 75, 0.9)',
        glow: 'rgba(255, 205, 96, 0.45)',
        badge: 'linear-gradient(135deg, rgba(255, 220, 120, 0.95), rgba(180, 118, 18, 0.95))',
        text: '#fff2c2',
        chip: 'rgba(107, 74, 15, 0.55)',
      };
    case 'silver':
      return {
        border: 'rgba(181, 194, 211, 0.88)',
        glow: 'rgba(173, 203, 255, 0.28)',
        badge: 'linear-gradient(135deg, rgba(225, 233, 245, 0.92), rgba(93, 113, 140, 0.92))',
        text: '#f3f7ff',
        chip: 'rgba(67, 84, 108, 0.48)',
      };
    default:
      return {
        border: 'rgba(180, 102, 58, 0.85)',
        glow: 'rgba(242, 135, 66, 0.2)',
        badge: 'linear-gradient(135deg, rgba(210, 129, 71, 0.92), rgba(90, 48, 26, 0.92))',
        text: '#ffe1d2',
        chip: 'rgba(95, 51, 28, 0.46)',
      };
  }
};

const getTypePalette = (item: Item): TonePalette => {
  if (item.type === 'weapon') {
    if (item.id.includes('g')) {
      return {
        bg: '#09111f',
        orb: '#3e1f7f',
        glow: '#8a63ff',
        edge: '#d7c6ff',
        accent: '#74f2ff',
        accentSoft: '#1c6f91',
        metal: '#f1f5ff',
        shadow: '#080d18',
      };
    }
    if (item.id.includes('s')) {
      return {
        bg: '#0b1320',
        orb: '#173c68',
        glow: '#53c0ff',
        edge: '#d6edff',
        accent: '#6be0ff',
        accentSoft: '#225c92',
        metal: '#ecf5ff',
        shadow: '#08111a',
      };
    }
    return {
      bg: '#170f0b',
      orb: '#5e2b16',
      glow: '#ff9251',
      edge: '#ffe0c7',
      accent: '#ffb866',
      accentSoft: '#7f3e20',
      metal: '#fff4e8',
      shadow: '#120905',
    };
  }

  if (item.type === 'shield') {
    return {
      bg: '#0d1420',
      orb: '#24476b',
      glow: '#5cc8ff',
      edge: '#d9f3ff',
      accent: '#ffe08c',
      accentSoft: '#816219',
      metal: '#eef7ff',
      shadow: '#090f17',
    };
  }

  if (item.type === 'helmet') {
    return {
      bg: '#150f1d',
      orb: '#4e2d78',
      glow: '#d38bff',
      edge: '#f4dcff',
      accent: '#ffcb67',
      accentSoft: '#7b5418',
      metal: '#f8f0ff',
      shadow: '#0e0a14',
    };
  }

  if (item.type === 'armor') {
    return {
      bg: '#0b1620',
      orb: '#16485a',
      glow: '#51e5da',
      edge: '#d6fffb',
      accent: '#84b7ff',
      accentSoft: '#234b7f',
      metal: '#efffff',
      shadow: '#091017',
    };
  }

  if (item.type === 'legs') {
    return {
      bg: '#16150c',
      orb: '#5d5721',
      glow: '#f1c85f',
      edge: '#fff2cc',
      accent: '#cfe386',
      accentSoft: '#617621',
      metal: '#fff9ea',
      shadow: '#0f0d08',
    };
  }

  if (item.type === 'potion') {
    return {
      bg: '#120d1e',
      orb: '#3f2365',
      glow: '#ff6ad5',
      edge: '#ffe6fb',
      accent: '#75f0ff',
      accentSoft: '#1d6076',
      metal: '#f6f0ff',
      shadow: '#0d0914',
    };
  }

  return {
    bg: '#11140f',
    orb: '#355030',
    glow: '#9fe870',
    edge: '#efffdc',
    accent: '#89d8ff',
    accentSoft: '#27506a',
    metal: '#f4fff1',
    shadow: '#0b0d09',
  };
};

const getPotionLiquid = (itemId: string) => {
  if (itemId === 'pot_1') return '#ef4444';
  if (itemId === 'pot_2') return '#3b82f6';
  if (itemId === 'pot_atk') return '#f97316';
  if (itemId === 'pot_def') return '#22c55e';
  if (itemId === 'pot_3') return '#d946ef';
  if (itemId === 'pot_4') return '#fbbf24';
  return '#60a5fa';
};

const getItemLabel = (type: Item['type']) => {
  if (type === 'weapon') return 'Weapon';
  if (type === 'shield') return 'Shield';
  if (type === 'helmet') return 'Helmet';
  if (type === 'armor') return 'Armor';
  if (type === 'legs') return 'Legs';
  if (type === 'potion') return 'Potion';
  return 'Material';
};

const getItemGlyph = (type: Item['type']) => {
  if (type === 'weapon') return 'W';
  if (type === 'shield') return 'S';
  if (type === 'helmet') return 'H';
  if (type === 'armor') return 'A';
  if (type === 'legs') return 'L';
  if (type === 'potion') return 'P';
  return 'M';
};

const renderWeapon = (item: Item, palette: TonePalette) => {
  const sharedStroke = { stroke: palette.edge, strokeWidth: 8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

  if (item.id.includes('b2')) {
    return (
      <g transform="translate(88 30) rotate(-18 92 140)">
        <rect x="118" y="36" width="22" height="92" rx="8" fill={palette.metal} {...sharedStroke} />
        <path d="M84 46 L158 24 L170 68 L108 96 Z" fill={palette.accent} {...sharedStroke} />
        <path d="M72 78 L162 48" stroke={palette.accentSoft} strokeWidth="10" strokeLinecap="round" />
        <rect x="112" y="124" width="34" height="18" rx="8" fill={palette.accent} {...sharedStroke} />
        <rect x="119" y="140" width="20" height="112" rx="9" fill="#5b341c" {...sharedStroke} />
        <circle cx="129" cy="258" r="12" fill={palette.accent} {...sharedStroke} />
      </g>
    );
  }

  if (item.id.includes('s2') || item.id.includes('g2')) {
    return (
      <g transform="translate(88 18) rotate(12 88 146)">
        <path d="M118 20 L142 74 L132 222 L124 222 L114 74 Z" fill={palette.metal} {...sharedStroke} />
        <path d="M122 14 L136 32 L130 44 L114 44 L108 32 Z" fill={palette.accent} {...sharedStroke} />
        <path d="M112 86 L146 86" stroke={palette.accent} strokeWidth="10" strokeLinecap="round" />
        <path d="M114 88 L86 124" stroke={palette.edge} strokeWidth="10" strokeLinecap="round" />
        <path d="M144 88 L172 124" stroke={palette.edge} strokeWidth="10" strokeLinecap="round" />
        <rect x="118" y="222" width="20" height="42" rx="8" fill="#4b2c19" {...sharedStroke} />
        <circle cx="128" cy="272" r="11" fill={palette.accent} {...sharedStroke} />
      </g>
    );
  }

  if (item.id.includes('g1')) {
    return (
      <g transform="translate(74 18) rotate(16 108 140)">
        <path d="M134 24 C152 54 156 92 128 162 C118 132 100 94 102 54 Z" fill={palette.metal} {...sharedStroke} />
        <path d="M112 40 C116 96 110 152 96 218" stroke={palette.edge} strokeWidth="11" strokeLinecap="round" />
        <path d="M98 128 L140 116" stroke={palette.accent} strokeWidth="10" strokeLinecap="round" />
        <rect x="88" y="116" width="34" height="18" rx="8" fill={palette.accentSoft} {...sharedStroke} />
        <rect x="97" y="134" width="16" height="108" rx="8" fill="#3d2316" {...sharedStroke} />
        <circle cx="105" cy="250" r="12" fill={palette.accent} {...sharedStroke} />
      </g>
    );
  }

  return (
    <g transform="translate(102 24) rotate(-10 80 132)">
      <path d="M110 20 L134 54 L126 182 L118 182 L110 54 Z" fill={palette.metal} {...sharedStroke} />
      <path d="M110 18 L122 34 L134 18" fill={palette.accent} {...sharedStroke} />
      <path d="M106 80 L138 80" stroke={palette.edge} strokeWidth="10" strokeLinecap="round" />
      <path d="M102 84 L86 100" stroke={palette.accent} strokeWidth="9" strokeLinecap="round" />
      <path d="M142 84 L158 100" stroke={palette.accent} strokeWidth="9" strokeLinecap="round" />
      <rect x="116" y="182" width="12" height="86" rx="7" fill="#53311d" {...sharedStroke} />
      <circle cx="122" cy="274" r="11" fill={palette.accent} {...sharedStroke} />
    </g>
  );
};

const renderShield = (palette: TonePalette) => (
  <g transform="translate(72 28)">
    <path d="M128 18 C172 28 208 44 208 92 C208 166 166 230 128 258 C90 230 48 166 48 92 C48 44 84 28 128 18 Z" fill={palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
    <path d="M128 40 C160 48 186 60 186 98 C186 152 156 202 128 226 C100 202 70 152 70 98 C70 60 96 48 128 40 Z" fill={palette.accentSoft} stroke={palette.accent} strokeWidth="8" strokeLinejoin="round" />
    <path d="M128 62 L146 106 L192 110 L158 140 L168 188 L128 162 L88 188 L98 140 L64 110 L110 106 Z" fill={palette.accent} stroke={palette.edge} strokeWidth="7" strokeLinejoin="round" />
    <circle cx="128" cy="128" r="20" fill={palette.edge} opacity="0.35" />
  </g>
);

const renderHelmet = (item: Item, palette: TonePalette) => (
  <g transform="translate(58 48)">
    <path d="M70 114 C70 46 116 20 154 20 C208 20 246 58 246 128 L246 150 L226 150 L212 184 L96 184 L82 150 L62 150 L62 128 Z" fill={palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
    <path d="M102 84 C120 58 146 48 174 48 C196 48 214 58 228 80" fill="none" stroke={palette.accentSoft} strokeWidth="10" strokeLinecap="round" />
    <path d="M132 80 L154 54 L176 80" fill="none" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="114" y="116" width="88" height="26" rx="13" fill={palette.bg} stroke={palette.accent} strokeWidth="8" />
    <path d="M134 142 L122 184" stroke={palette.edge} strokeWidth="8" strokeLinecap="round" />
    <path d="M182 142 L194 184" stroke={palette.edge} strokeWidth="8" strokeLinecap="round" />
    {item.id.includes('g1') && <path d="M156 4 L176 38 L156 28 L136 38 Z" fill={palette.accent} stroke={palette.edge} strokeWidth="7" strokeLinejoin="round" />}
  </g>
);

const renderArmor = (palette: TonePalette) => (
  <g transform="translate(52 42)">
    <path d="M112 26 L146 12 L180 26 L222 54 L208 92 L198 230 L114 230 L104 92 L90 54 Z" fill={palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
    <path d="M118 40 L146 66 L174 40" fill="none" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M130 78 L130 214" stroke={palette.accentSoft} strokeWidth="8" strokeLinecap="round" />
    <path d="M162 78 L162 214" stroke={palette.accentSoft} strokeWidth="8" strokeLinecap="round" />
    <path d="M104 98 L198 98" stroke={palette.edge} strokeWidth="8" strokeLinecap="round" opacity="0.8" />
    <path d="M106 144 L196 144" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" opacity="0.8" />
  </g>
);

const renderLegs = (palette: TonePalette) => (
  <g transform="translate(66 44)">
    <path d="M112 22 L160 22 L170 100 L152 236 L116 236 L102 100 Z" fill={palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
    <path d="M170 22 L218 22 L224 102 L226 212 L184 212 L176 108 Z" fill={palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
    <path d="M108 236 L166 236 L174 260 L104 260 Z" fill={palette.accentSoft} stroke={palette.accent} strokeWidth="8" strokeLinejoin="round" />
    <path d="M180 212 L240 212 L246 238 L176 238 Z" fill={palette.accentSoft} stroke={palette.accent} strokeWidth="8" strokeLinejoin="round" />
    <path d="M118 76 L158 76" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" />
    <path d="M178 74 L218 74" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" />
  </g>
);

const renderPotion = (item: Item, palette: TonePalette) => {
  const liquid = getPotionLiquid(item.id);

  return (
    <g transform="translate(86 26)">
      <path d="M126 18 L158 18 L154 56 L170 82 L170 210 C170 238 148 258 126 258 C104 258 82 238 82 210 L82 82 L98 56 Z" fill={palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
      <rect x="114" y="2" width="56" height="20" rx="10" fill={palette.accentSoft} stroke={palette.edge} strokeWidth="8" />
      <path d="M92 146 C110 136 134 140 160 126 L160 208 C160 228 146 244 126 244 C106 244 92 228 92 208 Z" fill={liquid} opacity="0.9" />
      <path d="M102 128 C118 116 138 118 156 110" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.45" />
      <circle cx="104" cy="110" r="8" fill={palette.accent} opacity="0.7" />
      <circle cx="144" cy="96" r="6" fill={palette.accent} opacity="0.45" />
    </g>
  );
};

const renderMaterial = (item: Item, palette: TonePalette) => {
  if (item.id.includes('wood')) {
    return (
      <g transform="translate(68 52) rotate(-10 122 108)">
        <rect x="74" y="98" width="124" height="68" rx="22" fill="#7a4d26" stroke={palette.edge} strokeWidth="10" />
        <path d="M100 98 L100 166" stroke="#b97d3c" strokeWidth="7" strokeLinecap="round" />
        <path d="M132 98 L132 166" stroke="#b97d3c" strokeWidth="7" strokeLinecap="round" />
        <path d="M164 98 L164 166" stroke="#b97d3c" strokeWidth="7" strokeLinecap="round" />
      </g>
    );
  }

  if (item.id.includes('bone')) {
    return (
      <g transform="translate(66 48) rotate(-18 128 128)">
        <circle cx="88" cy="110" r="24" fill={palette.metal} stroke={palette.edge} strokeWidth="9" />
        <circle cx="118" cy="96" r="18" fill={palette.metal} stroke={palette.edge} strokeWidth="8" />
        <rect x="102" y="112" width="92" height="32" rx="16" fill={palette.metal} stroke={palette.edge} strokeWidth="8" />
        <circle cx="196" cy="154" r="24" fill={palette.metal} stroke={palette.edge} strokeWidth="9" />
        <circle cx="170" cy="168" r="18" fill={palette.metal} stroke={palette.edge} strokeWidth="8" />
      </g>
    );
  }

  if (item.id.includes('cloth')) {
    return (
      <g transform="translate(78 58)">
        <path d="M64 70 C94 40 150 42 188 58 C206 90 196 142 176 190 C132 212 86 202 54 168 C40 122 44 88 64 70 Z" fill={palette.accentSoft} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
        <path d="M88 86 C112 72 146 72 174 88" fill="none" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" />
        <path d="M82 124 C110 140 146 140 178 120" fill="none" stroke={palette.edge} strokeWidth="6" strokeLinecap="round" opacity="0.8" />
      </g>
    );
  }

  if (item.id.includes('gold') || item.id.includes('iron') || item.id.includes('slime')) {
    return (
      <g transform="translate(76 44)">
        <path d="M132 20 L202 82 L166 224 L80 188 L62 90 Z" fill={item.id.includes('slime') ? '#22c55e' : palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
        <path d="M132 20 L140 126 L80 188" fill="none" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M140 126 L202 82" fill="none" stroke={palette.accentSoft} strokeWidth="8" strokeLinecap="round" />
      </g>
    );
  }

  return (
    <g transform="translate(84 48)">
      <path d="M128 30 L192 98 L164 214 L86 188 L62 90 Z" fill={palette.metal} stroke={palette.edge} strokeWidth="10" strokeLinejoin="round" />
      <path d="M128 30 L136 124 L86 188" fill="none" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M136 124 L192 98" fill="none" stroke={palette.accentSoft} strokeWidth="8" strokeLinecap="round" />
    </g>
  );
};

const renderIllustration = (item: Item, palette: TonePalette) => {
  if (item.type === 'weapon') return renderWeapon(item, palette);
  if (item.type === 'shield') return renderShield(palette);
  if (item.type === 'helmet') return renderHelmet(item, palette);
  if (item.type === 'armor') return renderArmor(palette);
  if (item.type === 'legs') return renderLegs(palette);
  if (item.type === 'potion') return renderPotion(item, palette);
  return renderMaterial(item, palette);
};

const getStatLine = (item: Item) => {
  if (item.type === 'material') return 'Crafting material';
  if (item.type === 'weapon') return `+${item.value} ATK`;
  if (item.type === 'potion') {
    if (item.id.includes('pot_atk')) return '+50% ATK for 3 turns';
    if (item.id.includes('pot_def')) return '+50% DEF for 3 turns';
    if (item.id === 'pot_2') return `Restores ${item.value} MP`;
    return `Restores ${item.value} HP`;
  }
  return `+${item.value} DEF`;
};

export const ItemPreviewDisplay = ({ item, compact = false }: { item: Item; compact?: boolean }) => {
  const previewId = React.useId().replace(/:/g, '');
  const rarity = getRarityColors(item.rarity);
  const palette = getTypePalette(item);
  const titleSize = compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl';
  const bodySize = compact ? 'text-xs' : 'text-sm';
  const chipSize = compact ? 'text-[10px] px-2.5 py-1' : 'text-xs px-3 py-1.5';
  const badgeSize = compact ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5';

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[28px] border bg-slate-950/90"
      style={{
        borderColor: rarity.border,
        boxShadow: `0 0 0 1px ${rarity.glow}, inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 70px rgba(0,0,0,0.5)`,
        background: `radial-gradient(circle at 50% 30%, ${palette.orb} 0%, ${palette.bg} 42%, #020617 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: compact ? '18px 18px' : '22px 22px' }} />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 16%, transparent 17%, transparent 50%)', backgroundSize: '100% 8px' }} />
      <div className="absolute -left-10 top-10 h-28 w-28 rounded-full blur-3xl" style={{ backgroundColor: palette.accent, opacity: 0.14 }} />
      <div className="absolute right-6 top-4 z-20 rounded-full border font-black uppercase tracking-[0.28em] shadow-xl" style={{ background: rarity.badge, borderColor: rarity.border, color: rarity.text, boxShadow: `0 0 24px ${rarity.glow}` }}>
        <div className={badgeSize}>{item.rarity}</div>
      </div>
      <div className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border text-lg font-black" style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(2, 6, 23, 0.55)', color: palette.edge, boxShadow: `0 10px 25px ${rarity.glow}` }}>
        {item.icon || getItemGlyph(item.type)}
      </div>

      <div className="relative z-10 flex h-full w-full flex-col px-5 pb-5 pt-16 sm:px-6 sm:pb-6 sm:pt-16">
        <div className="mb-3 pr-24 sm:mb-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: palette.accent }} />
            <span className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-300">Vault Preview</span>
          </div>
          <h3 className={`${titleSize} font-black leading-tight text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]`}>
            {item.name}
          </h3>
          <p className={`${bodySize} mt-2 max-w-md text-slate-300/85`}>
            {item.description}
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="absolute bottom-[16%] h-52 w-52 rounded-full blur-3xl" style={{ backgroundColor: palette.glow, opacity: 0.36 }} />
          <div className="absolute bottom-[12%] h-16 w-44 rounded-full blur-2xl" style={{ backgroundColor: palette.shadow, opacity: 0.95 }} />
          <div className="absolute bottom-[10%] h-6 w-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 72%)' }} />

          <svg className="relative z-10 h-full max-h-[360px] w-full max-w-[360px] drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]" viewBox="0 0 320 320" aria-hidden="true">
            <defs>
              <linearGradient id={`${previewId}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                <stop offset="45%" stopColor={palette.metal} stopOpacity="1" />
                <stop offset="100%" stopColor={palette.accentSoft} stopOpacity="0.95" />
              </linearGradient>
              <radialGradient id={`${previewId}-orb`} cx="50%" cy="40%" r="50%">
                <stop offset="0%" stopColor={palette.glow} stopOpacity="0.95" />
                <stop offset="65%" stopColor={palette.orb} stopOpacity="0.5" />
                <stop offset="100%" stopColor={palette.bg} stopOpacity="0" />
              </radialGradient>
            </defs>

            <circle cx="160" cy="132" r="92" fill={`url(#${previewId}-orb)`} />
            <ellipse cx="160" cy="272" rx="82" ry="14" fill="rgba(255,255,255,0.06)" />
            <g fill={`url(#${previewId}-metal)`}>{renderIllustration(item, palette)}</g>
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <div className={`rounded-full border font-bold uppercase tracking-[0.2em] text-slate-100 ${chipSize}`} style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: rarity.chip }}>
              {getItemLabel(item.type)}
            </div>
            <div className={`rounded-full border font-bold uppercase tracking-[0.2em] text-slate-100 ${chipSize}`} style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(15, 23, 42, 0.72)' }}>
              Level {item.minLevel}+
            </div>
          </div>
          <div className="rounded-2xl border px-3 py-2 text-right" style={{ borderColor: rarity.border, background: 'rgba(2, 6, 23, 0.45)', boxShadow: `0 0 20px ${rarity.glow}` }}>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Effect</div>
            <div className={`${compact ? 'text-sm' : 'text-base'} font-black`} style={{ color: rarity.text }}>
              {getStatLine(item)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};