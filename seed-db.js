const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Create database connection
const db = new sqlite3.Database('./smiles_tracker.db');

// Test users data
const testUsers = [
  {
    username: 'admin',
    email: 'admin@smiles-tracker.com',
    password: 'admin123'
  },
  {
    username: 'demo',
    email: 'demo@smiles-tracker.com',
    password: 'demo123'
  },
  {
    username: 'testuser',
    email: 'test@smiles-tracker.com',
    password: 'test123'
  },
  {
    username: 'manager',
    email: 'manager@smiles-tracker.com',
    password: 'manager123'
  }
];

async function createTestUsers() {
  console.log('🌱 Seeding database with test users...');
  
  for (const user of testUsers) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // Insert user
      db.run(
        'INSERT OR IGNORE INTO users (username, email, password) VALUES (?, ?, ?)',
        [user.username, user.email, hashedPassword],
        function(err) {
          if (err) {
            console.error(`❌ Error creating user ${user.username}:`, err.message);
          } else {
            console.log(`✅ Created test user: ${user.username} (${user.email})`);
          }
        }
      );
    } catch (error) {
      console.error(`❌ Error hashing password for ${user.username}:`, error);
    }
  }
  
  // Create some sample projects for the admin user
  setTimeout(() => {
    console.log('📁 Creating sample projects...');
    
    const sampleProjects = [
      {
        name: 'Website Redesign',
        description: 'Complete redesign of company website with modern UI/UX',
        user_id: 1
      },
      {
        name: 'Mobile App Development',
        description: 'iOS and Android app for customer engagement',
        user_id: 1
      },
      {
        name: 'API Integration',
        description: 'Integrate third-party APIs for payment processing',
        user_id: 1
      }
    ];
    
    sampleProjects.forEach(project => {
      db.run(
        'INSERT OR IGNORE INTO projects (name, description, user_id) VALUES (?, ?, ?)',
        [project.name, project.description, project.user_id],
        function(err) {
          if (err) {
            console.error(`❌ Error creating project ${project.name}:`, err.message);
          } else {
            console.log(`✅ Created sample project: ${project.name}`);
          }
        }
      );
    });
    
    console.log('\n🎉 Database seeding completed!');
    console.log('\n📋 Test Login Credentials:');
    console.log('┌─────────────┬─────────────────────────┬────────────┐');
    console.log('│ Username    │ Email                   │ Password   │');
    console.log('├─────────────┼─────────────────────────┼────────────┤');
    testUsers.forEach(user => {
      console.log(`│ ${user.username.padEnd(11)} │ ${user.email.padEnd(23)} │ ${user.password.padEnd(10)} │`);
    });
    console.log('└─────────────┴─────────────────────────┴────────────┘');
    console.log('\n🚀 You can now login with any of these credentials!');
    
    db.close();
  }, 1000);
}

// Initialize database tables first
db.serialize(() => {
  // Create users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create projects table
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create files table
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

  // Create tickets table
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

  // Create project summaries table
  db.run(`CREATE TABLE IF NOT EXISTS project_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    summary TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  )`, () => {
    // Run the seeding after tables are created
    createTestUsers();
  });
});
