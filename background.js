let lastProcessedUrl = ""; // Lưu URL gần nhất đã xử lý thành công
var subTitleLoaded = false;
const urlSkipList = [];
var beforeRequestCount = 0;
var onCompletedCount = 0;
var isFetchedMetadata = false;
var metaDataUrl = null;
var movieID = null;

chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        const currentUrl = details.url;
         if (currentUrl.includes("/metadata?") && details.type === "xmlhttprequest") {
            if (metaDataUrl === currentUrl) return;
            // console.log("Đang tải metadata:", currentUrl);
            metaDataUrl = currentUrl;
            if (details.tabId !== -1) { // Kiểm tra nếu tabId hợp lệ
                await fetchMetadata(currentUrl, details.tabId);
            }
        }

        // filter URL and get subtitle url content
        if (currentUrl.includes("/?o=") && details.type === "xmlhttprequest") {
            if (subTitleLoaded) return;
            if (details.tabId !== -1) { // Kiểm tra nếu tabId hợp lệ
                await fetchSubtitleContent(currentUrl, details.tabId);
            }
        }
    },
    { urls: ["*://*.nflxvideo.net/*", "*://*.netflix.com/nq/website/memberapi/release/metadata*"] }
);

// Lắng nghe yêu cầu từ Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_SUBTITLE_RAW") {
        fetchSubtitleContent(request.url, sender.tab.id).then(result => {
            sendResponse(result);
        });

        return true; // Bắt buộc trả về true để giữ kết nối không đồng bộ
    }
});

chrome.webRequest.onCompleted.addListener(
    async function(details) {
        const currentUrl = details.url;
        // Kiểm tra nếu là URL phụ đề của Netflix

        if (currentUrl.includes("/?o=") && details.statusCode === 200 && details.type === "xmlhttprequest") {
            urlSkipList.push(currentUrl);
            if (subTitleLoaded) {
                // Load subtitle
                if (details.tabId !== -1) { // Kiểm tra nếu tabId hợp lệ
                    await fetchSubtitleContent(currentUrl, details.tabId); // Chấp nhận tải lại phụ đề lúc đầu tiên
                }
            }
        }
    },
    { urls: ["*://*.netflix.com/*",  "*://*.nflxvideo.net/*"] }
);

async function fetchMetadata(url, tabId) {
    try {
        const response = await fetch(url);
        const jsonData = await response.json();

        isFetchedMetadata = true;
        movieID = (jsonData && jsonData.video) ? (jsonData.video.currentEpisode ? jsonData.video.currentEpisode : jsonData.video.id) : null; // Lưu movieId từ metadata
        // console.log("Metadata đã được tải:", {"currentEpisode": jsonData.video.currentEpisode, "MovieID": jsonData.video.id});

    } catch (error) {
        console.error("Lỗi khi tải metadata:", error);
    }
}

async function fetchSubtitleContent(url, tabId) {
    try {
        const response = await fetch(url);
        const xmlText = await response.text();

        subTitleLoaded = isFullSubTitleData(xmlText.toString());
        // console.log("Phụ đề đã được tải:", subTitleLoaded);
        // console.log("MovieID:", movieID);
        if (subTitleLoaded) {
            chrome.tabs.sendMessage(tabId, {
                    type: "SUBTITLE_RAW_XML",
                    xml: xmlText,
                    meta_data: { url: url, movieId: movieID, language: currentLanguageFromXML(xmlText) }
            });
        }

        return true;
        
    } catch (error) {
        console.error("Lỗi khi tải phụ đề:", error);
    }
}

const isFullSubTitleData = (xmlString) => {
    const match = xmlString.match(/nttm:textType="([^"]+)"/);
    // if (match) {
    //     console.log(match[1]); // Kết quả: "CC"
    // }

    return match ? (match[1] === "CC" || match[1] === "SUBS") : false;
}

const movieIdFromXML = (xmlString) => {
    const id = xmlString.match(/nttm:movieID="([^"]+)"/);

    return id ? id[1] : null;
}

const currentLanguageFromXML = (xmlString) => {
    const lang = xmlString.match(/xml:lang="([^"]+)"/);

    return lang ? lang[1] : null;
}
