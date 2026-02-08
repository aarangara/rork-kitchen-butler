const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

interface SurrealResponse<T = unknown> {
  result: T;
  status: string;
  time: string;
}

export async function query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]> {
  if (!endpoint || !namespace || !token) {
    throw new Error('Database environment variables not configured');
  }

  const httpEndpoint = endpoint.replace('wss://', 'https://').replace('ws://', 'http://');
  const url = `${httpEndpoint}/sql`;

  const body = vars ? `${sql}` : sql;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'NS': namespace,
      'DB': 'helpmecook',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('SurrealDB query failed:', errorText);
    throw new Error(`Database query failed: ${response.status}`);
  }

  const data = await response.json() as SurrealResponse<T>[];
  
  if (Array.isArray(data) && data.length > 0) {
    return data.map(r => r.result).flat() as T[];
  }
  
  return [];
}

export async function create<T = unknown>(table: string, data: Record<string, unknown>): Promise<T | null> {
  const id = data.id || crypto.randomUUID();
  const sql = `CREATE ${table}:${id} CONTENT $data`;
  
  const results = await query<T>(sql, { data });
  return results[0] || null;
}

export async function select<T = unknown>(table: string, where?: string): Promise<T[]> {
  const sql = where ? `SELECT * FROM ${table} WHERE ${where}` : `SELECT * FROM ${table}`;
  return query<T>(sql);
}

export async function update<T = unknown>(table: string, id: string, data: Record<string, unknown>): Promise<T | null> {
  const sql = `UPDATE ${table}:${id} MERGE $data`;
  const results = await query<T>(sql, { data });
  return results[0] || null;
}

export async function remove(table: string, id: string): Promise<boolean> {
  const sql = `DELETE ${table}:${id}`;
  await query(sql);
  return true;
}

export async function initializeSchema(): Promise<void> {
  try {
    await query(`
      DEFINE TABLE IF NOT EXISTS pantry SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS name ON TABLE pantry TYPE string;
      DEFINE FIELD IF NOT EXISTS category ON TABLE pantry TYPE string;
      DEFINE FIELD IF NOT EXISTS inStock ON TABLE pantry TYPE bool;
      DEFINE FIELD IF NOT EXISTS userId ON TABLE pantry TYPE string;
      DEFINE FIELD IF NOT EXISTS createdAt ON TABLE pantry TYPE datetime;
      DEFINE INDEX IF NOT EXISTS idx_pantry_userId ON TABLE pantry COLUMNS userId;
      
      DEFINE TABLE IF NOT EXISTS recipes SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS title ON TABLE recipes TYPE string;
      DEFINE FIELD IF NOT EXISTS description ON TABLE recipes TYPE string;
      DEFINE FIELD IF NOT EXISTS imageUrl ON TABLE recipes TYPE string;
      DEFINE FIELD IF NOT EXISTS source ON TABLE recipes TYPE string;
      DEFINE FIELD IF NOT EXISTS sourceUrl ON TABLE recipes TYPE option<string>;
      DEFINE FIELD IF NOT EXISTS tags ON TABLE recipes TYPE array;
      DEFINE FIELD IF NOT EXISTS ingredients ON TABLE recipes TYPE array;
      DEFINE FIELD IF NOT EXISTS instructions ON TABLE recipes TYPE array;
      DEFINE FIELD IF NOT EXISTS servings ON TABLE recipes TYPE int;
      DEFINE FIELD IF NOT EXISTS prepTime ON TABLE recipes TYPE int;
      DEFINE FIELD IF NOT EXISTS cookTime ON TABLE recipes TYPE int;
      DEFINE FIELD IF NOT EXISTS difficulty ON TABLE recipes TYPE string;
      DEFINE FIELD IF NOT EXISTS isFavorite ON TABLE recipes TYPE bool;
      DEFINE FIELD IF NOT EXISTS userId ON TABLE recipes TYPE string;
      DEFINE FIELD IF NOT EXISTS createdAt ON TABLE recipes TYPE datetime;
      DEFINE INDEX IF NOT EXISTS idx_recipes_userId ON TABLE recipes COLUMNS userId;
      DEFINE INDEX IF NOT EXISTS idx_recipes_createdAt ON TABLE recipes COLUMNS createdAt;
    `);
    
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('⚠️ Schema initialization warning:', error);
  }
}
