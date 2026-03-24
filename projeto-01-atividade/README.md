# E-commerce Recommendation System

Uma aplicação web de recomendação de produtos usando TensorFlow.js, com backend em Node.js, banco de dados MySQL e grafo de vetores no Neo4j.

> **Em desenvolvimento** — atualmente os dados de usuarios e produtos sao carregados de arquivos JSON (`data/`). A proxima etapa e substituir esses dados pelo MySQL populado via scripts de importacao CSV.

## Servicos (Docker)

| Servico | Imagem           | Porta(s)       | Descricao                              |
|---------|------------------|----------------|----------------------------------------|
| `app`   | Dockerfile local | `3000`         | Frontend com browser-sync (hot reload) |
| `api`   | Dockerfile local | `3001`         | API HTTP Node.js + Neo4j               |
| `mysql` | mysql:8.0        | `3306`         | Banco relacional (schema + dados CSV)  |
| `neo4j` | neo4j:2026.01.4  | `7474`, `7687` | Grafo de vetores para similaridade     |

## Setup e Execucao

### Pre-requisitos

- Docker e Docker Compose instalados
- Arquivo `.env` com as variaveis de ambiente (veja abaixo)

### Variaveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=sua_senha_aqui
MYSQL_ROOT_PASSWORD=root
```

### Subir o ambiente completo

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Neo4j Browser: http://localhost:7474

### Rodar localmente (sem Docker)

```bash
npm install
npm start
```

## Banco de Dados MySQL

O schema e criado automaticamente pelo Docker via `data/migration.sql` ao subir o container.

### Tabelas

| Tabela       | Descricao                              |
|--------------|----------------------------------------|
| `users`      | Usuarios da plataforma                 |
| `categories` | Categorias de produtos                 |
| `brands`     | Marcas dos produtos                    |
| `products`   | Produtos (com FK para category e brand)|
| `orders`     | Pedidos/compras (com FK para user e product) |

### Importar dados do Kaggle (CSV -> MySQL)

Os scripts em `data/import_scripts/` populam o banco a partir de `.tmp/csv/kz.csv`. Este csv pode ser baixado neste link (https://www.kaggle.com/datasets/mkechinov/ecommerce-purchase-history-from-electronics-store).
Consulte [`docs/import_csv_to_mysql.md`](docs/import_csv_to_mysql.md) para instrucoes detalhadas.

Resumo rapido (dentro do container `app`):

```bash
docker exec -it <nome_container_app> bash
cd /app/data/import_scripts
npm install
MYSQL_HOST=mysql node 01_import_users.js
MYSQL_HOST=mysql node 02_import_categories.js
MYSQL_HOST=mysql node 03_import_brands.js
MYSQL_HOST=mysql node 04_import_products.js
MYSQL_HOST=mysql node 05_import_orders.js
```

## API (porta 3001)

| Metodo | Endpoint                    | Descricao                              |
|--------|-----------------------------|----------------------------------------|
| GET    | `/health`                   | Health check + conexao Neo4j           |
| GET    | `/api/model/exists`         | Verifica se modelo treinado existe     |
| POST   | `/api/model/save`           | Persiste modelo TF.js no filesystem    |
| GET    | `/model/:arquivo`           | Serve arquivos do modelo (model.json, weights.bin) |
| POST   | `/api/products/save-vectors`| Salva vetores de produtos no Neo4j     |
| GET    | `/api/products/vectors`     | Retorna todos os vetores salvos        |
| POST   | `/api/products/similar`     | Busca produtos similares por vetor     |

## Funcionalidades Atuais

- Selecao de perfil de usuario com exibicao de detalhes
- Historico de compras passadas
- Listagem de produtos com botao "Comprar"
- Rastreamento de compras via sessionStorage
- Treinamento de modelo TF.js em Web Worker (sem bloquear a UI)
- Persistencia do modelo treinado via API
- Armazenamento de vetores de produtos no Neo4j
- Busca de produtos similares por similaridade de cosseno


## Populando o Neo4j

Após iniciar os containers e (opcionalmente) treinar o modelo, execute o script para vetorizar todos os produtos:

```bash
node --env-file=.env scripts/seed-neo4j.js
```

O script conecta diretamente ao MySQL e Neo4j usando as variáveis do `.env`.
Saída esperada: ~40 batches de 500 produtos cada.

O script é independente do treinamento — pode ser re-executado a qualquer momento para atualizar os vetores no Neo4j.
