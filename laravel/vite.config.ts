import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import * as glob from "glob";

// Laravel blade向けのtsファイルを取得
const laravelEntries = glob.sync("resources/ts/laravel/*.ts");
console.log(laravelEntries);

export default defineConfig({
    plugins: [
        laravel({
            input: [
                ...laravelEntries,
                "resources/ts/app.tsx",
                "resources/css/app.css",
                "resources/sass/app.scss",
            ],
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            "@": "/resources/ts",
        },
    },
});
