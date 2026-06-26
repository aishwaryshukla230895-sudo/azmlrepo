document.addEventListener("DOMContentLoaded", () => {
    const vitalsForm = document.getElementById("vitals-form");
    const loadSampleBtn = document.getElementById("load-sample-btn");
    const toggleKeyBtn = document.getElementById("toggle-key-btn");
    const apiKeyInput = document.getElementById("api-key-input");

    // UI State Panels
    const idleVisual = document.getElementById("idle-visual");
    const loadingVisual = document.getElementById("loading-visual");
    const outcomeVisual = document.getElementById("outcome-visual");
    const errorBanner = document.getElementById("error-banner");

    // Outcome Elements
    const resultBadge = document.getElementById("result-badge");
    const badgeIcon = document.getElementById("badge-icon");
    const outcomeTitle = document.getElementById("outcome-title");
    const outcomeSubtitle = document.getElementById("outcome-subtitle");
    const clinicalExplainer = document.getElementById("clinical-explainer");
    const latencyVal = document.getElementById("latency-val");
    const diagTime = document.getElementById("diag-time");

    // Sliders & Value Display Map
    const sliders = [
        "pregnancies", "glucose", "bp", "skin", "insulin", "bmi", "pedigree", "age"
    ];

    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const badge = document.getElementById(`${id}-val`);
        slider.addEventListener("input", () => {
            badge.textContent = slider.value;
            // Visual dynamic color highlights for glucose & bmi
            if (id === "glucose") {
                badge.className = slider.value > 140 ? "val-badge highlight-blue text-red" : "val-badge highlight-blue";
            }
        });
    });

    // Show/Hide Password Key
    toggleKeyBtn.addEventListener("click", () => {
        const type = apiKeyInput.getAttribute("type") === "password" ? "text" : "password";
        apiKeyInput.setAttribute("type", type);
        toggleKeyBtn.textContent = type === "password" ? "👁️" : "🙈";
    });

    // Sample High Risk Telemetry
    loadSampleBtn.addEventListener("click", () => {
        const sampleData = {
            pregnancies: 5, glucose: 185, bp: 82, skin: 30, insulin: 175, bmi: 34.8, pedigree: 1.25, age: 46
        };
        Object.entries(sampleData).forEach(([k, v]) => {
            const slider = document.getElementById(k);
            slider.value = v;
            document.getElementById(`${k}-val`).textContent = v;
        });
    });

    // Form Submit Diagnostic Request
    vitalsForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const apiKey = apiKeyInput.value.trim();
        const endpointUrl = document.getElementById("endpoint-url-input").value.trim();

        if (!apiKey || !endpointUrl) {
            alert("⚠️ Please paste both your live Endpoint URL and Azure ML Primary API Key!");
            if (!endpointUrl) document.getElementById("endpoint-url-input").focus();
            else apiKeyInput.focus();
            return;
        }

        // Collect exact 8 float values in Scikit-Learn training order
        const patientData = [
            parseFloat(document.getElementById("pregnancies").value),
            parseFloat(document.getElementById("glucose").value),
            parseFloat(document.getElementById("bp").value),
            parseFloat(document.getElementById("skin").value),
            parseFloat(document.getElementById("insulin").value),
            parseFloat(document.getElementById("bmi").value),
            parseFloat(document.getElementById("pedigree").value),
            parseFloat(document.getElementById("age").value)
        ];

        // Transition to loading UI
        idleVisual.classList.add("hidden");
        outcomeVisual.classList.add("hidden");
        errorBanner.classList.add("hidden");
        loadingVisual.classList.remove("hidden");

        const startTime = performance.now();

        try {
            const response = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint_url: endpointUrl, api_key: apiKey, patient_data: patientData })
            });

            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            const data = await response.json();

            loadingVisual.classList.add("hidden");

            if (!response.ok || data.error) {
                throw new Error(data.error || "Inference gateway returned failure");
            }

            // Extract prediction number [0 or 1]
            let predNumber = 0;
            if (Array.isArray(data.prediction)) {
                predNumber = data.prediction[0];
            } else if (data.prediction && Array.isArray(data.prediction.prediction)) {
                predNumber = data.prediction.prediction[0];
            }

            // Format outcome display
            diagTime.textContent = new Date().toLocaleTimeString();
            latencyVal.textContent = `${latency} ms`;

            if (predNumber === 1) {
                resultBadge.className = "result-badge diabetic";
                badgeIcon.textContent = "🚨";
                outcomeTitle.textContent = "Diabetic (High Risk)";
                outcomeSubtitle.textContent = "Positive clinical screening telemetry [Prediction: 1]";
                clinicalExplainer.textContent = "Glycemic indicators (Plasma Glucose > 140 mg/dL) coupled with elevated BMI strongly correlate with acute glycemic resistance. Immediate clinical lab confirmation advised.";
            } else {
                resultBadge.className = "result-badge healthy";
                badgeIcon.textContent = "🛡️";
                outcomeTitle.textContent = "Non-Diabetic (Low Risk)";
                outcomeSubtitle.textContent = "Negative screening result [Prediction: 0]";
                clinicalExplainer.textContent = "Metabolic parameters remain within safe homeostatic thresholds. No acute glycemic anomalies detected.";
            }

            outcomeVisual.classList.remove("hidden");

        } catch (err) {
            loadingVisual.classList.add("hidden");
            document.getElementById("error-desc").textContent = err.message;
            errorBanner.classList.remove("hidden");
        }
    });
});
