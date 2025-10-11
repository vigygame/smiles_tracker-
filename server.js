const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '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'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|md|doc|docx|txt|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                    file.mimetype === 'application/pdf' ||
                    file.mimetype === 'text/plain' ||
                    file.mimetype === 'text/markdown' ||
                    file.mimetype === 'application/msword' ||
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    file.mimetype === 'audio/mpeg' ||
                    file.mimetype === 'audio/wav';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, MD, DOC, DOCX, TXT, MP3, and WAV files are allowed'));
    }
  }
});

// Database setup
const db = new sqlite3.Database('./smiles_tracker.db');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Projects table
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Files table
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  )`);

  // Tickets table
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    epic_name TEXT NOT NULL,
    task TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  )`);

  // Project summaries table
  db.run(`CREATE TABLE IF NOT EXISTS project_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    summary TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  )`);
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// OpenAI Analysis Functions
async function transcribeAudio(audioFilePath) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: "whisper-1",
      response_format: "text"
    });
    return transcription;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

async function analyzeDocument(documentFilePath) {
  try {
    const file = await openai.files.create({
      file: fs.createReadStream(documentFilePath),
      purpose: "assistants"
    });
    return file;
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

async function generateSummaryAndTickets(transcription, documentContent, projectId) {
  try {
    let prompt = `Based on the provided content, create a comprehensive project summary and break down the work into actionable tickets/epics.\n\n`;
    
    if (transcription && transcription.trim()) {
      prompt += `Audio Transcription: ${transcription}\n\n`;
    }
    
    if (documentContent && documentContent.trim()) {
      prompt += `Document Content: ${documentContent}\n\n`;
    }
    
    if (!transcription && !documentContent) {
      prompt += `No specific content provided. Please create a general project management structure.\n\n`;
    }
    
    prompt += `Please provide:
    1. A detailed project summary (2-3 paragraphs)
    2. A JSON array of epics with their subtasks in the following format:
    {
      "summary": "Project summary here...",
      "tickets": [
        {
          "epic_name": "Epic Name",
          "subtasks": [
            {
              "task": "Specific task name",
              "description": "Detailed task description"
            }
          ]
        }
      ]
    }
    
    Make sure the tickets are actionable, specific, and cover all aspects mentioned in the content. If no specific content is provided, create a general project management structure.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;
    
    // Try to parse JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      // Fallback if JSON parsing fails
      return {
        summary: response,
        tickets: [
          {
            epic_name: "General Tasks",
            subtasks: [
              {
                task: "Review and implement requirements",
                description: "Review the provided content to implement the requirements"
              }
            ]
          }
        ]
      };
    }
  } catch (error) {
    console.error('Error generating summary and tickets:', error);
    throw error;
  }
}

// Routes

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        const token = jwt.sign(
          { id: this.lastID, username, email },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );
        
        res.json({ token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      res.json({ 
        token, 
        user: { id: user.id, username: user.username, email: user.email } 
      });
    }
  );
});

// Project routes
app.get('/api/projects', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, projects) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(projects);
    }
  );
});

app.post('/api/projects', authenticateToken, (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  db.run(
    'INSERT INTO projects (name, description, user_id) VALUES (?, ?, ?)',
    [name, description, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, name, description, user_id: req.user.id });
    }
  );
});

app.get('/api/projects/:id', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  
  db.get(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [projectId, req.user.id],
    (err, project) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
    }
  );
});

// File upload routes
app.post('/api/projects/:id/files', authenticateToken, upload.array('files', 10), (req, res) => {
  const projectId = req.params.id;
  const files = req.files;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  // Verify project belongs to user
  db.get(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [projectId, req.user.id],
    (err, project) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Save files to database
      const stmt = db.prepare(`
        INSERT INTO files (project_id, filename, original_name, file_path, file_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const savedFiles = [];
      files.forEach(file => {
        const fileType = file.mimetype.startsWith('audio/') ? 'audio' : 'document';
        stmt.run(
          [projectId, file.filename, file.originalname, file.path, fileType, file.size],
          function(err) {
            if (!err) {
              savedFiles.push({
                id: this.lastID,
                filename: file.filename,
                original_name: file.originalname,
                file_type: fileType,
                file_size: file.size,
                uploaded_at: new Date().toISOString()
              });
            }
          }
        );
      });
      
      stmt.finalize();
      res.json({ message: 'Files uploaded successfully', files: savedFiles });
    }
  );
});

app.get('/api/projects/:id/files', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  
  db.all(
    'SELECT * FROM files WHERE project_id = ? ORDER BY uploaded_at DESC',
    [projectId],
    (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(files);
    }
  );
});

app.get('/api/files/:id/download', authenticateToken, (req, res) => {
  const fileId = req.params.id;
  
  db.get(
    'SELECT * FROM files WHERE id = ?',
    [fileId],
    (err, file) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Check if file exists
      if (!fs.existsSync(file.file_path)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }
      
      // Set appropriate headers and send file
      res.download(file.file_path, file.original_name, (downloadErr) => {
        if (downloadErr) {
          console.error('Error downloading file:', downloadErr);
          res.status(500).json({ error: 'Error downloading file' });
        }
      });
    }
  );
});

app.delete('/api/files/:id', authenticateToken, (req, res) => {
  const fileId = req.params.id;
  
  // First get the file details
  db.get(
    'SELECT * FROM files WHERE id = ?',
    [fileId],
    (err, file) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Delete the physical file
      fs.unlink(file.file_path, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
          // Continue with database deletion even if file deletion fails
        }
        
        // Delete from database
        db.run(
          'DELETE FROM files WHERE id = ?',
          [fileId],
          function(deleteErr) {
            if (deleteErr) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ message: 'File deleted successfully' });
          }
        );
      });
    }
  );
});

// Ticket routes
app.get('/api/projects/:id/tickets', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  
  db.all(
    'SELECT * FROM tickets WHERE project_id = ? ORDER BY created_at DESC',
    [projectId],
    (err, tickets) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(tickets);
    }
  );
});

app.post('/api/projects/:id/tickets', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const { epic_name, task, description } = req.body;
  
  if (!epic_name || !task) {
    return res.status(400).json({ error: 'Epic name and task are required' });
  }
  
  db.run(
    'INSERT INTO tickets (project_id, epic_name, task, description) VALUES (?, ?, ?, ?)',
    [projectId, epic_name, task, description],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ 
        id: this.lastID, 
        project_id: projectId, 
        epic_name, 
        task, 
        description,
        status: 'todo'
      });
    }
  );
});

app.put('/api/tickets/:id', authenticateToken, (req, res) => {
  const ticketId = req.params.id;
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  
  db.run(
    'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, ticketId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Ticket updated successfully' });
    }
  );
});

// Project summary route
app.get('/api/projects/:id/summary', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  
  db.get(
    'SELECT * FROM project_summaries WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1',
    [projectId],
    (err, summary) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!summary) {
        return res.status(404).json({ error: 'No summary found' });
      }
      res.json(summary);
    }
  );
});

// OpenAI API for ticket generation
app.post('/api/projects/:id/generate-tickets', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  
  try {
    // Get all files for this project
    const files = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM files WHERE project_id = ? ORDER BY uploaded_at DESC',
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files found for this project' });
    }

    // Separate audio and document files
    const audioFiles = files.filter(file => file.file_type === 'audio');
    const documentFiles = files.filter(file => file.file_type === 'document');

    let transcription = '';
    let documentContent = '';

    // Process audio files
    if (audioFiles.length > 0) {
      try {
        const audioFile = audioFiles[0]; // Use the first audio file
        transcription = await transcribeAudio(audioFile.file_path);
        console.log('Audio transcribed successfully');
      } catch (error) {
        console.error('Error transcribing audio:', error);
        // Continue without transcription
      }
    }

    // Process document files
    if (documentFiles.length > 0) {
      try {
        const docFile = documentFiles[0]; // Use the first document file
        const fileContent = fs.readFileSync(docFile.file_path, 'utf8');
        documentContent = fileContent.substring(0, 8000); // Limit content length
        console.log('Document content extracted successfully');
      } catch (error) {
        console.error('Error reading document:', error);
        // Continue without document content
      }
    }

    // Generate summary and tickets using OpenAI
    const analysisResult = await generateSummaryAndTickets(transcription, documentContent, projectId);
    
    // Save summary
    db.run(
      'INSERT OR REPLACE INTO project_summaries (project_id, summary) VALUES (?, ?)',
      [projectId, analysisResult.summary],
      (err) => {
        if (err) {
          console.error('Error saving summary:', err);
        }
      }
    );
    
    // Clear existing tickets for this project
    db.run('DELETE FROM tickets WHERE project_id = ?', [projectId], (err) => {
      if (err) {
        console.error('Error clearing existing tickets:', err);
      }
    });
    
    // Save new tickets
    const stmt = db.prepare(`
      INSERT INTO tickets (project_id, epic_name, task, description, status)
      VALUES (?, ?, ?, ?, 'todo')
    `);
    
    analysisResult.tickets.forEach(epic => {
      epic.subtasks.forEach(subtask => {
        stmt.run([projectId, epic.epic_name, subtask.task, subtask.description]);
      });
    });
    
    stmt.finalize();
    
    res.json({
      success: true,
      summary: analysisResult.summary,
      tickets: analysisResult.tickets,
      message: 'Tickets generated successfully using OpenAI analysis'
    });
    
  } catch (error) {
    console.error('Error generating tickets:', error);
    res.status(500).json({ 
      error: 'Failed to generate tickets', 
      details: error.message 
    });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
