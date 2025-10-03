const cron = require('node-cron');

console.log('STARTING CRON TEST');

cron.schedule('* * * * *', () => {
  console.log('[CRON TEST] FIRED:', new Date().toISOString());
}, {
  timezone: 'Europe/Moscow',
  scheduled: true
});

setInterval(() => {
  console.log('[ALIVE]', new Date().toISOString());
}, 60000);
