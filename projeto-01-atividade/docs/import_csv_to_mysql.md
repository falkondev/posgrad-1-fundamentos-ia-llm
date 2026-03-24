# Scripts de Importacao CSV -> MySQL

Importa os dados de `.tmp/csv/kz.csv` para o banco MySQL `projeto_01`.

## Setup (dentro do container)

```bash
# Entrar no container da aplicacao
docker exec -it <nome_do_container_app> bash

# Ir para o diretorio dos scripts
cd /app/data/import_scripts

# Instalar dependencias
npm install
```

## Variaveis de ambiente

Os scripts usam as seguintes variaveis (com valores padrao para o docker-compose):

| Variavel         | Padrao      | Descricao              |
|------------------|-------------|------------------------|
| `MYSQL_HOST`     | `localhost` | Host do MySQL          |
| `MYSQL_PORT`     | `3306`      | Porta do MySQL         |
| `MYSQL_USER`     | `root`      | Usuario do MySQL       |
| `MYSQL_PASSWORD` | `root`      | Senha do MySQL         |
| `MYSQL_DATABASE` | `projeto_01`| Nome do banco de dados |

Se rodar de dentro do container app, use `MYSQL_HOST=mysql`:

```bash
MYSQL_HOST=mysql node 01_import_users.js
```

## Ordem de execucao

Execute os scripts **nesta ordem** (respeita dependencias de FK):

```bash
node 01_import_users.js
node 02_import_categories.js
node 03_import_brands.js
node 04_import_products.js   # depende de brands e categories
node 05_import_orders.js     # depende de users e products
```

## Scripts de limpeza (rollback)

### Limpar uma tabela especifica

```bash
node clear_table.js orders
node clear_table.js products
node clear_table.js brands
node clear_table.js categories
node clear_table.js users
```

### Limpar todas as tabelas

```bash
# Com confirmacao interativa
node clear_all.js

# Sem confirmacao (automatico)
node clear_all.js --force
```

## Mapeamento CSV -> Banco

| Tabela       | Campo      | Origem                                           |
|--------------|------------|--------------------------------------------------|
| users        | id         | CSV: user_id                                     |
| users        | name       | MOCKADO: faker.person.fullName()                 |
| users        | age        | MOCKADO: peso maior em 18-40 (70%), 41-70 (20%), 16-17 (10%) |
| categories   | id         | CSV: category_id                                 |
| categories   | name       | MOCKADO: faker.commerce.department()             |
| brands       | id         | AUTO_INCREMENT                                   |
| brands       | name       | CSV: brand (unico)                               |
| products     | id         | CSV: product_id                                  |
| products     | name       | MOCKADO: faker.commerce.productName()            |
| products     | price      | CSV: price (amostra do produto)                  |
| products     | category_id| CSV: category_id (amostra do produto)            |
| products     | brand_id   | Lookup na tabela brands pelo nome da marca       |
| orders       | id         | CSV: order_id                                    |
| orders       | user_id    | CSV: user_id (FK)                                |
| orders       | product_id | CSV: product_id (FK)                             |
| orders       | event_date | CSV: event_time (remove sufixo " UTC")           |
