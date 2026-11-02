import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const columns = 'id, name, document, issued_at AS "issuedAt", status';

export async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS passes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    document TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'ACTIVE'
  )`);
}

export async function createPass(id: string, name: string, document: string) {
  await pool.query('INSERT INTO passes (id, name, document) VALUES ($1, $2, $3)', [id, name, document]);
}

export async function getPass(id: string) {
  const result = await pool.query(`SELECT ${columns} FROM passes WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function getAllPasses() {
  const result = await pool.query(`SELECT ${columns} FROM passes ORDER BY issued_at DESC`);
  return result.rows;
}

export async function countPasses() {
  const result = await pool.query('SELECT COUNT(*) FROM passes');
  return Number(result.rows[0].count);
}

export async function countActivePasses() {
  const result = await pool.query("SELECT COUNT(*) FROM passes WHERE status = 'ACTIVE'");
  return Number(result.rows[0].count);
}

export async function cancelPass(id: string) {
  await pool.query("UPDATE passes SET status = 'CANCELLED' WHERE id = $1", [id]);
}

export async function deletePass(id: string) {
  await pool.query('DELETE FROM passes WHERE id = $1', [id]);
}
