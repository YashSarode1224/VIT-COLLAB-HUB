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
    } catch(e) { console.error("Error fetching user data", e); }

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
        const role = member.position || "Developer";
        const rating = member.rating || "New";
        const avatar = member.avatar_url || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
        
        const skillsArray = Array.isArray(member.skills) ? member.skills : [];
        const top3Skills = skillsArray.slice(0, 3);
        const pillsHTML = top3Skills.map(s => `<span class="skill-pill">${s}</span>`).join('');
        const extraPills = skillsArray.length > 3 ? `<span class="skill-pill" style="background:transparent; border:1px solid var(--primary-blue);">+${skillsArray.length - 3}</span>` : '';

        const card = document.createElement('div');
        card.className = 'member-card';
        card.innerHTML = `
            <div class="rating-badge-top"><i class="fa-solid fa-star"></i> ${rating}</div>
            <img src="${avatar}" alt="${name}" class="member-avatar">
            <h3 class="member-name">${name}</h3>
            <div class="member-role"><i class="fa-solid fa-graduation-cap"></i> ${branch}</div>
            <div class="member-role" style="font-weight: 600; color: var(--primary-blue);"><i class="fa-solid fa-code"></i> ${role}</div>
            
            <div class="member-skills">
                ${pillsHTML} ${extraPills}
            </div>

            <div class="member-actions">
                <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="window.viewMemberProfile('${member.id}')">View Profile</button>
                <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="alert('Connect request feature coming soon!')">Connect</button>
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
    if(!mem) return;
    
    document.getElementById('modalAvatar').src = mem.avatar_url || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    document.getElementById('modalName').textContent = mem.name || "Student";
    document.getElementById('modalRole').innerHTML = `<i class="fa-solid fa-code"></i> ${mem.position || "Developer"}`;
    document.getElementById('modalBranch').textContent = mem.branch || "Branch TBD";
    document.getElementById('modalRating').textContent = mem.rating || "New";
    
    const skillsArray = Array.isArray(mem.skills) ? mem.skills : [];
    const top3Skills = skillsArray.slice(0, 3);
    
    const topPillsHTML = top3Skills.map(skill => `<span class="skill-pill">${skill}</span>`).join('');
    document.getElementById('modalTopSkills').innerHTML = topPillsHTML || '<span class="text-muted" style="font-size:0.8rem;">No top skills</span>';

    const allPillsHTML = skillsArray.map(skill => `<span class="skill-pill">${skill}</span>`).join('');
    document.getElementById('modalSkills').innerHTML = allPillsHTML || '<span class="text-muted" style="font-size:0.8rem;">No specified skills</span>';

    
    profileOverlay.style.display = 'flex';
};

closeBtn.addEventListener('click', () => {
    profileOverlay.style.display = 'none';
});

profileOverlay.addEventListener('click', (e) => {
    if(e.target === profileOverlay) profileOverlay.style.display = 'none';
});
