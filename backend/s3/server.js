import express from 'express';
import dotenv from 'dotenv';
import documentRoutes from './routes/documentRoutes.js';
import authRoutes from './routes/auth/route.js'; // example
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());       // parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Mount routes
app.use('/documents', documentRoutes); // all document routes prefixed with /documents
app.use('/auth', authRoutes);          // auth routes

// Default route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
