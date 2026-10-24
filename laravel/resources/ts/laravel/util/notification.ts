// 画面下に通知を表示し、しばらくしたら隠す（#notification の要素を使う）
const VISIBLE_MS = 3000;
let hideTimer: number | undefined;

export function showPopupNotification(message: string): void {
    const notification = document.getElementById("notification");
    if (!notification) {
        return;
    }

    notification.textContent = message;
    notification.classList.add("is-visible");

    // 続けて表示したときは、最後の表示から数えて隠す
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => notification.classList.remove("is-visible"), VISIBLE_MS);
}
