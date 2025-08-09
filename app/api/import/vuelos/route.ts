import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  message?: string;
}

// Columnas requeridas según specs_app.yaml
const REQUIRED_COLUMNS = [
  'ITEM', 'TIPO', 'CODIGO', 'ESTE', 'NORTE', 'BASE'
];

export async function POST(request: NextRequest) {
  console.log('[API] Import vuelos request received');
  
  try {
    // Verificar que el usuario está autenticado
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user?.email) {
      console.log('[API] Authentication failed:', userError);
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[API] User authenticated:', user.email);

    // Verificar permisos ADMIN
    const { data: supervisor, error: supervisorError } = await supabase
      .from('supervisores')
      .select('permisos_sistema, id')
      .eq('email', user.email)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (supervisorError || supervisor?.permisos_sistema !== 'ADMIN') {
      console.log('[API] Admin permission check failed:', supervisorError, supervisor);
      return NextResponse.json(
        { success: false, message: 'Admin permissions required' },
        { status: 403 }
      );
    }

    console.log('[API] Admin permissions verified');

    // Parsear el FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const expedienteNombre = formData.get('expediente_nombre') as string;

    if (!file || !expedienteNombre) {
      return NextResponse.json(
        { success: false, message: 'File and expediente_nombre are required' },
        { status: 400 }
      );
    }

    console.log('[API] Processing file:', file.name, 'for expediente:', expedienteNombre);

    // Resolver expediente_id por nombre
    const { data: expediente, error: expedienteError } = await supabase
      .from('expedientes')
      .select('id')
      .eq('nombre', expedienteNombre)
      .eq('is_deleted', false)
      .single();

    if (expedienteError || !expediente) {
      console.log('[API] Expediente lookup failed:', expedienteError);
      return NextResponse.json(
        { success: false, message: `Expediente '${expedienteNombre}' not found` },
        { status: 404 }
      );
    }

    console.log('[API] Expediente found:', expediente.id);

    // Leer archivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    if (!workbook.SheetNames.length) {
      return NextResponse.json(
        { success: false, message: 'No sheets found in Excel file' },
        { status: 400 }
      );
    }

    // Leer primera hoja
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (!jsonData.length) {
      return NextResponse.json(
        { success: false, message: 'Empty Excel file' },
        { status: 400 }
      );
    }

    console.log('[API] Excel file read successfully, rows:', jsonData.length);

    // Normalizar headers a mayúsculas y crear mapeo
    const originalHeaders = jsonData[0] as string[];
    const normalizedHeaders = originalHeaders.map(h => h?.toString().trim().toUpperCase());
    console.log('[API] Excel headers found:', originalHeaders);
    console.log('[API] Normalized headers:', normalizedHeaders);
    
    // Crear mapeo de columnas requeridas a índices
    const columnMapping: { [key: string]: number } = {};
    const missingColumns: string[] = [];
    
    for (const requiredCol of REQUIRED_COLUMNS) {
      const index = normalizedHeaders.indexOf(requiredCol);
      if (index !== -1) {
        columnMapping[requiredCol] = index;
      } else {
        missingColumns.push(requiredCol);
      }
    }

    if (missingColumns.length > 0) {
      console.log('[API] Column validation failed - missing columns:', missingColumns);
      return NextResponse.json({
        success: false,
        message: `Missing required columns: [${missingColumns.join(', ')}]. Found columns: [${originalHeaders.join(', ')}]. Required: [${REQUIRED_COLUMNS.join(', ')}]`
      }, { status: 400 });
    }

    console.log('[API] Column validation passed. Column mapping:', columnMapping);

    // Procesar filas de datos
    const dataRows = jsonData.slice(1) as any[][];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    console.log('[API] Processing', dataRows.length, 'data rows...');

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // +2 porque empezamos desde fila 1 (header) y el índice es 0-based

      try {
        // Mapear datos de la fila usando el mapeo de columnas
        const rowData: any = {};
        for (const [requiredCol, colIndex] of Object.entries(columnMapping)) {
          rowData[requiredCol] = row[colIndex];
        }

        // Validar datos obligatorios
        if (!rowData.CODIGO || !rowData.ESTE || !rowData.NORTE) {
          errors.push(`Row ${rowNum}: Missing required fields (CODIGO, ESTE, NORTE)`);
          skipped++;
          continue;
        }

        // Convertir coordenadas
        const este = parseFloat(rowData.ESTE);
        const norte = parseFloat(rowData.NORTE);
        
        if (isNaN(este) || isNaN(norte)) {
          errors.push(`Row ${rowNum}: Invalid coordinates ESTE=${rowData.ESTE}, NORTE=${rowData.NORTE}`);
          skipped++;
          continue;
        }

        // Preparar datos para inserción
        const insertData = {
          expediente_id: expediente.id,
          item: rowData.ITEM ? parseInt(rowData.ITEM) : 1,
          tipo: rowData.TIPO?.toString().trim().toUpperCase() || 'PUNTO',
          codigo: rowData.CODIGO.toString().trim().toUpperCase(),
          este: este,
          norte: norte,
          base: rowData.BASE?.toString().trim() || null,
          geom: `POINT(${este} ${norte})`
        };

        // Upsert por (expediente_id, codigo)
        const { data: existingVuelo } = await supabase
          .from('vuelos_items')
          .select('id')
          .eq('expediente_id', expediente.id)
          .eq('codigo', insertData.codigo)
          .eq('is_deleted', false)
          .single();

        if (existingVuelo) {
          // UPDATE
          const { error: updateError } = await supabase
            .from('vuelos_items')
            .update({
              ...insertData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingVuelo.id);

          if (updateError) {
            errors.push(`Row ${rowNum}: Update error - ${updateError.message}`);
            skipped++;
          } else {
            updated++;
          }
        } else {
          // INSERT
          const { error: insertError } = await supabase
            .from('vuelos_items')
            .insert(insertData);

          if (insertError) {
            errors.push(`Row ${rowNum}: Insert error - ${insertError.message}`);
            skipped++;
          } else {
            inserted++;
          }
        }
      } catch (error) {
        errors.push(`Row ${rowNum}: Processing error - ${error instanceof Error ? error.message : String(error)}`);
        skipped++;
      }
    }

    console.log('[API] Processing completed:', { inserted, updated, skipped, errors: errors.length });

    // Registrar auditoría
    await supabase.from('auditoria_eventos').insert({
      tabla_afectada: 'vuelos_items',
      registro_id: expediente.id,
      accion: 'IMPORT_XLSX',
      datos_nuevos: {
        expediente_nombre: expedienteNombre,
        file_name: file.name,
        result: { inserted, updated, skipped, errors: errors.length }
      },
      supervisor_id: supervisor.id
    });

    const result: ImportResult = {
      success: true,
      inserted,
      updated,
      skipped,
      errors,
      message: `Import completed: ${inserted} inserted, ${updated} updated, ${skipped} skipped${errors.length > 0 ? `, ${errors.length} errors` : ''}`
    };

    console.log('[API] Returning result:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [error instanceof Error ? error.message : String(error)]
    }, { status: 500 });
  }
}
