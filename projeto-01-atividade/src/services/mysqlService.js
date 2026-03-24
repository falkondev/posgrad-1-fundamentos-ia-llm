import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'projeto_01',
  waitForConnections: true,
  connectionLimit: 5,
  supportBigNumbers: true,
  bigNumberStrings: true,
});

export class MysqlService {
  static async query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async healthCheck() {
    await pool.execute('SELECT 1');
    return { status: 'ok' };
  }

  static async close() {
    await pool.end();
  }
}

export default MysqlService;
