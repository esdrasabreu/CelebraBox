import React, { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';

export default function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    if (!targetDate || isNaN(new Date(targetDate).getTime())) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const target = new Date(targetDate);
      
      if (now >= target) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: differenceInDays(target, now),
        hours: differenceInHours(target, now) % 24,
        minutes: differenceInMinutes(target, now) % 60,
        seconds: differenceInSeconds(target, now) % 60
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || isNaN(new Date(targetDate).getTime())) {
    return null;
  }

  return (
    <div className="flex justify-center gap-4 text-center mt-6">
      <div className="flex flex-col items-center bg-white/20 backdrop-blur-md rounded-lg p-3 w-20">
        <span className="text-3xl font-bold text-white">{timeLeft.days}</span>
        <span className="text-xs text-white/80 uppercase tracking-wider">Dias</span>
      </div>
      <div className="flex flex-col items-center bg-white/20 backdrop-blur-md rounded-lg p-3 w-20">
        <span className="text-3xl font-bold text-white">{timeLeft.hours}</span>
        <span className="text-xs text-white/80 uppercase tracking-wider">Horas</span>
      </div>
      <div className="flex flex-col items-center bg-white/20 backdrop-blur-md rounded-lg p-3 w-20">
        <span className="text-3xl font-bold text-white">{timeLeft.minutes}</span>
        <span className="text-xs text-white/80 uppercase tracking-wider">Min</span>
      </div>
      <div className="flex flex-col items-center bg-white/20 backdrop-blur-md rounded-lg p-3 w-20">
        <span className="text-3xl font-bold text-white">{timeLeft.seconds}</span>
        <span className="text-xs text-white/80 uppercase tracking-wider">Seg</span>
      </div>
    </div>
  );
}
