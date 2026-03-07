'use strict';

/**
 * Script 04 - Importacao de produtos
 *
 * DEPENDENCIAS: brands e categories devem estar importados antes.
 *
 * Para cada product_id unico do CSV, coleta uma amostra de linha com:
 * - price        -> da amostra do produto no CSV
 * - category_id  -> da amostra do produto no CSV
 * - brand        -> da amostra do produto no CSV (para buscar brand_id)
 *
 * Depois:
 * - id         -> product_id do CSV
 * - name       -> mockado com faker
 * - price      -> do CSV (amostra)
 * - category_id -> do CSV (amostra)
 * - brand_id   -> buscado da tabela brands pelo nome da marca
 *
 * Execucao: node 04_import_products.js
 */

const { faker } = require('@faker-js/faker');
const pool = require('./db');
const { streamCSV } = require('./csv-stream');

const BATCH_SIZE = 500;

async function main() {
  console.log('============================================');
  console.log(' IMPORTACAO DE PRODUTOS (04_import_products)');
  console.log('============================================\n');

  // --- Passo 1: Coletar amostra de cada product_id unico do CSV ---
  console.log('[Passo 1] Lendo CSV para coletar amostra de cada produto unico...');

  // Map<product_id, { price, category_id, brand }>
  const productSamples = new Map();

  await streamCSV((row) => {
    if (row.product_id && !productSamples.has(row.product_id)) {
      productSamples.set(row.product_id, {
        price:       row.price,
        category_id: row.category_id,
        brand:       row.brand,
      });
    }
  });

  console.log(`[Passo 1] Total de produtos unicos encontrados: ${productSamples.size.toLocaleString()}\n`);

  // --- Passo 2: Carregar mapeamento brand_name -> brand_id do banco ---
  console.log('[Passo 2] Carregando mapeamento de marcas do banco de dados...');
  const conn = await pool.getConnection();

  try {
    const [brandRows] = await conn.query('SELECT id, name FROM brands');
    const brandMap = new Map(brandRows.map((b) => [b.name, b.id]));
    console.log(`[Passo 2] ${brandMap.size.toLocaleString()} marcas carregadas do banco\n`);

    // --- Passo 3: Montar os registros de produtos ---
    console.log('[Passo 3] Montando registros de produtos com dados mockados...');
    let semMarca = 0;
    let semCategoria = 0;

    const products = [];
    for (const [productId, sample] of productSamples) {
      const brandId = brandMap.get(sample.brand) || null;
      if (!brandId) semMarca++;

      const categoryId = sample.category_id || null;
      if (!categoryId) semCategoria++;

      products.push([
        productId,
        faker.commerce.productName(),
        parseFloat(sample.price) || 0.00,
        categoryId,
        brandId,
      ]);
    }

    if (semMarca > 0)    console.log(`[Passo 3] Aviso: ${semMarca} produtos sem brand_id (marca nao encontrada ou vazia)`);
    if (semCategoria > 0) console.log(`[Passo 3] Aviso: ${semCategoria} produtos sem category_id`);
    console.log(`[Passo 3] ${products.length.toLocaleString()} produtos preparados para insercao\n`);

    // --- Passo 4: Inserir no banco em batches ---
    console.log(`[Passo 4] Inserindo no banco em batches de ${BATCH_SIZE}...`);
    let totalInserted = 0;
    let totalSkipped = 0;
    const totalBatches = Math.ceil(products.length / BATCH_SIZE);

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const [result] = await conn.query(
        'INSERT IGNORE INTO products (id, name, price, category_id, brand_id) VALUES ?',
        [batch]
      );

      totalInserted += result.affectedRows;
      totalSkipped += batch.length - result.affectedRows;

      console.log(
        `[Passo 4] Batch ${batchNum}/${totalBatches} -> ` +
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
