import type { Track } from "@aani/types";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface EditTrackModalProps {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    artist: string | null;
    originalBpm: number | null;
  }) => Promise<void>;
}

export default function EditTrackModal({
  track,
  visible,
  onClose,
  onSave,
}: EditTrackModalProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [bpm, setBpm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setArtist(track.artist ?? "");
      setBpm(track.originalBpm != null ? String(track.originalBpm) : "");
      setError("");
    }
  }, [track]);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }

    const parsedBpm = bpm.trim() ? parseFloat(bpm.trim()) : null;
    if (parsedBpm != null && (isNaN(parsedBpm) || parsedBpm <= 0)) {
      setError("BPM must be a positive number");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        title: trimmedTitle,
        artist: artist.trim() || null,
        originalBpm: parsedBpm,
      });
      onClose();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Track</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.save}>Save</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Track title"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Artist</Text>
        <TextInput
          style={styles.input}
          value={artist}
          onChangeText={setArtist}
          placeholder="Artist name"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>BPM</Text>
        <TextInput
          style={styles.input}
          value={bpm}
          onChangeText={setBpm}
          placeholder="e.g. 128"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    marginBottom: 24,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  cancel: {
    color: "#888",
    fontSize: 16,
  },
  save: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 12,
  },
  label: {
    color: "#888",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
});
