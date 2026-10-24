import Swiper from "swiper";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll<HTMLElement>(".photo-swiper").forEach((el) => {
        new Swiper(el, {
            modules: [Navigation, Pagination],
            // 1枚ずつ表示する場合、ループには2枚以上必要（足りないと Swiper が警告を出す）
            loop: el.querySelectorAll(".swiper-slide").length >= 2,
            pagination: {
                el: el.querySelector<HTMLElement>(".swiper-pagination")!,
                clickable: true,
            },
            navigation: {
                nextEl: el.querySelector<HTMLElement>(".swiper-button-next")!,
                prevEl: el.querySelector<HTMLElement>(".swiper-button-prev")!,
            },
            observer: true,
            observeParents: true,
        });
    });
});
