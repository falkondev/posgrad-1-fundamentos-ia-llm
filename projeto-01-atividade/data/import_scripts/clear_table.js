'use strict';

/**
 * Script de limpeza - tabela especifica
 *
 * Uso: node clear_table.js <nome_da_tabela>
 *
 * Exemplo:
 *   node clear_table.js orders
 *   node clear_table.js products
 *
 * Tabelas validas (em ordem segura de limpeza individual):
 *   orders, products, brands, categories, users
 */

const pool = require('./db');

const VALID_TABLES = ['orders', 'products', 'brands', 'categories', 'users'];

async function main() {
  const tableName = process.argv[2];

  if (!tableName) {
    console.error('Uso: node clear_table.js <nome_da_tabela>');
    console.error(`Tabelas validas: ${VALID_TABLES.join(', ')}`);
    process.exit(1);
  }

  if (!VALID_TABLES.includes(tableName)) {
    console.error(`Tabela invalida: "${tableName}"`);
    console.error(`Tabelas validas: ${VALID_TABLES.join(', ')}`);
    process.exit(1);
  }

  console.log('============================================');
  console.log(` LIMPEZA DE TABELA: ${tableName.toUpperCase()}`);
  console.log('============================================\n');

  const conn = await pool.getConnection();

  try {
    // Contar registros antes
    const [[{ total }]] = await conn.query(`SELECT COUNT(*) as total FROM ${tableName}`);
    console.log(`[Info] Registros atuais em "${tableName}": ${Number(total).toLocaleString()}`);

    if (Number(total) === 0) {
      console.log('[Info] Tabela ja esta vazia. Nada a fazer.\n');
      return;
    }

    console.log(`\n[Limpeza] Desabilitando verificacao de FK...`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    console.log(`[Limpeza] Executando TRUNCATE TABLE ${tableName}...`);
    await conn.query(`TRUNCATE TABLE ${tableName}`);

    console.log(`[Limpeza] Reabilitando verificacao de FK...`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Confirmar
    const [[{ totalAfter }]] = await conn.query(`SELECT COUNT(*) as totalAfter FROM ${tableName}`);
    console.log(`\n[Resultado] Registros em "${tableName}" apos limpeza: ${Number(totalAfter).toLocaleString()}`);

    console.log('\n============================================');
    console.log(` Tabela "${tableName}" limpa com sucesso!`);
    console.log(`  Removidos: ${Number(total).toLocaleString()} registros`);
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
