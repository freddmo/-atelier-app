# ATELIER — Sistema de Operaciones

Sistema interno de gestión para la reventa de uniformes médicos **FIGS** importados a Ecuador. Centraliza pedidos, clientes, inventario, costos, pagos y reportes de ganancia en una sola herramienta web, conectada a una base de datos en Google Sheets.

> **Estado:** en producción y uso diario. Backend `Code.gs` v4.0.

---

## Tabla de contenidos

1. [¿Qué es ATELIER?](#qué-es-atelier)
2. [Cómo funciona el negocio](#cómo-funciona-el-negocio)
3. [Arquitectura general](#arquitectura-general)
4. [Estructura del repositorio (frontend)](#estructura-del-repositorio-frontend)
5. [Modelo de datos (las tablas del Sheet)](#modelo-de-datos-las-tablas-del-sheet)
6. [Estados de un pedido](#estados-de-un-pedido)
7. [Funcionalidades principales](#funcionalidades-principales)
8. [Cómo se calculan los costos y la ganancia](#cómo-se-calculan-los-costos-y-la-ganancia)
9. [Inventario: lotes, movimientos y courier](#inventario-lotes-movimientos-y-courier)
10. [Casos especiales](#casos-especiales)
11. [La capa de API (`lib/api.ts`)](#la-capa-de-api-libapits)
12. [Roles y permisos](#roles-y-permisos)
13. [Despliegue](#despliegue)
14. [Reglas y convenciones importantes](#reglas-y-convenciones-importantes)
15. [Problemas conocidos y pendientes](#problemas-conocidos-y-pendientes)
16. [Glosario](#glosario)

---

## ¿Qué es ATELIER?

ATELIER es la columna vertebral operativa del negocio. Antes, los pedidos se llevaban a mano (hojas sueltas, mensajes, memoria); ahora todo el ciclo de una venta vive en un solo lugar:

- Registrar una clienta y su pedido.
- Comprar el uniforme a FIGS (o sacarlo de stock).
- Seguir el viaje del paquete (Estados Unidos → Ecuador → bodega → cliente).
- Empacar con su regalo/pin.
- Cobrar (abonos y saldos).
- Entregar.
- Y al final, saber **cuánto se ganó de verdad** en cada pedido, descontando producto, courier, empaque, regalos y delivery.

El objetivo no es solo registrar, sino que las cuentas cuadren: cada dólar de costo y cada dólar de venta tiene su lugar.

---

## Cómo funciona el negocio

El flujo típico de un pedido:

1. **La clienta pide** un uniforme (normalmente un *set*: top + pantalón) por WhatsApp.
2. **Se registra el pedido** en ATELIER con la clienta, las prendas, tallas, colores y el precio de venta.
3. **Se compra a FIGS** en Estados Unidos. La factura de FIGS es el costo bruto.
4. **El paquete viaja**: de FIGS a una bodega en Florida, luego a Ecuador vía courier, luego a la bodega local.
5. **Llega a Ecuador**, se revisa, se empaca con su regalo/pin temático.
6. **Se entrega** a la clienta (delivery local o agencia tipo Servientrega).
7. **Se cobra**: las clientas suelen abonar el 50% al inicio y el resto contra entrega.

A veces el uniforme no se compra a FIGS sino que ya está en **stock** (inventario comprado por adelantado). En ese caso el costo sale del lote de stock, no de una factura nueva.

---

## Arquitectura general

ATELIER tiene tres piezas:

```
┌─────────────────────┐      HTTPS (action=...)      ┌──────────────────────┐
│  Frontend (Next.js)  │ ───────────────────────────▶ │  Backend (Apps Script)│
│  TypeScript / React  │                              │     Code.gs v4.0      │
│   Desplegado en      │ ◀─────────────────────────── │   (Web App / doGet)   │
│      Vercel          │         JSON                 └───────────┬──────────┘
└─────────────────────┘                                          │
                                                                  │ lee/escribe
                                                                  ▼
                                                      ┌──────────────────────┐
                                                      │   Google Sheets       │
                                                      │ "Atelier - Operaciones"│
                                                      │   (la base de datos)   │
                                                      └──────────────────────┘
```

### Backend — Google Apps Script (`Code.gs`)
- Es el cerebro. Toda la lógica de negocio vive aquí.
- Está desplegado como **Web App** (se accede por una URL).
- Recibe peticiones con un parámetro `action=NOMBRE` (por ejemplo `action=crearPedido`) y responde en JSON.
- Lee y escribe directamente sobre las pestañas del Google Sheet.
- El Sheet de datos es **"Atelier - Operaciones v2"**.

### Base de datos — Google Sheets
- Cada "tabla" es una pestaña del Sheet.
- No es una base de datos tradicional: son filas y columnas. Por eso muchas reglas de integridad las hace el código a mano (no hay llaves foráneas reales).

### Frontend — Next.js + TypeScript (Vercel)
- La interfaz que usa el equipo desde el celular o la computadora.
- Repositorio en GitHub: **`freddmo/-atelier-app`**.
- Se despliega automáticamente en **Vercel** con cada `git push`.
- Habla con el backend a través de la capa `lib/api.ts`.

---

## Estructura del repositorio (frontend)

```
-atelier-app/
├── app/                        # Páginas (Next.js App Router)
│   ├── pedidos/                # Lista de todos los pedidos
│   ├── pedido/[id]/            # Detalle de un pedido (la pantalla central)
│   ├── nuevo-pedido/           # Crear pedido + gestionar clientas
│   ├── stock/                  # Inventario: lotes, materiales, pines
│   └── reportes/               # Reportes de ganancia
│
├── components/                 # Componentes reutilizables
│   ├── OrderCard.tsx           # Tarjeta de pedido (en la lista)
│   ├── StateModal.tsx          # Cambiar el estado de un pedido completo
│   ├── ItemsStateModal.tsx     # Entregar / mover ítems uno por uno
│   └── PerdidaTransitoModal.tsx# Registrar pérdidas en tránsito
│
├── lib/                        # Lógica compartida del cliente
│   ├── api.ts                  # TODAS las llamadas al backend pasan por aquí
│   ├── types.ts                # Tipos TypeScript compartidos
│   └── auth.ts                 # Sesión del usuario
│
└── app/globals.css             # Estilos globales y colores de estado
```

La pantalla más importante es **`app/pedido/[id]/page.tsx`**: el detalle de un pedido. Desde ahí se registran pagos, se aplican descuentos, se cambian estados, se entregan ítems y se manejan los casos especiales.

---

## Modelo de datos (las tablas del Sheet)

Todas las pestañas se referencian en el backend desde un objeto `TABS`. Estas son las principales:

| Clave en `TABS` | Pestaña en el Sheet | Para qué sirve |
|---|---|---|
| `ordenes` | `TablaOrdenes` | La cabecera de cada pedido (cliente, estado, totales). |
| `items` | `TablaItems` | Cada prenda dentro de un pedido. |
| `costos` | `TablaCostos` | Todos los costos (bruto, courier, empaque, regalo, delivery) y descuentos. |
| `pagos` | `TablaPagos` | Abonos y devoluciones de cada pedido. |
| `descuentos` | `TablaDescuentos` | Descuentos aplicados (también se reflejan como costo negativo). |
| `clientes` | `TablaClientes` | Datos de cada clienta. |
| `productos` | `TablaProductos` | Catálogo de prendas (SKU → nombre). |
| `sets` | `TablaSets` | Definición de sets (combos de prendas). |
| `regalos` | `TablaRegalos` | Pines y regalos temáticos (PIN-001…). |
| `empaque` | `TablaEmpaqueEstandar` | Costo del empaque estándar. |
| `setEmpaque` | `TablaSetEmpaque` | Tipos de empaque disponibles. |
| `couriers` | `TablaCouriers` | Datos de couriers/transportes. |
| `combos` | `TablaCombos` | Combos de productos. |
| `lotes` | `TablaLotesStock` | Inventario: cada lote físico comprado. |
| `movimientos` | `TablaMovimientosStock` | Entradas y salidas de inventario. |
| `usuarios` | `TablaUsuarios` | Usuarios del sistema y sus roles. |
| `log` | `TablaLog` | Bitácora de cambios importantes. |
| `industrias` | `TablaIndustrias` | Industrias (para sugerir el pin adecuado). |

### `TablaOrdenes` (la cabecera del pedido)
Columnas clave: `ORDEN_ID`, `F_ORDEN`, `CLIENTE_NOMBRE`, `ESTATUS_ENVIO`, `F_ENTREGA_EST`, `TIPO_DE_ORDEN`, `PROVEEDOR`, `NUM_ORDEN_PROV`, `METODO_ENVIO`, `COURIER`, `REGALO_ENVIADO`, `NOTAS`, `TOTAL_BRUTO`, `TOTAL_DESCUENTOS`, `TOTAL_VENTA`, `TOTAL_PAGADO`, `SALDO`, `ESTADO_PAGO`, `TOTAL_COSTOS`, `GANANCIA`, `ESTA_ACTIVA`, `TIPO_EMPAQUE`, `F_ENTREGA_REAL`, `PRIORIDAD`.

> ⚠️ Varias columnas de totales (`TOTAL_VENTA`, `TOTAL_COSTOS`, `GANANCIA`, etc.) son **valores guardados** que pueden quedar desactualizados. La pantalla de detalle recalcula los totales en vivo desde los ítems y costos (`enrichOrden`). Si el número guardado y el de la pantalla difieren, el de la pantalla es el real.

### `TablaItems` (las prendas)
Columnas: `ORDEN_ID`, `SKU`, `NOMBRE_PRODUCTO`, `TIPO_PRENDA`, `TALLA`, `LONGITUD`, `COLOR`, `CANTIDAD`, `PRECIO_VENTA`, `PARTE_DE_SET`, `COSTO_UNITARIO`, `SUBTOTAL`, `ORIGEN`, `ESTATUS_ITEM`, `ENTREGADO_ITEM`, `COURIER_ITEM`.

- Un **set** son dos ítems unidos por el mismo valor en `PARTE_DE_SET` (ej. "SET ISABEL").
- `ESTATUS_ITEM`: el estado individual de esa prenda (puede ir distinto a la cabecera en pedidos mixtos).
- `ENTREGADO_ITEM`: `TRUE`/`FALSE`, si esa prenda específica ya se entregó.
- `COURIER_ITEM`: `TRUE` cuando a esa prenda ya se le cargó courier (evita doble cobro).
- `ORIGEN`: de dónde salió la prenda (factura nueva, o `STOCK`/lote).

### `TablaCostos`
Columnas: `TIPO_REFERENCIA` (`PEDIDO` o `LOTE_STOCK`), `REFERENCIA_ID`, `FECHA`, `TIPO_COSTO`, `DESCRIPCION`, `MONTO`, `ORIGEN`.

- `TIPO_COSTO` puede ser: `BRUTO` (el producto), `COURIER`, `EMPAQUE`, `REGALO`, `DELIVERY`.
- Los **descuentos** se guardan como un `MONTO` **negativo**.
- Un mismo producto comprado por factura y metido a stock puede tener su costo registrado bajo el lote (`LOTE_STOCK`) — cuidado con no duplicarlo también en el pedido.

### `TablaPagos`
Columnas: `ORDEN_ID`, `FECHA_PAGO`, `MONTO`, `METODO`, `URL_COMPROBANTE`, `NOTAS`.

- Una **devolución** se registra como una **fila nueva con `MONTO` negativo** (nunca se borra ni edita el pago original). Así queda el rastro de que la plata entró y luego salió.

### `TablaLotesStock`
Columnas: `LOTE_ID`, `SKU`, `TALLA`, `LONGITUD`, `COLOR`, `COSTO_UNITARIO`, `CANT_INICIAL`, `CANT_DISPONIBLE`, `TIPO_REFERENCIA_ENTRADA`, `REFERENCIA_ID_ENTRADA`, `FECHA_ENTRADA`, `USUARIO_ENTRADA`, `NOTAS`, `ESTADO_VIAJE`, `TRACKING`, `TRANSPORTE`, `COURIER`, `FECHA_SALIDA_EC`, `ETA_MIN`, `ETA_MAX`.

### `TablaMovimientosStock`
Columnas: `MOV_ID`, `FECHA_HORA`, `LOTE_ID`, `TIPO_MOVIMIENTO` (`ENTRADA` / `SALIDA` / `DEVOLUCION`), `CANTIDAD`, `TIPO_REFERENCIA`, `REFERENCIA_ID`, `USUARIO`, `NOTAS`.

### `TablaRegalos` (pines)
Columnas: `REGALO_ID`, `NOMBRE`, `INDUSTRIA_SUGERIDA`, `STOCK`, `STOCK_MINIMO`, `COSTO_UNITARIO`. Los pines van numerados `PIN-001`, `PIN-002`, …

---

## Estados de un pedido

El campo `ESTATUS_ENVIO` (y `ESTATUS_ITEM` por prenda) sigue esta secuencia. Internamente se conoce como `VALID_STATES`:

| Estado | Significado |
|---|---|
| `HACER PEDIDO` | Registrado, falta comprarlo a FIGS. |
| `PEDIDO HECHO` | Ya se compró a FIGS. |
| `EN TRANSITO A FL` | Viajando a la bodega de Florida. |
| `CON FREDDY` | En manos del intermediario en EE.UU. |
| `EN CAMINO A EC` | Rumbo a Ecuador. |
| `EN BODEGA EC` | Llegó a la bodega local. |
| `LISTO PARA ENVIAR` | Empacado y listo para entregar. |
| `ENTREGADO` | Recibido por la clienta. |
| `CANCELADO` | Anulado. |
| `ENTREGA PARCIAL` | Parte del pedido entregado (pedidos mixtos). |

Cada estado tiene su **color propio** en la interfaz (definidos en `globals.css`), para reconocerlos de un vistazo.

**Reglas importantes del flujo:**
- A `ENTREGADO` **solo se llega por "Entregar ítems"** (no por "Cambiar estado"). Esto es a propósito: "Entregar ítems" es el único camino que permite cobrar el delivery y marca cada prenda correctamente.
- En un **pedido mixto** (prendas de distintas facturas o con un ítem cancelado), cada prenda puede ir en un estado distinto; la cabecera toma el estado del ítem "más atrasado" que siga vivo.
- Los ítems `CANCELADO` se ignoran en los totales y no aparecen en la pantalla de entrega.

---

## Funcionalidades principales

### Pedidos
- Crear pedido con una o varias prendas (sets o sueltas).
- Editar los datos de la clienta directamente desde el pedido (dirección, ciudad, teléfono, etc.).
- Ver el detalle completo: prendas, costos, pagos, saldo, recorrido del envío.
- Copiar mensajes de WhatsApp (confirmación de pedido / cobro de saldo).

### Pagos y descuentos
- Registrar abonos.
- Aplicar un **descuento de último minuto** (se guarda como costo negativo y baja el saldo en vivo).
- Registrar **devoluciones** (fila de pago con monto negativo).

### Estados y entrega
- **Cambiar estado** del pedido completo (hasta `LISTO PARA ENVIAR`).
- **Entregar ítems**: marcar prendas como entregadas una por una, con opción de cobrar el **delivery** (escribe la fila de costo `DELIVERY` y, cuando todo lo vivo queda entregado, pasa la cabecera a `ENTREGADO` y graba la fecha real).
- Opciones **sin empaque** y **sin pin** cuando aplica.

### Inventario / Stock
- Registrar lotes comprados a FIGS.
- Vender desde stock al crear un pedido.
- Gestionar pines y regalos (con su stock).
- Cargar costo de **courier** repartido entre los ítems/lotes que llegaron en un mismo envío.

### Reportes
- Reporte de ganancia que cuenta solo pedidos con producto real, excluye ítems cancelados y descuenta todos los costos asociados.

---

## Cómo se calculan los costos y la ganancia

La **ganancia** de un pedido es:

```
GANANCIA = TOTAL_VENTA − TOTAL_COSTOS
```

Donde:

- **TOTAL_VENTA** = suma de `PRECIO_VENTA` de los ítems **vivos** (no cancelados).
- **TOTAL_COSTOS** = suma de todas las filas de `TablaCostos` de ese pedido:
  - `BRUTO` (lo que costó el producto en FIGS o en stock)
  - `COURIER` (envío internacional, repartido por prenda)
  - `EMPAQUE` (empaque estándar)
  - `REGALO` (el pin/regalo)
  - `DELIVERY` (entrega local, se carga al entregar)
  - menos los **descuentos** (que entran como monto negativo)

La función `enrichOrden` en el backend recalcula esto en vivo cuando abres un pedido, sumando los costos cuyo `TIPO_REFERENCIA = PEDIDO` y `REFERENCIA_ID` coincide.

> **Punto clave:** un pedido puede verse "cuadrado" en sus totales guardados pero estar mal por dentro (ítem fantasma, costo duplicado, courier doble). Por eso la verdad siempre se reconstruye desde `TablaItems` + `TablaCostos` + `TablaPagos`, no desde los números guardados en la cabecera.

---

## Inventario: lotes, movimientos y courier

### Lotes
Cada compra que **no** va directo a una clienta entra como un **lote** en `TablaLotesStock`, con su costo, cantidad y estado de viaje. Cuando se vende desde stock, baja `CANT_DISPONIBLE`.

### Movimientos
Cada `ENTRADA`, `SALIDA` o `DEVOLUCION` de inventario queda registrada en `TablaMovimientosStock`, con su lote, cantidad y a qué pedido se asoció. Es el rastro de auditoría del inventario.

### Courier (y el cuidado con el doble cobro)
El courier internacional se reparte entre las piezas que llegaron en un mismo envío (proporcional al número de piezas). Cuando a una prenda se le carga courier, debe quedar `COURIER_ITEM = TRUE` para que **no vuelva a aparecer** en la cola de "pendientes de courier".

- El camino normal (pantalla "Cargar envío courier") marca la bandera correctamente.
- El courier cargado por vías retroactivas o **manuales** puede no prender la bandera → la prenda reaparece en la cola y existe el riesgo de **cobrarle courier dos veces**.
- ⚠️ **Nunca distribuyas courier a una prenda que ya tiene su costo de courier en `TablaCostos`.** Si reaparece, lo correcto es marcar la bandera `COURIER_ITEM = TRUE`, no volver a cobrar.

---

## Casos especiales

El sistema tiene flujos dedicados para situaciones que rompen el camino normal:

### "Cambiar ítem por error"
Cuando **llegó una prenda equivocada** y la tienes físicamente. Manda lo que llegó a **stock** (para revender), cancela el ítem original del pedido, lo re-pide, y quita el costo bruto viejo. **Esta función SÍ crea un lote de stock** con lo que llegó mal.

> Cuidado: el modal viene pre-llenado con los datos del ítem original. Si no cambias la sección "lo que llegó por error", manda a stock una copia del ítem pedido (un fantasma). Úsalo solo cuando de verdad llegó algo físico distinto.

### "Pérdida en tránsito"
Cuando una prenda registrada **se perdió en el camino** a Ecuador. A diferencia de "cambiar por error", **no manda nada a stock** (no hay prenda física). Por cada ítem perdido permite elegir:
- **FIGS repone** → se borra el costo bruto (no es pérdida tuya).
- **Pérdida mía** → el costo se queda.

Permite cambiar modelo/talla/color del reemplazo, edita el mismo ítem en sitio (conserva el precio de venta), lo regresa a `HACER PEDIDO` para re-pedirlo, y limpia el costo y el courier viejos. **Nunca toca `TablaLotesStock`.**

### Devoluciones de dinero
Siempre como fila nueva en `TablaPagos` con monto negativo. Nunca borrar el pago original.

### Cancelaciones y datos ficticios
Cancelar un pedido normal solo marca los ítems como `CANCELADO`. Borrar registros completamente ficticios (facturas inventadas, ítems fantasma) se hace **a mano** en las tablas, con cuidado — no hay (ni conviene) una función automática para esto, porque un borrado mal hecho destruiría datos reales.

---

## La capa de API (`lib/api.ts`)

Todo el frontend habla con el backend **únicamente** a través de `lib/api.ts`. Cada función arma una llamada a la URL del Apps Script con su `action` correspondiente. Ejemplos de acciones disponibles:

- `crearPedido`, `getPedido`, `getPedidos`
- `registrarPago`, `agregarDescuento`
- `cambiarEstado`, `cambiarEstadoItems`
- `actualizarCliente`
- `cambiarItemPorError`, `perdidaEnTransito`
- `getRegalos`, `agregarPin`, `getSetEmpaque`, `getProductos`
- `getReporteGanancia`

Si necesitas una nueva operación, el patrón es:
1. Escribir la función en `Code.gs` (backend).
2. Añadir su ruta en el `doGet` (el `if (action === '...')`).
3. Añadir el método correspondiente en `lib/api.ts`.
4. Usarlo desde el componente.

---

## Roles y permisos

Definidos en `lib/types.ts` como `Rol`:

| Rol | Quién | Para qué |
|---|---|---|
| `admin` | Freddy | Acceso total, incluye operaciones sensibles (forzar estados, pérdidas, etc.). |
| `coordinador` | — | Gestión de pedidos. |
| `marketing` | Mildred | Ventas y marketing. |
| `bodega` | Sebastián | Empaque y manejo físico. |

Algunas operaciones (como forzar la entrega con saldo pendiente, o registrar una pérdida) verifican que el usuario sea **admin**.

---

## Despliegue

### Backend (Google Apps Script)
Tras cualquier cambio en `Code.gs`:
1. Pegar el código actualizado en el editor de Apps Script.
2. **Implementar → Administrar implementaciones**.
3. Editar la implementación activa (ícono del lápiz) → **Nueva versión** → Implementar.

> Si no se crea una **versión nueva**, los cambios no salen a producción.

### Frontend (Next.js / Vercel)
Tras cualquier cambio en el código del repo:
1. `git push` a la rama principal.
2. Vercel detecta el push y despliega automáticamente.
3. Esperar a que el deploy quede en **verde**.
4. En el navegador, recargar con **Ctrl + Shift + R** (recarga forzada) para ver los cambios.

---

## Reglas y convenciones importantes

Cosas que hay que respetar para no romper el sistema:

- **Apps Script es JavaScript puro, NO TypeScript.** Nunca pongas anotaciones de tipo (`: string`, `: Record<string,string>`, `: string[]`) dentro de funciones del backend. Da error de sintaxis (`Missing initializer in const declaration`).
- **Los totales guardados pueden mentir.** La verdad se reconstruye desde los ítems, costos y pagos. Cuando algo no cuadre, audita esas tres tablas.
- **Las devoluciones nunca borran el pago original** — siempre fila nueva con monto negativo.
- **Cuidado con el doble cobro de courier** — revisa `COURIER_ITEM` antes de distribuir.
- **No dupliques costos** entre el lote (`LOTE_STOCK`) y el pedido (`PEDIDO`) para una misma prenda.
- **A `ENTREGADO` solo se llega por "Entregar ítems"**, para que el delivery siempre se registre.
- Los **ítems cancelados** se conservan (no se borran) cuando se quiere dejar rastro; se borran solo cuando el registro era completamente ficticio.

---

## Problemas conocidos y pendientes

Lista viva de cosas a mejorar o vigilar:

- **Remanentes de `COURIER_ITEM`:** pedidos viejos (anteriores al fix) con courier cobrado pero la bandera vacía; aparecen en la cola de courier. Se corrigen marcando la bandera a mano (limpieza de una sola vez).
- **Inconsistencias de cabecera:** algunos pedidos con `ESTA_ACTIVA = TRUE` estando entregados; fechas `F_ENTREGA_REAL` faltantes; pedidos marcados `ENTREGADO` con saldo pendiente.
- **Tracking automático en pedidos:** hoy el auto-avance de estados por tracking (FedEx) existe para **lotes**, pero falta cablearlo a los **pedidos** (un pedido puede tener prendas de varias facturas/trackings).
- **Botón "Cancelar ítem / devolución":** función propuesta para cuando una clienta cancela una prenda que sí existe (reembolso + opción de stock), parecido a "Pérdida en tránsito".
- **`ULTIMA_COMPRA`** en `TablaClientes` muestra números en lugar de fechas.
- **Comparador/planificador de courier** (pestaña para elegir el envío más conveniente).
- **Mayúsculas automáticas** al crear pedido (hoy hay una función manual).
- **Parser de WhatsApp** para autollenar pedidos desde el mensaje de la clienta.

---

## Glosario

| Término | Significado |
|---|---|
| **FIGS** | Marca de uniformes médicos que se revende. |
| **Set** | Combo de prendas (típicamente top + pantalón). |
| **Bruto** | El costo del producto antes de courier, empaque, etc. |
| **Lote** | Una compra de inventario registrada en stock. |
| **Courier** | Envío internacional (EE.UU. → Ecuador). |
| **Delivery** | Entrega local dentro de Ecuador. |
| **Pin / regalo** | Detalle temático que se incluye en el empaque. |
| **Abono** | Pago parcial de la clienta. |
| **Saldo** | Lo que falta por pagar. |
| **Pedido mixto** | Pedido cuyas prendas van en estados distintos. |

---

*Documento de referencia del sistema ATELIER. Mantener actualizado cuando cambie la lógica del backend o se agreguen funcionalidades.*
