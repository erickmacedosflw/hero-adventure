import React from 'react';
import { Box, Eye, RotateCcw, X } from 'lucide-react';
import type { ArEntryPoint } from '../types';

interface ARFallback3DOverlayProps {
  isOpen: boolean;
  entryPoint: ArEntryPoint;
  onClose: () => void;
}

const getContextLabel = (entryPoint: ArEntryPoint) => (
  entryPoint === 'battle' ? 'batalha' : 'acampamento'
);

export const ARFallback3DOverlay: React.FC<ARFallback3DOverlayProps> = ({ isOpen, entryPoint, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[74] pointer-events-none">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto w-[min(94vw,680px)] rounded-2xl border border-[#cfab91] bg-[#f7ecdd]/92 backdrop-blur-md px-4 py-3 shadow-[0_20px_60px_rgba(20,16,18,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#8f6c67]">
              <Box size={12} /> Fallback 3D ativo
            </div>
            <h3 className="mt-2 text-lg sm:text-xl font-black text-[#6b3141]">Visualizacao alternativa no Safari</h3>
            <p className="mt-1 text-xs sm:text-sm text-[#7f5b56] leading-relaxed">
              WebXR AR nao esta disponivel neste navegador. O jogo entrou em modo de inspecao 3D no contexto de {getContextLabel(entryPoint)} para voce continuar sem bloqueio.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] p-2 text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
            aria-label="Fechar fallback"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto w-[min(94vw,760px)] rounded-2xl border border-[#cfab91] bg-[#f7ecdd]/88 backdrop-blur-md px-4 py-3 shadow-[0_20px_60px_rgba(20,16,18,0.45)]">
        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.16em] text-[#6b3141]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-2.5 py-1">
            <Eye size={12} /> Arraste para orbitar camera
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-2.5 py-1">
            <RotateCcw size={12} /> Mantendo o combate e os estados
          </span>
          <button onClick={onClose} className="ml-auto rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 text-[10px] sm:text-xs font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
            Fechar fallback
          </button>
        </div>
      </div>
    </div>
  );
};
