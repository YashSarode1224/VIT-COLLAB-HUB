import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    collection, query, where, doc, updateDoc, 
    onSnapshot, increment, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const logoutBtn = document.getElementById('logout-btn');
const navUserName = document.getElementById('nav-user-name');
const pendingContainer = document.getElementById('mentor-requests-container');
const activeContainer = document.getElementById('active-projects-container');
const pendingCount = document.getElementById('pending-count');
const activeCount = document.getElementById('active-count');

let currentUser = null;
let currentProfile = null;

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
    // Use the admin's real contact email from their profile (not the Firebase Auth dummy email)
    const adminContactEmail = currentProfile.email;
    const q = query(
        collection(db, "projects"), 
        where("status", "==", "pending_mentor"),
        where("admin_email", "==", adminContactEmail)
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

            // Build PPT link
            let pptHtml = '';
            if (project.ppt_url) {
                pptHtml = `<a href="${project.ppt_url}" target="_blank" style="color: var(--primary-blue); text-decoration: none; font-weight: 600;">
                    📎 ${project.ppt_file_name || 'View PPT'}
                </a>`;
            } else if (project.ppt_file_name) {
                pptHtml = `<span style="color: var(--muted-text);">📎 ${project.ppt_file_name} (uploaded before storage was enabled)</span>`;
            } else {
                pptHtml = `<span style="color: var(--muted-text);">No PPT attached</span>`;
            }

            card.innerHTML = `
                <div class="item-details">
                    <h4>${project.name || project.title || 'Untitled Project'}</h4>
                    <p>Team Size: ${project.team_members?.length || 0} / ${project.team_size || 'N/A'}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px; font-weight: 500;">
                        Description: <span style="font-weight: 400; font-style: italic;">${project.description || 'No description provided.'}</span>
                    </p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">Invite Code: <strong style="color: var(--primary-blue);">${project.project_code || 'N/A'}</strong></p>
                    <p style="font-size: 0.8rem; margin-top: 8px;">Presentation: ${pptHtml}</p>
                </div>
                <div class="card-actions">
                    <button class="btn-secondary" onclick="window.acceptMentor('${docSnap.id}')">Accept</button>
                    <button class="btn-secondary" style="background: var(--danger); color: white;" onclick="window.declineMentor('${docSnap.id}')">Decline</button>
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
                    <h4>${project.name || project.title || 'Untitled Project'}</h4>
                    <p>Active Submissions: ${project.submission_count || 0}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">Invite Code: <strong style="color: var(--primary-blue);">${project.project_code || 'N/A'}</strong></p>
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

window.declineMentor = async (projectId) => {
    if(!confirm("Are you sure you want to decline and delete this project request?")) return;
    try {
        await deleteDoc(doc(db, "projects", projectId));
    } catch (e) {
        console.error("Failed to decline project", e);
        alert("Failed to decline project. Check permissions.");
    }
};

window.openCompletionModal = async (projectId, teamArrayStr) => {
    completingProjectId = projectId;
    try {
        currentTeamMembers = JSON.parse(teamArrayStr);
    } catch(e) {
        currentTeamMembers = [];
    }
    ratingModal.classList.add('active'); // using new active model overlay class
    
    // Load student names dynamically to render individualized rating selectors
    const container = document.getElementById('individual-ratings-container');
    container.innerHTML = '<p style="font-size: 13px; color: var(--muted-text); text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading team members...</p>';
    
    let htmlBuffer = '';
    
    for (const uid of currentTeamMembers) {
        let memberName = "Student";
        try {
            const userSnap = await getDoc(doc(db, "users", uid));
            if (userSnap.exists() && userSnap.data().name) {
                memberName = userSnap.data().name;
            }
        } catch (err) {
            console.error(err);
        }
        
        htmlBuffer += `
            <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                <label style="font-size: 13px; font-weight: 500; color: var(--dark-text); max-width: 50%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${memberName}</label>
                <select class="input-field individual-student-rating" data-uid="${uid}" style="width: 50%; max-width: 180px; padding: 6px; font-size: 13px; cursor: pointer; height: auto;">
                    <option value="5">⭐⭐⭐⭐⭐ 5</option>
                    <option value="4">⭐⭐⭐⭐ 4</option>
                    <option value="3">⭐⭐⭐ 3</option>
                    <option value="2">⭐⭐ 2</option>
                    <option value="1">⭐ 1</option>
                </select>
            </div>
        `;
    }
    
    if (htmlBuffer === '') {
        container.innerHTML = '<p style="font-size: 13px; color: var(--danger);">No team members found.</p>';
    } else {
        container.innerHTML = htmlBuffer;
    }
};

closeModalBtn.addEventListener('click', () => {
    ratingModal.classList.remove('active');
    completingProjectId = null;
    currentTeamMembers = [];
});

submitCompletionBtn.addEventListener('click', async () => {
    if (!completingProjectId) return;
    const projRating = parseInt(projectRating.value, 10);
    
    submitCompletionBtn.textContent = "Processing...";
    submitCompletionBtn.disabled = true;

    try {
        // Collect all individual ratings
        const selectElements = document.querySelectorAll('.individual-student-rating');
        const individualRatingsMap = {};
        selectElements.forEach(select => {
            const uid = select.getAttribute('data-uid');
            individualRatingsMap[uid] = parseInt(select.value, 10);
        });

        await updateDoc(doc(db, "projects", completingProjectId), {
            status: "completed",
            project_rating: projRating,
            individual_ratings: individualRatingsMap, // Store map of uid -> rating
            rating: projRating // backward compatibility
        });

        // Apply individual rating to each team member's profile
        for (const uid of currentTeamMembers) {
            const indivRating = individualRatingsMap[uid] || projRating; // default to project rating as fallback
            await updateDoc(doc(db, "users", uid), {
                total_stars: increment(indivRating),
                project_stars: increment(projRating),
                total_reviews: increment(1),
                completed_projects: increment(1)
            });
        }
        
        ratingModal.classList.remove('active');
        alert("Project completed successfully! Ratings have been appropriately applied to all students.");
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
