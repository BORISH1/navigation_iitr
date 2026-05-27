require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json({ limit: '10mb' })); // Allows large map JSON data

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auto-create table on startup
const setupDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campus_map (
        id INT PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);
    console.log("PostgreSQL Database Ready.");
  } catch (err) {
    console.error("Database setup failed:", err);
  }
};
setupDatabase();

// --- API ROUTES ---

// GET: Fetch map data
app.get('/api/map', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM campus_map WHERE id = 1');
    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0].data);
    } else {
      res.status(200).json({ nodes: [], edges: [] });
    }
  } catch (error) {
    console.error("GET Error:", error);
    res.status(500).json({ error: 'Failed to fetch map data.' });
  }
});

// POST: Save map data from Admin Panel
app.post('/api/map', async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    const mapData = JSON.stringify({ nodes, edges });

    await pool.query(`
      INSERT INTO campus_map (id, data)
      VALUES (1, $1::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
    `, [mapData]);

    res.status(200).json({ success: true, message: 'Map saved to Neon PostgreSQL!' });
  } catch (error) {
    console.error("POST Error:", error);
    res.status(500).json({ error: 'Failed to save map data.' });
  }
});

app.listen(port, () => {
  console.log(`Express server running on http://localhost:${port}`);
});