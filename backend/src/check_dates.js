const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_ZABBIX_HOST || 'localhost',
    port: Number(process.env.DB_ZABBIX_PORT) || 3308,
    user: process.env.DB_ZABBIX_USER || 'reporter',
    password: process.env.DB_ZABBIX_PASSWORD || 'reporterpass',
    database: process.env.DB_ZABBIX_NAME || 'zabbix',
  });

  try {
    console.log('Connected to DB.');

    // Agent items: 62658, 64209
    const [agentStats] = await connection.query(`
      SELECT itemid, COUNT(*) as count, MIN(clock) as min_clock, MAX(clock) as max_clock,
             FROM_UNIXTIME(MIN(clock)) as min_date, FROM_UNIXTIME(MAX(clock)) as max_date
      FROM history_uint
      WHERE itemid IN (62658, 64209)
      GROUP BY itemid
    `);
    console.log('Agent availability history_uint stats:', agentStats);

    // Service items: 64317, 64336, 62724, 62703, 62713, 62721, 64319, 62753
    const [serviceStats] = await connection.query(`
      SELECT itemid, COUNT(*) as count, MIN(clock) as min_clock, MAX(clock) as max_clock,
             FROM_UNIXTIME(MIN(clock)) as min_date, FROM_UNIXTIME(MAX(clock)) as max_date
      FROM history_uint
      WHERE itemid IN (64317, 64336, 62724, 62703, 62713, 62721, 64319, 62753)
      GROUP BY itemid
    `);
    console.log('Service availability history_uint stats:', serviceStats);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

run();
