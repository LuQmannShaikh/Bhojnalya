// ==========================================================================
// SMART MESS APP - MASTER LOGIC FILE (app.js)
// Features: Unique ID Gen, Anti-Screenshot Clock, Leave Check, QR Engine
// ==========================================================================

// --- 1. FIREBASE INITIALIZATION ---
// Replace with your Firebase Console Project credentials
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-mess-app.firebaseapp.com",
    projectId: "your-mess-app-id",
    storageBucket: "your-mess-app.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// --- 2. GLOBAL STATE & SELECTORS ---
let currentUser = null;
let currentMessId = "mess_001"; // Multi-Tenant Mess Identifier
let passClockInterval = null;

const dom = {
    loading: document.getElementById('loadingOverlay'),
    authScreen: document.getElementById('authScreen'),
    appScreen: document.getElementById('appScreen'),
    loginForm: document.getElementById('loginForm'),
    loginId: document.getElementById('loginId'),
    loginPassword: document.getElementById('loginPassword'),
    studentDashboard: document.getElementById('studentDashboard'),
    adminDashboard: document.getElementById('adminDashboard'),
    studentName: document.getElementById('studentName'),
    studentUniqueId: document.getElementById('studentUniqueId'),
    headerMessName: document.getElementById('headerMessName'),
    passModal: document.getElementById('passModal'),
    passStudentName: document.getElementById('passStudentName'),
    passStudentId: document.getElementById('passStudentId'),
    livePassClock: document.getElementById('livePassClock'),
    btnShowPass: document.getElementById('btnShowPass'),
    btnClosePass: document.getElementById('btnClosePass'),
    btnLogout: document.getElementById('btnLogout')
};

// --- 3. UTILITY FUNCTIONS ---

// Double-Submit Protection Loader
function toggleLoader(show) {
    if (show) {
        dom.loading.classList.remove('hidden');
    } else {
        dom.loading.classList.add('hidden');
    }
}

// Clean Unique Code Generator (Prevents confusing characters like 0/O, 1/I/l)
function generateUniqueUserCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'RM-';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code; // e.g. "RM-7K9P2"
}

// Get Real Contextual Meal (0 = Lunch, 1 = Dinner)
function getCurrentMealContext() {
    const now = new Date();
    const hours = now.getHours();
    
    // Meal detection: Before 4 PM -> Lunch (0), After 4 PM -> Dinner (1)
    const mealType = hours < 16 ? 0 : 1;
    const mealName = mealType === 0 ? "Lunch" : "Dinner";
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const indexKey = `${year}${month}${day}${mealType}`; // e.g. "202610060"
    
    return { indexKey, mealName, mealType, dateStr: `${year}-${month}-${day}` };
}

// --- 4. ANTI-SCREENSHOT LIVE CLOCK ---
function startLiveAntiScreenshotClock() {
    if (passClockInterval) clearInterval(passClockInterval);

    passClockInterval = setInterval(() => {
        if (!dom.livePassClock) return;

        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateString = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        dom.livePassClock.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <span class="relative flex h-3 w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span class="font-mono text-base font-bold text-emerald-600">${timeString}</span>
            </div>
            <p class="text-[11px] text-gray-500 font-semibold mt-1">${dateString} • LIVE SECONDS</p>
        `;
    }, 1000);
}

// --- 5. AUTHENTICATION & DASHBOARD ROUTING ---
dom.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoader(true);

    const inputId = dom.loginId.value.trim();
    const inputPass = dom.loginPassword.value.trim();

    try {
        // Admin Master Bypass / Firestore Authentication
        if (inputId === "admin" && inputPass === "admin123") {
            currentUser = { role: "admin", name: "Mess Manager", messId: "mess_001" };
            renderDashboard("admin");
        } else {
            // Student Firestore Authentication Validation
            const userSnapshot = await db.collection("messes")
                .doc(currentMessId)
                .collection("users")
                .where("uniqueCode", "==", inputId)
                .get();

            if (!userSnapshot.empty) {
                const userData = userSnapshot.docs[0].data();
                if (userData.password === inputPass) {
                    currentUser = { id: userSnapshot.docs[0].id, ...userData };
                    renderDashboard("student");
                } else {
                    alert("Invalid Password / PIN");
                }
            } else {
                alert("Student Code Not Found");
            }
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed. Check internet connection.");
    } finally {
        toggleLoader(false);
    }
});

function renderDashboard(role) {
    dom.authScreen.classList.add('hidden');
    dom.appScreen.classList.remove('hidden');

    if (role === "admin") {
        dom.adminDashboard.classList.remove('hidden');
        dom.studentDashboard.classList.add('hidden');
        dom.headerMessName.innerText = "Mess Admin Panel";
    } else {
        dom.studentDashboard.classList.remove('hidden');
        dom.adminDashboard.classList.add('hidden');
        dom.studentName.innerText = `Welcome, ${currentUser.name || 'Student'}`;
        dom.studentUniqueId.innerText = currentUser.uniqueCode || 'RM-00000';
        dom.headerMessName.innerText = currentUser.messName || "Smart Mess";
    }
}

// Logout Action
dom.btnLogout.addEventListener('click', () => {
    currentUser = null;
    if (passClockInterval) clearInterval(passClockInterval);
    dom.appScreen.classList.add('hidden');
    dom.authScreen.classList.remove('hidden');
    dom.loginForm.reset();
});

// --- 6. STUDENT DIGITAL PASS ENGINE ---
dom.btnShowPass.addEventListener('click', () => {
    if (!currentUser) return;

    dom.passStudentName.innerText = currentUser.name || "Student Name";
    dom.passStudentId.innerText = currentUser.uniqueCode || "RM-XXXXX";

    // Dynamic QR Generator using QRCode Server API
    const qrData = JSON.stringify({
        uid: currentUser.uniqueCode,
        messId: currentMessId,
        ts: Date.now()
    });
    
    document.getElementById('qrCodeImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}`;

    // Trigger Anti-Screenshot Clock & Open Modal
    startLiveAntiScreenshotClock();
    dom.passModal.classList.remove('hidden');
});

dom.btnClosePass.addEventListener('click', () => {
    dom.passModal.classList.add('hidden');
    if (passClockInterval) clearInterval(passClockInterval);
});

// --- 7. VERIFICATION & LEAVE-CHECK SCANNER ENGINE (For Admin) ---
async function verifyStudentPass(studentUniqueCode) {
    toggleLoader(true);
    const mealContext = getCurrentMealContext();

    try {
        const userSnapshot = await db.collection("messes")
            .doc(currentMessId)
            .collection("users")
            .where("uniqueCode", "==", studentUniqueCode)
            .get();

        if (userSnapshot.empty) {
            alert("❌ BLOCKED: Invalid Student Pass!");
            return { valid: false, reason: "INVALID_USER" };
        }

        const student = userSnapshot.docs[0].data();
        const studentDocId = userSnapshot.docs[0].id;

        // CHECK 1: Leave Active Check
        const scheduledLeaves = student.scheduledLeaves || []; // Array of indexKeys e.g., ["202610060"]
        if (scheduledLeaves.includes(mealContext.indexKey)) {
            alert(`🛑 BLOCKED: Student is on LEAVE for ${mealContext.mealName}!`);
            return { valid: false, reason: "LEAVE_ACTIVE" };
        }

        // CHECK 2: Payment Pending Check
        const pendingFee = (student.totalFee || 0) - (student.paidAmount || 0);
        if (pendingFee > 0) {
            alert(`⚠️ WARNING: Fee Pending ₹${pendingFee}. Collect payment.`);
        }

        // RECORD ATTENDANCE
        await db.collection("messes")
            .doc(currentMessId)
            .collection("attendance")
            .add({
                studentId: studentDocId,
                studentCode: studentUniqueCode,
                studentName: student.name,
                mealKey: mealContext.indexKey,
                mealName: mealContext.mealName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

        alert(`✅ ENTRY GRANTED: ${student.name} (${mealContext.mealName})`);
        return { valid: true, student };

    } catch (error) {
        console.error("Scan Error:", error);
        alert("Verification failed.");
        return { valid: false, reason: "SYSTEM_ERROR" };
    } finally {
        toggleLoader(false);
    }
}
