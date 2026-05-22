import React from 'react';

export default function ProductSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-3 border border-gray-100 dark:border-white/5 flex flex-col gap-3 min-w-[160px] md:min-w-[200px] animate-pulse">
      <div className="w-full aspect-square bg-gray-100 dark:bg-white/5 rounded-2xl" />
      <div className="space-y-2">
        <div className="h-3 w-3/4 bg-gray-100 dark:bg-white/5 rounded-lg" />
        <div className="h-2 w-1/2 bg-gray-100 dark:bg-white/5 rounded-lg" />
      </div>
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="h-5 w-16 bg-gray-100 dark:bg-white/5 rounded-lg" />
        <div className="h-8 w-16 bg-gray-100 dark:bg-white/5 rounded-xl" />
      </div>
    </div>
  );
}
