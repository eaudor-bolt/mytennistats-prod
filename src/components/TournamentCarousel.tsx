import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tournament } from '../lib/supabase';
import { TournamentCard } from './TournamentCard';

type TournamentCarouselProps = {
  tournaments: Tournament[];
  selectedTournamentId: string | null;
  onSelectTournament: (id: string) => void;
  onRegistrationChange?: () => void;
};

export function TournamentCarousel({
  tournaments,
  selectedTournamentId,
  onSelectTournament,
  onRegistrationChange,
}: TournamentCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  useEffect(() => {
    const selectedIndex = tournaments.findIndex(t => t.id === selectedTournamentId);
    if (selectedIndex !== -1 && selectedIndex !== currentIndex) {
      setCurrentIndex(selectedIndex);
    }
  }, [selectedTournamentId, tournaments]);

  const handlePrevious = () => {
    if (currentIndex === 0) return;
    setOffsetX(100);
    setTimeout(() => {
      setCurrentIndex(prev => prev - 1);
      setOffsetX(0);
    }, 50);
  };

  const handleNext = () => {
    if (currentIndex === tournaments.length - 1) return;
    setOffsetX(-100);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setOffsetX(0);
    }, 50);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    setOffsetX((diff / window.innerWidth) * 100);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const diff = currentX.current - startX.current;
    const threshold = window.innerWidth * 0.2;

    if (diff > threshold && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      onSelectTournament(tournaments[currentIndex - 1].id);
    } else if (diff < -threshold && currentIndex < tournaments.length - 1) {
      setCurrentIndex(prev => prev + 1);
      onSelectTournament(tournaments[currentIndex + 1].id);
    }

    setOffsetX(0);
  };

  if (tournaments.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No tournaments found
      </div>
    );
  }

  const currentTournament = tournaments[currentIndex];
  const prevTournament = currentIndex > 0 ? tournaments[currentIndex - 1] : null;
  const nextTournament = currentIndex < tournaments.length - 1 ? tournaments[currentIndex + 1] : null;

  return (
    <div
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative overflow-hidden w-full max-w-full">
        {/* Previous Card */}
        {prevTournament && (
          <div
            className="absolute top-0 left-0 w-full transition-transform duration-300"
            style={{
              transform: `translateX(calc(-100% + ${offsetX}%))`,
              opacity: offsetX > 0 ? 1 : 0,
              pointerEvents: offsetX > 0 ? 'auto' : 'none',
            }}
          >
            <TournamentCard
              tournament={prevTournament}
              isSelected={false}
              onClick={() => {}}
              onRegistrationChange={onRegistrationChange}
            />
          </div>
        )}

        {/* Current Card */}
        <div
          className={`w-full ${isDragging ? '' : 'transition-transform duration-300'}`}
          style={{
            transform: `translateX(${offsetX}%)`,
          }}
        >
          <TournamentCard
            tournament={currentTournament}
            isSelected={true}
            onClick={() => {
              const lat = Number(currentTournament.latitude);
              const lng = Number(currentTournament.longitude);

              if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                onSelectTournament(currentTournament.id);
              }
            }}
            onRegistrationChange={onRegistrationChange}
          />
        </div>

        {/* Next Card */}
        {nextTournament && (
          <div
            className="absolute top-0 left-0 w-full transition-transform duration-300"
            style={{
              transform: `translateX(calc(100% + ${offsetX}%))`,
              opacity: offsetX < 0 ? 1 : 0,
              pointerEvents: offsetX < 0 ? 'auto' : 'none',
            }}
          >
            <TournamentCard
              tournament={nextTournament}
              isSelected={false}
              onClick={() => {}}
              onRegistrationChange={onRegistrationChange}
            />
          </div>
        )}
      </div>

      {/* Navigation Buttons - Always visible on cards */}
      <button
        onClick={handlePrevious}
        disabled={currentIndex === 0}
        className="absolute left-2 top-[45%] -translate-y-1/2 p-2 sm:p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition z-20"
        aria-label="Previous tournament"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
      </button>

      <button
        onClick={handleNext}
        disabled={currentIndex === tournaments.length - 1}
        className="absolute right-2 top-[45%] -translate-y-1/2 p-2 sm:p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition z-20"
        aria-label="Next tournament"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
      </button>

      {/* Progress Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-lg z-10">
        <span className="text-sm font-medium text-gray-700">
          {currentIndex + 1} / {tournaments.length}
        </span>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {tournaments.slice(0, Math.min(10, tournaments.length)).map((_, index) => (
          <button
            key={index}
            onClick={() => {
              if (index !== currentIndex) {
                setCurrentIndex(index);
              }
            }}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'w-8 bg-green-500'
                : 'w-2 bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to tournament ${index + 1}`}
          />
        ))}
        {tournaments.length > 10 && (
          <span className="text-xs text-gray-500 ml-1">+{tournaments.length - 10}</span>
        )}
      </div>
    </div>
  );
}
