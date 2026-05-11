import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { palette, radius, space } from "../../design/tokens";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

interface TempoClusterProps {
  /** Track's original BPM. Null if unknown — the readout shows "—". */
  originalBpm: number | null;
  /** Current playback rate, e.g. 1.005. */
  rate: number;
  /** Called with a rate delta, e.g. +0.005 / -0.005. */
  onAdjust: (delta: number) => void;
  /** Called to restore rate=1.0. */
  onReset: () => void;
  /** Range label shown in the header right slot when rate=1. Default "±8% range". */
  rangeLabel?: string;
}

const STEPPER_SIZE = 52;
const HEADER_MIN_HEIGHT = 32;
const RIGHT_SLOT_MIN_HEIGHT = 28;
const READOUT_MIN_HEIGHT = 52;

function formatRate(rate: number): string {
  const pct = Math.round((rate - 1) * 1000) / 10;
  if (pct === 0) return "0.0%";
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  return `${pct.toFixed(1)}%`;
}

/**
 * Tempo cluster — TEMPO eyebrow above a hairline divider, then [−] BPM
 * readout [+]. The header's right slot reserves 28px and swaps a range
 * caption for a Reset affordance when the rate is altered. No card chrome:
 * the cluster sits directly on paper.
 */
export function TempoCluster({
  originalBpm,
  rate,
  onAdjust,
  onReset,
  rangeLabel = "±8% range",
}: TempoClusterProps) {
  const altered = rate !== 1;
  const currentBpm =
    originalBpm != null
      ? Math.round(originalBpm * rate * 10) / 10
      : null;
  const rateDisplay = formatRate(rate);
  const numberColor = altered ? palette.cobalt : palette.ink;
  const subColor = altered ? palette.cobalt : palette.inkMuted;

  return (
    <View style={{ gap: space.xs }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: space.sm,
          paddingRight: space.xs,
          minHeight: HEADER_MIN_HEIGHT,
        }}
      >
        <Text variant="eyebrow" tone="muted">
          Tempo
        </Text>
        <View
          style={{
            minHeight: RIGHT_SLOT_MIN_HEIGHT,
            justifyContent: "center",
          }}
        >
          {altered ? (
            <Pressable
              onPress={onReset}
              accessibilityLabel="Reset tempo"
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                paddingVertical: 2,
                paddingHorizontal: space.xs,
                borderRadius: radius.md,
              }}
            >
              <Ionicons
                name="refresh-outline"
                size={12}
                color={palette.cobalt}
              />
              <Text
                variant="bodyStrong"
                tone="accent"
                style={{ fontSize: 12 }}
              >
                Reset
              </Text>
            </Pressable>
          ) : (
            <Text
              variant="numeric"
              tone="muted"
              style={{ fontSize: 11 }}
            >
              {rangeLabel}
            </Text>
          )}
        </View>
      </View>

      {/* Row */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.paperEdge,
          paddingTop: space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
        }}
      >
        <Pressable
          onPress={() => onAdjust(-0.005)}
          accessibilityLabel="Slower"
          accessibilityRole="button"
          style={{
            width: STEPPER_SIZE,
            height: STEPPER_SIZE,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: palette.paperEdge,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="remove" size={20} color={palette.ink} />
        </Pressable>

        <View
          style={{
            flex: 1,
            minHeight: READOUT_MIN_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: space.xs + 2,
            }}
          >
            <Text
              variant="titleLg"
              numeric
              style={{ fontSize: 26, lineHeight: 28, color: numberColor }}
            >
              {currentBpm != null ? currentBpm.toFixed(1) : "—"}
            </Text>
            <Text
              variant="eyebrow"
              tone="muted"
              style={{ fontSize: 10 }}
            >
              BPM
            </Text>
          </View>
          <Text
            variant="numeric"
            style={{ fontSize: 11, color: subColor }}
          >
            {altered && originalBpm != null
              ? `${rateDisplay} from ${originalBpm.toFixed(1)}`
              : rateDisplay}
          </Text>
        </View>

        <Pressable
          onPress={() => onAdjust(0.005)}
          accessibilityLabel="Faster"
          accessibilityRole="button"
          style={{
            width: STEPPER_SIZE,
            height: STEPPER_SIZE,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: palette.paperEdge,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={20} color={palette.ink} />
        </Pressable>
      </View>
    </View>
  );
}
