import { showPopupNotification } from "./notification";

// data-copy-target="要素の id" を付けたボタンで、その要素の値（入力欄なら value、ほかは中の文字）をコピーする
// 中身があとから変わる要素にも使えるよう、押したときに読む
export function setUpCopyButtons(root: ParentNode = document): void {
    root.querySelectorAll<HTMLButtonElement>("[data-copy-target]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.copyTarget!);
            const text = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : (target?.textContent ?? "");
            if (text === "") {
                return;
            }
            navigator.clipboard.writeText(text).then(
                () => showPopupNotification("コピーしました"),
                () => showPopupNotification("コピーできませんでした"),
            );
        });
    });
}
