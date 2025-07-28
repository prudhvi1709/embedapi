# EmbedAPI with Vectorize

A high-performance serverless API built with Cloudflare Workers that generates, stores, and searches text embeddings using OpenAI's `text-embedding-3-small` model and Cloudflare Vectorize for hybrid search capabilities.

## Live Demo

**API URL:** https://embedapi.kprudhvi71.workers.dev

## ✨ Features

- **Vector Embeddings**: Generate embeddings using OpenAI's latest models
- **Hybrid Search**: Combine semantic similarity with metadata filtering
- **Global Performance**: Deployed on Cloudflare's edge network
- **Vectorize Storage**: Native vector database for optimal performance
- **Metadata Support**: Rich metadata filtering and storage
- **RESTful API**: Clean, intuitive endpoints
- **Comprehensive Testing**: Full test suite with Vitest

## 🚀 New in v2.0: Vectorize Integration

- **Hybrid Search**: `/search` endpoint with similarity + metadata filtering
- **Better Performance**: Native vector operations vs. key-value storage  
- **Scalability**: Optimized for large-scale vector workloads
- **Cost Efficiency**: More economical than storing large arrays in KV
- **Advanced Filtering**: Complex metadata queries and constraints

## Quick Start

Try the hybrid search API:

```bash
# 1. Create an embedding with metadata
curl -X POST https://embedapi.kprudhvi71.workers.dev/embed \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Cloudflare Workers enable edge computing",
    "metadata": {"category": "infrastructure", "topic": "serverless"}
  }'

# 2. Search for similar content
curl -X POST https://embedapi.kprudhvi71.workers.dev/search \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "edge computing platforms",
    "filter": {"category": "infrastructure"},
    "topK": 3
  }'
```

## API Endpoints

### POST /embed

Generates embeddings for text and stores them in Vectorize with optional metadata.

**Request:**
```bash
curl -X POST https://embedapi.kprudhvi71.workers.dev/embed \
  -H "Authorization: Bearer your-openai-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is transforming software development",
    "metadata": {
      "category": "technology", 
      "source": "blog",
      "author": "jane_doe",
      "timestamp": "2024-01-15"
    }
  }'
```

**Response:**
```json
{
  "id": "a1b2c3d4e5f6789",
  "message": "Embedding created successfully",
  "metadata": {
    "text": "Machine learning is transforming software development",
    "category": "technology",
    "source": "blog", 
    "author": "jane_doe",
    "timestamp": "2024-01-15"
  }
}
```

### GET /embed/:id

Retrieves stored text, embedding, and metadata by ID.

**Request:**
```bash
curl https://embedapi.kprudhvi71.workers.dev/embed/a1b2c3d4e5f6789
```

**Response:**
```json
{
  "id": "a1b2c3d4e5f6789",
  "text": "Machine learning is transforming software development",
  "embedding": [0.1, 0.2, 0.3, ...],
  "metadata": {
    "category": "technology",
    "source": "blog",
    "author": "jane_doe",
    "timestamp": "2024-01-15"
  }
}
```

### POST /search - 🆕 Hybrid Search

Performs semantic similarity search with optional metadata filtering.

**Request:**
```bash
curl -X POST https://embedapi.kprudhvi71.workers.dev/search \
  -H "Authorization: Bearer your-openai-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "AI and software engineering",
    "topK": 5,
    "filter": {
      "category": "technology",
      "author": "jane_doe"
    },
    "includeValues": false,
    "returnSimilarityScores": true
  }'
```

**Response:**
```json
{
  "query": "AI and software engineering", 
  "results": [
    {
      "id": "a1b2c3d4e5f6789",
      "score": 0.94,
      "text": "Machine learning is transforming software development",
      "metadata": {
        "category": "technology",
        "source": "blog",
        "author": "jane_doe"
      }
    }
  ],
  "total": 1
}
```

**Search Parameters:**
- `query` (required): Text to search for
- `topK` (optional, default: 5): Number of results to return
- `filter` (optional): Metadata filtering conditions
- `includeValues` (optional, default: false): Include embedding vectors
- `includeMetadata` (optional, default: true): Include metadata
- `returnSimilarityScores` (optional, default: true): Include similarity scores

### DELETE /embed/:id - 🆕 Delete Embeddings

Removes an embedding from Vectorize.

**Request:**
```bash
curl -X DELETE https://embedapi.kprudhvi71.workers.dev/embed/a1b2c3d4e5f6789
```

**Response:**
```json
{
  "message": "Embedding deleted successfully",
  "id": "a1b2c3d4e5f6789"
}
```

## Setup & Development

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers and Vectorize access
- OpenAI API key

### Installation

1. Clone this repository:
```bash
git clone https://github.com/prudhvi1709/embedapi.git
cd embedapi
```

2. Install dependencies:
```bash
npm install
```

3. Login to Cloudflare:
```bash
npx wrangler login
```

4. Create the Vectorize index:
```bash
npx wrangler vectorize create embeddings-index --dimensions=1536 --metric=cosine
```

5. Create KV namespace (for backward compatibility):
```bash
npx wrangler kv namespace create "EMBEDDINGS_KV"
```

6. Update `wrangler.toml` with your namespace IDs (commands above show the IDs to use).

### Development

Run locally:
```bash
npm run dev
```

**Note**: Local development uses mocked Vectorize operations. For full testing, deploy to Cloudflare.

### Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Use Cases

### 1. **Semantic Search**
Find content by meaning, not just keywords:
```bash
# Search for conceptually similar content
curl -X POST .../search -d '{"query": "machine learning applications"}'
```

### 2. **Content Recommendation**
Filter by metadata and find similar items:
```bash
curl -X POST .../search -d '{
  "query": "user preferences", 
  "filter": {"content_type": "article", "language": "en"}
}'
```

### 3. **RAG (Retrieval Augmented Generation)**
Power AI chatbots with contextual knowledge:
```bash
# Find relevant context for AI responses
curl -X POST .../search -d '{
  "query": "customer support question",
  "filter": {"domain": "technical_docs"},
  "topK": 3
}'
```

### 4. **Duplicate Detection**
Find similar or duplicate content:
```bash
curl -X POST .../search -d '{
  "query": "potential duplicate content",
  "returnSimilarityScores": true
}'
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │     OpenAI       │    │   Vectorize     │
│    Workers      │───▶│   Embeddings     │    │   Database      │
│                 │    │      API         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                               │
         └───────────────────────────────────────────────┘
                    Hybrid Search + Storage
```

## Performance & Limits

### Vectorize Benefits over KV
- **Native vector operations**: Cosine similarity, dot product, euclidean distance
- **Metadata filtering**: Complex queries with multiple conditions  
- **Better performance**: Optimized for high-dimensional vector operations
- **Cost efficiency**: No large JSON serialization/deserialization
- **Scalability**: Built for millions of vectors

### Current Limits
- **Vectorize**: 200,000 vectors (free tier), 10M+ (paid)
- **Workers**: 100,000 requests/day (free tier)
- **OpenAI**: Rate limits vary by plan
- **Vector dimensions**: 1536 (text-embedding-3-small)

## Migration from v1.0 (KV-based)

If you're upgrading from the KV-based version:

1. **Gradual migration**: Both KV and Vectorize bindings are configured
2. **Backup data**: Export existing embeddings before migration
3. **Update clients**: Use new `/search` endpoint for hybrid search
4. **Remove KV**: After migration, remove KV binding from `wrangler.toml`

## Security

- **API Keys**: OpenAI keys passed per-request, never stored
- **CORS**: Enabled for cross-origin requests  
- **Input validation**: Comprehensive request validation
- **Rate limiting**: Inherit from Cloudflare Workers and OpenAI

## Examples

### Content Management System
```javascript
// Store document with rich metadata
await fetch('/embed', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer sk-...', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: document.content,
    metadata: {
      title: document.title,
      author: document.author,
      category: document.category,
      published_date: document.date,
      tags: document.tags
    }
  })
});

// Search with filters
const results = await fetch('/search', {
  method: 'POST', 
  headers: { 'Authorization': 'Bearer sk-...', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: userQuery,
    filter: {
      category: selectedCategory,
      published_date: { $gte: '2024-01-01' }
    },
    topK: 10
  })
});
```

### E-commerce Search
```javascript
// Product search with metadata filtering
const productSearch = await fetch('/search', {
  method: 'POST',
  body: JSON.stringify({
    query: 'comfortable running shoes',
    filter: {
      category: 'footwear',
      price_range: 'mid-tier',
      brand: ['nike', 'adidas', 'asics']
    },
    topK: 20
  })
});
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/vectorize-enhancement`
3. Make changes and test: `npm test`
4. Submit a pull request

## Changelog

### v2.0.0 - Vectorize Integration
- **Added**: Cloudflare Vectorize for vector storage
- **Added**: `/search` endpoint for hybrid search
- **Added**: `/delete` endpoint for cleanup operations
- **Added**: Rich metadata support and filtering
- **Improved**: Performance and scalability
- **Improved**: Error handling and validation

### v1.0.0 - Initial Release
- Basic embedding generation and storage using KV
- OpenAI integration
- Simple CRUD operations

## License

[MIT License](LICENSE)

## Author

[@prudhvi1709](https://github.com/prudhvi1709)