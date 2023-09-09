export function showpopupNotification(message: string): void {
    const notification = document.getElementById(
        "notification"
    ) as HTMLElement | null;

    if (notification) {
        notification.textContent = message;
        notification.classList.add("notification-enter");
        notification.style.display = "block";

        // 3秒後に自動的に非表示にする
        setTimeout(() => {
            notification.classList.remove("notification-enter");
            notification.classList.add("notification-exit");
            setTimeout(() => {
                notification.classList.remove("notification-exit");
            }, 500); // 0.5s is the duration set for the transition in CSS
        }, 3000);
    }
}
