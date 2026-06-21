# 📚 NovelNest

## 🎯 Project Overview

NovelNest is a full-featured role-based digital publishing platform built for readers, authors, and administrators. It combines novel publishing, content moderation, reading progress tracking, community interaction, and real-time platform management into a single application.

![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

---

## ✨ Key Features

### 🔐 Role-Based Access Control (RBAC)

#### 👑 Super Admin
- Full oversight of the platform
- Manage library
- Approve or reject book publications
- Manage author requests
- Monitor platform statistics

#### ✍️ Author
- Upload novels (PDFs and cover images)
- Manage personal library
- Edit book details
- Update assignment completion status

#### 📖 User / Reader
- Browse published books
- Search and filter novels by genre
- Read novels online
- Request books to be added to the platform

---

## 🛠️ Core Functionality

### 🔍 Live Search & Filtering
- Dynamic search bar
- Genre filtering (Fantasy, Romance, Thriller, Sci-Fi, etc.)
- Instant book discovery

### 🔔 Real-Time Notifications
- Alerts for new book requests
- Notifications for novel submissions
- Flagged content monitoring
- Live admin dashboard updates

### 📝 Author Assignments
- Admins can assign writing prompts
- Authors can track assigned tasks
- Completion status management

### 👤 Profile Management
- Custom avatars
- Personalized nicknames
- User profile customization

### ☁️ Soft Uploads & Library Management
- Upload PDF novels
- Upload cover images
- Cloud-based storage integration

---

## 💻 Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- React Router DOM
- Lucide React
- React Hot Toast

### Backend as a Service (BaaS)

#### Supabase
- PostgreSQL Database
- Supabase Authentication
- Supabase Storage
- Supabase Realtime

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <img width="1918" height="1020" alt="image" src="https://github.com/user-attachments/assets/5536af71-fb08-4203-8d7a-ecc6fda3cc01" />
      <b>Home Page</b>
    </td>
    <td align="center">
      <img width="1918" height="972" alt="image" src="https://github.com/user-attachments/assets/fa5e8fca-4fb4-4ffc-a144-f82d01a53a5f" />
      <b>Library View</b>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img width="1917" height="966" alt="image" src="https://github.com/user-attachments/assets/72bb3e80-a0d8-43d0-ad73-4c473148faf0" />
      <b>Admin Dashboard</b>
    </td>
    <td align="center">
      <img width="1918" height="967" alt="image" src="https://github.com/user-attachments/assets/dad31cbd-9e99-4a4f-b751-839e4f59a597" />
      <b>Admin Workspace</b>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img width="1918" height="962" alt="image" src="https://github.com/user-attachments/assets/97c969de-3cdd-47cf-b85e-08e0cc567420" />
      <b>Author Workspace</b>
    </td>
    <td align="center">
      <img width="1918" height="965" alt="image" src="https://github.com/user-attachments/assets/52408ed0-2d20-48ab-94e4-34c5aad5050b" />
      <b>User's Home Page</b>
    </td>
  </tr>
</table>

---

## Links

#### Github : https://github.com/k-madhumithaa/NovelNest
#### Live Demo: https://novelnestlibraryy.netlify.app/

---

## 🚀 Local Setup & Installation

### Prerequisites

- Node.js installed on your machine
- A Supabase project configured with the required tables:
  - profiles
  - novels
  - book_requests
  - admin_requests
  - author_assignments
  - reviews

### 1. Clone the Repository

```bash
git clone https://github.com/k-madhumithaa/NovelNest.git
cd NovelNest
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run the Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## 📂 Database Schema Overview

| Table | Purpose |
|---------|---------|
| **profiles** | Stores user information, profile details, and role assignments (Admin, Author, Reader). |
| **novels** | Stores novel metadata, cover images, PDF links, publication status, ratings, and ownership information. |
| **reviews** | Stores user ratings and reviews for published novels. |
| **comments** | Supports discussion threads and user interactions on novels. |
| **review_likes** | Tracks likes and engagement on reviews. |
| **review_flags** | Stores reports for inappropriate or flagged reviews. |
| **reading_progress** | Tracks readers' current page, total pages, and last reading activity. |
| **book_requests** | Allows readers to request books that are not currently available on the platform. |
| **admin_requests** | Stores requests requiring administrator review or approval. |
| **author_assignments** | Stores writing prompts and assignments issued to authors by administrators. |

---

### 🔗 Database Relationships

- A **User (profiles)** can:
  - Upload multiple novels
  - Write reviews
  - Add comments
  - Bookmark novels
  - Track reading progress
  - Submit book requests

- A **Novel (novels)** can:
  - Have multiple reviews
  - Have multiple comments
  - Be tracked through reading progress

- An **Author** can:
  - Own multiple novels
  - Receive multiple writing assignments

- An **Admin** can:
  - Manage publication requests
  - Review book requests
  - Assign writing prompts to authors
---

## 🎯 Learning Outcomes

Through this project, I gained hands-on experience in:

- Role-Based Access Control (RBAC)
- React Application Architecture
- Supabase Authentication
- PostgreSQL Database Design
- Cloud Storage Management
- Real-Time Data Synchronization
- Responsive UI Development
- Full-Stack Application Deployment

---

## 🔮 Future Enhancements

- AI-powered book recommendations
- Reading progress tracking
- User reviews and ratings
- Bookmarking and favorites
- Social reading features

---

## 👩‍💻 Author

**K Madhumitha**

GitHub: https://github.com/k-madhumithaa

If you found this project interesting, consider giving it a ⭐ on GitHub!
