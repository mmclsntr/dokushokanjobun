const liffId = "2005785048-D8W6ZOQa"

getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

let feelingId = "none";
let userId = "none"

// ユーザーの登録
function fetchUserFeelingData(userId, feelingId) {
    return fetch(`/api/user/${userId}/feeling/${feelingId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
    })
    .then(response => {
        console.log('done register');
        doneRegistUserFeeling();
    })
    .catch(error => {
        console.error('Error fetching review data:', error);
    });
}

// 登録完了
function doneRegistUserFeeling() {
    document.getElementById('registerButton').disabled = true;
    document.getElementById('registerButton').textContent = "登録完了";
}


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
        if (fontSize < 0.2) break; // 最小フォントサイズの制限
        element.style.fontSize = `${fontSize}em`;
    }
}

// 感想文データを表示する関数
function displayFeelingData(data) {
    const content = document.getElementById('content');
    content.innerText = data.text;
    adjustFontSize(content);
}

document.getElementById('registerButton').addEventListener('click', () => {
    fetchUserFeelingData(userId, feelingId)
});

document.getElementById('scanButton').addEventListener('click', () => {
    liff
        .scanCodeV2()
        .then((result) => {
            feelingId = result.value;
            fetchFeelingData(feelingId)
            document.getElementById('scanButton').style.display = 'none';
            document.getElementById('registerButton').disabled = false;
        })
        .catch((error) => {
            console.log("error", error);
        });
});

window.addEventListener('load', () => {
    console.log(feelingId)
    liff.init({
        liffId: liffId, // Use own liffId
    })
        .then(() => {
            const idToken = liff.getDecodedIDToken();
            userId = idToken.sub;
        })
        .catch((err) => {
            console.log(err);
        });
});
