import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCcw, ShieldAlert, X } from 'lucide-react';
import type { ArEntryPoint } from '../types';

interface ARCameraFallbackOverlayProps {
  isOpen: boolean;
  entryPoint: ArEntryPoint;
  onClose: () => void;
  onFallback3D: () => void;
}

const getEntryLabel = (entryPoint: ArEntryPoint) => (
  entryPoint === 'battle' ? 'batalha' : 'taverna'
);

export const ARCameraFallbackOverlay: React.FC<ARCameraFallbackOverlayProps> = ({
  isOpen,
  entryPoint,
  onClose,
  onFallback3D,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');

  const contextLabel = useMemo(() => getEntryLabel(entryPoint), [entryPoint]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      setCameraState('starting');
      setCameraError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error');
        setCameraError('Camera indisponivel neste navegador.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => undefined);
        }

        setCameraState('ready');
      } catch (error) {
        setCameraState('error');
        setCameraError(error instanceof Error ? error.message : 'Falha ao abrir a camera.');
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraState('idle');
      setCameraError('');
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="absolute inset-0 z-[-1] pointer-events-none">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.06)_45%,rgba(0,0,0,0.22)_100%)]" />
      </div>

      <div className="absolute inset-0 z-[76] pointer-events-none">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[min(94vw,720px)] rounded-2xl border border-[#cfab91] bg-[#f7ecdd]/88 backdrop-blur-sm px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.45)] pointer-events-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#8f6c67]">
                <Camera size={12} /> Camera AR fallback
              </div>
              <h3 className="mt-2 text-lg sm:text-xl font-black text-[#6b3141]">Modo camera ativa</h3>
              <p className="mt-1 text-xs sm:text-sm text-[#7f5b56]">
                Entrou no fallback por camera em {contextLabel}. O cenario 3D agora renderiza por cima da imagem real.
              </p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] p-2 text-[#6b3141] transition-colors hover:bg-[#e9d7c2]" aria-label="Fechar camera fallback">
              <X size={16} />
            </button>
          </div>
        </div>

        {cameraState !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-auto">
            <div className="rounded-2xl border border-[#cfab91] bg-[#f7ecdd]/95 px-5 py-4 text-center shadow-[0_20px_70px_rgba(0,0,0,0.45)] max-w-sm w-full">
              {cameraState === 'starting' ? (
                <>
                  <Loader2 size={18} className="mx-auto text-[#346c7f] animate-spin" />
                  <p className="mt-2 text-sm font-black text-[#6b3141]">Ativando camera traseira...</p>
                </>
              ) : (
                <>
                  <ShieldAlert size={18} className="mx-auto text-[#b83a4b]" />
                  <p className="mt-2 text-sm font-black text-[#6b3141]">Nao foi possivel abrir a camera</p>
                  <p className="mt-1 text-xs text-[#7f5b56]">{cameraError || 'Verifique permissao de camera no Safari.'}</p>
                  <div className="mt-3 flex gap-2 justify-center">
                    <button onClick={() => window.location.reload()} className="rounded-lg border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 text-[11px] font-black text-[#6b3141]">
                      <span className="inline-flex items-center gap-1"><RefreshCcw size={11} /> Tentar de novo</span>
                    </button>
                    <button onClick={onFallback3D} className="rounded-lg bg-[#4d7a96] px-3 py-1.5 text-[11px] font-black text-white">
                      Usar fallback 3D
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(94vw,760px)] rounded-2xl border border-[#cfab91] bg-[#f7ecdd]/88 backdrop-blur-sm px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.45)] pointer-events-auto">
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.16em] text-[#6b3141]">
            <span className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-2.5 py-1">Arraste para movimentar camera 3D</span>
            <span className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-2.5 py-1">Combate e estados preservados</span>
            <button onClick={onClose} className="ml-auto rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 text-[10px] sm:text-xs font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
              Sair da camera
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
