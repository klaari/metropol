import type { Track } from "@aani/types";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform } from "react-native";
import {
  AppBar,
  Button,
  Field,
  Input,
  Screen,
  Text,
  VStack,
  palette,
} from "./ui";

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
      <Screen>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <VStack gap="lg">
            <AppBar
              title="Edit Track"
              onBack={onClose}
              trailing={
                saving ? (
                  <ActivityIndicator color={palette.ink} size="small" />
                ) : undefined
              }
            />

            {error ? (
              <Text variant="caption" tone="critical">
                {error}
              </Text>
            ) : null}

            <Field label="Title">
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Track title"
              />
            </Field>

            <Field label="Artist">
              <Input
                value={artist}
                onChangeText={setArtist}
                placeholder="Artist name"
              />
            </Field>

            <Field label="BPM">
              <Input
                value={bpm}
                onChangeText={setBpm}
                placeholder="e.g. 128"
                keyboardType="decimal-pad"
              />
            </Field>

            <Button
              label={saving ? "Saving" : "Save"}
              onPress={handleSave}
              disabled={saving}
              block
              leading={saving ? <ActivityIndicator color={palette.inkInverse} size="small" /> : null}
            />
          </VStack>
        </KeyboardAvoidingView>
      </Screen>
    </Modal>
  );
}
