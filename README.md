# EmbedAPI

A minimal serverless API built with Cloudflare Workers that generates and stores text embeddings using OpenAI's `text-embedding-3-small` model.

## Features

- **POST /embed** - Generate embeddings for text and store them
- **GET /embed/:id** - Retrieve stored text and embeddings by ID
- Built on Cloudflare Workers for global edge deployment
- Uses Cloudflare KV for persistent storage
- Integrates with OpenAI's embedding API

## API Endpoints

### POST /embed

Generates embeddings for the provided text and stores them in KV storage.

**Request:**
```bash
curl -X POST https://your-worker.workers.dev/embed \
  -H "Authorization: Bearer your-openai-api-key" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'
```

**Request Headers:**
- `Authorization: Bearer <your-openai-api-key>` - Your OpenAI API key
- `Content-Type: application/json`

**Request Body:**
```json
{
  "text": "Your text to embed"
}
```

**Response:**
```json
{
  "id": "a1b2c3d4"
}
```

### GET /embed/:id

Retrieves the original text and embedding for a given ID.

**Request:**
```bash
curl https://your-worker.workers.dev/embed/a1b2c3d4
```

**Response:**
```json
{
  "id": "a1b2c3d4",
  "text": "Hello, world!",
  "embedding": [0.1, 0.2, 0.3, ...],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Setup

### Prerequisites

- Node.js installed
- Cloudflare account
- OpenAI API key

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd embedapi
```

2. Install dependencies:
```bash
npm install
```

3. Login to Cloudflare:
```bash
npx wrangler auth login
```

4. Create a KV namespace:
```bash
npx wrangler kv:namespace create "EMBEDDINGS_KV"
npx wrangler kv:namespace create "EMBEDDINGS_KV" --preview
```

5. Update `wrangler.toml` with your KV namespace IDs:
```toml
[[kv_namespaces]]
binding = "EMBEDDINGS_KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

### Development

Run the worker locally:
```bash
npm run dev
```

### Testing

Run the comprehensive test suite:
```bash
npm test
```

The tests cover:
- Unit tests for all API functions
- Integration tests for full workflows
- Error handling and edge cases
- OpenAI API integration mocking
- CORS and response format validation

### Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Environment Variables

No environment variables are required. The OpenAI API key is provided per-request via the Authorization header.

## Data Storage

Data is stored in Cloudflare KV with the following structure:

```json
{
  "text": "Original input text",
  "embedding": [0.1, 0.2, 0.3, ...],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (missing or invalid API key)
- `404` - Not Found (embedding ID not found)
- `500` - Internal Server Error

## Rate Limits

Rate limits are governed by:
- Cloudflare Workers limits (100,000 requests/day on free tier)
- OpenAI API rate limits (varies by plan)
- Cloudflare KV limits (1,000 writes/day on free tier)

## Security Considerations

- OpenAI API keys are passed via request headers and not stored
- CORS is enabled for cross-origin requests
- No authentication is implemented beyond OpenAI API key validation

## Testing

EmbedAPI includes a comprehensive test suite built with Vitest and `@cloudflare/vitest-pool-workers` that runs tests directly in the Cloudflare Workers runtime environment. The tests cover:

- **Unit Tests**: Individual function testing with mocked dependencies
- **Integration Tests**: Full API workflow testing with real request/response cycles
- **Error Handling**: Comprehensive error scenarios and edge cases
- **OpenAI Integration**: Mocked OpenAI API responses for reliable testing
- **Data Integrity**: Validation of embedding storage and retrieval

## License

MIT License 