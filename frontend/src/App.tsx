import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import TaskFormPage from './pages/TaskFormPage';

interface Task {
  id: number;
  name: string;
  status: 'IN_PROGRESS' | 'DONE' | 'COMPLETE';
  parent_task_id: number | null;
  dependencyCount?: number;
  doneCount?: number;
  completeCount?: number;
  children: Task[]; // Ensure children is always initialized as an array
}

// Function to render tasks recursively
const RenderTasks = ({
  tasks,
  toggleTaskStatus,
  handleEditTask,
  editingTaskId,
  newTaskName,
  setNewTaskName,
  handleSaveEdit,
}: {
  tasks: Task[];
  toggleTaskStatus: (task: Task) => void;
  handleEditTask: (task: Task) => void;
  editingTaskId: number | null;
  newTaskName: string;
  setNewTaskName: React.Dispatch<React.SetStateAction<string>>;
  handleSaveEdit: () => void;
}) => (
  <div className="task-list">
    {tasks.map(task => (
      <div key={task.id} className="task-item">
        <div className="task-header">
          {editingTaskId === task.id ? (
            <>
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="New task name"
              />
              <button onClick={handleSaveEdit}>Save</button>
              <button onClick={() => handleEditTask(task)}>Cancel</button>
            </>
          ) : (
            <>
              <strong>Task {task.name} (ID: {task.id})</strong> - Status: {task.status}
              <div className="task-counts">
                Dependencies: {task.dependencyCount || 0} | Done: {task.doneCount || 0} | Complete: {task.completeCount || 0}
              </div>
              <label className="task-checkbox">
                <input
                  type="checkbox"
                  checked={task.status === 'DONE' || task.status === 'COMPLETE'}
                  onChange={() => toggleTaskStatus(task)}
                />
                {task.status === 'DONE' || task.status === 'COMPLETE' ? ' Mark as IN PROGRESS' : ' Mark as DONE'}
              </label>
              <button onClick={() => handleEditTask(task)}>Edit</button>
            </>
          )}
        </div>
        {task.children.length > 0 && (
          <div className="child-tasks">
            <RenderTasks
              tasks={task.children}
              toggleTaskStatus={toggleTaskStatus}
              handleEditTask={handleEditTask}
              editingTaskId={editingTaskId}
              newTaskName={newTaskName}
              setNewTaskName={setNewTaskName}
              handleSaveEdit={handleSaveEdit}
            />
          </div>
        )}
      </div>
    ))}
  </div>
);

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'DONE' | 'COMPLETE'>('ALL');
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [newTaskName, setNewTaskName] = useState<string>('');

  

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/tasks');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const data: Task[] = await response.json();

      const tasksWithDependencies = await Promise.all(
        data.map(async (task) => {
          const dependencyCount = await fetchDependencyCount(task.id);
          const doneCount = await fetchDoneCount(task.id);
          const completeCount = await fetchCompleteCount(task.id);
          return { ...task, dependencyCount, doneCount, completeCount, children: [] };
        })
      );

      setTasks(tasksWithDependencies);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, []);

  const fetchDependencyCount = async (taskId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/tasks/${taskId}/dependencies`);
      if (!response.ok) {
        throw new Error('Failed to fetch dependency count');
      }
      const data = await response.json();
      return data.dependencyCount || 0;
    } catch (error) {
      console.error('Error fetching dependency count:', error);
      return 0;
    }
  };

  const fetchDoneCount = async (taskId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/tasks/${taskId}/done-count`);
      if (!response.ok) {
        throw new Error('Failed to fetch DONE count');
      }
      const data = await response.json();
      return data.doneCount || 0;
    } catch (error) {
      console.error('Error fetching DONE count:', error);
      return 0;
    }
  };

  const fetchCompleteCount = async (taskId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/tasks/${taskId}/complete-count`);
      if (!response.ok) {
        throw new Error('Failed to fetch COMPLETE count');
      }
      const data = await response.json();
      return data.completeCount || 0;
    } catch (error) {
      console.error('Error fetching COMPLETE count:', error);
      return 0;
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    let updatedStatus: 'IN_PROGRESS' | 'DONE' | 'COMPLETE';

    const children = tasks.filter(t => t.parent_task_id === task.id);

    if (children.length === 0) {
      updatedStatus = task.status === 'COMPLETE' ? 'IN_PROGRESS' : 'COMPLETE';
    } else {
      const allComplete = children.every(child => child.status === 'COMPLETE');
      const someInProgress = children.some(child => child.status === 'IN_PROGRESS');

      if (task.status === 'COMPLETE') {
        updatedStatus = 'IN_PROGRESS';
      } else if (someInProgress) {
        updatedStatus = 'DONE';
      } else {
        updatedStatus = 'COMPLETE';
      }
    }

    try {
      const response = await fetch(`http://localhost:5000/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...task, status: updatedStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      setTasks(prevTasks =>
        prevTasks.map(t => {
          if (t.id === task.id) {
            return { ...t, status: updatedStatus };
          }
          return t;
        })
      );

      const parentId = task.parent_task_id;
      if (parentId) {
        const siblings = tasks.filter(t => t.parent_task_id === parentId);
        const allComplete = siblings.every(sibling => sibling.status === 'COMPLETE');

        if (allComplete) {
          await fetch(`http://localhost:5000/tasks/${parentId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'COMPLETE' }),
          });

          setTasks(prevTasks =>
            prevTasks.map(t => {
              if (t.id === parentId) {
                return { ...t, status: 'COMPLETE' };
              }
              return t;
            })
          );
        }
      }

      window.location.reload();
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTaskName(task.name);
  };

  const handleSaveEdit = async () => {
    if (editingTaskId !== null) {
      try {
        const response = await fetch(`http://localhost:5000/tasks/edit-name/${editingTaskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...tasks.find(t => t.id === editingTaskId), name: newTaskName }),
        });

        if (!response.ok) {
          throw new Error('Failed to update task name');
        }

        setTasks(prevTasks =>
          prevTasks.map(t => (t.id === editingTaskId ? { ...t, name: newTaskName } : t))
        );
        setEditingTaskId(null);
        setNewTaskName('');
      } catch (error) {
        console.error('Error updating task name:', error);
        alert('Failed to update task name. Please try again.');
      }
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'ALL') return true;
    if (filter === 'IN_PROGRESS') return task.status === 'IN_PROGRESS' || tasks.some(t => t.parent_task_id === task.id && t.status === 'IN_PROGRESS');
    if (filter === 'DONE') return task.status === 'DONE' || tasks.some(t => t.parent_task_id === task.id && t.status === 'DONE');
    if (filter === 'COMPLETE') return task.status === 'COMPLETE' || tasks.some(t => t.parent_task_id === task.id && t.status === 'COMPLETE');
    return false;
  });

  // Function to build a nested structure
  const buildTaskHierarchy = (tasks: Task[]) => {
    const taskMap: { [key: number]: Task & { children: Task[] } } = {};
    const hierarchy: (Task & { children: Task[] })[] = [];

    tasks.forEach(task => {
      taskMap[task.id] = { ...task, children: [] };
    });

    tasks.forEach(task => {
      if (task.parent_task_id === null) {
        hierarchy.push(taskMap[task.id]);
      } else {
        taskMap[task.parent_task_id]?.children.push(taskMap[task.id]);
      }
    });

    return hierarchy;
  };

  const taskHierarchy = buildTaskHierarchy(filteredTasks);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="task-list-container">
      <h1>Task Listing</h1>
      <label>
        Filter by status:
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'ALL' | 'IN_PROGRESS' | 'DONE' | 'COMPLETE')}>
          <option value="ALL">All</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="DONE">DONE</option>
          <option value="COMPLETE">COMPLETE</option>
        </select>
      </label>
      <div className="task-list">
        <RenderTasks
          tasks={taskHierarchy}
          toggleTaskStatus={toggleTaskStatus}
          handleEditTask={handleEditTask}
          editingTaskId={editingTaskId}
          newTaskName={newTaskName}
          setNewTaskName={setNewTaskName}
          handleSaveEdit={handleSaveEdit}
        />
      </div>
    </div>
  );
};
const App: React.FC = () => {
  return (
    <Router>
      <div className="app-container">
        <div className="sidebar">
          <h2>Sidebar</h2>
          <ul>
            <li><Link to="/">Task List</Link></li>
            <li><Link to="/new-task">Add New Task</Link></li>
          </ul>
        </div>
        <div className="main-content">
          <Routes>
            <Route path="/" element={<TaskList />} />
            <Route path="/new-task" element={<TaskFormPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
