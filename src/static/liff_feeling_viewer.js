getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

const feelingId = getQueryParam('feelingId');

// 感想文データを取得する関数
function fetchFeelingData(feelingId) {
    return fetch(`/api/feeling/${feelingId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('感情文データ:', data);
        displayFeelingData(data);
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
function displayFeelingData(data) {
    const content = document.getElementById('content');
    content.innerText = data.text;
    adjustFontSize(content);
}

window.addEventListener('load', () => {
    fetchFeelingData(feelingId)
});