/* ==========================================================================
   자바스크립트 로직 (script.js)
   - Web Speech API 음성 인식
   - 글자 수 카운팅
   - AI 감정 분석 시뮬레이션 및 결과 출력
   - Firebase Cloud Firestore 연동 (일기 저장, 불러오기, 삭제)
   ========================================================================== */

// Firebase SDK 모듈 불러오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 사용자 요청 Firebase 설정 정보
const firebaseConfig = {
    apiKey: "AIzaSyARCi1Dr2ybWaCQEOTC3qOWJDybeKlhJeA",
    authDomain: "diary-77166.firebaseapp.com",
    projectId: "diary-77166",
    storageBucket: "diary-77166.firebasestorage.app",
    messagingSenderId: "461749830614",
    appId: "1:461749830614:web:62e3191ce03fd65d881a77"
};

// Firebase 및 Firestore 초기화 (에러 방지 안전 처리)
let db = null;
let diariesCollection = null;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    diariesCollection = collection(db, "diaries");
} catch (e) {
    console.warn("Firebase 초기화 중 경고 발생 (로컬 모드로 동작합니다):", e);
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 참조
    const diaryInput = document.getElementById('diary-input');
    const charCount = document.getElementById('char-count');
    const newDiaryBtn = document.getElementById('new-diary-btn');
    const sttBtn = document.getElementById('stt-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const aiResponseBox = document.getElementById('ai-response-box');
    const loadingSpinner = document.getElementById('loading-spinner');
    const responseContent = document.getElementById('response-content');
    const saveBtn = document.getElementById('save-btn');
    const savedDiaryList = document.getElementById('saved-diary-list');
    const clearAllBtn = document.getElementById('clear-all-btn');

    let recognition = null;
    let isRecording = false;

    // 0. 새 일기 쓰기 (초기화) 버튼 기능
    newDiaryBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        }

        diaryInput.value = '';
        charCount.textContent = '0';

        aiResponseBox.classList.add('empty');
        loadingSpinner.classList.add('hidden');
        responseContent.innerHTML = '<p class="default-text">여기에 AI의 답변이 표시됩니다.</p>';

        diaryInput.focus();
    });

    // 1. 실시간 글자 수 카운트 및 키보드 단축키(Enter) 이벤트
    diaryInput.addEventListener('input', () => {
        charCount.textContent = diaryInput.value.length;
    });

    // 키보드 단축키 이벤트 (Enter: 분석 / `: 저장 / Escape: 초기화)
    diaryInput.addEventListener('keydown', (e) => {
        // Enter 키 누르면 분석 요청 (Shift + Enter는 줄바꿈)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeBtn.click();
        }
        // 백틱(`) 키 누르면 일기 저장
        else if (e.key === '`') {
            e.preventDefault();
            saveBtn.click();
        }
        // ESC(Escape) 키 누르면 새 일기 쓰기 (초기화)
        else if (e.key === 'Escape') {
            e.preventDefault();
            newDiaryBtn.click();
        }
    });

    // 2. Web Speech API 음성 인식 설정
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ko-KR';

        recognition.onstart = () => {
            isRecording = true;
            sttBtn.classList.add('recording');
            sttBtn.querySelector('.btn-text').textContent = '음성 인식 중... (클릭 시 종료)';
        };

        recognition.onresult = (event) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                currentTranscript += event.results[i][0].transcript;
            }
            
            if (event.results[0].isFinal) {
                diaryInput.value += (diaryInput.value ? ' ' : '') + currentTranscript;
            }
            
            charCount.textContent = diaryInput.value.length;
        };

        recognition.onend = () => {
            isRecording = false;
            sttBtn.classList.remove('recording');
            sttBtn.querySelector('.btn-text').textContent = '음성 입력';
        };

        recognition.onerror = (event) => {
            console.error('음성 인식 오류:', event.error);
            stopRecording();
            alert('음성 인식을 시작할 수 없습니다. 마이크 권한을 확인해 주세요.');
        };
    } else {
        sttBtn.addEventListener('click', () => {
            alert('현재 브라우저에서는 음성 인식(Web Speech API)을 지원하지 않습니다. Chrome 브라우저를 이용해 주세요.');
        });
    }

    function toggleRecording() {
        if (!recognition) return;
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    function startRecording() {
        try {
            recognition.start();
        } catch (e) {
            console.error('녹음 시작 실패:', e);
        }
    }

    function stopRecording() {
        try {
            recognition.stop();
        } catch (e) {
            console.error('녹음 정지 실패:', e);
        }
    }

    if (SpeechRecognition) {
        sttBtn.addEventListener('click', toggleRecording);
    }

    // 3. AI 감정 분석 시뮬레이션 로직
    const emotionDatabase = [
        {
            type: 'anger',
            emoji: '😡 분노',
            keywords: [
                '화', '화나', '화난', '화났', '화나서', '화가', '짜증', '답답', '억울', '분노', '열받', '열받아', 
                '미워', '미워서', '싸움', '마찰', '빡치', '싫어', '싫다', '최악', '망했', '부당', '어이없',
                '나쁘다', '나쁜', '나빠', '나빴'
            ],
            messages: [
                "답답하고 마음에 화가 가득 찬 하루였을 수 있어요.",
                "속상했던 감정들을 이곳에 털어놓아 주셔서 고마워요. 천천히 심호흡을 하면서 마음의 열기를 고요히 식혀보아요 🍃"
            ]
        },
        {
            type: 'joy',
            emoji: '😃 기쁨',
            keywords: [
                '기', 'ㅃ', '기쁨', '기뻐', '기쁘', '즐겁', '행복', '좋았', '좋아', '좋은', '웃음', '신나', '성공', '설렘', 
                '감사', '뿌듯', '최고', '만족', '희망', '합격', '멋진', '재미', '달콤', '축하', '선물'
            ],
            messages: [
                "오늘 하루 정말 기분 좋은 순간들이 가득했네요!",
                "당신의 밝은 에너지가 주변까지 따뜻하게 물들이는 듯해요. 오늘 느낀 기쁨을 마음에 소중히 담아두세요 ✨"
            ]
        },
        {
            type: 'sadness',
            emoji: '😢 슬픔',
            keywords: [
                '슬프', '슬픔', '눈물', '우울', '힘들', '아프', '속상', '지침', '포기', '외롭', '서럽', 
                '실망', '좌절', '후회', '불안', '걱정', '막막', '울었', '괴롭', '상처', '나쁘', '안좋'
            ],
            messages: [
                "오늘 많이 마음이 아프고 지치는 하루였군요.",
                "모든 짐을 혼자 짊어지려 하지 마세요. 잠시 내려놓고 따뜻한 차 한 잔과 함께 깊은 휴식을 취하길 바랄게요. 당신은 충분히 잘하고 있어요 ☕"
            ]
        },
        {
            type: 'tiredness',
            emoji: '😴 피곤',
            keywords: [
                '피곤', '졸리', '지쳤', '쉬고', '자고', '체력', '번아웃', '야근', '졸려', '지친', '기절', '녹초'
            ],
            messages: [
                "몸도 마음도 고단한 하루를 보내셨네요.",
                "오늘 하루도 정말 고생 많으셨어요. 이제 나 자신만을 위한 조용한 시간을 갖고 깊은 잠에 들기를 바랄게요 🌙"
            ]
        },
        {
            type: 'calm',
            emoji: '🌿 평온',
            keywords: [
                '조용', '평화', '평온', '무난', '차분', '산책', '휴식', '여유', '보통', '무탈', '그냥', '평범', '느긋'
            ],
            messages: [
                "잔잔하고 온화한 하루를 보내셨군요.",
                "특별한 일 없이 평온한 하루를 보낼 수 있는 것도 소중한 축복이에요. 오늘 밤도 조용하고 포근하게 마무리하세요 ☕"
            ]
        }
    ];

    const defaultEmotion = {
        emoji: '✨ 온기',
        messages: [
            "오늘의 소중한 하루 이야기를 들려주셔서 감사해요.",
            "어떤 하루였든 간에 당신의 생각과 감정은 그 자체로 의미가 있어요. 오늘 밤은 스스로를 따뜻하게 안아주는 시간이 되기를 바라요 🌸"
        ]
    };

    function analyzeEmotion(text) {
        if (!text.trim()) return null;

        const cleanText = text.replace(/\s+/g, '');
        
        // 부정 표현(나쁘다, 나쁨, 안좋, 별로, 짜증, 힘듦 등) 감지
        const negativeKeywords = ['나쁘', '나쁜', '나빠', '나빴', '안좋', '별로', '못하', '망했'];
        const hasNegative = negativeKeywords.some(kw => text.includes(kw) || cleanText.includes(kw));

        let maxScore = -1;
        let selectedEmotion = null;

        for (const item of emotionDatabase) {
            let score = 0;

            // 부정 표현이 있는데 기쁨(joy) 카테고리인 경우 점수를 부여하지 않음 (오분류 방지)
            if (hasNegative && item.type === 'joy') {
                continue;
            }

            for (const keyword of item.keywords) {
                if (text.includes(keyword) || cleanText.includes(keyword)) {
                    score += 2;
                }
            }

            if (score > maxScore) {
                maxScore = score;
                selectedEmotion = item;
            }
        }

        return (maxScore > 0 && selectedEmotion) ? selectedEmotion : defaultEmotion;
    }

// 사용자 요청 Gemini API 키 (Google AI Studio)
const GEMINI_API_KEY = "AQ.Ab8RN6KUuAS6-miI6G31i2l-YuiUfjub01bagOoBVKzl3d5Lpg";

    // Gemini 1.5 Flash API를 활용한 실시간 AI 감정 분석 함수
    async function analyzeWithGemini(text) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const prompt = `
사용자가 작성한 일기 내용을 읽고, 대표 감정을 분석한 후 따뜻한 위로와 응원의 메시지를 작성해 주세요.

[일기 내용]:
"${text}"

[응답 규칙]:
반드시 아래 JSON 형식으로만 답변해 주세요. 다른 설명이나 마크다운 없이 오직 JSON만 반환하세요:
{
  "emoji": "대표 감정 이모지와 감정명 (예: 😃 기쁨, 😢 슬픔, 😡 분노, 😴 피곤, 🌿 평온 중 선택)",
  "message1": "첫 번째 응원 및 공감 메시지 (1줄)",
  "message2": "두 번째 위로 및 격려 메시지 (1줄)"
}
`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                throw new Error(`API 오류: ${response.status}`);
            }

            const data = await response.json();
            const responseText = data.candidates[0].content.parts[0].text.trim();
            
            // JSON 파싱 (마크다운 가드 제거)
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            return {
                emoji: parsed.emoji,
                messages: [parsed.message1, parsed.message2]
            };
        } catch (error) {
            console.warn("Gemini API 호출 실패 (키워드 룰베이스 분석으로 폴백):", error);
            return analyzeEmotion(text); // API 호출 실패 시 로컬 룰베이스로 안전하게 대체
        }
    }

    // 분석 요청 버튼 클릭 이벤트
    analyzeBtn.addEventListener('click', async () => {
        const text = diaryInput.value.trim();

        if (!text) {
            alert('오늘의 하루 일기 내용을 작성해 주세요!');
            diaryInput.focus();
            return;
        }

        if (isRecording) {
            stopRecording();
        }

        aiResponseBox.classList.remove('empty');
        responseContent.innerHTML = '';
        loadingSpinner.classList.remove('hidden');

        // Gemini AI 감정 분석 실행
        const result = await analyzeWithGemini(text);

        loadingSpinner.classList.add('hidden');

        responseContent.innerHTML = `
            <div class="result-container">
                <div class="emotion-badge">${result.emoji}</div>
                <div class="ai-message">
                    <p>${result.messages[0]}</p>
                    <p>${result.messages[1]}</p>
                </div>
            </div>
        `;
    });

    // 4. Firestore 및 로컬 저장소 연동 일기 목록 불러오기 (Read)
    async function loadSavedDiaries() {
        savedDiaryList.innerHTML = '<p class="no-saved-text">일기를 불러오는 중입니다...</p>';

        let querySnapshot = null;

        if (diariesCollection) {
            try {
                // 1.5초 타임아웃 처리로 파이어베이스 응답이 지연되어도 먹통이 되지 않도록 보장
                const fetchPromise = getDocs(query(diariesCollection, orderBy("timestamp", "desc"))).catch(() => getDocs(diariesCollection));
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));

                querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);
            } catch (err) {
                console.warn("Firestore 불러오기 거부/실패:", err);
            }
        }

        // Firestore 결과가 없거나 타임아웃된 경우 로컬스토리지 데이터 즉시 표시
        if (!querySnapshot || querySnapshot.empty) {
            const localDiaries = JSON.parse(localStorage.getItem('savedDiaries') || '[]');
            if (localDiaries.length === 0) {
                savedDiaryList.innerHTML = '<p class="no-saved-text">아직 저장된 일기가 없습니다.</p>';
                return;
            }

            savedDiaryList.innerHTML = '';
            localDiaries.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'saved-card';
                card.innerHTML = `
                    <div class="saved-card-header">
                        <span class="saved-card-date">${item.date}</span>
                        <span class="saved-card-badge">${item.emotion || '✨ 일기'}</span>
                    </div>
                    <div class="saved-card-content">${escapeHtml(item.content)}</div>
                    <div class="saved-card-actions">
                        <button class="btn-delete" data-id="${item.id}" data-type="local">삭제</button>
                    </div>
                `;
                savedDiaryList.appendChild(card);
            });
            bindDeleteEvents();
            return;
        }

        savedDiaryList.innerHTML = '';
        querySnapshot.forEach((docSnapshot) => {
            const item = docSnapshot.data();
            const docId = docSnapshot.id;

            const card = document.createElement('div');
            card.className = 'saved-card';
            card.innerHTML = `
                <div class="saved-card-header">
                    <span class="saved-card-date">${item.date}</span>
                    <span class="saved-card-badge">${item.emotion || '✨ 일기'}</span>
                </div>
                <div class="saved-card-content">${escapeHtml(item.content)}</div>
                <div class="saved-card-actions">
                    <button class="btn-delete" data-id="${docId}" data-type="firestore">삭제</button>
                </div>
            `;
            savedDiaryList.appendChild(card);
        });

        bindDeleteEvents();
    }

    function bindDeleteEvents() {
        document.querySelectorAll('.btn-delete').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const type = e.target.getAttribute('data-type');
                if (type === 'firestore') {
                    deleteDiary(id);
                } else {
                    deleteLocalDiary(Number(id));
                }
            });
        });
    }

    // HTML 특수문자 이스케이프 (보안 처리)
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 5. 일기 저장 기능 (Firestore 저장 + 로컬 백업)
    saveBtn.addEventListener('click', async () => {
        const text = diaryInput.value.trim();

        if (!text) {
            alert('저장할 일기 내용을 입력해 주세요!');
            diaryInput.focus();
            return;
        }

        const emotionBadge = document.querySelector('.emotion-badge');
        let emotion = emotionBadge ? emotionBadge.textContent : null;

        if (!emotion) {
            const result = await analyzeWithGemini(text);
            emotion = result ? result.emoji : '✨ 온기';
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newEntry = {
            id: Date.now(),
            content: text,
            emotion: emotion,
            date: dateStr,
            timestamp: Date.now()
        };

        // 로컬스토리지에 무조건 백업 저장
        const localDiaries = JSON.parse(localStorage.getItem('savedDiaries') || '[]');
        localDiaries.unshift(newEntry);
        localStorage.setItem('savedDiaries', JSON.stringify(localDiaries));

        saveBtn.disabled = true;
        saveBtn.querySelector('.btn-text').textContent = '저장 중...';

        // Firestore에 비동기 저장 시도 (3초 타임아웃)
        let isFirestoreSaved = false;
        if (diariesCollection) {
            try {
                const savePromise = addDoc(diariesCollection, newEntry);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
                
                await Promise.race([savePromise, timeoutPromise]);
                isFirestoreSaved = true;
            } catch (error) {
                console.warn("Firestore 저장 실패/타임아웃 (로컬 저장소로 안전 대체됨):", error);
            }
        }

        saveBtn.disabled = false;
        saveBtn.querySelector('.btn-text').textContent = '일기 저장';

        if (isFirestoreSaved) {
            alert('일기가 Firebase Cloud Firestore 및 보관함에 성공적으로 저장되었습니다! 💾');
        } else {
            alert('일기가 보관함(로컬)에 안전하게 저장되었습니다! 💾');
        }

        loadSavedDiaries();
    });

    // 6. Firestore 및 로컬스토리지 문서 삭제 기능 (Delete)
    async function deleteDiary(docId) {
        if (!confirm('이 일기를 정말 삭제하시겠습니까?')) return;

        try {
            // Firestore 특정 문서 삭제
            await deleteDoc(doc(db, "diaries", docId));
            alert("일기가 삭제되었습니다.");
            loadSavedDiaries();
        } catch (error) {
            console.error("Firestore 문서 삭제 실패:", error);
            alert("일기 삭제 실패: " + error.message);
        }
    }

    function deleteLocalDiary(id) {
        if (!confirm('이 일기를 정말 삭제하시겠습니까?')) return;

        let diaries = JSON.parse(localStorage.getItem('savedDiaries') || '[]');
        diaries = diaries.filter((item) => item.id !== id);
        localStorage.setItem('savedDiaries', JSON.stringify(diaries));

        loadSavedDiaries();
    }

    // 7. 보관함 비우기 (저장된 일기 전체 초기화)
    clearAllBtn.addEventListener('click', async () => {
        if (!confirm('보관함에 저장된 모든 일기를 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.')) return;

        // 1) 로컬스토리지 초기화
        localStorage.removeItem('savedDiaries');

        // 2) Firestore 전체 문서 삭제 시도
        if (diariesCollection) {
            try {
                const querySnapshot = await getDocs(diariesCollection);
                const deletePromises = [];
                querySnapshot.forEach((docSnapshot) => {
                    deletePromises.push(deleteDoc(doc(db, "diaries", docSnapshot.id)));
                });
                await Promise.all(deletePromises);
            } catch (error) {
                console.warn("Firestore 전체 삭제 중 일부 실패 (로컬 보관함은 비워짐):", error);
            }
        }

        alert('보관함이 깨끗이 비워졌습니다!');
        loadSavedDiaries();
    });

    // 초기 진입 시 Firestore에서 일기 목록 불러오기
    loadSavedDiaries();
});
