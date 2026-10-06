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
import { getFechasFestivas } from '../../../services/fechasFestivas';
import { fechaDelAnio } from '../../../utils/fechasFestivas.mjs';
import styles from './fechasStyles.module.css';

const GlobalCalendarView = ({ onChangeView }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [universales, setUniversales] = useState([]);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    // Para simplificar, traemos todo (en un app real se filtraría por mes)
    const { data: uni } = await getFechasFestivas();
    setUniversales((uni || []).filter((f) => f.activo));
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
    // Fechas festivas: cada una con su regla (las móviles cambian de día cada año).
    const iso = `${day.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return universales
      .filter((f) => fechaDelAnio(f.regla, day.getFullYear()) === iso)
      .map((f) => ({ ...f, name: `${f.emoji ? `${f.emoji} ` : ''}${f.nombre}` }));
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div>
          <h2>Calendario Global</h2>
          <p>Fechas festivas de {format(currentDate, 'MMMM yyyy', { locale: es })}.</p>
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

          return (
            <div 
              key={day.toString()} 
              className={`${styles.calendarDay} ${!isCurrentMonth ? styles.emptyDay : ''} ${isDayToday ? styles.today : ''}`}
            >
              <span className={styles.calendarDayNum}>{format(day, dateFormat)}</span>
              
              {unis.map((u, i) => (
                <div key={`u-${i}`} className={`${styles.eventPill} ${styles.universal}`} onClick={() => onChangeView('festivas')}>
                  {u.name}
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
