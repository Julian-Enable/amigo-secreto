/**
 * Vista privada del organizador: quien le da a quien.
 *
 *   npm run ver
 *
 * Corre SOLO en este PC: se conecta a Neon con la DATABASE_URL de .env.local,
 * que nunca sale de aqui ni esta en el repo. No hay ninguna ruta publica que
 * entregue esta informacion, asi que no hay nada que un tercero pueda abrir.
 *
 * El detalle se escribe en .privado/sorteo.html (ignorado por git) y se abre
 * en el navegador. La consola solo muestra el resumen.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');

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

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function fecha(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Lo que esa persona pidio para si misma (dulces y opciones de regalo).
function listaDeseos(f) {
  const dulces = Array.isArray(f.dulces) ? f.dulces : [];
  const regalos = Array.isArray(f.regalos) ? f.regalos : [];
  if (!dulces.length && !regalos.length) {
    return '<span class="sin">sin escribir</span>';
  }
  const bloque = (etiqueta, items) =>
    items.length
      ? `<div class="deseo"><span class="et">${etiqueta}</span> ${items.map(escapar).join(' · ')}</div>`
      : '';
  return bloque('Dulce', dulces) + bloque('Regalo', regalos);
}

function construirHtml(filas, generoDe) {
  const abiertos = filas.filter((f) => f.revelado).length;
  const total = filas.length;
  const excepciones = filas.filter((f) => f.genero === generoDe[f.da_a]).length;
  const conDeseos = filas.filter(
    (f) => (f.dulces && f.dulces.length) || (f.regalos && f.regalos.length)
  ).length;
  const generado = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const cuerpo = filas
    .map((f, i) => {
      const esExcepcion = f.genero === generoDe[f.da_a];
      return `      <tr${f.revelado ? ' class="abierto"' : ''}>
        <td class="num">${i + 1}</td>
        <td>${escapar(f.nombre)}</td>
        <td class="flecha" aria-hidden="true">→</td>
        <td class="destino">${escapar(f.da_a)}${
          esExcepcion ? ' <span class="tag">mismo género</span>' : ''
        }</td>
        <td class="estado">${
          f.revelado
            ? `<span class="pill pill-si">Abierto</span><span class="cuando">${escapar(fecha(f.revelado_en))}</span>`
            : '<span class="pill pill-no">Pendiente</span>'
        }</td>
        <td class="pidio">${listaDeseos(f)}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sorteo completo · privado</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap">
<style>
  :root {
    color-scheme: light;
    --ground: #fcfcfa;
    --surface: #ffffff;
    --line: #e6e5e0;
    --ink: #17181a;
    --ink-soft: #6f7278;
    --ink-faint: #a3a29d;
    --accent: #b8354f;
    --accent-wash: #fbeef1;
    --done: #4f7a5e;
    --done-wash: #eef5f0;
    --display: "Instrument Serif", ui-serif, Georgia, serif;
    --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--sans);
    background: var(--ground);
    color: var(--ink);
    line-height: 1.5;
    padding: 40px 24px 64px;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 860px; margin: 0 auto; }
  .warn {
    display: flex; align-items: center; gap: 10px;
    background: var(--accent-wash); color: #96263d;
    border-radius: 12px; padding: 13px 16px;
    font-size: 0.89rem; font-weight: 500; margin-bottom: 30px;
  }
  h1 {
    font-family: var(--display); font-weight: 400;
    font-size: clamp(2.2rem, 6vw, 3rem); line-height: 1.05;
    letter-spacing: -0.015em;
  }
  .sub { color: var(--ink-soft); margin-top: 8px; font-size: 0.95rem; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin: 26px 0 22px; }
  .stat {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 12px; padding: 14px 20px; min-width: 116px;
  }
  .stat .n {
    font-family: var(--display); font-size: 2rem; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .stat .l {
    font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--ink-faint); margin-top: 6px; font-weight: 600;
  }
  .tabla-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
  table { border-collapse: collapse; width: 100%; font-size: 0.93rem; }
  th {
    text-align: left; font-size: 0.72rem; text-transform: uppercase;
    letter-spacing: 0.09em; color: var(--ink-faint); font-weight: 600;
    padding: 13px 14px; border-bottom: 1px solid var(--line); white-space: nowrap;
  }
  td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr.abierto { background: var(--done-wash); }
  .num { color: var(--ink-faint); font-variant-numeric: tabular-nums; width: 34px; }
  .flecha { color: var(--ink-faint); width: 20px; text-align: center; }
  .destino { font-weight: 550; color: var(--accent); }
  .tag {
    font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--ink-soft);
    background: var(--ground); border: 1px solid var(--line);
    padding: 2px 7px; border-radius: 100px; margin-left: 5px;
    white-space: nowrap;
  }
  .estado { white-space: nowrap; }
  .pill {
    display: inline-block; font-size: 0.75rem; font-weight: 600;
    padding: 3px 10px; border-radius: 100px;
  }
  .pill-si { background: var(--done); color: #fff; }
  .pill-no { background: var(--ground); color: var(--ink-faint); border: 1px solid var(--line); }
  .cuando { display: block; font-size: 0.72rem; color: var(--ink-faint); margin-top: 3px; }
  .pidio { font-size: 0.82rem; max-width: 300px; }
  .pidio .deseo { margin-bottom: 3px; }
  .pidio .et {
    display: inline-block; font-size: 0.66rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint);
    margin-right: 3px;
  }
  .pidio .sin { color: var(--ink-faint); font-style: italic; }
  footer { margin-top: 28px; font-size: 0.8rem; color: var(--ink-faint); }
  @media print { .warn { border: 1px solid #ccc; } body { padding: 0; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="warn">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
    Archivo privado: contiene todas las asignaciones. No lo compartas ni lo subas a ningún lado.
  </div>

  <h1>Sorteo completo</h1>
  <p class="sub">Generado el ${escapar(generado)} · vista solo para el organizador</p>

  <div class="stats">
    <div class="stat"><div class="n">${total}</div><div class="l">Participantes</div></div>
    <div class="stat"><div class="n">${abiertos}</div><div class="l">Ya abrieron</div></div>
    <div class="stat"><div class="n">${total - abiertos}</div><div class="l">Pendientes</div></div>
    <div class="stat"><div class="n">${excepciones}</div><div class="l">Mismo género</div></div>
    <div class="stat"><div class="n">${conDeseos}</div><div class="l">Ya pidieron</div></div>
  </div>

  <div class="tabla-wrap">
    <table>
      <thead>
        <tr><th>#</th><th>Persona</th><th></th><th>Le da a</th><th>Estado</th><th>Lo que pidió</th></tr>
      </thead>
      <tbody>
${cuerpo}
      </tbody>
    </table>
  </div>

  <footer>Vuelve a correr <code>npm run ver</code> para actualizar el estado.</footer>
</div>
</body>
</html>
`;
}

async function main() {
  cargarEnv();
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Corre primero: vercel env pull');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const filas = await sql`
    SELECT a.nombre, a.genero, a.da_a, a.revelado, a.revelado_en,
           p.dulces, p.regalos
    FROM asignaciones a
    LEFT JOIN preferencias p ON p.nombre = a.nombre
    ORDER BY a.orden
  `;

  if (!filas.length) {
    console.log('Todavia no hay sorteo. Corre: npm run seed');
    return;
  }

  const generoDe = Object.fromEntries(filas.map((f) => [f.nombre, f.genero]));
  const abiertos = filas.filter((f) => f.revelado).length;

  const destino = join(raiz, '.privado');
  mkdirSync(destino, { recursive: true });
  const archivo = join(destino, 'sorteo.html');
  writeFileSync(archivo, construirHtml(filas, generoDe), 'utf8');

  // El detalle va al archivo, no a la consola: asi no queda en el historial.
  const pidieron = filas.filter(
    (f) => (f.dulces && f.dulces.length) || (f.regalos && f.regalos.length)
  ).length;
  console.log(`${filas.length} participantes · ${abiertos} ya abrieron · ${filas.length - abiertos} pendientes`);
  console.log(`${pidieron} ya escribieron lo que quieren · ${filas.length - pidieron} sin escribir`);
  console.log(`\nLista completa: ${archivo}`);

  if (!process.argv.includes('--no-abrir')) {
    spawn('cmd', ['/c', 'start', '', archivo], { detached: true, stdio: 'ignore' }).unref();
    console.log('Abriendo en el navegador…');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
