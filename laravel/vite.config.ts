import { globSync } from "node:fs";
import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";

// Laravel blade向けのtsファイルを取得
const laravelEntries = globSync("resources/ts/laravel/**/*.ts");

export default defineConfig({
    plugins: [
        laravel({
            input: [
                ...laravelEntries,
                "resources/sass/app.scss",
            ],
            refresh: true,
        }),
    ],
    css: {
        preprocessorOptions: {
            scss: {
                // bootstrap(node_modules)側の Sass 非推奨警告を抑制
                quietDeps: true,
                // Bootstrap 5 は @use に未対応のため、@import の非推奨警告のみ抑制
                silenceDeprecations: ["import"],
            },
        },
    },
    resolve: {
        alias: {
            "@": "/resources/ts",
        },
    },
});
