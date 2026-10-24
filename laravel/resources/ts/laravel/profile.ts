import { showPopupNotification } from "./util/notification";

// 生年月日からの経過を「x歳 xヶ月 x日」で計算
const birthDate = new Date(1994, 3, 7);
const currentDate = new Date();

let ageYears = currentDate.getFullYear() - birthDate.getFullYear();
let ageMonths = currentDate.getMonth() - birthDate.getMonth();
let ageDays = currentDate.getDate() - birthDate.getDate();

if (ageDays < 0) {
    ageMonths--;
    // 前月の日数で繰り下げる
    ageDays += new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
}
if (ageMonths < 0) {
    ageYears--;
    ageMonths += 12;
}

const ageElement = document.getElementById("age");
if (ageElement) {
    ageElement.innerText = `年齢: ${ageYears}歳 ${ageMonths}ヶ月 ${ageDays}日`;
}

// MetaMask のアドレスをクリップボードへコピー
const METAMASK_ADDRESS = "0x83C989e4Af7ACa81066f4F7E3a29f190d88fB14a";
const metamaskButton = document.getElementById("metamask-button");

metamaskButton?.addEventListener("click", () => {
    navigator.clipboard
        .writeText(METAMASK_ADDRESS)
        .then(() => showPopupNotification("アドレスをクリップボードへコピーしました！"))
        // http での表示やブラウザの権限設定によってはコピーできないため、黙って失敗させない
        .catch(() => showPopupNotification("アドレスをコピーできませんでした"));
});
