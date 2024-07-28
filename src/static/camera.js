const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const context = canvas.getContext('2d');
const expressionsDiv = document.getElementById('expressions');
const toggleButton = document.getElementById('toggleButton');
const resultsDiv = document.getElementById('results');
const captureIdInput = document.getElementById('captureId');

let isSendingData = false;
let startTime;
let endTime;
let totalDataPoints = 0;  // Track the number of data points sent

let currentStream;

window.addEventListener('load', () => {
    getCameras()

    const storedCaptureId = localStorage.getItem('captureId');
    if (storedCaptureId) {
        captureIdInput.value = storedCaptureId;
    }
});

toggleButton.addEventListener('click', () => {
    isSendingData = !isSendingData;
    toggleButton.textContent = isSendingData ? 'Stop Sending Data' : 'Start Sending Data';

    const captureId = captureIdInput.value;

    if (isSendingData) {
        localStorage.setItem('captureId', captureId);  // Save captureId to localStorage

        startTime = new Date().toISOString();
        totalDataPoints = 0;  // Reset the counter when starting
        console.log(`Data sending started at: ${startTime}`);
    } else {
        endTime = new Date().toISOString();
        console.log(`Data sending ended at: ${endTime}`);

        aggregateData(captureId);
    }
});

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('models'),
    faceapi.nets.faceExpressionNet.loadFromUri('models')
]).then(startVideo);

function startVideo() {
    if (currentStream) {
        // 既存のストリームを停止
        currentStream.getTracks().forEach(track => track.stop());
    }

    const cameraSelect = document.getElementById('cameraSelect');
    const selectedDeviceId = cameraSelect.value;

    navigator.mediaDevices.getUserMedia({ video: {deviceId: selectedDeviceId} })
        .then(stream => {
            video.srcObject = stream;
            currentStream = stream;
        })
        .catch(err => console.error('Error: ', err));
}

document.getElementById('cameraSelect').addEventListener('change', async (event) => {
    await startVideo();
});


async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const cameraSelect = document.getElementById('cameraSelect');

        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${cameraSelect.length + 1}`;
            cameraSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
}

video.addEventListener('play', () => {
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    setInterval(async () => {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (detection) {
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            faceapi.draw.drawDetections(canvas, resizedDetection);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);

            const expressions = resizedDetection.expressions;
            displayExpressions(expressions);

            if (isSendingData) {
                const captureId = captureIdInput.value;
                sendExpressions(expressions, captureId);
            }
        }
    }, 200); // Change interval to 200 milliseconds (0.2 seconds)
});

function displayExpressions(expressions) {
    expressionsDiv.innerHTML = `
        <p><strong>Neutral:</strong> ${expressions.neutral.toFixed(2)}</p>
        <p><strong>Happy:</strong> ${expressions.happy.toFixed(2)}</p>
        <p><strong>Sad:</strong> ${expressions.sad.toFixed(2)}</p>
        <p><strong>Angry:</strong> ${expressions.angry.toFixed(2)}</p>
        <p><strong>Fearful:</strong> ${expressions.fearful.toFixed(2)}</p>
        <p><strong>Disgusted:</strong> ${expressions.disgusted.toFixed(2)}</p>
        <p><strong>Surprised:</strong> ${expressions.surprised.toFixed(2)}</p>
    `;
}

function sendExpressions(expressions, captureId) {
    const timestamp = new Date().toISOString();
    const data = [
        { timestamp: timestamp, field: 'neutral', value: expressions.neutral },
        { timestamp: timestamp, field: 'happy', value: expressions.happy },
        { timestamp: timestamp, field: 'sad', value: expressions.sad },
        { timestamp: timestamp, field: 'angry', value: expressions.angry },
        { timestamp: timestamp, field: 'fearful', value: expressions.fearful },
        { timestamp: timestamp, field: 'disgusted', value: expressions.disgusted },
        { timestamp: timestamp, field: 'surprised', value: expressions.surprised }
    ];

    fetch(`/api/capture/${captureId}/items/expressions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        totalDataPoints++;  // Increment the counter for each successful send
    }).catch(error => {
        console.error('Error:', error);
    });
}

async function aggregateData(captureId) {
    const fields = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
    const lower = 0.02;
    const fieldCounts = {};

    resultsDiv.innerHTML = '<h2>Aggregated Results</h2>';

    for (const field of fields) {
        const url = `/api/capture/${captureId}/items/expressions?start=${startTime}&end=${endTime}&field=${field}&lower=${lower}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            const count = data ? data.length : 0;
            fieldCounts[field] = count;
        } catch (error) {
            console.error('Error fetching data:', error);
            fieldCounts[field] = 0;
        }
    }

    // Sort fields by count in descending order
    const sortedFields = Object.keys(fieldCounts).sort((a, b) => fieldCounts[b] - fieldCounts[a]);

    // Display results
    resultsDiv.innerHTML += `<p>Total Data Points: ${totalDataPoints}</p>`;
    sortedFields.forEach(field => {
        const count = fieldCounts[field];
        const percentage = totalDataPoints > 0 ? ((count / totalDataPoints) * 100).toFixed(2) : 0;
        resultsDiv.innerHTML += `<p>${field.charAt(0).toUpperCase() + field.slice(1)}: ${count} (${percentage}%)</p>`;
    });

    // Determine the most frequent expression or if it's neutral
    let mostFrequentExpression;
    if (totalDataPoints === 0 || (totalDataPoints / totalDataPoints) * 100 <= 1) {
        mostFrequentExpression = 'Neutral';
    } else {
        mostFrequentExpression = sortedFields[0].charAt(0).toUpperCase() + sortedFields[0].slice(1);
    }

    resultsDiv.innerHTML += `<p><strong>Most Frequent Expression: ${mostFrequentExpression}</strong></p>`;
}

