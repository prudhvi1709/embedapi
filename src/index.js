/**
 * Cloudflare Workers API for text embeddings using OpenAI and Vectorize
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (request.method === 'POST' && url.pathname === '/embed') {
      return handleEmbed(request, env);
    }
    
    if (request.method === 'GET' && url.pathname.startsWith('/embed/')) {
      return handleGet(pathParts[1], env);
    }

    if (request.method === 'POST' && url.pathname === '/search') {
      return handleSearch(request, env);
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/embed/')) {
      return handleDelete(pathParts[1], env);
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }
};

async function handleEmbed(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return errorResponse('Missing Authorization header', 401);
  }

  const { text, metadata = {} } = await request.json().catch(() => ({}));
  if (!text || typeof text !== 'string') {
    return errorResponse('Missing or invalid text field', 400);
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    })
  });

  if (!response.ok) return errorResponse('Failed to generate embedding', response.status);

  const { data } = await response.json();
  const id = Math.random().toString(36).substring(2, 15);
  
  try {
    await env.EMBEDDINGS_VECTORIZE.upsert([{
      id,
      values: data[0].embedding,
      metadata: { text, timestamp: new Date().toISOString(), ...metadata }
    }]);
    return jsonResponse({ id });
  } catch (error) {
    return errorResponse('Failed to store embedding', 500);
  }
}

async function handleGet(id, env) {
  if (!id) return errorResponse('Missing ID parameter', 400);

  try {
    const results = await env.EMBEDDINGS_VECTORIZE.getByIds([id]);
    if (!results?.length) return errorResponse('Embedding not found', 404);

    const vector = results[0];
    return jsonResponse({
      id: vector.id,
      text: vector.metadata.text,
      embedding: vector.values,
      timestamp: vector.metadata.timestamp
    });
  } catch (error) {
    return errorResponse('Failed to retrieve embedding', 500);
  }
}

async function handleSearch(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return errorResponse('Missing Authorization header', 401);
  }

  const { query, topK = 5, filter } = await request.json().catch(() => ({}));
  if (!query || typeof query !== 'string') {
    return errorResponse('Missing or invalid query field', 400);
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: query,
      model: 'text-embedding-3-small'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return errorResponse(`OpenAI API failed: ${errorText}`, response.status);
  }

  try {
    const openaiResponse = await response.json();
    
    if (!openaiResponse.data || !openaiResponse.data[0] || !openaiResponse.data[0].embedding) {
      return errorResponse(`Invalid response from OpenAI: ${JSON.stringify(openaiResponse)}`, 500);
    }
    
    const embedding = openaiResponse.data[0].embedding;
    
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      return errorResponse(`Invalid embedding data received: ${embedding?.length || 0} dimensions`, 500);
    }
    
    const searchOptions = { topK, returnMetadata: true };
    if (filter) searchOptions.filter = filter;

    const results = await env.EMBEDDINGS_VECTORIZE.query(embedding, searchOptions);
    
    return jsonResponse({
      query,
      results: results.matches.map(match => ({
        id: match.id,
        score: match.score,
        text: match.metadata?.text
      }))
    });
  } catch (error) {
    return errorResponse(`Search failed: ${error.message}`, 500);
  }
}

async function handleDelete(id, env) {
  if (!id) return errorResponse('Missing ID parameter', 400);
  try {
    await env.EMBEDDINGS_VECTORIZE.deleteByIds([id]);
    return jsonResponse({ message: 'Embedding deleted successfully', id });
  } catch (error) {
    return errorResponse('Failed to delete embedding', 500);
  }
} 