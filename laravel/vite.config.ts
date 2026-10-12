import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import * as glob from "glob";

// Laravel blade向けのtsファイルを取得
const laravelEntries = glob.sync("resources/ts/laravel/**/*.ts");

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
            // bootstrap(node_modules)側の Sass 非推奨警告を抑制
            scss: { quietDeps: true },
        },
    },
    resolve: {
        alias: {
            "@": "/resources/ts",
        },
    },
});
