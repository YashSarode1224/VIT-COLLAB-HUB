import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const setupForm = document.getElementById('profile-setup-form');
const saveBtn = document.getElementById('save-profile-btn');
const logoutBtn = document.getElementById('logout-btn');

const CLUB_MAPPINGS = {
    "0001": "GDG-VIT",
    "0002": "CSI-VIT",
    "0003": "ACM-VIT",
    "0004": "Vinnovate-VIT",
    "0005": "Codechef-VIT",
    "0006": "IEEE-VIT",
    "0007": "ISTE-VIT"
};

// Guard Route
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/html/login.html";
        return;
    }
    
    // Check if profile already exists
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().role) {
        // user already has a role/profile defined, redirect to dashboard
        window.location.href = "/html/club-dashboard.html";
        return;
    }

    // Auto-fill mapped club name based on 4-digit login email prefix
    if (user.email) {
        const clubId = user.email.split('@')[0].toUpperCase();
        const mappedClubName = CLUB_MAPPINGS[clubId] || `Club ${clubId}`;
        document.getElementById('club-name').value = mappedClubName;
    }
});

setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    try {
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            role: "club",
            name: document.getElementById('executive-name').value.trim(),
            position: document.getElementById('position').value.trim(),
            club_name: document.getElementById('club-name').value.trim(),
            branch: document.getElementById('branch').value.trim()
        });
        
        // Success -> go to dashboard
        window.location.href = "/html/club-dashboard.html";
    } catch (err) {
        console.error("Error saving profile:", err);
        alert("Failed to save profile. Check console for details.");
        saveBtn.textContent = "Save Profile & Continue";
        saveBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "/html/login.html";
    });
});
