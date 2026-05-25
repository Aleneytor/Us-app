# Plan de implementacion: acciones por voz

## Objetivo

Permitir que el boton `+` tenga dos modos:

- Toque normal: mantiene el menu actual para crear movimiento, categoria, plan o ahorro.
- Pulsacion larga: cambia el icono a modo grabacion, muestra el menu principal sin oscurecer toda la app y escucha lo que el usuario dice para crear un registro automaticamente.

## Alcance inicial sin IA

La primera version usa reconocimiento de voz del dispositivo y un parser local por reglas. No envia audio ni texto a servicios de IA.

Acciones soportadas:

- Movimiento: gastos e ingresos con monto, titulo, frecuencia, fecha simple y categoria sugerida.
- Categoria: nombre, presupuesto mensual opcional y visibilidad personal.
- Ahorro: titulo, monto objetivo, plazo en meses opcional y tipo personal/conjunto.
- Plan: titulo, descripcion simple, participantes mencionados y division por partes iguales.

## Flujo UX

1. El usuario mantiene presionado el boton `+`.
2. El icono cambia a un circulo de grabacion.
3. El menu de creacion aparece como referencia, sin blur oscuro.
4. La app pide permisos de microfono/reconocimiento si faltan.
5. Mientras escucha, muestra el texto reconocido y la accion que parece detectar.
6. Al soltar el boton, detiene la escucha e intenta crear el objeto.
7. Si falta informacion critica, muestra una alerta con ejemplos de frases.

## Motor de interpretacion local

El parser se basa en:

- Trigger words de intencion: `gaste`, `pague`, `ingreso`, `crear categoria`, `quiero ahorrar`, `crear plan`, etc.
- Extraccion de montos: digitos, decimales, monedas y numeros comunes en palabras.
- Extraccion de frecuencia: unico, semanal, quincenal, mensual.
- Extraccion de fechas simples: hoy, ayer, manana.
- Contexto del payload: categorias existentes, catalogo de iconos y usuarios/pareja.

## Frases objetivo

- "Gaste 25 euros en supermercado hoy"
- "Pague renta mensual de 800"
- "Ingreso sueldo 1500"
- "Crea categoria restaurantes con presupuesto 300"
- "Quiero ahorrar 1200 para vacaciones en 6 meses"
- "Crea un plan viaje a Madrid con Gabi y Ana"

## Preparacion para IA futura

El codigo queda dividido en dos capas:

- `speech recognition`: captura el texto hablado.
- `voice action parser`: transforma texto + contexto en un draft estructurado.

Cuando se conecte IA, puede reemplazar o complementar el parser local devolviendo la misma estructura de accion.
