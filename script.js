let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let audioContext;
let analyser;
let dataArray;
let source;
let animationId;

// --- DATABASE SETUP (IndexedDB) ---
const DB_NAME = "RifqyNotesDB";
const DB_VERSION = 1;
let db;

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains("recordings")) {
            db.createObjectStore("recordings", { keyPath: "id" });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        loadRecordings();
    };
    request.onerror = (e) => console.error("DB Error:", e);
}

// --- LOGIKA PEREKAMAN ---
const recordBtn = document.getElementById('recordBtn');
const timerDisplay = document.getElementById('timer');
const statusTitle = document.getElementById('statusTitle');
const micIcon = document.getElementById('micIcon');
const canvas = document.getElementById('visualizerCanvas');
const canvasCtx = canvas.getContext('2d');
const audioPlayer = document.getElementById('audioPlayer');

let isRecording = false;

recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Setup Visualizer
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        drawVisualizer();

        // Setup Recorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            saveRecording(audioBlob);
            
            // Matikan stream & visualizer
            stream.getTracks().forEach(track => track.stop());
            cancelAnimationFrame(animationId);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        };

        mediaRecorder.start();
        isRecording = true;
        updateUI(true);
        startTimer();

    } catch (err) {
        alert("Gagal akses mikrofon: " + err);
    }
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;
    updateUI(false);
    clearInterval(timerInterval);
}

// --- VISUALIZER ---
function drawVisualizer() {
    animationId = requestAnimationFrame(drawVisualizer);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = '#0f111500'; // Transparan clearing
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#3b82f6'; // Warna Acent (Blue)
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);

        x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
}

// --- TIMER & UI ---
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const date = new Date(diff);
        timerDisplay.innerText = date.toISOString().substr(14, 5);
    }, 1000);
}

function updateUI(recording) {
    if (recording) {
        recordBtn.className = "w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse";
        micIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" fill="white" />'; // Icon Stop
        statusTitle.innerText = "Merekam...";
        audioPlayer.classList.add('hidden');
    } else {
        recordBtn.className = "w-20 h-20 rounded-full bg-accent hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all hover:scale-105";
        micIcon.innerHTML = '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>';
        statusTitle.innerText = "Siap Merekam";
        timerDisplay.innerText = "00:00";
    }
}

// --- DATABASE OPERATIONS ---
function saveRecording(blob) {
    const transaction = db.transaction(["recordings"], "readwrite");
    const store = transaction.objectStore("recordings");
    
    const record = {
        id: Date.now(),
        audio: blob,
        date: new Date().toLocaleString()
    };

    store.add(record);
    transaction.oncomplete = () => loadRecordings();
}

function loadRecordings() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    const transaction = db.transaction(["recordings"], "readonly");
    const store = transaction.objectStore("recordings");
    const request = store.getAll();

    request.onsuccess = () => {
        const records = request.result.reverse(); // Terbaru di atas
        
        if (records.length === 0) {
            historyList.innerHTML = '<p class="text-xs text-gray-600 px-4 text-center mt-4">Belum ada rekaman.</p>';
            return;
        }

        records.forEach(item => {
            const div = document.createElement('div');
            div.className = "group flex items-center justify-between p-3 mx-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-gray-700";
            div.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="p-2 rounded-full bg-blue-500/10 text-blue-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-gray-200">Rekaman Suara</span>
                        <span class="text-xs text-gray-500">${item.date}</span>
                    </div>
                </div>
                <button onclick="deleteRecording(${item.id}, event)" class="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            `;
            
            // Play Audio saat klik item
            div.onclick = (e) => {
                if(e.target.closest('button')) return; // Jangan play kalau klik delete
                const url = URL.createObjectURL(item.audio);
                audioPlayer.src = url;
                audioPlayer.classList.remove('hidden');
                audioPlayer.play();
                statusTitle.innerText = "Memutar Rekaman...";
            };
            
            historyList.appendChild(div);
        });
    };
}

function deleteRecording(id, event) {
    event.stopPropagation();
    if(confirm("Hapus rekaman ini?")) {
        const transaction = db.transaction(["recordings"], "readwrite");
        const store = transaction.objectStore("recordings");
        store.delete(id);
        transaction.oncomplete = () => loadRecordings();
    }
}

function clearAllData() {
    if(confirm("Hapus SEMUA riwayat rekaman?")) {
        const transaction = db.transaction(["recordings"], "readwrite");
        const store = transaction.objectStore("recordings");
        store.clear();
        transaction.oncomplete = () => loadRecordings();
    }
}

// Jalankan Database
initDB();
lucide.createIcons();
