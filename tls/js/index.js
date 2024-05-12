const express = require('express');
const app = express();
const path = require('path');

// 정적 파일을 제공하는 미들웨어 설정
app.use(express.static(path.join(__dirname, '../')));

// 루트 경로에 대한 요청을 처리
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// 서버를 모든 네트워크 인터페이스에서 수신하도록 설정하고, 3000 포트에서 시작
app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on http://localhost:3000 and accessible from other devices in the network');
});
