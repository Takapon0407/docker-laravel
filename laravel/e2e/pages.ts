// 回帰テストで毎回開くページ。ページを増やしたらここにも足す
// footer：フッター（プライバシーポリシーへのリンク）があるか。ゲームは画面いっぱいに使うのでフッターがない
export interface SitePage {
    readonly path: string;
    readonly footer: boolean;
}

const withFooter = (path: string): SitePage => ({ path, footer: true });

export const PAGES: readonly SitePage[] = [
    withFooter("/"),
    withFooter("/works"),
    withFooter("/works/rain-and-realms"),
    withFooter("/hobbies"),
    { path: "/games/tetris", footer: false },
    { path: "/games/puyo", footer: false },
    withFooter("/tools"),
    withFooter("/tools/warikan"),
    withFooter("/tools/board"),
    withFooter("/tools/lifespan"),
    withFooter("/tools/countdown"),
    withFooter("/tools/pixel-art"),
    withFooter("/tools/chord-player"),
    withFooter("/tools/json"),
    withFooter("/tools/datetime"),
    withFooter("/tools/regex"),
    withFooter("/privacy"),
];
