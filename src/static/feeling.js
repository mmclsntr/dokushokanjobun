getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

const name = getQueryParam('name') || 'default';
const captureId = getQueryParam('captureId') || 'default';
const startTime = new Date(getQueryParam('startTime'));
const endTime = new Date(getQueryParam('endTime'));

let feelingId = "none"

// 表情データを取得する関数
function fetchExpressionData(startTime, endTime, duration, captureId) {
    const expressions = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
    const expressionData = {};
    const lower = 0.005;
    let remainingRequests = expressions.length;

    return new Promise((resolve, reject) => {
        expressions.forEach(field => {
            fetch(`/api/capture/${captureId}/items/expressions?start=${startTime.toISOString()}&end=${endTime.toISOString()}&field=${field}&lower=${lower}`)
                .then(response => response.json())
                .then(data => {
                    const count = data ? data.length : 0;
                    console.log(`${field}: ${data}`)
                    const percentage = count / (duration * 10); // サンプリングレートが10であるため
                    expressionData[field] = { count, percentage };
                    remainingRequests--;

                    if (remainingRequests === 0) {
                        resolve(expressionData)
                    }
                })
                .catch(error => {
                    console.error(`Error fetching ${field} data:`, error);
                    expressionData[field] = { count: 0, percentage: 0.0 };
                    remainingRequests--;

                    if (remainingRequests === 0) {
                        resolve(expressionData)
                    }
                });
        });
    })
}

// 心拍センサ情報を取得する関数
function fetchHeartRateData(startTime, endTime, captureId) {
    const field = "heartrate"
    const heartRateData = {};

    return new Promise((resolve, reject) => {
        fetch(`/api/capture/${captureId}/items/sensor?start=${startTime.toISOString()}&end=${endTime.toISOString()}&field=${field}`)
            .then(response => response.json())
            .then(data => {
                const count = data ? data.length : 0;
                if (data) {
                    console.log(`${field}: ${data}`)
                    const values = data.map(item => item.value);
                    console.log(`heat rate: ${values}`)
                    resolve(values)
                } else {
                    console.log(`heat rate: none`)
                    resolve([])
                }
            })
            .catch(error => {
                console.error(`Error fetching data:`, error);
                reject(error)
            });
    })
}

// 感想文データを取得する関数
function fetchReviewData(startTime, endTime, duration, expressionData, heartRateData, bookTitle, bookBody) {
    const reviewData = {
        title: bookTitle,
        body: bookBody,
        readingDuration: duration,
        readingStartTime: startTime.toISOString(),
        readingEndTime: endTime.toISOString(),
        expressionCountSad: parseFloat(expressionData.sad.percentage),
        expressionCountHappy: parseFloat(expressionData.happy.percentage),
        expressionCountAngry: parseFloat(expressionData.angry.percentage),
        expressionCountFearful: parseFloat(expressionData.fearful.percentage),
        expressionCountDisgusted: parseFloat(expressionData.disgusted.percentage),
        expressionCountSurprised: parseFloat(expressionData.surprised.percentage),
        sensorHeartRates: heartRateData
    };

    return fetch(`/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(reviewData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('感情文データ:', data);

        feelingId = data.id;

        displayReviewData(data);
    })
    .catch(error => {
        console.error('Error fetching review data:', error);
    });
}

// フォントサイズを調整する関数
function adjustFontSize(element) {
    let fontSize = 2; // 初期フォントサイズ
    element.style.fontSize = `${fontSize}em`;

    // 要素の高さをチェックしてフォントサイズを調整
    while (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        fontSize -= 0.1;
        if (fontSize < 0.5) break; // 最小フォントサイズの制限
        element.style.fontSize = `${fontSize}em`;
    }
}

// 感想文データを表示する関数
function displayReviewData(data) {
    const content = document.getElementById('content');
    content.innerText = data.text;
    adjustFontSize(content);
}

document.getElementById('shareButton').addEventListener('click', () => {
    document.getElementById('qrcode').textContent = '';
    var qrcode = new QRCode('qrcode', {
      text:  feelingId,
      width: 300,
      height: 300,
      correctLevel : QRCode.CorrectLevel.H
    });  
    document.getElementById('popup-wrapper').style.display = "block";
});

document.getElementById('popup-wrapper').addEventListener('click', e => {
    const popupWrapper = document.getElementById('popup-wrapper');
    const close = document.getElementById('close');
    if (e.target.id === popupWrapper.id || e.target.id === close.id) {
        popupWrapper.style.display = 'none';
    }
});

document.getElementById('topButton').addEventListener('click', () => {
    window.location.href = `index.html?captureId=${captureId}`;
});

window.addEventListener('load', () => {
    const duration = Math.round((endTime - startTime) / 1000);

    const textFilePath = `assets/books/${name}/text.txt`;

    let bookTitle;
    let bookBody;

    let expressionData;
    let heartRateData;

    // 表情データを取得して表示し、感想文を取得
    fetch(textFilePath)
        .then(response => response.text())
        .then(text => {
            bookBody = text;
            bookTitle = text.slice(0, text.indexOf('\n'));

            // 表情データ取得
            return fetchExpressionData(startTime, endTime, duration, captureId)
        })
        .then((data) => {
            expressionData = data;

            // 心拍数データ取得
            return fetchHeartRateData(startTime, endTime, captureId);
        })
        .then((data) => {
            heartRateData = data;

            // 感情文取得
            return fetchReviewData(startTime, endTime, duration, expressionData, heartRateData, bookTitle, bookBody);
        })
        .then((data) => {
            console.log("done")

            // ローディングを非表示にする
            document.getElementById('loading').style.display = 'none';

            // top button activate
            document.getElementById('topButton').disabled = false;

            // テキストエリアをフェードインで表示
            document.getElementById('content').classList.add('fade-in-text');
        })
        .catch((error) => {
            console.error(`Error fetching data:`, error);
            reject(error)
        });

});
