import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Reclama el nombre y devuelve la asignacion. El UPDATE ... WHERE NOT revelado
// es atomico: si dos personas tocan el mismo nombre a la vez, solo una fila
// vuelve con RETURNING y la otra recibe "ya_revelado". Sin condiciones de carrera.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!nombre) {
    return res.status(400).json({ error: 'Falta el nombre' });
  }

  try {
    const [fila] = await sql`
      UPDATE asignaciones
      SET revelado = true, revelado_en = now()
      WHERE nombre = ${nombre} AND revelado = false
      RETURNING da_a
    `;

    res.setHeader('Cache-Control', 'no-store');

    if (fila) {
      return res.status(200).json({ daA: fila.da_a });
    }

    // No hubo fila: o el nombre no existe, o alguien ya lo reclamo.
    const [existe] = await sql`
      SELECT 1 FROM asignaciones WHERE nombre = ${nombre}
    `;
    if (!existe) {
      return res.status(404).json({ error: 'no_existe' });
    }
    return res.status(409).json({ error: 'ya_revelado' });
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo completar la revelación' });
  }
}
