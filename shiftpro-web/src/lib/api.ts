import { supabase } from './supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

export async function callFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const raw = await error.context.text().catch(() => null);
      let message = error.message;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          message = parsed?.error?.message ?? parsed?.message ?? raw;
        } catch {
          message = raw;
        }
      }
      throw new Error(message);
    }
    throw error;
  }
  if (data === null) throw new Error(`Function "${name}" returned no data`);
  return data;
}
