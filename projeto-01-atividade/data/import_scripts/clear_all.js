'use strict';

/**
 * Script de limpeza total (rollback completo)
 *
 * Remove todos os dados das 5 tabelas na ordem correta (FK reversa):
 *   1. orders
 *   2. products
 *   3. brands
 *   4. categories
 *   5. users
 *
 * Uso: node clear_all.js
 * Uso com confirmacao pulada: node clear_all.js --force
 */

const readline = require('readline');
const pool = require('./db');

const TABLES_ORDER = ['orders', 'products', 'brands', 'categories', 'users'];

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const force = process.argv.includes('--force');

  console.log('============================================');
  console.log(' LIMPEZA TOTAL DO BANCO (clear_all)');
  console.log('============================================\n');
  console.log('[Aviso] Este script remove TODOS os dados das tabelas:');
  TABLES_ORDER.forEach((t) => console.log(`         - ${t}`));
  console.log();

  if (!force) {
    const answer = await confirm('[Confirmacao] Deseja continuar? (s/N): ');
    if (answer !== 's' && answer !== 'sim') {
      console.log('[Cancelado] Operacao cancelada pelo usuario.\n');
      process.exit(0);
    }
    console.log();
  } else {
    console.log('[Modo] --force ativo, pulando confirmacao.\n');
  }

  const conn = await pool.getConnection();

  try {
    // --- Contar registros atuais ---
    console.log('[Passo 1] Contando registros atuais...');
    const counts = {};
    for (const table of TABLES_ORDER) {
      const [[{ total }]] = await conn.query(`SELECT COUNT(*) as total FROM ${table}`);
      counts[table] = Number(total);
      console.log(`          ${table}: ${counts[table].toLocaleString()} registros`);
    }
    console.log();

    const totalGeral = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalGeral === 0) {
      console.log('[Info] Todas as tabelas ja estao vazias. Nada a fazer.\n');
      return;
    }

    // --- Desabilitar FK ---
    console.log('[Passo 2] Desabilitando verificacao de FK...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // --- Truncar tabelas ---
    console.log('[Passo 3] Limpando tabelas...');
    for (const table of TABLES_ORDER) {
      if (counts[table] === 0) {
        console.log(`          SKIP  ${table} (ja vazia)`);
        continue;
      }
      await conn.query(`TRUNCATE TABLE ${table}`);
      console.log(`          OK    ${table} -> ${counts[table].toLocaleString()} registros removidos`);
    }

    // --- Reabilitar FK ---
    console.log('\n[Passo 4] Reabilitando verificacao de FK...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // --- Verificacao final ---
    console.log('\n[Passo 5] Verificando resultado...');
    let totalRemovido = 0;
    for (const table of TABLES_ORDER) {
      const [[{ total }]] = await conn.query(`SELECT COUNT(*) as total FROM ${table}`);
      const removidos = counts[table];
      totalRemovido += removidos;
      console.log(`          ${table}: ${Number(total)} registros (removidos: ${removidos.toLocaleString()})`);
    }

    console.log('\n============================================');
    console.log(' LIMPEZA CONCLUIDA COM SUCESSO');
    console.log(`  Total removido: ${totalRemovido.toLocaleString()} registros`);
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
