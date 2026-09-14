import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Devuelve solo quien participa y si ya vio su resultado.
// Nunca expone `da_a`: la asignacion sale unicamente por /api/revelar.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const filas = await sql`
      SELECT nombre, revelado
      FROM asignaciones
      ORDER BY orden
    `;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      personas: filas.map((f) => ({ nombre: f.nombre, revelado: f.revelado })),
    });
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo cargar la lista' });
  }
}
