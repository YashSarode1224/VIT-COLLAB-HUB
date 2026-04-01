import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * student-profile.js
 * Handles populating the user's profile, calculating dynamic fields (average rating from stars),
 * and processing form submissions for profile updates.
 */

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }
        initProfile(user);
    });

    // Event Listeners for UI
    document.getElementById('profileForm').addEventListener('submit', (e) => handleProfileSave(e, auth.currentUser));
    document.getElementById('skillInput')?.addEventListener('keydown', handleSkillTagEvent);

    // Media Upload Listeners
    document.getElementById('coverUploadInput').addEventListener('change', handleCoverUpload);
    document.getElementById('avatarUploadInput').addEventListener('change', handleAvatarUpload);

    // Profile Dropdown Toggle
    const profileMenu = document.getElementById('profileMenu');
    const profileDropdownContent = document.getElementById('profileDropdownContent');
    if (profileMenu && profileDropdownContent) {
        profileMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdownContent.style.display = profileDropdownContent.style.display === 'block' ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileMenu.contains(e.target) && !profileDropdownContent.contains(e.target)) {
                profileDropdownContent.style.display = 'none';
            }
        });
    }

    // Side Chat Panel Toggle
    const fabMessages = document.getElementById('fabMessages');
    const sideChatPanel = document.getElementById('sideChatPanel');
    const sideChatOverlay = document.getElementById('sideChatOverlay');
    const closeChatPanelBtn = document.getElementById('closeChatPanelBtn');

    if (fabMessages && sideChatPanel && sideChatOverlay && closeChatPanelBtn) {
        const toggleChatPanel = (show) => {
            sideChatPanel.style.right = show ? '0' : '-450px';
            sideChatOverlay.style.display = show ? 'block' : 'none';
        };

        fabMessages.addEventListener('click', () => toggleChatPanel(true));
        closeChatPanelBtn.addEventListener('click', () => toggleChatPanel(false));
        sideChatOverlay.addEventListener('click', () => toggleChatPanel(false));
    }
});

let pendingCoverFile = null;
let pendingAvatarFile = null;

// Compression Utility for images (to confidently avoid Firestore 1MB limits)
function compressImage(file, maxWidth, maxHeight, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Return compressed webp or jpeg
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Handle local media uploads (Preview)
 */
function handleCoverUpload(e) {
    const file = e.target.files[0];
    if (file) {
        pendingCoverFile = file;
        const reader = new FileReader();
        reader.onload = function(event) {
            const imgUrl = event.target.result;
            document.getElementById('profileCover').style.backgroundImage = `linear-gradient(135deg, rgba(13,110,253,0.7) 0%, rgba(10,25,47,0.8) 100%), url('${imgUrl}')`;
        }
        reader.readAsDataURL(file);
    }
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (file) {
        pendingAvatarFile = file;
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('profile-avatar').src = event.target.result;
            if (document.getElementById('nav-avatar')) {
                document.getElementById('nav-avatar').src = event.target.result;
            }
        }
        reader.readAsDataURL(file);
    }
}

// A local state copy of skills as a "Map" mock ({ "react": true, "node": true })
let userSkillsMap = {};

/**
 * Initialize Profile Data from Backend
 */
async function initProfile(user) {
    try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        let userData = {
            name: user.displayName || "New User",
            email: user.email || "",
            registration_number: "",
            branch: "",
            block: "",
            skills: {},
            completed_projects: 0,
            total_stars: 0,
            total_reviews: 0,
            avatar_url: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png",
            github: ""
        };

        if (docSnap.exists()) {
            userData = { ...userData, ...docSnap.data() };
        }

        // 1. Math Calculation on read
        let avgRating = (userData.total_reviews > 0) 
            ? (userData.total_stars / userData.total_reviews).toFixed(1) 
            : "No Ratings";

        // 2. Populate UI Headers
        document.getElementById('display-name').textContent = userData.name;
        document.getElementById('nav-user-name').textContent = userData.name.split(' ')[0];
        document.getElementById('profile-avatar').src = userData.avatar_url;
        if (document.getElementById('nav-avatar')) {
            document.getElementById('nav-avatar').src = userData.avatar_url;
        }
        document.getElementById('display-branch').innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${userData.branch || 'Add Branch'}`;
        document.getElementById('display-rating').innerHTML = `<i class="fa-solid fa-star"></i> ${avgRating} / 5.0 Rating`;
        
        if (userData.cover_url) {
            document.getElementById('profileCover').style.backgroundImage = `linear-gradient(135deg, rgba(13,110,253,0.7) 0%, rgba(10,25,47,0.8) 100%), url('${userData.cover_url}')`;
        }
        
        // Stats
        document.getElementById('stat-completed').textContent = userData.completed_projects;
        document.getElementById('stat-reviews').textContent = userData.total_reviews;

        // 3. Populate Form View
        document.getElementById('input-name').value = userData.name;
        document.getElementById('input-reg').value = userData.registration_number || '';
        document.getElementById('input-branch').value = userData.branch || '';
        if (userData.gender) document.getElementById('input-gender').value = userData.gender;
        document.getElementById('input-block').value = userData.block || '';
        document.getElementById('input-email').value = userData.email || '';
        if (document.getElementById('input-github')) {
            document.getElementById('input-github').value = userData.github || '';
        }

        // Populate Skills Map
        if (userData.skills) {
            userSkillsMap = userData.skills;
            renderSkillTags();
        }

    } catch (e) {
        console.error("Failed to load profile", e);
    }
}

/**
 * Handle form submission
 */
async function handleProfileSave(e, user) {
    e.preventDefault();
    if (!user) return;
    
    // Grab button to show loading state
    const btn = document.getElementById('saveProfileBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
    btn.disabled = true;

    const updatedData = {
        name: document.getElementById('input-name').value.trim(),
        registration_number: document.getElementById('input-reg').value.trim(),
        gender: document.getElementById('input-gender').value,
        branch: document.getElementById('input-branch').value.trim(),
        block: document.getElementById('input-block').value.trim(),
        email: document.getElementById('input-email').value.trim(),
        github: document.getElementById('input-github') ? document.getElementById('input-github').value.trim() : '',
        skills: userSkillsMap,
        role: "student" // Important! Dashboards rely on this role definition
    };

    try {
        // Compress and encode images dynamically locally to bypass Storage requirements
        if (pendingAvatarFile) {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Compressing Avatar...';
            // Compress heavily: 300x300 px
            updatedData.avatar_url = await compressImage(pendingAvatarFile, 300, 300, 0.8);
            pendingAvatarFile = null;
        }

        if (pendingCoverFile) {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Compressing Cover...';
            // Compress horizontally: 900x400 px max
            updatedData.cover_url = await compressImage(pendingCoverFile, 900, 400, 0.8);
            pendingCoverFile = null;
        }

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving Profile...';
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, updatedData, { merge: true });

        // Display Header changes instantly
        document.getElementById('display-name').textContent = updatedData.name;
        document.getElementById('display-branch').innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${updatedData.branch}`;
        document.getElementById('nav-user-name').textContent = updatedData.name.split(' ')[0];
        if (updatedData.avatar_url && document.getElementById('nav-avatar')) {
            document.getElementById('nav-avatar').src = updatedData.avatar_url;
        }

        // Toast success
        alert("Profile saved successfully! You can now visit your Dashboard.");

    } catch (error) {
        console.error(error);
        alert("Error saving profile. Try again.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * Handle keyboard input for skills (Enter & Comma)
 */
function handleSkillTagEvent(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault(); // Stop form full submit
        const rawValue = e.target.value.trim().toLowerCase();
        
        if (rawValue !== "" && !userSkillsMap[rawValue]) {
            // Add to our internal pseudo-map
            userSkillsMap[rawValue] = true;
            renderSkillTags();
        }
        e.target.value = ''; // clear input
    }
}

/**
 * Refresh visual skill nodes from the HashMap
 */
function renderSkillTags() {
    const container = document.getElementById('skillTagsContainer');
    
    // Clear old tags (but keep the input box)
    document.querySelectorAll('.skill-tag').forEach(el => el.remove());

    const inputNode = document.getElementById('skillInput');
    if (!inputNode) return;

    // Create a new pill for every true key in the map
    Object.keys(userSkillsMap).forEach(skill => {
        if (userSkillsMap[skill] === true) {
            const tag = document.createElement('span');
            tag.className = 'skill-tag';
            tag.innerHTML = `${skill} <i class="fa-solid fa-xmark" aria-hidden="true"></i>`;
            
            // Allow deletion
            tag.querySelector('i').addEventListener('click', () => {
                delete userSkillsMap[skill];
                renderSkillTags();
            });

            container.insertBefore(tag, inputNode);
        }
    });
}
