# Smiles Tracker

A project management web application with file tracking and ticket management capabilities.

## Features

- **User Authentication**: Secure login/register system with JWT tokens
- **Project Management**: Create and manage multiple projects
- **File Upload**: Upload audio recordings and documents to projects
  - **Supported Formats**: PDF, MD, DOC, DOCX, TXT, MP3, WAV
- **AI-Powered Analysis**: OpenAI integration for intelligent content analysis
  - **Audio Transcription**: Whisper AI for audio-to-text conversion
  - **Document Analysis**: GPT-4 for document content extraction
  - **Smart Ticket Generation**: AI-generated project tickets and summaries
- **Kanban Board**: Visual ticket management with drag-and-drop functionality
- **Dark/Light Mode**: Toggle between dark and light themes
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Backend
- Node.js with Express
- SQLite database
- JWT authentication
- Multer for file uploads
- bcryptjs for password hashing
- OpenAI API integration (Whisper + GPT-4)

### Frontend
- React with TypeScript
- Material-UI for components
- React Router for navigation
- Axios for API calls

## Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation & Running

1. **Clone or download the project**
   ```bash
   # If using git
   git clone <repository-url>
   cd smiles-tracker
   ```

2. **Install Dependencies**
   ```bash
   npm run setup
   ```
   This installs both backend and frontend dependencies.

3. **Start the Application**
   ```bash
   npm run dev
   ```
   This command will:
   - Start the backend server on port 5000
   - Start the React development server on port 3000
   - Automatically open your browser to `http://localhost:3000`

4. **Access the Application**
   - **Frontend**: `http://localhost:3000` (React app)
   - **Backend API**: `http://localhost:5000` (Express server)
   - Register a new account or login with existing credentials

### Alternative Running Methods

**Run only the backend server:**
```bash
npm run server
```

**Run only the frontend (requires backend to be running separately):**
```bash
npm run client
```

**Production mode:**
```bash
npm run build  # Build frontend
npm start      # Start production server
```

## Available Scripts

- `npm run dev` - Start both backend and frontend in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend development server
- `npm start` - Start production server
- `npm run build` - Build the frontend for production

## Project Structure

```
smiles-tracker/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   └── ...
├── server.js              # Express server
├── package.json           # Backend dependencies
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login user

### Projects
- `GET /api/projects` - Get user's projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details

### Files
- `POST /api/projects/:id/files` - Upload files to project
- `GET /api/projects/:id/files` - Get project files

### Tickets
- `GET /api/projects/:id/tickets` - Get project tickets
- `POST /api/projects/:id/tickets` - Create new ticket
- `PUT /api/tickets/:id` - Update ticket status
- `POST /api/projects/:id/generate-tickets` - Generate tickets from files

## Database Schema

The application uses SQLite with the following tables:
- `users` - User accounts
- `projects` - User projects
- `files` - Uploaded files
- `tickets` - Generated tickets
- `project_summaries` - Project summaries

## Development

1. The backend server runs on port 5000
2. The React development server runs on port 3000
3. File uploads are stored in the `uploads/` directory
4. Database file is created as `smiles_tracker.db`

## Production Deployment

1. Build the frontend: `npm run build`
2. Start the production server: `npm start`
3. The built React app will be served from the Express server

## License

MIT
