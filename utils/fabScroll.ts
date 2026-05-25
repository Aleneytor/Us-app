type FabScrollListener = (compact: boolean) => void;

const listeners = new Set<FabScrollListener>();
let compact = false;
let lastY = 0;

const MIN_DELTA = 7;
const TOP_RESET = 12;

function setCompact(nextCompact: boolean) {
  if (nextCompact === compact) return;
  compact = nextCompact;
  listeners.forEach((listener) => listener(compact));
}

export function subscribeFabScroll(listener: FabScrollListener) {
  listeners.add(listener);
  listener(compact);
  return () => {
    listeners.delete(listener);
  };
}

export function reportFabScroll(y: number) {
  const nextY = Math.max(0, y);
  const delta = nextY - lastY;

  if (nextY <= TOP_RESET) {
    setCompact(false);
  } else if (delta > MIN_DELTA) {
    setCompact(true);
  } else if (delta < -MIN_DELTA) {
    setCompact(false);
  }

  lastY = nextY;
}
