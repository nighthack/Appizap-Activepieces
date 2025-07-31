import axios from 'axios';

export function getSchema(schema: string) {
  return 'appizap_' + schema?.replace(/-/g, '_');
}

export async function getUUID(orgId: string): Promise<string> {
  const schema = getSchema(orgId);
  const email = `${schema}@example.com`;
  const query = `select id from auth.users where email='${email}'`;
  const res = await runQuery(query);
  return res.data[0]?.id;
}

export async function getBuckets(userUUID: string): Promise<{ id: string; name: string }[]> {
  const query = `select * from storage.buckets where owner='${userUUID}'`;
  const res = await runQuery(query);
  return res.data;
}

export async function runQuery(query: string) {
  const supabaseGateway = process.env['AP_SUPABASE_GATEWAY'];
  const supabaseApiKey = process.env['AP_SUPABASE_API_KEY'];
  if (!supabaseGateway) throw new Error('no gateway url present');
  if (!supabaseApiKey) throw new Error('no api key present');

  const headers = {
    'Content-Type': 'application/json',
    apikey: supabaseApiKey,
  };

  try {
    return await axios.post(`${supabaseGateway}/pg/query`, { query }, { headers });
  } catch (err: any) {
    console.error('Error in runQuery:', query, err.response?.data || err.message);
    throw new Error(err.response?.data?.message || 'Query failed');
  }
}
