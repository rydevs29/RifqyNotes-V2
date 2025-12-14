// script.js - Core Logic & Recording Engine

// --- VARIABLES ---
let recognition;
let isRecording = false;
let shouldContinue = false; // Flag Anti-Mati
let globalTranscript = ""; // Penampung Teks UTAMA (Fixed Bug Terpisah)
let tempTranscript = ""; 

let seconds = 0;
let timerInterval;

// Elements Setup
const btnRecord = document.getElementById('btnRecord');
const btnText = document.getElementById('btnText');
const transcriptArea = document.getElementById('transcriptArea');
const transcriptText = document.getElementById('transcriptText');
const langSelect = document.getElementById('langSelect');
const timerDisplay = document.getElementById('timer');

// Init saat load
document.addEventListener('DOMContentLoaded', () => {
    renderNotes();
    updateProfileStats();
    initSpeech();
});

// --- NAVIGATION LOGIC ---
function switchPage(pageName) {
    ['home', 'notes', 'profile'].forEach(p => {
        document.getElementById('page-' + p).classList.add('hidden');
        document.getElementById('nav-' + p).classList.remove('active', 'text-blue-500');
        document.getElementById('nav-' + p).classList.add('text-slate-500');
    });
    document.getElementById('page-' + pageName).classList.remove('hidden');
    const activeNav = document.getElementById('nav-' + pageName);
    activeNav.classList.add('active', 'text-blue-500');
    activeNav.classList.remove('text-slate-500');
    if(pageName === 'notes') renderNotes();
}

// --- SPEECH ENGINE (THE FIX) ---
function initSpeech() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true; 
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            tempTranscript = ""; 
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    globalTranscript += event.results[i][0].transcript + " "; 
                } else {
                    tempTranscript += event.results[i][0].transcript;
                }
            }
            transcriptText.innerText = globalTranscript + tempTranscript;
            
            // Auto scroll
            const area = document.querySelector('#transcriptArea .custom-scroll');
            if(area) area.scrollTop = area.scrollHeight;
        };

        recognition.onend = () => {
            if (shouldContinue) {
                console.log("Auto-restart mic...");
                try { recognition.start(); } catch(e) {}
            } else {
                stopUI();
            }
        };
    } else {
        alert("Gunakan Browser Chrome/Edge agar fitur AI berjalan.");
    }
}

function handleRecordButton() {
    if (!isRecording) startRecordingLogic();
    else stopRecordingLogic();
}

function startRecordingLogic() {
    if(!recognition) initSpeech();
    recognition.lang = langSelect.value;
    shouldContinue = true;
    
    // Reset hanya jika mulai manual baru
    if(!isRecording) { globalTranscript = ""; tempTranscript = ""; }

    try { recognition.start(); startUI(); } 
    catch(e) { startUI(); }
}

function stopRecordingLogic() {
    shouldContinue = false;
    if(recognition) recognition.stop();
    
    // SAVE LOGIC
    const finalText = globalTranscript + tempTranscript;
    if (finalText.trim().length > 0) {
        saveNoteToStorage(finalText, langSelect.value);
    }
    stopUI();
}

function startUI() {
    isRecording = true;
    btnRecord.classList.remove('bg-blue-600');
    btnRecord.classList.add('bg-red-600', 'recording-pulse');
    
    // Cek mode aktif via class hidden
    const isOnline = !document.getElementById('content-online').classList.contains('hidden');
    if(!isOnline) document.getElementById('btnText').innerText = "Hentikan";

    transcriptArea.classList.remove('hidden');
    transcriptText.innerText = "Mendengarkan...";
    
    clearInterval(timerInterval);
    seconds = 0;
    timerDisplay.innerText = "00:00";
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopUI() {
    isRecording = false;
    btnRecord.classList.add('bg-blue-600');
    btnRecord.classList.remove('bg-red-600', 'recording-pulse');
    document.getElementById('btnText').innerText = "Mulai Mencatat";
    clearInterval(timerInterval);
}

// --- STORAGE SYSTEM ---
function getNotes() {
    const notes = localStorage.getItem('rifqy_notes_v3');
    return notes ? JSON.parse(notes) : [];
}

function saveNoteToStorage(text, lang) {
    const notes = getNotes();
    const newNote = {
        id: Date.now(),
        text: text.trim(),
        lang: lang,
        date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    notes.unshift(newNote);
    localStorage.setItem('rifqy_notes_v3', JSON.stringify(notes));
    
    // Visual Feedback
    const navNotes = document.getElementById('nav-notes');
    navNotes.classList.add('text-green-400', 'animate-bounce');
    setTimeout(() => navNotes.classList.remove('text-green-400', 'animate-bounce'), 1000);
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    const notes = getNotes();
    
    if (notes.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 mt-10"><i class="fa-solid fa-wind text-4xl mb-2"></i><p>Belum ada catatan.</p></div>`;
        return;
    }

    container.innerHTML = ''; 
    notes.forEach(note => {
        const html = `
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-blue-300 font-mono">${note.lang}</span>
                    <div class="text-[10px] text-slate-500 flex gap-2"><span>${note.date}</span><span>${note.time}</span></div>
                </div>
                <p class="text-slate-200 text-sm leading-relaxed select-text whitespace-pre-wrap">${note.text}</p>
                <div class="mt-3 flex justify-end gap-3 border-t border-slate-700/50 pt-2">
                    <button onclick="copyNote(this)" class="text-slate-400 hover:text-white text-xs"><i class="fa-regular fa-copy"></i> Salin</button>
                    <button onclick="deleteNote(${note.id})" class="text-red-400 hover:text-red-300 text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
    updateProfileStats();
}

function deleteNote(id) {
    if(!confirm("Hapus catatan ini?")) return;
    let notes = getNotes();
    notes = notes.filter(n => n.id !== id);
    localStorage.setItem('rifqy_notes_v3', JSON.stringify(notes));
    renderNotes();
}

function clearAllNotes() {
    if(confirm("Yakin hapus semua?")) {
        localStorage.removeItem('rifqy_notes_v3');
        renderNotes();
    }
}

function copyNote(btn) {
    const text = btn.parentElement.previousElementSibling.innerText;
    navigator.clipboard.writeText(text).then(() => alert("Disalin!"));
}

function updateProfileStats() {
    const notes = getNotes();
    document.getElementById('stat-count').innerText = notes.length;
}
