import React, { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';

export default function CountdownTimer({ targetDate, variant = 'invitation' }: { targetDate: string; variant?: 'invitation' | 'overlay' }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    if (!targetDate || isNaN(new Date(targetDate).getTime())) return;

    const updateTimer = () => {
      const now = new Date();
      const target = new Date(targetDate);

      if (now >= target) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: differenceInDays(target, now),
        hours: differenceInHours(target, now) % 24,
        minutes: differenceInMinutes(target, now) % 60,
        seconds: differenceInSeconds(target, now) % 60
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || isNaN(new Date(targetDate).getTime())) {
    return null;
  }

  const isOverlay = variant === 'overlay';

  const items = [
    { value: timeLeft.days, label: 'Dias' },
    { value: timeLeft.hours, label: 'Horas' },
    { value: timeLeft.minutes, label: 'Minutos' },
    { value: timeLeft.seconds, label: 'Segundos' },
  ];

  return (
    <div
      className={`inline-flex items-center justify-center divide-x ${
        isOverlay
          ? 'divide-white/25 border-y border-white/25 py-3 px-4'
          : 'divide-[#D8CFC0] border-y border-[#D8CFC0] py-3.5 px-4 sm:px-8 bg-[#F6F1E7]/70'
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center px-3 sm:px-6 min-w-[64px] sm:min-w-[84px]">
          <span
            className={`font-invitation-serif text-2xl sm:text-4xl font-semibold tabular-nums leading-none ${
              isOverlay ? 'text-white' : 'text-[#2C241E]'
            }`}
          >
            {String(item.value).padStart(2, '0')}
          </span>
          <span
            className={`mt-1.5 text-[11px] sm:text-xs tracking-[0.16em] font-invitation-sans ${
              isOverlay ? 'text-white/80' : 'text-[#7A6B5D]'
            }`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
