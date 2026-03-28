import React from 'react';
import { AlertTriangle, Camera, CheckCircle2, Smartphone, X } from 'lucide-react';
import type { ArEntryPoint, ArSupportState } from '../types';

interface ARModeOverlayProps {
  isOpen: boolean;
  entryPoint: ArEntryPoint;
  arSupport: ArSupportState;
  onClose: () => void;
  onOpenFallback3D: () => void;
}

const getEntryLabel = (entryPoint: ArEntryPoint) => (
  entryPoint === 'battle' ? 'durante a batalha' : 'na taverna'
);

const getPlatformLabel = (platform: ArSupportState['platform']) => {
  if (platform === 'android') {
    return 'Android';
  }

  if (platform === 'ios') {
    return 'iOS';
  }

  if (platform === 'desktop') {
    return 'Desktop';
  }

  return 'Desconhecido';
};

export const ARModeOverlay: React.FC<ARModeOverlayProps> = ({
  isOpen,
  entryPoint,
  arSupport,
  onClose,
  onOpenFallback3D,
}) => {
  if (!isOpen) {
    return null;
  }

  const isChecking = arSupport.status === 'checking';
  const isSupported = arSupport.status === 'supported';

  return (
    <div className="absolute inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_90px_rgba(30,20,24,0.45)] overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#dcc0aa] px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#8f6c67]">
              <Smartphone size={12} /> AR Preview
            </div>
            <h3 className="mt-2 text-2xl font-black text-[#6b3141]">Modo AR mobile</h3>
            <p className="mt-1 text-xs text-[#7f5b56]">Entrada solicitada {getEntryLabel(entryPoint)}.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] p-2 text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-3">
          <div className={`rounded-2xl border px-4 py-3 ${isSupported ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : isChecking ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em]">
              {isSupported ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {isSupported ? 'Suporte AR detectado' : isChecking ? 'Verificando suporte AR' : 'AR indisponivel agora'}
            </div>
            <p className="mt-1 text-sm font-semibold normal-case tracking-normal">{arSupport.reason}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068]">Plataforma</div>
              <div className="mt-1 text-sm font-black text-[#6b3141]">{getPlatformLabel(arSupport.platform)}</div>
            </div>
            <div className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068]">WebXR</div>
              <div className="mt-1 text-sm font-black text-[#6b3141]">{arSupport.hasWebXR ? 'Disponivel' : 'Nao detectado'}</div>
            </div>
            <div className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068]">Contexto</div>
              <div className="mt-1 text-sm font-black text-[#6b3141]">{arSupport.isSecureContext ? 'Seguro' : 'Nao seguro'}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#8f6c67]">
              <Camera size={14} /> Proxima etapa
            </div>
            <p className="mt-1 text-sm text-[#6b3141] leading-relaxed">
              {isSupported
                ? 'Seu dispositivo detectou suporte AR. A sessao immersive-ar completa entra na proxima fase.'
                : 'No Safari iOS, WebXR costuma nao estar disponivel. Voce pode continuar agora em fallback 3D para visualizar o cenario sem travar o fluxo.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
              Voltar ao jogo
            </button>
            <button
              onClick={() => {
                if (isSupported) {
                  onClose();
                  return;
                }
                onOpenFallback3D();
              }}
              className={`rounded-xl px-4 py-3 font-black text-white transition-colors ${isSupported ? 'bg-[#4d7a96] hover:bg-[#5a8aa6]' : 'bg-[#8f6c67] hover:bg-[#9f7c77]'}`}
            >
              {isSupported ? 'Aguardar sessao AR real' : 'Abrir fallback 3D agora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
