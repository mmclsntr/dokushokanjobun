window.addEventListener('load', () => {
    const bookTitle = "マッチ売りの少女"; // ここで本のタイトルを設定
    const textFileName = 'assets/matchurinoshojo.txt'; // ファイル名を変数で設定
    let bookBody = ""; // 本の本文を保持する変数

    // ファイルを読み込む
    fetch(textFileName)
        .then(response => response.text())
        .then(data => {
            bookBody = data;
            console.log(bookBody);
            document.getElementById('content').innerHTML = bookBody.replace(/\n/g, '<br>');
        })
        .catch(error => {
            document.getElementById('content').textContent = 'ファイルの読み込み中にエラーが発生しました。';
            console.error('Error:', error);
        });

    // 時間取得ボタンの処理
    const toggleButton = document.getElementById('toggleButton');
    const startTimeElement = document.getElementById('startTime');
    const endTimeElement = document.getElementById('endTime');
    const durationElement = document.getElementById('duration');
    const expressionsContainer = document.getElementById('expressions');
    const reviewContainer = document.getElementById('review');

    const captureIdInput = document.getElementById('captureId');

    let isReading = false;
    let startTime = null;

    const storedCaptureId = localStorage.getItem('captureId');
    if (storedCaptureId) {
        captureIdInput.value = storedCaptureId;
    }

    toggleButton.addEventListener('click', function() {
        const captureId = captureIdInput.value;
        const currentTime = new Date();

        if (!isReading) {
            localStorage.setItem('captureId', captureId);  // Save captureId to localStorage

            // 読書開始
            startTime = currentTime;
            startTimeElement.textContent = `開始時間: ${currentTime.toLocaleString()}`;
            endTimeElement.textContent = "終了時間: 未設定";
            durationElement.textContent = "読書時間: 未設定";
            expressionsContainer.innerHTML = ""; // 表情データをリセット
            reviewContainer.innerHTML = ""; // 感想文データをリセット
            reviewContainer.style.display = 'none'; // 感想文エリアを非表示
            localStorage.setItem('startTime', currentTime.toISOString()); // ローカルストレージに保存
            localStorage.removeItem('endTime'); // 終了時間をリセット
            toggleButton.textContent = '読書終了';
        } else {
            // 読書終了
            const endTime = currentTime;
            const duration = Math.round((endTime - new Date(localStorage.getItem('startTime'))) / 1000);
            endTimeElement.textContent = `終了時間: ${endTime.toLocaleString()}`;
            durationElement.textContent = `読書時間: ${duration} 秒`;
            localStorage.setItem('endTime', endTime.toISOString()); // ローカルストレージに保存
            toggleButton.textContent = '読書開始';

            // 表情データを取得して表示し、感想文を取得
            reviewContainer.innerHTML = "生成中..."; // 感想文エリアに「生成中」と表示
            reviewContainer.style.display = 'block'; // 感想文エリアを表示

            // 表情データを取得して表示し、感想文を取得
            let expressionData;
            let heartRateData;
            fetchExpressionData(startTime, endTime, duration, captureId)
                .then((data) => {
                    expressionData = data;
                    displayExpressionData(expressionData);

                    return fetchHeartRateData(startTime, endTime, captureId);
                })
                .then((data) => {
                    heartRateData = data;

                    // 感情文取得
                    return fetchReviewData(startTime, endTime, duration, expressionData, heartRateData, bookTitle, bookBody);
                })
                .then((data) => {
                    console.log("done")
                })
                .catch((error) => {
                    console.error(`Error fetching data:`, error);
                    reject(error)
                });
        }
        isReading = !isReading;
    });

    // 表情データを取得する関数
    function fetchExpressionData(startTime, endTime, duration, captureId) {
        const expressions = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
        const expressionData = {};
        let remainingRequests = expressions.length;

        return new Promise((resolve, reject) => {
            expressions.forEach(field => {
                fetch(`/api/capture/${captureId}/items/expressions?start=${startTime.toISOString()}&end=${endTime.toISOString()}&field=${field}&lower=0.02`)
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

    // 表情データを表示する関数
    function displayExpressionData(data) {
        expressionsContainer.innerHTML = ''; // 既存のデータをクリア
        const sortedData = Object.entries(data).sort((a, b) => b[1].count - a[1].count);

        sortedData.forEach(([field, { count, percentage }]) => {
            const p = document.createElement('p');
            p.textContent = `${field.charAt(0).toUpperCase() + field.slice(1)}: ${count} 回 (${(percentage * 100).toFixed(2)}%)`;
            expressionsContainer.appendChild(p);
        });
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
            displayReviewData(data);
        })
        .catch(error => {
            console.error('Error fetching review data:', error);
        });
    }

    // 感想文データを表示する関数
    function displayReviewData(data) {
        reviewContainer.innerHTML = `<h2>感情文</h2><p>${data.text.replace(/\n/g, '<br>')}</p>`;
    }
});

