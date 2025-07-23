import { env, SELF, fetchMock, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import worker from '../src/index.js';

// Mock OpenAI API responses
const mockEmbeddingResponse = {
  data: [{
    embedding: [0.1, 0.2, 0.3, -0.1, -0.2], // Mock embedding vector
    index: 0,
    object: "embedding"
  }],
  model: "text-embedding-3-small",
  object: "list",
  usage: {
    prompt_tokens: 5,
    total_tokens: 5
  }
};

describe('EmbedAPI', () => {
  beforeAll(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  afterEach(() => {
    fetchMock.assertNoPendingInterceptors();
  });

  beforeEach(() => {
    // Clear KV store before each test
    // This is handled automatically by isolated storage in vitest-pool-workers
  });

  describe('Unit Tests - handleEmbed function', () => {
    it('should reject requests without Authorization header', async () => {
      const request = new Request('http://example.com/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test text' })
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing Authorization header');
    });

    it('should reject requests with malformed Authorization header', async () => {
      const request = new Request('http://example.com/embed', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'InvalidFormat'
        },
        body: JSON.stringify({ text: 'test text' })
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing Authorization header');
    });

    it('should reject requests without text field', async () => {
      const request = new Request('http://example.com/embed', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({})
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing or invalid text field');
    });

    it('should reject requests with non-string text field', async () => {
      const request = new Request('http://example.com/embed', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({ text: 123 })
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing or invalid text field');
    });

    it('should reject requests with malformed JSON', async () => {
      const request = new Request('http://example.com/embed', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: 'invalid json'
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing or invalid text field');
    });

    it('should handle OpenAI API failure', async () => {
      // Mock OpenAI API to return error
      fetchMock
        .get('https://api.openai.com')
        .intercept({ path: '/v1/embeddings', method: 'POST' })
        .reply(500, { error: 'Internal server error' });

      const request = new Request('http://example.com/embed', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({ text: 'test text' })
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to generate embedding');
    });

    it('should successfully create embedding and store in KV', async () => {
      // Mock successful OpenAI API response
      fetchMock
        .get('https://api.openai.com')
        .intercept({ path: '/v1/embeddings', method: 'POST' })
        .reply(200, mockEmbeddingResponse);

      const request = new Request('http://example.com/embed', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({ text: 'Hello world' })
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');
      expect(data.id.length).toBe(8); // Random ID length
    });
  });

  describe('Unit Tests - handleGet function', () => {
    it('should return 400 for missing ID parameter', async () => {
      const request = new Request('http://example.com/embed/', {
        method: 'GET'
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing ID parameter');
    });

    it('should return 404 for non-existent embedding', async () => {
      const request = new Request('http://example.com/embed/nonexistent', {
        method: 'GET'
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Embedding not found');
    });

    it('should retrieve existing embedding from KV', async () => {
      // First, store an embedding
      const storedData = {
        text: 'Test text',
        embedding: [0.1, 0.2, 0.3],
        timestamp: new Date().toISOString()
      };
      const testId = 'test123';
      await env.EMBEDDINGS_KV.put(testId, JSON.stringify(storedData));

      const request = new Request(`http://example.com/embed/${testId}`, {
        method: 'GET'
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(testId);
      expect(data.text).toBe(storedData.text);
      expect(data.embedding).toEqual(storedData.embedding);
      expect(data.timestamp).toBe(storedData.timestamp);
    });
  });

  describe('Integration Tests - Full API workflow', () => {
    it('should handle OPTIONS requests with CORS headers', async () => {
      const response = await SELF.fetch('http://example.com/embed', {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should return 404 for unknown routes', async () => {
      const response = await SELF.fetch('http://example.com/unknown');

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not Found');
    });

    it('should complete full embedding creation and retrieval workflow', async () => {
      // Mock OpenAI API
      fetchMock
        .get('https://api.openai.com')
        .intercept({ path: '/v1/embeddings', method: 'POST' })
        .reply(200, mockEmbeddingResponse);

      // Step 1: Create embedding
      const createResponse = await SELF.fetch('http://example.com/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({ text: 'Integration test text' })
      });

      expect(createResponse.status).toBe(200);
      const createData = await createResponse.json();
      expect(createData).toHaveProperty('id');

      // Step 2: Retrieve embedding
      const getResponse = await SELF.fetch(`http://example.com/embed/${createData.id}`);

      expect(getResponse.status).toBe(200);
      const getData = await getResponse.json();
      expect(getData.id).toBe(createData.id);
      expect(getData.text).toBe('Integration test text');
      expect(getData.embedding).toEqual(mockEmbeddingResponse.data[0].embedding);
      expect(getData.timestamp).toBeDefined();
    });

    it('should handle concurrent requests correctly', async () => {
      // Mock OpenAI API for multiple requests
      fetchMock
        .get('https://api.openai.com')
        .intercept({ path: '/v1/embeddings', method: 'POST' })
        .reply(200, mockEmbeddingResponse)
        .times(3);

      // Create multiple embeddings concurrently
      const requests = [
        SELF.fetch('http://example.com/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: JSON.stringify({ text: 'Text 1' })
        }),
        SELF.fetch('http://example.com/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: JSON.stringify({ text: 'Text 2' })
        }),
        SELF.fetch('http://example.com/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: JSON.stringify({ text: 'Text 3' })
        })
      ];

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // All should have unique IDs
      const responseData = await Promise.all(responses.map(r => r.json()));
      const ids = responseData.map(data => data.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed Authorization header formats', async () => {
      const testCases = [
        'Bearer',
        'Bearer ',
        'Basic token',
        'token-without-bearer',
        ''
      ];

      for (const authHeader of testCases) {
        const response = await SELF.fetch('http://example.com/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({ text: 'test' })
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Missing Authorization header');
      }
    });

    it('should handle various invalid text inputs', async () => {
      const testCases = [
        { text: null },
        { text: undefined },
        { text: '' },
        { text: [] },
        { text: {} },
        { text: 123 },
        { text: true },
        { notText: 'value' }
      ];

      for (const testCase of testCases) {
        const response = await SELF.fetch('http://example.com/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          body: JSON.stringify(testCase)
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Missing or invalid text field');
      }
    });

    it('should handle OpenAI API rate limiting', async () => {
      fetchMock
        .get('https://api.openai.com')
        .intercept({ path: '/v1/embeddings', method: 'POST' })
        .reply(429, { 
          error: { 
            message: 'Rate limit exceeded',
            type: 'rate_limit_error' 
          } 
        });

      const response = await SELF.fetch('http://example.com/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify({ text: 'test text' })
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to generate embedding');
    });

    it('should preserve embedding data integrity', async () => {
      const testEmbedding = {
        text: 'Test with special chars: äöü 中文 🚀 "quotes" \'apostrophes\'',
        embedding: [0.123456789, -0.987654321, 0.0, 1.0, -1.0],
        timestamp: '2023-12-01T10:30:00.000Z'
      };
      
      const testId = 'integrity';
      await env.EMBEDDINGS_KV.put(testId, JSON.stringify(testEmbedding));

      const response = await SELF.fetch(`http://example.com/embed/${testId}`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.text).toBe(testEmbedding.text);
      expect(data.embedding).toEqual(testEmbedding.embedding);
      expect(data.timestamp).toBe(testEmbedding.timestamp);
    });
  });

  describe('OpenAI API Integration', () => {
    it('should send correct request format to OpenAI API', async () => {
      let capturedRequest;
      
      fetchMock
        .get('https://api.openai.com')
        .intercept({ 
          path: '/v1/embeddings', 
          method: 'POST',
          body: (body) => {
            capturedRequest = JSON.parse(body);
            return true;
          }
        })
        .reply(200, mockEmbeddingResponse);

      await SELF.fetch('http://example.com/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify({ text: 'Test input' })
      });

      expect(capturedRequest).toEqual({
        input: 'Test input',
        model: 'text-embedding-3-small'
      });
    });

    it('should forward authorization header to OpenAI', async () => {
      let capturedHeaders;
      
      fetchMock
        .get('https://api.openai.com')
        .intercept({ 
          path: '/v1/embeddings', 
          method: 'POST',
          headers: (headers) => {
            capturedHeaders = headers;
            return true;
          }
        })
        .reply(200, mockEmbeddingResponse);

      await SELF.fetch('http://example.com/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test-key-123'
        },
        body: JSON.stringify({ text: 'Test' })
      });

      expect(capturedHeaders.authorization).toBe('Bearer sk-test-key-123');
      expect(capturedHeaders['content-type']).toBe('application/json');
    });
  });

  describe('Response Format and CORS', () => {
    it('should return properly formatted JSON responses', async () => {
      const response = await SELF.fetch('http://example.com/embed/nonexistent');

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      
      const text = await response.text();
      expect(text.endsWith('\n')).toBe(true); // Should end with newline
      
      const data = JSON.parse(text);
      expect(data).toHaveProperty('error');
    });

    it('should handle CORS preflight for all endpoints', async () => {
      const endpoints = ['/embed', '/embed/test123'];
      
      for (const endpoint of endpoints) {
        const response = await SELF.fetch(`http://example.com${endpoint}`, {
          method: 'OPTIONS'
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      }
    });
  });
}); 