import { supabase } from './supabase';

export async function callFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  if (data === null) throw new Error(`Function "${name}" returned no data`);
  return data;
}
