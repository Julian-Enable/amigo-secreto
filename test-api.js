const http = require('http');

const testData = {
  people: [
    {nombre: 'Juan (hombre)', genero: 'hombre'},
    {nombre: 'Maria (mujer)', genero: 'mujer'},
    {nombre: 'Pedro (hombre)', genero: 'hombre'},
    {nombre: 'Ana (mujer)', genero: 'mujer'},
    {nombre: 'Luis (hombre)', genero: 'hombre'}
  ]
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/setup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Setup:', data);
    
    // Now generate
    const genOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/generate',
      method: 'POST'
    };
    const genReq = http.request(genOptions, (res2) => {
      let data2 = '';
      res2.on('data', (chunk) => { data2 += chunk; });
      res2.on('end', () => {
        const genData = JSON.parse(data2);
        console.log('Generated! Exceptions:', genData.assignment.filter(a => {
          const receiver = genData.assignment.find(x => x.nombre === a.daAM);
          return receiver && a.genero === receiver.genero;
        }).length);
        genData.assignment.forEach(a => {
          console.log(a.nombre + ' -> ' + a.daAM);
        });
        
        // Test reveal
        const revealOptions = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/reveal',
          method: 'POST',
          headers: {'Content-Type': 'application/json'}
        };
        const revealBody = JSON.stringify({nombre: 'Juan (hombre)'});
        const revealReq = http.request(revealOptions, (res3) => {
          let data3 = '';
          res3.on('data', (chunk) => { data3 += chunk; });
          res3.on('end', () => {
            console.log('Reveal:', data3);
            process.exit(0);
          });
        });
        revealReq.write(revealBody);
        revealReq.end();
      });
    });
    genReq.end();
  });
});

req.write(postData);
req.end();
