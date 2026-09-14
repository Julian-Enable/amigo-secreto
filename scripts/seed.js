/**
 * Genera el sorteo UNA sola vez y lo guarda en Neon.
 *
 *   node scripts/seed.js           -> siembra si la tabla esta vacia
 *   node scripts/seed.js --force   -> borra todo y vuelve a sortear
 *
 * Lee DATABASE_URL de .env.local (lo baja `vercel env pull`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');

// .env.local no es JSON: lo parseamos a mano para no depender de dotenv.
function cargarEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const texto = readFileSync(join(raiz, '.env.local'), 'utf8');
    for (const linea of texto.split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* sin .env.local: esperamos la variable en el entorno */
  }
}

function barajar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Arma un unico ciclo alternando generos: cada persona regala al siguiente de
 * la secuencia y el ultimo al primero. Al ser un ciclo de largo n nadie se
 * regala a si mismo, todos reciben exactamente un regalo, y las repeticiones
 * de genero quedan en el minimo posible: |hombres - mujeres|.
 */
function generarAsignacion(gente) {
  const hombres = barajar(gente.filter((p) => p.genero === 'hombre'));
  const mujeres = barajar(gente.filter((p) => p.genero === 'mujer'));
  const mayoria = hombres.length >= mujeres.length ? hombres : mujeres;
  const minoria = hombres.length >= mujeres.length ? mujeres : hombres;

  const secuencia = [];
  for (let i = 0; i < mayoria.length; i++) {
    secuencia.push(mayoria[i]);
    if (i < minoria.length) secuencia.push(minoria[i]);
  }

  const n = secuencia.length;
  const offset = Math.floor(Math.random() * n);
  const orden = secuencia.map((_, i) => secuencia[(i + offset) % n]);

  return orden.map((p, i) => ({
    nombre: p.nombre,
    genero: p.genero,
    daA: orden[(i + 1) % n].nombre,
  }));
}

function verificar(asignacion, gente) {
  const errores = [];
  if (asignacion.length !== gente.length) errores.push('faltan participantes');
  if (new Set(asignacion.map((a) => a.daA)).size !== gente.length) {
    errores.push('alguien recibe dos regalos o ninguno');
  }
  if (asignacion.some((a) => a.nombre === a.daA)) errores.push('alguien se regala a si mismo');

  const H = gente.filter((p) => p.genero === 'hombre').length;
  const excepciones = asignacion.filter(
    (a) => a.genero === gente.find((p) => p.nombre === a.daA).genero
  ).length;
  if (excepciones !== Math.abs(H - (gente.length - H))) {
    errores.push('excepciones por encima del minimo');
  }
  return errores;
}

async function main() {
  cargarEnv();
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Corre primero: vercel env pull');
    process.exit(1);
  }

  const gente = JSON.parse(readFileSync(join(aqui, 'participantes.json'), 'utf8'));
  if (gente.length < 3) {
    console.error('Se necesitan al menos 3 participantes');
    process.exit(1);
  }
  const duplicados = gente.length - new Set(gente.map((p) => p.nombre)).size;
  if (duplicados) {
    console.error(`Hay ${duplicados} nombre(s) repetido(s) en participantes.json`);
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const forzar = process.argv.includes('--force');

  await sql`
    CREATE TABLE IF NOT EXISTS asignaciones (
      nombre      TEXT PRIMARY KEY,
      genero      TEXT NOT NULL,
      da_a        TEXT NOT NULL,
      orden       INT  NOT NULL,
      revelado    BOOLEAN NOT NULL DEFAULT false,
      revelado_en TIMESTAMPTZ
    )
  `;

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM asignaciones`;
  if (count > 0 && !forzar) {
    const [{ vistos }] = await sql`
      SELECT count(*)::int AS vistos FROM asignaciones WHERE revelado
    `;
    console.log(`Ya hay un sorteo con ${count} participantes (${vistos} ya revelaron).`);
    console.log('Usa --force para borrarlo y sortear de nuevo.');
    return;
  }

  const asignacion = generarAsignacion(gente);
  const errores = verificar(asignacion, gente);
  if (errores.length) {
    console.error('El sorteo salio invalido:', errores.join(', '));
    process.exit(1);
  }

  // Alfabetico para que cada quien encuentre su nombre rapido en la pantalla.
  const alfabetico = [...asignacion].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es')
  );

  await sql`DELETE FROM asignaciones`;
  for (let i = 0; i < alfabetico.length; i++) {
    const a = alfabetico[i];
    await sql`
      INSERT INTO asignaciones (nombre, genero, da_a, orden)
      VALUES (${a.nombre}, ${a.genero}, ${a.daA}, ${i})
    `;
  }

  const H = gente.filter((p) => p.genero === 'hombre').length;
  console.log(`Sorteo listo: ${asignacion.length} participantes`);
  console.log(`Excepciones (mismo genero): ${Math.abs(H - (gente.length - H))}`);
  console.log('Nadie, ni siquiera vos, sabe quien le toco a quien.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
