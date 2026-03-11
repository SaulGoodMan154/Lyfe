import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

const client = new Client({
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.xyhekegfanurgypucvbr',
    password: 'HarSpeR0290NY@564213',
    ssl: { rejectUnauthorized: false },
});

const sql = readFileSync('./supabase/fix_rls.sql', 'utf8');

try {
    await client.connect();
    console.log('✅ Connected to Supabase');
    await client.query(sql);
    console.log('✅ RLS policies fixed successfully!');
} catch (err) {
    console.error('❌ Error:', err.message);
} finally {
    await client.end();
}
