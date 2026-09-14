const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let participants = [];
let assignment = [];
let setupDone = false;

function generateAssignment() {
  const n = participants.length;
  const H = participants.filter(p => p.genero === 'hombre').length;
  const M = participants.filter(p => p.genero === 'mujer').length;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function derange(arr) {
    if (arr.length <= 1) return [...arr];
    for (let attempt = 0; attempt < 1000; attempt++) {
      const r = shuffle(arr);
      let ok = true;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === r[i]) { ok = false; break; }
      }
      if (ok) return r;
    }
    const r = shuffle(arr);
    for (let i = 0; i < r.length - 1; i += 2) {
      [r[i], r[i + 1]] = [r[i + 1], r[i]];
    }
    return r;
  }

  const manIndices = [];
  const womanIndices = [];
  participants.forEach((p, i) => {
    if (p.genero === 'hombre') manIndices.push(i);
    else womanIndices.push(i);
  });

  const M = womanIndices.length;
  const perm = new Array(n).fill(-1);
  const usedReceivers = new Set();

  const shuffledHombres = shuffle(participants.filter(p => p.genero === 'hombre'));
  const shuffledMujeres = shuffle(participants.filter(p => p.genero === 'mujer'));

  const menGiveToWomen = manIndices.slice(0, M);
  const menGiveToMen = manIndices.slice(M);

  const menForWomen = shuffle(manIndices.slice(0, M)).map(i => i);
  const womanTargets = derange(menForWomen);
  for (let i = 0; i < M; i++) {
    perm[womanIndices[i]] = womanTargets[i];
    usedReceivers.add(womanTargets[i]);
  }

  const womenForMen = shuffle(womanIndices).slice(0, M);
  const manTargetsForWomen = derange(womenForMen);
  for (let i = 0; i < M; i++) {
    perm[menGiveToWomen[i]] = manTargetsForWomen[i];
    usedReceivers.add(manTargetsForWomen[i]);
  }

  const remainingMen = menGiveToMen;
  const availableReceivers = [];
  for (let i = 0; i < n; i++) {
    if (!usedReceivers.has(i)) availableReceivers.push(i);
  }

  if (remainingMen.length === 1 && availableReceivers.length >= 2) {
    const swapTarget = menGiveToWomen[0];
    const temp = perm[swapTarget];
    perm[remainingMen[0]] = temp;
    perm[swapTarget] = remainingMen[0];
  } else if (remainingMen.length > 1) {
    let targets = [...availableReceivers];
    let deranged = derange(targets.map((_, i) => i)).map(i => targets[i]);
    for (let i = 0; i < remainingMen.length; i++) {
      if (remainingMen[i] === deranged[i]) {
        for (let j = 0; j < deranged.length; j++) {
          if (remainingMen[j] !== deranged[i] && remainingMen[i] !== deranged[j]) {
            [deranged[i], deranged[j]] = [deranged[j], deranged[i]];
            break;
          }
        }
      }
    }
    for (let i = 0; i < remainingMen.length; i++) {
      perm[remainingMen[i]] = deranged[i];
    }
  }

  for (let i = 0; i < n; i++) {
    if (perm[i] === i) {
      for (let j = 0; j < n; j++) {
        if (perm[j] !== i && perm[i] !== j && perm[j] !== j) {
          [perm[i], perm[j]] = [perm[j], perm[i]];
          break;
        }
      }
    }
  }

  assignment = participants.map((p, i) => {
    const receiver = participants[perm[i]];
    return { nombre: p.nombre, genero: p.genero, daAM: receiver.nombre, generoDA: receiver.genero };
  });

  setupDone = true;
  return assignment;
}

app.post('/api/setup', (req, res) => {
  const { people } = req.body;
  if (!people || people.length < 3) return res.status(400).json({ error: 'Se necesitan al menos 3 personas' });
  participants = people;
  assignment = [];
  setupDone = false;
  res.json({ success: true, count: people.length });
});

app.post('/api/generate', (req, res) => {
  try {
    const result = generateAssignment();
    const exceptions = result.filter(a => {
      const receiver = result.find(x => x.nombre === a.daAM);
      return receiver && a.genero === receiver.genero;
    }).length;
    res.json({ assignment: result, exceptions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/reveal', (req, res) => {
  const { nombre } = req.body;
  if (!setupDone || assignment.length === 0) return res.status(400).json({ error: 'Aún no se ha generado el sorteo' });
  const person = assignment.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
  if (!person) return res.status(404).json({ error: 'Persona no encontrada' });
  res.json({ nombre: person.nombre, daA: person.daAM, esExcepcion: person.genero === person.generoDA });
});

app.get('/api/estado', (req, res) => res.json({ setupDone, count: participants.length }));
app.get('/api/asignacion', (req, res) => {
  if (!setupDone || assignment.length === 0) return res.status(400).json({ error: 'Aún no se ha generado el sorteo' });
  res.json({ assignment });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.listen(PORT, () => { console.log(`🎁 Amigo Secreto corriendo en puerto ${PORT}`); });
module.exports = app;
