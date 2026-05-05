import type { DiscogsMetadata } from "@aani/db";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import {
  Button,
  Cluster,
  Divider,
  HStack,
  IconButton,
  Input,
  Pressable,
  Surface,
  Text,
  VStack,
  border,
  palette,
  radius,
  space,
  typeScale,
} from "./ui";

type SearchResult = {
  id: number;
  title: string;
  year?: string;
  thumb?: string;
  cover_image?: string;
  country?: string;
  format?: string[];
  label?: string[];
  catno?: string;
  genre?: string[];
  style?: string[];
  user_data?: { in_collection: boolean; in_wantlist: boolean };
};

type TrackEnrichment = {
  metadata: DiscogsMetadata | null;
  inCollection: boolean;
  inWantlist: boolean;
  wantlistNote?: string | null;
};

interface Props {
  visible: boolean;
  trackId: string | null;
  defaultQuery: string;
  onClose: () => void;
  onEnrichmentChange?: (data: TrackEnrichment) => void;
}

function flash(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

export default function DiscogsSheet({
  visible,
  trackId,
  defaultQuery,
  onClose,
  onEnrichmentChange,
}: Props) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [enrichment, setEnrichment] = useState<TrackEnrichment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pendingReleaseId, setPendingReleaseId] = useState<string | null>(null);
  const [wantlistNote, setWantlistNote] = useState("");
  const [savingWantlistNote, setSavingWantlistNote] = useState(false);
  const [togglingCollection, setTogglingCollection] = useState(false);
  const [togglingWantlist, setTogglingWantlist] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const close = useCallback(() => {
    setEnrichment(null);
    setLoadError(null);
    setSearchMode(false);
    setResults([]);
    setQuery("");
    setPendingReleaseId(null);
    onClose();
  }, [onClose]);

  const propagate = useCallback(
    (next: TrackEnrichment) => {
      setEnrichment(next);
      setWantlistNote(next.wantlistNote ?? "");
      onEnrichmentChange?.(next);
    },
    [onEnrichmentChange],
  );

  const refresh = useCallback(async () => {
    if (!trackId) return;
    const token = await getTokenRef.current();
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await apiFetch<TrackEnrichment>(
        `/discogs/track/${trackId}`,
        token,
      );
      if (error) {
        setLoadError(error);
        setSearchMode(true);
      } else if (data) {
        propagate(data);
        setSearchMode(!data.metadata);
      }
    } finally {
      setLoading(false);
    }
  }, [trackId, propagate]);

  useEffect(() => {
    if (visible && trackId) {
      setQuery(defaultQuery.trim());
      refresh();
    }
    // Parent playback updates every second; visible/trackId are the actual refresh triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, trackId]);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    const token = await getTokenRef.current();
    if (!token) return;
    setSearching(true);
    try {
      const { data, error } = await apiFetch<{ results: SearchResult[] }>(
        `/discogs/search?q=${encodeURIComponent(q)}`,
        token,
      );
      if (error) Alert.alert("Search failed", error);
      else setResults(data?.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function pickMatch(result: SearchResult) {
    if (!trackId) return;
    const token = await getTokenRef.current();
    if (!token) return;
    setPendingReleaseId(String(result.id));
    try {
      const { data, error } = await apiFetch<TrackEnrichment>(
        `/discogs/enrich`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ trackId, releaseId: String(result.id) }),
        },
      );
      if (error) Alert.alert("Enrichment failed", error);
      else if (data) {
        propagate(data);
        setSearchMode(false);
        flash("Enriched from Discogs");
      }
    } finally {
      setPendingReleaseId(null);
    }
  }

  async function toggleCollection() {
    if (!enrichment?.metadata || !trackId) return;
    const token = await getTokenRef.current();
    if (!token) return;
    const releaseId = enrichment.metadata.releaseId;
    setTogglingCollection(true);
    try {
      if (enrichment.inCollection) {
        const { error } = await apiFetch(
          `/discogs/collection/${encodeURIComponent(releaseId)}`,
          token,
          { method: "DELETE" },
        );
        if (error) Alert.alert("Couldn't remove from collection", error);
        else flash("Removed from collection");
      } else {
        const { error } = await apiFetch(`/discogs/collection`, token, {
          method: "POST",
          body: JSON.stringify({ releaseId }),
        });
        if (error) Alert.alert("Couldn't add to collection", error);
        else flash("Added to collection");
      }
      await refresh();
    } finally {
      setTogglingCollection(false);
    }
  }

  async function toggleWantlist() {
    if (!enrichment?.metadata || !trackId) return;
    const token = await getTokenRef.current();
    if (!token) return;
    const releaseId = enrichment.metadata.releaseId;
    setTogglingWantlist(true);
    try {
      if (enrichment.inWantlist) {
        const { error } = await apiFetch(
          `/discogs/wantlist/${encodeURIComponent(releaseId)}`,
          token,
          { method: "DELETE" },
        );
        if (error) Alert.alert("Couldn't remove from wantlist", error);
        else flash("Removed from wantlist");
      } else {
        const { error } = await apiFetch(`/discogs/wantlist`, token, {
          method: "POST",
          body: JSON.stringify({
            releaseId,
            note: wantlistNote.trim() || undefined,
          }),
        });
        if (error) Alert.alert("Couldn't add to wantlist", error);
        else flash("Added to wantlist");
      }
      await refresh();
    } finally {
      setTogglingWantlist(false);
    }
  }

  async function saveWantlistNote() {
    if (!enrichment?.metadata) return;
    const token = await getTokenRef.current();
    if (!token) return;
    const releaseId = enrichment.metadata.releaseId;
    setSavingWantlistNote(true);
    try {
      const { error } = await apiFetch(`/discogs/wantlist`, token, {
        method: "POST",
        body: JSON.stringify({
          releaseId,
          note: wantlistNote.trim() || null,
        }),
      });
      if (error) Alert.alert("Couldn't save note", error);
      else {
        flash("Note saved");
        await refresh();
      }
    } finally {
      setSavingWantlistNote(false);
    }
  }

  async function removeEnrichment() {
    if (!trackId) return;
    const token = await getTokenRef.current();
    if (!token) return;
    const { error } = await apiFetch(
      `/discogs/track/${trackId}/enrichment`,
      token,
      { method: "DELETE" },
    );
    if (error) {
      Alert.alert("Couldn't clear enrichment", error);
      return;
    }
    propagate({ metadata: null, inCollection: false, inWantlist: false });
    setSearchMode(true);
    flash("Discogs match cleared");
  }

  const metadata = enrichment?.metadata ?? null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={close}
    >
      <Pressable
        flat
        style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.45)" }}
        onPress={close}
      />
      <Surface
        tone="raised"
        lift="sheet"
        rounded="xl"
        pad="md"
        style={{
          position: "absolute",
          bottom: kbHeight,
          left: 0,
          right: 0,
          maxHeight: "85%",
          minHeight: "55%",
        }}
      >
        <VStack gap="md" flex>
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: palette.paperEdge,
            }}
          />
          <HStack justify="between">
            <Text variant="title">Discogs</Text>
            <IconButton icon="close" accessibilityLabel="Close Discogs" onPress={close} />
          </HStack>

          {loading ? (
            <VStack flex justify="center" align="center">
              <ActivityIndicator color={palette.ink} />
            </VStack>
          ) : loadError ? (
            <VStack flex justify="center" align="center" gap="md">
              <Text variant="bodyStrong">Couldn't load Discogs data</Text>
              <Text variant="caption" tone="muted" align="center">
                {loadError}
              </Text>
              <Button label="Retry" variant="secondary" onPress={refresh} />
            </VStack>
          ) : !searchMode && metadata ? (
            <ReleaseView
              metadata={metadata}
              enrichment={enrichment}
              wantlistNote={wantlistNote}
              setWantlistNote={setWantlistNote}
              savingWantlistNote={savingWantlistNote}
              saveWantlistNote={saveWantlistNote}
              togglingCollection={togglingCollection}
              togglingWantlist={togglingWantlist}
              toggleCollection={toggleCollection}
              toggleWantlist={toggleWantlist}
              startSearch={() => {
                setSearchMode(true);
                setResults([]);
                setQuery(defaultQuery.trim());
              }}
              removeEnrichment={removeEnrichment}
            />
          ) : (
            <SearchView
              query={query}
              setQuery={setQuery}
              searching={searching}
              runSearch={runSearch}
              results={results}
              pendingReleaseId={pendingReleaseId}
              pickMatch={pickMatch}
            />
          )}
        </VStack>
      </Surface>
    </Modal>
  );
}

function ReleaseView({
  metadata,
  enrichment,
  wantlistNote,
  setWantlistNote,
  savingWantlistNote,
  saveWantlistNote,
  togglingCollection,
  togglingWantlist,
  toggleCollection,
  toggleWantlist,
  startSearch,
  removeEnrichment,
}: {
  metadata: DiscogsMetadata;
  enrichment: TrackEnrichment | null;
  wantlistNote: string;
  setWantlistNote: (value: string) => void;
  savingWantlistNote: boolean;
  saveWantlistNote: () => void;
  togglingCollection: boolean;
  togglingWantlist: boolean;
  toggleCollection: () => void;
  toggleWantlist: () => void;
  startSearch: () => void;
  removeEnrichment: () => void;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: space.xl, gap: space.md }}
    >
      <HStack gap="md" align="center">
        {metadata.thumbUrl || metadata.coverUrl ? (
          <Image
            source={{ uri: metadata.thumbUrl ?? metadata.coverUrl ?? "" }}
            style={{
              width: 88,
              height: 88,
              borderRadius: radius.md,
              backgroundColor: palette.paperSunken,
            }}
          />
        ) : (
          <Surface tone="sunken" rounded="md" pad="lg">
            <Ionicons name="disc" size={28} color={palette.inkFaint} />
          </Surface>
        )}
        <VStack gap="xs" flex>
          {metadata.title ? (
            <Text variant="bodyStrong" numberOfLines={2}>
              {metadata.title}
            </Text>
          ) : null}
          {metadata.artist ? (
            <Text variant="body" tone="secondary" numberOfLines={1}>
              {metadata.artist}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {[
              metadata.year ? String(metadata.year) : null,
              metadata.label,
              metadata.catalogNumber,
              metadata.country,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </VStack>
      </HStack>

      {(metadata.genres?.length || metadata.styles?.length) ? (
        <Cluster gap="sm">
          {(metadata.genres ?? []).map((g) => (
            <Surface key={`g-${g}`} tone="sunken" rounded="full" pad="sm" bordered>
              <Text variant="caption">{g}</Text>
            </Surface>
          ))}
          {(metadata.styles ?? []).map((s) => (
            <Surface key={`s-${s}`} tone="paper" rounded="full" pad="sm" bordered>
              <Text variant="caption" tone="muted">{s}</Text>
            </Surface>
          ))}
        </Cluster>
      ) : null}

      <Surface tone="paper" rounded="lg" pad="md" bordered>
        <VStack gap="md">
          <HStack justify="between">
            <Text variant="eyebrow" tone="muted">Collection</Text>
            <Button
              label={enrichment?.inCollection ? "In collection" : "Add"}
              size="sm"
              variant={enrichment?.inCollection ? "primary" : "secondary"}
              onPress={toggleCollection}
              disabled={togglingCollection}
              leading={
                togglingCollection ? (
                  <ActivityIndicator color={enrichment?.inCollection ? palette.inkInverse : palette.ink} size="small" />
                ) : (
                  <Ionicons
                    name={enrichment?.inCollection ? "checkmark" : "add"}
                    size={16}
                    color={enrichment?.inCollection ? palette.inkInverse : palette.ink}
                  />
                )
              }
            />
          </HStack>
        </VStack>
      </Surface>

      <Surface tone="paper" rounded="lg" pad="md" bordered>
        <VStack gap="md">
          <HStack justify="between">
            <Text variant="eyebrow" tone="muted">Wantlist</Text>
            <Button
              label={enrichment?.inWantlist ? "Wanted" : "Add"}
              size="sm"
              variant={enrichment?.inWantlist ? "primary" : "secondary"}
              onPress={toggleWantlist}
              disabled={togglingWantlist}
              leading={
                togglingWantlist ? (
                  <ActivityIndicator color={enrichment?.inWantlist ? palette.inkInverse : palette.ink} size="small" />
                ) : (
                  <Ionicons
                    name={enrichment?.inWantlist ? "heart" : "heart-outline"}
                    size={16}
                    color={enrichment?.inWantlist ? palette.inkInverse : palette.ink}
                  />
                )
              }
            />
          </HStack>
          {enrichment?.inWantlist ? (
            <NoteRow
              value={wantlistNote}
              onChangeText={setWantlistNote}
              placeholder={'Discogs note (e.g. haluan 12" version)'}
              saving={savingWantlistNote}
              onSave={saveWantlistNote}
            />
          ) : null}
        </VStack>
      </Surface>

      <HStack gap="sm">
        <Button
          label="Re-match"
          variant="secondary"
          onPress={startSearch}
          leading={<Ionicons name="search" size={16} color={palette.ink} />}
        />
        <Button
          label="Clear match"
          variant="destructive"
          onPress={() =>
            Alert.alert(
              "Clear enrichment",
              "This removes the Discogs match from this track. Your collection/wantlist on Discogs is not changed.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: removeEnrichment },
              ],
            )
          }
          leading={<Ionicons name="trash-outline" size={16} color={palette.inkInverse} />}
        />
      </HStack>
    </ScrollView>
  );
}

function SearchView({
  query,
  setQuery,
  searching,
  runSearch,
  results,
  pendingReleaseId,
  pickMatch,
}: {
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  runSearch: () => void;
  results: SearchResult[];
  pendingReleaseId: string | null;
  pickMatch: (result: SearchResult) => void;
}) {
  return (
    <VStack gap="md" flex>
      <HStack gap="sm">
        <View style={{ flex: 1 }}>
          <Input
            variant="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Artist + title..."
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
        </View>
        <IconButton
          icon={searching ? "hourglass-outline" : "search"}
          accessibilityLabel="Search Discogs"
          variant="filled"
          onPress={runSearch}
          disabled={!query.trim() || searching}
        />
      </HStack>

      <FlatList
        data={results}
        keyExtractor={(r) => String(r.id)}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          searching ? null : (
            <VStack padY="xl" align="center">
              <Text variant="caption" tone="muted" align="center">
                {query.trim()
                  ? "No matches yet — tap search."
                  : "Type artist + title and search Discogs."}
              </Text>
            </VStack>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            flat
            onPress={() => pickMatch(item)}
            disabled={pendingReleaseId !== null}
            android_ripple={{ color: palette.paperSunken }}
          >
            <HStack gap="md" padY="sm">
              {item.thumb ? (
                <Image
                  source={{ uri: item.thumb }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.sm,
                    backgroundColor: palette.paperSunken,
                  }}
                />
              ) : (
                <Surface tone="sunken" rounded="sm" pad="md">
                  <Ionicons name="disc-outline" size={20} color={palette.inkFaint} />
                </Surface>
              )}
              <VStack gap="xs" flex>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {[item.year, item.country, item.label?.[0], item.catno]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </VStack>
              {pendingReleaseId === String(item.id) ? (
                <ActivityIndicator color={palette.ink} size="small" />
              ) : item.user_data?.in_collection ? (
                <Ionicons name="checkmark-circle" size={18} color={palette.positive} />
              ) : item.user_data?.in_wantlist ? (
                <Ionicons name="heart" size={18} color={palette.critical} />
              ) : null}
            </HStack>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <Divider inset="none" />}
        showsVerticalScrollIndicator={false}
      />
    </VStack>
  );
}

interface NoteRowProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  saving: boolean;
  onSave: () => void;
}

function NoteRow({
  value,
  onChangeText,
  placeholder,
  saving,
  onSave,
}: NoteRowProps) {
  return (
    <HStack gap="sm" align="end">
      <TextInput
        style={{
          flex: 1,
          minHeight: 40,
          maxHeight: 100,
          borderRadius: radius.md,
          borderWidth: border.hair,
          borderColor: palette.paperEdge,
          backgroundColor: palette.paperSunken,
          color: palette.ink,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          ...typeScale.body,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.inkMuted}
        multiline
        returnKeyType="done"
        blurOnSubmit
      />
      <Button
        label={saving ? "Saving" : "Save"}
        size="sm"
        onPress={onSave}
        disabled={saving}
        leading={saving ? <ActivityIndicator color={palette.inkInverse} size="small" /> : null}
      />
    </HStack>
  );
}
