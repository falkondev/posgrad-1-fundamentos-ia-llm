'use strict';

/**
 * Script 05 - Importacao de pedidos
 *
 * DEPENDENCIAS: users e products devem estar importados antes.
 *
 * Para cada order_id unico do CSV:
 * - id         -> order_id do CSV
 * - user_id    -> user_id do CSV (FK para users)
 * - product_id -> product_id do CSV (FK para products)
 * - event_date -> event_time do CSV (remove sufixo " UTC")
 *
 * Execucao: node 05_import_orders.js
 */

const pool = require('./db');
const { streamCSV } = require('./csv-stream');

const BATCH_SIZE = 1000;

/**
 * Converte "2020-04-24 11:50:39 UTC" para "2020-04-24 11:50:39"
 */
function parseEventTime(eventTime) {
  return eventTime.replace(/\s*UTC\s*$/, '').trim();
}

async function main() {
  console.log('============================================');
  console.log(' IMPORTACAO DE PEDIDOS (05_import_orders)');
  console.log('============================================\n');

  // --- Passo 1: Verificar quantos users e products existem no banco ---
  console.log('[Passo 1] Verificando tabelas de dependencias...');
  const conn = await pool.getConnection();

  try {
    const [[{ totalUsers }]]    = await conn.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalProducts }]] = await conn.query('SELECT COUNT(*) as totalProducts FROM products');
    console.log(`[Passo 1] users: ${Number(totalUsers).toLocaleString()} registros`);
    console.log(`[Passo 1] products: ${Number(totalProducts).toLocaleString()} registros`);

    if (Number(totalUsers) === 0 || Number(totalProducts) === 0) {
      console.error('[Passo 1] ERRO: Tabelas de dependencias vazias. Execute os scripts 01 a 04 primeiro.');
      process.exit(1);
    }
    console.log('[Passo 1] Dependencias OK\n');

    // --- Passo 2: Coletar order_ids unicos do CSV ---
    console.log('[Passo 2] Lendo CSV para coletar pedidos unicos...');

    // Map<order_id, { user_id, product_id, event_date }>
    const orderSamples = new Map();
    let linhasIgnoradas = 0;

    await streamCSV((row) => {
      if (!row.order_id || orderSamples.has(row.order_id)) return;

      if (!row.user_id || !row.product_id || !row.event_time) {
        linhasIgnoradas++;
        return;
      }

      orderSamples.set(row.order_id, {
        user_id:    row.user_id,
        product_id: row.product_id,
        event_date: parseEventTime(row.event_time),
      });
    });

    console.log(`[Passo 2] Total de pedidos unicos encontrados: ${orderSamples.size.toLocaleString()}`);
    if (linhasIgnoradas > 0) {
      console.log(`[Passo 2] Linhas ignoradas (dados incompletos): ${linhasIgnoradas.toLocaleString()}`);
    }
    console.log();

    // --- Passo 3: Montar array de registros ---
    console.log('[Passo 3] Montando registros de pedidos...');
    const orders = [];
    for (const [orderId, data] of orderSamples) {
      orders.push([
        orderId,
        data.user_id,
        data.product_id,
        data.event_date,
      ]);
    }
    console.log(`[Passo 3] ${orders.length.toLocaleString()} pedidos preparados para insercao\n`);

    // --- Passo 4: Inserir no banco em batches ---
    console.log(`[Passo 4] Inserindo no banco em batches de ${BATCH_SIZE}...`);
    console.log('[Passo 4] Aviso: pedidos com user_id ou product_id inexistentes serao ignorados (FK constraint)\n');

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const totalBatches = Math.ceil(orders.length / BATCH_SIZE);

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      try {
        const [result] = await conn.query(
          'INSERT IGNORE INTO orders (id, user_id, product_id, event_date) VALUES ?',
          [batch]
        );

        totalInserted += result.affectedRows;
        totalSkipped += batch.length - result.affectedRows;

        console.log(
          `[Passo 4] Batch ${batchNum}/${totalBatches} -> ` +
          `inseridos: ${result.affectedRows}, ignorados: ${batch.length - result.affectedRows} | ` +
          `acumulado: ${totalInserted.toLocaleString()} inseridos`
        );
      } catch (err) {
        totalErrors += batch.length;
        console.error(`[Passo 4] ERRO no batch ${batchNum}: ${err.message}`);

        // Tenta inserir um a um para identificar o registro problemático
        console.log(`[Passo 4] Tentando insercao individual no batch ${batchNum}...`);
        for (const record of batch) {
          try {
            const [r] = await conn.query(
              'INSERT IGNORE INTO orders (id, user_id, product_id, event_date) VALUES (?, ?, ?, ?)',
              record
            );
            totalInserted += r.affectedRows;
            totalErrors--;
          } catch (innerErr) {
            console.error(`[Passo 4]   -> Registro ignorado [order_id=${record[0]}]: ${innerErr.message}`);
          }
        }
      }

      if (batchNum % 10 === 0) {
        const pct = ((i + batch.length) / orders.length * 100).toFixed(1);
        console.log(`[Passo 4] --- Progresso: ${pct}% concluido ---`);
      }
    }

    console.log('\n============================================');
    console.log(` RESULTADO FINAL`);
    console.log('============================================');
    console.log(` Inseridos  : ${totalInserted.toLocaleString()}`);
    console.log(` Ignorados  : ${totalSkipped.toLocaleString()} (ja existiam)`);
    if (totalErrors > 0) {
      console.log(` Com erro   : ${totalErrors.toLocaleString()}`);
    }
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
