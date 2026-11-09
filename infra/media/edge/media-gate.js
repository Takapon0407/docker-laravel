// CloudFront Function（JS 2.0）：/media/* のビヘイビアの viewer request に付ける
// KeyValueStore の media_enabled が "false" のとき（その月の転送量が上限を超えたとき）は 403 を返す。
// キャッシュを見る前に動くため、キャッシュ済みのファイルも返さない。
// cf.kvs() に渡す ID は、デプロイ時に KeyValueStore の ID に置き換える（lib/media-stack.ts）
import cf from "cloudfront";

const kvs = cf.kvs("__KVS_ID__");

async function handler(event) {
    let enabled = "true";
    try {
        enabled = await kvs.get("media_enabled");
    } catch (e) {
        // キーが読めないときは配信を続ける（上限の判定は Lambda が 5 分おきに書き直す）
    }
    if (enabled === "false") {
        return {
            statusCode: 403,
            statusDescription: "Forbidden",
            headers: { "cache-control": { value: "no-store" } },
        };
    }
    return event.request;
}
