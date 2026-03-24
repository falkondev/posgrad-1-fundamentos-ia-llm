import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://neo4j:7687',
    neo4j.auth.basic(
        process.env.NEO4J_USERNAME || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
    ),
    { disableLosslessIntegers: true }
);

const BATCH_SIZE = 500;

export class Neo4jService {
    /**
     * Salva os vetores de produtos no Neo4j usando UNWIND em batches de 500
     * Remove todos os produtos antigos e insere novos
     */
    static async saveProductVectors(productVectors) {
        const session = driver.session();
        try {
            await session.run('MATCH (p:Product) DETACH DELETE p');

            for (let i = 0; i < productVectors.length; i += BATCH_SIZE) {
                const batch = productVectors.slice(i, i + BATCH_SIZE).map(pv => ({
                    id: pv.meta?.id ?? pv.id,
                    name: pv.meta?.name ?? pv.name,
                    vector: Array.from(pv.vector),
                }));

                await session.run(
                    `UNWIND $batch AS item
                     CREATE (p:Product {
                         id: item.id,
                         name: item.name,
                         vector: item.vector
                     })`,
                    { batch }
                );
            }

            console.log(`✓ ${productVectors.length} produtos salvos no Neo4j`);
            return { success: true, count: productVectors.length };
        } catch (error) {
            console.error('Erro ao salvar vetores no Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Recupera todos os produtos com seus vetores
     */
    static async getProductVectors() {
        const session = driver.session();
        try {
            const result = await session.run('MATCH (p:Product) RETURN p');
            return result.records.map(record => ({
                name: record.get('p').properties.name,
                vector: record.get('p').properties.vector,
                category: record.get('p').properties.category,
                brand: record.get('p').properties.brand,
                price: record.get('p').properties.price,
            }));
        } catch (error) {
            console.error('Erro ao recuperar vetores do Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Busca os N produtos mais similares a um vetor de entrada (similaridade de cosseno)
     * Cosine similarity = (A . B) / (||A|| * ||B||) — calculado diretamente em Cypher
     */
    static async findSimilarProducts(userVector, limit = 5) {
        const session = driver.session();
        try {
            const vector = userVector.map(v => Number(v));
            const limitInt = neo4j.int(Math.trunc(limit));

            const query = `
                MATCH (p:Product)
                WITH p, vector.similarity.cosine(p.vector, $vector) AS similarity
                RETURN p.id AS id, p.name AS name, p.category AS category, p.brand AS brand,
                       p.price AS price, p.vector AS vector, similarity
                ORDER BY similarity DESC
                LIMIT $limit
            `;

            const result = await session.run(query, { vector, limit: limitInt });

            return result.records.map(record => ({
                id: record.get('id'),
                name: record.get('name'),
                category: record.get('category'),
                brand: record.get('brand'),
                price: record.get('price'),
                vector: record.get('vector'),
                similarity: record.get('similarity'),
            }));
        } catch (error) {
            console.error('Erro ao buscar produtos similares no Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Verifica a conexão com o Neo4j
     */
    static async healthCheck() {
        const session = driver.session();
        try {
            await session.run('RETURN 1');
            return { status: 'ok' };
        } catch (error) {
            console.error('Erro na health check do Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Fecha a conexão com o driver
     */
    static async close() {
        await driver.close();
    }
}

export default Neo4jService;
