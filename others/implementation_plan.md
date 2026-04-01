# VIT Collab Hub Architecture & Implementation Plan

Based on your initial requirements and subsequent feedback on scalability and security, here is the complete, production-ready implementation plan for the VIT Collab Hub platform.

## 1. System Architecture & Access Control

- **Frontend**: Plain HTML, CSS, and Vanilla JavaScript.
- **Backend/Routing State**: Firebase Authentication + `onAuthStateChanged()`.
- **Database/Scaling**: Firebase Cloud Firestore with native Pagination handling.
- **Storage**: Firebase Cloud Storage for PPTs/Code ZIPs.
  - **Storage Security Rules**: Uploads will be strictly validated via Security Rules. Files must be `≤ 10MB` and match explicitly allowed MIME types (e.g., application/zip, application/vnd.ms-powerpoint).
  - **Storage Path Isolation**: To prevent malicious overwrites, users can only upload files to a project directory if they belong to that project. Rule: `allow write: if request.auth != null && firestore.get(/databases/(default)/documents/projects/$(projectId)).data.team_members.hasAny([request.auth.uid]);`
- **Hosting**: Firebase Hosting (100% Free on Spark Plan). No Cloud Functions required.

### Firebase Security Rules (Crucial for Production)
We will strictly enforce database permissions via Security Rules and Firebase Custom Claims to prevent manual tampering (like Role Escalation).
- **Rule - Student Profile**: `allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['role']) == false;` (Ensures students cannot change `role: "admin"` on the client).
- **Rule - Hackathon Approvals**: `allow write: if request.auth.token.role == "club";`
- **Rule - Project Completions**: `allow update: if request.auth.token.role == "admin";`
- Only participants referenced in a `team_members` array can access or write to that project's chat and code sub-collections.

## 2. Authentication & User Profiles

We integrate with your existing role-specific login pages, linking them directly to Firebase Authentication.

### Profile Data Structure & Query Optimization
*(Stored in Firestore `users`)*
- `uid`, `role`, `email`, `name`
- **For Fast Indexing / Searching**: Instead of large arrays, we will structure `skills` as a map (`{ "react": true, "node": true }`) to allow extremely fast `where("skills.react", "==", true)` client-side searching.
- *(Student)*: `branch`, `block`, `registration_number`, `skills` (Map), `completed_projects`, `total_stars`, `total_reviews` (Client calculates `average_rating` on read)
- *(Admin)*: `school_name` | *(Club)*: `branch`, `club_name`

## 3. Database Schema Updates for Scale

### `projects`
- `status` (`pending_team` -> `pending_mentor` -> `ongoing` -> `completed`)
- **`visibility`** (`public` | `private`): Controls if it shows up in the Browse Projects list for others to request to join.
- `team_members` (Array of uids).
- `project_submissions` (Sub-Collection) - Each time a team submits code (GitHub URL or ZIP upload), a new document is created with a `timestamp`. This creates **submission tracking and version history** without overwriting old links.
- **Completion**: The Admin reviews the submitted code and clicks **"Mark as Complete"**.
- **Stars Workflow (Math on Read)**: A modal prompts the Admin to rate students (1-5 stars). The `admin-dashboard.js` securely appends the score to `total_stars` and increments `total_reviews`. To prevent client manipulation, the actual average rating is **never stored** but simply calculated (`total_stars / total_reviews`) by the Frontend whenever a profile is fetched.
- **Cascading Deletes (Client-Side)**: To prevent permanent "orphan data" (since we lack Cloud Functions), project deletion requires a strict JavaScript transaction sequence. Before deleting a project document, the client logic must sequentially delete: (1) All documents in `project_chats`, (2) All versioned files in Firebase Cloud Storage, (3) All documents in `project_submissions`, and only then (4) Delete the parent project document.

### `hackathons`
- Includes checking timestamps before write: rules mapping `deadline_date`.
- Limit duplicate team entries using compound document IDs in the `applications` sub-collection (`hackathonID_teamID`).

### `notifications`
- Triggered by client-side JavaScript writing to the collection.
- **Rule - Spam Prevention**: `allow write: if request.auth.uid == request.resource.data.user_id;` (This guarantees that malicious users cannot spam push notifications to hundreds of random database IDs).
- Structure: `{ user_id, type, message, is_read: false, created_at, action_url }`.
- Client listens via real-time `.onSnapshot()` to trigger UI toasts securely.

### Chat System (`project_chats` & `conversations`)
- All chat components will aggressively limit query loads using `.limit(50)` and `.orderBy("timestamp", "desc")`. We will only load older messages using `.startAfter(finalVisibleDoc)` when the user scrolls, keeping chats blazing-fast regardless of history length.

## 4. Feature Implementation Strategy

### A. Routing & UI Navigation Flow (Top Navbar)
- **Top Navigation Bar**: Instead of a sidebar, the main navigation for all roles will be a persistent Top Navbar across all pages.
  - *Student Navbar*: Dashboard (Home) | Profile | Join Hackathon | Browse Members
  - *Admin Navbar*: Dashboard (Home) | Browse Members
  - *Club Navbar*: Dashboard (Home) | Create Hackathon
- **Auth Guarding**: Handled via Vanilla JS `window.location.href`. Every HTML page is protected by an `auth.js` interceptor script on load to prevent unauthorized access.

### B. Dashboard Hubs (The Main Feed)
- When a user logs in, they are immediately redirected to their respective Dashboard. This acts as a central hub:
  - **Student Dashboard**: Shows a summary feed of their active projects, pending team invitations, and a list of upcoming/active Hackathons they can join.
  - **Admin Dashboard**: Shows a summary feed of their mentored projects and pending mentor requests.
  - **Club Dashboard**: Shows a summary feed of the Hackathons they are actively running.

### C. Team Creation & "Join Team" Flow
- **Creation**: A student creates a project and becomes the "Team Leader".
- **Inviting Members**: The leader can search members to send "Team Invites".
- **Requesting to Join**: From the Browse Members or Project feed, a student can click **"Request to Join"** on an existing **public** project. 
  - *Notification Logic*: This pushes a `join_request` notification to the Team Leader. If the leader accepts, a `request_accepted` notification goes back to the requesting student.
  - *Security Rule*: `allow create: if !request.resource.data.team_members.hasAny([request.auth.uid]);` (Guarantees users can't spam requests or request to join teams they are already actively in).
- **Max Team Limit**: Maximum limit enforcement is configured natively via **Firestore Security Rules** before allowing any array updates.

### D. File Uploads, Fallbacks, & UI/UX States
- **Offline/Network Handling**: Firebase Web SDK enables offline cache persistence natively. If students are disconnected, the UI will cache their task movements or chat logs and automatically push them when reconnecting. 
- **Error Handling**: Every fetch, load, and Storage Upload (like submitting a ZIP or Hackathon PPT) will be wrapped in robust `try/catch` handlers mapping to user-friendly **Toast Alerts** (Error/Success), paired with Skeleton Loaders / Spinners during heavy writes.

### E. Inbox / Personal Messaging System
- Global `inbox.html` view where students chat privately 1-on-1 (Student ↔ Student) or (Student ↔ Admin).

### F. Browse Members & Infinite Scroll
- The user directory will NOT load 1000+ users at once. It will load `limit(20)`. When the user reaches the bottom of the browse list, we fire a `startAfter()` query to paginate the next chunk.

### G. Club & Hackathon Management Workflow
- Club creates Hackathon (defines deadlines).
- Teams apply (Modal: Leader Reg Number, Member Reg Numbers, PPT Storage Upload Link).
- Separate [hackathon-workspace.html](file:///d:/PROJECTS/VIT%20COLLAB%20HUB/html/hackathon-workspace.html) for Clubs to manage accept/decline workflows, ensuring maximum scale and UI separation from standard student projects.

### H. Campus Leaderboard & Hall of Fame
- **Gamification**: Leveraging the calculated `total_stars` and `completed_projects` metrics to introduce friendly competition.
- **Workflow**: Add a "Leaderboard" tab to the Student Dashboard. Query the `users` collection, order by `total_stars` descending, limit to 10, and display the top-rated developers on campus.

### I. Shared Calendar (Events, Deadlines & Meeting Scheduling)
- **Per-Project Calendar**: Each `project-workspace.html` will include a dedicated Calendar tab where team members can create, view, and manage events scoped to their project.
- **Event Types**: `deadline` (auto-synced from hackathon `deadline_date`), `meeting` (scheduled by any team member), and `milestone` (set by the Team Leader).
- **Firestore Schema** (`projects/{projectId}/calendar_events` sub-collection):
  - `{ event_id, title, type, date, time, created_by, attendees[] (uids), description, created_at }`
- **Meeting Scheduling**: Any team member can propose a meeting. A `meeting_proposed` notification is pushed to all `attendees`. Attendees can RSVP (`attending` | `declined`), with their response stored in the event document.
- **UI**: A lightweight month/week grid rendered in Vanilla JS (no external calendar library). Clicking a date opens a modal to create an event. Upcoming events are also surfaced as a widget on the Student Dashboard sidebar.
- **Security Rule**: `allow write: if request.auth.uid in resource.data.team_members;` — only project members can create or modify calendar events.

### J. File & Resource Sharing with Version History
- **Project Resource Library**: A dedicated "Resources" tab inside `project-workspace.html` for sharing files beyond code submissions (e.g., design mockups, research docs, reference PDFs).
- **Upload Flow**: Files are uploaded to Firebase Cloud Storage under the path `projects/{projectId}/resources/{filename}_{timestamp}`. The timestamp suffix ensures no file is ever silently overwritten.
- **Firestore Schema** (`projects/{projectId}/resources` sub-collection):
  - `{ file_id, file_name, storage_url, uploaded_by, uploaded_at, version_label (e.g. "v1", "v2"), file_size, mime_type }`
- **Version History UI**: Files with the same `file_name` are grouped in an expandable accordion. Clicking "History" reveals all prior versions with their upload timestamp and uploader name, allowing any team member to download any past version.
- **Security Rules**: Files can only be uploaded/deleted by project members. Storage rules mirror the existing project-based isolation rules (check `team_members` array via `firestore.get()`).
- **File Type Restrictions**: Allowed MIME types enforced via Storage Security Rules — `image/*`, `application/pdf`, `application/zip`, `text/*`, `application/vnd.ms-*`.
- **Storage Cleanup**: When a project is deleted, the client-side cascading delete sequence (from Section 3) will be extended to also delete all files under `projects/{projectId}/resources/`.

### K. GitHub Integration (Repo Linking, Commit & PR Activity Sync)
- **Repo Linking**: Team Leaders can link a GitHub repository URL to their project. The URL is stored in the `projects` document as `github_repo_url`.
- **Activity Feed via GitHub REST API**: The project workspace will display a live activity feed of recent commits and pull requests by fetching from the public GitHub REST API (`https://api.github.com/repos/{owner}/{repo}/events`) — no OAuth required for public repos.
  - For private repos, we will guide users to generate a Personal Access Token (PAT), stored temporarily in `sessionStorage` (never in Firestore) and passed as a `Bearer` header.
- **UI Widget**: A "GitHub Activity" tab inside `project-workspace.html` renders the last 10 events (commits, PRs, issues) in a timeline card layout showing the actor avatar, event type badge, short description, and relative timestamp.
- **PR Status Tracking**: Open Pull Requests are surfaced separately with their status (`open` | `merged` | `closed`) so the team can track code review progress at a glance.
- **Commit Pinning**: Team members can pin a specific commit SHA as a "milestone" to the calendar (bridging Features I and K), automatically creating a `milestone` calendar event with the commit message as the title.
- **Rate Limiting**: The GitHub REST API allows 60 unauthenticated requests/hour per IP. To avoid hitting limits, activity is fetched once on tab open and cached in `sessionStorage` for 5 minutes before re-fetching.

## 5. Project File Structure (HTML, CSS, JS)

We will need **21 core files**.

### Pre-existing Integration Files
- [login.html](file:///d:/PROJECTS/VIT%20COLLAB%20HUB/html/login.html) (Consolidated Authentication Gateway)

### New HTML Pages
1. `student-profile-setup.html` | `admin-profile-setup.html` | [club-profile-setup.html](file:///d:/PROJECTS/VIT%20COLLAB%20HUB/html/club-profile-setup.html)
4. `student-dashboard.html`: The central hub showing active projects, pending invites, and active hackathons.
5. `admin-dashboard.html`: The central hub showing mentor requests and active mentored projects.
6. [club-dashboard.html](file:///d:/PROJECTS/VIT%20COLLAB%20HUB/html/club-dashboard.html): The central hub showing created hackathons and approvals.
7. `project-workspace.html`: Team Chat | Task Board | Versioned Submissions | Manage Join Requests (Leader Only)
8. [hackathon-workspace.html](file:///d:/PROJECTS/VIT%20COLLAB%20HUB/html/hackathon-workspace.html): Approve Teams | Manage Rounds (PPTs)
9. `browse-members.html`: Shared view for searching/filtering users.
10. `inbox.html`: Personal Direct Messages

### CSS Styling (`/css/`)
11. `global.css` (Contains Top Navbar styling & shared variables `primary-blue: #0d6efd`, `cyan-accent: #0dcaf0`). **CRITICAL RULE**: Every page on this platform MUST use the styling principles defined in your `login.css` (e.g., Poppins font, clean border-radius cards with subtle drop shadows, and the distinct blue-gradient header).
12. `dashboard.css` | 13. `workspace.css` | 14. `hackathon.css` | 15. `chat.css`

### JavaScript Logic (`/js/`)
15. `firebase-config.js`: Initializes Firebase `db`, `auth`, `storage`, and handles offline flags.
16. `auth.js`: Profile routing and `window.location.href` guards.
17. `student-dashboard.js`: Fetching projects, searching indexed members/skills, error-handled Storage uploads.
18. `admin-dashboard.js`: Ratings modal, completions, security-enforced approvals.
19. `club-dashboard.js`: Hackathon logic, deadlines.
20. `hackathon-workspace.js`: Fetching applications, fetching PPT URLs from Storage.
21. `project-workspace.js` & `inbox.js`: Real-time chat paginations, tasks.
