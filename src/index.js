/**
 * Cloudflare Workers API for text embeddings using OpenAI
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const jsonResponse = (data, status = 200) => 
  new Response(JSON.stringify(data, null, 2) + '\n', {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });

const errorResponse = (message, status) => jsonResponse({ error: message }, status);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);
    const [, , id] = url.pathname.split('/');

    if (request.method === 'POST' && url.pathname === '/embed') {
      return handleEmbed(request, env);
    }
    
    if (request.method === 'GET' && url.pathname.startsWith('/embed/')) {
      return handleGet(id, env);
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }
};

async function handleEmbed(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return errorResponse('Missing Authorization header', 401);
  }

  const { text } = await request.json().catch(() => ({}));
  if (!text || typeof text !== 'string') {
    return errorResponse('Missing or invalid text field', 400);
  }

  const apiKey = auth.slice(7);
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    })
  });

  if (!response.ok) return errorResponse('Failed to generate embedding', 500);

  const { data } = await response.json();
  const id = Math.random().toString(36).substring(2, 10);
  
  await env.EMBEDDINGS_KV.put(id, JSON.stringify({
    text,
    embedding: data[0].embedding,
    timestamp: new Date().toISOString()
  }));

  return jsonResponse({ id });
}

async function handleGet(id, env) {
  if (!id) return errorResponse('Missing ID parameter', 400);

  const data = await env.EMBEDDINGS_KV.get(id);
  if (!data) return errorResponse('Embedding not found', 404);

  const parsed = JSON.parse(data);
  return jsonResponse({
    id,
    text: parsed.text,
    embedding: parsed.embedding,
    timestamp: parsed.timestamp
  });
} 