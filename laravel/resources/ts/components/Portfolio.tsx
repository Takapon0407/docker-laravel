import React from "react";
import ImageGallery from "react-image-gallery";

// TODO: 以下のデータはAWSのS3に配置したオブジェクトの情報で置き換えるので、以下形式のresponseを返すAPIを作る
const images = [
    {
        // Example get photo from S3
        original:
            "https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC00909.jpg",
        thumbnail:
            "https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC00909.jpg",
        description: "2022/10/30", // 撮影日時をメタデータから取得して入れる
    },
    {
        original:
            "https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC00348.jpg",
        thumbnail:
            "https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC00348.jpg",
        description: "2022/10/31",
    },
    {
        original:
            "https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC08950.jpg",
        thumbnail:
            "https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC08950.jpg",
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
            autoPlay={true}
            showFullscreenButton={false}
            useBrowserFullscreen={false}
            showPlayButton={false}
            showThumbnails={false}
        />
    </div>
);

export default Portfolio;
