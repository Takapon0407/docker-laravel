import { showpopupNotification } from "./util/notification";

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

// metamaskのaddressをクリップボードへコピー
const copyButton = document.getElementById("metamask-logo");

if (copyButton) {
    copyButton.addEventListener("click", function () {
        const textToCopy = "0x83C989e4Af7ACa81066f4F7E3a29f190d88fB14a";
        navigator.clipboard
            .writeText(textToCopy)
            .then(() => showpopupNotification("アドレスをクリップボードへコピーしました！"));
    });
}
