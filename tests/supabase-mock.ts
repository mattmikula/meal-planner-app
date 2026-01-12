import { vi } from "vitest";

export type SupabaseResult<T> = {
  data: T;
  error: { message: string } | null;
};

export function createQuery<T>(result: SupabaseResult<T>) {
  const query: Record<string, any> = {};
  const chain = () => query;

  query.select = vi.fn(chain);
  query.insert = vi.fn(chain);
  query.upsert = vi.fn(chain);
  query.update = vi.fn(chain);
  query.delete = vi.fn(chain);
  query.eq = vi.fn(chain);
  query.is = vi.fn(chain);
  query.order = vi.fn(chain);
  query.limit = vi.fn(chain);
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  query.then = (resolve: (value: SupabaseResult<T>) => unknown, reject: (reason?: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);

  return query;
}
