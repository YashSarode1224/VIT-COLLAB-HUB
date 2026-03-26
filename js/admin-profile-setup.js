import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const setupForm = document.getElementById('profile-setup-form');
const saveBtn = document.getElementById('save-profile-btn');
const logoutBtn = document.getElementById('logout-btn');
const employeeIdInput = document.getElementById('employee-id');
const msgBox = document.getElementById('profile-message');
const emailInput = document.getElementById('admin-email');
const emailError = document.getElementById('email-error');

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/html/login.html";
        return;
    }
    
    // Check if profile already exists
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().role) {
        window.location.href = "/html/admin-dashboard.html";
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

    // Validate email domain
    const emailVal = emailInput.value.trim();
    if (!emailVal.endsWith('@vit.ac.in')) {
        emailError.style.display = 'block';
        saveBtn.textContent = "Save & Continue";
        saveBtn.disabled = false;
        return;
    }

    try {
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            auth_email: user.email,
            employee_id: document.getElementById('employee-id').value.trim(),
            email: document.getElementById('admin-email').value.trim(),
            role: "admin",
            name: document.getElementById('admin-name').value.trim(),
            school_name: document.getElementById('school-name').value.trim()
        });
        
        window.location.href = "/html/admin-dashboard.html";
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
        window.location.href = "/html/login.html";
    });
});
