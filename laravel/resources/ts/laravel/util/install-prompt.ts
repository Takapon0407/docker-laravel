// 「ホーム画面に追加」ボタン
// - Android の Chrome など: ブラウザが追加できると判断したとき（beforeinstallprompt）にボタンを出し、押したら追加の画面を開く
// - iPhone / iPad: ページから追加の画面を開く方法がないため、ボタンを押したら Safari での手順を出す
// - すでにホーム画面から開いているときは出さない

// lib.dom に型がないため必要な分だけ書く
interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let onAvailable: (() => void) | null = null;

// ページを読み込んですぐ発生することがあるため、DOMContentLoaded を待たずに受け取っておく
window.addEventListener("beforeinstallprompt", (event) => {
    // ブラウザが自分で出す案内の代わりに、ボタンから開く
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    onAvailable?.();
});

function isStandalone(): boolean {
    // navigator.standalone は iOS の Safari だけにある
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
    // iPadOS の Safari は Mac として振る舞うため、タッチ操作できるかでも見分ける
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function setUpInstallButton(container: HTMLElement, button: HTMLButtonElement, iosHelp: HTMLElement): void {
    if (isStandalone()) {
        return;
    }

    if (isIos()) {
        container.hidden = false;
        button.addEventListener("click", () => {
            iosHelp.hidden = !iosHelp.hidden;
        });
        return;
    }

    onAvailable = () => {
        container.hidden = false;
    };
    if (deferredPrompt) {
        onAvailable();
    }

    button.addEventListener("click", () => {
        if (!deferredPrompt) {
            return;
        }
        const prompt = deferredPrompt;
        // 1 つのイベントで開けるのは 1 回だけ（閉じたら、次の beforeinstallprompt でまた出す）
        deferredPrompt = null;
        container.hidden = true;
        void prompt.prompt();
    });

    window.addEventListener("appinstalled", () => {
        container.hidden = true;
    });
}
