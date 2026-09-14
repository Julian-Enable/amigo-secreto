import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const MAX_DULCES = 2;
const MAX_REGALOS = 3;
const MAX_LARGO = 120;

// Deja la lista en como maximo `tope` textos limpios y no vacios.
function limpiar(valor, tope) {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim().replace(/\s+/g, ' ').slice(0, MAX_LARGO))
    .filter(Boolean)
    .slice(0, tope);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    // Consultar lo que pidio una persona (lo usa quien le va a regalar).
    if (req.method === 'GET') {
      const nombre = typeof req.query?.nombre === 'string' ? req.query.nombre.trim() : '';
      if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });

      const [fila] = await sql`
        SELECT dulces, regalos FROM preferencias WHERE nombre = ${nombre}
      `;
      return res.status(200).json({
        dulces: fila?.dulces ?? [],
        regalos: fila?.regalos ?? [],
        registrado: Boolean(fila),
      });
    }

    // Guardar lo que uno mismo quiere.
    if (req.method === 'POST') {
      const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
      if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });

      const [existe] = await sql`SELECT 1 FROM asignaciones WHERE nombre = ${nombre}`;
      if (!existe) return res.status(404).json({ error: 'no_existe' });

      const dulces = limpiar(req.body?.dulces, MAX_DULCES);
      const regalos = limpiar(req.body?.regalos, MAX_REGALOS);
      if (!dulces.length && !regalos.length) {
        return res.status(400).json({ error: 'vacio' });
      }

      await sql`
        INSERT INTO preferencias (nombre, dulces, regalos, actualizado)
        VALUES (${nombre}, ${JSON.stringify(dulces)}::jsonb, ${JSON.stringify(regalos)}::jsonb, now())
        ON CONFLICT (nombre) DO UPDATE
        SET dulces = EXCLUDED.dulces,
            regalos = EXCLUDED.regalos,
            actualizado = now()
      `;

      return res.status(200).json({ ok: true, dulces, regalos });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo guardar. Inténtalo de nuevo.' });
  }
}
