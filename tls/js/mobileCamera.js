const video = document.getElementById("video");
let landmarksCollection = [];
let landmarksBuffer = [];

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
]).then(startWebcam);

function startWebcam() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      runFaceDetection();
    })
    .catch(err => {
      console.error('An error occurred: ', err);
    });
}

function saveLandmarksToLocalStorage(featureVector) {
  localStorage.setItem('featureVector', JSON.stringify(featureVector));
}

function getLandmarksFromLocalStorage() {
  const storedVector = localStorage.getItem('featureVector');
  return storedVector ? JSON.parse(storedVector) : null;
}

function smoothLandmarks(newLandmarks) {
  if (landmarksBuffer.length >= 5) {
    landmarksBuffer.shift();
  }
  landmarksBuffer.push(newLandmarks);

  return landmarksBuffer[0].map((_, i) => {
    let sumX = 0, sumY = 0;
    landmarksBuffer.forEach(frame => {
      sumX += frame[i].x;
      sumY += frame[i].y;
    });
    return { x: sumX / landmarksBuffer.length, y: sumY / landmarksBuffer.length };
  });
}

function createFeatureVector(landmarks) {
  let featureVector = [];
  for (let i = 0; i < landmarks.length; i++) {
    for (let j = i + 1; j < landmarks.length; j++) {
      const distance = Math.sqrt(Math.pow(landmarks[i].x - landmarks[j].x, 2) + Math.pow(landmarks[i].y - landmarks[j].y, 2));
      featureVector.push(distance);
    }
  }
  return featureVector;
}

function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    normA += Math.pow(vec1[i], 2);
    normB += Math.pow(vec2[i], 2);
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function averageLandmarks(landmarksCollection) {
  const numFeatures = landmarksCollection[0].length;
  let averageVector = new Array(numFeatures).fill(0);
  for (let i = 0; i < landmarksCollection.length; i++) {
    for (let j = 0; j < numFeatures; j++) {
      averageVector[j] += landmarksCollection[i][j];
    }
  }
  return averageVector.map(value => value / landmarksCollection.length);
}

async function processDetections(displaySize, canvas) {
  const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
  const resizedDetections = faceapi.resizeResults(detections, displaySize);

  if (resizedDetections.length > 0) {
    const smoothedLandmarks = smoothLandmarks(resizedDetections[0].landmarks.positions);
    const featureVector = createFeatureVector(smoothedLandmarks);
    if (landmarksCollection.length < 10) {
      landmarksCollection.push(featureVector);
    } else {
      landmarksCollection.shift();
      landmarksCollection.push(featureVector);
    }

    if (landmarksCollection.length === 10) {
      const averageVector = averageLandmarks(landmarksCollection);
      saveLandmarksToLocalStorage(averageVector);
    }

    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections[0]);
  }
}

function checkSamePerson() {
  const storedVector = getLandmarksFromLocalStorage();
  if (storedVector && landmarksCollection.length === 10) {
    const averageVector = averageLandmarks(landmarksCollection);
    const similarity = cosineSimilarity(storedVector, averageVector);
    // Adjust the threshold as needed
    if (similarity > 0.99) {
      console.log('Recognized the same person!');
    } else {
      console.log('Different person detected.');
    }
  }
}

function runFaceDetection() {
  let canvas;
  const displaySize = { width: video.width, height: video.height };

  video.addEventListener('play', () => {
    canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);
    faceapi.matchDimensions(canvas, displaySize);

    async function detect() {
      if (video.paused || video.ended) {
        return;
      }
      await processDetections(displaySize, canvas);
      requestAnimationFrame(detect);
    }

    detect();
  });

  setInterval(checkSamePerson, 5000); // Check every 20 seconds
}
