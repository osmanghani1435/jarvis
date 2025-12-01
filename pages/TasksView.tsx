import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle, Circle, Trash2, Calendar as CalendarIcon, Flag } from 'lucide-react';
import { getTasks, addTask, toggleTaskComplete } from '../services/dbService';
import { useAuth } from '../context/AuthContext';
import { Task } from '../types';

export const TasksView: React.FC = () => {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const fetchTasks = async () => {
    if (userProfile) {
      const data = await getTasks(userProfile.uid);
      setTasks(data);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [userProfile]);

  const handleToggle = async (id: string, current: boolean) => {
    if (!userProfile) return;
    // Optimistic update
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !current } : t));
    await toggleTaskComplete(userProfile.uid, id, current);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !userProfile) return;
    
    await addTask(userProfile.uid, {
      title: newTaskTitle,
      priority: newTaskPriority,
      completed: false
    });
    
    setNewTaskTitle('');
    setShowAddModal(false);
    fetchTasks();
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const getPriorityColor = (p: string) => {
    if (p === 'high') return 'text-jarvis-error';
    if (p === 'medium') return 'text-jarvis-warning';
    return 'text-jarvis-success';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white tracking-wide">MISSION OBJECTIVES</h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-jarvis-accent text-black px-4 py-2 rounded-lg font-bold text-sm hover:shadow-[0_0_15px_#00d4ff] transition flex items-center gap-2 animate-heartbeat-cyan"
        >
          <Plus size={18} /> NEW OBJECTIVE
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-jarvis-panel pb-2 overflow-x-auto">
        {['all', 'active', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`uppercase text-xs font-bold tracking-wider px-4 py-2 rounded transition ${
              filter === f ? 'bg-white/10 text-jarvis-accent' : 'text-jarvis-textSec hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <div 
            key={task.id} 
            className={`group bg-jarvis-bgSec border ${task.completed ? 'border-jarvis-panel opacity-60' : 'border-jarvis-accent/20'} rounded-xl p-4 flex items-center gap-4 transition hover:border-jarvis-accent/50`}
          >
            <button 
              onClick={() => handleToggle(task.id, task.completed)}
              className={`shrink-0 ${task.completed ? 'text-jarvis-success' : 'text-jarvis-textSec hover:text-jarvis-accent'}`}
            >
              {task.completed ? <CheckCircle size={24} /> : <Circle size={24} />}
            </button>
            
            <div className="flex-1">
              <h3 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                {task.title}
              </h3>
              <div className="flex items-center gap-4 mt-1">
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-xs text-jarvis-textSec">
                    <CalendarIcon size={12} />
                    <span>{task.dueDate}</span>
                  </div>
                )}
                <div className={`flex items-center gap-1 text-xs font-mono uppercase ${getPriorityColor(task.priority)}`}>
                   <Flag size={12} />
                   <span>{task.priority} Priority</span>
                </div>
              </div>
            </div>

            <button className="text-jarvis-textSec opacity-0 group-hover:opacity-100 hover:text-jarvis-error transition">
              <Trash2 size={18} />
            </button>
          </div>
        ))}

        {filteredTasks.length === 0 && (
           <div className="text-center py-20 text-jarvis-textSec opacity-50">
             <div className="text-4xl mb-2">¯\_(ツ)_/¯</div>
             <p>No objectives found in this sector.</p>
           </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-jarvis-bgSec border border-jarvis-accent/30 rounded-2xl w-full max-w-md p-6 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <h3 className="text-lg font-bold text-jarvis-accent mb-4">Initialize New Objective</h3>
            <form onSubmit={handleAddTask}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-jarvis-textSec uppercase mb-1">Objective Title</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-lg p-3 text-white outline-none"
                    placeholder="e.g. Upgrade firmware"
                  />
                </div>
                <div>
                   <label className="block text-xs text-jarvis-textSec uppercase mb-1">Priority Level</label>
                   <div className="flex gap-2">
                     {['low', 'medium', 'high'].map(p => (
                       <button
                         key={p}
                         type="button"
                         onClick={() => setNewTaskPriority(p as any)}
                         className={`flex-1 py-2 rounded-lg text-xs uppercase font-bold border transition ${
                           newTaskPriority === p 
                             ? 'bg-jarvis-accent text-black border-jarvis-accent' 
                             : 'bg-transparent border-jarvis-panel text-gray-500 hover:border-gray-400'
                         }`}
                       >
                         {p}
                       </button>
                     ))}
                   </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent px-6 py-2 rounded-lg text-sm font-bold hover:bg-jarvis-accent hover:text-black transition animate-heartbeat-green"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};