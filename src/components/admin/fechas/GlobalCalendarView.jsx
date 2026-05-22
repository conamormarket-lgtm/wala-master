import React, { useState, useEffect } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import Button from '../../common/Button';
import { getUniversalDates, getOrganizableEvents } from '../../../services/fechasImportantes';
import styles from './fechasStyles.module.css';

const GlobalCalendarView = ({ onChangeView }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [universales, setUniversales] = useState([]);
  const [eventos, setEventos] = useState([]);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    // Para simplificar, traemos todo (en un app real se filtraría por mes)
    const uni = await getUniversalDates();
    const org = await getOrganizableEvents();
    setUniversales(uni);
    setEventos(org);
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Generar grid del mes
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const isUniversalDate = (day) => {
    const d = day.getDate();
    const m = day.getMonth() + 1; // 1-indexed
    return universales.filter(u => u.day === d && u.month === m);
  };

  const isOrganizableEvent = (day) => {
    return eventos.filter(e => {
      if (!e.startDate || !e.endDate) return false;
      const s = new Date(e.startDate).setHours(0,0,0,0);
      const en = new Date(e.endDate).setHours(23,59,59,999);
      const current = day.getTime();
      return current >= s && current <= en;
    });
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div>
          <h2>Calendario Global</h2>
          <p>Visión general de las fechas universales y eventos configurados para {format(currentDate, 'MMMM yyyy', { locale: es })}.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Button variant="secondary" onClick={prevMonth}>Anterior</Button>
          <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </span>
          <Button variant="secondary" onClick={nextMonth}>Siguiente</Button>
        </div>
      </div>

      <div className={styles.calendarGrid}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className={styles.calendarHeader}>{day}</div>
        ))}

        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isDayToday = isToday(day);
          const unis = isUniversalDate(day);
          const orgs = isOrganizableEvent(day);

          return (
            <div 
              key={day.toString()} 
              className={`${styles.calendarDay} ${!isCurrentMonth ? styles.emptyDay : ''} ${isDayToday ? styles.today : ''}`}
            >
              <span className={styles.calendarDayNum}>{format(day, dateFormat)}</span>
              
              {unis.map((u, i) => (
                <div key={`u-${i}`} className={`${styles.eventPill} ${styles.universal}`} onClick={() => onChangeView('universales')}>
                  🌎 {u.name}
                </div>
              ))}

              {orgs.map((o, i) => (
                <div key={`o-${i}`} className={`${styles.eventPill} ${styles.organizable}`} onClick={() => onChangeView('eventos')}>
                  🎁 {o.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GlobalCalendarView;
