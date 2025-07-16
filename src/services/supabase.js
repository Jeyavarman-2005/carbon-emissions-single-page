import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dnpzxlmqgiancxnvkxbr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucHp4bG1xZ2lhbmN4bnZreGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODU0MjUsImV4cCI6MjA2ODA2MTQyNX0.TnBXmEI01WHgUnN1TK8D_3iv8sEOcRd6ac6MAgfODzY'; // Your actual anon public key


const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;