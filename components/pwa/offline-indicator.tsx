'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wifi, WifiOff, Database, Clock, AlertCircle } from 'lucide-react';
import { db } from '@/lib/db';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [cacheStats, setCacheStats] = useState({ assignments: 0, points: 0, mutations: 0, total: 0 });
  const [pendingMutations, setPendingMutations] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    // Monitor online/offline status
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Load initial cache stats
    loadCacheStats();

    // Update cache stats every 30 seconds
    const interval = setInterval(loadCacheStats, 30000);

    // Load last sync time from localStorage
    const lastSyncTime = localStorage.getItem('loteX_last_sync');
    if (lastSyncTime) {
      setLastSync(new Date(lastSyncTime));
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  const loadCacheStats = async () => {
    try {
      const stats = await db.getCacheSize();
      const pending = await db.getPendingMutationsCount();
      
      setCacheStats(stats);
      setPendingMutations(pending);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  };

  const clearCache = async () => {
    try {
      await db.assignments_cache.clear();
      await db.points_cache.clear();
      await db.mutations_queue.where('status').equals('COMPLETED').delete();
      
      await loadCacheStats();
      
      // Update last sync time
      const now = new Date();
      setLastSync(now);
      localStorage.setItem('loteX_last_sync', now.toISOString());
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const getStatusColor = () => {
    if (!isOnline && cacheStats.total === 0) return 'destructive';
    if (!isOnline && cacheStats.total > 0) return 'secondary';
    if (isOnline && pendingMutations > 0) return 'default';
    return 'default';
  };

  const getStatusText = () => {
    if (!isOnline && cacheStats.total === 0) return 'Sin conexión - Sin datos';
    if (!isOnline && cacheStats.total > 0) return 'Modo offline';
    if (isOnline && pendingMutations > 0) return 'Sincronizando';
    return 'En línea';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-3 w-3" />;
    if (pendingMutations > 0) return <Clock className="h-3 w-3" />;
    return <Wifi className="h-3 w-3" />;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Badge variant={getStatusColor()} className="flex items-center gap-1">
            {getStatusIcon()}
            <span className="text-xs">{getStatusText()}</span>
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Estado de conexión</h4>
            <Badge variant={getStatusColor()}>
              {isOnline ? 'En línea' : 'Sin conexión'}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-gray-500" />
              <span>Datos en caché: {cacheStats.total}</span>
            </div>
            
            {cacheStats.total > 0 && (
              <div className="text-xs text-gray-600 pl-6 space-y-1">
                <div>• Asignaciones: {cacheStats.assignments}</div>
                <div>• Puntos: {cacheStats.points}</div>
              </div>
            )}

            {pendingMutations > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>{pendingMutations} cambios pendientes</span>
              </div>
            )}

            {lastSync && (
              <div className="text-xs text-gray-500">
                Última sincronización: {lastSync.toLocaleString('es-PE')}
              </div>
            )}
          </div>

          {!isOnline && cacheStats.total === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-medium">Sin datos offline</p>
                  <p className="text-xs mt-1">
                    Conecta a internet y recarga los datos para trabajar sin conexión
                  </p>
                </div>
              </div>
            </div>
          )}

          {isOnline && cacheStats.total > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={clearCache}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Limpiar caché
              </Button>
              <Button
                onClick={loadCacheStats}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Actualizar
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
