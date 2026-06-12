document.addEventListener('DOMContentLoaded', () => {
    // App State
    let quizId = null;
    let questions = [];
    let answers = {};
    let activeIndex = 0;

    // DOM Elements
    const hubView = document.getElementById('hub-view');
    const hubQuizzesList = document.getElementById('hub-quizzes-list');
    const hubCreateBtn = document.getElementById('hub-create-btn');
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    
    const setupView = document.getElementById('setup-view');
    const executionView = document.getElementById('execution-view');
    const resultsView = document.getElementById('results-view');
    
    const setupSidebar = document.getElementById('setup-sidebar-content');
    const executionSidebar = document.getElementById('execution-sidebar-content');
    const resultsSidebar = document.getElementById('results-sidebar-content');
    
    const quizProgressContainer = document.getElementById('quiz-progress-container');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    
    const setupForm = document.getElementById('setup-form');
    const testTypeSelect = document.getElementById('test-type');
    const numQuestionsInput = document.getElementById('num-questions');
    
    // Range Slider Elements
    const formatSlider = document.getElementById('format-slider');
    const labelMcOnly = document.getElementById('label-mc-only');
    const labelOpenOnly = document.getElementById('label-open-only');
    const labelMixedStatus = document.getElementById('label-mixed-status');
    const formatRatioStatus = document.getElementById('format-ratio-status');
    const numOpenQuestionsInput = document.getElementById('num-open-questions');
    
    const questionGrid = document.getElementById('question-grid');
    const questionContent = document.getElementById('question-content');
    const prevBtn = document.getElementById('prev-question-btn');
    const nextBtn = document.getElementById('next-question-btn');
    const submitBtn = document.getElementById('submit-quiz-btn');
    
    const overallPercentage = document.getElementById('overall-percentage');
    const ringFill = document.getElementById('ring-fill');
    
    // Dynamic Course Display
    const activeCourseText = localStorage.getItem('nexus_active_course') || 'General';
    const syllabusCourseNameEl = document.getElementById('syllabus-course-name');
    if(syllabusCourseNameEl) {
        syllabusCourseNameEl.innerHTML = `<strong>Active Course:</strong> ${activeCourseText}`;
    }
    const mcStatBox = document.getElementById('mc-stat-box');
    const mcScoreVal = document.getElementById('mc-score-val');
    const oeStatBox = document.getElementById('oe-stat-box');
    const oeScoreVal = document.getElementById('oe-score-val');
    const analysisList = document.getElementById('analysis-list');
    
    const retakeBtn = document.getElementById('retake-btn');
    
    // Modal & Overlay
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalText = document.getElementById('confirm-modal-text');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // View Management
    function showView(viewId) {
        // Hide all views & sidebars
        if (hubView) {
            hubView.classList.add('hidden');
            hubView.classList.remove('active');
        }
        setupView.classList.add('hidden');
        setupView.classList.remove('active');
        executionView.classList.add('hidden');
        executionView.classList.remove('active');
        resultsView.classList.add('hidden');
        resultsView.classList.remove('active');
        
        setupSidebar.classList.add('hidden');
        executionSidebar.classList.add('hidden');
        resultsSidebar.classList.add('hidden');
        
        quizProgressContainer.style.display = 'none';

        // Show active view
        if (viewId === 'hub' && hubView) {
            hubView.classList.remove('hidden');
            hubView.classList.add('active');
        } else if (viewId === 'setup') {
            setupView.classList.remove('hidden');
            setupView.classList.add('active');
            setupSidebar.classList.remove('hidden');
        } else if (viewId === 'execution') {
            executionView.classList.remove('hidden');
            executionView.classList.add('active');
            executionSidebar.classList.remove('hidden');
            quizProgressContainer.style.display = 'flex';
        } else if (viewId === 'results') {
            resultsView.classList.remove('hidden');
            resultsView.classList.add('active');
            resultsSidebar.classList.remove('hidden');
        }
    }

    // Utility: Loading overlay
    function showLoading(text) {
        loadingText.textContent = text;
        loadingOverlay.classList.add('active');
    }

    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }

    // Initialize View
    async function initHub() {
        showView('hub');
        showLoading("Loading Quiz Hub...");
        try {
            const res = await fetch('/api/quizzes');
            if (res.ok) {
                const data = await res.json();
                renderHubQuizzes(data.quizzes || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            hideLoading();
        }
    }
    
    function renderHubQuizzes(quizzes) {
        if (!hubQuizzesList) return;
        hubQuizzesList.innerHTML = '';
        if (quizzes.length === 0) {
            hubQuizzesList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 2rem;">No challenges found. Create one to get started!</div>';
            return;
        }
        
        // Reverse so newest is first
        quizzes.slice().reverse().forEach((q, idx) => {
            const card = document.createElement('div');
            card.className = 'syllabus-card';
            card.style.background = 'var(--bg-surface)';
            card.style.border = '1px solid var(--border)';
            card.style.borderRadius = '6px';
            card.style.padding = '1.5rem';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            
            card.innerHTML = `
                <div>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">${q.title || 'Interactive Quiz'}</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">${q.question_count} Questions</p>
                </div>
            `;
            
            // Add a "Resume" or "Retake" button? For now just show them. 
            // In a real app we'd fetch the specific quiz ID
            const resumeBtn = document.createElement('button');
            resumeBtn.className = 'btn';
            resumeBtn.textContent = 'View Quiz';
            resumeBtn.style.padding = '0.5rem 1rem';
            resumeBtn.style.fontSize = '0.85rem';
            
            resumeBtn.addEventListener('click', () => {
                // To actually play the specific quiz, we'd need an endpoint to fetch the quiz details.
                // Since this is a hackathon, we can just say "Please generate a new quiz to take it."
                // OR we can make it so starting a new quiz sets it up.
                alert('In this hackathon version, taking a past quiz directly from the hub requires the /api/quiz/get endpoint which is not yet implemented. Please generate a New Challenge.');
            });
            
            card.appendChild(resumeBtn);
            hubQuizzesList.appendChild(card);
        });
    }

    if (hubCreateBtn) {
        hubCreateBtn.addEventListener('click', () => {
            showView('setup');
        });
    }
    
    if (backToHubBtn) {
        backToHubBtn.addEventListener('click', () => {
            showView('hub');
        });
    }

    // Initialize
    initHub();

    // Dynamic Range Slider Logic
    function updateSliderState(numQuestions, numOpen) {
        numQuestions = parseInt(numQuestions) || 5;
        numOpen = Math.min(Math.max(0, parseInt(numOpen)), numQuestions);
        
        if (formatSlider) {
            formatSlider.max = numQuestions;
            formatSlider.value = numOpen;
        }
        
        const numMc = numQuestions - numOpen;
        
        if (formatRatioStatus) {
            formatRatioStatus.textContent = `${numMc} Multiple Choice & ${numOpen} Open-Ended`;
        }
        
        if (numOpenQuestionsInput) {
            numOpenQuestionsInput.value = numOpen;
        }
        
        let typeCode = "mixed";
        if (numOpen === 0) {
            typeCode = "multiple_choice";
        } else if (numOpen === numQuestions) {
            typeCode = "open_ended";
        }
        if (testTypeSelect) {
            testTypeSelect.value = typeCode;
        }
        
        // Highlight labels dynamically
        if (labelMcOnly) {
            labelMcOnly.style.color = numOpen === 0 ? 'var(--text-main)' : 'var(--text-muted)';
            labelMcOnly.style.fontWeight = numOpen === 0 ? '600' : '500';
        }
        if (labelOpenOnly) {
            labelOpenOnly.style.color = numOpen === numQuestions ? 'var(--text-main)' : 'var(--text-muted)';
            labelOpenOnly.style.fontWeight = numOpen === numQuestions ? '600' : '500';
        }
        if (labelMixedStatus) {
            const isMixed = (numOpen > 0 && numOpen < numQuestions);
            labelMixedStatus.style.color = isMixed ? 'var(--text-main)' : 'var(--text-muted)';
            labelMixedStatus.style.fontWeight = isMixed ? '600' : '500';
        }
    }

    // Choice Button Click Listeners (Number of Questions)
    document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            numQuestionsInput.value = btn.dataset.value;
            
            // Recalculate slider bounds
            const numQuestions = parseInt(btn.dataset.value);
            const currentOpen = formatSlider ? parseInt(formatSlider.value) : 2;
            updateSliderState(numQuestions, currentOpen);
        });
    });

    if (formatSlider) {
        formatSlider.addEventListener('input', (e) => {
            const numQuestions = parseInt(numQuestionsInput.value);
            const numOpen = parseInt(e.target.value);
            updateSliderState(numQuestions, numOpen);
        });
    }

    // Label clicks to trigger slider state
    if (labelMcOnly) {
        labelMcOnly.addEventListener('click', () => {
            const numQuestions = parseInt(numQuestionsInput.value);
            updateSliderState(numQuestions, 0);
        });
    }
    if (labelOpenOnly) {
        labelOpenOnly.addEventListener('click', () => {
            const numQuestions = parseInt(numQuestionsInput.value);
            updateSliderState(numQuestions, numQuestions);
        });
    }

    // Initialize slider state
    updateSliderState(5, 2);

    // --- SETUP VIEW LOGIC ---
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const testType = testTypeSelect.value;
        const numQuestions = parseInt(numQuestionsInput.value);
        
        // Fetch session data
        const sessionId = localStorage.getItem('nexus_session_id') || 'default';
        const activeCourse = localStorage.getItem('nexus_active_course') || 'General';
        
        showLoading(`Generating ${activeCourse} Quiz...`);
        
        try {
            const res = await fetch('/api/quiz/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId
                },
                body: JSON.stringify({
                    test_type: testType,
                    num_questions: numQuestions,
                    num_open_questions: parseInt(numOpenQuestionsInput.value),
                    course: activeCourse
                })
            });
            
            if (!res.ok) {
                throw new Error("Failed to generate quiz questions.");
            }
            
            const data = await res.json();
            
            quizId = data.quiz_id;
            questions = data.questions;
            
            // Initialize answers
            answers = {};
            questions.forEach(q => {
                answers[q.id] = "";
            });
            
            activeIndex = 0;
            
            renderQuestionGrid();
            showQuestion(0);
            showView('execution');
            
        } catch (err) {
            alert(err.message || "An error occurred while setting up the quiz.");
        } finally {
            hideLoading();
        }
    });

    // --- QUIZ EXECUTION LOGIC ---
    function renderQuestionGrid() {
        questionGrid.innerHTML = '';
        questions.forEach((q, idx) => {
            const btn = document.createElement('button');
            btn.className = 'q-indicator';
            btn.textContent = idx + 1;
            btn.dataset.index = idx;
            
            // Highlight active & answered
            if (idx === activeIndex) btn.classList.add('active');
            if (answers[q.id] && answers[q.id].trim() !== "") btn.classList.add('answered');
            
            btn.addEventListener('click', () => {
                showQuestion(idx);
            });
            
            questionGrid.appendChild(btn);
        });
    }

    function updateQuestionGridStatus() {
        const indicators = questionGrid.querySelectorAll('.q-indicator');
        indicators.forEach((ind, idx) => {
            const q = questions[idx];
            ind.classList.remove('active', 'answered');
            
            if (idx === activeIndex) ind.classList.add('active');
            if (answers[q.id] && answers[q.id].trim() !== "") ind.classList.add('answered');
        });
    }

    function showQuestion(index) {
        activeIndex = index;
        const q = questions[index];
        
        // Progress UI
        const pct = ((index + 1) / questions.length) * 100;
        progressBarFill.style.width = `${pct}%`;
        progressText.textContent = `Question ${index + 1} of ${questions.length}`;
        
        // Render Question body
        questionContent.innerHTML = '';
        
        const qTitle = document.createElement('h2');
        qTitle.className = 'question-title';
        qTitle.textContent = `${index + 1}. ${q.question}`;
        questionContent.appendChild(qTitle);
        
        if (q.type === 'multiple_choice') {
            const list = document.createElement('div');
            list.className = 'options-list';
            
            Object.entries(q.options).forEach(([key, value]) => {
                const optCard = document.createElement('div');
                optCard.className = 'option-card';
                if (answers[q.id] === key) {
                    optCard.classList.add('selected');
                }
                
                optCard.innerHTML = `
                    <span class="option-marker">${key}</span>
                    <span class="option-text">${value}</span>
                `;
                
                optCard.addEventListener('click', () => {
                    answers[q.id] = key;
                    
                    // Update visuals
                    list.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
                    optCard.classList.add('selected');
                    
                    updateQuestionGridStatus();
                });
                
                list.appendChild(optCard);
            });
            
            questionContent.appendChild(list);
        } else if (q.type === 'open_ended') {
            const wrapper = document.createElement('div');
            wrapper.className = 'open-ended-wrapper';
            
            const textarea = document.createElement('textarea');
            textarea.className = 'open-ended-textarea';
            textarea.placeholder = 'Type your response here... Give details about quantum states, algorithms, or gates as applicable.';
            textarea.value = answers[q.id] || '';
            
            const wordCountSpan = document.createElement('span');
            wordCountSpan.className = 'word-count';
            
            function updateWords() {
                const words = textarea.value.trim().split(/\s+/).filter(w => w.length > 0).length;
                wordCountSpan.textContent = `${words} words`;
            }
            
            textarea.addEventListener('input', () => {
                answers[q.id] = textarea.value;
                updateWords();
                updateQuestionGridStatus();
            });
            
            wrapper.appendChild(textarea);
            wrapper.appendChild(wordCountSpan);
            questionContent.appendChild(wrapper);
            updateWords();
        }
        
        // Navigation controls state
        prevBtn.disabled = index === 0;
        nextBtn.textContent = index === questions.length - 1 ? 'Review & Submit' : 'Next \u2192';
        
        updateQuestionGridStatus();
    }

    prevBtn.addEventListener('click', () => {
        if (activeIndex > 0) showQuestion(activeIndex - 1);
    });

    nextBtn.addEventListener('click', () => {
        if (activeIndex < questions.length - 1) {
            showQuestion(activeIndex + 1);
        } else {
            promptSubmit();
        }
    });

    // --- SUBMISSION LOGIC ---
    submitBtn.addEventListener('click', promptSubmit);

    function promptSubmit() {
        const totalQ = questions.length;
        const answeredQ = Object.values(answers).filter(val => val && val.trim() !== "").length;
        const unanswered = totalQ - answeredQ;
        
        if (unanswered > 0) {
            confirmModalText.innerHTML = `You have <strong>${unanswered} unanswered question(s)</strong> out of ${totalQ}.<br>Are you sure you want to submit and end the quiz?`;
        } else {
            confirmModalText.innerHTML = `You have answered all questions.<br>Are you sure you want to submit and evaluate your responses?`;
        }
        
        confirmModal.classList.add('active');
    }

    modalCancelBtn.addEventListener('click', () => {
        confirmModal.classList.remove('active');
    });

    modalConfirmBtn.addEventListener('click', () => {
        confirmModal.classList.remove('active');
        submitQuizAnswers();
    });

    async function submitQuizAnswers() {
        showLoading("Evaluating responses and grading with AI...");
        
        try {
            const res = await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quiz_id: quizId,
                    answers: answers
                })
            });
            
            if (!res.ok) {
                throw new Error("Failed to submit and grade answers.");
            }
            
            const results = await res.json();
            renderResults(results);
            showView('results');
            
        } catch (err) {
            alert(err.message || "An error occurred during quiz evaluation.");
        } finally {
            hideLoading();
        }
    }

    // --- RESULTS LOGIC ---
    function renderResults(res) {
        // Render Circular Chart
        const pct = res.overall_score_pct;
        overallPercentage.textContent = `${pct}%`;
        
        // Calculate offset (ring radius = 45, perimeter = 282.7)
        const offset = 282.7 - (282.7 * pct) / 100;
        ringFill.style.strokeDashoffset = offset;

        // Render Feedback Summary Lists
        const strongPointsList = document.getElementById('strong-points-list');
        const weakPointsList = document.getElementById('weak-points-list');
        if (strongPointsList && weakPointsList && res.feedback_summary) {
            const fs = res.feedback_summary;
            
            // Strong Points
            strongPointsList.innerHTML = '';
            let strongs = [];
            if (Array.isArray(fs.strong_points)) {
                strongs = fs.strong_points;
            } else if (typeof fs.strong_points === 'string') {
                strongs = [fs.strong_points];
            }
            if (strongs.length === 0 || (strongs.length === 1 && !strongs[0])) {
                strongs = ["No specific strengths identified during this session."];
            }
            strongs.forEach(pt => {
                const li = document.createElement('li');
                li.textContent = pt;
                strongPointsList.appendChild(li);
            });
            
            // Weak Points
            weakPointsList.innerHTML = '';
            let weaknesses = [];
            if (Array.isArray(fs.weak_points)) {
                weaknesses = fs.weak_points;
            } else if (typeof fs.weak_points === 'string') {
                weaknesses = [fs.weak_points];
            }
            if (weaknesses.length === 0 || (weaknesses.length === 1 && !weaknesses[0])) {
                weaknesses = ["No major weaknesses identified during this session."];
            }
            weaknesses.forEach(pt => {
                const li = document.createElement('li');
                li.textContent = pt;
                weakPointsList.appendChild(li);
            });
        }
        
        // Render Multiple Choice statistics
        if (res.multiple_choice) {
            mcStatBox.style.display = 'flex';
            mcScoreVal.textContent = `${res.multiple_choice.correct} / ${res.multiple_choice.total} (${res.multiple_choice.score_pct}%)`;
        } else {
            mcStatBox.style.display = 'none';
        }
        
        // Render Open Ended statistics
        if (res.open_ended) {
            oeStatBox.style.display = 'flex';
            oeScoreVal.textContent = `${res.open_ended.score_pct}%`;
        } else {
            oeStatBox.style.display = 'none';
        }
        
        // Render Analysis List
        analysisList.innerHTML = '';
        res.questions_analysis.forEach((analysis, idx) => {
            const item = document.createElement('div');
            item.className = 'analysis-item';
            
            let badgeClass = 'graded';
            let badgeText = 'Graded';
            let feedbackBorderClass = '';
            
            if (analysis.type === 'multiple_choice') {
                badgeClass = analysis.is_correct ? 'correct' : 'incorrect';
                badgeText = analysis.is_correct ? 'Correct' : 'Incorrect';
                feedbackBorderClass = analysis.is_correct ? 'passing' : 'failing';
            } else if (analysis.type === 'open_ended') {
                badgeText = `Grade: ${analysis.grade_score}/100`;
                feedbackBorderClass = analysis.grade_score >= 70 ? 'passing' : 'failing';
            }
            
            item.innerHTML = `
                <div class="analysis-item-header">
                    <h4 class="analysis-q-text">${idx + 1}. ${analysis.question}</h4>
                    <span class="status-badge ${badgeClass}">${badgeText}</span>
                </div>
                
                <div class="analysis-answers">
                    <div class="ans-row student-ans">
                        <strong>Your Answer:</strong> 
                        <span>${escapeHtml(analysis.user_answer || '(No response)')}</span>
                    </div>
                    <div class="ans-row correct-ans">
                        <strong>${analysis.type === 'multiple_choice' ? 'Correct Key:' : 'Ideal Model Answer:'}</strong> 
                        <span>${escapeHtml(analysis.type === 'multiple_choice' ? analysis.correct_answer : analysis.correct_answer)}</span>
                    </div>
                </div>
                
                <div class="analysis-feedback ${feedbackBorderClass}">
                    ${analysis.feedback}
                </div>
            `;
            
            analysisList.appendChild(item);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // --- RETAKE LOGIC ---
    retakeBtn.addEventListener('click', () => {
        // Clear answers
        answers = {};
        questions.forEach(q => {
            answers[q.id] = "";
        });
        
        activeIndex = 0;
        
        renderQuestionGrid();
        showQuestion(0);
        showView('execution');
    });
});
