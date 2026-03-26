import React from 'react';

const ICONS = {
  bag: new URL('../../game/assets/Icons/Equipment/Bag.png', import.meta.url).href,
  belt: new URL('../../game/assets/Icons/Equipment/Belt.png', import.meta.url).href,
  helm: new URL('../../game/assets/Icons/Equipment/Iron Helmet.png', import.meta.url).href,
  armor: new URL('../../game/assets/Icons/Equipment/Iron Armor.png', import.meta.url).href,
  boots: new URL('../../game/assets/Icons/Equipment/Iron Boot.png', import.meta.url).href,
  book: new URL('../../game/assets/Icons/Misc/Book.png', import.meta.url).href,
  bookAlt: new URL('../../game/assets/Icons/Misc/Book 2.png', import.meta.url).href,
  scroll: new URL('../../game/assets/Icons/Misc/Scroll.png', import.meta.url).href,
  map: new URL('../../game/assets/Icons/Misc/Map.png', import.meta.url).href,
  chest: new URL('../../game/assets/Icons/Misc/Chest.png', import.meta.url).href,
  gear: new URL('../../game/assets/Icons/Misc/Gear.png', import.meta.url).href,
  heart: new URL('../../game/assets/Icons/Misc/Heart.png', import.meta.url).href,
  coin: new URL('../../game/assets/Icons/Misc/Golden Coin.png', import.meta.url).href,
  coinSilver: new URL('../../game/assets/Icons/Misc/Silver Coin.png', import.meta.url).href,
  coinCopper: new URL('../../game/assets/Icons/Misc/Copper Coin.png', import.meta.url).href,
  key: new URL('../../game/assets/Icons/Misc/Golden Key.png', import.meta.url).href,
  potionRed: new URL('../../game/assets/Icons/Potion/Red Potion.png', import.meta.url).href,
  potionBlue: new URL('../../game/assets/Icons/Potion/Blue Potion.png', import.meta.url).href,
  potionGreen: new URL('../../game/assets/Icons/Potion/Green Potion.png', import.meta.url).href,
  sword: new URL('../../game/assets/Icons/Weapon & Tool/Golden Sword.png', import.meta.url).href,
  swordIron: new URL('../../game/assets/Icons/Weapon & Tool/Iron Sword.png', import.meta.url).href,
  shield: new URL('../../game/assets/Icons/Weapon & Tool/Iron Shield.png', import.meta.url).href,
  shieldWood: new URL('../../game/assets/Icons/Weapon & Tool/Wooden Shield.png', import.meta.url).href,
  bow: new URL('../../game/assets/Icons/Weapon & Tool/Bow.png', import.meta.url).href,
  axe: new URL('../../game/assets/Icons/Weapon & Tool/Axe.png', import.meta.url).href,
  wand: new URL('../../game/assets/Icons/Weapon & Tool/Magic Wand.png', import.meta.url).href,
  staff: new URL('../../game/assets/Icons/Weapon & Tool/Emerald Staff.png', import.meta.url).href,
  diamond: new URL('../../game/assets/Icons/Ore & Gem/Diamond.png', import.meta.url).href,
} as const;

export type GameAssetIconName = keyof typeof ICONS;

type GameAssetIconProps = {
  name: GameAssetIconName;
  alt?: string;
  size?: number;
  className?: string;
};

export const GameAssetIcon = ({ name, alt, size = 18, className = '' }: GameAssetIconProps) => (
  <img
    src={ICONS[name]}
    alt={alt ?? name}
    width={size}
    height={size}
    className={`pointer-events-none select-none object-contain ${className}`.trim()}
    draggable={false}
  />
);