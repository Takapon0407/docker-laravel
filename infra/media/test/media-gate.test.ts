import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// CloudFront Function（edge/media-gate.js）を、KeyValueStore を偽物にして動かす
type Kvs = { get(key: string): Promise<string> };
type Handler = (event: { request: { uri: string } }) => Promise<unknown>;

async function loadGate(kvs: Kvs): Promise<{ handler: Handler; kvsId: string | undefined }> {
    const source = readFileSync(new URL("../edge/media-gate.js", import.meta.url), "utf8");
    const holder = globalThis as { __cf?: unknown; __kvsId?: string };
    holder.__kvsId = undefined;
    holder.__cf = {
        kvs(id: string) {
            holder.__kvsId = id;
            return kvs;
        },
    };
    const code = source.replace('import cf from "cloudfront";', "const cf = globalThis.__cf;") + "\nexport { handler };";
    const module = (await import(`data:text/javascript,${encodeURIComponent(code)}#${Math.random()}`)) as { handler: Handler };
    return { handler: module.handler, kvsId: holder.__kvsId };
}

const request = { uri: "/media/rain-and-realms/kominka-rain/01-first-drops-on-the-engawa.m4a" };

test("media_enabled が true なら、そのままオリジン（S3）へ通す", async () => {
    const { handler, kvsId } = await loadGate({ get: async () => "true" });
    assert.equal(kvsId, "__KVS_ID__");
    assert.deepEqual(await handler({ request }), request);
});

test("media_enabled が false なら 403 を返し、キャッシュさせない", async () => {
    const { handler } = await loadGate({ get: async () => "false" });
    assert.deepEqual(await handler({ request }), {
        statusCode: 403,
        statusDescription: "Forbidden",
        headers: { "cache-control": { value: "no-store" } },
    });
});

test("キーが読めないときは配信を続ける", async () => {
    const { handler } = await loadGate({
        get: async () => {
            throw new Error("not found");
        },
    });
    assert.deepEqual(await handler({ request }), request);
});
