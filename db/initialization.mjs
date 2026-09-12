// Cache only completed schema initialization, scoped to this deployment and DB binding.
// Never retain request-owned promises or cache user/session/product data across requests.
const completed = new WeakMap();

export async function initializeSchema(database, key, initialize) {
  if (!database) throw new Error("Database unavailable");
  let keys = completed.get(database);
  if (!keys) { keys = new Set(); completed.set(database, keys); }
  if (keys.has(key)) return;
  // Concurrent cold requests can initialize independently. Failed work is retried next time.
  await initialize();
  keys.add(key);
}
