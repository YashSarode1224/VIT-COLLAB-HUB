import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const setupForm = document.getElementById('profile-setup-form');
const saveBtn = document.getElementById('save-profile-btn');
const logoutBtn = document.getElementById('logout-btn');
const msgBox = document.getElementById('profile-message');
const emailInput = document.getElementById('student-email');
const emailError = document.getElementById('email-error');

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    // Check if profile already exists
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().role) {
        window.location.href = "student-dashboard.html";
        return;
    }
});

setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;
    msgBox.textContent = "";

    // Validate email
    const emailVal = emailInput.value.trim();
    if (!emailVal.endsWith('.ac.in') && !emailVal.endsWith('@vitstudent.ac.in')) {
        // Just a simple validation, adjust as needed
        emailError.style.display = 'block';
        saveBtn.textContent = "Save & Continue";
        saveBtn.disabled = false;
        return;
    } else {
        emailError.style.display = 'none';
    }

    // Capture selected skills map
    const skillsMap = {};
    const skillCheckboxes = document.querySelectorAll('input[name="skill"]:checked');
    skillCheckboxes.forEach(cb => {
        skillsMap[cb.value] = true;
    });

    try {
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            auth_email: user.email,
            email: emailVal,
            role: "student",
            name: document.getElementById('student-name').value.trim(),
            registration_number: document.getElementById('reg-no').value.trim(),
            branch: document.getElementById('branch').value.trim(),
            block: document.getElementById('block').value.trim(),
            github_url: document.getElementById('github-link').value.trim(),
            skills: skillsMap,
            completed_projects: 0,
            total_stars: 0,
            total_reviews: 0
        });
        
        window.location.href = "student-dashboard.html";
    } catch (err) {
        console.error("Error saving profile:", err);
        msgBox.textContent = "Failed to save profile. Check console for details.";
        msgBox.className = "message-box error-text";
        saveBtn.textContent = "Save & Continue";
        saveBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "login.html";
    });
});
