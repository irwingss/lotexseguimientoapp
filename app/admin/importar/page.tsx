'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  message?: string;
}

interface Expediente {
  id: string;
  nombre: string;
  expediente_codigo: string;
}

export default function ImportarPage() {
  const [selectedExpediente, setSelectedExpediente] = useState<string>('');
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [monitoreoFile, setMonitoreoFile] = useState<File | null>(null);
  const [vuelosFile, setVuelosFile] = useState<File | null>(null);
  const [isLoadingExpedientes, setIsLoadingExpedientes] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    monitoreo?: ImportResult;
    vuelos?: ImportResult;
  }>({});

  const supabase = createClient();

  // Cargar expedientes al montar el componente
  React.useEffect(() => {
    loadExpedientes();
  }, []);

  const loadExpedientes = async () => {
    setIsLoadingExpedientes(true);
    try {
      const { data, error } = await supabase
        .from('expedientes')
        .select('id, nombre, expediente_codigo')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpedientes(data || []);
    } catch (error) {
      console.error('Error loading expedientes:', error);
      toast.error('Error al cargar expedientes');
    } finally {
      setIsLoadingExpedientes(false);
    }
  };

  const handleFileChange = (type: 'monitoreo' | 'vuelos', file: File | null) => {
    if (type === 'monitoreo') {
      setMonitoreoFile(file);
    } else {
      setVuelosFile(file);
    }
  };

  const callImportAPI = async (
    type: 'monitoreo' | 'vuelos',
    file: File, 
    expedienteNombre: string
  ): Promise<ImportResult> => {
    console.log(`Calling Import API: ${type}`, { fileName: file.name, expedienteNombre });
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('expediente_nombre', expedienteNombre);

      const response = await fetch(`/api/import/${type}`, {
        method: 'POST',
        body: formData
      });

      console.log(`Import API response status: ${response.status}`);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('Import API error:', errorData);
        } catch (parseError) {
          const errorText = await response.text();
          console.error('Import API error (text):', errorText);
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Import API result:', result);
      return result;
    } catch (error) {
      console.error('Import API call failed:', error);
      throw error;
    }
  };

  const handleImport = async () => {
    if (!selectedExpediente || (!monitoreoFile && !vuelosFile)) {
      toast.error('Selecciona un expediente y al menos un archivo');
      return;
    }

    const expediente = expedientes.find(e => e.id === selectedExpediente);
    if (!expediente) {
      toast.error('Expediente no encontrado');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportResults({});

    try {
      const results: { monitoreo?: ImportResult; vuelos?: ImportResult } = {};
      let currentProgress = 0;
      const totalSteps = (monitoreoFile ? 1 : 0) + (vuelosFile ? 1 : 0);

      // Importar monitoreo si hay archivo
      if (monitoreoFile) {
        setImportProgress(10);
        toast.info('Procesando datos de monitoreo...');
        
        results.monitoreo = await callImportAPI(
          'monitoreo',
          monitoreoFile,
          expediente.nombre
        );
        
        currentProgress++;
        setImportProgress(50 * (currentProgress / totalSteps));
      }

      // Importar vuelos si hay archivo
      if (vuelosFile) {
        setImportProgress(60);
        toast.info('Procesando datos de vuelos...');
        
        results.vuelos = await callImportAPI(
          'vuelos',
          vuelosFile,
          expediente.nombre
        );
        
        currentProgress++;
        setImportProgress(100);
      }

      setImportResults(results);
      
      // Mostrar resumen
      const totalInserted = (results.monitoreo?.inserted || 0) + (results.vuelos?.inserted || 0);
      const totalUpdated = (results.monitoreo?.updated || 0) + (results.vuelos?.updated || 0);
      const totalErrors = (results.monitoreo?.errors?.length || 0) + (results.vuelos?.errors?.length || 0);
      
      if (totalErrors === 0) {
        toast.success(`Importación exitosa: ${totalInserted} insertados, ${totalUpdated} actualizados`);
      } else {
        toast.warning(`Importación completada con ${totalErrors} errores`);
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error(`Error en la importación: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setMonitoreoFile(null);
    setVuelosFile(null);
    setImportResults({});
    setImportProgress(0);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Importar Datos XLSX</h1>
          <p className="text-muted-foreground">
            Importa datos de monitoreo y vuelos desde archivos Excel
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Panel de configuración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Configuración de Importación
            </CardTitle>
            <CardDescription>
              Selecciona el expediente y los archivos a importar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selector de expediente */}
            <div className="space-y-2">
              <Label htmlFor="expediente">Expediente</Label>
              <Select
                value={selectedExpediente}
                onValueChange={setSelectedExpediente}
                disabled={isLoadingExpedientes || isImporting}
              >
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

            {/* Archivos */}
            <Tabs defaultValue="monitoreo" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monitoreo">Monitoreo</TabsTrigger>
                <TabsTrigger value="vuelos">Vuelos</TabsTrigger>
              </TabsList>
              
              <TabsContent value="monitoreo" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monitoreo-file">Archivo de Monitoreo (.xlsx)</Label>
                  <Input
                    id="monitoreo-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange('monitoreo', e.target.files?.[0] || null)}
                    disabled={isImporting}
                  />
                  {monitoreoFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                      {monitoreoFile.name}
                    </div>
                  )}
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Columnas requeridas:</strong> LOCACION, COD_CELDA, COD_GRILLA, ESTE, NORTE, PROF, P_SUPERPOS, COD_PUNTO_CAMPO, COD_COLECTORA, DISTANCIA
                  </AlertDescription>
                </Alert>
              </TabsContent>
              
              <TabsContent value="vuelos" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vuelos-file">Archivo de Vuelos (.xlsx)</Label>
                  <Input
                    id="vuelos-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange('vuelos', e.target.files?.[0] || null)}
                    disabled={isImporting}
                  />
                  {vuelosFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                      {vuelosFile.name}
                    </div>
                  )}
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Columnas requeridas:</strong> ITEM, TIPO, CODIGO, ESTE, NORTE, BASE
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleImport}
                disabled={!selectedExpediente || (!monitoreoFile && !vuelosFile) || isImporting}
                className="flex-1"
              >
                {isImporting ? 'Importando...' : 'Importar Datos'}
              </Button>
              <Button
                variant="outline"
                onClick={resetImport}
                disabled={isImporting}
              >
                Limpiar
              </Button>
            </div>

            {/* Barra de progreso */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progreso</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de resultados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Resultados de Importación
            </CardTitle>
            <CardDescription>
              Resumen del proceso de importación
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(importResults).length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Los resultados aparecerán aquí después de la importación</p>
              </div>
            ) : (
              <div className="space-y-4">
                {importResults.monitoreo && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      Monitoreo
                      {importResults.monitoreo.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Badge variant="secondary">
                        {importResults.monitoreo.inserted} insertados
                      </Badge>
                      <Badge variant="outline">
                        {importResults.monitoreo.updated} actualizados
                      </Badge>
                      <Badge variant="destructive">
                        {importResults.monitoreo.skipped} omitidos
                      </Badge>
                    </div>
                    {importResults.monitoreo.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <details>
                            <summary className="cursor-pointer">
                              {importResults.monitoreo.errors.length} errores
                            </summary>
                            <ul className="mt-2 space-y-1 text-xs">
                              {importResults.monitoreo.errors.slice(0, 5).map((error, i) => (
                                <li key={i}>• {error}</li>
                              ))}
                              {importResults.monitoreo.errors.length > 5 && (
                                <li>... y {importResults.monitoreo.errors.length - 5} más</li>
                              )}
                            </ul>
                          </details>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {importResults.vuelos && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      Vuelos
                      {importResults.vuelos.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Badge variant="secondary">
                        {importResults.vuelos.inserted} insertados
                      </Badge>
                      <Badge variant="outline">
                        {importResults.vuelos.updated} actualizados
                      </Badge>
                      <Badge variant="destructive">
                        {importResults.vuelos.skipped} omitidos
                      </Badge>
                    </div>
                    {importResults.vuelos.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <details>
                            <summary className="cursor-pointer">
                              {importResults.vuelos.errors.length} errores
                            </summary>
                            <ul className="mt-2 space-y-1 text-xs">
                              {importResults.vuelos.errors.slice(0, 5).map((error, i) => (
                                <li key={i}>• {error}</li>
                              ))}
                              {importResults.vuelos.errors.length > 5 && (
                                <li>... y {importResults.vuelos.errors.length - 5} más</li>
                              )}
                            </ul>
                          </details>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
