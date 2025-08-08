'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  shouldBlockAccess, 
  getInstallInstructions, 
  isAndroid, 
  isIOS,
  type PWAInstallPrompt 
} from '@/lib/pwa-utils';
import { Smartphone, Download, Share, MoreVertical } from 'lucide-react';

interface InstallGateProps {
  children: React.ReactNode;
}

export function InstallGate({ children }: InstallGateProps) {
  const [shouldBlock, setShouldBlock] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if we should block access
    setShouldBlock(shouldBlockAccess());

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as PWAInstallPrompt);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      // Android/Chrome - use native prompt
      setIsInstalling(true);
      try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setShouldBlock(false);
        }
      } catch (error) {
        console.error('Error during PWA installation:', error);
      } finally {
        setIsInstalling(false);
        setInstallPrompt(null);
      }
    } else {
      // iOS or other - show manual instructions
      setShowInstructions(true);
    }
  };

  const handleManualInstallComplete = () => {
    setShouldBlock(false);
    setShowInstructions(false);
  };

  if (!shouldBlock) {
    return <>{children}</>;
  }

  const instructions = getInstallInstructions();

  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-emerald-100 rounded-full w-fit">
              {isIOS() ? <Share className="h-8 w-8 text-emerald-600" /> : 
               isAndroid() ? <MoreVertical className="h-8 w-8 text-emerald-600" /> :
               <Download className="h-8 w-8 text-emerald-600" />}
            </div>
            <CardTitle className="text-xl">Instalar aplicación</CardTitle>
            <CardDescription>
              Sigue estos pasos para instalar OEFA Lote X en tu dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {instructions.instructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-700">{instruction}</p>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t">
              <Button 
                onClick={handleManualInstallComplete}
                className="w-full"
                variant="outline"
              >
                Ya instalé la aplicación
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-emerald-100 rounded-full w-fit">
            <Smartphone className="h-8 w-8 text-emerald-600" />
          </div>
          <CardTitle className="text-xl">Instalación requerida</CardTitle>
          <CardDescription>
            Para usar OEFA Lote X en dispositivos móviles, debes instalar la aplicación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>¿Por qué instalar?</strong><br />
              La instalación permite trabajar sin conexión y sincronizar datos cuando recuperes la señal.
            </p>
          </div>
          
          <Button 
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="w-full"
          >
            {isInstalling ? 'Instalando...' : 'Instalar aplicación'}
          </Button>
          
          {!installPrompt && (
            <Button 
              onClick={() => setShowInstructions(true)}
              variant="outline"
              className="w-full"
            >
              Ver instrucciones manuales
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
