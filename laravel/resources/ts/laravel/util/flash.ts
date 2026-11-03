// 結果が変わったことを知らせるため、要素の背景を一瞬光らせる（見た目は _devtools.scss の .is-updated）
export function flash(element: HTMLElement): void {
    element.classList.remove("is-updated");
    // 続けて変わったときも、もう一度光らせる（クラスを外したことをブラウザに反映させてから付け直す）
    void element.offsetWidth;
    element.classList.add("is-updated");
}
