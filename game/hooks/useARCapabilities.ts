import { useCallback, useEffect, useState } from 'react';
import type { ArSupportPlatform, ArRoutingStrategy, ArSupportState } from '../../types';

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
  strategy: ArRoutingStrategy,
  hasWebXR: boolean,
  isSecureContext: boolean,
  reason: string,
): ArSupportState => ({
  status: 'unsupported',
  platform,
  isIOS: platform === 'ios',
  hasWebXR,
  isSecureContext,
  strategy,
  reason,
});

export const useARCapabilities = () => {
  const [arSupport, setArSupport] = useState<ArSupportState>({
    status: 'checking',
    platform: 'unknown',
    isIOS: false,
    hasWebXR: false,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    strategy: 'fallback-3d',
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
      isIOS: platform === 'ios',
      hasWebXR: false,
      isSecureContext: secureContext,
      strategy: platform === 'ios' ? 'camera-fallback' : 'fallback-3d',
      reason: 'Verificando suporte AR...',
    });

    if (!secureContext) {
      setArSupport(buildUnsupportedState(platform, platform === 'ios' ? 'camera-fallback' : 'fallback-3d', false, false, 'AR requer HTTPS ou localhost.'));
      return;
    }

    if (platform === 'ios') {
      setArSupport({
        status: 'unsupported',
        platform,
        isIOS: true,
        hasWebXR: false,
        isSecureContext: true,
        strategy: 'camera-fallback',
        reason: 'Safari iOS nao oferece WebXR AR completo. Usando fallback por camera.',
      });
      return;
    }

    const navigatorWithXR = navigator as NavigatorWithXR;
    if (!navigatorWithXR.xr?.isSessionSupported) {
      setArSupport(buildUnsupportedState(platform, 'fallback-3d', false, true, 'WebXR nao disponivel. Este navegador nao exibe a API WebXR.'));
      return;
    }

    try {
      const supported = await navigatorWithXR.xr.isSessionSupported('immersive-ar');
      if (!supported) {
        setArSupport(buildUnsupportedState(platform, 'fallback-3d', true, true, 'Sessao immersive-ar nao suportada neste dispositivo.'));
        return;
      }

      setArSupport({
        status: 'supported',
        platform,
        isIOS: false,
        hasWebXR: true,
        isSecureContext: true,
        strategy: 'webxr',
        reason: 'Dispositivo pronto para immersive-ar.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida ao consultar WebXR.';
      setArSupport(buildUnsupportedState(platform, 'fallback-3d', true, true, `Erro ao verificar AR: ${message}`));
    }
  }, []);

  useEffect(() => {
    void refreshArSupport();
  }, [refreshArSupport]);

  return { arSupport, refreshArSupport };
};
