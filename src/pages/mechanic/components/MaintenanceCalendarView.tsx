/**
 * Maintenance Calendar View Component (Phase 3)
 * 
 * Shows a calendar view of scheduled maintenance across the fleet.
 * Helps mechanics plan shop time and parts ordering.
 */

import { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Droplet,
  RefreshCw,
} from 'lucide-react';
import type { VehicleMaintenanceInfo } from '../types/maintenance.types';
import { getUrgencyConfig } from '../utils/maintenanceConstants';

// =============================================================================
// TYPES
// =============================================================================

interface MaintenanceCalendarViewProps {
  vehicles: VehicleMaintenanceInfo[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  scheduledMaintenance: ScheduledItem[];
}

interface ScheduledItem {
  truckNumber: string;
  type: 'oil_change' | 'tire_rotation' | 'tire_replacement';
  urgency: 'overdue' | 'due_soon' | 'upcoming';
  estimatedDate: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getMonthDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const days: CalendarDay[] = [];
  
  // Add days from previous month to fill first week
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
      scheduledMaintenance: [],
    });
  }
  
  // Add days of current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
      scheduledMaintenance: [],
    });
  }
  
  // Add days from next month to complete last week
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        scheduledMaintenance: [],
      });
    }
  }
  
  return days;
}

function estimateMaintenanceDate(
  currentMileage: number,
  lastServiceMileage: number,
  interval: number,
  avgMilesPerDay: number = 100 // Default estimate
): Date {
  const milesRemaining = interval - (currentMileage - lastServiceMileage);
  const daysUntilDue = Math.max(0, Math.floor(milesRemaining / avgMilesPerDay));
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysUntilDue);
  return estimatedDate;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MaintenanceCalendarView({ vehicles }: MaintenanceCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState<'all' | 'oil_change' | 'tire_rotation'>('all');
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Calculate scheduled maintenance items
  const scheduledItems = useMemo(() => {
    const items: ScheduledItem[] = [];
    
    for (const vehicle of vehicles) {
      // Oil change
      if (vehicle.oilChangeStatus.urgency !== 'ok') {
        const estimatedDate = estimateMaintenanceDate(
          vehicle.currentMileage,
          vehicle.oilChangeStatus.lastServiceMileage,
          vehicle.oilChangeStatus.intervalMiles
        );
        items.push({
          truckNumber: vehicle.truckNumber,
          type: 'oil_change',
          urgency: vehicle.oilChangeStatus.urgency as 'overdue' | 'due_soon' | 'upcoming',
          estimatedDate,
        });
      }
      
      // Tire rotation
      if (vehicle.tireRotationStatus.urgency !== 'ok') {
        const estimatedDate = estimateMaintenanceDate(
          vehicle.currentMileage,
          vehicle.tireRotationStatus.lastServiceMileage,
          vehicle.tireRotationStatus.intervalMiles
        );
        items.push({
          truckNumber: vehicle.truckNumber,
          type: 'tire_rotation',
          urgency: vehicle.tireRotationStatus.urgency as 'overdue' | 'due_soon' | 'upcoming',
          estimatedDate,
        });
      }
    }
    
    return items;
  }, [vehicles]);
  
  // Get calendar days with scheduled maintenance
  const calendarDays = useMemo(() => {
    const days = getMonthDays(year, month);
    
    // Assign maintenance items to days
    for (const item of scheduledItems) {
      if (selectedType !== 'all' && item.type !== selectedType) continue;
      
      const itemDate = item.estimatedDate;
      const dayIndex = days.findIndex(d => 
        d.date.getFullYear() === itemDate.getFullYear() &&
        d.date.getMonth() === itemDate.getMonth() &&
        d.date.getDate() === itemDate.getDate()
      );
      
      if (dayIndex !== -1) {
        days[dayIndex].scheduledMaintenance.push(item);
      }
    }
    
    return days;
  }, [year, month, scheduledItems, selectedType]);
  
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  return (
    <div className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#ff9350]/8 to-transparent border-b border-white/5">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#ff9350]" />
          <h3 className="text-sm font-semibold text-white">Maintenance Calendar</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Type Filter */}
          <div className="flex gap-1 p-0.5 bg-black/30 rounded-lg">
            {[
              { id: 'all', label: 'All' },
              { id: 'oil_change', label: 'Oil', icon: Droplet },
              { id: 'tire_rotation', label: 'Tires', icon: RefreshCw },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedType(id as typeof selectedType)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  selectedType === id
                    ? 'bg-[#ff9350] text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <button
          onClick={goToPrevMonth}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{monthName}</span>
          <button
            onClick={goToToday}
            className="px-2 py-0.5 rounded text-[10px] font-medium text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            Today
          </button>
        </div>
        
        <button
          onClick={goToNextMonth}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {/* Calendar Grid */}
      <div className="p-3">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-medium text-white/40 py-1">
              {day}
            </div>
          ))}
        </div>
        
        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const hasItems = day.scheduledMaintenance.length > 0;

            return (
              <div
                key={index}
                className={`relative min-h-[60px] rounded-lg p-1 transition-colors ${
                  day.isToday 
                    ? 'bg-[#ff9350]/20 border border-[#ff9350]/30' 
                    : day.isCurrentMonth 
                      ? 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]' 
                      : 'opacity-30'
                }`}
              >
                {/* Date Number */}
                <span className={`text-[10px] font-medium ${
                  day.isToday ? 'text-[#ff9350]' : 'text-white/50'
                }`}>
                  {day.date.getDate()}
                </span>
                
                {/* Maintenance Items */}
                {hasItems && (
                  <div className="mt-1 space-y-0.5">
                    {day.scheduledMaintenance.slice(0, 3).map((item, idx) => {
                      const urgencyConfig = getUrgencyConfig(item.urgency);
                      const Icon = item.type === 'oil_change' ? Droplet : RefreshCw;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] ${urgencyConfig.bgColor} ${urgencyConfig.textColor}`}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          <span className="truncate">{item.truckNumber}</span>
                        </div>
                      );
                    })}
                    {day.scheduledMaintenance.length > 3 && (
                      <span className="text-[8px] text-white/40 px-1">
                        +{day.scheduledMaintenance.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-white/50">Overdue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-white/50">Due Soon</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-white/50">Upcoming</span>
        </div>
      </div>
    </div>
  );
}
