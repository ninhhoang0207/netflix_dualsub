const openSubtitleUI = () => {
    const langPopup = document.getElementById('lang-popup');
    if (langPopup) {
        langPopup.style.display = 'block';
    }
}

const closeSubtitleUI = () => {
      const langPopup = document.getElementById('lang-popup');
      if (langPopup) {
        langPopup.style.display = 'none';
    }
};

const cleanSubTitle = () => {
    mockSubtitles = []
}

// Khởi tạo UI khi nội dung được tải
// initExtensionUI();

function initExtensionUI() {
    // 1. Find container của Netflix
    const videoContainer = document.querySelector('.watch-video');
    if (!videoContainer) {
        // console.log("Video container found:", videoContainer);
        console.log("Không tìm thấy container video. Vui lòng thử lại sau khi trang đã tải xong.");
        return;
    }
    // const videoContainer = document.getElementsByTagName('video')[0];
    console.log("Video container found:", videoContainer);

    // 2. Generate Settings button 
    if (!document.getElementById('netflix-sub-settings-btn')) {
        const settingsBtn = document.createElement('div');
        settingsBtn.id = 'netflix-sub-settings-btn';
        settingsBtn.innerHTML = '⚙️';
        videoContainer.appendChild(settingsBtn);

        // Create Popup for Settings
        const langPopup = document.createElement('div');
        langPopup.id = 'lang-popup';
        langPopup.innerHTML = `
            <div class="popup-header">
                <span>🛠️ Setting </span>
            </div>
            <div class="popup-body">
            <div style="display: flex; align-items: center; margin-top: 10px;">
                <input type="checkbox" id="toggle-sub-visibility" checked style="margin-right: 8px;">
                <label for="toggle-sub-visibility" style="font-size: 12px; color: #ccc;">Display Subtitles</label>
            </div>
                <label for="lang-select">Language</label>
                <div class="select-wrapper">
                    <select id="lang-select">
                        <option value="" disabled>-- Select --</option>
                    </select>
                </div>
                <button id="apply-lang-btn">
                    <span>Apply</span>
                </button>
            </div>
        `;
        videoContainer.appendChild(langPopup);

        // Sự kiện đóng/mở popup
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = langPopup.style.display === 'none' || langPopup.style.display === '';
            if (isHidden) {
                openSubtitleUI();
            } else {
                closeSubtitleUI();
            }
        };

        // Đóng popup khi click ra ngoài
        const toggleBtn = document.getElementById('toggle-sub-visibility');
        toggleBtn.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.getElementById('lang-popup').style.display = 'none';
                handleApplySubtitle();
            } else {
                // console.log("Ẩn phụ đề");
                cleanSubTitle();
                document.getElementById('lang-popup').style.display = 'none';
            }
        });

        // Xử lý khi nhấn nút Áp dụng
        const applyBtn = langPopup.querySelector('#apply-lang-btn');
        const langSelect = langPopup.querySelector('#lang-select');

        applyBtn.onclick = () => {
            const selectedUrl = langSelect.value;
            if (selectedUrl) {
                fetchFullSubtitle(selectedUrl);
            }

            closeSubtitleUI();
        };
    }

    createSubtitleDisplay(videoContainer);
}

function createSubtitleDisplay(parent) {
    if (document.getElementById('subtitle-container')) { // Do note create if already exists
        return;
    } 

    const container = document.createElement('div');
    container.id = 'subtitle-container';
    container.innerText = "Phụ đề thứ 2 sẽ hiển thị ở đây...";
    parent.appendChild(container);

    // Khôi phục vị trí/kích thước cũ từ storage
    chrome.storage.local.get(['subConfig'], (res) => {
        if (res.subConfig) {
            container.style.top = res.subConfig.top;
            container.style.left = res.subConfig.left;
            container.style.width = res.subConfig.width;
            container.style.transform = 'none';
            // console.log("Đã khôi phục cấu hình phụ đề:", res.subConfig);
        }
    });

    makeElementDraggable(container);
}


function saveSubtitleConfig(elmnt) {
    const config = {
        top: elmnt.style.top,
        left: elmnt.style.left,
        width: elmnt.style.width,
    };
    // console.log("Lưu cấu hình phụ đề:", config);
    chrome.storage.local.set({ subConfig: config });
}

function makeElementDraggable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    elmnt.onmousedown = (e) => {
        // Không cho phép kéo nếu người dùng đang nhấn vào góc resize
        const rect = elmnt.getBoundingClientRect();
        if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) return;

        e = e || window.event;

        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = () => {
            document.onmouseup = null;
            document.onmousemove = null;
            saveSubtitleConfig(elmnt); // Lưu sau khi thả chuột
        };
        document.onmousemove = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            elmnt.style.transform = 'none'; // Xóa căn giữa mặc định khi bắt đầu kéo
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            elmnt.style.bottom = 'auto'; // Quan trọng: bỏ bottom để top có hiệu lực
        };
    };
}



// Lắng nghe danh sách ngôn ngữ từ Background gửi về
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_LANGUAGE_LIST") {
        const langSelect = document.getElementById('lang-select');
        if (!langSelect) return;
        console.log("Lang list received:", langSelect, msg.tracks);

        langSelect.innerHTML = '<option value="">-- Select Language --</option>'; 
        
        msg.tracks.forEach(track => {
            const option = document.createElement('option');
            option.value = track.url;
            option.innerText = track.label;
            langSelect.appendChild(option);
        });
    }
});

var mockSubtitles = [];
// Hàm cập nhật phụ đề
var movieID = null;
function updateSubtitles() {
    if (!document.getElementById('subtitle-container')) { // Fix bug exit movie and change to the another
        const watchVideoContainer = document.querySelector('.watch-video');
        if (!watchVideoContainer) return;
        createSubtitleDisplay(watchVideoContainer);
    };

    const subtitleElement = document.getElementById('subtitle-container');
    const videoContainer = document.querySelector('video');

    if (!videoContainer) return; // Wait for video element to load

    // Định vị phụ đề theo vị trí của video trên màn hình
    if (!subtitleElement.style.top && !subtitleElement.style.left) {
        const rect = videoContainer.getBoundingClientRect();
        subtitleElement.style.top = `${rect.top + rect.height * 0.8}px`;
        subtitleElement.style.left = `${rect.left + rect.width / 2}px`;
        subtitleElement.style.transform = "translateX(-50%)";
    }

    const currentTime = videoContainer.currentTime;
    const currentSub = mockSubtitles.find(s => currentTime >= s.begin && currentTime <= s.end);

    if (currentSub) {
        subtitleElement.innerText = currentSub.text;
        subtitleElement.style.display = 'block';
    } else {
        subtitleElement.style.display = 'none';
    }
}

const convertTicks = (ticksStr) => {
    const ticks = parseInt(ticksStr.replace('t', ''));
    const totalSeconds = ticks / 10000000;

    return totalSeconds;
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SUBTITLE_RAW_XML") {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(message.xml, "text/xml");
        
        // Lấy tất cả các thẻ <p> (đại diện cho các dòng phụ đề)
        const paragraphs = xmlDoc.getElementsByTagName("p");
        const rawSubtitles = [];
        const contentSrt = [];

        var count = 1;
        mockSubtitles = [];
        for (let p of paragraphs) {
            const begin = p.getAttribute("begin"); // Ví dụ: "462962499t"
            const end = p.getAttribute("end");
            const text = p.textContent; // Nội dung câu thoại
            const subTitle = {
                id: count,
                begin: convertTicks(begin),
                end: convertTicks(end),
                text: text
            }

            rawSubtitles.push(subTitle);

             // Tạo định dạng SRT
            const beginTime = convertTicks(begin);
            const endTime = convertTicks(end);
            const beginFormatted = new Date(beginTime * 1000).toISOString().substr(11, 12);
            const endFormatted = new Date(endTime * 1000).toISOString().substr(11, 12);

            contentSrt.push(`${count}\n${beginFormatted} --> ${endFormatted}\n${text}\n`);

            mockSubtitles.push(subTitle);

            count++;
        }

        updateCupturedSubTitles(message.meta_data);
        subtitleIntervalId = setInterval(updateSubtitles, 500);
    }
});

var currentMovieId = null;
const capturedSubtitles = [];
// SubData structure example: {language: "en", url: "https://..., movieId: "12345"}
const updateCupturedSubTitles = (subData) => {
    // console.log("Previous MovieID:", currentMovieId, "New MovieID:", subData);
    if (currentMovieId && currentMovieId !== subData.movieId) {
        // Reset subtitle If movieId changed
        capturedSubtitles.length = 0;
    }

    currentMovieId = subData.movieId;

    if (!currentMovieId || currentMovieId === "undefined") {
        console.log("It's Homepage:", currentMovieId);
        return;
    }


    capturedSubtitles.some(sub => sub.language === subData.language) || capturedSubtitles.push(subData);

    const langSelect = document.getElementById('lang-select');
    if (!langSelect) {
        initExtensionUI(); // Khởi tạo UI nếu chưa có
        console.log("Cannot find language selection element. UI has been re-initialized.");
    };

    // reset to default option
    if (langSelect) {
        langSelect.innerHTML = '<option value="" disabled>-- Select --</option>';

        capturedSubtitles.forEach(track => {
            const option = document.createElement('option');
            option.value = track.url;
            option.selected = (track.language === subData.language) ? true : false;
            option.textContent = track.label || track.language;
            langSelect.appendChild(option);
        });
    }
}

async function handleApplySubtitle() {
    const langSelect = document.getElementById('lang-select');
    const selectedUrl = langSelect.value;
    // console.log("Ngôn ngữ được chọn:", [langSelect.value, selectedUrl]);
    if (!selectedUrl) {
        document.getElementById('lang-popup').style.display = 'none';
        cleanSubTitle();
        return;
    };

    // console.log("⏳ Require Background fetch data...", selectedUrl);
    fetchFullSubtitle(selectedUrl);
}

const fetchFullSubtitle = async (url) => {
    try {
        chrome.runtime.sendMessage({
        type: "FETCH_SUBTITLE_RAW",
        url: url
    }, (response) => {
        if (response) {
            document.getElementById('lang-popup').style.display = 'none';
        } else {
            alert("Lỗi khi tải phụ đề: " + response.error);
        }
    });
    } catch (error) {
        console.error("Lỗi khi fetch phụ đề:", error);
    }
}