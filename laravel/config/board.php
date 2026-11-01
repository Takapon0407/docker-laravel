<?php

// 匿名質問ボード（/tools/board）。バックエンドは infra/board（API Gateway の WebSocket ＋ Lambda）

return [
    // 公開するまでは false（ページを 404 にする）。公開は Issue #260
    'enabled' => (bool) env('BOARD_ENABLED', false),

    // ブラウザがつなぐ WebSocket の URL。空なら、ページと同じドメインの /tools/board/ws（本番の CloudFront 経由）
    // ローカルでは dev 環境の確認用 CloudFront（cdk deploy の TestWebSocketUrl）を指定する
    'websocket_url' => env('BOARD_WEBSOCKET_URL') ?: null,
];
