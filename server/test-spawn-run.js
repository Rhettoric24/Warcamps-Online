const { spawnPlateauRun } = require('./database');
spawnPlateauRun(500, 1).then(result => {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
