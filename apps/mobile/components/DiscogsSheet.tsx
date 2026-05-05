import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import type { DiscogsMetadata } from "@aani/db";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";

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
    const token = await getToken();
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
  }, [getToken, trackId, propagate]);

  useEffect(() => {
    if (visible && trackId) {
      setQuery(defaultQuery.trim());
      refresh();
    }
    // Intentionally narrow deps: parent re-renders constantly during playback
    // and would otherwise spam refresh() (and stack Alerts) every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, trackId]);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    const token = await getToken();
    if (!token) return;
    setSearching(true);
    try {
      const { data, error } = await apiFetch<{ results: SearchResult[] }>(
        `/discogs/search?q=${encodeURIComponent(q)}`,
        token,
      );
      if (error) {
        Alert.alert("Search failed", error);
      } else {
        setResults(data?.results ?? []);
      }
    } finally {
      setSearching(false);
    }
  }

  async function pickMatch(result: SearchResult) {
    if (!trackId) return;
    const token = await getToken();
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
      if (error) {
        Alert.alert("Enrichment failed", error);
      } else if (data) {
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
    const token = await getToken();
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
    const token = await getToken();
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
    const token = await getToken();
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
      if (error) {
        Alert.alert("Couldn't save note", error);
      } else {
        flash("Note saved");
        await refresh();
      }
    } finally {
      setSavingWantlistNote(false);
    }
  }

  async function removeEnrichment() {
    if (!trackId) return;
    const token = await getToken();
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
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { bottom: kbHeight }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discogs</Text>
          <Pressable onPress={close} hitSlop={10}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Couldn't load Discogs data</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={refresh}
              hitSlop={6}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : !searchMode && metadata ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.releaseHeader}>
              {metadata.thumbUrl || metadata.coverUrl ? (
                <Image
                  source={{ uri: metadata.thumbUrl ?? metadata.coverUrl ?? "" }}
                  style={styles.cover}
                />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Ionicons name="disc" size={28} color="#444" />
                </View>
              )}
              <View style={styles.releaseHeaderText}>
                {metadata.title ? (
                  <Text style={styles.releaseTitle} numberOfLines={2}>
                    {metadata.title}
                  </Text>
                ) : null}
                {metadata.artist ? (
                  <Text style={styles.releaseArtist} numberOfLines={1}>
                    {metadata.artist}
                  </Text>
                ) : null}
                <Text style={styles.releaseSub} numberOfLines={2}>
                  {[
                    metadata.year ? String(metadata.year) : null,
                    metadata.label,
                    metadata.catalogNumber,
                    metadata.country,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>

            {(metadata.genres?.length || metadata.styles?.length) ? (
              <View style={styles.chipRow}>
                {(metadata.genres ?? []).map((g) => (
                  <View key={`g-${g}`} style={[styles.chip, styles.chipGenre]}>
                    <Text style={styles.chipText}>{g}</Text>
                  </View>
                ))}
                {(metadata.styles ?? []).map((s) => (
                  <View key={`s-${s}`} style={styles.chip}>
                    <Text style={styles.chipText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Collection</Text>
                <Pressable
                  style={[
                    styles.toggleBtn,
                    enrichment?.inCollection && styles.toggleBtnActive,
                  ]}
                  onPress={toggleCollection}
                  disabled={togglingCollection}
                  hitSlop={6}
                >
                  {togglingCollection ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons
                        name={
                          enrichment?.inCollection ? "checkmark" : "add"
                        }
                        size={16}
                        color={enrichment?.inCollection ? "#000" : "#fff"}
                      />
                      <Text
                        style={[
                          styles.toggleText,
                          enrichment?.inCollection && styles.toggleTextActive,
                        ]}
                      >
                        {enrichment?.inCollection ? "In collection" : "Add"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Wantlist</Text>
                <Pressable
                  style={[
                    styles.toggleBtn,
                    enrichment?.inWantlist && styles.toggleBtnActive,
                  ]}
                  onPress={toggleWantlist}
                  disabled={togglingWantlist}
                  hitSlop={6}
                >
                  {togglingWantlist ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons
                        name={enrichment?.inWantlist ? "heart" : "heart-outline"}
                        size={16}
                        color={enrichment?.inWantlist ? "#000" : "#fff"}
                      />
                      <Text
                        style={[
                          styles.toggleText,
                          enrichment?.inWantlist && styles.toggleTextActive,
                        ]}
                      >
                        {enrichment?.inWantlist ? "Wanted" : "Add"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
              {enrichment?.inWantlist ? (
                <NoteRow
                  value={wantlistNote}
                  onChangeText={setWantlistNote}
                  placeholder={'Discogs note (e.g. haluan 12" version)'}
                  saving={savingWantlistNote}
                  onSave={saveWantlistNote}
                />
              ) : null}
            </View>

            <View style={styles.footerActions}>
              <Pressable
                style={styles.footerBtn}
                onPress={() => {
                  setSearchMode(true);
                  setResults([]);
                  setQuery(defaultQuery.trim());
                }}
              >
                <Ionicons name="search" size={16} color="#aaa" />
                <Text style={styles.footerBtnText}>Re-match</Text>
              </Pressable>
              <Pressable
                style={styles.footerBtn}
                onPress={() =>
                  Alert.alert(
                    "Clear enrichment",
                    "This removes the Discogs match from this track. Your collection/wantlist on Discogs is not changed.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: removeEnrichment,
                      },
                    ],
                  )
                }
              >
                <Ionicons name="trash-outline" size={16} color="#aaa" />
                <Text style={styles.footerBtnText}>Clear match</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.searchWrap}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Artist + title…"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={runSearch}
              />
              <Pressable
                style={[
                  styles.searchBtn,
                  (!query.trim() || searching) && styles.searchBtnDisabled,
                ]}
                onPress={runSearch}
                disabled={!query.trim() || searching}
              >
                {searching ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Ionicons name="search" size={18} color="#000" />
                )}
              </Pressable>
            </View>

            <FlatList
              data={results}
              keyExtractor={(r) => String(r.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searching ? null : (
                  <Text style={styles.emptyText}>
                    {query.trim()
                      ? "No matches yet — tap search."
                      : "Type artist + title and search Discogs."}
                  </Text>
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.resultRow}
                  onPress={() => pickMatch(item)}
                  disabled={pendingReleaseId !== null}
                  android_ripple={{ color: "rgba(255,255,255,0.06)" }}
                >
                  {item.thumb ? (
                    <Image source={{ uri: item.thumb }} style={styles.resultThumb} />
                  ) : (
                    <View style={[styles.resultThumb, styles.coverPlaceholder]}>
                      <Ionicons name="disc-outline" size={20} color="#444" />
                    </View>
                  )}
                  <View style={styles.resultText}>
                    <Text style={styles.resultTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.resultSub} numberOfLines={1}>
                      {[
                        item.year,
                        item.country,
                        item.label?.[0],
                        item.catno,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  {pendingReleaseId === String(item.id) ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : item.user_data?.in_collection ? (
                    <Ionicons name="checkmark-circle" size={18} color="#4cd964" />
                  ) : item.user_data?.in_wantlist ? (
                    <Ionicons name="heart" size={18} color="#ff4d6d" />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        )}
      </View>
    </Modal>
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
    <View style={styles.noteRow}>
      <TextInput
        style={styles.noteInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#555"
        multiline
        returnKeyType="done"
        blurOnSubmit
      />
      <Pressable
        style={[styles.noteSaveBtn, saving && { opacity: 0.5 }]}
        onPress={onSave}
        disabled={saving}
        hitSlop={6}
      >
        {saving ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Text style={styles.noteSaveText}>Save</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0a0a0a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
    maxHeight: "85%",
    minHeight: "55%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 8,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  errorBody: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#222",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 12,
  },
  releaseHeader: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 4,
  },
  cover: {
    width: 88,
    height: 88,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  releaseHeaderText: {
    flex: 1,
    justifyContent: "center",
  },
  releaseTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  releaseArtist: {
    color: "#bbb",
    fontSize: 14,
    marginTop: 2,
  },
  releaseSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a2a",
  },
  chipGenre: {
    backgroundColor: "#1f1f24",
    borderColor: "#33333d",
  },
  chipText: {
    color: "#ccc",
    fontSize: 11,
    fontWeight: "500",
  },
  section: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    color: "#aaa",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#333",
  },
  toggleBtnActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  toggleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#000",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  noteInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    minHeight: 40,
    maxHeight: 100,
  },
  noteSaveBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  noteSaveText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "600",
  },
  footerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#161616",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a2a",
  },
  footerBtnText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "500",
  },
  searchWrap: {
    flex: 1,
    paddingHorizontal: 4,
    gap: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  searchBtn: {
    backgroundColor: "#fff",
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnDisabled: {
    opacity: 0.3,
  },
  emptyText: {
    color: "#666",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 32,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  resultThumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: "#1a1a1a",
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  resultSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
});
