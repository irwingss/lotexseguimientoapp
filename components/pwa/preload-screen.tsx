'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/client';

interface PreloadScreenProps {
  onComplete: () => void;
  userEmail: string;
}

interface Expediente {
  id: string;
  expediente_codigo: string;
  nombre: string;
}

export function PreloadScreen({ onComplete, userEmail }: PreloadScreenProps) {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [selectedExpediente, setSelectedExpediente] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [cacheStats, setCacheStats] = useState({ assignments: 0, points: 0, mutations: 0 });

  const supabase = createClient();

  useEffect(() => {
    loadExpedientes();
    loadCacheStats();
  }, []);

  const loadExpedientes = async () => {
    try {
      const { data, error } = await supabase
        .from('expedientes')
        .select('id, expediente_codigo, nombre')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpedientes(data || []);
    } catch (error) {
      console.error('Error loading expedientes:', error);
      setErrorMessage('Error al cargar expedientes');
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = await db.getCacheSize();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  };

  const preloadData = async () => {
    if (!selectedExpediente) return;

    setIsLoading(true);
    setStatus('loading');
    setProgress(0);
    setErrorMessage('');

    try {
      // Step 1: Load assignments (20%)
      setProgress(20);
      const { data: assignments, error: assignmentsError } = await supabase
        .from('expediente_supervisores')
        .select('*')
        .eq('expediente_id', selectedExpediente)
        .eq('is_deleted', false);

      if (assignmentsError) throw assignmentsError;

      // Cache assignments
      if (assignments) {
        await db.assignments_cache.clear();
        await db.assignments_cache.bulkAdd(
          assignments.map(assignment => ({
            ...assignment,
            cached_at: Date.now()
          }))
        );
      }

      // Step 2: Load monitoring points (60%)
      setProgress(60);
      const { data: points, error: pointsError } = await supabase
        .from('monitoreo_puntos')
        .select('id, expediente_id, locacion, cod_punto_campo, este, norte, estatus')
        .eq('expediente_id', selectedExpediente)
        .eq('is_deleted', false);

      if (pointsError) throw pointsError;

      // Cache points
      if (points) {
        await db.points_cache.clear();
        await db.points_cache.bulkAdd(
          points.map(point => ({
            ...point,
            cached_at: Date.now()
          }))
        );
      }

      // Step 3: Clean old cache and finalize (100%)
      setProgress(90);
      await db.clearExpiredCache();
      
      setProgress(100);
      setStatus('success');

      // Update cache stats
      await loadCacheStats();

      // Store preload info in localStorage
      localStorage.setItem('loteX_preload_info', JSON.stringify({
        expediente_id: selectedExpediente,
        fecha: selectedDate.toISOString(),
        timestamp: Date.now()
      }));

      setTimeout(() => {
        onComplete();
      }, 1500);

    } catch (error) {
      console.error('Error during preload:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const skipPreload = () => {
    // Store skip info
    localStorage.setItem('loteX_preload_info', JSON.stringify({
      skipped: true,
      timestamp: Date.now()
    }));
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-emerald-100 rounded-full w-fit">
            <Download className="h-8 w-8 text-emerald-600" />
          </div>
          <CardTitle className="text-xl">Preparar para trabajo offline</CardTitle>
          <CardDescription>
            Descarga los datos necesarios para trabajar sin conexión
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'idle' && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Expediente activo
                  </label>
                  <Select value={selectedExpediente} onValueChange={setSelectedExpediente}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un expediente" />
                    </SelectTrigger>
                    <SelectContent>
                      {expedientes.map((exp) => (
                        <SelectItem key={exp.id} value={exp.id}>
                          {exp.expediente_codigo} - {exp.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Fecha de trabajo
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, 'PPP', { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {(cacheStats.assignments + cacheStats.points + cacheStats.mutations) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Datos en caché</h4>
                  <div className="text-xs text-blue-700 space-y-1">
                    <div>Asignaciones: {cacheStats.assignments}</div>
                    <div>Puntos: {cacheStats.points}</div>
                    <div>Mutaciones pendientes: {cacheStats.mutations}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  onClick={preloadData}
                  disabled={!selectedExpediente || isLoading}
                  className="flex-1"
                >
                  Descargar datos
                </Button>
                <Button 
                  onClick={skipPreload}
                  variant="outline"
                  className="flex-1"
                >
                  Omitir
                </Button>
              </div>
            </>
          )}

          {status === 'loading' && (
            <div className="space-y-4">
              <Progress value={progress} className="w-full" />
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Descargando datos... {progress}%
                </p>
                {progress <= 20 && <p className="text-xs text-gray-500">Cargando asignaciones</p>}
                {progress > 20 && progress <= 60 && <p className="text-xs text-gray-500">Cargando puntos de monitoreo</p>}
                {progress > 60 && <p className="text-xs text-gray-500">Finalizando...</p>}
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-green-800">¡Listo para offline!</h3>
                <p className="text-sm text-green-600">
                  Los datos se han descargado correctamente
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-red-800">Error en la descarga</h3>
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
              <Button onClick={() => setStatus('idle')} variant="outline">
                Intentar de nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
