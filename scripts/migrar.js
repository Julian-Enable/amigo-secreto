/**
 * Crea la tabla de preferencias (dulces y regalos). NO toca `asignaciones`.
 *
 *   npm run migrar
 *
 * Es seguro correrlo con el juego en marcha y repetirlo las veces que sea.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

function cargarEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const texto = readFileSync(join(raiz, '.env.local'), 'utf8');
    for (const linea of texto.split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* sin .env.local */
  }
}

async function main() {
  cargarEnv();
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Corre primero: vercel env pull');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const [{ antes }] = await sql`SELECT count(*)::int AS antes FROM asignaciones`;
  const [{ abiertas }] = await sql`SELECT count(*)::int AS abiertas FROM asignaciones WHERE revelado`;

  await sql`
    CREATE TABLE IF NOT EXISTS preferencias (
      nombre      TEXT PRIMARY KEY,
      dulces      JSONB NOT NULL DEFAULT '[]'::jsonb,
      regalos     JSONB NOT NULL DEFAULT '[]'::jsonb,
      actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const [{ despues }] = await sql`SELECT count(*)::int AS despues FROM asignaciones`;
  const [{ siguen }] = await sql`SELECT count(*)::int AS siguen FROM asignaciones WHERE revelado`;
  const [{ prefs }] = await sql`SELECT count(*)::int AS prefs FROM preferencias`;

  console.log('Tabla `preferencias` lista.');
  console.log(`Asignaciones: ${antes} -> ${despues} (intactas: ${antes === despues})`);
  console.log(`Ya abrieron:  ${abiertas} -> ${siguen} (intactas: ${abiertas === siguen})`);
  console.log(`Preferencias guardadas hasta ahora: ${prefs}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
