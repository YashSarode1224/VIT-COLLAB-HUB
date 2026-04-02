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
    initSkillAutocomplete();

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

    // Logout Button
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch((err) => {
            console.error('Logout error:', err);
            alert('Failed to log out. Please try again.');
        });
    });
});

let pendingCoverFile = null;
let pendingAvatarFile = null;

// Compression Utility for images (to confidently avoid Firestore 1MB limits)
function compressImage(file, maxWidth, maxHeight, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
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
        reader.onload = function (event) {
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
        reader.onload = function (event) {
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
let userTop3Skills = []; // User-selected top 3 skills

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
            github: "",
            linkedin: "",
            top3_skills: []
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
        if (document.getElementById('input-linkedin')) {
            document.getElementById('input-linkedin').value = userData.linkedin || '';
        }

        // Populate Skills Map
        if (userData.skills) {
            userSkillsMap = userData.skills;
        }

        // Load user-selected Top 3 Skills
        if (Array.isArray(userData.top3_skills)) {
            userTop3Skills = userData.top3_skills;
        }

        renderSkillTags();

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
        linkedin: document.getElementById('input-linkedin') ? document.getElementById('input-linkedin').value.trim() : '',
        skills: userSkillsMap,
        top3_skills: userTop3Skills,
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
 * ─────────────────────────────────────────────
 * COMPREHENSIVE SKILLS DATABASE (LinkedIn-style)
 * ─────────────────────────────────────────────
 */
const SKILLS_DATABASE = {
    "Languages": [
        "HTML", "HTML5", "CSS", "CSS3", "JavaScript", "TypeScript", "Python", "Java", "C", "C++",
        "C#", "Go", "Golang", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Dart", "Scala",
        "Perl", "R", "MATLAB", "Lua", "Haskell", "Elixir", "Erlang", "Clojure", "Julia",
        "Shell Scripting", "Bash", "PowerShell", "Assembly", "VHDL", "Verilog", "SQL", "PL/SQL",
        "Objective-C", "Groovy", "F#", "COBOL", "Fortran", "Solidity"
    ],
    "Frontend": [
        "React", "React.js", "React Native", "Next.js", "Vue.js", "Vue 3", "Nuxt.js",
        "Angular", "AngularJS", "Svelte", "SvelteKit", "Ember.js", "Gatsby", "Astro",
        "jQuery", "Bootstrap", "Tailwind CSS", "Material UI", "Chakra UI", "Ant Design",
        "Sass", "SCSS", "Less", "Styled Components", "CSS Modules", "PostCSS",
        "Webpack", "Vite", "Parcel", "Rollup", "Babel", "ESLint", "Prettier",
        "Redux", "Zustand", "MobX", "Recoil", "Pinia", "Vuex",
        "Three.js", "D3.js", "Chart.js", "Framer Motion", "GSAP", "Lottie",
        "Storybook", "Figma", "Adobe XD", "Sketch", "Responsive Design", "PWA",
        "Web Accessibility", "SEO", "Web Performance", "Web Components"
    ],
    "Backend": [
        "Node.js", "Express.js", "NestJS", "Fastify", "Koa", "Hapi",
        "Django", "Flask", "FastAPI", "Tornado", "Pyramid",
        "Spring Boot", "Spring Framework", "Hibernate", "JPA",
        "Ruby on Rails", "Sinatra", "Laravel", "Symfony", "CodeIgniter",
        "ASP.NET", "ASP.NET Core", ".NET", "Entity Framework",
        "GraphQL", "Apollo", "REST API", "WebSocket", "gRPC", "tRPC",
        "Microservices", "Serverless", "OAuth", "JWT", "API Design",
        "Nginx", "Apache", "Caddy", "Load Balancing"
    ],
    "Database": [
        "MySQL", "PostgreSQL", "MongoDB", "SQLite", "MariaDB", "Oracle DB",
        "Microsoft SQL Server", "Redis", "Memcached", "Cassandra", "CouchDB",
        "DynamoDB", "Firebase Firestore", "Firebase Realtime Database",
        "Supabase", "PlanetScale", "Neo4j", "InfluxDB", "Elasticsearch",
        "Prisma", "Sequelize", "Mongoose", "TypeORM", "Drizzle",
        "Database Design", "Data Modeling", "SQL Optimization"
    ],
    "Cloud & DevOps": [
        "AWS", "Amazon Web Services", "Azure", "Google Cloud Platform", "GCP",
        "Firebase", "Heroku", "Vercel", "Netlify", "DigitalOcean", "Cloudflare",
        "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions",
        "CI/CD", "GitLab CI", "CircleCI", "Travis CI", "ArgoCD",
        "Linux", "Ubuntu", "CentOS", "DevOps", "SRE", "Infrastructure as Code",
        "Prometheus", "Grafana", "ELK Stack", "Datadog", "New Relic",
        "AWS Lambda", "AWS EC2", "AWS S3", "Azure Functions", "Cloud Functions"
    ],
    "Mobile": [
        "Android Development", "iOS Development", "Flutter", "React Native",
        "SwiftUI", "Jetpack Compose", "Xamarin", "Ionic", "Capacitor",
        "Expo", "Mobile UI/UX", "App Store Optimization", "Push Notifications",
        "ARKit", "ARCore", "Core Data", "Room Database", "Retrofit"
    ],
    "AI & ML": [
        "Machine Learning", "Deep Learning", "Artificial Intelligence", "Neural Networks",
        "TensorFlow", "PyTorch", "Keras", "Scikit-learn", "OpenCV",
        "Natural Language Processing", "NLP", "Computer Vision", "Reinforcement Learning",
        "Generative AI", "LLM", "GPT", "BERT", "Transformer Models",
        "Pandas", "NumPy", "SciPy", "Matplotlib", "Seaborn", "Plotly",
        "Hugging Face", "LangChain", "RAG", "Prompt Engineering",
        "Data Science", "Data Analysis", "Feature Engineering", "Model Deployment",
        "MLOps", "Jupyter Notebook", "Google Colab", "Kaggle"
    ],
    "Cybersecurity": [
        "Cybersecurity", "Ethical Hacking", "Penetration Testing", "Network Security",
        "OWASP", "Cryptography", "Encryption", "SSL/TLS", "Firewalls",
        "Vulnerability Assessment", "Security Auditing", "SIEM", "SOC",
        "Malware Analysis", "Reverse Engineering", "Bug Bounty",
        "Information Security", "Identity Management", "Zero Trust"
    ],
    "Blockchain & Web3": [
        "Blockchain", "Ethereum", "Solidity", "Smart Contracts", "Web3.js",
        "Ethers.js", "Hardhat", "Truffle", "IPFS", "DeFi",
        "NFT", "Cryptocurrency", "Hyperledger", "Polygon", "Solana",
        "Consensus Algorithms", "Tokenization", "DAO", "Metaverse"
    ],
    "Tools & Platforms": [
        "Git", "GitHub", "GitLab", "Bitbucket", "SVN",
        "VS Code", "IntelliJ IDEA", "Eclipse", "Android Studio", "Xcode",
        "Postman", "Insomnia", "Swagger", "Jira", "Trello", "Notion",
        "Slack", "Microsoft Teams", "Confluence", "Figma",
        "Linux CLI", "Vim", "Emacs", "Terminal", "WSL"
    ],
    "Data Engineering": [
        "Apache Spark", "Apache Kafka", "Apache Airflow", "Apache Flink",
        "Hadoop", "MapReduce", "Hive", "Pig", "ETL",
        "Data Warehousing", "Data Pipelines", "Data Lake", "Big Data",
        "Snowflake", "Databricks", "dbt", "Apache Beam"
    ],
    "Testing & QA": [
        "Unit Testing", "Integration Testing", "End-to-End Testing",
        "Jest", "Mocha", "Chai", "Cypress", "Selenium", "Playwright",
        "JUnit", "TestNG", "pytest", "Robot Framework",
        "Test Driven Development", "TDD", "BDD", "Load Testing",
        "Performance Testing", "API Testing", "Manual Testing", "QA Automation"
    ],
    "Design & UX": [
        "UI Design", "UX Design", "UI/UX", "User Research", "Wireframing",
        "Prototyping", "Design Thinking", "Figma", "Adobe XD", "Sketch",
        "Adobe Photoshop", "Adobe Illustrator", "Adobe After Effects",
        "Canva", "Blender", "3D Modeling", "Motion Graphics",
        "Typography", "Color Theory", "Interaction Design", "Design Systems"
    ],
    "Soft Skills": [
        "Problem Solving", "Critical Thinking", "Communication", "Teamwork",
        "Leadership", "Time Management", "Agile", "Scrum", "Kanban",
        "Project Management", "Public Speaking", "Technical Writing",
        "Mentoring", "Collaboration", "Adaptability", "Creativity"
    ],
    "IoT & Embedded": [
        "IoT", "Internet of Things", "Arduino", "Raspberry Pi", "ESP32", "ESP8266",
        "Embedded Systems", "Embedded C", "RTOS", "Microcontrollers",
        "Sensor Integration", "MQTT", "Zigbee", "LoRa", "BLE",
        "PCB Design", "Circuit Design", "Signal Processing", "Robotics",
        "ROS", "Drone Programming", "PLC Programming"
    ]
};

// Flatten the skills database for quick searching
const ALL_SKILLS = [];
for (const [category, skills] of Object.entries(SKILLS_DATABASE)) {
    for (const skill of skills) {
        ALL_SKILLS.push({ name: skill, category });
    }
}

// Category color map for icons
const CATEGORY_COLORS = {
    "Languages": "#e11d48",
    "Frontend": "#2563eb",
    "Backend": "#16a34a",
    "Database": "#d97706",
    "Cloud & DevOps": "#7c3aed",
    "Mobile": "#06b6d4",
    "AI & ML": "#ec4899",
    "Cybersecurity": "#dc2626",
    "Blockchain & Web3": "#8b5cf6",
    "Tools & Platforms": "#64748b",
    "Data Engineering": "#0891b2",
    "Testing & QA": "#65a30d",
    "Design & UX": "#f43f5e",
    "Soft Skills": "#0ea5e9",
    "IoT & Embedded": "#059669"
};

let acHighlightIndex = -1;
let acFilteredItems = [];

/**
 * Handle keyboard input for skills (Enter, Comma, Arrow Keys)
 */
function handleSkillTagEvent(e) {
    const dropdown = document.getElementById('skillsAutocomplete');

    // Arrow key navigation in dropdown
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (acFilteredItems.length > 0) {
            acHighlightIndex = Math.min(acHighlightIndex + 1, acFilteredItems.length - 1);
            updateHighlight();
        }
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (acFilteredItems.length > 0) {
            acHighlightIndex = Math.max(acHighlightIndex - 1, 0);
            updateHighlight();
        }
        return;
    }

    // Enter or comma to add skill
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();

        // If a dropdown item is highlighted, use that
        if (acHighlightIndex >= 0 && acFilteredItems[acHighlightIndex]) {
            const selected = acFilteredItems[acHighlightIndex];
            addSkill(selected.name.toLowerCase());
        } else {
            // Else use whatever is typed
            const rawValue = e.target.value.trim().toLowerCase();
            if (rawValue !== "") {
                addSkill(rawValue);
            }
        }
        e.target.value = '';
        hideAutocomplete();
        return;
    }

    // Escape to close dropdown
    if (e.key === 'Escape') {
        hideAutocomplete();
        return;
    }
}

function addSkill(skillName) {
    if (!userSkillsMap[skillName]) {
        userSkillsMap[skillName] = true;
        renderSkillTags();
    }
}

/**
 * Initialize autocomplete on the skill input
 */
function initSkillAutocomplete() {
    const input = document.getElementById('skillInput');
    if (!input) return;

    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'skills-autocomplete';
    dropdown.id = 'skillsAutocomplete';
    document.getElementById('skillTagsContainer').appendChild(dropdown);

    // Listen for typing
    input.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val.length === 0) {
            hideAutocomplete();
            return;
        }
        filterAndShowSuggestions(val);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.skills-input-wrapper')) {
            hideAutocomplete();
        }
    });

    // Show suggestions on focus if there's text
    input.addEventListener('focus', () => {
        const val = input.value.trim().toLowerCase();
        if (val.length > 0) {
            filterAndShowSuggestions(val);
        }
    });
}

function filterAndShowSuggestions(query) {
    const dropdown = document.getElementById('skillsAutocomplete');
    if (!dropdown) return;

    // Filter skills matching the query
    acFilteredItems = ALL_SKILLS.filter(s =>
        s.name.toLowerCase().includes(query)
    ).slice(0, 25); // Cap at 25 results

    acHighlightIndex = -1;

    if (acFilteredItems.length === 0) {
        dropdown.innerHTML = `<div class="skills-ac-item" style="color: #94a3b8; pointer-events:none; justify-content:center; font-style:italic;">
            Press Enter to add "${query}" as a custom skill
        </div>`;
        dropdown.classList.add('visible');
        return;
    }

    // Group by category
    let html = '';
    let lastCategory = '';

    acFilteredItems.forEach((item, i) => {
        if (item.category !== lastCategory) {
            html += `<div class="skills-ac-category">${item.category}</div>`;
            lastCategory = item.category;
        }

        const isAdded = userSkillsMap[item.name.toLowerCase()] === true;
        const color = CATEGORY_COLORS[item.category] || '#64748b';

        // Highlight matching portion
        const lowerName = item.name.toLowerCase();
        const matchIdx = lowerName.indexOf(query);
        let displayName;
        if (matchIdx >= 0) {
            const before = item.name.substring(0, matchIdx);
            const match = item.name.substring(matchIdx, matchIdx + query.length);
            const after = item.name.substring(matchIdx + query.length);
            displayName = `<span class="ac-rest">${before}</span><span class="ac-match">${match}</span><span class="ac-rest">${after}</span>`;
        } else {
            displayName = `<span class="ac-rest">${item.name}</span>`;
        }

        html += `<div class="skills-ac-item${isAdded ? ' ac-added' : ''}" data-index="${i}">
            <span class="ac-icon" style="background:${color}">${item.name.charAt(0).toUpperCase()}</span>
            <span>${displayName}</span>
        </div>`;
    });

    dropdown.innerHTML = html;
    dropdown.classList.add('visible');

    // Click handler on items
    dropdown.querySelectorAll('.skills-ac-item:not(.ac-added)').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-index'));
            if (acFilteredItems[idx]) {
                addSkill(acFilteredItems[idx].name.toLowerCase());
                document.getElementById('skillInput').value = '';
                hideAutocomplete();
                document.getElementById('skillInput').focus();
            }
        });
    });
}

function updateHighlight() {
    const dropdown = document.getElementById('skillsAutocomplete');
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.skills-ac-item:not(.ac-added)');
    let realIndex = 0;
    dropdown.querySelectorAll('.skills-ac-item').forEach(el => {
        el.classList.remove('highlighted');
        if (!el.classList.contains('ac-added')) {
            if (realIndex === acHighlightIndex) {
                el.classList.add('highlighted');
                el.scrollIntoView({ block: 'nearest' });
            }
            realIndex++;
        }
    });
}

function hideAutocomplete() {
    const dropdown = document.getElementById('skillsAutocomplete');
    if (dropdown) {
        dropdown.classList.remove('visible');
    }
    acHighlightIndex = -1;
    acFilteredItems = [];
}

/**
 * Refresh visual skill nodes from the HashMap
 */
function renderSkillTags() {
    const container = document.getElementById('skillTagsContainer');

    // Clear old tags (but keep the input box and autocomplete dropdown)
    document.querySelectorAll('.skill-tag').forEach(el => el.remove());

    const inputNode = document.getElementById('skillInput');
    if (!inputNode) return;

    // Create a new pill for every true key in the map
    Object.keys(userSkillsMap).forEach(skill => {
        if (userSkillsMap[skill] === true) {
            const tag = document.createElement('span');
            tag.className = 'skill-tag';
            const isTop = userTop3Skills.includes(skill);
            tag.innerHTML = `${isTop ? '<i class="fa-solid fa-star" style="font-size: 10px; color: #f59e0b; margin-right: 3px;"></i>' : ''}${skill} <i class="fa-solid fa-xmark" aria-hidden="true"></i>`;
            if (isTop) {
                tag.style.background = 'rgba(245,158,11,0.15)';
                tag.style.border = '1px solid rgba(245,158,11,0.4)';
            }
            tag.style.cursor = 'pointer';

            // Click tag to toggle top 3 selection
            tag.addEventListener('click', (e) => {
                // Don't toggle if clicking the X delete button
                if (e.target.classList.contains('fa-xmark')) return;
                toggleTop3Skill(skill);
            });

            // Allow deletion via X icon
            tag.querySelector('.fa-xmark').addEventListener('click', (e) => {
                e.stopPropagation();
                delete userSkillsMap[skill];
                // Also remove from top 3 if present
                userTop3Skills = userTop3Skills.filter(s => s !== skill);
                renderSkillTags();
            });

            container.insertBefore(tag, inputNode);
        }
    });

    // Update Top 3 Skills display
    updateTop3Display();
}

/**
 * Toggle a skill in/out of the top 3 selection
 */
function toggleTop3Skill(skill) {
    const idx = userTop3Skills.indexOf(skill);
    if (idx >= 0) {
        // Remove from top 3
        userTop3Skills.splice(idx, 1);
    } else {
        // Add to top 3 (max 3)
        if (userTop3Skills.length >= 3) {
            alert('You can select at most 3 top skills. Remove one first.');
            return;
        }
        userTop3Skills.push(skill);
    }
    renderSkillTags();
}

/**
 * Update the Top 3 Technical Skills display
 */
function updateTop3Display() {
    const display = document.getElementById('top3SkillsDisplay');
    if (!display) return;

    if (userTop3Skills.length === 0) {
        display.innerHTML = '<span class="text-muted" style="font-size: 0.85rem;">Click a skill above to mark it as a top skill.</span>';
        return;
    }

    display.innerHTML = userTop3Skills.map(skill =>
        `<span style="background: rgba(245,158,11,0.1); color: #b45309; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1px solid rgba(245,158,11,0.2); cursor: pointer; transition: opacity 0.2s;"
              onclick="document.dispatchEvent(new CustomEvent('removeTop3', {detail: '${skill}'}))"
              onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
            <i class="fa-solid fa-star" style="font-size: 10px; margin-right: 4px;"></i>${skill}
            <i class="fa-solid fa-xmark" style="font-size: 10px; margin-left: 6px; opacity: 0.6;"></i>
        </span>`
    ).join('');
}

// Listen for remove top 3 events from the display pills
document.addEventListener('removeTop3', (e) => {
    const skill = e.detail;
    userTop3Skills = userTop3Skills.filter(s => s !== skill);
    renderSkillTags();
});