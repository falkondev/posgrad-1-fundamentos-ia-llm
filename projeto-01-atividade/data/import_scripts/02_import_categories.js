'use strict';

/**
 * Script 02 - Importacao de categorias
 *
 * Coleta todos os category_id unicos do CSV e insere na tabela categories.
 * - id   -> category_id do CSV
 * - name -> mockado com faker
 *
 * Execucao: node 02_import_categories.js
 */

const { faker } = require('@faker-js/faker');
const pool = require('./db');
const { streamCSV } = require('./csv-stream');

const BATCH_SIZE = 500;

async function main() {
  console.log('====================================================');
  console.log(' IMPORTACAO DE CATEGORIAS (02_import_categories)');
  console.log('====================================================\n');

  // --- Passo 1: Coletar category_ids unicos do CSV ---
  console.log('[Passo 1] Lendo CSV para coletar category_ids unicos...');
  const categoryIds = new Set();

  await streamCSV((row) => {
    if (row.category_id) categoryIds.add(row.category_id);
  });

  console.log(`[Passo 1] Total de category_ids unicos: ${categoryIds.size.toLocaleString()}\n`);

  // --- Passo 2: Gerar registros com dados mockados ---
  console.log('[Passo 2] Gerando nomes mockados para categorias...');
  const categories = Array.from(categoryIds).map((id) => [
    id,
    faker.commerce.department(),
  ]);
  console.log(`[Passo 2] ${categories.length.toLocaleString()} categorias preparadas\n`);

  // --- Passo 3: Inserir no banco em batches ---
  console.log(`[Passo 3] Inserindo no banco em batches de ${BATCH_SIZE}...`);
  const conn = await pool.getConnection();

  try {
    let totalInserted = 0;
    let totalSkipped = 0;
    const totalBatches = Math.ceil(categories.length / BATCH_SIZE);

    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      const batch = categories.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const [result] = await conn.query(
        'INSERT IGNORE INTO categories (id, name) VALUES ?',
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

    console.log('\n====================================================');
    console.log(` RESULTADO FINAL`);
    console.log('====================================================');
    console.log(` Inseridos : ${totalInserted.toLocaleString()}`);
    console.log(` Ignorados : ${totalSkipped.toLocaleString()} (ja existiam)`);
    console.log('====================================================\n');

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
