import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  View,
} from "react-native";
import { palette, radius } from "../../design/tokens";

interface WaveformScrubberProps {
  /** 0..1 progress through the track. */
  value: number;
  /** Called with a new 0..1 ratio when the user seeks (drag end or tap). */
  onChange?: (next: number) => void;
  /** Optional precomputed peaks 0..1 — defaults to a procedural pattern. */
  peaks?: number[];
}

const BAR_COUNT = 96;
const BAR_GAP = 2;
const BAR_MIN_WIDTH = 1.5;
const BAR_MAX_HEIGHT = 18;
const BAR_MIN_HEIGHT = 3;
const HEIGHT = 26;
const THUMB_SIZE = 10;
const HALO = 3;

function proceduralBars(): number[] {
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const t = i / (BAR_COUNT - 1);
    const env = 0.5 + 0.5 * Math.sin(t * Math.PI);
    const detail = 0.5 + 0.5 * Math.sin(i * 1.7) * Math.cos(i * 0.71);
    const h = Math.max(
      BAR_MIN_HEIGHT,
      Math.round(env * BAR_MAX_HEIGHT * (0.4 + 0.6 * detail)),
    );
    out.push(h);
  }
  return out;
}

function peaksToHeights(peaks: number[]): number[] {
  // Resample peaks (any length, 0..1) down to BAR_COUNT heights in px.
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const src = peaks[Math.floor((i / BAR_COUNT) * peaks.length)] ?? 0;
    const clamped = Math.max(0, Math.min(1, src));
    out.push(
      Math.max(BAR_MIN_HEIGHT, Math.round(clamped * BAR_MAX_HEIGHT)),
    );
  }
  return out;
}

/**
 * Waveform-style scrubber. 96 vertical bars span the row; played bars
 * are ink, unplayed are paperEdge. Drag anywhere in the row to seek; the
 * 10px ink thumb scales to 1.4× while dragging.
 */
export function WaveformScrubber({
  value,
  onChange,
  peaks,
}: WaveformScrubberProps) {
  const widthRef = useRef(0);
  const xRef = useRef(0);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);
  const pendingSeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const bars = useMemo(
    () => (peaks ? peaksToHeights(peaks) : proceduralBars()),
    [peaks],
  );

  // Drop pendingSeek once the upstream value has caught up to the seek target
  // — bridges the ~200ms gap between seekTo() returning and the player store
  // polling the new position. Without this, the thumb snaps back to the stale
  // value before the new one arrives, producing a visible flicker.
  useEffect(() => {
    if (pendingSeek == null) return;
    if (Math.abs(value - pendingSeek) < 0.01) {
      setPendingSeek(null);
      if (pendingSeekTimer.current) {
        clearTimeout(pendingSeekTimer.current);
        pendingSeekTimer.current = null;
      }
    }
  }, [value, pendingSeek]);

  useEffect(() => {
    return () => {
      if (pendingSeekTimer.current) clearTimeout(pendingSeekTimer.current);
    };
  }, []);

  const displayValue = Math.max(
    0,
    Math.min(1, dragValue ?? pendingSeek ?? value),
  );
  const playedIdx = Math.floor(displayValue * BAR_COUNT);

  const ratioFromPageX = useCallback((pageX: number): number => {
    const w = widthRef.current;
    if (w <= 0) return 0;
    return Math.max(0, Math.min(1, (pageX - xRef.current) / w));
  }, []);

  const grow = useCallback(() => {
    Animated.timing(thumbScale, {
      toValue: 1.4,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [thumbScale]);

  const shrink = useCallback(() => {
    Animated.timing(thumbScale, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [thumbScale]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        grow();
        setDragValue(ratioFromPageX(e.nativeEvent.pageX));
      },
      onPanResponderMove: (e) => {
        setDragValue(ratioFromPageX(e.nativeEvent.pageX));
      },
      onPanResponderRelease: (e) => {
        const next = ratioFromPageX(e.nativeEvent.pageX);
        onChange?.(next);
        setPendingSeek(next);
        if (pendingSeekTimer.current) clearTimeout(pendingSeekTimer.current);
        // Safety net: if the upstream value never catches up (e.g. seek
        // failed silently), drop pendingSeek so the thumb stops lying.
        pendingSeekTimer.current = setTimeout(() => {
          setPendingSeek(null);
          pendingSeekTimer.current = null;
        }, 1500);
        setDragValue(null);
        shrink();
      },
      onPanResponderTerminate: () => {
        setDragValue(null);
        shrink();
      },
    }),
  ).current;

  function handleLayout(e: LayoutChangeEvent) {
    widthRef.current = e.nativeEvent.layout.width;
    e.target?.measure?.((_x, _y, _w, _h, pageX) => {
      if (typeof pageX === "number") xRef.current = pageX;
    });
  }

  return (
    <View
      onLayout={handleLayout}
      style={{
        height: HEIGHT,
        position: "relative",
        justifyContent: "center",
      }}
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{ now: Math.round(displayValue * 100), min: 0, max: 100 }}
    >
      <View
        pointerEvents="none"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BAR_GAP,
          height: HEIGHT,
        }}
      >
        {bars.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              minWidth: BAR_MIN_WIDTH,
              height: h,
              borderRadius: 1,
              backgroundColor:
                i < playedIdx ? palette.ink : palette.paperEdge,
            }}
          />
        ))}
      </View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: `${displayValue * 100}%`,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          marginLeft: -THUMB_SIZE / 2,
          borderRadius: radius.full,
          backgroundColor: palette.ink,
          borderWidth: HALO,
          borderColor: palette.paper,
          transform: [{ scale: thumbScale }],
        }}
      />
    </View>
  );
}
