const respuestas = {
    q1: "C", q2: "B", q3: "B", q4: "B", q5: "B",
    q6: "A", q7: "C", q8: "A", q9: "B", q10: "B"
};

// --- CONFIGURATION ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxS7PUwg2DuirLaRR_NESDZQabo9Cg12MIj3pi3CO4joUG0jKskrBv-DH45TUhlCAcghA/exec"; 

let userData = { cedula: "", email: "", name: "" };
let currentQuestion = 1;
const totalQuestions = 10;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateProgress();
    updateNavigation();
});

async function iniciarCuestionario() {
    const cedula = document.getElementById('cedula').value.trim();
    const email = document.getElementById('email').value.trim();
    const warning = document.getElementById('regWarning');
    const startBtn = document.querySelector('#registrationView button');

    if (!cedula || !email) {
        warning.innerText = "Por favor completa todos los campos para continuar.";
        warning.style.display = "block";
        return;
    }

    if (!email.includes('@')) {
        warning.innerText = "Por favor ingresa un correo electrónico válido.";
        warning.style.display = "block";
        return;
    }

    // --- Pre-validation with Google Sheets ---
    warning.innerText = "Validando identidad...";
    warning.style.display = "block";
    warning.style.color = "var(--accent-color)";
    startBtn.disabled = true;
    startBtn.innerText = "Validando...";

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // Standard for simple Apps Script redirects
            body: JSON.stringify({ action: "validate", cedula: cedula })
        });

        /**
         * IMPORTANT: 'no-cors' mode doesn't allow reading the response body.
         * To properly validate, the user would need to handle CORS in Apps Script 
         * or we use a small trick if they can't change the script.
         * However, for a real "Database Check", we need to receive a response.
         * I will assume we want a real check, so I'll suggest removing 'no-cors' 
         * if they follow the 'createResponse' header pattern.
         */
        
        // Re-trying with standard fetch to get result (requires Apps Script to handle CORS or JSONP)
        // Since I'm providing the script, I'll use standard fetch.
        
        const realResp = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "validate", cedula: cedula })
        });
        const result = await realResp.json();

        if (result.result === "success") {
            userData.cedula = cedula;
            userData.email = email;
            userData.name = result.name;
            
            // Set personalized greeting
            document.getElementById('welcomeGreeting').innerText = `¡Hola, ${result.name}!`;
            
            document.getElementById('registrationView').classList.remove('active');
            document.getElementById('quizView').classList.add('active');
            showQuestion(1);
        } else {
            warning.innerText = result.message || "No estás autorizado para realizar este cuestionario.";
            warning.style.color = "var(--error)";
            startBtn.disabled = false;
            startBtn.innerText = "Comenzar";
        }
    } catch (error) {
        console.error("Validation error:", error);
        // Fallback for demo or if fetch fails due to CORS but we want to allow entry
        // warning.innerText = "Error de conexión. Inténtalo de nuevo.";
        // For now, let's keep it strict.
        warning.innerText = "No se pudo validar la identidad. Verifica tu conexión.";
        warning.style.color = "var(--error)";
        startBtn.disabled = false;
        startBtn.innerText = "Comenzar";
    }
}

function showQuestion(num) {
    document.querySelectorAll('.pregunta-container').forEach(p => p.classList.remove('active'));
    document.getElementById(`p${num}`).classList.add('active');
    currentQuestion = num;
    updateNavigation();
    updateProgress();
}

function navigate(dir) {
    const next = currentQuestion + dir;
    if (next >= 1 && next <= totalQuestions) {
        showQuestion(next);
    } else if (next > totalQuestions) {
        evaluarRespuestas();
    }
}

function updateNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.style.visibility = currentQuestion === 1 ? 'hidden' : 'visible';
    nextBtn.innerText = currentQuestion === totalQuestions ? 'Finalizar' : 'Siguiente';
}

function updateProgress() {
    const answeredCount = document.querySelectorAll('input:checked').length;
    const progress = (answeredCount / totalQuestions) * 100;
    document.querySelector('.progress-bar').style.width = `${progress}%`;
}

function toggleHint(id) {
    const hint = document.getElementById(`hint${id}`);
    hint.classList.toggle('visible');
    const btn = hint.previousElementSibling;
    btn.innerText = hint.classList.contains('visible') ? 'Ocultar pista' : '¿Necesitas una pista?';
}

async function evaluarRespuestas() {
    const answered = document.querySelectorAll('input:checked');
    const warning = document.getElementById("quizWarning");

    if (answered.length < totalQuestions) {
        warning.innerText = `Has respondido ${answered.length} de 10. Por favor completa todas las preguntas.`;
        warning.style.display = "block";
        return;
    }

    warning.style.display = "none";
    let score = 0;
    const details = {};

    for (let i = 1; i <= totalQuestions; i++) {
        const selected = document.querySelector(`input[name="q${i}"]:checked`).value;
        const isCorrect = selected === respuestas[`q${i}`];
        if (isCorrect) score += 0.5;
        details[`q${i}`] = isCorrect ? "Correcta" : "Errónea";
    }

    // Show result UI immediately
    document.getElementById('quizView').classList.remove('active');
    const resDiv = document.getElementById('resultado');
    resDiv.querySelector('.score').innerText = `${score.toFixed(1)} / 5.0`;
    resDiv.classList.add('visible');
    document.getElementById('userNameDisplay').innerText = `Estudiante: ${userData.name} - ${userData.email} (${userData.cedula})`;

    // Send to Google Sheets
    document.getElementById('recordingStatus').innerText = "Guardando resultados y calculando estadísticas...";
    
    try {
        const payload = {
            timestamp: new Date().toISOString(),
            cedula: userData.cedula,
            email: userData.email,
            score: score.toFixed(1),
            ...details
        };

        // 1. Send results
        await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // 2. Get Average
        const avgResp = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getAverage" })
        });
        const avgResult = await avgResp.json();
        const average = avgResult.average || 0;

        // 3. Render Chart
        renderComparisonChart(score, parseFloat(average));

        document.getElementById('recordingStatus').innerText = "✅ Resultados registrados y estadísticas actualizadas.";
    } catch (error) {
        console.error("Error sending to Sheets:", error);
        document.getElementById('recordingStatus').innerText = "❌ Error al conectar con Google Sheets. Mostrando solo tu puntaje.";
        renderComparisonChart(score, 0); // Show only user score if fetch fails
    }
}

function renderComparisonChart(userScore, averageScore) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    // Destroy previous chart if it exists (for restarts)
    if (window.myChart) {
        window.myChart.destroy();
    }

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tu Resultado', 'Promedio del Grupo'],
            datasets: [{
                label: 'Calificación (0 - 5.0)',
                data: [userScore, averageScore],
                backgroundColor: [
                    'rgba(56, 189, 248, 0.6)', // Accent color (User)
                    'rgba(148, 163, 184, 0.3)'  // Secondary text color (Avg)
                ],
                borderColor: [
                    '#38bdf8',
                    '#94a3b8'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Nota: ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });
}

// Add event listener to update progress bar on selection
document.addEventListener('change', (e) => {
    if (e.target.type === 'radio') {
        updateProgress();
        // Visual feedback for selected option
        const name = e.target.name;
        document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
            input.parentElement.classList.remove('selected');
        });
        e.target.parentElement.classList.add('selected');
    }
});
