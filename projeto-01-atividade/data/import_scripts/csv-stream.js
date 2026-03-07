'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.resolve(__dirname, '../../.tmp/csv/kz.csv');

/**
 * Le o CSV linha a linha (streaming) e chama o callback para cada linha parseada.
 * @param {function(Object, number): void} onRow - Callback com o objeto da linha e o numero da linha (sem header)
 * @param {number} [logInterval=100000] - Intervalo de linhas para log de progresso
 * @returns {Promise<number>} Total de linhas de dados processadas
 */
async function streamCSV(onRow, logInterval = 100000) {
  console.log(`[CSV] Abrindo arquivo: ${CSV_PATH}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV_PATH),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let dataCount = 0;

  for await (const line of rl) {
    lineCount++;

    // Pula o header
    if (lineCount === 1) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Colunas: event_time,order_id,product_id,category_id,category_code,brand,price,user_id
    const cols = trimmed.split(',');
    if (cols.length < 8) continue;

    const row = {
      event_time:    cols[0].trim(),
      order_id:      cols[1].trim(),
      product_id:    cols[2].trim(),
      category_id:   cols[3].trim(),
      category_code: cols[4].trim(),
      brand:         cols[5].trim(),
      price:         cols[6].trim(),
      user_id:       cols[7].trim(),
    };

    onRow(row, dataCount);
    dataCount++;

    if (dataCount % logInterval === 0) {
      console.log(`[CSV] Progresso: ${dataCount.toLocaleString()} linhas processadas...`);
    }
  }

  console.log(`[CSV] Leitura concluida: ${dataCount.toLocaleString()} linhas de dados`);
  return dataCount;
}

module.exports = { streamCSV, CSV_PATH };
