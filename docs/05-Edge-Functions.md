# Edge Functions Documentation

## Overview
Edge Functions are serverless Deno functions deployed on Supabase Edge Runtime for file processing and Excel operations.

## Deployed Functions

### `import-monitoreo-from-xlsx`
**Purpose**: Import monitoring points from Excel files
**Status**: ✅ ACTIVE (Version 1)

#### Request Format
```json
{
  "file_data": "base64_encoded_excel_file",
  "supervision_nombre": "Expedition name"
}
```

#### Required Excel Columns
- `LOCACION`, `COD_CELDA`, `COD_GRILLA`
- `ESTE`, `NORTE` (UTM coordinates)
- `PROF`, `P_SUPERPOS`, `DISTANCIA` (optional)
- `COD_PUNTO_CAMPO`, `COD_COLECTORA`

#### Response Format
```json
{
  "success": true,
  "message": "Importación completada. Procesadas 150 filas.",
  "stats": {
    "inserted": 145,
    "updated": 3,
    "skipped": 2,
    "errors": ["Error messages"]
  }
}
```

### `import-vuelos-from-xlsx`
**Purpose**: Import flight items from Excel files
**Status**: ✅ ACTIVE (Version 1)

#### Required Excel Columns
- `ITEM`, `TIPO` (PAF/PD), `CODIGO`
- `ESTE`, `NORTE` (UTM coordinates)
- `BASE` (optional)

#### Validation Rules
- Flight type must be 'PAF' or 'PD'
- Coordinates must be valid numbers > 0
- Unique key: (expediente_id, codigo)

## Common Features

### Authentication & Security
- Uses SUPABASE_SERVICE_ROLE_KEY for database access
- Client requests require valid JWT token
- RLS policies validate expedition access

### Error Handling
- Missing columns → 400 error
- Invalid data → Row skipped, logged in errors
- Database errors → Detailed error messages

### CORS Support
All functions include proper CORS headers for web client access.

## Function URLs
- Monitoring: `https://[project].supabase.co/functions/v1/import-monitoreo-from-xlsx`
- Flights: `https://[project].supabase.co/functions/v1/import-vuelos-from-xlsx`

## Usage Example
```javascript
const response = await fetch('/functions/v1/import-monitoreo-from-xlsx', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    file_data: base64Data,
    supervision_nombre: 'Expediente Enero 2025'
  })
});
```

## Future Functions (Planned)
- `export-monitoreo-xlsx` - Generate Excel exports
- `export-vuelos-xlsx` - Generate flight exports
