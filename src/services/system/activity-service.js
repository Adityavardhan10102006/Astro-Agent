const EventEmitter = require('events');

class ActivityService extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map(); // id -> Task
  }

  createTask({ id, type, label, details = '', cancellable = false }) {
    const taskId = id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const task = {
      id: taskId,
      type, // 'model-download' | 'model-load' | 'rag-indexing' | 'code-execution' | 'research' | 'file-scan'
      label,
      details,
      status: 'running', // 'running' | 'completed' | 'failed' | 'cancelled'
      progress: 0, // 0 - 100
      cancellable,
      startTime: Date.now(),
      endTime: null,
      error: null
    };

    this.tasks.set(taskId, task);
    this.emit('taskCreated', task);
    this.emit('change', this.getAllTasks());
    return task;
  }

  updateProgress(taskId, progress, details = null) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.progress = Math.min(100, Math.max(0, progress));
    if (details !== null) task.details = details;

    this.emit('taskUpdated', task);
    this.emit('change', this.getAllTasks());
    return task;
  }

  completeTask(taskId, details = null) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = 'completed';
    task.progress = 100;
    task.endTime = Date.now();
    if (details) task.details = details;

    this.emit('taskCompleted', task);
    this.emit('change', this.getAllTasks());
    return task;
  }

  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = 'failed';
    task.endTime = Date.now();
    task.error = typeof error === 'string' ? error : (error && error.message ? error.message : 'Unknown error');

    this.emit('taskFailed', task);
    this.emit('change', this.getAllTasks());
    return task;
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = 'cancelled';
    task.endTime = Date.now();

    this.emit('taskCancelled', task);
    this.emit('change', this.getAllTasks());
    return task;
  }

  getActiveTasks() {
    return Array.from(this.tasks.values()).filter(t => t.status === 'running');
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => b.startTime - a.startTime);
  }

  clearCompleted() {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status !== 'running') {
        this.tasks.delete(id);
      }
    }
    this.emit('change', this.getAllTasks());
  }
}

module.exports = {
  ActivityService
};
