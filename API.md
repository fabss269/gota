# API — Contrato necesario para EPSEL Móvil (GOTA)

> **Estado:** propuesta de contrato. No existe backend real todavía (decisión
> registrada en `specs/00-auditoria-diseno.md`). La app corre contra estos mismos
> contratos servidos por un mock local (`src/mocks/`) mientras el backend real no
> exista — así el día que exista, solo se cambia la `baseURL`, no el código de la app.

Base URL sugerida: `https://api.epsel.gob.pe/movil/v1` (placeholder, a definir).
Formato: JSON. Autenticación: `Authorization: Bearer <accessToken>` salvo donde se
indique lo contrario. Fechas en ISO-8601 UTC.

## Índice

1. Auth
2. Catálogos
3. Incidencias (mapa y lista)
4. Detalle de incidencia
5. Acciones sobre incidencia
6. Usuarios (para reasignación)
7. Capas de red (mapa)
8. Dashboard
9. Modelo de errores

---

## 1. Auth (Spec 02)

### `POST /auth/login`
Sin autenticación previa.

Request:
```json
{ "correo": "tecnico@epsel.gob.pe", "password": "********" }
```
Response `200`:
```json
{
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "expiresIn": 3600,
  "usuario": {
    "id": "u_001",
    "nombre": "Juan Gonzales Rubio",
    "rol": "tecnico",
    "sector": "Sector 5",
    "avatarUrl": null
  }
}
```
`401` si las credenciales no son válidas (mensaje genérico, sin indicar cuál campo).

### `POST /auth/refresh`
Request: `{ "refreshToken": "jwt..." }` → Response `200` igual forma que login.
`401` si el refresh token también expiró/es inválido → la app fuerza logout.

### `POST /auth/logout` (opcional, invalidación server-side del refresh token)
Header `Authorization` requerido. Response `204`.

---

## 2. Catálogos (Spec 04, 05)

Listas de referencia usadas en selects/filtros. Todas `GET`, cacheables (no cambian
seguido).

- `GET /catalogos/distritos` → `[{ "id": "chiclayo", "nombre": "Chiclayo" }, ...]`
- `GET /catalogos/sectores?distritoId=` → `[{ "id": "s5", "nombre": "Sector 5" }, ...]`
- `GET /catalogos/tipos-atencion` → `[{ "id": "fuga-agua", "nombre": "Fuga de agua",
  "categoria": "agua" }, ...]` (incluye "Atoro en colector", "Fuga en vereda", etc.)
- `GET /catalogos/estados` → `["CREADO","PENDIENTE","EN_PROGRESO","ATENDIDO"]`

---

## 3. Incidencias — mapa y lista (Spec 03, 05)

### `GET /incidencias`
Query params (todos opcionales salvo lo indicado):

| Param | Tipo | Uso |
|---|---|---|
| `fecha` | `YYYY-MM-DD` \| `hoy` | Mapa la usa siempre con `hoy` (Spec 03 RF-03.4) |
| `fechaDesde`, `fechaHasta` | `YYYY-MM-DD` | Rango, usado por el filtro de fecha (Spec 04) |
| `categoria` | `agua,desague` (csv) | Multi-valor |
| `prioridad` | `a_tiempo,alerta,critica` (csv) | Multi-valor |
| `estado` | csv de estados | |
| `distritoId`, `sectorId` | string | |
| `tipoAtencionId` | string | |
| `q` | string | Búsqueda libre (tipo + dirección), lista (Spec 05) |
| `bbox` | `minLon,minLat,maxLon,maxLat` | Recorte espacial para el mapa (evita traer todo el país) |
| `page`, `pageSize` | int | Paginación, lista (Spec 05). Default `pageSize=10` |

Response `200` (forma de lista, usada tanto por mapa como por lista de incidencias):
```json
{
  "items": [
    {
      "id": "EPS-00231",
      "tipo": "Fuga de agua",
      "categoria": "agua",
      "direccion": "Av. Chinchaysuyo 482, Chiclayo",
      "sector": "Sector 5 · La Victoria",
      "prioridad": "critica",
      "estado": "EN_PROGRESO",
      "antiguedadDias": 26,
      "lat": -6.7701,
      "lon": -79.8390,
      "fechaCreacion": "2026-07-14T09:32:00Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 37
}
```

> Nota de implementación (Spec 03 RF-03.2): el **agrupamiento en clústeres** para los
> pines del mapa se calcula en el cliente a partir de `lat/lon`, no lo hace el backend.
> Si el volumen de incidencias crece mucho, se puede mover a un endpoint
> `GET /incidencias/clusters?bbox=&zoom=` en el futuro — no se especifica ahora porque
> no hay datos reales para saber si hace falta.

---

## 4. Detalle de incidencia (Spec 06)

### `GET /incidencias/{id}`
Response `200`:
```json
{
  "id": "EPS-00231",
  "tipo": "Fuga de agua",
  "categoria": "agua",
  "direccion": "Av. Chinchaysuyo 482, Chiclayo",
  "prioridad": "critica",
  "estado": "EN_PROGRESO",
  "antiguedadDias": 26,
  "tecnicoAsignado": { "id": "u_001", "nombre": "Juan Gonzales Rubio" },
  "reclamo": {
    "fechaRegistro": "2026-07-14T09:32:00Z",
    "medioRecepcion": "Teléfono",
    "descripcion": "Fuga visible en vereda, frente al domicilio..."
  },
  "catastro": {
    "redAsociada": "Red primaria de agua potable",
    "diametroMm": 160,
    "material": "PVC",
    "buzonCercano": "BZ-014 · Cota 42.80 m",
    "sector": "Sector 5 · La Victoria"
  },
  "quejasAgrupadas": 5,
  "predio": { "noReincidente": false, "quejasUltimos6Meses": 7 },
  "foco": { "descripcion": "Posible causa común: colapso en tramo de red primaria, Sector 5.",
    "incidenciasRelacionadasIds": ["EPS-00198", "EPS-00142"] }
}
```

### `GET /incidencias/{id}/trazabilidad` (Spec 06, tab Trazabilidad)
```json
[
  { "estado": "CREADO", "fecha": "2026-07-12T09:14:00Z" },
  { "estado": "PENDIENTE", "fecha": "2026-07-12T09:20:00Z", "grupo": "Mesa de partes" },
  { "estado": "EN_PROGRESO", "fecha": "2026-07-13T08:00:00Z",
    "asignadoA": "Juan Gonzales Rubio · Cuadrilla 5" },
  { "estado": "EN_PROGRESO", "fecha": "2026-07-14T15:40:00Z",
    "nota": "Requiere equipo adicional" }
]
```

### `GET /incidencias/{id}/predio` (Spec 06, tab Predio)
Lista de reclamos históricos del mismo predio: `[{ "id", "tipo", "fecha" }, ...]`.

### `GET /predios/{direccionId}/reclamos` — alternativa si "predio" se identifica por
dirección normalizada en vez de id de incidencia (a decidir junto con el backend real,
según cómo modelen ellos "predio").

---

## 5. Acciones sobre incidencia (Spec 07)

### `GET /incidencias/{id}/transiciones-validas`
Devuelve las transiciones de estado permitidas desde el estado actual (máquina de
estados). Flujo confirmado (ver `specs/07-acciones-incidencia.md`): lineal
`CREADO → PENDIENTE → EN_PROGRESO → ATENDIDO`, con un único loop
`EN_PROGRESO → EN_PROGRESO` (registrar avance sin cerrar). P.ej. con estado actual
`EN_PROGRESO`: `[{ "hacia": "EN_PROGRESO", "requiereFormulario": true }, { "hacia":
"ATENDIDO", "requiereFormulario": false }]`.

> **No es una regla de negocio fija.** Edgar planea un futuro portal web (tipo Jira)
> donde este workflow —y otras cosas del sistema— se configure desde un backend admin.
> Por eso el mock (`src/mocks/estadoWorkflowMock.ts`) modela esto como datos planos, no
> como lógica embebida: el día que este endpoint exista de verdad, se reemplaza la
> fuente de datos sin tocar los overlays de Cambiar Estado / Registrar Avance.

### `POST /incidencias/{id}/avances`
Request:
```json
{ "motivo": "REASIGNAR_TECNICO", "nota": "Requiere equipo adicional" }
```
`motivo` ∈ `CUADRILLA_EN_SITIO | SE_RESOLVIO | REQUIERE_EQUIPO | DERIVAR_OTRA_AREA |
REASIGNAR_TECNICO | EN_ESPERA | NO_SE_PUDO_ATENDER`.
Response `201`: el nuevo paso de trazabilidad creado (misma forma que el array de §4).

### `PATCH /incidencias/{id}/estado`
Request: `{ "estado": "ATENDIDO" }` → Response `200` con la incidencia actualizada.

### `PATCH /incidencias/{id}/responsable`
Request: `{ "tecnicoId": "u_002" }` → Response `200` con la incidencia actualizada.

---

## 6. Usuarios (Spec 07, selector de responsable)

### `GET /usuarios?rol=tecnico,supervisor&sectorId=`
```json
[
  { "id": "u_001", "nombre": "Juan Gonzales Rubio", "rol": "tecnico",
    "cuadrilla": "Cuadrilla 5", "sector": "Sector 5" },
  { "id": "u_003", "nombre": "María Paredes", "rol": "supervisor", "sector": "Sector 5" }
]
```

---

## 7. Capas de red — Bottom Sheet "Capas" (Spec 04)

### `GET /red/capas?distritoId=&sectorId=&tipos=red_potable,valvulas,buzones`
Response: GeoJSON `FeatureCollection` por tipo de capa, para dibujar líneas/puntos de
infraestructura sobre el mapa. `tipos` posibles: `red_potable`, `valvulas`,
`grifos_contra_incendio`, `red_primaria_desague`, `red_secundaria_desague`, `buzones`.

---

## 8. Dashboard (Spec 09)

### `GET /dashboard/resumen?fechaDesde=&fechaHasta=`
```json
{
  "kpis": {
    "incidenciasAbiertasHoy": 12,
    "incidenciasCriticas": 3,
    "tiempoPromedioAtencionHoras": 18.4,
    "cuadrillasActivas": 5
  },
  "porCategoria": { "agua": 38, "desague": 62 },
  "serieTickets": [ { "mes": "2026-01", "agua": 1180, "desague": 1350 }, ... ],
  "topTiposAtencion": [ { "tipo": "Atoro colectores", "cantidad": 4200 }, ... ],
  "prioridadPorSector": [
    { "sectorId": "s1", "nombre": "Sector 1", "antiguedadPromedioDias": 6 }
  ]
}
```
> Los 4 KPIs de `kpis` son una propuesta, **explícitamente en espera** (decisión de
> Edgar, 2026-07-21 — ver `specs/09-dashboard.md` § 2): el cliente corre sobre mock
> estático mientras tanto, no sobre este cálculo. `porCategoria`, `topTiposAtencion` y
> `prioridadPorSector` sí están implementados en el cliente con datos reales del mock
> de incidencias (no placeholder). `serieTickets` es ilustrativo en ambos lados.

---

## 9. Modelo de errores

Todas las respuestas de error:
```json
{ "error": { "code": "CREDENCIALES_INVALIDAS", "message": "Correo o contraseña incorrectos" } }
```
Códigos usados por la app: `CREDENCIALES_INVALIDAS` (401 login), `TOKEN_EXPIRADO` (401
en cualquier endpoint autenticado, dispara refresh), `VALIDACION` (400, incluye detalle
de campos), `NO_ENCONTRADO` (404), `TRANSICION_INVALIDA` (409, al intentar un cambio de
estado no permitido), `PERMISOS_INSUFICIENTES` (403, agregado en Fase 3 — necesario
para `PATCH /incidencias/{id}/responsable`, restringido a rol `supervisor`; no estaba
en la versión original de este documento).

## 10. Cambios de contrato hechos en Fase 3 (implementación)

- **`PATCH /incidencias/{id}/responsable`**: el payload quedó `{tecnicoId?, areaId?}`
  (ambos opcionales, pero al menos uno requerido) en vez de solo `{tecnicoId}`.
  Confirmado con Edgar: la asignación vive por evento
  (`estado_incidente_evento.usuario_id`/`area_id`, ambos nullable), así que un evento
  puede tocar solo técnico, solo área, o ambos — sin heredar el valor que falte del
  evento anterior. Restringido a rol `supervisor`.
- **`GET /red/capas`**: la respuesta es un objeto `{ "<tipo>": FeatureCollection, ... }`
  con una entrada por cada `tipo` pedido (no un único `FeatureCollection` combinado).
- **`foco`/`quejasAgrupadas` en `GET /incidencias/{id}`** (agregado en la sesión del
  grafo hidráulico): el campo mantiene exactamente el mismo shape (`FocoOut`), pero el
  criterio de agrupación cambió de **proximidad geométrica** (radio 150m / ventana 30
  días, bbox sobre lat/lon) a **causa raíz hidráulica compartida** (mismo tramo de
  desagüe o tubería de agua que alimenta a los suministros reclamantes, resuelto vía
  `sql/grafo_funciones.sql`, ventana 7 días / mínimo 3 reclamos). Ver sección 11.

## 11. Grafo hidráulico — impacto, focos por causa raíz y simulación (nuevo)

Diseño completo en `~/Documentos/grafos_catastro_epsel.md`; funciones SQL en
`sql/grafo_funciones.sql` (schema `gota`, leen `sig.*` cross-schema). Todos requieren
sesión autenticada (`CurrentUser`), igual que el resto de la API.

### `GET /grafo/incidencias/{codigo}/impacto`

Qué afecta una incidencia aguas abajo/arriba, según su `tipo_atencion` (mapeo interno
en `app/modules/grafo/service.py::_MAPA_TIPO_FALLA` — no todos los tipos mapean a una
simulación, ej. "OTROS"/"INSPECCION" devuelven `tipoFalla: null`).

```json
{
  "tipoFalla": "atoro_tramo",
  "elementoTipo": "tramo",
  "elementoId": 10728,
  "afectados": [
    { "suministro": "01183239", "cajaId": 53205, "infraId": 10728,
      "nivel": 0, "horasEstimadas": 4, "prioridad": "ALTA" }
  ]
}
```

### `GET /grafo/focos?tipoRed=agua|desague&dias=7&minReclamos=3`

Focos activos actuales (agrupación por tramo/tubería con reclamos en la ventana dada).

```json
[
  { "infraId": 10728, "tipoRed": "desague", "nReclamos": 11, "nSuministros": 5,
    "primerTicket": "2025-01-02T11:54:18", "ultimoTicket": "2025-12-20T14:01:30",
    "diasActivo": 352.1, "tipoDominante": "ATORO EN COLECTORES Y/O DESBORDE ALCANTARILLADO" }
]
```

### `POST /grafo/simulacion`

Simulación interactiva (modo simulación del mapa): usuario elige un elemento de red +
tipo de falla, se devuelve la lista de suministros afectados (mismo shape que
`afectados` de arriba).

```json
// body
{ "tipoFalla": "fuga_tuberia", "elementoId": 140 }
```
`tipoFalla`: `atoro_tramo | colapso_buzon | falla_conexion | tapa_faltante | fuga_tuberia`.
