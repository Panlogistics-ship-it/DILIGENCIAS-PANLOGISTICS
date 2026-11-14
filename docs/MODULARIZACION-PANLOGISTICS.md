# PANLOGISTICS - mapa de modularizacion

Esta rama contiene una copia de trabajo aislada. No se debe integrar a `main` ni desplegar a produccion hasta completar la revision y las pruebas funcionales.

## Punto de entrada

- `index.html`: estructura de pantallas y carga ordenada de hojas de estilo y modulos.
- `assets/js/app.js`: estado global compartido, navegacion entre pantallas y permisos por rol.
- `assets/js/bootstrap.js`: inicializacion de Supabase y arranque de sesion. Debe permanecer como ultimo script local.

## Modulos JavaScript

| Archivo | Responsabilidad |
| --- | --- |
| `modules/core-utils.js` | Fechas, duraciones, moneda y escape de texto |
| `modules/gps.js` | Ubicacion del operador y seguimiento administrativo |
| `modules/diligence-evidence.js` | Seleccion, carga y consulta de fotografias |
| `modules/diligence-signature.js` | Captura y preparacion de firma del cliente |
| `modules/auth-settings.js` | Sesion, autenticacion, configuracion y permisos de ajustes |
| `modules/diligence-form.js` | Validacion y acciones del formulario de diligencias |
| `modules/dashboard.js` | Historial, renderizado del panel y diligencias |
| `modules/dashboard-widgets.js` | Indicadores complementarios del panel |
| `modules/productivity.js` | Calculo del bono quincenal |
| `modules/people-incidents.js` | Perfiles y administracion de usuarios |
| `modules/incidents.js` | Registro y consulta de incidencias |
| `modules/fleet-fuel.js` | Selectores compartidos, evaluadores y vehiculos |
| `modules/fuel-management.js` | Registro y consulta de combustible |
| `modules/evaluations-results.js` | Evaluacion individual de diligencias |
| `modules/reports.js` | Consulta y construccion del reporte quincenal |
| `modules/results.js` | Resultados mensuales y quincenales |
| `modules/report-output.js` | Impresion y exportacion |
| `modules/truck-camera.js` | Camara y seleccion de evidencia del camion |
| `modules/truck-handover.js` | Entrega, devolucion y consulta del control del camion |
| `modules/truck-report.js` | Evidencias e impresion del reporte del camion |

## Reglas de seguridad durante la revision

1. No modificar `main`.
2. No publicar esta rama en Cloudflare.
3. No ejecutar inserciones, actualizaciones ni eliminaciones en Supabase como parte de pruebas preliminares.
4. Mantener las comprobaciones de permisos ADMIN, EVALUADOR y OPERADOR.
5. Si una prueba requiere guardar, usar primero un entorno de prueba o una cuenta/datos de prueba autorizados.

## Validacion automatica

El workflow `.github/workflows/panlogistics-static-check.yml` comprueba:
- Sintaxis de todos los archivos JavaScript con `node --check`.
- Existencia de cada archivo JavaScript local referenciado por `index.html`.
- Orden de carga de dependencias clave y posicion final de `bootstrap.js`.

La ejecucion registrada para el commit `17095a703e55515d33662a5a90d9888f824354f7` finalizo correctamente. Las extracciones posteriores deben volver a pasar el workflow antes de considerarlas validadas.

## Pruebas funcionales pendientes

- Inicio y cierre de sesion para los tres roles.
- Navegacion por todas las pantallas y visibilidad segun permisos.
- Crear, iniciar, finalizar y consultar diligencias en entorno de prueba.
- Seleccion, eliminacion, carga y visualizacion de fotografias.
- Captura, borrado y persistencia de firma.
- Evaluaciones, incidencias y combustible con permisos correctos.
- Reportes PDF, impresion, exportaciones y resultados.
- Control del camion: camara, evidencia, entrega, devolucion e impresion.
- Comprobacion en escritorio y movil, incluyendo recarga y reingreso.

La validacion estatica no sustituye estas pruebas de navegador ni autoriza un despliegue.
