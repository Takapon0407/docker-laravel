import React from "react";
import ImageGallery from "react-image-gallery";

// TODO: 以下のデータはAWSのS3に配置したオブジェクトの情報で置き換える
const images = [
    {
        original: "https://picsum.photos/id/1018/1000/600/",
        thumbnail: "https://picsum.photos/id/1018/250/150/",
        description: "2022/10/30", // 撮影日時をメタデータから取得して入れる
    },
    {
        original: "https://picsum.photos/id/1015/1000/600/",
        thumbnail: "https://picsum.photos/id/1015/250/150/",
        description: "2022/10/31",
    },
    {
        original: "https://picsum.photos/id/1019/1000/600/",
        thumbnail: "https://picsum.photos/id/1019/250/150/",
        description: "2022/11/01",
    },
];

const Portfolio = () => (
    <div>
        <h2>Portfolio!</h2>
        My Portfolio page!
        <ImageGallery
            items={images}
            showNav={false}
            showBullets={false}
            autoPlay={true}
            showFullscreenButton={false}
            useBrowserFullscreen={false}
            showPlayButton={false}
        />
    </div>
);

export default Portfolio;
