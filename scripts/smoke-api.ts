import { deepStrictEqual, match, strictEqual } from "node:assert/strict";

const baseUrl = "http://127.0.0.1:8000";

async function request(
  path: string,
  status: number,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(`${baseUrl}${path}`, init);
  strictEqual(response.status, status, `${init?.method ?? "GET"} ${path}`);

  return response;
}

deepStrictEqual(await (await request("/health", 200)).json(), {
  status: "ok",
  database: "ok",
});

const input = { email: "ada@example.com", displayName: "Ada Lovelace" };
const create = {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(input),
};
const user = await (await request("/users", 201, create)).json();
strictEqual(user.email, input.email);
strictEqual(user.displayName, input.displayName);
match(user.id, /^[0-9a-f-]{36}$/);
strictEqual(new Date(user.createdAt).toISOString(), user.createdAt);

deepStrictEqual(await (await request(`/users/${user.id}`, 200)).json(), user);
deepStrictEqual(await (await request("/users", 200)).json(), { users: [user] });
await (await request("/users", 409, create)).body?.cancel();
await (await request("/users/not-a-uuid", 400)).body?.cancel();
await (await request("/users/00000000-0000-4000-8000-000000000000", 404)).body
  ?.cancel();
await (await request("/users", 400, { ...create, body: "{" })).body?.cancel();

console.log("API smoke checks passed against PostgreSQL");
