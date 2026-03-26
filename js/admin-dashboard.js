import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    collection, query, where, doc, updateDoc, 
    onSnapshot, increment, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const logoutBtn = document.getElementById('logout-btn');
const navUserName = document.getElementById('nav-user-name');
const pendingContainer = document.getElementById('mentor-requests-container');
const activeContainer = document.getElementById('active-projects-container');
const pendingCount = document.getElementById('pending-count');
const activeCount = document.getElementById('active-count');

let currentUser = null;
let currentProfile = null;

// Modal Elements
const ratingModal = document.getElementById('rating-modal');
const closeModalBtn = document.getElementById('close-modal');
const projectRating = document.getElementById('project-rating');
const submitCompletionBtn = document.getElementById('submit-completion');
let completingProjectId = null;
let currentTeamMembers = [];

// DOM Views & Tabs
const tabDashboard = document.getElementById('tab-dashboard');
const tabRequests = document.getElementById('tab-requests');
const tabProfile = document.getElementById('tab-profile');

const viewDashboard = document.getElementById('view-dashboard');
const viewRequests = document.getElementById('view-requests');
const viewProfile = document.getElementById('view-profile');

function hideAllViews() {
    [tabDashboard, tabRequests, tabProfile].forEach(t => t.classList.remove('active'));
    [viewDashboard, viewRequests, viewProfile].forEach(v => v.style.display = 'none');
}

tabDashboard.addEventListener('click', () => {
    hideAllViews();
    tabDashboard.classList.add('active');
    viewDashboard.style.display = 'block';
});

tabRequests.addEventListener('click', () => {
    hideAllViews();
    tabRequests.classList.add('active');
    viewRequests.style.display = 'block';
});

tabProfile.addEventListener('click', async () => {
    hideAllViews();
    tabProfile.classList.add('active');
    viewProfile.style.display = 'block';
    
    // Auto-fill profile dynamically if data exists
    if (currentProfile) {
        document.getElementById('view-emp-id').value = currentProfile.employee_id || 'N/A';
        document.getElementById('view-name').value = currentProfile.name || 'N/A';
        document.getElementById('view-email').value = currentProfile.email || 'N/A';
        document.getElementById('view-school').value = currentProfile.school_name || 'N/A';
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/html/login.html";
        return;
    }

    currentUser = user;
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists() || docSnap.data().role !== "admin") {
        window.location.href = "/html/login.html";
        return;
    }

    currentProfile = docSnap.data();
    const empId = currentProfile.employee_id ? ` (${currentProfile.employee_id})` : '';
    navUserName.textContent = currentProfile.name + empId;

    // Load Data
    loadMentorRequests();
    loadActiveProjects();
});

function loadMentorRequests() {
    const q = query(
        collection(db, "projects"), 
        where("status", "==", "pending_mentor")
    );
    
    onSnapshot(q, (snapshot) => {
        pendingCount.textContent = snapshot.size;
        pendingContainer.innerHTML = '';
        
        if (snapshot.empty) {
            pendingContainer.innerHTML = '<p style="color: var(--muted-text); font-size: 14px; text-align: center;">No pending requests at the moment.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const project = docSnap.data();
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-details">
                    <h4>${project.title || 'Untitled Project'}</h4>
                    <p>Team Size: ${project.team_members?.length || 0}</p>
                </div>
                <div class="card-actions">
                    <button class="btn-secondary" onclick="window.acceptMentor('${docSnap.id}')">Accept</button>
                </div>
            `;
            pendingContainer.appendChild(card);
        });
    });
}

function loadActiveProjects() {
    const q = query(
        collection(db, "projects"),
        where("status", "==", "ongoing"),
        where("mentor_id", "==", currentUser.uid)
    );

    onSnapshot(q, (snapshot) => {
        activeCount.textContent = snapshot.size;
        activeContainer.innerHTML = '';

        if (snapshot.empty) {
            activeContainer.innerHTML = '<p style="color: var(--muted-text); font-size: 14px; text-align: center;">You are not actively mentoring any projects.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const project = docSnap.data();
            const teamArrayStr = JSON.stringify(project.team_members || []).replace(/"/g, '&quot;');
            
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-details" style="flex: 1;">
                    <h4>${project.title || 'Untitled Project'}</h4>
                    <p>Active Submissions: ${project.submission_count || 0}</p>
                </div>
                <div class="card-actions" style="display: flex; gap: 10px;">
                    <button class="btn-secondary" onclick="window.location.href='/html/project-workspace.html?id=${docSnap.id}'">Workspace</button>
                    <button class="btn-secondary" style="background: var(--primary-blue); color: white;" onclick="window.openCompletionModal('${docSnap.id}', '${teamArrayStr}')">✔ Finish</button>
                </div>
            `;
            activeContainer.appendChild(card);
        });
    });
}

// Global scope functions for inline HTML calls
window.acceptMentor = async (projectId) => {
    try {
        await updateDoc(doc(db, "projects", projectId), {
            status: "ongoing",
            mentor_id: currentUser.uid
        });
    } catch (e) {
        console.error("Failed to accept project", e);
        alert("Failed to accept project. Check permissions.");
    }
};

window.openCompletionModal = (projectId, teamArrayStr) => {
    completingProjectId = projectId;
    try {
        currentTeamMembers = JSON.parse(teamArrayStr);
    } catch(e) {
        currentTeamMembers = [];
    }
    ratingModal.classList.add('active'); // using new active model overlay class
};

closeModalBtn.addEventListener('click', () => {
    ratingModal.classList.remove('active');
    completingProjectId = null;
    currentTeamMembers = [];
});

submitCompletionBtn.addEventListener('click', async () => {
    if (!completingProjectId) return;
    const ratingValue = parseInt(projectRating.value, 10);
    
    submitCompletionBtn.textContent = "Processing...";
    submitCompletionBtn.disabled = true;

    try {
        await updateDoc(doc(db, "projects", completingProjectId), {
            status: "completed",
            rating: ratingValue
        });

        // Updating user stars (in prod this would be tightly controlled via functions/rules)
        for (const uid of currentTeamMembers) {
            await updateDoc(doc(db, "users", uid), {
                total_stars: increment(ratingValue),
                total_reviews: increment(1),
                completed_projects: increment(1)
            });
        }
        
        ratingModal.classList.remove('active');
        alert("Project completed successfully!");
    } catch (e) {
        console.error("Failed to complete project", e);
        alert("Failed to complete project. Ensure you have network connectivity.");
    } finally {
        submitCompletionBtn.textContent = "Finalize Project";
        submitCompletionBtn.disabled = false;
        completingProjectId = null;
        currentTeamMembers = [];
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "/html/login.html");
});
