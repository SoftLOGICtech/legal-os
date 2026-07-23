import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function CalendarTab({
  calendar,
  upcoming48h,
  setEditingEvent,
  setNewEventForm,
  setShowAddEventModal,
  handleDeleteEvent,
  caseId = null
}) {
  const [advocateFilter, setAdvocateFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Controlled view & date states to resolve unresponsiveness issues
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());

  // Derive unique advocates
  const allAdvocates = useMemo(() => {
    const adv = new Set();
    calendar.forEach(ev => {
      if (ev.assigned_lawyer) adv.add(ev.assigned_lawyer);
    });
    return Array.from(adv);
  }, [calendar]);

  // Filter events by advocate, search query, and caseId
  const filteredEvents = useMemo(() => {
    let eventsToFilter = calendar;
    if (caseId) {
      eventsToFilter = eventsToFilter.filter(ev => ev.case_id === caseId);
    } else if (advocateFilter !== 'All') {
      eventsToFilter = eventsToFilter.filter(ev => ev.assigned_lawyer === advocateFilter);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      eventsToFilter = eventsToFilter.filter(ev => 
        (ev.event_title && ev.event_title.toLowerCase().includes(q)) ||
        (ev.case_title && ev.case_title.toLowerCase().includes(q)) ||
        (ev.notes && ev.notes.toLowerCase().includes(q)) ||
        (ev.assigned_lawyer && ev.assigned_lawyer.toLowerCase().includes(q))
      );
    }
    
    return eventsToFilter.map(ev => {
      const startDate = new Date(ev.event_date);
      // Default to 1-hour duration as per user approval
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      
      const advocateLabel = ev.assigned_lawyer ? ` [${ev.assigned_lawyer}]` : '';
      const caseLabel = ev.case_title ? ` (${ev.case_title})` : '';
      
      return {
        id: ev.id,
        title: `${ev.event_title}${caseLabel}${advocateLabel}`,
        start: startDate,
        end: endDate,
        allDay: false,
        resource: ev
      };
    });
  }, [calendar, advocateFilter, caseId, searchQuery]);

  // Collision detection: Find if the currently filtered advocate (or any if 'All') has >=2 events on same day
  const collisions = useMemo(() => {
    if (caseId) return []; // No collision warnings for case-specific calendar
    const dayMap = {};
    const conflicts = [];
    const eventsToCheck = advocateFilter === 'All' ? calendar : calendar.filter(ev => ev.assigned_lawyer === advocateFilter);
    
    eventsToCheck.forEach(ev => {
      const dayKey = new Date(ev.event_date).toDateString();
      const lawyer = ev.assigned_lawyer || 'Unassigned';
      const key = `${dayKey}_${lawyer}`;
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push(ev);
    });
    
    for (const key in dayMap) {
      if (dayMap[key].length > 1 && key.split('_')[1] !== 'Unassigned') {
        conflicts.push({ day: key.split('_')[0], lawyer: key.split('_')[1], events: dayMap[key] });
      }
    }
    return conflicts;
  }, [calendar, advocateFilter, caseId]);

  // Click empty slot/day to add event
  const handleSelectSlot = ({ start }) => {
    setEditingEvent(null);
    // Format date as YYYY-MM-DDTHH:MM for datetime-local inputs
    const localDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
      
    setNewEventForm({
      case_id: caseId || '',
      event_title: '',
      event_type: 'mention',
      event_date: localDate,
      notes: ''
    });
    setShowAddEventModal(true);
  };

  // Click existing event to edit/delete
  const handleSelectEvent = (event) => {
    const ev = event.resource;
    // Format date as YYYY-MM-DDTHH:MM for input
    const localDate = new Date(new Date(ev.event_date).getTime() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setEditingEvent(ev);
    setNewEventForm({
      case_id: ev.case_id || '',
      event_title: ev.event_title || '',
      event_type: ev.event_type || 'mention',
      event_date: localDate,
      notes: ev.notes || ''
    });
    setShowAddEventModal(true);
  };

  // Custom styling for events
  const eventPropGetter = (event) => {
    let backgroundColor = 'var(--gold-500)';
    const type = event.resource.event_type;
    
    if (type === 'hearing') {
      backgroundColor = '#ef5350'; // Red for hearing
    } else if (type === 'mention') {
      backgroundColor = '#4db6ac'; // Teal for mention
    } else if (type === 'ruling' || type === 'judgment') {
      backgroundColor = '#ab47bc'; // Purple for ruling/judgment
    } else if (type === 'consultation') {
      backgroundColor = '#ff9800'; // Orange for consultation
    } else if (type === 'meeting') {
      backgroundColor = '#0288d1'; // Blue for meeting
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'var(--navy-900)',
        border: 'none',
        display: 'block',
        fontSize: '0.8rem',
        fontWeight: '600',
        padding: '3px 6px'
      }
    };
  };

  const handleExportICS = () => {
    if (!calendar || calendar.length === 0) {
      alert('No events to export.');
      return;
    }
    
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sam Ogola Advocates//LegalOS//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    
    calendar.forEach(ev => {
      const start = new Date(ev.event_date);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
      
      const formatICSDate = (date) => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };
      
      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `UID:${ev.id}@samogolaadvocates.co.ke\r\n`;
      icsContent += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
      icsContent += `DTSTART:${formatICSDate(start)}\r\n`;
      icsContent += `DTEND:${formatICSDate(end)}\r\n`;
      icsContent += `SUMMARY:${ev.event_title || 'Court Mention'}\r\n`;
      
      const description = `${ev.notes || ''} (Advocate: ${ev.assigned_lawyer || 'Sam Ogola'})`
        .replace(/\\/g, "\\\\")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
      icsContent += `DESCRIPTION:${description}\r\n`;
      icsContent += "END:VEVENT\r\n";
    });
    
    icsContent += "END:VCALENDAR\r\n";
    
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soca_court_schedule_${new Date().toISOString().slice(0,10)}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center', flexWrap:'wrap', gap:'10px'}}>
        <h3 style={{fontSize:'1.2rem',color:'var(--gold-400)', margin:0}}>
          {caseId ? '📅 Case Schedule & Calendar' : '⚖️ Court Calendar'}
        </h3>
        <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
          <input
            type="text"
            placeholder="🔍 Search events..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{background:'var(--navy-900)', border:'1px solid var(--border-default)', color:'white', padding:'8px 12px', borderRadius:'6px', fontSize:'0.82rem'}}
          />
          {!caseId && (
            <select className="input-field" style={{padding:'8px 12px', margin:0, width:'auto', background:'var(--navy-900)'}} 
                    value={advocateFilter} onChange={e => setAdvocateFilter(e.target.value)}>
              <option value="All">All Advocates</option>
              {allAdvocates.map(adv => <option key={adv} value={adv}>{adv}</option>)}
            </select>
          )}
          <button className="secondary-btn" onClick={handleExportICS} style={{borderColor:'var(--gold-500)', color:'var(--gold-400)', margin:0}}>
            📅 Export to Phone (.ics)
          </button>
          <button className="primary-btn" onClick={() => { 
            setEditingEvent(null); 
            const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setNewEventForm({case_id:caseId || '', event_title:'', event_type:'mention', event_date:localDate, notes:''}); 
            setShowAddEventModal(true); 
          }}>
            + Add {caseId ? 'Case Event' : 'Court Date'}
          </button>
        </div>
      </div>

      {collisions.length > 0 && (
        <div style={{background:'rgba(239,83,80,0.1)',border:'1px solid rgba(239,83,80,0.4)',borderRadius:'6px',padding:'10px 16px'}}>
          <strong style={{color:'#ef5350',fontSize:'0.85rem'}}>⚠️ Collision Warning</strong>
          <p style={{color:'var(--text-secondary)', fontSize:'0.8rem', margin:'5px 0'}}>The following advocates are double-booked on the same day:</p>
          {collisions.map((c, i) => (
            <div key={i} style={{fontSize:'0.8rem',marginTop:'4px',color:'var(--text-primary)'}}>
              🔴 <strong>{c.lawyer}</strong> on {c.day} ({c.events.length} events)
            </div>
          ))}
        </div>
      )}

      {upcoming48h.length > 0 && advocateFilter === 'All' && (
        <div style={{background:'rgba(255,152,0,0.1)',border:'1px solid rgba(255,152,0,0.4)',borderRadius:'6px',padding:'10px 16px'}}>
          <strong style={{color:'#ff9800',fontSize:'0.85rem'}}>⚠️ URGENT — Events within 48 hours</strong>
          {upcoming48h.map(ev => (
            <div key={ev.id} style={{fontSize:'0.8rem',marginTop:'6px',color:'var(--text-primary)'}}>
              ⚡ <strong>{ev.event_title}</strong> — {ev.client_name} ({ev.case_title}) — {new Date(ev.event_date).toLocaleString('en-KE')}
            </div>
          ))}
        </div>
      )}

      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'12px', padding:'24px', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', height:'650px'}}>
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          style={{ height: '100%', color: 'white' }}
          views={['month', 'week', 'day', 'agenda']}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
        />
      </div>
    </div>
  );
}
