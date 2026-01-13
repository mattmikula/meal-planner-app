import { vi } from "vitest";

export type SupabaseResult<T> = {
  data: T;
  error: { message: string } | null;
};

type SupabaseQuery<T> = {
  select: (...args: unknown[]) => SupabaseQuery<T>;
  insert: (...args: unknown[]) => SupabaseQuery<T>;
  upsert: (...args: unknown[]) => SupabaseQuery<T>;
  update: (...args: unknown[]) => SupabaseQuery<T>;
  delete: (...args: unknown[]) => SupabaseQuery<T>;
  eq: (...args: unknown[]) => SupabaseQuery<T>;
  is: (...args: unknown[]) => SupabaseQuery<T>;
  order: (...args: unknown[]) => SupabaseQuery<T>;
  limit: (...args: unknown[]) => SupabaseQuery<T>;
  maybeSingle: () => Promise<SupabaseResult<T>>;
  single: () => Promise<SupabaseResult<T>>;
  then: (
    resolve: (value: SupabaseResult<T>) => unknown,
    reject: (reason?: unknown) => unknown
  ) => Promise<unknown>;
};

export function createQuery<T>(result: SupabaseResult<T>): SupabaseQuery<T> {
  const query = {} as SupabaseQuery<T>;
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
