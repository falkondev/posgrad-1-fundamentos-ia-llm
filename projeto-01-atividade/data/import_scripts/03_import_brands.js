'use strict';

/**
 * Script 03 - Importacao de marcas
 *
 * Coleta todos os nomes de brand unicos do CSV e insere na tabela brands.
 * - id   -> gerado via AUTO_INCREMENT do banco
 * - name -> vem da coluna brand do CSV (sem duplicatas)
 *
 * Execucao: node 03_import_brands.js
 */

const pool = require('./db');
const { streamCSV } = require('./csv-stream');

const BATCH_SIZE = 500;

async function main() {
  console.log('============================================');
  console.log(' IMPORTACAO DE MARCAS (03_import_brands)');
  console.log('============================================\n');

  // --- Passo 1: Coletar nomes de marcas unicos do CSV ---
  console.log('[Passo 1] Lendo CSV para coletar marcas unicas...');
  const brandNames = new Set();

  await streamCSV((row) => {
    if (row.brand && row.brand !== '') brandNames.add(row.brand);
  });

  console.log(`[Passo 1] Total de marcas unicas encontradas: ${brandNames.size.toLocaleString()}\n`);

  // --- Passo 2: Preparar dados ---
  // Apenas o name; o id sera gerado por AUTO_INCREMENT
  const brands = Array.from(brandNames).map((name) => [name]);
  console.log(`[Passo 2] ${brands.length.toLocaleString()} marcas preparadas para insercao\n`);

  // --- Passo 3: Inserir no banco em batches ---
  console.log(`[Passo 3] Inserindo no banco em batches de ${BATCH_SIZE}...`);
  const conn = await pool.getConnection();

  try {
    let totalInserted = 0;
    let totalSkipped = 0;
    const totalBatches = Math.ceil(brands.length / BATCH_SIZE);

    for (let i = 0; i < brands.length; i += BATCH_SIZE) {
      const batch = brands.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      // INSERT IGNORE para evitar duplicatas caso o script seja re-executado
      const [result] = await conn.query(
        'INSERT IGNORE INTO brands (name) VALUES ?',
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

    // --- Passo 4: Verificacao ---
    console.log('\n[Passo 4] Verificando registros inseridos...');
    const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM brands');
    console.log(`[Passo 4] Total de marcas na tabela brands: ${total}`);

    console.log('\n============================================');
    console.log(` RESULTADO FINAL`);
    console.log('============================================');
    console.log(` Inseridos : ${totalInserted.toLocaleString()}`);
    console.log(` Ignorados : ${totalSkipped.toLocaleString()} (ja existiam)`);
    console.log(` Total DB  : ${total}`);
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
