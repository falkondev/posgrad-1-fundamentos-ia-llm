'use strict';

/**
 * Script 01 - Importacao de usuarios
 *
 * Coleta todos os user_id unicos do CSV e insere na tabela users.
 * - id     -> user_id do CSV
 * - name   -> mockado com faker
 * - age    -> numero aleatorio com peso maior entre 18-40
 *
 * Execucao: node 01_import_users.js
 */

const { faker } = require('@faker-js/faker');
const pool = require('./db');
const { streamCSV } = require('./csv-stream');

const BATCH_SIZE = 500;

/**
 * Gera idade com distribuicao ponderada:
 *   70% -> 18 a 40
 *   20% -> 41 a 70
 *   10% -> 16 a 17
 */
function weightedAge() {
  const rand = Math.random();
  if (rand < 0.70) return Math.floor(Math.random() * 23) + 18;
  if (rand < 0.90) return Math.floor(Math.random() * 30) + 41;
  return Math.floor(Math.random() * 2) + 16;
}

async function main() {
  console.log('============================================');
  console.log(' IMPORTACAO DE USUARIOS (01_import_users)');
  console.log('============================================\n');

  // --- Passo 1: Coletar user_ids unicos do CSV ---
  console.log('[Passo 1] Lendo CSV para coletar user_ids unicos...');
  const userIds = new Set();

  await streamCSV((row) => {
    if (row.user_id) userIds.add(row.user_id);
  });

  console.log(`[Passo 1] Total de user_ids unicos: ${userIds.size.toLocaleString()}\n`);

  // --- Passo 2: Gerar registros com dados mockados ---
  console.log('[Passo 2] Gerando dados mockados (name, age)...');
  const users = Array.from(userIds).map((id) => [
    id,
    faker.person.fullName(),
    weightedAge(),
  ]);
  console.log(`[Passo 2] ${users.length.toLocaleString()} usuarios preparados\n`);

  // --- Passo 3: Inserir no banco em batches ---
  console.log(`[Passo 3] Inserindo no banco em batches de ${BATCH_SIZE}...`);
  const conn = await pool.getConnection();

  try {
    let totalInserted = 0;
    let totalSkipped = 0;
    const totalBatches = Math.ceil(users.length / BATCH_SIZE);

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const [result] = await conn.query(
        'INSERT IGNORE INTO users (id, name, age) VALUES ?',
        [batch]
      );

      totalInserted += result.affectedRows;
      totalSkipped += batch.length - result.affectedRows;

      console.log(
        `[Passo 3] Batch ${batchNum}/${totalBatches} -> ` +
        `inseridos: ${result.affectedRows}, ignorados: ${batch.length - result.affectedRows} | ` +
        `acumulado: ${totalInserted.toLocaleString()} inseridos`
      );
    }

    console.log('\n============================================');
    console.log(` RESULTADO FINAL`);
    console.log('============================================');
    console.log(` Inseridos : ${totalInserted.toLocaleString()}`);
    console.log(` Ignorados : ${totalSkipped.toLocaleString()} (ja existiam)`);
    console.log('============================================\n');

  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n[ERRO FATAL]', err.message);
  console.error(err);
  process.exit(1);
});
