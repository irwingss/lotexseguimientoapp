// PWA detection and installation utilities

export interface PWAInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  return mobileRegex.test(userAgent);
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent);
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  return /Android/.test(userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if running in standalone mode (installed PWA)
  const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  
  return isStandaloneMode || isIOSStandalone;
}

export function isPWAInstallRequired(): boolean {
  // Only require installation on mobile devices
  return isMobile() && !isStandalone();
}

export function canInstallPWA(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if beforeinstallprompt is available (Android/Chrome)
  return 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
}

export function getInstallInstructions(): {
  platform: 'ios' | 'android' | 'desktop';
  instructions: string[];
} {
  if (isIOS()) {
    return {
      platform: 'ios',
      instructions: [
        'Toca el botón de compartir en Safari',
        'Selecciona "Añadir a la pantalla de inicio"',
        'Confirma tocando "Añadir"'
      ]
    };
  }
  
  if (isAndroid()) {
    return {
      platform: 'android',
      instructions: [
        'Toca el menú del navegador (⋮)',
        'Selecciona "Instalar aplicación" o "Añadir a pantalla de inicio"',
        'Confirma la instalación'
      ]
    };
  }
  
  return {
    platform: 'desktop',
    instructions: [
      'Busca el ícono de instalación en la barra de direcciones',
      'Haz clic en "Instalar" cuando aparezca la opción',
      'La aplicación se abrirá en una ventana independiente'
    ]
  };
}

// Environment variable check for install requirement
export function getInstallRequirement(): 'ALWAYS' | 'MOBILE_ONLY' | 'NEVER' {
  const requirement = process.env.NEXT_PUBLIC_REQUIRE_INSTALL;
  
  switch (requirement) {
    case 'ALWAYS':
      return 'ALWAYS';
    case 'NEVER':
      return 'NEVER';
    case 'MOBILE_ONLY':
    default:
      return 'MOBILE_ONLY';
  }
}

export function shouldBlockAccess(): boolean {
  const requirement = getInstallRequirement();
  
  switch (requirement) {
    case 'ALWAYS':
      return !isStandalone();
    case 'MOBILE_ONLY':
      return isPWAInstallRequired();
    case 'NEVER':
      return false;
    default:
      return false;
  }
}
