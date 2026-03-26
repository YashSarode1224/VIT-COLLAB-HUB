// Import Firebase modules via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your live web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCmNlAdzSv6dzjejUsD6DB_SitkBd2PbC8",
    authDomain: "vit-collab-hub-e5e1e.firebaseapp.com",
    projectId: "vit-collab-hub-e5e1e",
    storageBucket: "vit-collab-hub-e5e1e.firebasestorage.app",
    messagingSenderId: "685274150301",
    appId: "1:685274150301:web:86fb9104a6e1b0e722eb74"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auth Guard: If user is already logged in, redirect to their dashboard
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().role) {
                const role = docSnap.data().role;
                if (role === 'admin') window.location.href = '/html/admin-dashboard.html';
                else if (role === 'club') window.location.href = '/html/club-dashboard.html';
                else if (role === 'student') window.location.href = '/html/student-dashboard.html';
            }
        } catch (err) {
            console.error("Auth Guard Error:", err);
        }
    }
});

// DOM Elements
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('auth-message');
const togglePasswordBtn = document.getElementById('toggle-password');
const forgotPasswordLink = document.getElementById('forgot-password');
const eyePath = document.getElementById('eye-path');
const tabButtons = document.querySelectorAll('.tab-btn');

// State Variable
let currentRole = 'student'; // Defaults to student

// Helper to show messages
const showMessage = (msg, isError = true) => {
    authMessage.textContent = msg;
    authMessage.className = `message-box ${isError ? 'error-text' : 'success-text'}`;
};

// 🎯 TAB SWITCHING LOGIC
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all tabs
        tabButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked tab
        button.classList.add('active');

        // Update current role
        currentRole = button.getAttribute('data-role');

        // Clear inputs and messages on tab switch
        usernameInput.value = '';
        passwordInput.value = '';
        showMessage('');

        // Update placeholder dynamically based on role
        if (currentRole === 'student') {
            usernameInput.placeholder = "Registration No.";
        } else if (currentRole === 'club') {
            usernameInput.placeholder = "Club ID";
        } else if (currentRole === 'admin') {
            usernameInput.placeholder = "Employee ID"; // Updated from Admin Email
        }
    });
});

// UI: Toggle Password Visibility
togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    if (isPassword) {
        togglePasswordBtn.classList.add('active');
        eyePath.setAttribute('d', 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm8.36-4.64l-14.5 14.5-1.41-1.41 14.5-14.5 1.41 1.41z');
    } else {
        togglePasswordBtn.classList.remove('active');
        eyePath.setAttribute('d', 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z');
    }
});

// 🎯 MULTI-ROLE SUBMIT LOGIC
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawInput = usernameInput.value.trim();
    const password = passwordInput.value;

    let firebaseEmailFormat = '';
    let redirectUrl = '';

    // Route the logic based on the active tab
    if (currentRole === 'student') {
        firebaseEmailFormat = `${rawInput.toUpperCase()}@student.vitcollab.local`;
        redirectUrl = "/html/student-profile-setup.html";
    }
    else if (currentRole === 'club') {
        const clubId = rawInput.split('-')[0]; // Extract '0001' from '0001-GDG-VIT'
        firebaseEmailFormat = `${clubId.toUpperCase()}@club.vitcollab.local`;
        redirectUrl = "/html/club-profile-setup.html";
    }
    else if (currentRole === 'admin') {
        // Admins now use Employee ID with a dummy domain
        firebaseEmailFormat = `${rawInput.toUpperCase()}@admin.vitcollab.local`;
        redirectUrl = "/html/admin-profile-setup.html";
    }

    showMessage("");
    const submitBtn = document.getElementById('sign-in-btn');
    submitBtn.textContent = "Signing In...";
    submitBtn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, firebaseEmailFormat, password);
        window.location.href = redirectUrl; // Redirect to the correct dashboard!
    } catch (error) {
        console.error(error.code);
        
        // --- AUTO-REGISTRATION for PROTOTYPING ---
        // If user doesn't exist, we will create the account automatically 
        // to "connect" the login to the admin/club/student flows seamlessly.
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            try {
                const userCred = await createUserWithEmailAndPassword(auth, firebaseEmailFormat, password);
                console.log("Auto-registered dummy user:", userCred.user.uid);
                window.location.href = redirectUrl;
            } catch (regError) {
                console.error("Auto-registration failed:", regError.code);
                showMessage("Invalid credentials. Registration also failed.", true);
                submitBtn.textContent = "Sign In";
                submitBtn.disabled = false;
            }
        } else {
            let errorMessage = "An error occurred during login.";
            if (error.code === 'auth/invalid-email') {
                errorMessage = "Please enter a valid format.";
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = "Too many attempts. Please try again later.";
            }
            showMessage(errorMessage, true);
            submitBtn.textContent = "Sign In";
            submitBtn.disabled = false;
        }
    }
});

// ACTION: Forgot Password
forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const rawInput = usernameInput.value.trim();

    if (!rawInput) {
        showMessage("Please enter your ID first to reset password.", true);
        usernameInput.focus();
        return;
    }

    let firebaseEmailFormat = '';
    if (currentRole === 'student') firebaseEmailFormat = `${rawInput.toUpperCase()}@student.vitcollab.local`;
    else if (currentRole === 'club') {
        const clubId = rawInput.split('-')[0];
        firebaseEmailFormat = `${clubId.toUpperCase()}@club.vitcollab.local`;
    }
    else if (currentRole === 'admin') firebaseEmailFormat = `${rawInput.toUpperCase()}@admin.vitcollab.local`;

    try {
        await sendPasswordResetEmail(auth, firebaseEmailFormat);
        showMessage(`Reset request logged for ${rawInput}. Contact IT support.`, false);
    } catch (error) {
        console.error(error);
        showMessage("Failed to process request. User not found.", true);
    }
});
