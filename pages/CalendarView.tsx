import React from 'react';

export const CalendarView: React.FC = () => {
  const days = Array.from({ length: 35 }, (_, i) => i + 1);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white tracking-wide mb-8">SCHEDULE</h2>
      
      <div className="bg-jarvis-bgSec border border-jarvis-panel rounded-2xl p-6">
        <div className="grid grid-cols-7 gap-4 mb-4">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-bold text-jarvis-textSec uppercase tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-px bg-jarvis-panel/30 border border-jarvis-panel rounded-lg overflow-hidden">
          {days.map(d => {
             const dayNum = d > 30 ? d - 30 : d;
             const isToday = d === 15; // Mock today
             return (
              <div key={d} className={`min-h-[100px] bg-jarvis-bgSec p-2 hover:bg-white/5 transition relative group ${d > 30 ? 'opacity-30' : ''}`}>
                <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-jarvis-accent text-black' : 'text-gray-400'}`}>
                  {dayNum}
                </span>
                {d === 15 && (
                  <div className="mt-2 text-[10px] bg-jarvis-accent/10 border-l-2 border-jarvis-accent text-jarvis-accent p-1 truncate">
                    Mark 42 Test
                  </div>
                )}
                {d === 18 && (
                  <div className="mt-2 text-[10px] bg-purple-500/10 border-l-2 border-purple-500 text-purple-400 p-1 truncate">
                    Pepper's Bday
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
