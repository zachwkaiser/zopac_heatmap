export async function POST(req) {
  const API_KEY = 'EXAMPLE_API_KEY';
  const apikey = req.headers.get('x-api-key');

  if (apikey !== API_KEY) {
    return new Response(
      JSON.stringify({ error: 'This endpoint is unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = await req.json();

  return new Response(JSON.stringify({ message: 'Data received', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}