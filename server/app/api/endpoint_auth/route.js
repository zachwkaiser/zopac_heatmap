// only if env file is in server
//import dotenv from 'dotenv';
//import path from 'path';

//dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

export async function POST(req) {
  
  const API_KEY = process.env.AUTH_SECRET;

  const apikey = req.headers.get('x-api-key');

  if (apikey !== API_KEY) {
    return new Response(
      JSON.stringify({ error: 'This endpoint is unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let data;
  try {
    data = await req.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Logic for receiving then adding data to database will here 

  return new Response(
    JSON.stringify({ message: 'Data received', data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}