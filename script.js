let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let startTime;
let timerInterval;

const recordBtn = document.getElementById('recordBtn');
const transcriptArea = document.getElementById('transcriptArea');
const statusText = document.getElementById('statusText');
const visualizer = document.getElementById('visualizer');
const timerArea = document.getElementById('timerArea');

// --- 1. LOGIKA PEREKAMAN ---

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
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                // Kirim potongan audio ke Backend Vercel
                sendToVercel(event.data);
            }
        };

        // Potong audio setiap 5 detik (Continuous Mode)
        mediaRecorder.start(5000); 

        isRecording = true;
        updateUI(true);
        startTimer();
    } catch (err) {
        alert("Gagal akses mikrofon: " + err);
    }
}

function stopRecording() {
    mediaRecorder.stop();
    // Matikan stream
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    isRecording = false;
    updateUI(false);
    clearInterval(timerInterval);
    saveNoteToHistory(); // Simpan ke LocalStorage
}

// --- 2. KOMUNIKASI KE VERCEL ---

async function sendToVercel(audioBlob) {
    statusText.innerText = "Mengirim data ke AI...";
    
    const formData = new FormData();
    // Ubah blob jadi file agar Python bisa baca
    const file = new File([audioBlob], "recording.webm", { type: 'audio/webm' });
    formData.append("file", file);

    try {
        // Panggil API Vercel kita
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.text) {
            appendTranscript(data.text);
            statusText.innerText = "Merekam...";
        }
    } catch (error) {
        console.error("Error transkripsi:", error);
    }
}

// --- 3. UI HELPER ---

function appendTranscript(text) {
    if(!text) return;
    
    const p = document.createElement('p');
    p.className = "text-gray-300 leading-relaxed animate-pulse";
    p.innerText = text;
    
    // Hapus placeholder jika ada
    if(transcriptArea.querySelector('.italic')) {
        transcriptArea.innerHTML = '';
    }
    
    transcriptArea.appendChild(p);
    // Scroll ke bawah
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
    
    // Hapus animasi pulse setelah sebentar
    setTimeout(() => p.classList.remove('animate-pulse'), 1000);
}

function updateUI(recording) {
    const micIcon = document.getElementById('micIcon');
    if (recording) {
        recordBtn.classList.replace('bg-accent', 'bg-red-500');
        recordBtn.classList.replace('shadow-indigo-500/30', 'shadow-red-500/30');
        micIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" fill="white" />'; // Icon Stop
        timerArea.classList.remove('hidden');
        
        // Buat fake visualizer
        visualizer.innerHTML = '';
        for(let i=0; i<15; i++) {
            const bar = document.createElement('div');
            bar.className = 'wave-bar';
            bar.style.animationDelay = `${Math.random()}s`;
            visualizer.appendChild(bar);
        }
    } else {
        recordBtn.classList.replace('bg-red-500', 'bg-accent');
        recordBtn.classList.replace('shadow-red-500/30', 'shadow-indigo-500/30');
        micIcon.innerHTML = '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>'; // Icon Mic
        timerArea.classList.add('hidden');
        visualizer.innerHTML = '<span class="text-sm text-gray-500 ml-2">Transkripsi selesai.</span>';
    }
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const date = new Date(diff);
        document.getElementById('timer').innerText = date.toISOString().substr(14, 5);
    }, 1000);
}

// --- 4. HISTORY (LOCAL STORAGE) ---
function saveNoteToHistory() {
    const text = transcriptArea.innerText;
    if(text.length < 10) return;

    const note = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        text: text,
        title: "Catatan " + new Date().toLocaleTimeString()
    };

    let history = JSON.parse(localStorage.getItem('rifqynotes_history') || '[]');
    history.unshift(note);
    localStorage.setItem('rifqynotes_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const history = JSON.parse(localStorage.getItem('rifqynotes_history') || '[]');
    
    historyList.innerHTML = '';
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = "p-3 rounded-lg hover:bg-[#1f2229] cursor-pointer transition-colors mb-1 text-gray-300";
        div.innerHTML = `
            <div class="font-medium text-sm truncate">${item.title}</div>
            <div class="text-xs text-gray-500">${item.date}</div>
        `;
        div.onclick = () => {
            transcriptArea.innerText = item.text;
            document.getElementById('noteTitle').innerText = item.title;
        };
        historyList.appendChild(div);
    });
}

function clearHistory() {
    localStorage.removeItem('rifqynotes_history');
    renderHistory();
    transcriptArea.innerHTML = '<p class="text-gray-500 italic text-sm">Tekan tombol mikrofon untuk mulai berbicara...</p>';
}

// Init
renderHistory();
          
