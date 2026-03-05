import http from 'http';
import { Neo4jService } from './services/neo4jService.js';

const PORT = process.env.API_PORT || 3001;

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.url === '/health' && req.method === 'GET') {
        try {
            await Neo4jService.healthCheck();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', neo4j: 'connected' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: error.message }));
        }
        return;
    }

    // Save product vectors
    if (req.url === '/api/products/save-vectors' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { productVectors } = JSON.parse(body);
                const result = await Neo4jService.saveProductVectors(productVectors);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('Error saving vectors:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Get product vectors
    if (req.url === '/api/products/vectors' && req.method === 'GET') {
        try {
            const vectors = await Neo4jService.getProductVectors();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, vectors }));
        } catch (error) {
            console.error('Error fetching vectors:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // Find similar products (vector similarity search)
    if (req.url.startsWith('/api/products/similar') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { userVector, limit = 5 } = JSON.parse(body);
                const similarProducts = await Neo4jService.findSimilarProducts(userVector, parseInt(limit));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, products: similarProducts }));
            } catch (error) {
                console.error('Error finding similar products:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await Neo4jService.close();
    process.exit(0);
});
