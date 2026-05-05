import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDiscogsMatchStore } from "../store/discogsMatch";

export default function DiscogsMatchBanner() {
  const router = useRouter();
  const prompt = useDiscogsMatchStore((s) => s.prompt);
  const dismiss = useDiscogsMatchStore((s) => s.dismissPrompt);
  const undo = useDiscogsMatchStore((s) => s.undoMatch);

  if (!prompt) return null;

  const accent = prompt.kind === "matched" && prompt.type === "wantlist" ? "#ff4d6d" : "#4cd964";

  function openTrack() {
    if (!prompt) return;
    router.push(`/player/${prompt.trackId}`);
    dismiss();
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {prompt.kind === "matched"
              ? `Matched ${prompt.trackTitle}`
              : `${prompt.candidates.length} possible Discogs match${prompt.candidates.length === 1 ? "" : "es"}`}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {prompt.kind === "matched"
              ? `${prompt.label} · ${prompt.type === "collection" ? "in collection" : "in wantlist"}`
              : prompt.trackTitle}
          </Text>
        </View>
        {prompt.kind === "matched" ? (
          <Pressable
            onPress={() => undo(prompt.trackId)}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <Text style={styles.actionText}>Undo</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={openTrack}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <Text style={styles.actionText}>Pick</Text>
          </Pressable>
        )}
        <Pressable onPress={dismiss} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="#888" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 84,
    left: 12,
    right: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    backgroundColor: "#161616",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a2a",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  subtitle: {
    color: "#888",
    fontSize: 12,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#222",
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
