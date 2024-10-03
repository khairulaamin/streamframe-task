// src/DashboardPage.tsx

import React, { useState } from 'react';

const TaskCreationForm: React.FC = () => {
  const [taskName, setTaskName] = useState('');
  const [parentTaskId, setParentTaskId] = useState(''); // New state for parent task ID
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!taskName) {
      setError('Task name is required');
      return;
    }

    const taskData: any = { name: taskName };

  // Only include parent_task_id if it's provided
  if (parentTaskId) {
    taskData.parent_task_id = parentTaskId;
  }

    try {
    const response = await fetch('http://localhost:5000/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      throw new Error('Failed to create task');
    }

    const newTask = await response.json();
    console.log('Task created:', newTask);

      // Clear the form after successful task creation
      setTaskName('');
      setParentTaskId(''); // Clear parent task ID
    } catch (error) {
      setError('Error creating task');
      console.error('Error creating task:', error);
    }
  };

  return (
    <div>
      <h2>Create a New Task</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Task Name:
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            required
          />
        </label>
        <br/>
        <label>
          Parent Task ID:
          <input
            type="text"
            value={parentTaskId}
            onChange={(e) => setParentTaskId(e.target.value)}
          />
        </label>
        <br/>
        <button type="submit">Create Task</button>
      </form>
    </div>
  );
};

export default TaskCreationForm;
