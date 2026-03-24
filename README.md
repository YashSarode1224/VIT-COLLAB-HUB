# VIT Collab Hub

VIT Collab Hub is a centralized platform designed for college students, mentors, and clubs to seamlessly collaborate on projects, host hackathons, and connect with peers based on skills and experience.

## ✨ Features

- **Role-Based Workspaces**: Dedicated hubs tailored for Students, Admins (Mentors/Professors), and Club Executives.
- **Team Matchmaking**: Browse members by skills, view their completed projects, and send invites to form teams.
- **Real-time Project Workspaces**: Live Team Chat and drag-and-drop Kanban Task Boards powered by Firebase.
- **Direct Messaging System**: An Instagram-style inbox for 1-on-1 private messaging among students and mentors.
- **Hackathon Management**: Dedicated workflow for clubs to create events, review PPT submissions, and advance teams through rounds.
- **Secure File Uploads**: Upload code ZIPs or PPTs securely via Firebase Cloud Storage (up to 10MB limits).
- **Automated Rating System**: Mentors can review completed projects and rate teams, automatically updating student profiles.

## 🏗️ Architecture Stack

This project is built to be extremely fast, scalable, and **100% Free** (running on the Firebase Spark Plan). 

- **Frontend**: Plain HTML, Vanilla CSS, and Vanilla JavaScript.
- **Authentication**: Firebase Authentication (Email/Password).
- **Database**: Cloud Firestore (NoSQL, optimized with map indexing and cursor pagination).
- **Storage**: Firebase Cloud Storage (Secured with `.zip`, `.ppt`, `.pdf` MIME rules).
- **Hosting**: Firebase Hosting.

## 🚀 Getting Started

### Prerequisites
- A Firebase Project (Free Spark Plan)
- Node.js & npm (if you intend to use Firebase CLI for deployment)
- A local server environment (like Live Server in VS Code)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/vit-collab-hub.git
   cd vit-collab-hub
   ```

2. **Firebase Setup:**
   - Create a project on the [Firebase Console](https://console.firebase.google.com/).
   - Enable **Authentication** (Email/Password).
   - Enable **Firestore Database** and **Cloud Storage**.
   - Copy your Firebase config object.

3. **Configure the App:**
   - Create/open `js/firebase-config.js`.
   - Paste your Firebase configuration keys into the initialization object.

4. **Security Rules Setup:**
   - Navigate to the **Rules** tab in your Firestore and Cloud Storage console.
   - Deploy the custom security rules ensuring strict role-based access control (e.g., only clubs can approve hackathon applications, only admins can finalize ratings).

5. **Run Locally:**
   - Open the directory with your preferred local web server (e.g., Live Server plugin).
   - Navigate to `index.html` (or your preferred login page) to start testing.

## 📂 Project Structure

```text
vit-collab-hub/
│
├── css/
│   ├── global.css          # Base layout, top navbars, and typography
│   ├── dashboard.css       # Layouts for central hubs
│   ├── workspace.css       # Kanban drag-and-drop styling
│   ├── hackathon.css       # Modals and approval tables
│   └── chat.css            # Chat bubbles and inbox view
│
├── js/
│   ├── firebase-config.js  # Firebase setup and offline persistence
│   ├── auth.js             # Route guarding and Auth state
│   ├── student-dashboard.js
│   ├── admin-dashboard.js
│   ├── club-dashboard.js
│   ├── project-workspace.js # Real-time tasks and team chat
│   ├── hackathon-workspace.js 
│   └── inbox.js             # Personal 1-on-1 messaging logic
│
├── index.html               # Main landing/login router
├── student-dashboard.html 
├── admin-dashboard.html 
├── club-dashboard.html 
├── project-workspace.html 
├── hackathon-workspace.html 
└── inbox.html               
```

## 🔒 Security

This platform relies on strict **Firebase Security Rules** to handle access control securely without a backend server:
- Only team members can read/write to their project workspaces.
- Maximum team limits are validated by Array matching rules before data writes.
- Role immutability protects users from self-assigning "Admin" status.

## 🛠️ Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

