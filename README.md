# Fundamentos de IA e LLM - Projetos Práticos

Este repositório contém uma coleção de projetos práticos desenvolvidos como parte do curso de Fundamentos de IA e LLM da Pós Graduação "Engenharia com IA Aplicada" da UniPDS. Cada projeto explora diferentes aspectos da implementação de sistemas de inteligência artificial, desde redes neurais básicas até sistemas de recomendação completos com bancos de dados.

## 📁 Projetos

### 🎯 Projeto 00 - Classificação com TensorFlow.js Node

**Descrição:** Projeto introdutório focado no treinamento de uma rede neural simples usando TensorFlow.js no ambiente Node.js. Demonstra os conceitos básicos de redes neurais artificiais, incluindo:

- Criação de modelo sequencial com camadas densas
- Compilação com otimizador Adam e categorical crossentropy
- Treinamento supervisionado com dados de entrada (7 features) e saída (3 classes)
- Predição usando o modelo treinado

**Estrutura:**
```
projeto-00/
├── index.js          # Código do modelo e funções de treinamento/predição
├── package.json      # Dependências: @tensorflow/tfjs-node
└── package-lock.json
```

**Como executar:**
```bash
cd projeto-00
npm install
npm start
```

**Notas:** O modelo é treinado com dados hardcoded no arquivo. Para personalizar, modifique os arrays `inputXs` e `outputYs` no arquivo `index.js`.

---

### 🛒 Projeto 01 - Sistema de Recomendação Básico

**Descrição:** Aplicação web de e-commerce que exibe perfis de usuários e listagens de produtos, com funcionalidade de rastreamento de compras. Este projeto foi o primeiro passo na construção de um sistema de recomendação, servindo como interface frontend antes da integração com bancos de dados.

**Estrutura:**
```
projeto-01/
├── index.html         # Interface HTML principal
├── style.css          # Estilos da aplicação
├── index.js           # Lógica principal da aplicação
├── src/
│   ├── service/       # Lógica de negócio
│   ├── controller/    # Controladores
│   ├── view/          # Gerenciamento de DOM e templates
│   └── events/        # Sistema de eventos
├── data/              # Dados JSON de usuários e produtos
└── demo.png           # Captura de tela da aplicação
```

**Como executar:**
```bash
cd projeto-01
npm install
npm start
```

>Acesse: http://localhost:8080

**Funcionalidades:**
- Seleção de perfil de usuário com exibição de detalhes
- Histórico de compras passadas
- Listagem de produtos com botão "Comprar"
- Rastreamento de compras via sessionStorage

**Próximos passos (concluídos no projeto-01-atividade):**
- Substituir dados JSON por conexão MySQL
- Implementar motor de recomendação com TensorFlow.js
- Vetorização de produtos e análise de similaridade

---

### 🚀 Projeto 01 Atividade - Sistema de Recomendação Completo

**Descrição:** Versão avançada e completa do sistema de recomendação de e-commerce, implementando uma arquitetura full-stack com:

✅ Frontend com interface web moderna
✅ API REST Node.js
✅ Banco de dados relacional MySQL
✅ Grafo de vetores no Neo4j para busca por similaridade
✅ Treinamento de modelo TensorFlow.js em Web Worker
✅ Persistência de modelo treinado
✅ Sistema de importação de dados via CSV (Kaggle)

**Arquitetura e Serviços (Docker):**

| Serviço  | Tecnologia            | Porta(s)   | Descrição                              |
|----------|----------------------|------------|----------------------------------------|
| `app`    | Frontend + API       | `3000`     | Browser-sync (hot reload frontend)    |
| `api`    | Node.js Server       | `3001`     | API HTTP com integração Neo4j         |
| `mysql`  | MySQL 8.0            | `3306`     | Banco relacional com dados do Kaggle  |
| `neo4j`  | Neo4j Graph DB       | `7474, 7687`| Grafo de vetores para similaridade   |

**Estrutura:**
```
projeto-01-atividade/
├── docker-compose.yml    # Orquestração de containers
├── Dockerfile           # Configuração do container da aplicação
├── index.html           # Frontend principal
├── style.css            # Estilos Tailwind CSS
├── src/
│   ├── server.js        # Servidor HTTP (porta 3001)
│   ├── index.js         # Lógica frontend
│   ├── controller/      # Controladores MVC
│   ├── service/         # Lógica de negócio
│   ├── services/        # Conexões MySQL e Neo4j
│   ├── view/            # Views e templates
│   ├── workers/         # Web Workers (model training)
│   └── events/          # Sistema de eventos
├── data/
│   ├── migration.sql    # Schema MySQL
│   ├── products.json    # Dados de produtos
│   ├── users.json       # Dados de usuários
│   ├── import_scripts/  # Scripts de importação CSV
│   └── .tmp/csv/        # Arquivos CSV do Kaggle
├── scripts/
│   └── seed-neo4j.js    # Vetorização e popul Neo4j
├── model/               # Modelo TF.js treinado (model.json, weights.bin)
├── docs/
│   └── import_csv_to_mysql.md
└── CODEBASE_ANALYSIS.md # Análise do código
```

**Setup e Execução:**

### Opção 1: Docker (Recomendado)

1. Configure as variáveis de ambiente no arquivo `.env`:
```env
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=sua_senha_aqui
MYSQL_ROOT_PASSWORD=root
```

2. Subir todos os serviços:
```bash
docker compose up --build
```

**Acesse:**
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Neo4j Browser: http://localhost:7474

### Opção 2: Execução Local (sem Docker)

```bash
cd projeto-01-atividade
npm install
npm start
```

**Nota:** Para execução local, é necessário ter MySQL e Neo4j instalados e configurados manualmente.

**Funcionalidades Principais:**

- **Treinamento de Modelo:** Usando TensorFlow.js em Web Worker para não bloquear a UI
- **Persistência:** Modelo salvo via API no filesystem
- **Vetorização:** Produtos convertidos em vetores e armazenados no Neo4j
- **Busca por Similaridade:** Consultas por similaridade de cosseno no grafo
- **Rastreamento de Compras:** Integração MySQL para histórico de pedidos

**API Endpoints:**

| Método | Endpoint                   | Descrição                              |
|--------|----------------------------|----------------------------------------|
| GET    | `/health`                  | Health check + conexão Neo4j           |
| GET    | `/api/model/exists`        | Verifica se modelo treinado existe     |
| POST   | `/api/model/save`          | Persiste modelo TF.js                  |
| GET    | `/model/:arquivo`          | Serve arquivos do modelo               |
| POST   | `/api/products/save-vectors`| Salva vetores de produtos no Neo4j    |
| GET    | `/api/products/vectors`    | Retorna todos os vetores               |
| POST   | `/api/products/similar`    | Busca produtos similares              |

**Populando o Neo4j:**

Após iniciar os containers e treinar o modelo, execute o script de seed:

```bash
cd projeto-01-atividade
node --env-file=.env scripts/seed-neo4j.js
```

Espera-se ~40 batches de 500 produtos cada.

**Importação de Dados (Kaggle CSV → MySQL):**

O dataset pode ser obtido em:
https://www.kaggle.com/datasets/mkechinov/ecommerce-purchase-history-from-electronics-store

Instruções detalhadas em: `docs/import_csv_to_mysql.md`

**Dados Importados (Tabelas MySQL):**

| Tabela       | Descrição                              |
|--------------|----------------------------------------|
| `users`      | Usuários da plataforma                 |
| `categories` | Categorias de produtos                 |
| `brands`     | Marcas dos produtos                    |
| `products`   | Produtos (com FK para category/brand) |
| `orders`     | Pedidos/compras                       |

---

## 🎓 Contexto Educacional

Estes projetos foram desenvolvidos como parte do **Módulo 3 - Fundamentos de IA e LLM** do curso de pós-graduação, cobrindo:

1. **Redes Neurais Básicas** - Projeto 00
2. **Sistemas de Recomendação** - Projetos 01 e 01-atividade
3. **Integração Full-Stack** - API, bancos de dados e frontend
4. **Machine Learning Operacional (MLOps)** - Treinamento, persistência e serving de modelos
5. **Bancos de Dados Modernos** - MySQL relacional + Neo4j grafo
6. **Docker e Containerização** - Ambiente completo em containers
7. **WebAssembly/Web Workers** - Processamento assíncrono no navegador

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Tailwind CSS
- **Backend:** Node.js, Express-like patterns
- **ML:** TensorFlow.js (Node.js + Browser)
- **Bancos de Dados:** MySQL 8.0, Neo4j Graph Database
- **Infraestrutura:** Docker, Docker Compose
- **Ferramentas:** Browser-sync, Concurrently, Webpack/Tailwind CLI
- **DevOps:** Scripts de migração, importação CSV, seeding

---

## 📝 Observações

- O **projeto-00** é independente e pode ser executado isoladamente
- O **projeto-01** é a versão frontend-only (dependência de arquivos JSON)
- O **projeto-01-atividade** é a implementação completa e sobrepõe o projeto-01
- Para produção ou deploy, considere usar o **projeto-01-atividade** com Docker
- Os dados de exemplo estão incluídos em `data/` e podem ser substituídos pelos dados do Kaggle

---

## 📚 Recursos Adicionais

- Análise do código-fonte: `projeto-01-atividade/CODEBASE_ANALYSIS.md`
- Guia de importação CSV: `projeto-01-atividade/docs/import_csv_to_mysql.md`
- Dataset Kaggle: https://www.kaggle.com/datasets/mkechinov/ecommerce-purchase-history-from-electronics-store

---

**Desenvolvido para fins educacionais** 🎓
