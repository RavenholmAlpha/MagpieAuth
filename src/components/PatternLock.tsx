import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface PatternLockProps {
  onComplete: (pattern: number[]) => void;
  error?: string | null;
  size?: number; // Size of the Grid container
  gridSize?: number; // 3 for 3x3, 4 for 4x4. Default 4.
}

interface Point {
  x: number;
  y: number;
}

export function PatternLock({ onComplete, error, size = 280, gridSize = 4 }: PatternLockProps) {
  const [path, setPath] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const numPoints = gridSize * gridSize;
  const padding = size * 0.15; // padding around grid inside container
  const usableSize = size - padding * 2;
  const step = usableSize / (gridSize - 1);

  useEffect(() => {
    const newPoints: Point[] = [];
    for (let i = 0; i < numPoints; i++) {
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);
      newPoints.push({
        x: padding + col * step,
        y: padding + row * step,
      });
    }
    setPoints(newPoints);
  }, [gridSize, size, padding, step, numPoints]);

  const getTouchedPointIndex = (clientX: number, clientY: number) => {
    if (!containerRef.current) return -1;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Hit radius tolerance
    const hitRadius = step * 0.4;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dx = x - p.x;
      const dy = y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
        return i;
      }
    }
    return -1;
  };

  const startDrawing = (clientX: number, clientY: number) => {
    setIsDrawing(true);
    const index = getTouchedPointIndex(clientX, clientY);
    if (index !== -1) {
      setPath([index]);
    } else {
      setPath([]);
    }
    updateCurrentPos(clientX, clientY);
  };

  const updateCurrentPos = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCurrentPos({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  };

  const moveDrawing = (clientX: number, clientY: number) => {
    if (!isDrawing) return;

    updateCurrentPos(clientX, clientY);

    const index = getTouchedPointIndex(clientX, clientY);
    if (index !== -1) {
      setPath((prev) => {
        if (prev.length === 0) return [index];
        const lastIndex = prev[prev.length - 1];
        if (lastIndex === index) return prev; // Already on this point
        if (prev.includes(index)) return prev; // Cannot revisit a point

        // Optional: calculate intermediate points if skipped (not strictly required, but nice-to-have)
        // For simplicity in a 4x4, we allow any unvisited straight line hop without filling the intermediate dots automatically unless required.
        // E.g. 0 to 2 passes through 1, if 1 isn't selected, select 1 first. Let's do a basic midpoint check.
        
        const lastPos = points[lastIndex];
        const currPos = points[index];
        
        // Midpoint check only works purely if they are directly in line.
        let intermediate = -1;
        
        const c1 = lastIndex % gridSize;
        const r1 = Math.floor(lastIndex / gridSize);
        const c2 = index % gridSize;
        const r2 = Math.floor(index / gridSize);

        if (Math.abs(c1 - c2) === 2 && r1 === r2) {
            intermediate = lastIndex + (c2 > c1 ? 1 : -1); 
        } else if (Math.abs(r1 - r2) === 2 && c1 === c2) {
            intermediate = lastIndex + (r2 > r1 ? gridSize : -gridSize);
        } else if (Math.abs(c1 - c2) === 2 && Math.abs(r1 - r2) === 2) {
            intermediate = lastIndex + (r2 > r1 ? gridSize : -gridSize) + (c2 > c1 ? 1 : -1);
        } else if (gridSize === 4 && Math.abs(c1 - c2) === 3 && r1 === r2) {
            // Special case for 4x4 full row hop (not full midpoint, but usually handled by checking line intersection)
            // Just preventing skips is complex for all 4x4 diagonals, so we'll just check if the point itself is new.
        }

        const newPath = [...prev];
        if (intermediate !== -1 && !newPath.includes(intermediate)) {
            newPath.push(intermediate);
        }

        newPath.push(index);
        return newPath;
      });
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentPos(null);
    if (path.length > 0) {
      onComplete(path);
    }
    // We keep the path visible for a short duration, but caller should clear it or we reset.
    // For now we will leave it, standard pattern locks reset on the next touch.
  };

  // Listen for global mouse up to stop reliably
  useEffect(() => {
    const handleMouseUp = () => stopDrawing();
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDrawing, path]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling while swiping
    startDrawing(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    moveDrawing(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onMouseDown = (e: React.MouseEvent) => {
    startDrawing(e.clientX, e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    moveDrawing(e.clientX, e.clientY);
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={containerRef}
        className="relative select-none touch-none rounded-xl"
        style={{ width: size, height: size }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Draw SVG connections */}
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size}>
          {path.length > 0 && (
            <polyline
              points={path.map(i => `${points[i]?.x},${points[i]?.y}`).join(' ')}
              fill="none"
              stroke={error ? "rgba(239, 68, 68, 0.7)" : "rgba(255, 255, 255, 0.5)"} // red-500 if error
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {isDrawing && currentPos && path.length > 0 && (
            <line
              x1={points[path[path.length - 1]]?.x}
              y1={points[path[path.length - 1]]?.y}
              x2={currentPos.x}
              y2={currentPos.y}
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Draw Interaction Dots */}
        {points.map((p, i) => {
          const isActive = path.includes(i);
          return (
            <div
              key={i}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 pointer-events-none ${
                isActive 
                    ? error 
                        ? "bg-danger shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-125" 
                        : "bg-primary shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-125"
                    : "bg-white/20"
              }`}
              style={{
                left: p.x,
                top: p.y,
                width: size * 0.05,
                height: size * 0.05,
              }}
            >
                {isActive && (
                    <div className={`absolute inset-0 rounded-full scale-50 opacity-100 ${error ? 'bg-danger-text' : 'bg-background'}`}></div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
