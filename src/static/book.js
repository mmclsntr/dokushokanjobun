let startTime;

const name = getQueryParam('name') || 'default';
const captureId = getQueryParam('captureId') || 'default';

// クエリパラメータからnameを取得する関数
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
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

// 画像の存在を確認する関数
function checkImageExists(url, callback) {
    const img = new Image();
    img.onload = () => callback(true);
    img.onerror = () => callback(false);
    img.src = url;
}

document.getElementById('startButton').addEventListener('click', () => {
    startTime = new Date().toISOString();

    console.log(startTime);

    const textFilePath = `assets/books/${name}/text.txt`;
    const pic1FilePath = `assets/books/${name}/pic1.png`;
    const pic2FilePath = `assets/books/${name}/pic2.png`;

    // テキストファイルを読み込んで表示する
    fetch(textFilePath)
        .then(response => response.text())
        .then(text => {
            const content = document.getElementById('content');
            content.innerHTML = '';
            for (let i = 0; i < text.length; i++) {
                if (text[i] === '\n') {
                    content.appendChild(document.createElement('br'));
                } else {
                    let span = document.createElement('span');
                    span.classList.add('fade-in-text');
                    span.style.animationDelay = `${i * 0.2}s`;
                    span.innerText = text[i];
                    content.appendChild(span);
                }
            }

            adjustFontSize(content);
        })
        .catch(error => {
            console.error('Error fetching the text file:', error);
        });

    // 画像のパスを設定し、存在する場合のみ表示
    checkImageExists(pic1FilePath, exists => {
        if (exists) {
            document.getElementById('image1').src = pic1FilePath;
            document.getElementById('image1').style.display = 'block';
        } else {
            document.getElementById('image1').style.display = 'none';
        }
    });

    checkImageExists(pic2FilePath, exists => {
        if (exists) {
            document.getElementById('image2').src = pic2FilePath;
            document.getElementById('image2').style.display = 'block';
        } else {
            document.getElementById('image2').style.display = 'none';
        }
    });
    // テキストエリアと画像を表示
    document.getElementById('imageContainer').style.display = 'flex';
    // 開始ボタンを非表示にする
    document.getElementById('startButton').style.display = 'none';
    // 終わるボタンを表示
    document.getElementById('endButton').style.display = 'block';

});

document.getElementById('endButton').addEventListener('click', () => {
    const endTime = new Date().toISOString();
    console.log(endTime);
    window.location.href = `feeling.html?captureId=${captureId}&name=${name}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
});
