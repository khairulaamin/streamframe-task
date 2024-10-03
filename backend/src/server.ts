import express, { Request, Response } from 'express';
import mysql, { ResultSetHeader } from 'mysql2';  
import { OkPacket, RowDataPacket } from 'mysql2'; 
import { createPool } from 'mysql2';
import cors from 'cors';

// Create Express app
const app = express();
const PORT = 5000;

// Enable CORS for all origins
app.use(cors());

// Middleware to parse JSON requests
app.use(express.json());

// Create MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',  
  password: 'P@engeolssi2022',  
  database: 'taskdb'  
});

// Sample route to get tasks
app.get('/tasks', (req: Request, res: Response) => {
  pool.query('SELECT * FROM tasks', (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(results);
  });
});

// Route to get the number of child dependencies for a task
app.get('/tasks/:id/dependencies', async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.id, 10);
  const dependencyQuery = 'SELECT COUNT(*) as dependencyCount FROM tasks WHERE parent_task_id = ?';

  try {
    // Count child tasks (dependencies)
    const dependencyCountResult = await new Promise<number>((resolve, reject) => {
      pool.query(dependencyQuery, [taskId], (error, results: RowDataPacket[]) => {
        if (error) {
          return reject(error);
        }
        console.log('Raw Dependency Count Query Result:', results); // Log the raw result
        resolve(results[0].dependencyCount);
      });
    });

    res.status(200).json({ dependencyCount: dependencyCountResult });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to count DONE dependencies for a specific task
app.get('/tasks/:id/done-count', async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.id, 10);
  const doneCountQuery = 'SELECT COUNT(*) as doneCount FROM tasks WHERE parent_task_id = ? AND status = "DONE"';

  try {
    const doneCountResult = await new Promise<number>((resolve, reject) => {
      pool.query(doneCountQuery, [taskId], (error, results: RowDataPacket[]) => {
        if (error) {
          return reject(error);
        }
        console.log('Raw DONE Count Query Result:', results); // Log the raw result to check data structure
        if (results.length > 0 && results[0].doneCount !== undefined) {
          resolve(results[0].doneCount);
        } else {
          resolve(0); // If no result or invalid format, return 0
        }
      });
    });

    res.status(200).json({ doneCount: doneCountResult });
  } catch (error) {
    console.error('Error fetching DONE count:', error); // Log any errors
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to count COMPLETE dependencies for a specific task
app.get('/tasks/:id/complete-count', async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.id, 10);
  const completeCountQuery = 'SELECT COUNT(*) as completeCount FROM tasks WHERE parent_task_id = ? AND status = "COMPLETE"';

  try {
    const completeCountResult = await new Promise<number>((resolve, reject) => {
      pool.query(completeCountQuery, [taskId], (error, results: RowDataPacket[]) => {
        if (error) {
          return reject(error);
        }
        console.log('Raw COMPLETE Count Query Result:', results); // Log the raw result to check data structure
        if (results.length > 0 && results[0].completeCount !== undefined) {
          resolve(results[0].completeCount);
        } else {
          resolve(0); // If no result or invalid format, return 0
        }
      });
    });

    res.status(200).json({ completeCount: completeCountResult });
  } catch (error) {
    console.error('Error fetching COMPLETE count:', error); // Log any errors
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to update the status
app.put('/tasks/:id', async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.id, 10);
  const { status } = req.body;

  const childQuery = 'SELECT status FROM tasks WHERE parent_task_id = ?';
  const parentQuery = 'SELECT parent_task_id FROM tasks WHERE id = ?';

  try {
    // Determine updated status
    let updatedStatus = status;

    // Update the task status based on the current status
    if (status === 'DONE') {
      const childResults = await new Promise<RowDataPacket[]>((resolve, reject) => {
        pool.query(childQuery, [taskId], (error, results: RowDataPacket[]) => {
          if (error) {
            return reject(error);
          }
          resolve(results);
        });
      });

      const allComplete = childResults.every((child) => child.status === 'COMPLETE');
      if (allComplete || childResults.length === 0) {
        updatedStatus = 'COMPLETE';
      }
    }

    // Update the task status
    await new Promise<void>((resolve, reject) => {
      pool.query('UPDATE tasks SET status = ? WHERE id = ?', [updatedStatus, taskId], (error) => {
        if (error) {
          return reject(error);
        }
        resolve();
      });
    });

    // Check if the task is IN PROGRESS
    if (status === 'IN_PROGRESS') {
      const parentResult = await new Promise<RowDataPacket[]>((resolve, reject) => {
        pool.query(parentQuery, [taskId], (error, results: RowDataPacket[]) => {
          if (error) {
            return reject(error);
          }
          resolve(results);
        });
      });

      const parentId = parentResult[0]?.parent_task_id;
      if (parentId) {
        // Update the parent's status to DONE
        await new Promise<void>((resolve, reject) => {
          pool.query('UPDATE tasks SET status = "DONE" WHERE id = ?', [parentId], (error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        });
      }
    }

    // After updating the child's status, check if we need to update the parent
    const parentResult = await new Promise<RowDataPacket[]>((resolve, reject) => {
      pool.query(parentQuery, [taskId], (error, results: RowDataPacket[]) => {
        if (error) {
          return reject(error);
        }
        resolve(results);
      });
    });

    const parentId = parentResult[0]?.parent_task_id;
    if (parentId) {
      // Check all child tasks of the parent
      const siblingResults = await new Promise<RowDataPacket[]>((resolve, reject) => {
        pool.query(childQuery, [parentId], (error, results: RowDataPacket[]) => {
          if (error) {
            return reject(error);
          }
          resolve(results);
        });
      });

      // If all siblings are COMPLETE, update the parent task's status to COMPLETE
      const allSiblingsComplete = siblingResults.every((sibling) => sibling.status === 'COMPLETE');

      // If any sibling is IN_PROGRESS, update the parent task's status to DONE
      const anySiblingsInProgress = siblingResults.some((sibling) => sibling.status === 'IN_PROGRESS');

      if (allSiblingsComplete) {
        await new Promise<void>((resolve, reject) => {
          pool.query('UPDATE tasks SET status = "COMPLETE" WHERE id = ?', [parentId], (error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        });
      } else if (anySiblingsInProgress) {
        await new Promise<void>((resolve, reject) => {
          pool.query('UPDATE tasks SET status = "DONE" WHERE id = ?', [parentId], (error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        });
      }
    }

    // Send the updated status back to the frontend
    res.status(200).json({ updatedStatus });

  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Helper function to check for circular dependencies
const checkCircularDependency = async (taskId: number, parentId: number | null): Promise<boolean> => {
  if (!parentId) return false; // If there's no parent, no need to check
  
  let currentParentId = parentId;
  while (currentParentId) {
    if (currentParentId === taskId) {
      return true; // Circular dependency detected
    }

    // Get the parent of the current parent
    const result = await new Promise<RowDataPacket[]>((resolve, reject) => {
      pool.query('SELECT parent_task_id FROM tasks WHERE id = ?', [currentParentId], (error, results: RowDataPacket[]) => {
        if (error) {
          return reject(error);
        }
        resolve(results);
      });
    });

    if (result.length === 0) break; // If no parent found, stop
    currentParentId = result[0]?.parent_task_id;
  }

  return false;
};

// Route to create a new task with circular dependency check
app.post('/tasks', async (req: Request, res: Response): Promise<void> => {
  const { name, parent_task_id } = req.body; // Destructure parent_task_id from request body

  if (!name) {
    res.status(400).json({ error: 'Task name is required' });
    return;
  }

  try {
    // Check for circular dependency
    if (parent_task_id) {
      const circular = await checkCircularDependency(req.body.id, parent_task_id);
      if (circular) {
        res.status(400).json({ error: 'Circular dependency detected' });
        return;
      }
    }

    // Insert the new task
    pool.query(
      'INSERT INTO tasks (name, status, parent_task_id) VALUES (?, ?, ?)', // Include parent_task_id
      [name, 'IN_PROGRESS', parent_task_id], // Pass parent_task_id to the query
      (error, results: ResultSetHeader) => {
        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        const insertId = results.insertId; // Get the insert ID from the results
        res.status(201).json({ id: insertId, name, status: 'IN_PROGRESS', parent_task_id }); // Include parent_task_id in the response
      }
    );
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to update the task name
app.put('/tasks/edit-name/:id', async (req: Request, res: Response): Promise<void> => {
  const taskId = parseInt(req.params.id, 10); // Parse task ID from URL
  const { name } = req.body; // Get new name from request body

  if (!name) {
    res.status(400).json({ error: 'Task name is required' });
    return;
  }

  try {
    // Update the task name in the database
    await new Promise<void>((resolve, reject) => {
      pool.query('UPDATE tasks SET name = ? WHERE id = ?', [name, taskId], (error) => {
        if (error) {
          return reject(error);
        }
        resolve();
      });
    });

    // Send success response
    res.status(200).json({ message: 'Task name updated successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
