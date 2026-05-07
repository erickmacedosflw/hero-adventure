import React, { useRef } from 'react';
import { Skull } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

type BossEncounterButtonProps = {
  onClick: () => void;
  className?: string;
  iconSize?: number;
};

export const BossEncounterButton: React.FC<BossEncounterButtonProps> = ({
  onClick,
  className = '',
  iconSize = 16,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    gsap.to(btnRef.current, {
      scale: 1.06,
      boxShadow: '0 0 28px 6px rgba(225,29,72,0.65)',
      duration: 0.72,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }, { scope: btnRef });

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={`pointer-events-auto rounded-[14px] border border-rose-300 bg-[linear-gradient(135deg,#e11d48_0%,#f43f5e_100%)] font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_24px_rgba(225,29,72,0.36)] transition-[filter] hover:brightness-105 active:scale-[0.98] flex items-center justify-center gap-2 ${className}`.trim()}
    >
      <Skull size={iconSize} /> ENFRENTAR CHEFAO
    </button>
  );
};
