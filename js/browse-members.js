import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let cachedMembers = [];
let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    initSharedUI();
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUserId = user.uid;
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            const firstName = data.name ? data.name.split(' ')[0] : "Student";
            const navUserName = document.getElementById('nav-user-name');
            if (navUserName) navUserName.textContent = firstName;
        }
    } catch (e) { console.error("Error fetching user data", e); }

    fetchMembers();
});

document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
});


function initSharedUI() {
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
}

async function fetchMembers() {
    const grid = document.getElementById('membersGrid');

    try {
        const usersRef = collection(db, "users");
        // We want all students except the current user (if they are a student)
        const q = query(usersRef, where("role", "==", "student"));
        const snapshot = await getDocs(q);

        const loadedMembers = [];
        snapshot.forEach(docSnap => {
            if (docSnap.id !== currentUserId) {
                loadedMembers.push({ id: docSnap.id, ...docSnap.data() });
            }
        });

        cachedMembers = loadedMembers;
        renderMembersList(loadedMembers);

    } catch (err) {
        console.error("Error fetching members:", err);
        grid.innerHTML = '<p class="text-danger" style="text-align: center; width: 100%;">Failed to load members.</p>';
    }
}

function renderMembersList(members) {
    const grid = document.getElementById('membersGrid');
    grid.innerHTML = '';

    if (members.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="text-align: center; width: 100%;">No members found matching your criteria.</p>';
        return;
    }

    members.forEach(member => {
        const name = member.name || "Student";
        const branch = member.branch || "Branch TBD";
        const avatar = member.avatar_url || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

        // Compute rating from Firestore fields
        const rating = (member.total_reviews > 0)
            ? (member.total_stars / member.total_reviews).toFixed(1)
            : "New";

        // Use user-selected top3_skills if available, else fallback
        const top3Skills = Array.isArray(member.top3_skills) && member.top3_skills.length > 0
            ? member.top3_skills
            : (Array.isArray(member.skills) ? member.skills.slice(0, 3) : []);
        const pillsHTML = top3Skills.map(s => `<span class="skill-pill">${s}</span>`).join('');

        const card = document.createElement('div');
        card.className = 'member-card';
        card.innerHTML = `
            <div class="rating-badge-top"><i class="fa-solid fa-star"></i> ${rating}</div>
            <img src="${avatar}" alt="${name}" class="member-avatar">
            <h3 class="member-name">${name}</h3>
            <div class="member-role"><i class="fa-solid fa-graduation-cap"></i> ${branch}</div>
            
            <div class="member-skills">
                ${pillsHTML}
            </div>

            <div class="member-actions">
                <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="window.viewMemberProfile('${member.id}')">View Profile</button>
                <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="alert('Messaging feature coming soon!')"><i class="fa-solid fa-message" style="margin-right: 4px;"></i>Message</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = cachedMembers.filter(m => {
        const matchName = (m.name || "").toLowerCase().includes(term);
        const matchBranch = (m.branch || "").toLowerCase().includes(term);
        const matchRole = (m.position || "").toLowerCase().includes(term);
        const matchSkills = (m.skills || []).some(s => s.toLowerCase().includes(term));
        return matchName || matchBranch || matchRole || matchSkills;
    });
    renderMembersList(filtered);
});


// Modal Logic
const profileOverlay = document.getElementById('profileModalOverlay');
const closeBtn = document.getElementById('closeProfileModalBtn');

window.viewMemberProfile = (userId) => {
    const mem = cachedMembers.find(m => m.id === userId);
    if (!mem) return;

    document.getElementById('modalAvatar').src = mem.avatar_url || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    document.getElementById('modalName').textContent = mem.name || "Student";
    document.getElementById('modalRole').innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${mem.branch || 'Student'}`;
    document.getElementById('modalBranch').textContent = mem.branch || "Branch TBD";

    // Compute and show rating
    const rating = (mem.total_reviews > 0)
        ? (mem.total_stars / mem.total_reviews).toFixed(1)
        : "New";
    document.getElementById('modalRating').textContent = rating;

    // Use user-selected top3_skills if available
    const top3Skills = Array.isArray(mem.top3_skills) && mem.top3_skills.length > 0
        ? mem.top3_skills
        : (Array.isArray(mem.skills) ? mem.skills.slice(0, 3) : []);

    const topPillsHTML = top3Skills.map(skill => `<span class="skill-pill">${skill}</span>`).join('');
    document.getElementById('modalTopSkills').innerHTML = topPillsHTML || '<span class="text-muted" style="font-size:0.8rem;">No top skills</span>';

    // Render GitHub / LinkedIn links
    const linksContainer = document.getElementById('modalLinks');
    let linksHTML = '';
    if (mem.github) {
        linksHTML += `<a href="${mem.github}" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: #24292e; color: white; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 600; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
            <i class="fa-brands fa-github" style="font-size: 16px;"></i> GitHub
        </a>`;
    }
    if (mem.linkedin) {
        linksHTML += `<a href="${mem.linkedin}" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: #0a66c2; color: white; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 600; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
            <i class="fa-brands fa-linkedin" style="font-size: 16px;"></i> LinkedIn
        </a>`;
    }
    if (!linksHTML) {
        linksHTML = '<span class="text-muted" style="font-size: 0.8rem;">No profile links available</span>';
    }
    linksContainer.innerHTML = linksHTML;

    // Set View Full Profile link
    const viewFullBtn = document.getElementById('viewFullProfileBtn');
    if (viewFullBtn) {
        viewFullBtn.onclick = () => {
            window.location.href = `profile-view.html?uid=${userId}`;
        };
    }

    profileOverlay.style.display = 'flex';
};

closeBtn.addEventListener('click', () => {
    profileOverlay.style.display = 'none';
});

profileOverlay.addEventListener('click', (e) => {
    if (e.target === profileOverlay) profileOverlay.style.display = 'none';
});