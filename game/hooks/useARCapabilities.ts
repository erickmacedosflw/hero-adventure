import { useCallback, useEffect, useState } from 'react';
import type { ArSupportPlatform, ArSupportState } from '../../types';

type NavigatorWithXR = Navigator & {
  xr?: {
    isSessionSupported: (mode: string) => Promise<boolean>;
  };
};

const detectPlatform = (): ArSupportPlatform => {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const userAgent = navigator.userAgent ?? '';
  const isTouchMac = userAgent.includes('Mac') && (navigator.maxTouchPoints ?? 0) > 1;

  if (/Android/i.test(userAgent)) {
    return 'android';
  }

  if (/iPhone|iPad|iPod/i.test(userAgent) || isTouchMac) {
    return 'ios';
  }

  if (/Windows|Macintosh|Linux/i.test(userAgent)) {
    return 'desktop';
  }

  return 'unknown';
};

const buildUnsupportedState = (
  platform: ArSupportPlatform,
  hasWebXR: boolean,
  isSecureContext: boolean,
  reason: string,
): ArSupportState => ({
  status: 'unsupported',
  platform,
  hasWebXR,
  isSecureContext,
  reason,
});

export const useARCapabilities = () => {
  const [arSupport, setArSupport] = useState<ArSupportState>({
    status: 'checking',
    platform: 'unknown',
    hasWebXR: false,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    reason: 'Verificando suporte AR...',
  });

  const refreshArSupport = useCallback(async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    const platform = detectPlatform();
    const secureContext = window.isSecureContext;

    setArSupport({
      status: 'checking',
      platform,
      hasWebXR: false,
      isSecureContext: secureContext,
      reason: 'Verificando suporte AR...',
    });

    if (!secureContext) {
      setArSupport(buildUnsupportedState(platform, false, false, 'AR requer HTTPS ou localhost.'));
      return;
    }

    const navigatorWithXR = navigator as NavigatorWithXR;
    if (!navigatorWithXR.xr?.isSessionSupported) {
      const platformHint = platform === 'ios'
        ? 'Safari iOS costuma exigir fallback para visualizacao 3D.'
        : 'Este navegador nao exibe a API WebXR.';
      setArSupport(buildUnsupportedState(platform, false, true, `WebXR nao disponivel. ${platformHint}`));
      return;
    }

    try {
      const supported = await navigatorWithXR.xr.isSessionSupported('immersive-ar');
      if (!supported) {
        setArSupport(buildUnsupportedState(platform, true, true, 'Sessao immersive-ar nao suportada neste dispositivo.'));
        return;
      }

      setArSupport({
        status: 'supported',
        platform,
        hasWebXR: true,
        isSecureContext: true,
        reason: 'Dispositivo pronto para immersive-ar.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida ao consultar WebXR.';
      setArSupport(buildUnsupportedState(platform, true, true, `Erro ao verificar AR: ${message}`));
    }
  }, []);

  useEffect(() => {
    void refreshArSupport();
  }, [refreshArSupport]);

  return { arSupport, refreshArSupport };
};
