/**
 * LessonVault — School Lesson Manager
 * PASTE AS: app/index.tsx
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as SQLite from "expo-sqlite";
import JSZip from "jszip";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, FlatList, Image, Modal, PanResponder, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ColorMode = "light" | "dark" | "system";
interface Year { id: number; name: string; created_at: string }
interface Semester { id: number; year_id: number; name: string; created_at: string }
interface Subject { id: number; semester_id: number; name: string; created_at: string }
interface Lesson { id: number; subject_id: number; name: string; image_uri: string | null; is_folder: number; created_at: string; sort_order: number }

const LIGHT = { bg: "#F5F4F0", surface: "#FFFFFF", surfaceAlt: "#EDEDEA", border: "#DDDDD8", text: "#1A1917", textSub: "#7A7874", accent: "#2563EB", accentText: "#FFFFFF", danger: "#DC2626", dangerBg: "#FEF2F2", card: "#FAFAF8", overlay: "rgba(0,0,0,0.5)", statusBar: "dark-content" as const };
const DARK = { bg: "#111110", surface: "#1C1C1A", surfaceAlt: "#252523", border: "#333330", text: "#F2F0EB", textSub: "#888884", accent: "#3B82F6", accentText: "#FFFFFF", danger: "#EF4444", dangerBg: "#2D1515", card: "#161614", overlay: "rgba(0,0,0,0.72)", statusBar: "light-content" as const };

interface ThemeCtx { colors: typeof LIGHT; colorMode: ColorMode; setColorMode: (m: ColorMode) => void; isDark: boolean }
const ThemeContext = createContext<ThemeCtx>({ colors: DARK, colorMode: "system", setColorMode: () => {}, isDark: true });
const useTheme = () => useContext(ThemeContext);

interface AlertBtn { label: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }
const AlertCtx = createContext<{ showAlert: (t: string, m?: string, b?: AlertBtn[]) => void }>({ showAlert: () => {} });
const useAlert = () => useContext(AlertCtx);

function AlertProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [st, setSt] = useState<{ visible: boolean; title: string; message?: string; buttons: AlertBtn[] }>({ visible: false, title: "", buttons: [] });
  const showAlert = useCallback((title: string, message?: string, buttons: AlertBtn[] = [{ label: "OK" }]) => setSt({ visible: true, title, message, buttons }), []);
  const dismiss = () => setSt(s => ({ ...s, visible: false }));
  return (
    <AlertCtx.Provider value={{ showAlert }}>
      {children}
      <Modal visible={st.visible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: st.message ? 8 : 20 }}>{st.title}</Text>
            {st.message && <Text style={{ color: colors.textSub, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 20 }}>{st.message}</Text>}
            <View style={{ gap: 8 }}>
              {st.buttons.map((b, i) => (
                <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress?.(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.danger : b.style === "cancel" ? colors.surfaceAlt : colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: "center", borderWidth: b.style === "cancel" ? 1 : 0, borderColor: colors.border }}>
                  <Text style={{ color: b.style === "cancel" ? colors.text : "#fff", fontWeight: b.style === "cancel" ? "500" : "700", fontSize: 15 }}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </AlertCtx.Provider>
  );
}

interface SheetBtn { label: string; icon?: string; onPress: () => void; style?: "destructive" | "cancel" }
const SheetCtx = createContext<{ showSheet: (t?: string, b?: SheetBtn[]) => void }>({ showSheet: () => {} });
const useSheet = () => useContext(SheetCtx);

function SheetProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState<{ visible: boolean; title?: string; buttons: SheetBtn[] }>({ visible: false, buttons: [] });
  const showSheet = useCallback((title?: string, buttons: SheetBtn[] = []) => setSt({ visible: true, title, buttons }), []);
  const dismiss = () => setSt(s => ({ ...s, visible: false }));
  return (
    <SheetCtx.Provider value={{ showSheet }}>
      {children}
      <Modal visible={st.visible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay }} activeOpacity={1} onPress={dismiss} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 20 + insets.bottom, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
          {st.title && <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>{st.title}</Text>}
          {st.buttons.map((b, i) => (
            <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.dangerBg : colors.surfaceAlt, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
              {b.icon && <Text style={{ fontSize: 20 }}>{b.icon}</Text>}
              <Text style={{ color: b.style === "destructive" ? colors.danger : colors.text, fontSize: 16, fontWeight: b.style === "cancel" ? "500" : "600" }}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SheetCtx.Provider>
  );
}

let _db: SQLite.SQLiteDatabase | null = null;
const DB_SCHEMA = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS years (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name TEXT NOT NULL, image_uri TEXT, is_folder INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), sort_order INTEGER NOT NULL DEFAULT 0);`;
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) { try { await _db.getFirstAsync("SELECT 1"); return _db; } catch { _db = null; } }
  _db = await SQLite.openDatabaseAsync("lessonvault3.db");
  await _db.execAsync(DB_SCHEMA);
  // Migration: add sort_order column if it doesn't exist
  try { await _db.execAsync("ALTER TABLE lessons ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"); } catch {}
  return _db;
}

async function seedDefault() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM years");
  if (row && row.count > 0) return;
  const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", ["Current-Year"]);
  const yid = r.lastInsertRowId;
  for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id, name) VALUES (?,?)", [yid, s]);
}

function slug(s: string) { return s.replace(/[^a-zA-Z0-9_-]/g, "_"); }
async function ensureDir(path: string) { const info = await FileSystem.getInfoAsync(path); if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true }); }

async function copyImage(uri: string, yearName: string, semName: string, subName: string, label: string) {
  const dir = FileSystem.documentDirectory + `LessonVault/${slug(yearName)}/${slug(semName)}/${slug(subName)}/`;
  await ensureDir(dir);
  const cleanUri = uri.split("?")[0]; const rawExt = cleanUri.split(".").pop()?.toLowerCase() || "jpg"; const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(rawExt) ? rawExt : "jpg";
  const dest = `${dir}${slug(label)}_${Date.now()}.${safeExt}`;
  await FileSystem.copyAsync({ from: uri, to: dest }); return dest;
}

async function pickCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return null;
  const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
  return r.canceled ? null : r.assets[0].uri;
}

async function pickGallery(): Promise<string | null> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") return null;
  const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: false });
  return r.canceled ? null : r.assets[0].uri;
}

async function pickGalleryMultiple(): Promise<string[]> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") return [];
  const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
  return r.canceled ? [] : r.assets.map(a => a.uri);
}

// ── Save ZIP to Downloads on Android using SAF, share on iOS ─────────────────
async function saveOrShareZip(zipPath: string, fname: string, showAlert: (t: string, m?: string) => void) {
  if (Platform.OS === "android") {
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" }); }
        else { showAlert("Cancelled", "No download location selected."); }
        return;
      }
      const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fname, "application/zip");
      const zipB64 = await FileSystem.readAsStringAsync(zipPath, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.StorageAccessFramework.writeAsStringAsync(destUri, zipB64, { encoding: FileSystem.EncodingType.Base64 });
      showAlert("Saved", `ZIP saved as ${fname}`);
    } catch (e: any) {
      try {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" });
        else showAlert("Error", String(e));
      } catch (e2) { showAlert("Error", String(e2)); }
    }
  } else {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save to Files" });
    else showAlert("Not available", "Sharing is not available on this device.");
  }
}

function Btn({ label, onPress, variant = "primary", small = false, icon, disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "danger" | "ghost" | "outline"; small?: boolean; icon?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  const bg = variant === "primary" ? colors.accent : variant === "danger" ? colors.danger : "transparent";
  const tc = variant === "primary" || variant === "danger" ? "#fff" : variant === "outline" ? colors.accent : colors.text;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} style={{ backgroundColor: disabled ? colors.surfaceAlt : bg, borderColor: variant === "outline" ? colors.accent : "transparent", borderWidth: variant === "outline" ? 1.5 : 0, borderRadius: 10, paddingHorizontal: small ? 12 : 18, paddingVertical: small ? 7 : 11, flexDirection: "row", alignItems: "center", gap: 5, opacity: disabled ? 0.5 : 1 }}>
      {icon && <Text style={{ fontSize: small ? 14 : 16 }}>{icon}</Text>}
      <Text style={{ color: disabled ? colors.textSub : tc, fontWeight: "600", fontSize: small ? 13 : 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function IconBtn({ icon, onPress, active = false, disabled = false }: { icon: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={{ backgroundColor: active ? colors.accent : colors.surfaceAlt, borderRadius: 9, width: 32, height: 32, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: active ? colors.accent : colors.border, opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
    </TouchableOpacity>
  );
}

function Row({ children, gap = 8, wrap = false }: { children: React.ReactNode; gap?: number; wrap?: boolean }) { return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>; }

function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { colors } = useTheme(); const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 6, alignSelf: "flex-start" }}><Text style={{ color: colors.accent, fontSize: 16 }}>← Back</Text></TouchableOpacity>}
      <Row><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: onBack ? 22 : 26, fontWeight: "900", letterSpacing: -0.4 }}>{title}</Text>{subtitle && <Text style={{ color: colors.textSub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}</View>{right}</Row>
    </View>
  );
}

function NameModal({ visible, title, initial, placeholder, onConfirm, onCancel }: { visible: boolean; title: string; initial?: string; placeholder?: string; onConfirm: (v: string) => void; onCancel: () => void }) {
  const { colors } = useTheme(); const [val, setVal] = useState(initial || "");
  useEffect(() => setVal(initial || ""), [visible, initial]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 14 }}>{title}</Text>
          <TextInput value={val} onChangeText={setVal} placeholder={placeholder || "Name…"} placeholderTextColor={colors.textSub} autoFocus style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 18, borderWidth: 1, borderColor: colors.border }} />
          <Row gap={10}><Btn label="Cancel" onPress={onCancel} variant="ghost" /><View style={{ flex: 1 }} /><Btn label="Confirm" onPress={() => { if (val.trim()) onConfirm(val.trim()); }} /></Row>
        </View>
      </View>
    </Modal>
  );
}

// ─── ZOOMABLE IMAGE — fixed sensitivity ───────────────────────────────────────
function ZoomableImage({ uri }: { uri: string }) {
  const [dims, setDims] = useState({ w: Dimensions.get("window").width, h: Dimensions.get("window").height });

  const currentScale = useRef(1);
  const currentTx = useRef(0);
  const currentTy = useRef(0);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const txAnim = useRef(new Animated.Value(0)).current;
  const tyAnim = useRef(new Animated.Value(0)).current;

  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const panStartTx = useRef(0);
  const panStartTy = useRef(0);
  const lastTapTime = useRef(0);
  const lastTapX = useRef(0);
  const lastTapY = useRef(0);
  const isPinching = useRef(false);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const PINCH_DAMPEN = 0.65;
  const PAN_DAMPEN = 0.4;

  useEffect(() => {
    currentScale.current = 1;
    currentTx.current = 0;
    currentTy.current = 0;
    scaleAnim.setValue(1);
    txAnim.setValue(0);
    tyAnim.setValue(0);
  }, [uri]);

  function getTouchDist(touches: any[]) {
    const dx = touches[0].pageX - touches[1].pageX; const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampTranslation(tx: number, ty: number, scale: number) {
    const maxTx = Math.max(0, (dims.w * (scale - 1)) / 2);
    const maxTy = Math.max(0, (dims.h * (scale - 1)) / 2);
    return { tx: Math.min(maxTx, Math.max(-maxTx, tx)), ty: Math.min(maxTy, Math.max(-maxTy, ty)) };
  }

  function applyTransform(scale: number, tx: number, ty: number, animated = false) {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const clamped = clampTranslation(tx, ty, s);
    currentScale.current = s; currentTx.current = clamped.tx; currentTy.current = clamped.ty;
    if (animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: s, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.spring(txAnim, { toValue: clamped.tx, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.spring(tyAnim, { toValue: clamped.ty, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start();
    } else {
      scaleAnim.setValue(s); txAnim.setValue(clamped.tx); tyAnim.setValue(clamped.ty);
    }
  }

  function resetZoom(animated = true) { applyTransform(1, 0, 0, animated); }

  function doubleTapZoom(tapX: number, tapY: number) {
    if (currentScale.current > 1.5) { resetZoom(true); return; }
    const newScale = 2.5;
    const tx = (dims.w / 2 - tapX) * (newScale - 1);
    const ty = (dims.h / 2 - tapY) * (newScale - 1);
    applyTransform(newScale, tx, ty, true);
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => currentScale.current > 1,
    onMoveShouldSetPanResponder: (e, g) => {
      const touches = e.nativeEvent.touches;
      if (touches.length >= 2) return true;
      return currentScale.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
    },
    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      isPinching.current = touches.length >= 2;
      if (touches.length >= 2) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; }
      panStartTx.current = currentTx.current; panStartTy.current = currentTy.current;
    },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      if (touches.length >= 2) {
        isPinching.current = true;
        if (pinchStartDist.current === 0) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; return; }
        const dist = getTouchDist(Array.from(touches));
        const rawRatio = dist / pinchStartDist.current;
        const dampenedRatio = 1 + (rawRatio - 1) * PINCH_DAMPEN;
        const newScale = pinchStartScale.current * dampenedRatio;
        applyTransform(newScale, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
      } else if (!isPinching.current && currentScale.current > 1) {
        applyTransform(currentScale.current, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
      }
    },
    onPanResponderRelease: (e, g) => {
      const wasPinching = isPinching.current;
      isPinching.current = false; pinchStartDist.current = 0;
      if (currentScale.current <= 1.05) { resetZoom(true); return; }
      const { tx, ty } = clampTranslation(currentTx.current, currentTy.current, currentScale.current);
      if (tx !== currentTx.current || ty !== currentTy.current) applyTransform(currentScale.current, tx, ty, true);
      if (!wasPinching && Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
        const now = Date.now();
        const x = e.nativeEvent.changedTouches[0]?.pageX ?? dims.w / 2;
        const y = e.nativeEvent.changedTouches[0]?.pageY ?? dims.h / 2;
        if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) { lastTapTime.current = 0; doubleTapZoom(x, y); }
        else { lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y; }
      }
    },
    onPanResponderTerminationRequest: () => currentScale.current <= 1,
  })).current;

  function handleTap(e: any) {
    if (currentScale.current > 1) return;
    const now = Date.now();
    const x = e.nativeEvent.pageX ?? dims.w / 2;
    const y = e.nativeEvent.pageY ?? dims.h / 2;
    if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) {
      lastTapTime.current = 0;
      doubleTapZoom(x, y);
    } else {
      lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y;
    }
  }

  return (
    <TouchableOpacity activeOpacity={1} onPress={handleTap} style={{ flex: 1 }} onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Animated.Image source={{ uri }} {...panResponder.panHandlers} style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateX: txAnim }, { translateY: tyAnim }] }} resizeMode="contain" />
    </TouchableOpacity>
  );
}

// ─── IMAGE VIEWER ─────────────────────────────────────────────────────────────
function ImageViewer({ uris, initialIndex = 0, onClose }: { uris: string[]; initialIndex?: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

  useEffect(() => {
    if (uris.length > 1 && initialIndex > 0) {
      setTimeout(() => { flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false }); }, 0);
    }
    setCurrentIndex(initialIndex);
  }, [initialIndex, uris]);

  if (!uris.length) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: insets.top + 10, right: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 22, width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
        {uris.length > 1 && (
          <View style={{ position: "absolute", top: insets.top + 14, left: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{currentIndex + 1} / {uris.length}</Text>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={uris}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onMomentumScrollEnd={e => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrentIndex(newIndex);
          }}
          scrollEnabled
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, height: SCREEN_H }}>
              <ZoomableImage uri={item} />
            </View>
          )}
        />
        <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 12, paddingBottom: insets.bottom + 12, position: "absolute", bottom: 0, left: 0, right: 0 }}>
          {uris.length > 1 ? "Swipe left/right to browse · Pinch or double-tap to zoom" : "Pinch or double-tap to zoom"}
        </Text>
      </View>
    </Modal>
  );
}

// ─── DRAG-AND-DROP GRID ───────────────────────────────────────────────────────
// Single PanResponder on the container. dragMode fed via ref so the closure
// never goes stale. Grid origin measured on layout (not async on grant).
// Order is computed by tracking hoverIdx in a ref and rebuilding on release.

interface DraggableGridProps {
  items: Lesson[];
  numColumns: number;
  itemSize: { width: number; height: number };
  dragMode: boolean;
  onReorder: (newOrder: Lesson[]) => void;
  renderItemContent: (item: Lesson, isDragging: boolean) => React.ReactNode;
  bottomPadding?: number;
}

function DraggableGrid({ items, numColumns, itemSize, dragMode, onReorder, renderItemContent, bottomPadding = 0 }: DraggableGridProps) {
  const ITEM_W = itemSize.width;
  const ITEM_H = itemSize.height;
  const ITEM_GAP = 12;
  const PAD = 18;

  const [localItems, setLocalItems] = useState<Lesson[]>(items);
  const localItemsRef = useRef<Lesson[]>(items);
  const activeRef = useRef(false);
  useEffect(() => {
    if (!activeRef.current) { localItemsRef.current = items; setLocalItems(items); }
  }, [items]);

  const dragModeRef = useRef(dragMode);
  useEffect(() => { dragModeRef.current = dragMode; }, [dragMode]);

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverIdx,   setHoverIdx]   = useState<number | null>(null);
  const hoverIdxRef = useRef<number | null>(null);
  const fromIdxRef  = useRef(0);
  const dragXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const scrollRef = useRef<ScrollView>(null);
  const scrollY   = useRef(0);

  // At grant: pageY of finger and scrollY at that moment.
  // contentY_of_finger = grantPageY - grantScrollY_offset
  // where grantScrollY_offset = pageY_of_content_top_at_scroll0
  // We compute: grantContentY = grantPageY + scrollY_at_grant - pageY_of_grid_top_at_scroll0
  // But we don't know pageY_of_grid_top_at_scroll0 without measure.
  // SOLUTION: at grant, compute which card was touched using the KNOWN card positions,
  // by using the finger's content-space Y = pageY + scrollY - viewportTop.
  // viewportTop is captured once via onLayout of the outer View (sync, not async).
  const viewportTopRef = useRef(0); // page-Y of the outer View's top edge
  const outerRef = useRef<View>(null);

  // Float: position:absolute inside outer View, so top = card_content_y - scrollY
  // card_content_y = PAD + cardRow * (ITEM_H + ITEM_GAP)
  const floatTopRef  = useRef(0);
  const floatLeftRef = useRef(0);
  // Use state for float position so it re-renders at grant
  const [floatPos, setFloatPos] = useState({ top: 0, left: 0 });

  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  function startAutoScroll(dir: "up" | "down") {
    if (autoScrollTimer.current) return;
    autoScrollTimer.current = setInterval(() => {
      const delta = dir === "down" ? 8 : -8;
      const next = Math.max(0, scrollY.current + delta);
      scrollRef.current?.scrollTo({ y: next, animated: false });
      scrollY.current = next;
    }, 16);
  }
  function stopAutoScroll() {
    if (autoScrollTimer.current) { clearInterval(autoScrollTimer.current); autoScrollTimer.current = null; }
  }

  useEffect(() => {
    if (!dragMode && activeRef.current) {
      activeRef.current = false;
      hoverIdxRef.current = null;
      dragXY.setValue({ x: 0, y: 0 });
      setDraggingId(null); setHoverIdx(null);
      stopAutoScroll();
    }
  }, [dragMode]);

  // Convert pageY → row index using viewportTop and current scrollY
  function idxFromPagePos(px: number, py: number): number {
    // content-space coords: how far into the scrollable content is this point
    const contentX = px - PAD; // left padding is PAD
    const contentY = py - viewportTopRef.current + scrollY.current - PAD; // top padding is PAD
    const col = Math.max(0, Math.min(numColumns - 1, Math.floor(contentX / (ITEM_W + ITEM_GAP))));
    const row = Math.max(0, Math.floor(contentY / (ITEM_H + ITEM_GAP)));
    return Math.max(0, Math.min(localItemsRef.current.length - 1, row * numColumns + col));
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => dragModeRef.current,
    onStartShouldSetPanResponderCapture: () => dragModeRef.current,
    onMoveShouldSetPanResponder:         () => dragModeRef.current,
    onMoveShouldSetPanResponderCapture:  () => dragModeRef.current,

    onPanResponderGrant: (e) => {
      if (!dragModeRef.current) return;
      const idx  = idxFromPagePos(e.nativeEvent.pageX, e.nativeEvent.pageY);
      const item = localItemsRef.current[idx];
      if (!item) return;

      const cardRow = Math.floor(idx / numColumns);
      const cardCol = idx % numColumns;
      // Float top = card's content-Y minus current scroll, relative to outer View
      const cardContentY = PAD + cardRow * (ITEM_H + ITEM_GAP);
      const cardContentX = PAD + cardCol * (ITEM_W + ITEM_GAP);
      const top  = cardContentY - scrollY.current;
      const left = cardContentX;
      setFloatPos({ top, left });

      activeRef.current   = true;
      hoverIdxRef.current = idx;
      fromIdxRef.current  = idx;
      dragXY.setValue({ x: 0, y: 0 });
      setDraggingId(item.id);
      setHoverIdx(idx);
    },

    onPanResponderMove: (e, g) => {
      if (!activeRef.current) return;
      dragXY.setValue({ x: g.dx, y: g.dy });
      const newIdx = idxFromPagePos(e.nativeEvent.pageX, e.nativeEvent.pageY);
      if (newIdx !== hoverIdxRef.current) { hoverIdxRef.current = newIdx; setHoverIdx(newIdx); }
      const { height: SH } = Dimensions.get("window");
      const EDGE = 80;
      if (e.nativeEvent.pageY < EDGE) startAutoScroll("up");
      else if (e.nativeEvent.pageY > SH - EDGE) startAutoScroll("down");
      else stopAutoScroll();
    },

    onPanResponderRelease:   () => { stopAutoScroll(); finishDrag(false); },
    onPanResponderTerminate: () => { stopAutoScroll(); finishDrag(true); },
  })).current;

  function finishDrag(cancelled: boolean) {
    if (!activeRef.current) return;
    const from = fromIdxRef.current;
    const to   = hoverIdxRef.current ?? from;
    activeRef.current = false; hoverIdxRef.current = null;
    dragXY.setValue({ x: 0, y: 0 });
    if (!cancelled && from !== to) {
      const next = [...localItemsRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      localItemsRef.current = next;
      setLocalItems(next);
      onReorder(next);
    }
    setDraggingId(null); setHoverIdx(null);
  }

  type DisplayItem = Lesson | { __gap: true; id: string };
  function buildDisplayList(): DisplayItem[] {
    if (draggingId === null || hoverIdx === null) return localItems;
    const from = localItems.findIndex(l => l.id === draggingId);
    if (from === -1) return localItems;
    const without = localItems.filter(l => l.id !== draggingId);
    without.splice(Math.max(0, Math.min(without.length, hoverIdx)), 0, { __gap: true, id: `gap-${draggingId}` } as any);
    return without;
  }

  const displayList = buildDisplayList();
  const rows: DisplayItem[][] = [];
  for (let i = 0; i < displayList.length; i += numColumns) rows.push(displayList.slice(i, i + numColumns));
  const draggingItem = draggingId !== null ? localItems.find(l => l.id === draggingId) ?? null : null;

  return (
    <View
      ref={outerRef}
      style={{ flex: 1 }}
      collapsable={false}
      onLayout={() => {
        // Capture page-Y of this View synchronously — used by idxFromPagePos
        outerRef.current?.measure((_fx, _fy, _w, _h, _px, py) => {
          viewportTopRef.current = py;
        });
      }}
      {...panResponder.panHandlers}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: PAD, paddingBottom: bottomPadding + PAD }}
        scrollEnabled={!activeRef.current}
        scrollEventThrottle={16}
        onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
      >
        <View collapsable={false}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: "row", gap: ITEM_GAP, marginBottom: rowIdx < rows.length - 1 ? ITEM_GAP : 0 }}>
              {row.map((item: any) => {
                if (item.__gap) return <View key={item.id} style={{ width: ITEM_W, height: ITEM_H, borderRadius: 12, backgroundColor: "rgba(128,128,128,0.15)", borderWidth: 2, borderColor: "rgba(128,128,128,0.3)", borderStyle: "dashed" }} />;
                if (item.id === draggingId) return <View key={item.id} style={{ width: ITEM_W, height: ITEM_H, opacity: 0 }} />;
                return (
                  <View key={item.id} style={{ width: ITEM_W, borderRadius: 12, overflow: "hidden" }}>
                    {renderItemContent(item as Lesson, false)}
                  </View>
                );
              })}
              {row.length < numColumns && Array.from({ length: numColumns - row.length }).map((_, i) => <View key={`e${i}`} style={{ width: ITEM_W }} />)}
            </View>
          ))}
        </View>
      </ScrollView>

      {draggingItem && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: floatPos.top,
            left: floatPos.left,
            width: ITEM_W,
            borderRadius: 12,
            overflow: "hidden",
            zIndex: 999,
            elevation: 16,
            shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
            transform: [{ translateX: dragXY.x }, { translateY: dragXY.y }, { scale: 1.06 }],
          }}
        >
          {renderItemContent(draggingItem, true)}
        </Animated.View>
      )}
    </View>
  );
}

// ─── FOLDER LESSONS SCREEN ────────────────────────────────────────────────────
function FolderLessonsScreen({ folder, subject, semesterName, yearName, onBack, breadcrumb }: { folder: Lesson; subject: Subject; semesterName: string; yearName: string; onBack: () => void; breadcrumb?: string }) {
  const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
  const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [viewerState, setViewerState] = useState<{ uris: string[]; index: number } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const [openSubFolder, setOpenSubFolder] = useState<Lesson | null>(null);

  const PREFIX = `FC:${folder.id}:`;

  const load = useCallback(async () => {
    const db = await getDb();
    const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY sort_order ASC, created_at DESC", [subject.id]);
    setLessons(all.filter(l => l.image_uri?.startsWith(PREFIX)));
  }, [subject.id, folder.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (openSubFolder) { setOpenSubFolder(null); load(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [openSubFolder]);

  async function commitPhoto(name: string, uri: string) {
    const copied = await copyImage(uri, yearName, semesterName, subject.name, name);
    const storedUri = `${PREFIX}${copied}`;
    const db = await getDb();
    const maxRow = await db.getFirstAsync<{ m: number }>("SELECT MAX(sort_order) as m FROM lessons WHERE subject_id=?", [subject.id]);
    const nextOrder = (maxRow?.m ?? -1) + 1;
    await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder, sort_order) VALUES (?,?,?,0,?)", [subject.id, name, storedUri, nextOrder]);
  }
  async function commitSubFolder(name: string) {
    const storedUri = `${PREFIX}__folder__`;
    const db = await getDb();
    const maxRow = await db.getFirstAsync<{ m: number }>("SELECT MAX(sort_order) as m FROM lessons WHERE subject_id=?", [subject.id]);
    const nextOrder = (maxRow?.m ?? -1) + 1;
    await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder, sort_order) VALUES (?,?,?,1,?)", [subject.id, name, storedUri, nextOrder]);
  }

  async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitPhoto(`Photo ${lessons.length + i + 1}`, uris[i]); load(); } catch (e) { showAlert("Error saving", String(e)); } }
  async function commitNamed(name: string, uri: string) { try { await commitPhoto(name, uri); load(); } catch (e) { showAlert("Error saving", String(e)); } }

  function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
    showSheet("Add Image", [
      { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access required."); else onUris([u]); } },
      { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access required."); else onUris([u]); } } },
      { label: "Cancel", style: "cancel", onPress: () => {} },
    ]);
  }

  function handleAdd() {
    showSheet("Add to " + folder.name, [
      { label: "Quick Photos (auto-name)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) },
      { label: "Named Photo", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) },
      { label: "Create Sub-Folder", icon: "📁", onPress: () => { setPendingUris(["__subfolder__"]); setNameModalVis(true); } },
      { label: "Cancel", style: "cancel", onPress: () => {} },
    ]);
  }

  async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

  function getRealUri(l: Lesson): string | null {
    if (!l.image_uri || l.is_folder) return null;
    // Strip all FC:id: prefixes (handles nested sub-folders)
    return l.image_uri.replace(/^(?:FC:\d+:)+/, "") || null;
  }

  function getPhotoUris(): string[] {
    return lessons.filter(l => !l.is_folder).map(l => getRealUri(l)).filter(Boolean) as string[];
  }

  async function deepDelete(l: Lesson) {
    const db = await getDb();
    if (l.is_folder) {
      const childPrefix = `FC:${l.id}:`;
      const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]);
      const children = all.filter(c => c.image_uri?.startsWith(childPrefix));
      for (const c of children) await deepDelete(c);
    } else {
      const real = getRealUri(l);
      if (real) try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {}
    }
    await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]);
  }

  function confirmDelete(l: Lesson) {
    showAlert("Delete", `Delete "${l.name}"${l.is_folder ? " and all its contents" : ""}?`, [
      { label: "Delete", style: "destructive", onPress: async () => { await deepDelete(l); load(); } },
      { label: "Cancel", style: "cancel" },
    ]);
  }

  function confirmDeleteSelected() {
    showAlert("Delete Selected", `Delete ${selected.size} item(s)?`, [
      { label: "Delete", style: "destructive", onPress: async () => { for (const id of selected) { const l = lessons.find(x => x.id === id); if (l) await deepDelete(l); } setSelected(new Set()); setSelectMode(false); load(); } },
      { label: "Cancel", style: "cancel" },
    ]);
  }

  function clearFolderContents(l: Lesson) {
    showAlert("Clear Sub-Folder", `Delete all contents inside "${l.name}"? The folder itself will remain.`, [
      { label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const childPrefix = `FC:${l.id}:`; const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(c => c.image_uri?.startsWith(childPrefix)); for (const c of children) await deepDelete(c); load(); } },
      { label: "Cancel", style: "cancel" },
    ]);
  }

  function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

  function openPhotoViewer(l: Lesson) {
    const realUri = getRealUri(l);
    if (!realUri) return;
    const allUris = getPhotoUris();
    const idx = allUris.indexOf(realUri);
    setViewerState({ uris: allUris, index: idx >= 0 ? idx : 0 });
  }

  function openMenu(l: Lesson) {
    const realUri = getRealUri(l);
    showSheet(l.name, [
      ...(realUri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => openPhotoViewer(l) }] : []),
      ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenSubFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []),
      { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) },
      { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) },
      { label: "Cancel", style: "cancel" as const, onPress: () => {} },
    ]);
  }

  async function handleReorder(newOrder: Lesson[]) {
    const db = await getDb();
    for (let i = 0; i < newOrder.length; i++) {
      await db.runAsync("UPDATE lessons SET sort_order=? WHERE id=?", [i, newOrder[i].id]);
    }
    setLessons(newOrder);
  }

  if (openSubFolder) {
    const bc = breadcrumb ? `${breadcrumb} › ${folder.name}` : folder.name;
    return <FolderLessonsScreen folder={openSubFolder} subject={subject} semesterName={semesterName} yearName={yearName} breadcrumb={bc} onBack={() => { setOpenSubFolder(null); load(); }} />;
  }

  const W = Dimensions.get("window").width;
  const IMG = (W - 48 - 12) / 2;
  const subtitle = breadcrumb ? `${breadcrumb} › ${folder.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}` : `📁 ${subject.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`;

  function renderItemContent(item: Lesson, isDragging: boolean) {
    const isSel = selected.has(item.id);
    const realUri = getRealUri(item);
    return (
      <TouchableOpacity
        activeOpacity={dragMode ? 1 : 0.85}
        onPress={() => {
          if (dragMode) return;
          if (selectMode) toggleSel(item.id);
          else if (item.is_folder) setOpenSubFolder(item);
          else openPhotoViewer(item);
        }}
        onLongPress={() => {
          if (!selectMode && !dragMode) { setSelectMode(true); toggleSel(item.id); }
        }}
        style={{
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.card,
          borderWidth: isSel ? 2.5 : 1,
          borderColor: isSel ? colors.accent : isDragging ? colors.accent : colors.border,
        }}
      >
        {item.is_folder
          ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View>
          : realUri
          ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />
          : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>
        }
        <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}>
          {dragMode && <Text style={{ fontSize: 14, marginRight: 4, color: colors.textSub }}>☰</Text>}
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>
          {!selectMode && !dragMode && (
            <TouchableOpacity onPress={() => openMenu(item)}>
              <Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
        {isSel && (
          <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14 }}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const headerRight = (
    <Row gap={6}>
      {!selectMode && !dragMode && (
        <>
          <Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small />
          <IconBtn icon="⠿" onPress={() => setDragMode(true)} active />
          <Btn label="+ Add" onPress={handleAdd} small />
        </>
      )}
      {!selectMode && dragMode && (
        <Btn label="Done" onPress={() => setDragMode(false)} variant="primary" small />
      )}
      {selectMode && (
        <>
          <Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} />
          <Btn label="All" onPress={selectAll} variant="outline" small />
          <Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small />
        </>
      )}
    </Row>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={folder.name} subtitle={subtitle} onBack={onBack} right={headerRight} />
      {lessons.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
          <Text style={{ fontSize: 52 }}>📸</Text>
          <Text style={{ color: colors.textSub, fontSize: 15 }}>Folder is empty</Text>
          <Btn label="+ Add" onPress={handleAdd} />
        </View>
      ) : (
        <DraggableGrid
          items={lessons}
          numColumns={2}
          itemSize={{ width: IMG, height: IMG * 1.15 + 36 }}
          dragMode={dragMode}
          onReorder={handleReorder}
          renderItemContent={renderItemContent}
          bottomPadding={insets.bottom}
        />
      )}
      <NameModal visible={nameModalVis} title={pendingUris[0] === "__subfolder__" ? "Name this Sub-Folder" : "Name this Photo"} placeholder={pendingUris[0] === "__subfolder__" ? "e.g. Week 1" : "e.g. Page 1"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__subfolder__") commitSubFolder(name).then(load); else if (pendingUris.length) commitNamed(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
      <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
      {viewerState && <ImageViewer uris={viewerState.uris} initialIndex={viewerState.index} onClose={() => setViewerState(null)} />}
    </View>
  );
}

// ─── LESSONS SCREEN ───────────────────────────────────────────────────────────
function LessonsScreen({ subject, semesterName, yearName, onBack }: { subject: Subject; semesterName: string; yearName: string; onBack: () => void }) {
  const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
  const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [viewerState, setViewerState] = useState<{ uris: string[]; index: number } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const [openFolder, setOpenFolder] = useState<Lesson | null>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY sort_order ASC, created_at DESC", [subject.id]);
    setLessons(all.filter(l => !l.image_uri?.startsWith("FC:")));
  }, [subject.id]);

  useEffect(() => { load(); }, [load]);

  async function commitOne(name: string, uri: string, isFolder = false) {
    let storedUri: string | null = uri;
    if (uri && !isFolder) storedUri = await copyImage(uri, yearName, semesterName, subject.name, name);
    const db = await getDb();
    const maxRow = await db.getFirstAsync<{ m: number }>("SELECT MAX(sort_order) as m FROM lessons WHERE subject_id=?", [subject.id]);
    const nextOrder = (maxRow?.m ?? -1) + 1;
    await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder, sort_order) VALUES (?,?,?,?,?)", [subject.id, name, storedUri, isFolder ? 1 : 0, nextOrder]);
  }
  async function commit(name: string, uri: string | null, isFolder = false) { try { await commitOne(name, uri ?? "", isFolder); load(); } catch (e) { showAlert("Error saving", String(e)); } }
  async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitOne(`Photo ${lessons.length + i + 1}`, uris[i], false); load(); } catch (e) { showAlert("Error saving", String(e)); } }

  function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
    showSheet("Add Image", [
      { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access is required."); else onUris([u]); } },
      { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access is required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access is required."); else onUris([u]); } } },
      { label: "Cancel", style: "cancel", onPress: () => {} },
    ]);
  }

  function handleAdd() { showSheet("Add to " + subject.name, [{ label: "Quick Photos (auto-name, multi)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) }, { label: "Named Image Lesson", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) }, { label: "Create Folder Lesson", icon: "📁", onPress: () => { setPendingUris(["__folder__"]); setNameModalVis(true); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }
  async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

  function confirmDelete(l: Lesson) { showAlert("Delete Lesson", `Delete "${l.name}"?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} load(); } }, { label: "Cancel", style: "cancel" }]); }
  function confirmDeleteSelected() { showAlert("Delete Selected", `Delete ${selected.size} lesson(s)?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); for (const id of selected) { const l = lessons.find(x => x.id === id); if (!l) continue; await db.runAsync("DELETE FROM lessons WHERE id=?", [id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } setSelected(new Set()); setSelectMode(false); load(); } }, { label: "Cancel", style: "cancel" }]); }

  function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

  function clearFolderContents(folder: Lesson) { showAlert("Clear Folder Content", `Delete all photos inside "${folder.name}"? The folder itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(l => l.image_uri?.startsWith(`FC:${folder.id}:`)); for (const l of children) { await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); const real = l.image_uri!.replace(/^(?:FC:\d+:)+/, ""); try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {} } load(); } }, { label: "Cancel", style: "cancel" }]); }

  function getRealUriForLesson(l: Lesson): string | null {
    if (!l.image_uri || l.is_folder) return null;
    return l.image_uri.replace(/^(?:FC:\d+:)+/, "") || null;
  }

  function getPhotoUris(): string[] {
    return lessons.filter(l => !l.is_folder).map(l => getRealUriForLesson(l)).filter(Boolean) as string[];
  }

  function openPhotoViewer(l: Lesson) {
    const realUri = getRealUriForLesson(l);
    if (!realUri) return;
    const allUris = getPhotoUris();
    const idx = allUris.indexOf(realUri);
    setViewerState({ uris: allUris, index: idx >= 0 ? idx : 0 });
  }

  function openMenu(l: Lesson) { showSheet(l.name, [...(!l.is_folder && l.image_uri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => openPhotoViewer(l) }] : []), ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []), { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) }, { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) }, { label: "Cancel", style: "cancel" as const, onPress: () => {} }]); }

  useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (openFolder) { setOpenFolder(null); load(); return true; } return false; }); return () => handler.remove(); }, [openFolder]);

  async function handleReorder(newOrder: Lesson[]) {
    const db = await getDb();
    for (let i = 0; i < newOrder.length; i++) {
      await db.runAsync("UPDATE lessons SET sort_order=? WHERE id=?", [i, newOrder[i].id]);
    }
    setLessons(newOrder);
  }

  if (openFolder) return <FolderLessonsScreen folder={openFolder} subject={subject} semesterName={semesterName} yearName={yearName} onBack={() => { setOpenFolder(null); load(); }} />;

  const W = Dimensions.get("window").width;
  const IMG = (W - 48 - 12) / 2;

  function renderItemContent(item: Lesson, isDragging: boolean) {
    const isSel = selected.has(item.id);
    const realUri = getRealUriForLesson(item);
    return (
      <TouchableOpacity
        activeOpacity={dragMode ? 1 : 0.85}
        onPress={() => {
          if (dragMode) return;
          if (selectMode) toggleSel(item.id);
          else if (item.is_folder) setOpenFolder(item);
          else openPhotoViewer(item);
        }}
        onLongPress={() => {
          if (!selectMode && !dragMode) { setSelectMode(true); toggleSel(item.id); }
        }}
        style={{
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.card,
          borderWidth: isSel ? 2.5 : 1,
          borderColor: isSel ? colors.accent : isDragging ? colors.accent : colors.border,
        }}
      >
        {item.is_folder
          ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View>
          : realUri
          ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />
          : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>
        }
        <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}>
          {dragMode && <Text style={{ fontSize: 14, marginRight: 4, color: colors.textSub }}>☰</Text>}
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>
          {!selectMode && !dragMode && (
            <TouchableOpacity onPress={() => openMenu(item)}>
              <Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
        {isSel && (
          <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14 }}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const headerRight = (
    <Row gap={6}>
      {!selectMode && !dragMode && (
        <>
          <Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small />
          <IconBtn icon="⠿" onPress={() => setDragMode(true)} active />
          <Btn label="+ Add" onPress={handleAdd} small />
        </>
      )}
      {!selectMode && dragMode && (
        <Btn label="Done" onPress={() => setDragMode(false)} variant="primary" small />
      )}
      {selectMode && (
        <>
          <Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} />
          <Btn label="All" onPress={selectAll} variant="outline" small />
          <Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small />
        </>
      )}
    </Row>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={subject.name} subtitle={`${semesterName} · ${yearName} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`} onBack={onBack} right={headerRight} />
      {lessons.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
          <Text style={{ fontSize: 52 }}>📸</Text>
          <Text style={{ color: colors.textSub, fontSize: 15 }}>No items yet</Text>
          <Btn label="+ Add Lesson" onPress={handleAdd} />
        </View>
      ) : (
        <DraggableGrid
          items={lessons}
          numColumns={2}
          itemSize={{ width: IMG, height: IMG * 1.15 + 36 }}
          dragMode={dragMode}
          onReorder={handleReorder}
          renderItemContent={renderItemContent}
          bottomPadding={insets.bottom}
        />
      )}
      <NameModal visible={nameModalVis} title={pendingUris[0] === "__folder__" ? "Name this Folder" : "Name this Lesson"} placeholder={pendingUris[0] === "__folder__" ? "e.g. Exercises" : "e.g. Chapter 3 Notes"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__folder__") commit(name, null, true); else if (pendingUris.length) commit(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
      <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
      {viewerState && <ImageViewer uris={viewerState.uris} initialIndex={viewerState.index} onClose={() => setViewerState(null)} />}
    </View>
  );
}

// ─── SUBJECTS SCREEN ──────────────────────────────────────────────────────────
function SubjectsScreen({ semester, yearName, onBack }: { semester: Semester; yearName: string; onBack: () => void }) {
  const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
  const [subjects, setSubjects] = useState<Subject[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSubject, setEditSubject] = useState<Subject | null>(null); const [active, setActive] = useState<Subject | null>(null);

  const load = useCallback(async () => { const db = await getDb(); setSubjects(await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? ORDER BY name ASC", [semester.id])); }, [semester.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (active) { setActive(null); return true; } return false; }); return () => handler.remove(); }, [active]);

  async function applySubjectToOthers(name: string, scope: "all_semesters" | "all_years") { const db = await getDb(); if (scope === "all_semesters") { const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND id!=?", [semester.year_id, semester.id]); for (const s of sems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } else if (scope === "all_years") { const allSems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE name=? AND id!=?", [semester.name, semester.id]); for (const s of allSems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } }

  function addSubjectFlow(name: string) { setShowAdd(false); showSheet("Apply to other semesters?", [{ label: "This semester only", icon: "📂", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); load(); } }, { label: "All semesters in this year", icon: "📅", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_semesters"); load(); } }, { label: "All years (same semester name)", icon: "🗂️", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_years"); load(); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }

  async function rename(sub: Subject, name: string) { const db = await getDb(); await db.runAsync("UPDATE subjects SET name=? WHERE id=?", [name, sub.id]); setEditSubject(null); load(); }

  function confirmDelete(sub: Subject) { showAlert("Delete Subject", `Delete "${sub.name}" and all its lessons?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); load(); } }, { label: "Cancel", style: "cancel" }]); }

  if (active) return <LessonsScreen subject={active} semesterName={semester.name} yearName={yearName} onBack={() => setActive(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={semester.name} subtitle={`${yearName} · ${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Subject" onPress={() => setShowAdd(true)} small />} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
        {subjects.map(sub => (
          <TouchableOpacity key={sub.id} onPress={() => setActive(sub)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 24 }}>📗</Text></View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sub.name}</Text>
            <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sub.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSubject(sub) }, { label: "Clear All Lessons", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Lessons", `Delete all lessons in "${sub.name}"?`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM lessons WHERE subject_id=?", [sub.id]); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Subject", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sub) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
              <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {subjects.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📗</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No subjects yet</Text></View>}
        <View style={{ height: 40 }} />
      </ScrollView>
      <NameModal visible={showAdd} title="New Subject" placeholder="e.g. Mathematics" onConfirm={addSubjectFlow} onCancel={() => setShowAdd(false)} />
      <NameModal visible={!!editSubject} title="Rename Subject" initial={editSubject?.name} onConfirm={v => editSubject && rename(editSubject, v)} onCancel={() => setEditSubject(null)} />
    </View>
  );
}

// ─── YEAR SCREEN ──────────────────────────────────────────────────────────────
function YearScreen({ year, onBack }: { year: Year; onBack: () => void }) {
  const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
  const [semesters, setSemesters] = useState<Semester[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSem, setEditSem] = useState<Semester | null>(null); const [activeSem, setActiveSem] = useState<Semester | null>(null);

  const load = useCallback(async () => { const db = await getDb(); setSemesters(await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? ORDER BY created_at ASC", [year.id])); }, [year.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeSem) { setActiveSem(null); return true; } return false; }); return () => handler.remove(); }, [activeSem]);

  async function add(name: string) { const db = await getDb(); await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [year.id, name]); load(); }
  async function rename(sem: Semester, name: string) { const db = await getDb(); await db.runAsync("UPDATE semesters SET name=? WHERE id=?", [name, sem.id]); setEditSem(null); load(); }

  async function deleteSemContent(sem: Semester) { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } await db.runAsync("DELETE FROM semesters WHERE id=?", [sem.id]); }

  function confirmDelete(sem: Semester) { showAlert("Delete Semester", `Delete "${sem.name}" and all its content?`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteSemContent(sem); load(); } }, { label: "Cancel", style: "cancel" }]); }

  if (activeSem) return <SubjectsScreen semester={activeSem} yearName={year.name} onBack={() => setActiveSem(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={year.name} subtitle={`${semesters.length} semester${semesters.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Semester" onPress={() => setShowAdd(true)} small />} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
        {semesters.map(sem => (
          <TouchableOpacity key={sem.id} onPress={() => setActiveSem(sem)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 26 }}>📂</Text></View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sem.name}</Text>
            <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sem.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSem(sem) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Semester Content", `Delete all subjects and lessons inside "${sem.name}"? The semester itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Semester", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sem) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
              <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {semesters.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No semesters yet</Text></View>}
        <View style={{ height: 40 }} />
      </ScrollView>
      <NameModal visible={showAdd} title="New Semester" placeholder="e.g. Semester 1" onConfirm={v => { setShowAdd(false); add(v); }} onCancel={() => setShowAdd(false)} />
      <NameModal visible={!!editSem} title="Rename Semester" initial={editSem?.name} onConfirm={v => editSem && rename(editSem, v)} onCancel={() => setEditSem(null)} />
    </View>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen() {
  const { colors, isDark, colorMode, setColorMode } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
  const insets = useSafeAreaInsets();
  const [years, setYears] = useState<Year[]>([]); const [showAdd, setShowAdd] = useState(false); const [editYear, setEditYear] = useState<Year | null>(null); const [activeYear, setActiveYear] = useState<Year | null>(null); const [busy, setBusy] = useState<"export" | "import" | null>(null);

  const load = useCallback(async () => { const db = await getDb(); setYears(await db.getAllAsync<Year>("SELECT * FROM years ORDER BY created_at DESC")); }, []);
  useEffect(() => { seedDefault().then(load); }, [load]);
  useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeYear) { setActiveYear(null); return true; } return false; }); return () => handler.remove(); }, [activeYear]);

  async function addYear(name: string) { const db = await getDb(); try { const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", [name]); const yid = r.lastInsertRowId; for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s]); load(); } catch (e: any) { if (String(e).includes("UNIQUE")) showAlert("Name Taken", "A year with that name already exists."); else showAlert("Error", String(e)); } }
  async function renameYear(year: Year, name: string) { const db = await getDb(); await db.runAsync("UPDATE years SET name=? WHERE id=?", [name, year.id]); setEditYear(null); load(); }

  async function deleteYearContent(year: Year) { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } } await db.runAsync("DELETE FROM years WHERE id=?", [year.id]); }
  function confirmDeleteYear(year: Year) { showAlert("Delete Year", `Delete "${year.name}" and all its content? This cannot be undone.`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteYearContent(year); load(); } }, { label: "Cancel", style: "cancel" }]); }

  async function exportZip() {
    const fname = `LessonVault_${new Date().toISOString().slice(0, 10)}.zip`;
    const zipPath = FileSystem.cacheDirectory + fname;

    async function buildZip(): Promise<string> {
      const db = await getDb();
      const zip = new JSZip();
      const allYears = await db.getAllAsync<Year>("SELECT * FROM years");
      const manifest: any = { exportedAt: new Date().toISOString(), years: [] };

      for (const y of allYears) {
        const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [y.id]);
        const semData: any[] = [];
        for (const s of sems) {
          const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]);
          const subData: any[] = [];
          for (const sub of subs) {
            // Fetch ALL lessons for this subject (includes folder-children)
            const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY sort_order ASC, created_at ASC", [sub.id]);
            for (const l of ls) {
              if (l.is_folder) continue;
              // Strip all FC:id: prefixes to get the real file path
              let realUri = l.image_uri || "";
              realUri = realUri.replace(/^(?:FC:\d+:)+/, "");
              if (!realUri || realUri === "__folder__") continue;
              const info = await FileSystem.getInfoAsync(realUri);
              if (!info.exists) continue;
              const b64 = await FileSystem.readAsStringAsync(realUri, { encoding: FileSystem.EncodingType.Base64 });
              if (!b64) continue;
              const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
              zip.file(`files/${l.id}.${ext}`, b64, { base64: true });
            }
            subData.push({ id: sub.id, name: sub.name, lessons: ls });
          }
          semData.push({ id: s.id, name: s.name, subjects: subData });
        }
        manifest.years.push({ id: y.id, name: y.name, semesters: semData });
      }

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      const zipB64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 4 } });
      await FileSystem.writeAsStringAsync(zipPath, zipB64, { encoding: FileSystem.EncodingType.Base64 });
      return zipPath;
    }

    showSheet("Export ZIP", [
      { label: Platform.OS === "android" ? "Save to Downloads" : "Save to Files", icon: "💾", onPress: async () => { setBusy("export"); try { const path = await buildZip(); await saveOrShareZip(path, fname, (t, m) => showAlert(t, m)); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
      { label: "Share…", icon: "📤", onPress: async () => { setBusy("export"); try { const path = await buildZip(); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "application/zip", dialogTitle: "Export LessonVault" }); else showAlert("Not available", "Sharing is not available on this device."); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
      { label: "Cancel", style: "cancel", onPress: () => {} },
    ]);
  }

  async function importZip() {
    setBusy("import");
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/zip", copyToCacheDirectory: true });
      if (res.canceled) { setBusy(null); return; }

      const zipB64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!zipB64) { showAlert("Import Error", "Could not read the zip file."); return; }

      const zip = await JSZip.loadAsync(zipB64, { base64: true });
      const mf = zip.file("manifest.json");
      if (!mf) { showAlert("Import Error", "No manifest.json found."); return; }

      const manifest = JSON.parse(await mf.async("string"));
      const db = await getDb();
      let imported = 0;
      let fileCounter = 0; // unique per-import counter — avoids Date.now() collisions

      for (const y of manifest.years) {
        let yr = await db.getFirstAsync<Year>("SELECT * FROM years WHERE name=?", [y.name]);
        const yid = yr ? yr.id : (await db.runAsync("INSERT INTO years (name) VALUES (?)", [y.name])).lastInsertRowId;

        for (const s of y.semesters) {
          let sr = await db.getFirstAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND name=?", [yid, s.name]);
          const sid = sr ? sr.id : (await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s.name])).lastInsertRowId;

          for (const sub of (s.subjects || [])) {
            let subr = await db.getFirstAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? AND name=?", [sid, sub.name]);
            const subid = subr ? subr.id : (await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [sid, sub.name])).lastInsertRowId;

            const allLessons: any[] = sub.lessons || [];
            const idMap: Record<number, number> = {};

            // Insert folders first (root-level, then nested) so idMap is populated for prefix remapping
            const sorted = [...allLessons].sort((a, b) => {
              const aFolder = a.is_folder && (!a.image_uri || !a.image_uri.startsWith("FC:"));
              const bFolder = b.is_folder && (!b.image_uri || !b.image_uri.startsWith("FC:"));
              if (aFolder && !bFolder) return -1;
              if (!aFolder && bFolder) return 1;
              return 0;
            });

            for (const l of sorted) {
              if (l.is_folder) {
                const r = await db.runAsync(
                  "INSERT INTO lessons (subject_id,name,image_uri,is_folder,sort_order) VALUES (?,?,?,1,?)",
                  [subid, l.name, null, l.sort_order ?? 0]
                );
                idMap[l.id] = Number(r.lastInsertRowId);
                imported++;
              } else {
                // Strip FC: prefixes to find the zip entry
                let realUri = l.image_uri || "";
                realUri = realUri.replace(/^(?:FC:\d+:)+/, "");
                if (!realUri || realUri === "__folder__") continue;

                const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
                const file = zip.file(`files/${l.id}.${ext}`);
                if (!file) continue;

                const b64 = await file.async("base64");
                if (!b64) continue;

                const dir = FileSystem.documentDirectory + `LessonVault/${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/`;
                await ensureDir(dir);

                // Use a monotonic counter so filenames are always unique within this import
                fileCounter++;
                const dest = `${dir}${slug(l.name)}_${fileCounter}.${ext}`;
                await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });

                const r = await db.runAsync(
                  "INSERT INTO lessons (subject_id,name,image_uri,is_folder,sort_order) VALUES (?,?,?,0,?)",
                  [subid, l.name, dest, l.sort_order ?? 0]
                );
                idMap[l.id] = Number(r.lastInsertRowId);
                imported++;
              }
            }

            // Remap FC: prefixes in image_uri using idMap
            for (const l of allLessons) {
              const newId = idMap[l.id];
              if (!newId || !l.image_uri) continue;

              if (l.is_folder) {
                // Folder: remap its own FC: prefix chain
                const newUri = l.image_uri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
                  const mapped = idMap[Number(oid)];
                  return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
                });
                await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
              } else {
                // Photo: remap any FC: prefixes in the image_uri, keep the file path suffix
                const prefixMatch = l.image_uri.match(/^((?:FC:\d+:)+)/);
                if (prefixMatch) {
                  const newPrefix = prefixMatch[1].replace(/FC:(\d+):/g, (_: string, oid: string) => {
                    const mapped = idMap[Number(oid)];
                    return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
                  });
                  // The actual file path for this lesson was written to dest — fetch it
                  const row = await db.getFirstAsync<Lesson>("SELECT image_uri FROM lessons WHERE id=?", [newId]);
                  if (row?.image_uri) {
                    await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newPrefix + row.image_uri, newId]);
                  }
                }
              }
            }
          }
        }
      }

      showAlert("Import Complete", `${imported} item(s) imported successfully.`);
      load();
    } catch (e) {
      showAlert("Import Error", String(e));
    } finally {
      setBusy(null);
    }
  }

  if (activeYear) return <YearScreen year={activeYear} onBack={() => setActiveYear(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={colors.statusBar} />
      <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Row>
          <Text style={{ flex: 1, color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>📚 LessonVault</Text>
          <TouchableOpacity onPress={() => setColorMode(colorMode === "dark" ? "light" : "dark")} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
          </TouchableOpacity>
        </Row>
        <Row gap={8} wrap style={{ marginTop: 14 }}>
          <Btn label={busy === "export" ? "Exporting…" : "Export ZIP"} onPress={exportZip} variant="outline" small icon="📤" disabled={busy !== null} />
          <Btn label={busy === "import" ? "Importing…" : "Import ZIP"} onPress={importZip} variant="outline" small icon="📥" disabled={busy !== null} />
          <View style={{ flex: 1 }} />
          <Btn label="+ Year" onPress={() => setShowAdd(true)} small icon="📁" />
        </Row>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: insets.bottom + 24 }}>
        <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{years.length} Year{years.length !== 1 ? "s" : ""}</Text>
        {years.map(year => (
          <TouchableOpacity key={year.id} onPress={() => setActiveYear(year)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ backgroundColor: colors.accent + "1A", borderRadius: 14, padding: 10 }}><Text style={{ fontSize: 24 }}>🗂️</Text></View>
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{year.name}</Text><Text style={{ color: colors.textSub, fontSize: 12, marginTop: 2 }}>{new Date(year.created_at).toLocaleDateString()}</Text></View>
            <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(year.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditYear(year) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Year Content", `Delete all semesters and everything inside "${year.name}"? The year itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); } await db.runAsync("DELETE FROM semesters WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Year", icon: "🗑️", style: "destructive", onPress: () => confirmDeleteYear(year) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
              <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {years.length === 0 && <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}><Text style={{ fontSize: 56 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 16, textAlign: "center" }}>No years yet.{"\n"}Tap "+ Year" to get started.</Text></View>}
      </ScrollView>
      <NameModal visible={showAdd} title="New Year" placeholder="e.g. 2nd Year" onConfirm={v => { setShowAdd(false); addYear(v); }} onCancel={() => setShowAdd(false)} />
      <NameModal visible={!!editYear} title="Rename Year" initial={editYear?.name} onConfirm={v => editYear && renameYear(editYear, v)} onCancel={() => setEditYear(null)} />
    </View>
  );
}

// ─── THEME PROVIDER ───────────────────────────────────────────────────────────
const THEME_KEY = "lessonvault_theme_v2";
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme(); const [colorMode, setModeState] = useState<ColorMode>("system"); const [loaded, setLoaded] = useState(false);
  useEffect(() => { AsyncStorage.getItem(THEME_KEY).then(v => { if (v === "light" || v === "dark") setModeState(v as ColorMode); setLoaded(true); }); }, []);
  const setColorMode = useCallback((m: ColorMode) => { setModeState(m); if (m === "light" || m === "dark") AsyncStorage.setItem(THEME_KEY, m); else AsyncStorage.removeItem(THEME_KEY); }, []);
  const isDark = colorMode === "dark" || (colorMode === "system" && sys === "dark"); const colors = isDark ? DARK : LIGHT;
  if (!loaded) return null;
  return <ThemeContext.Provider value={{ colors, colorMode, setColorMode, isDark }}>{children}</ThemeContext.Provider>;
}

export default function Index() {
  return (
    <ThemeProvider>
      <AlertProvider>
        <SheetProvider>
          <HomeScreen />
        </SheetProvider>
      </AlertProvider>
    </ThemeProvider>
  );
}




// /**
//  * LessonVault — School Lesson Manager
//  * PASTE AS: app/index.tsx
//  */

// import AsyncStorage from "@react-native-async-storage/async-storage";
// import * as DocumentPicker from "expo-document-picker";
// import * as FileSystem from "expo-file-system/legacy";
// import * as ImagePicker from "expo-image-picker";
// import * as MediaLibrary from "expo-media-library";
// import * as Sharing from "expo-sharing";
// import * as SQLite from "expo-sqlite";
// import JSZip from "jszip";
// import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
// import { Animated, BackHandler, Dimensions, FlatList, Image, Modal, PanResponder, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// type ColorMode = "light" | "dark" | "system";
// interface Year { id: number; name: string; created_at: string }
// interface Semester { id: number; year_id: number; name: string; created_at: string }
// interface Subject { id: number; semester_id: number; name: string; created_at: string }
// interface Lesson { id: number; subject_id: number; name: string; image_uri: string | null; is_folder: number; created_at: string; sort_order: number }

// const LIGHT = { bg: "#F5F4F0", surface: "#FFFFFF", surfaceAlt: "#EDEDEA", border: "#DDDDD8", text: "#1A1917", textSub: "#7A7874", accent: "#2563EB", accentText: "#FFFFFF", danger: "#DC2626", dangerBg: "#FEF2F2", card: "#FAFAF8", overlay: "rgba(0,0,0,0.5)", statusBar: "dark-content" as const };
// const DARK = { bg: "#111110", surface: "#1C1C1A", surfaceAlt: "#252523", border: "#333330", text: "#F2F0EB", textSub: "#888884", accent: "#3B82F6", accentText: "#FFFFFF", danger: "#EF4444", dangerBg: "#2D1515", card: "#161614", overlay: "rgba(0,0,0,0.72)", statusBar: "light-content" as const };

// interface ThemeCtx { colors: typeof LIGHT; colorMode: ColorMode; setColorMode: (m: ColorMode) => void; isDark: boolean }
// const ThemeContext = createContext<ThemeCtx>({ colors: DARK, colorMode: "system", setColorMode: () => {}, isDark: true });
// const useTheme = () => useContext(ThemeContext);

// interface AlertBtn { label: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }
// const AlertCtx = createContext<{ showAlert: (t: string, m?: string, b?: AlertBtn[]) => void }>({ showAlert: () => {} });
// const useAlert = () => useContext(AlertCtx);

// function AlertProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const [st, setSt] = useState<{ visible: boolean; title: string; message?: string; buttons: AlertBtn[] }>({ visible: false, title: "", buttons: [] });
//   const showAlert = useCallback((title: string, message?: string, buttons: AlertBtn[] = [{ label: "OK" }]) => setSt({ visible: true, title, message, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <AlertCtx.Provider value={{ showAlert }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="fade">
//         <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
//           <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: st.message ? 8 : 20 }}>{st.title}</Text>
//             {st.message && <Text style={{ color: colors.textSub, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 20 }}>{st.message}</Text>}
//             <View style={{ gap: 8 }}>
//               {st.buttons.map((b, i) => (
//                 <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress?.(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.danger : b.style === "cancel" ? colors.surfaceAlt : colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: "center", borderWidth: b.style === "cancel" ? 1 : 0, borderColor: colors.border }}>
//                   <Text style={{ color: b.style === "cancel" ? colors.text : "#fff", fontWeight: b.style === "cancel" ? "500" : "700", fontSize: 15 }}>{b.label}</Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </AlertCtx.Provider>
//   );
// }

// interface SheetBtn { label: string; icon?: string; onPress: () => void; style?: "destructive" | "cancel" }
// const SheetCtx = createContext<{ showSheet: (t?: string, b?: SheetBtn[]) => void }>({ showSheet: () => {} });
// const useSheet = () => useContext(SheetCtx);

// function SheetProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const insets = useSafeAreaInsets();
//   const [st, setSt] = useState<{ visible: boolean; title?: string; buttons: SheetBtn[] }>({ visible: false, buttons: [] });
//   const showSheet = useCallback((title?: string, buttons: SheetBtn[] = []) => setSt({ visible: true, title, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <SheetCtx.Provider value={{ showSheet }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="slide">
//         <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay }} activeOpacity={1} onPress={dismiss} />
//         <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 20 + insets.bottom, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
//           {st.title && <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>{st.title}</Text>}
//           {st.buttons.map((b, i) => (
//             <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.dangerBg : colors.surfaceAlt, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
//               {b.icon && <Text style={{ fontSize: 20 }}>{b.icon}</Text>}
//               <Text style={{ color: b.style === "destructive" ? colors.danger : colors.text, fontSize: 16, fontWeight: b.style === "cancel" ? "500" : "600" }}>{b.label}</Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </Modal>
//     </SheetCtx.Provider>
//   );
// }

// let _db: SQLite.SQLiteDatabase | null = null;
// const DB_SCHEMA = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS years (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name TEXT NOT NULL, image_uri TEXT, is_folder INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), sort_order INTEGER NOT NULL DEFAULT 0);`;
// async function getDb(): Promise<SQLite.SQLiteDatabase> {
//   if (_db) { try { await _db.getFirstAsync("SELECT 1"); return _db; } catch { _db = null; } }
//   _db = await SQLite.openDatabaseAsync("lessonvault3.db");
//   await _db.execAsync(DB_SCHEMA);
//   // Migration: add sort_order column if it doesn't exist
//   try { await _db.execAsync("ALTER TABLE lessons ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"); } catch {}
//   return _db;
// }

// async function seedDefault() {
//   const db = await getDb();
//   const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM years");
//   if (row && row.count > 0) return;
//   const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", ["Current-Year"]);
//   const yid = r.lastInsertRowId;
//   for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id, name) VALUES (?,?)", [yid, s]);
// }

// function slug(s: string) { return s.replace(/[^a-zA-Z0-9_-]/g, "_"); }
// async function ensureDir(path: string) { const info = await FileSystem.getInfoAsync(path); if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true }); }

// async function copyImage(uri: string, yearName: string, semName: string, subName: string, label: string) {
//   const dir = FileSystem.documentDirectory + `LessonVault/${slug(yearName)}/${slug(semName)}/${slug(subName)}/`;
//   await ensureDir(dir);
//   const cleanUri = uri.split("?")[0]; const rawExt = cleanUri.split(".").pop()?.toLowerCase() || "jpg"; const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(rawExt) ? rawExt : "jpg";
//   const dest = `${dir}${slug(label)}_${Date.now()}.${safeExt}`;
//   await FileSystem.copyAsync({ from: uri, to: dest }); return dest;
// }

// async function pickCamera() {
//   const { status } = await ImagePicker.requestCameraPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGallery(): Promise<string | null> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: false });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGalleryMultiple(): Promise<string[]> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return [];
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
//   return r.canceled ? [] : r.assets.map(a => a.uri);
// }

// // ── Save ZIP to Downloads on Android using SAF, share on iOS ─────────────────
// async function saveOrShareZip(zipPath: string, fname: string, showAlert: (t: string, m?: string) => void) {
//   if (Platform.OS === "android") {
//     try {
//       const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
//       if (!permissions.granted) {
//         if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" }); }
//         else { showAlert("Cancelled", "No download location selected."); }
//         return;
//       }
//       const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fname, "application/zip");
//       const zipB64 = await FileSystem.readAsStringAsync(zipPath, { encoding: FileSystem.EncodingType.Base64 });
//       await FileSystem.StorageAccessFramework.writeAsStringAsync(destUri, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       showAlert("Saved", `ZIP saved as ${fname}`);
//     } catch (e: any) {
//       try {
//         if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" });
//         else showAlert("Error", String(e));
//       } catch (e2) { showAlert("Error", String(e2)); }
//     }
//   } else {
//     if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save to Files" });
//     else showAlert("Not available", "Sharing is not available on this device.");
//   }
// }

// function Btn({ label, onPress, variant = "primary", small = false, icon, disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "danger" | "ghost" | "outline"; small?: boolean; icon?: string; disabled?: boolean }) {
//   const { colors } = useTheme();
//   const bg = variant === "primary" ? colors.accent : variant === "danger" ? colors.danger : "transparent";
//   const tc = variant === "primary" || variant === "danger" ? "#fff" : variant === "outline" ? colors.accent : colors.text;
//   return (
//     <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} style={{ backgroundColor: disabled ? colors.surfaceAlt : bg, borderColor: variant === "outline" ? colors.accent : "transparent", borderWidth: variant === "outline" ? 1.5 : 0, borderRadius: 10, paddingHorizontal: small ? 12 : 18, paddingVertical: small ? 7 : 11, flexDirection: "row", alignItems: "center", gap: 5, opacity: disabled ? 0.5 : 1 }}>
//       {icon && <Text style={{ fontSize: small ? 14 : 16 }}>{icon}</Text>}
//       <Text style={{ color: disabled ? colors.textSub : tc, fontWeight: "600", fontSize: small ? 13 : 15 }}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// function IconBtn({ icon, onPress, active = false, disabled = false }: { icon: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
//   const { colors } = useTheme();
//   return (
//     <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={{ backgroundColor: active ? colors.accent : colors.surfaceAlt, borderRadius: 9, width: 32, height: 32, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: active ? colors.accent : colors.border, opacity: disabled ? 0.4 : 1 }}>
//       <Text style={{ fontSize: 16 }}>{icon}</Text>
//     </TouchableOpacity>
//   );
// }

// function Row({ children, gap = 8, wrap = false }: { children: React.ReactNode; gap?: number; wrap?: boolean }) { return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>; }

// function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
//   const { colors } = useTheme(); const insets = useSafeAreaInsets();
//   return (
//     <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//       {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 6, alignSelf: "flex-start" }}><Text style={{ color: colors.accent, fontSize: 16 }}>← Back</Text></TouchableOpacity>}
//       <Row><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: onBack ? 22 : 26, fontWeight: "900", letterSpacing: -0.4 }}>{title}</Text>{subtitle && <Text style={{ color: colors.textSub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}</View>{right}</Row>
//     </View>
//   );
// }

// function NameModal({ visible, title, initial, placeholder, onConfirm, onCancel }: { visible: boolean; title: string; initial?: string; placeholder?: string; onConfirm: (v: string) => void; onCancel: () => void }) {
//   const { colors } = useTheme(); const [val, setVal] = useState(initial || "");
//   useEffect(() => setVal(initial || ""), [visible, initial]);
//   return (
//     <Modal visible={visible} transparent animationType="fade">
//       <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
//         <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
//           <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 14 }}>{title}</Text>
//           <TextInput value={val} onChangeText={setVal} placeholder={placeholder || "Name…"} placeholderTextColor={colors.textSub} autoFocus style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 18, borderWidth: 1, borderColor: colors.border }} />
//           <Row gap={10}><Btn label="Cancel" onPress={onCancel} variant="ghost" /><View style={{ flex: 1 }} /><Btn label="Confirm" onPress={() => { if (val.trim()) onConfirm(val.trim()); }} /></Row>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// // ─── ZOOMABLE IMAGE — fixed sensitivity ───────────────────────────────────────
// function ZoomableImage({ uri }: { uri: string }) {
//   const [dims, setDims] = useState({ w: Dimensions.get("window").width, h: Dimensions.get("window").height });

//   const currentScale = useRef(1);
//   const currentTx = useRef(0);
//   const currentTy = useRef(0);

//   const scaleAnim = useRef(new Animated.Value(1)).current;
//   const txAnim = useRef(new Animated.Value(0)).current;
//   const tyAnim = useRef(new Animated.Value(0)).current;

//   const pinchStartDist = useRef(0);
//   const pinchStartScale = useRef(1);
//   const panStartTx = useRef(0);
//   const panStartTy = useRef(0);
//   const lastTapTime = useRef(0);
//   const lastTapX = useRef(0);
//   const lastTapY = useRef(0);
//   const isPinching = useRef(false);

//   const MIN_SCALE = 1;
//   const MAX_SCALE = 5;
//   const PINCH_DAMPEN = 0.65;
//   const PAN_DAMPEN = 0.4;

//   useEffect(() => {
//     currentScale.current = 1;
//     currentTx.current = 0;
//     currentTy.current = 0;
//     scaleAnim.setValue(1);
//     txAnim.setValue(0);
//     tyAnim.setValue(0);
//   }, [uri]);

//   function getTouchDist(touches: any[]) {
//     const dx = touches[0].pageX - touches[1].pageX; const dy = touches[0].pageY - touches[1].pageY;
//     return Math.sqrt(dx * dx + dy * dy);
//   }

//   function clampTranslation(tx: number, ty: number, scale: number) {
//     const maxTx = Math.max(0, (dims.w * (scale - 1)) / 2);
//     const maxTy = Math.max(0, (dims.h * (scale - 1)) / 2);
//     return { tx: Math.min(maxTx, Math.max(-maxTx, tx)), ty: Math.min(maxTy, Math.max(-maxTy, ty)) };
//   }

//   function applyTransform(scale: number, tx: number, ty: number, animated = false) {
//     const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
//     const clamped = clampTranslation(tx, ty, s);
//     currentScale.current = s; currentTx.current = clamped.tx; currentTy.current = clamped.ty;
//     if (animated) {
//       Animated.parallel([
//         Animated.spring(scaleAnim, { toValue: s, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(txAnim, { toValue: clamped.tx, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(tyAnim, { toValue: clamped.ty, useNativeDriver: true, tension: 120, friction: 10 }),
//       ]).start();
//     } else {
//       scaleAnim.setValue(s); txAnim.setValue(clamped.tx); tyAnim.setValue(clamped.ty);
//     }
//   }

//   function resetZoom(animated = true) { applyTransform(1, 0, 0, animated); }

//   function doubleTapZoom(tapX: number, tapY: number) {
//     if (currentScale.current > 1.5) { resetZoom(true); return; }
//     const newScale = 2.5;
//     const tx = (dims.w / 2 - tapX) * (newScale - 1);
//     const ty = (dims.h / 2 - tapY) * (newScale - 1);
//     applyTransform(newScale, tx, ty, true);
//   }

//   const panResponder = useRef(PanResponder.create({
//     onStartShouldSetPanResponder: () => currentScale.current > 1,
//     onMoveShouldSetPanResponder: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) return true;
//       return currentScale.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
//     },
//     onPanResponderGrant: (e) => {
//       const touches = e.nativeEvent.touches;
//       isPinching.current = touches.length >= 2;
//       if (touches.length >= 2) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; }
//       panStartTx.current = currentTx.current; panStartTy.current = currentTy.current;
//     },
//     onPanResponderMove: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) {
//         isPinching.current = true;
//         if (pinchStartDist.current === 0) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; return; }
//         const dist = getTouchDist(Array.from(touches));
//         const rawRatio = dist / pinchStartDist.current;
//         const dampenedRatio = 1 + (rawRatio - 1) * PINCH_DAMPEN;
//         const newScale = pinchStartScale.current * dampenedRatio;
//         applyTransform(newScale, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       } else if (!isPinching.current && currentScale.current > 1) {
//         applyTransform(currentScale.current, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       }
//     },
//     onPanResponderRelease: (e, g) => {
//       const wasPinching = isPinching.current;
//       isPinching.current = false; pinchStartDist.current = 0;
//       if (currentScale.current <= 1.05) { resetZoom(true); return; }
//       const { tx, ty } = clampTranslation(currentTx.current, currentTy.current, currentScale.current);
//       if (tx !== currentTx.current || ty !== currentTy.current) applyTransform(currentScale.current, tx, ty, true);
//       if (!wasPinching && Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
//         const now = Date.now();
//         const x = e.nativeEvent.changedTouches[0]?.pageX ?? dims.w / 2;
//         const y = e.nativeEvent.changedTouches[0]?.pageY ?? dims.h / 2;
//         if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) { lastTapTime.current = 0; doubleTapZoom(x, y); }
//         else { lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y; }
//       }
//     },
//     onPanResponderTerminationRequest: () => currentScale.current <= 1,
//   })).current;

//   function handleTap(e: any) {
//     if (currentScale.current > 1) return;
//     const now = Date.now();
//     const x = e.nativeEvent.pageX ?? dims.w / 2;
//     const y = e.nativeEvent.pageY ?? dims.h / 2;
//     if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) {
//       lastTapTime.current = 0;
//       doubleTapZoom(x, y);
//     } else {
//       lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y;
//     }
//   }

//   return (
//     <TouchableOpacity activeOpacity={1} onPress={handleTap} style={{ flex: 1 }} onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
//       <Animated.Image source={{ uri }} {...panResponder.panHandlers} style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateX: txAnim }, { translateY: tyAnim }] }} resizeMode="contain" />
//     </TouchableOpacity>
//   );
// }

// // ─── IMAGE VIEWER ─────────────────────────────────────────────────────────────
// function ImageViewer({ uris, initialIndex = 0, onClose }: { uris: string[]; initialIndex?: number; onClose: () => void }) {
//   const insets = useSafeAreaInsets();
//   const [currentIndex, setCurrentIndex] = useState(initialIndex);
//   const flatListRef = useRef<FlatList>(null);
//   const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

//   useEffect(() => {
//     if (uris.length > 1 && initialIndex > 0) {
//       setTimeout(() => { flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false }); }, 0);
//     }
//     setCurrentIndex(initialIndex);
//   }, [initialIndex, uris]);

//   if (!uris.length) return null;

//   return (
//     <Modal visible animationType="fade" statusBarTranslucent>
//       <View style={{ flex: 1, backgroundColor: "#000" }}>
//         <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: insets.top + 10, right: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 22, width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
//           <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
//         </TouchableOpacity>
//         {uris.length > 1 && (
//           <View style={{ position: "absolute", top: insets.top + 14, left: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }}>
//             <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{currentIndex + 1} / {uris.length}</Text>
//           </View>
//         )}
//         <FlatList
//           ref={flatListRef}
//           data={uris}
//           keyExtractor={(_, i) => String(i)}
//           horizontal
//           pagingEnabled
//           showsHorizontalScrollIndicator={false}
//           initialScrollIndex={initialIndex}
//           getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
//           onMomentumScrollEnd={e => {
//             const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
//             setCurrentIndex(newIndex);
//           }}
//           scrollEnabled
//           renderItem={({ item }) => (
//             <View style={{ width: SCREEN_W, height: SCREEN_H }}>
//               <ZoomableImage uri={item} />
//             </View>
//           )}
//         />
//         <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 12, paddingBottom: insets.bottom + 12, position: "absolute", bottom: 0, left: 0, right: 0 }}>
//           {uris.length > 1 ? "Swipe left/right to browse · Pinch or double-tap to zoom" : "Pinch or double-tap to zoom"}
//         </Text>
//       </View>
//     </Modal>
//   );
// }

// // ─── DRAG-AND-DROP GRID ───────────────────────────────────────────────────────
// // Single PanResponder on the container. dragMode fed via ref so the closure
// // never goes stale. Grid origin measured on layout (not async on grant).
// // Order is computed by tracking hoverIdx in a ref and rebuilding on release.

// interface DraggableGridProps {
//   items: Lesson[];
//   numColumns: number;
//   itemSize: { width: number; height: number };
//   dragMode: boolean;
//   onReorder: (newOrder: Lesson[]) => void;
//   renderItemContent: (item: Lesson, isDragging: boolean) => React.ReactNode;
//   bottomPadding?: number;
// }

// function DraggableGrid({ items, numColumns, itemSize, dragMode, onReorder, renderItemContent, bottomPadding = 0 }: DraggableGridProps) {
//   const ITEM_W = itemSize.width;
//   const ITEM_H = itemSize.height;
//   const ITEM_GAP = 12;

//   // ── ordered list – only written on release ────────────────────────────────
//   const [localItems, setLocalItems] = useState<Lesson[]>(items);
//   const localItemsRef = useRef<Lesson[]>(items);

//   // sync from parent when not dragging
//   const activeRef = useRef(false);
//   useEffect(() => {
//     if (!activeRef.current) {
//       localItemsRef.current = items;
//       setLocalItems(items);
//     }
//   }, [items]);

//   // ── drag state (all refs – zero setState during move) ─────────────────────
//   const dragModeRef = useRef(dragMode);
//   useEffect(() => { dragModeRef.current = dragMode; }, [dragMode]);

//   const [draggingId, setDraggingId] = useState<number | null>(null); // triggers float render
//   const [hoverIdx,   setHoverIdx]   = useState<number | null>(null); // triggers gap render
//   const draggingIdRef = useRef<number | null>(null);
//   const hoverIdxRef   = useRef<number | null>(null);
//   const fromIdxRef    = useRef(0);

//   const dragXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

//   // grid top-left in page coords – updated every layout change
//   const gridOrigin = useRef({ x: 0, y: 0 });
//   const gridRef    = useRef<View>(null);

//   // float anchor in grid-relative coords (set at grant)
//   const floatOrigin = useRef({ x: 0, y: 0 });

//   // cancel any in-flight drag when dragMode is turned off externally
//   useEffect(() => {
//     if (!dragMode && activeRef.current) {
//       activeRef.current       = false;
//       draggingIdRef.current   = null;
//       hoverIdxRef.current     = null;
//       dragXY.setValue({ x: 0, y: 0 });
//       setDraggingId(null);
//       setHoverIdx(null);
//     }
//   }, [dragMode]);

//   function idxFromPagePos(px: number, py: number): number {
//     const lx  = px - gridOrigin.current.x;
//     const ly  = py - gridOrigin.current.y;
//     const col = Math.max(0, Math.min(numColumns - 1, Math.floor(lx / (ITEM_W + ITEM_GAP))));
//     const row = Math.max(0, Math.floor(ly / (ITEM_H + ITEM_GAP)));
//     return Math.max(0, Math.min(localItemsRef.current.length - 1, row * numColumns + col));
//   }

//   const panResponder = useRef(PanResponder.create({
//     // Claim on start only if in drag mode – this is what was missing before
//     onStartShouldSetPanResponder:       () => dragModeRef.current,
//     onStartShouldSetPanResponderCapture:() => dragModeRef.current,
//     onMoveShouldSetPanResponder:        () => dragModeRef.current,
//     onMoveShouldSetPanResponderCapture: () => dragModeRef.current,

//     onPanResponderGrant: (e) => {
//       if (!dragModeRef.current) return;
//       const touchX = e.nativeEvent.pageX;
//       const touchY = e.nativeEvent.pageY;
//       const idx  = idxFromPagePos(touchX, touchY);
//       const item = localItemsRef.current[idx];
//       if (!item) return;

//       // Float starts at this card's grid-relative top-left
//       const cardCol = idx % numColumns;
//       const cardRow = Math.floor(idx / numColumns);
//       floatOrigin.current = {
//         x: cardCol * (ITEM_W + ITEM_GAP),
//         y: cardRow * (ITEM_H + ITEM_GAP),
//       };

//       activeRef.current     = true;
//       draggingIdRef.current = item.id;
//       hoverIdxRef.current   = idx;
//       fromIdxRef.current    = idx;
//       dragXY.setValue({ x: 0, y: 0 });
//       setDraggingId(item.id);
//       setHoverIdx(idx);
//     },

//     onPanResponderMove: (e, g) => {
//       if (!activeRef.current) return;
//       dragXY.setValue({ x: g.dx, y: g.dy });
//       const newIdx = idxFromPagePos(e.nativeEvent.pageX, e.nativeEvent.pageY);
//       if (newIdx !== hoverIdxRef.current) {
//         hoverIdxRef.current = newIdx;
//         setHoverIdx(newIdx);
//       }
//     },

//     onPanResponderRelease:   () => finishDrag(false),
//     onPanResponderTerminate: () => finishDrag(true),
//   })).current;

//   function finishDrag(cancelled: boolean) {
//     if (!activeRef.current) return;
//     const from = fromIdxRef.current;
//     const to   = hoverIdxRef.current ?? from;
//     activeRef.current     = false;
//     draggingIdRef.current = null;
//     hoverIdxRef.current   = null;

//     dragXY.setValue({ x: 0, y: 0 });

//     if (!cancelled && from !== to) {
//       // Commit new order first, hide float in the same batch
//       const next = [...localItemsRef.current];
//       const [moved] = next.splice(from, 1);
//       next.splice(to, 0, moved);
//       localItemsRef.current = next;
//       setLocalItems(next);
//       onReorder(next);
//     }
//     // Hide float after order is committed — no intermediate frame with old layout
//     setDraggingId(null);
//     setHoverIdx(null);
//   }

//   // ── display list: remove dragged item, insert gap at hoverIdx ─────────────
//   type DisplayItem = Lesson | { __gap: true; id: string };
//   function buildDisplayList(): DisplayItem[] {
//     if (draggingId === null || hoverIdx === null) return localItems;
//     const from = localItems.findIndex(l => l.id === draggingId);
//     if (from === -1) return localItems;
//     const without = localItems.filter(l => l.id !== draggingId);
//     const target  = Math.max(0, Math.min(without.length, hoverIdx));
//     without.splice(target, 0, { __gap: true, id: `gap-${draggingId}` } as any);
//     return without;
//   }

//   const displayList = buildDisplayList();
//   const rows: DisplayItem[][] = [];
//   for (let i = 0; i < displayList.length; i += numColumns) rows.push(displayList.slice(i, i + numColumns));

//   const draggingItem = draggingId !== null ? localItems.find(l => l.id === draggingId) ?? null : null;
//   // floatOrigin is grid-relative; add 18px for the ScrollView padding
//   const floatLeft = floatOrigin.current.x + 18;
//   const floatTop  = floatOrigin.current.y + 18;

//   return (
//     <View
//       style={{ flex: 1 }}
//       {...panResponder.panHandlers}
//     >
//       <ScrollView
//         contentContainerStyle={{ padding: 18, paddingBottom: bottomPadding + 18 }}
//         scrollEnabled={!activeRef.current}
//       >
//         <View
//           ref={gridRef}
//           collapsable={false}
//           onLayout={() => {
//             gridRef.current?.measure((_fx, _fy, _w, _h, px, py) => {
//               gridOrigin.current = { x: px, y: py };
//             });
//           }}
//         >
//           {rows.map((row, rowIdx) => (
//             <View key={rowIdx} style={{ flexDirection: "row", gap: ITEM_GAP, marginBottom: rowIdx < rows.length - 1 ? ITEM_GAP : 0 }}>
//               {row.map((item: any) => {
//                 if (item.__gap) {
//                   return (
//                     <View key={item.id} style={{ width: ITEM_W, height: ITEM_H, borderRadius: 12, backgroundColor: "rgba(128,128,128,0.15)", borderWidth: 2, borderColor: "rgba(128,128,128,0.3)", borderStyle: "dashed" }} />
//                   );
//                 }
//                 if (item.id === draggingId) {
//                   // Invisible placeholder keeps the row height correct
//                   return <View key={item.id} style={{ width: ITEM_W, height: ITEM_H, opacity: 0 }} />;
//                 }
//                 return (
//                   <View key={item.id} style={{ width: ITEM_W, borderRadius: 12, overflow: "hidden" }}>
//                     {renderItemContent(item as Lesson, false)}
//                   </View>
//                 );
//               })}
//               {row.length < numColumns && Array.from({ length: numColumns - row.length }).map((_, i) => (
//                 <View key={`empty-${i}`} style={{ width: ITEM_W }} />
//               ))}
//             </View>
//           ))}
//         </View>
//       </ScrollView>

//       {draggingItem && (
//         <Animated.View
//           pointerEvents="none"
//           style={{
//             position: "absolute",
//             top: floatTop,
//             left: floatLeft,
//             width: ITEM_W,
//             borderRadius: 12,
//             overflow: "hidden",
//             zIndex: 999,
//             elevation: 16,
//             shadowColor: "#000",
//             shadowOpacity: 0.45,
//             shadowRadius: 16,
//             shadowOffset: { width: 0, height: 8 },
//             transform: [{ translateX: dragXY.x }, { translateY: dragXY.y }, { scale: 1.06 }],
//           }}
//         >
//           {renderItemContent(draggingItem, true)}
//         </Animated.View>
//       )}
//     </View>
//   );
// }

// // ─── FOLDER LESSONS SCREEN ────────────────────────────────────────────────────
// function FolderLessonsScreen({ folder, subject, semesterName, yearName, onBack, breadcrumb }: { folder: Lesson; subject: Subject; semesterName: string; yearName: string; onBack: () => void; breadcrumb?: string }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null);
//   const [viewerState, setViewerState] = useState<{ uris: string[]; index: number } | null>(null);
//   const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false);
//   const [dragMode, setDragMode] = useState(false);
//   const [openSubFolder, setOpenSubFolder] = useState<Lesson | null>(null);

//   const PREFIX = `FC:${folder.id}:`;

//   const load = useCallback(async () => {
//     const db = await getDb();
//     const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY sort_order ASC, created_at DESC", [subject.id]);
//     setLessons(all.filter(l => l.image_uri?.startsWith(PREFIX)));
//   }, [subject.id, folder.id]);

//   useEffect(() => { load(); }, [load]);

//   useEffect(() => {
//     const handler = BackHandler.addEventListener("hardwareBackPress", () => {
//       if (openSubFolder) { setOpenSubFolder(null); load(); return true; }
//       return false;
//     });
//     return () => handler.remove();
//   }, [openSubFolder]);

//   async function commitPhoto(name: string, uri: string) {
//     const copied = await copyImage(uri, yearName, semesterName, subject.name, name);
//     const storedUri = `${PREFIX}${copied}`;
//     const db = await getDb();
//     const maxRow = await db.getFirstAsync<{ m: number }>("SELECT MAX(sort_order) as m FROM lessons WHERE subject_id=?", [subject.id]);
//     const nextOrder = (maxRow?.m ?? -1) + 1;
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder, sort_order) VALUES (?,?,?,0,?)", [subject.id, name, storedUri, nextOrder]);
//   }
//   async function commitSubFolder(name: string) {
//     const storedUri = `${PREFIX}__folder__`;
//     const db = await getDb();
//     const maxRow = await db.getFirstAsync<{ m: number }>("SELECT MAX(sort_order) as m FROM lessons WHERE subject_id=?", [subject.id]);
//     const nextOrder = (maxRow?.m ?? -1) + 1;
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder, sort_order) VALUES (?,?,?,1,?)", [subject.id, name, storedUri, nextOrder]);
//   }

//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitPhoto(`Photo ${lessons.length + i + 1}`, uris[i]); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitNamed(name: string, uri: string) { try { await commitPhoto(name, uri); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() {
//     showSheet("Add to " + folder.name, [
//       { label: "Quick Photos (auto-name)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) },
//       { label: "Named Photo", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) },
//       { label: "Create Sub-Folder", icon: "📁", onPress: () => { setPendingUris(["__subfolder__"]); setNameModalVis(true); } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   function getRealUri(l: Lesson): string | null {
//     if (!l.image_uri || l.is_folder) return null;
//     // Strip all FC:id: prefixes (handles nested sub-folders)
//     return l.image_uri.replace(/^(?:FC:\d+:)+/, "") || null;
//   }

//   function getPhotoUris(): string[] {
//     return lessons.filter(l => !l.is_folder).map(l => getRealUri(l)).filter(Boolean) as string[];
//   }

//   async function deepDelete(l: Lesson) {
//     const db = await getDb();
//     if (l.is_folder) {
//       const childPrefix = `FC:${l.id}:`;
//       const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]);
//       const children = all.filter(c => c.image_uri?.startsWith(childPrefix));
//       for (const c of children) await deepDelete(c);
//     } else {
//       const real = getRealUri(l);
//       if (real) try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {}
//     }
//     await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]);
//   }

//   function confirmDelete(l: Lesson) {
//     showAlert("Delete", `Delete "${l.name}"${l.is_folder ? " and all its contents" : ""}?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { await deepDelete(l); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function confirmDeleteSelected() {
//     showAlert("Delete Selected", `Delete ${selected.size} item(s)?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { for (const id of selected) { const l = lessons.find(x => x.id === id); if (l) await deepDelete(l); } setSelected(new Set()); setSelectMode(false); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function clearFolderContents(l: Lesson) {
//     showAlert("Clear Sub-Folder", `Delete all contents inside "${l.name}"? The folder itself will remain.`, [
//       { label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const childPrefix = `FC:${l.id}:`; const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(c => c.image_uri?.startsWith(childPrefix)); for (const c of children) await deepDelete(c); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function openPhotoViewer(l: Lesson) {
//     const realUri = getRealUri(l);
//     if (!realUri) return;
//     const allUris = getPhotoUris();
//     const idx = allUris.indexOf(realUri);
//     setViewerState({ uris: allUris, index: idx >= 0 ? idx : 0 });
//   }

//   function openMenu(l: Lesson) {
//     const realUri = getRealUri(l);
//     showSheet(l.name, [
//       ...(realUri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => openPhotoViewer(l) }] : []),
//       ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenSubFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []),
//       { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) },
//       { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) },
//       { label: "Cancel", style: "cancel" as const, onPress: () => {} },
//     ]);
//   }

//   async function handleReorder(newOrder: Lesson[]) {
//     const db = await getDb();
//     for (let i = 0; i < newOrder.length; i++) {
//       await db.runAsync("UPDATE lessons SET sort_order=? WHERE id=?", [i, newOrder[i].id]);
//     }
//     setLessons(newOrder);
//   }

//   if (openSubFolder) {
//     const bc = breadcrumb ? `${breadcrumb} › ${folder.name}` : folder.name;
//     return <FolderLessonsScreen folder={openSubFolder} subject={subject} semesterName={semesterName} yearName={yearName} breadcrumb={bc} onBack={() => { setOpenSubFolder(null); load(); }} />;
//   }

//   const W = Dimensions.get("window").width;
//   const IMG = (W - 48 - 12) / 2;
//   const subtitle = breadcrumb ? `${breadcrumb} › ${folder.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}` : `📁 ${subject.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`;

//   function renderItemContent(item: Lesson, isDragging: boolean) {
//     const isSel = selected.has(item.id);
//     const realUri = getRealUri(item);
//     return (
//       <TouchableOpacity
//         activeOpacity={dragMode ? 1 : 0.85}
//         onPress={() => {
//           if (dragMode) return;
//           if (selectMode) toggleSel(item.id);
//           else if (item.is_folder) setOpenSubFolder(item);
//           else openPhotoViewer(item);
//         }}
//         onLongPress={() => {
//           if (!selectMode && !dragMode) { setSelectMode(true); toggleSel(item.id); }
//         }}
//         style={{
//           borderRadius: 12,
//           overflow: "hidden",
//           backgroundColor: colors.card,
//           borderWidth: isSel ? 2.5 : 1,
//           borderColor: isSel ? colors.accent : isDragging ? colors.accent : colors.border,
//         }}
//       >
//         {item.is_folder
//           ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View>
//           : realUri
//           ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />
//           : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>
//         }
//         <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}>
//           {dragMode && <Text style={{ fontSize: 14, marginRight: 4, color: colors.textSub }}>☰</Text>}
//           <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>
//           {!selectMode && !dragMode && (
//             <TouchableOpacity onPress={() => openMenu(item)}>
//               <Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text>
//             </TouchableOpacity>
//           )}
//         </View>
//         {isSel && (
//           <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
//             <Text style={{ color: "#fff", fontSize: 14 }}>✓</Text>
//           </View>
//         )}
//       </TouchableOpacity>
//     );
//   }

//   const headerRight = (
//     <Row gap={6}>
//       {!selectMode && !dragMode && (
//         <>
//           <Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small />
//           <IconBtn icon="⠿" onPress={() => setDragMode(true)} active />
//           <Btn label="+ Add" onPress={handleAdd} small />
//         </>
//       )}
//       {!selectMode && dragMode && (
//         <Btn label="Done" onPress={() => setDragMode(false)} variant="primary" small />
//       )}
//       {selectMode && (
//         <>
//           <Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} />
//           <Btn label="All" onPress={selectAll} variant="outline" small />
//           <Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small />
//         </>
//       )}
//     </Row>
//   );

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={folder.name} subtitle={subtitle} onBack={onBack} right={headerRight} />
//       {lessons.length === 0 ? (
//         <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
//           <Text style={{ fontSize: 52 }}>📸</Text>
//           <Text style={{ color: colors.textSub, fontSize: 15 }}>Folder is empty</Text>
//           <Btn label="+ Add" onPress={handleAdd} />
//         </View>
//       ) : (
//         <DraggableGrid
//           items={lessons}
//           numColumns={2}
//           itemSize={{ width: IMG, height: IMG * 1.15 + 36 }}
//           dragMode={dragMode}
//           onReorder={handleReorder}
//           renderItemContent={renderItemContent}
//           bottomPadding={insets.bottom}
//         />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__subfolder__" ? "Name this Sub-Folder" : "Name this Photo"} placeholder={pendingUris[0] === "__subfolder__" ? "e.g. Week 1" : "e.g. Page 1"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__subfolder__") commitSubFolder(name).then(load); else if (pendingUris.length) commitNamed(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       {viewerState && <ImageViewer uris={viewerState.uris} initialIndex={viewerState.index} onClose={() => setViewerState(null)} />}
//     </View>
//   );
// }

// // ─── LESSONS SCREEN ───────────────────────────────────────────────────────────
// function LessonsScreen({ subject, semesterName, yearName, onBack }: { subject: Subject; semesterName: string; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null);
//   const [viewerState, setViewerState] = useState<{ uris: string[]; index: number } | null>(null);
//   const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false);
//   const [dragMode, setDragMode] = useState(false);
//   const [openFolder, setOpenFolder] = useState<Lesson | null>(null);

//   const load = useCallback(async () => {
//     const db = await getDb();
//     const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY sort_order ASC, created_at DESC", [subject.id]);
//     setLessons(all.filter(l => !l.image_uri?.startsWith("FC:")));
//   }, [subject.id]);

//   useEffect(() => { load(); }, [load]);

//   async function commitOne(name: string, uri: string, isFolder = false) {
//     let storedUri: string | null = uri;
//     if (uri && !isFolder) storedUri = await copyImage(uri, yearName, semesterName, subject.name, name);
//     const db = await getDb();
//     const maxRow = await db.getFirstAsync<{ m: number }>("SELECT MAX(sort_order) as m FROM lessons WHERE subject_id=?", [subject.id]);
//     const nextOrder = (maxRow?.m ?? -1) + 1;
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder, sort_order) VALUES (?,?,?,?,?)", [subject.id, name, storedUri, isFolder ? 1 : 0, nextOrder]);
//   }
//   async function commit(name: string, uri: string | null, isFolder = false) { try { await commitOne(name, uri ?? "", isFolder); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitOne(`Photo ${lessons.length + i + 1}`, uris[i], false); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access is required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access is required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access is required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() { showSheet("Add to " + subject.name, [{ label: "Quick Photos (auto-name, multi)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) }, { label: "Named Image Lesson", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) }, { label: "Create Folder Lesson", icon: "📁", onPress: () => { setPendingUris(["__folder__"]); setNameModalVis(true); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }
//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   function confirmDelete(l: Lesson) { showAlert("Delete Lesson", `Delete "${l.name}"?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} load(); } }, { label: "Cancel", style: "cancel" }]); }
//   function confirmDeleteSelected() { showAlert("Delete Selected", `Delete ${selected.size} lesson(s)?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); for (const id of selected) { const l = lessons.find(x => x.id === id); if (!l) continue; await db.runAsync("DELETE FROM lessons WHERE id=?", [id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } setSelected(new Set()); setSelectMode(false); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function clearFolderContents(folder: Lesson) { showAlert("Clear Folder Content", `Delete all photos inside "${folder.name}"? The folder itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(l => l.image_uri?.startsWith(`FC:${folder.id}:`)); for (const l of children) { await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); const real = l.image_uri!.replace(/^(?:FC:\d+:)+/, ""); try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {} } load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function getRealUriForLesson(l: Lesson): string | null {
//     if (!l.image_uri || l.is_folder) return null;
//     return l.image_uri.replace(/^(?:FC:\d+:)+/, "") || null;
//   }

//   function getPhotoUris(): string[] {
//     return lessons.filter(l => !l.is_folder).map(l => getRealUriForLesson(l)).filter(Boolean) as string[];
//   }

//   function openPhotoViewer(l: Lesson) {
//     const realUri = getRealUriForLesson(l);
//     if (!realUri) return;
//     const allUris = getPhotoUris();
//     const idx = allUris.indexOf(realUri);
//     setViewerState({ uris: allUris, index: idx >= 0 ? idx : 0 });
//   }

//   function openMenu(l: Lesson) { showSheet(l.name, [...(!l.is_folder && l.image_uri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => openPhotoViewer(l) }] : []), ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []), { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) }, { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) }, { label: "Cancel", style: "cancel" as const, onPress: () => {} }]); }

//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (openFolder) { setOpenFolder(null); load(); return true; } return false; }); return () => handler.remove(); }, [openFolder]);

//   async function handleReorder(newOrder: Lesson[]) {
//     const db = await getDb();
//     for (let i = 0; i < newOrder.length; i++) {
//       await db.runAsync("UPDATE lessons SET sort_order=? WHERE id=?", [i, newOrder[i].id]);
//     }
//     setLessons(newOrder);
//   }

//   if (openFolder) return <FolderLessonsScreen folder={openFolder} subject={subject} semesterName={semesterName} yearName={yearName} onBack={() => { setOpenFolder(null); load(); }} />;

//   const W = Dimensions.get("window").width;
//   const IMG = (W - 48 - 12) / 2;

//   function renderItemContent(item: Lesson, isDragging: boolean) {
//     const isSel = selected.has(item.id);
//     const realUri = getRealUriForLesson(item);
//     return (
//       <TouchableOpacity
//         activeOpacity={dragMode ? 1 : 0.85}
//         onPress={() => {
//           if (dragMode) return;
//           if (selectMode) toggleSel(item.id);
//           else if (item.is_folder) setOpenFolder(item);
//           else openPhotoViewer(item);
//         }}
//         onLongPress={() => {
//           if (!selectMode && !dragMode) { setSelectMode(true); toggleSel(item.id); }
//         }}
//         style={{
//           borderRadius: 12,
//           overflow: "hidden",
//           backgroundColor: colors.card,
//           borderWidth: isSel ? 2.5 : 1,
//           borderColor: isSel ? colors.accent : isDragging ? colors.accent : colors.border,
//         }}
//       >
//         {item.is_folder
//           ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View>
//           : realUri
//           ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />
//           : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>
//         }
//         <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}>
//           {dragMode && <Text style={{ fontSize: 14, marginRight: 4, color: colors.textSub }}>☰</Text>}
//           <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>
//           {!selectMode && !dragMode && (
//             <TouchableOpacity onPress={() => openMenu(item)}>
//               <Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text>
//             </TouchableOpacity>
//           )}
//         </View>
//         {isSel && (
//           <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
//             <Text style={{ color: "#fff", fontSize: 14 }}>✓</Text>
//           </View>
//         )}
//       </TouchableOpacity>
//     );
//   }

//   const headerRight = (
//     <Row gap={6}>
//       {!selectMode && !dragMode && (
//         <>
//           <Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small />
//           <IconBtn icon="⠿" onPress={() => setDragMode(true)} active />
//           <Btn label="+ Add" onPress={handleAdd} small />
//         </>
//       )}
//       {!selectMode && dragMode && (
//         <Btn label="Done" onPress={() => setDragMode(false)} variant="primary" small />
//       )}
//       {selectMode && (
//         <>
//           <Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} />
//           <Btn label="All" onPress={selectAll} variant="outline" small />
//           <Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small />
//         </>
//       )}
//     </Row>
//   );

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={subject.name} subtitle={`${semesterName} · ${yearName} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`} onBack={onBack} right={headerRight} />
//       {lessons.length === 0 ? (
//         <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
//           <Text style={{ fontSize: 52 }}>📸</Text>
//           <Text style={{ color: colors.textSub, fontSize: 15 }}>No items yet</Text>
//           <Btn label="+ Add Lesson" onPress={handleAdd} />
//         </View>
//       ) : (
//         <DraggableGrid
//           items={lessons}
//           numColumns={2}
//           itemSize={{ width: IMG, height: IMG * 1.15 + 36 }}
//           dragMode={dragMode}
//           onReorder={handleReorder}
//           renderItemContent={renderItemContent}
//           bottomPadding={insets.bottom}
//         />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__folder__" ? "Name this Folder" : "Name this Lesson"} placeholder={pendingUris[0] === "__folder__" ? "e.g. Exercises" : "e.g. Chapter 3 Notes"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__folder__") commit(name, null, true); else if (pendingUris.length) commit(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       {viewerState && <ImageViewer uris={viewerState.uris} initialIndex={viewerState.index} onClose={() => setViewerState(null)} />}
//     </View>
//   );
// }

// // ─── SUBJECTS SCREEN ──────────────────────────────────────────────────────────
// function SubjectsScreen({ semester, yearName, onBack }: { semester: Semester; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [subjects, setSubjects] = useState<Subject[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSubject, setEditSubject] = useState<Subject | null>(null); const [active, setActive] = useState<Subject | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSubjects(await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? ORDER BY name ASC", [semester.id])); }, [semester.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (active) { setActive(null); return true; } return false; }); return () => handler.remove(); }, [active]);

//   async function applySubjectToOthers(name: string, scope: "all_semesters" | "all_years") { const db = await getDb(); if (scope === "all_semesters") { const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND id!=?", [semester.year_id, semester.id]); for (const s of sems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } else if (scope === "all_years") { const allSems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE name=? AND id!=?", [semester.name, semester.id]); for (const s of allSems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } }

//   function addSubjectFlow(name: string) { setShowAdd(false); showSheet("Apply to other semesters?", [{ label: "This semester only", icon: "📂", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); load(); } }, { label: "All semesters in this year", icon: "📅", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_semesters"); load(); } }, { label: "All years (same semester name)", icon: "🗂️", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_years"); load(); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }

//   async function rename(sub: Subject, name: string) { const db = await getDb(); await db.runAsync("UPDATE subjects SET name=? WHERE id=?", [name, sub.id]); setEditSubject(null); load(); }

//   function confirmDelete(sub: Subject) { showAlert("Delete Subject", `Delete "${sub.name}" and all its lessons?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (active) return <LessonsScreen subject={active} semesterName={semester.name} yearName={yearName} onBack={() => setActive(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={semester.name} subtitle={`${yearName} · ${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Subject" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
//         {subjects.map(sub => (
//           <TouchableOpacity key={sub.id} onPress={() => setActive(sub)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 24 }}>📗</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sub.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sub.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSubject(sub) }, { label: "Clear All Lessons", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Lessons", `Delete all lessons in "${sub.name}"?`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM lessons WHERE subject_id=?", [sub.id]); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Subject", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sub) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {subjects.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📗</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No subjects yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Subject" placeholder="e.g. Mathematics" onConfirm={addSubjectFlow} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSubject} title="Rename Subject" initial={editSubject?.name} onConfirm={v => editSubject && rename(editSubject, v)} onCancel={() => setEditSubject(null)} />
//     </View>
//   );
// }

// // ─── YEAR SCREEN ──────────────────────────────────────────────────────────────
// function YearScreen({ year, onBack }: { year: Year; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [semesters, setSemesters] = useState<Semester[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSem, setEditSem] = useState<Semester | null>(null); const [activeSem, setActiveSem] = useState<Semester | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSemesters(await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? ORDER BY created_at ASC", [year.id])); }, [year.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeSem) { setActiveSem(null); return true; } return false; }); return () => handler.remove(); }, [activeSem]);

//   async function add(name: string) { const db = await getDb(); await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [year.id, name]); load(); }
//   async function rename(sem: Semester, name: string) { const db = await getDb(); await db.runAsync("UPDATE semesters SET name=? WHERE id=?", [name, sem.id]); setEditSem(null); load(); }

//   async function deleteSemContent(sem: Semester) { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } await db.runAsync("DELETE FROM semesters WHERE id=?", [sem.id]); }

//   function confirmDelete(sem: Semester) { showAlert("Delete Semester", `Delete "${sem.name}" and all its content?`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteSemContent(sem); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (activeSem) return <SubjectsScreen semester={activeSem} yearName={year.name} onBack={() => setActiveSem(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={year.name} subtitle={`${semesters.length} semester${semesters.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Semester" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
//         {semesters.map(sem => (
//           <TouchableOpacity key={sem.id} onPress={() => setActiveSem(sem)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 26 }}>📂</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sem.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sem.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSem(sem) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Semester Content", `Delete all subjects and lessons inside "${sem.name}"? The semester itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Semester", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sem) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {semesters.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No semesters yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Semester" placeholder="e.g. Semester 1" onConfirm={v => { setShowAdd(false); add(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSem} title="Rename Semester" initial={editSem?.name} onConfirm={v => editSem && rename(editSem, v)} onCancel={() => setEditSem(null)} />
//     </View>
//   );
// }

// // ─── HOME SCREEN ──────────────────────────────────────────────────────────────
// function HomeScreen() {
//   const { colors, isDark, colorMode, setColorMode } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const insets = useSafeAreaInsets();
//   const [years, setYears] = useState<Year[]>([]); const [showAdd, setShowAdd] = useState(false); const [editYear, setEditYear] = useState<Year | null>(null); const [activeYear, setActiveYear] = useState<Year | null>(null); const [busy, setBusy] = useState<"export" | "import" | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setYears(await db.getAllAsync<Year>("SELECT * FROM years ORDER BY created_at DESC")); }, []);
//   useEffect(() => { seedDefault().then(load); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeYear) { setActiveYear(null); return true; } return false; }); return () => handler.remove(); }, [activeYear]);

//   async function addYear(name: string) { const db = await getDb(); try { const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", [name]); const yid = r.lastInsertRowId; for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s]); load(); } catch (e: any) { if (String(e).includes("UNIQUE")) showAlert("Name Taken", "A year with that name already exists."); else showAlert("Error", String(e)); } }
//   async function renameYear(year: Year, name: string) { const db = await getDb(); await db.runAsync("UPDATE years SET name=? WHERE id=?", [name, year.id]); setEditYear(null); load(); }

//   async function deleteYearContent(year: Year) { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } } await db.runAsync("DELETE FROM years WHERE id=?", [year.id]); }
//   function confirmDeleteYear(year: Year) { showAlert("Delete Year", `Delete "${year.name}" and all its content? This cannot be undone.`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteYearContent(year); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   async function exportZip() {
//     const fname = `LessonVault_${new Date().toISOString().slice(0, 10)}.zip`;
//     const zipPath = FileSystem.cacheDirectory + fname;

//     async function buildZip(): Promise<string> {
//       const db = await getDb();
//       const zip = new JSZip();
//       const allYears = await db.getAllAsync<Year>("SELECT * FROM years");
//       const manifest: any = { exportedAt: new Date().toISOString(), years: [] };

//       for (const y of allYears) {
//         const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [y.id]);
//         const semData: any[] = [];
//         for (const s of sems) {
//           const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]);
//           const subData: any[] = [];
//           for (const sub of subs) {
//             // Fetch ALL lessons for this subject (includes folder-children)
//             const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY sort_order ASC, created_at ASC", [sub.id]);
//             for (const l of ls) {
//               if (l.is_folder) continue;
//               // Strip all FC:id: prefixes to get the real file path
//               let realUri = l.image_uri || "";
//               realUri = realUri.replace(/^(?:FC:\d+:)+/, "");
//               if (!realUri || realUri === "__folder__") continue;
//               const info = await FileSystem.getInfoAsync(realUri);
//               if (!info.exists) continue;
//               const b64 = await FileSystem.readAsStringAsync(realUri, { encoding: FileSystem.EncodingType.Base64 });
//               if (!b64) continue;
//               const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//               zip.file(`files/${l.id}.${ext}`, b64, { base64: true });
//             }
//             subData.push({ id: sub.id, name: sub.name, lessons: ls });
//           }
//           semData.push({ id: s.id, name: s.name, subjects: subData });
//         }
//         manifest.years.push({ id: y.id, name: y.name, semesters: semData });
//       }

//       zip.file("manifest.json", JSON.stringify(manifest, null, 2));
//       const zipB64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 4 } });
//       await FileSystem.writeAsStringAsync(zipPath, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       return zipPath;
//     }

//     showSheet("Export ZIP", [
//       { label: Platform.OS === "android" ? "Save to Downloads" : "Save to Files", icon: "💾", onPress: async () => { setBusy("export"); try { const path = await buildZip(); await saveOrShareZip(path, fname, (t, m) => showAlert(t, m)); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Share…", icon: "📤", onPress: async () => { setBusy("export"); try { const path = await buildZip(); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "application/zip", dialogTitle: "Export LessonVault" }); else showAlert("Not available", "Sharing is not available on this device."); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   async function importZip() {
//     setBusy("import");
//     try {
//       const res = await DocumentPicker.getDocumentAsync({ type: "application/zip", copyToCacheDirectory: true });
//       if (res.canceled) { setBusy(null); return; }

//       const zipB64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
//       if (!zipB64) { showAlert("Import Error", "Could not read the zip file."); return; }

//       const zip = await JSZip.loadAsync(zipB64, { base64: true });
//       const mf = zip.file("manifest.json");
//       if (!mf) { showAlert("Import Error", "No manifest.json found."); return; }

//       const manifest = JSON.parse(await mf.async("string"));
//       const db = await getDb();
//       let imported = 0;
//       let fileCounter = 0; // unique per-import counter — avoids Date.now() collisions

//       for (const y of manifest.years) {
//         let yr = await db.getFirstAsync<Year>("SELECT * FROM years WHERE name=?", [y.name]);
//         const yid = yr ? yr.id : (await db.runAsync("INSERT INTO years (name) VALUES (?)", [y.name])).lastInsertRowId;

//         for (const s of y.semesters) {
//           let sr = await db.getFirstAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND name=?", [yid, s.name]);
//           const sid = sr ? sr.id : (await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s.name])).lastInsertRowId;

//           for (const sub of (s.subjects || [])) {
//             let subr = await db.getFirstAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? AND name=?", [sid, sub.name]);
//             const subid = subr ? subr.id : (await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [sid, sub.name])).lastInsertRowId;

//             const allLessons: any[] = sub.lessons || [];
//             const idMap: Record<number, number> = {};

//             // Insert folders first (root-level, then nested) so idMap is populated for prefix remapping
//             const sorted = [...allLessons].sort((a, b) => {
//               const aFolder = a.is_folder && (!a.image_uri || !a.image_uri.startsWith("FC:"));
//               const bFolder = b.is_folder && (!b.image_uri || !b.image_uri.startsWith("FC:"));
//               if (aFolder && !bFolder) return -1;
//               if (!aFolder && bFolder) return 1;
//               return 0;
//             });

//             for (const l of sorted) {
//               if (l.is_folder) {
//                 const r = await db.runAsync(
//                   "INSERT INTO lessons (subject_id,name,image_uri,is_folder,sort_order) VALUES (?,?,?,1,?)",
//                   [subid, l.name, null, l.sort_order ?? 0]
//                 );
//                 idMap[l.id] = Number(r.lastInsertRowId);
//                 imported++;
//               } else {
//                 // Strip FC: prefixes to find the zip entry
//                 let realUri = l.image_uri || "";
//                 realUri = realUri.replace(/^(?:FC:\d+:)+/, "");
//                 if (!realUri || realUri === "__folder__") continue;

//                 const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//                 const file = zip.file(`files/${l.id}.${ext}`);
//                 if (!file) continue;

//                 const b64 = await file.async("base64");
//                 if (!b64) continue;

//                 const dir = FileSystem.documentDirectory + `LessonVault/${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/`;
//                 await ensureDir(dir);

//                 // Use a monotonic counter so filenames are always unique within this import
//                 fileCounter++;
//                 const dest = `${dir}${slug(l.name)}_${fileCounter}.${ext}`;
//                 await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });

//                 const r = await db.runAsync(
//                   "INSERT INTO lessons (subject_id,name,image_uri,is_folder,sort_order) VALUES (?,?,?,0,?)",
//                   [subid, l.name, dest, l.sort_order ?? 0]
//                 );
//                 idMap[l.id] = Number(r.lastInsertRowId);
//                 imported++;
//               }
//             }

//             // Remap FC: prefixes in image_uri using idMap
//             for (const l of allLessons) {
//               const newId = idMap[l.id];
//               if (!newId || !l.image_uri) continue;

//               if (l.is_folder) {
//                 // Folder: remap its own FC: prefix chain
//                 const newUri = l.image_uri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                   const mapped = idMap[Number(oid)];
//                   return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//                 });
//                 await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
//               } else {
//                 // Photo: remap any FC: prefixes in the image_uri, keep the file path suffix
//                 const prefixMatch = l.image_uri.match(/^((?:FC:\d+:)+)/);
//                 if (prefixMatch) {
//                   const newPrefix = prefixMatch[1].replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                     const mapped = idMap[Number(oid)];
//                     return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//                   });
//                   // The actual file path for this lesson was written to dest — fetch it
//                   const row = await db.getFirstAsync<Lesson>("SELECT image_uri FROM lessons WHERE id=?", [newId]);
//                   if (row?.image_uri) {
//                     await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newPrefix + row.image_uri, newId]);
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }

//       showAlert("Import Complete", `${imported} item(s) imported successfully.`);
//       load();
//     } catch (e) {
//       showAlert("Import Error", String(e));
//     } finally {
//       setBusy(null);
//     }
//   }

//   if (activeYear) return <YearScreen year={activeYear} onBack={() => setActiveYear(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <StatusBar barStyle={colors.statusBar} />
//       <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//         <Row>
//           <Text style={{ flex: 1, color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>📚 LessonVault</Text>
//           <TouchableOpacity onPress={() => setColorMode(colorMode === "dark" ? "light" : "dark")} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
//           </TouchableOpacity>
//         </Row>
//         <Row gap={8} wrap style={{ marginTop: 14 }}>
//           <Btn label={busy === "export" ? "Exporting…" : "Export ZIP"} onPress={exportZip} variant="outline" small icon="📤" disabled={busy !== null} />
//           <Btn label={busy === "import" ? "Importing…" : "Import ZIP"} onPress={importZip} variant="outline" small icon="📥" disabled={busy !== null} />
//           <View style={{ flex: 1 }} />
//           <Btn label="+ Year" onPress={() => setShowAdd(true)} small icon="📁" />
//         </Row>
//       </View>
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: insets.bottom + 24 }}>
//         <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{years.length} Year{years.length !== 1 ? "s" : ""}</Text>
//         {years.map(year => (
//           <TouchableOpacity key={year.id} onPress={() => setActiveYear(year)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 16 }}>
//             <View style={{ backgroundColor: colors.accent + "1A", borderRadius: 14, padding: 10 }}><Text style={{ fontSize: 24 }}>🗂️</Text></View>
//             <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{year.name}</Text><Text style={{ color: colors.textSub, fontSize: 12, marginTop: 2 }}>{new Date(year.created_at).toLocaleDateString()}</Text></View>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(year.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditYear(year) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Year Content", `Delete all semesters and everything inside "${year.name}"? The year itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); } await db.runAsync("DELETE FROM semesters WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Year", icon: "🗑️", style: "destructive", onPress: () => confirmDeleteYear(year) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {years.length === 0 && <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}><Text style={{ fontSize: 56 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 16, textAlign: "center" }}>No years yet.{"\n"}Tap "+ Year" to get started.</Text></View>}
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Year" placeholder="e.g. 2nd Year" onConfirm={v => { setShowAdd(false); addYear(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editYear} title="Rename Year" initial={editYear?.name} onConfirm={v => editYear && renameYear(editYear, v)} onCancel={() => setEditYear(null)} />
//     </View>
//   );
// }

// // ─── THEME PROVIDER ───────────────────────────────────────────────────────────
// const THEME_KEY = "lessonvault_theme_v2";
// function ThemeProvider({ children }: { children: React.ReactNode }) {
//   const sys = useColorScheme(); const [colorMode, setModeState] = useState<ColorMode>("system"); const [loaded, setLoaded] = useState(false);
//   useEffect(() => { AsyncStorage.getItem(THEME_KEY).then(v => { if (v === "light" || v === "dark") setModeState(v as ColorMode); setLoaded(true); }); }, []);
//   const setColorMode = useCallback((m: ColorMode) => { setModeState(m); if (m === "light" || m === "dark") AsyncStorage.setItem(THEME_KEY, m); else AsyncStorage.removeItem(THEME_KEY); }, []);
//   const isDark = colorMode === "dark" || (colorMode === "system" && sys === "dark"); const colors = isDark ? DARK : LIGHT;
//   if (!loaded) return null;
//   return <ThemeContext.Provider value={{ colors, colorMode, setColorMode, isDark }}>{children}</ThemeContext.Provider>;
// }

// export default function Index() {
//   return (
//     <ThemeProvider>
//       <AlertProvider>
//         <SheetProvider>
//           <HomeScreen />
//         </SheetProvider>
//       </AlertProvider>
//     </ThemeProvider>
//   );
// }



// /**
//  * LessonVault — School Lesson Manager
//  * PASTE AS: app/index.tsx
//  */

// import AsyncStorage from "@react-native-async-storage/async-storage";
// import * as DocumentPicker from "expo-document-picker";
// import * as FileSystem from "expo-file-system/legacy";
// import * as ImagePicker from "expo-image-picker";
// import * as MediaLibrary from "expo-media-library";
// import * as Sharing from "expo-sharing";
// import * as SQLite from "expo-sqlite";
// import JSZip from "jszip";
// import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
// import { Animated, BackHandler, Dimensions, FlatList, Image, Modal, PanResponder, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// type ColorMode = "light" | "dark" | "system";
// interface Year { id: number; name: string; created_at: string }
// interface Semester { id: number; year_id: number; name: string; created_at: string }
// interface Subject { id: number; semester_id: number; name: string; created_at: string }
// interface Lesson { id: number; subject_id: number; name: string; image_uri: string | null; is_folder: number; created_at: string }

// const LIGHT = { bg: "#F5F4F0", surface: "#FFFFFF", surfaceAlt: "#EDEDEA", border: "#DDDDD8", text: "#1A1917", textSub: "#7A7874", accent: "#2563EB", accentText: "#FFFFFF", danger: "#DC2626", dangerBg: "#FEF2F2", card: "#FAFAF8", overlay: "rgba(0,0,0,0.5)", statusBar: "dark-content" as const };
// const DARK = { bg: "#111110", surface: "#1C1C1A", surfaceAlt: "#252523", border: "#333330", text: "#F2F0EB", textSub: "#888884", accent: "#3B82F6", accentText: "#FFFFFF", danger: "#EF4444", dangerBg: "#2D1515", card: "#161614", overlay: "rgba(0,0,0,0.72)", statusBar: "light-content" as const };

// interface ThemeCtx { colors: typeof LIGHT; colorMode: ColorMode; setColorMode: (m: ColorMode) => void; isDark: boolean }
// const ThemeContext = createContext<ThemeCtx>({ colors: DARK, colorMode: "system", setColorMode: () => {}, isDark: true });
// const useTheme = () => useContext(ThemeContext);

// interface AlertBtn { label: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }
// const AlertCtx = createContext<{ showAlert: (t: string, m?: string, b?: AlertBtn[]) => void }>({ showAlert: () => {} });
// const useAlert = () => useContext(AlertCtx);

// function AlertProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const [st, setSt] = useState<{ visible: boolean; title: string; message?: string; buttons: AlertBtn[] }>({ visible: false, title: "", buttons: [] });
//   const showAlert = useCallback((title: string, message?: string, buttons: AlertBtn[] = [{ label: "OK" }]) => setSt({ visible: true, title, message, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <AlertCtx.Provider value={{ showAlert }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="fade">
//         <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
//           <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: st.message ? 8 : 20 }}>{st.title}</Text>
//             {st.message && <Text style={{ color: colors.textSub, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 20 }}>{st.message}</Text>}
//             <View style={{ gap: 8 }}>
//               {st.buttons.map((b, i) => (
//                 <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress?.(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.danger : b.style === "cancel" ? colors.surfaceAlt : colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: "center", borderWidth: b.style === "cancel" ? 1 : 0, borderColor: colors.border }}>
//                   <Text style={{ color: b.style === "cancel" ? colors.text : "#fff", fontWeight: b.style === "cancel" ? "500" : "700", fontSize: 15 }}>{b.label}</Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </AlertCtx.Provider>
//   );
// }

// interface SheetBtn { label: string; icon?: string; onPress: () => void; style?: "destructive" | "cancel" }
// const SheetCtx = createContext<{ showSheet: (t?: string, b?: SheetBtn[]) => void }>({ showSheet: () => {} });
// const useSheet = () => useContext(SheetCtx);

// function SheetProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const insets = useSafeAreaInsets();
//   const [st, setSt] = useState<{ visible: boolean; title?: string; buttons: SheetBtn[] }>({ visible: false, buttons: [] });
//   const showSheet = useCallback((title?: string, buttons: SheetBtn[] = []) => setSt({ visible: true, title, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <SheetCtx.Provider value={{ showSheet }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="slide">
//         <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay }} activeOpacity={1} onPress={dismiss} />
//         <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 20 + insets.bottom, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
//           {st.title && <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>{st.title}</Text>}
//           {st.buttons.map((b, i) => (
//             <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.dangerBg : colors.surfaceAlt, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
//               {b.icon && <Text style={{ fontSize: 20 }}>{b.icon}</Text>}
//               <Text style={{ color: b.style === "destructive" ? colors.danger : colors.text, fontSize: 16, fontWeight: b.style === "cancel" ? "500" : "600" }}>{b.label}</Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </Modal>
//     </SheetCtx.Provider>
//   );
// }

// let _db: SQLite.SQLiteDatabase | null = null;
// const DB_SCHEMA = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS years (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name TEXT NOT NULL, image_uri TEXT, is_folder INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`;
// async function getDb(): Promise<SQLite.SQLiteDatabase> {
//   if (_db) { try { await _db.getFirstAsync("SELECT 1"); return _db; } catch { _db = null; } }
//   _db = await SQLite.openDatabaseAsync("lessonvault3.db");
//   await _db.execAsync(DB_SCHEMA);
//   return _db;
// }

// async function seedDefault() {
//   const db = await getDb();
//   const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM years");
//   if (row && row.count > 0) return;
//   const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", ["Current-Year"]);
//   const yid = r.lastInsertRowId;
//   for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id, name) VALUES (?,?)", [yid, s]);
// }

// function slug(s: string) { return s.replace(/[^a-zA-Z0-9_-]/g, "_"); }
// async function ensureDir(path: string) { const info = await FileSystem.getInfoAsync(path); if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true }); }

// async function copyImage(uri: string, yearName: string, semName: string, subName: string, label: string) {
//   const dir = FileSystem.documentDirectory + `LessonVault/${slug(yearName)}/${slug(semName)}/${slug(subName)}/`;
//   await ensureDir(dir);
//   const cleanUri = uri.split("?")[0]; const rawExt = cleanUri.split(".").pop()?.toLowerCase() || "jpg"; const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(rawExt) ? rawExt : "jpg";
//   const dest = `${dir}${slug(label)}_${Date.now()}.${safeExt}`;
//   await FileSystem.copyAsync({ from: uri, to: dest }); return dest;
// }

// async function pickCamera() {
//   const { status } = await ImagePicker.requestCameraPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGallery(): Promise<string | null> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: false });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGalleryMultiple(): Promise<string[]> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return [];
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
//   return r.canceled ? [] : r.assets.map(a => a.uri);
// }

// // ── Save ZIP to Downloads on Android using SAF, share on iOS ─────────────────
// async function saveOrShareZip(zipPath: string, fname: string, showAlert: (t: string, m?: string) => void) {
//   if (Platform.OS === "android") {
//     try {
//       const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
//       if (!permissions.granted) {
//         if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" }); }
//         else { showAlert("Cancelled", "No download location selected."); }
//         return;
//       }
//       const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fname, "application/zip");
//       const zipB64 = await FileSystem.readAsStringAsync(zipPath, { encoding: FileSystem.EncodingType.Base64 });
//       await FileSystem.StorageAccessFramework.writeAsStringAsync(destUri, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       showAlert("Saved", `ZIP saved as ${fname}`);
//     } catch (e: any) {
//       try {
//         if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" });
//         else showAlert("Error", String(e));
//       } catch (e2) { showAlert("Error", String(e2)); }
//     }
//   } else {
//     if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save to Files" });
//     else showAlert("Not available", "Sharing is not available on this device.");
//   }
// }

// function Btn({ label, onPress, variant = "primary", small = false, icon, disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "danger" | "ghost" | "outline"; small?: boolean; icon?: string; disabled?: boolean }) {
//   const { colors } = useTheme();
//   const bg = variant === "primary" ? colors.accent : variant === "danger" ? colors.danger : "transparent";
//   const tc = variant === "primary" || variant === "danger" ? "#fff" : variant === "outline" ? colors.accent : colors.text;
//   return (
//     <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} style={{ backgroundColor: disabled ? colors.surfaceAlt : bg, borderColor: variant === "outline" ? colors.accent : "transparent", borderWidth: variant === "outline" ? 1.5 : 0, borderRadius: 10, paddingHorizontal: small ? 12 : 18, paddingVertical: small ? 7 : 11, flexDirection: "row", alignItems: "center", gap: 5, opacity: disabled ? 0.5 : 1 }}>
//       {icon && <Text style={{ fontSize: small ? 14 : 16 }}>{icon}</Text>}
//       <Text style={{ color: disabled ? colors.textSub : tc, fontWeight: "600", fontSize: small ? 13 : 15 }}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// function Row({ children, gap = 8, wrap = false }: { children: React.ReactNode; gap?: number; wrap?: boolean }) { return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>; }

// function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
//   const { colors } = useTheme(); const insets = useSafeAreaInsets();
//   return (
//     <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//       {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 6, alignSelf: "flex-start" }}><Text style={{ color: colors.accent, fontSize: 16 }}>← Back</Text></TouchableOpacity>}
//       <Row><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: onBack ? 22 : 26, fontWeight: "900", letterSpacing: -0.4 }}>{title}</Text>{subtitle && <Text style={{ color: colors.textSub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}</View>{right}</Row>
//     </View>
//   );
// }

// function NameModal({ visible, title, initial, placeholder, onConfirm, onCancel }: { visible: boolean; title: string; initial?: string; placeholder?: string; onConfirm: (v: string) => void; onCancel: () => void }) {
//   const { colors } = useTheme(); const [val, setVal] = useState(initial || "");
//   useEffect(() => setVal(initial || ""), [visible, initial]);
//   return (
//     <Modal visible={visible} transparent animationType="fade">
//       <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
//         <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
//           <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 14 }}>{title}</Text>
//           <TextInput value={val} onChangeText={setVal} placeholder={placeholder || "Name…"} placeholderTextColor={colors.textSub} autoFocus style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 18, borderWidth: 1, borderColor: colors.border }} />
//           <Row gap={10}><Btn label="Cancel" onPress={onCancel} variant="ghost" /><View style={{ flex: 1 }} /><Btn label="Confirm" onPress={() => { if (val.trim()) onConfirm(val.trim()); }} /></Row>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// // ─── ZOOMABLE IMAGE — fixed sensitivity ───────────────────────────────────────
// function ZoomableImage({ uri }: { uri: string }) {
//   const [dims, setDims] = useState({ w: Dimensions.get("window").width, h: Dimensions.get("window").height });

//   const currentScale = useRef(1);
//   const currentTx = useRef(0);
//   const currentTy = useRef(0);

//   const scaleAnim = useRef(new Animated.Value(1)).current;
//   const txAnim = useRef(new Animated.Value(0)).current;
//   const tyAnim = useRef(new Animated.Value(0)).current;

//   const pinchStartDist = useRef(0);
//   const pinchStartScale = useRef(1);
//   const panStartTx = useRef(0);
//   const panStartTy = useRef(0);
//   const lastTapTime = useRef(0);
//   const lastTapX = useRef(0);
//   const lastTapY = useRef(0);
//   const isPinching = useRef(false);

//   const MIN_SCALE = 1;
//   const MAX_SCALE = 5;
//   const PINCH_DAMPEN = 0.65;
//   const PAN_DAMPEN = 0.4;

//   // Reset zoom when uri changes (swiped to new image)
//   useEffect(() => {
//     currentScale.current = 1;
//     currentTx.current = 0;
//     currentTy.current = 0;
//     scaleAnim.setValue(1);
//     txAnim.setValue(0);
//     tyAnim.setValue(0);
//   }, [uri]);

//   function getTouchDist(touches: any[]) {
//     const dx = touches[0].pageX - touches[1].pageX; const dy = touches[0].pageY - touches[1].pageY;
//     return Math.sqrt(dx * dx + dy * dy);
//   }

//   function clampTranslation(tx: number, ty: number, scale: number) {
//     const maxTx = Math.max(0, (dims.w * (scale - 1)) / 2);
//     const maxTy = Math.max(0, (dims.h * (scale - 1)) / 2);
//     return { tx: Math.min(maxTx, Math.max(-maxTx, tx)), ty: Math.min(maxTy, Math.max(-maxTy, ty)) };
//   }

//   function applyTransform(scale: number, tx: number, ty: number, animated = false) {
//     const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
//     const clamped = clampTranslation(tx, ty, s);
//     currentScale.current = s; currentTx.current = clamped.tx; currentTy.current = clamped.ty;
//     if (animated) {
//       Animated.parallel([
//         Animated.spring(scaleAnim, { toValue: s, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(txAnim, { toValue: clamped.tx, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(tyAnim, { toValue: clamped.ty, useNativeDriver: true, tension: 120, friction: 10 }),
//       ]).start();
//     } else {
//       scaleAnim.setValue(s); txAnim.setValue(clamped.tx); tyAnim.setValue(clamped.ty);
//     }
//   }

//   function resetZoom(animated = true) { applyTransform(1, 0, 0, animated); }

//   function doubleTapZoom(tapX: number, tapY: number) {
//     if (currentScale.current > 1.5) { resetZoom(true); return; }
//     const newScale = 2.5;
//     const tx = (dims.w / 2 - tapX) * (newScale - 1);
//     const ty = (dims.h / 2 - tapY) * (newScale - 1);
//     applyTransform(newScale, tx, ty, true);
//   }

//   const panResponder = useRef(PanResponder.create({
//     // Only claim the gesture on start if we're zoomed in (so FlatList can swipe freely at scale=1)
//     onStartShouldSetPanResponder: () => currentScale.current > 1,
//     onMoveShouldSetPanResponder: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       // Always claim pinch gestures
//       if (touches.length >= 2) return true;
//       // Claim pan only when zoomed in
//       return currentScale.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
//     },
//     onPanResponderGrant: (e) => {
//       const touches = e.nativeEvent.touches;
//       isPinching.current = touches.length >= 2;
//       if (touches.length >= 2) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; }
//       panStartTx.current = currentTx.current; panStartTy.current = currentTy.current;
//     },
//     onPanResponderMove: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) {
//         isPinching.current = true;
//         if (pinchStartDist.current === 0) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; return; }
//         const dist = getTouchDist(Array.from(touches));
//         const rawRatio = dist / pinchStartDist.current;
//         const dampenedRatio = 1 + (rawRatio - 1) * PINCH_DAMPEN;
//         const newScale = pinchStartScale.current * dampenedRatio;
//         applyTransform(newScale, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       } else if (!isPinching.current && currentScale.current > 1) {
//         applyTransform(currentScale.current, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       }
//     },
//     onPanResponderRelease: (e, g) => {
//       const wasPinching = isPinching.current;
//       isPinching.current = false; pinchStartDist.current = 0;
//       if (currentScale.current <= 1.05) { resetZoom(true); return; }
//       const { tx, ty } = clampTranslation(currentTx.current, currentTy.current, currentScale.current);
//       if (tx !== currentTx.current || ty !== currentTy.current) applyTransform(currentScale.current, tx, ty, true);
//       if (!wasPinching && Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
//         const now = Date.now();
//         const x = e.nativeEvent.changedTouches[0]?.pageX ?? dims.w / 2;
//         const y = e.nativeEvent.changedTouches[0]?.pageY ?? dims.h / 2;
//         if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) { lastTapTime.current = 0; doubleTapZoom(x, y); }
//         else { lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y; }
//       }
//     },
//     // Allow parent (FlatList) to reclaim gesture when not zoomed
//     onPanResponderTerminationRequest: () => currentScale.current <= 1,
//   })).current;

//   // Handle taps when not zoomed (PanResponder yields to FlatList at scale=1)
//   function handleTap(e: any) {
//     if (currentScale.current > 1) return; // zoomed: PanResponder handles it
//     const now = Date.now();
//     const x = e.nativeEvent.pageX ?? dims.w / 2;
//     const y = e.nativeEvent.pageY ?? dims.h / 2;
//     if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) {
//       lastTapTime.current = 0;
//       doubleTapZoom(x, y);
//     } else {
//       lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y;
//     }
//   }

//   return (
//     <TouchableOpacity activeOpacity={1} onPress={handleTap} style={{ flex: 1 }} onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
//       <Animated.Image source={{ uri }} {...panResponder.panHandlers} style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateX: txAnim }, { translateY: tyAnim }] }} resizeMode="contain" />
//     </TouchableOpacity>
//   );
// }

// // ─── IMAGE VIEWER — gallery-style swipe between images ───────────────────────
// // Pass `uris` (all images in current context) and `initialIndex` to enable swiping.
// // Falls back gracefully if only a single uri is provided.
// function ImageViewer({ uris, initialIndex = 0, onClose }: { uris: string[]; initialIndex?: number; onClose: () => void }) {
//   const insets = useSafeAreaInsets();
//   const [currentIndex, setCurrentIndex] = useState(initialIndex);
//   const flatListRef = useRef<FlatList>(null);
//   const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

//   // Scroll to initial index on mount without animation
//   useEffect(() => {
//     if (uris.length > 1 && initialIndex > 0) {
//       // Use a tiny delay to ensure FlatList has laid out
//       setTimeout(() => {
//         flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
//       }, 0);
//     }
//     setCurrentIndex(initialIndex);
//   }, [initialIndex, uris]);

//   if (!uris.length) return null;

//   return (
//     <Modal visible animationType="fade" statusBarTranslucent>
//       <View style={{ flex: 1, backgroundColor: "#000" }}>
//         {/* Close button */}
//         <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: insets.top + 10, right: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 22, width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
//           <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
//         </TouchableOpacity>

//         {/* Counter badge */}
//         {uris.length > 1 && (
//           <View style={{ position: "absolute", top: insets.top + 14, left: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }}>
//             <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{currentIndex + 1} / {uris.length}</Text>
//           </View>
//         )}

//         {/* Horizontally paged image list */}
//         <FlatList
//           ref={flatListRef}
//           data={uris}
//           keyExtractor={(_, i) => String(i)}
//           horizontal
//           pagingEnabled
//           showsHorizontalScrollIndicator={false}
//           initialScrollIndex={initialIndex}
//           getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
//           onMomentumScrollEnd={e => {
//             const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
//             setCurrentIndex(newIndex);
//           }}
//           // Disable scroll when zoomed — ZoomableImage's PanResponder handles pan
//           scrollEnabled
//           renderItem={({ item }) => (
//             <View style={{ width: SCREEN_W, height: SCREEN_H }}>
//               <ZoomableImage uri={item} />
//             </View>
//           )}
//         />

//         <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 12, paddingBottom: insets.bottom + 12, position: "absolute", bottom: 0, left: 0, right: 0 }}>
//           {uris.length > 1 ? "Swipe left/right to browse · Pinch or double-tap to zoom" : "Pinch or double-tap to zoom"}
//         </Text>
//       </View>
//     </Modal>
//   );
// }

// // ─── FOLDER LESSONS SCREEN — infinite nesting ────────────────────────────────
// function FolderLessonsScreen({ folder, subject, semesterName, yearName, onBack, breadcrumb }: { folder: Lesson; subject: Subject; semesterName: string; yearName: string; onBack: () => void; breadcrumb?: string }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null);
//   const [viewerState, setViewerState] = useState<{ uris: string[]; index: number } | null>(null);
//   const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openSubFolder, setOpenSubFolder] = useState<Lesson | null>(null);

//   const PREFIX = `FC:${folder.id}:`;

//   const load = useCallback(async () => {
//     const db = await getDb();
//     const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]);
//     setLessons(all.filter(l => l.image_uri?.startsWith(PREFIX)));
//   }, [subject.id, folder.id]);

//   useEffect(() => { load(); }, [load]);

//   useEffect(() => {
//     const handler = BackHandler.addEventListener("hardwareBackPress", () => {
//       if (openSubFolder) { setOpenSubFolder(null); load(); return true; }
//       return false;
//     });
//     return () => handler.remove();
//   }, [openSubFolder]);

//   async function commitPhoto(name: string, uri: string) {
//     const copied = await copyImage(uri, yearName, semesterName, subject.name, name);
//     const storedUri = `${PREFIX}${copied}`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,0)", [subject.id, name, storedUri]);
//   }
//   async function commitSubFolder(name: string) {
//     const storedUri = `${PREFIX}__folder__`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,1)", [subject.id, name, storedUri]);
//   }

//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitPhoto(`Photo ${lessons.length + i + 1}`, uris[i]); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitNamed(name: string, uri: string) { try { await commitPhoto(name, uri); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() {
//     showSheet("Add to " + folder.name, [
//       { label: "Quick Photos (auto-name)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) },
//       { label: "Named Photo", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) },
//       { label: "Create Sub-Folder", icon: "📁", onPress: () => { setPendingUris(["__subfolder__"]); setNameModalVis(true); } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   function getRealUri(l: Lesson): string | null {
//     if (!l.image_uri || l.is_folder) return null;
//     return l.image_uri.startsWith(PREFIX) ? l.image_uri.slice(PREFIX.length) : l.image_uri;
//   }

//   // Collect all real photo URIs in display order (for gallery swipe)
//   function getPhotoUris(): string[] {
//     return lessons.filter(l => !l.is_folder).map(l => getRealUri(l)).filter(Boolean) as string[];
//   }

//   async function deepDelete(l: Lesson) {
//     const db = await getDb();
//     if (l.is_folder) {
//       const childPrefix = `FC:${l.id}:`;
//       const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]);
//       const children = all.filter(c => c.image_uri?.startsWith(childPrefix));
//       for (const c of children) await deepDelete(c);
//     } else {
//       const real = getRealUri(l);
//       if (real) try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {}
//     }
//     await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]);
//   }

//   function confirmDelete(l: Lesson) {
//     showAlert("Delete", `Delete "${l.name}"${l.is_folder ? " and all its contents" : ""}?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { await deepDelete(l); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function confirmDeleteSelected() {
//     showAlert("Delete Selected", `Delete ${selected.size} item(s)?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { for (const id of selected) { const l = lessons.find(x => x.id === id); if (l) await deepDelete(l); } setSelected(new Set()); setSelectMode(false); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function clearFolderContents(l: Lesson) {
//     showAlert("Clear Sub-Folder", `Delete all contents inside "${l.name}"? The folder itself will remain.`, [
//       { label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const childPrefix = `FC:${l.id}:`; const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(c => c.image_uri?.startsWith(childPrefix)); for (const c of children) await deepDelete(c); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function openPhotoViewer(l: Lesson) {
//     const realUri = getRealUri(l);
//     if (!realUri) return;
//     const allUris = getPhotoUris();
//     const idx = allUris.indexOf(realUri);
//     setViewerState({ uris: allUris, index: idx >= 0 ? idx : 0 });
//   }

//   function openMenu(l: Lesson) {
//     const realUri = getRealUri(l);
//     showSheet(l.name, [
//       ...(realUri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => openPhotoViewer(l) }] : []),
//       ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenSubFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []),
//       { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) },
//       { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) },
//       { label: "Cancel", style: "cancel" as const, onPress: () => {} },
//     ]);
//   }

//   if (openSubFolder) {
//     const bc = breadcrumb ? `${breadcrumb} › ${folder.name}` : folder.name;
//     return <FolderLessonsScreen folder={openSubFolder} subject={subject} semesterName={semesterName} yearName={yearName} breadcrumb={bc} onBack={() => { setOpenSubFolder(null); load(); }} />;
//   }

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;
//   const subtitle = breadcrumb ? `${breadcrumb} › ${folder.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}` : `📁 ${subject.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={folder.name} subtitle={subtitle} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>Folder is empty</Text><Btn label="+ Add" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => {
//           const isSel = selected.has(item.id); const realUri = getRealUri(item);
//           return (
//             <TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenSubFolder(item); else openPhotoViewer(item); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>
//               {item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : realUri ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" /> : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>}
//               <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>
//               {isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}
//             </TouchableOpacity>
//           );
//         }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__subfolder__" ? "Name this Sub-Folder" : "Name this Photo"} placeholder={pendingUris[0] === "__subfolder__" ? "e.g. Week 1" : "e.g. Page 1"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__subfolder__") commitSubFolder(name).then(load); else if (pendingUris.length) commitNamed(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       {viewerState && <ImageViewer uris={viewerState.uris} initialIndex={viewerState.index} onClose={() => setViewerState(null)} />}
//     </View>
//   );
// }

// // ─── LESSONS SCREEN ───────────────────────────────────────────────────────────
// function LessonsScreen({ subject, semesterName, yearName, onBack }: { subject: Subject; semesterName: string; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null);
//   const [viewerState, setViewerState] = useState<{ uris: string[]; index: number } | null>(null);
//   const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openFolder, setOpenFolder] = useState<Lesson | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]); setLessons(all.filter(l => !l.image_uri?.startsWith("FC:"))); }, [subject.id]);
//   useEffect(() => { load(); }, [load]);

//   async function commitOne(name: string, uri: string, isFolder = false) { let storedUri: string | null = uri; if (uri && !isFolder) storedUri = await copyImage(uri, yearName, semesterName, subject.name, name); const db = await getDb(); await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,?)", [subject.id, name, storedUri, isFolder ? 1 : 0]); }
//   async function commit(name: string, uri: string | null, isFolder = false) { try { await commitOne(name, uri ?? "", isFolder); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitOne(`Photo ${lessons.length + i + 1}`, uris[i], false); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access is required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access is required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access is required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() { showSheet("Add to " + subject.name, [{ label: "Quick Photos (auto-name, multi)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) }, { label: "Named Image Lesson", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) }, { label: "Create Folder Lesson", icon: "📁", onPress: () => { setPendingUris(["__folder__"]); setNameModalVis(true); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }
//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   function confirmDelete(l: Lesson) { showAlert("Delete Lesson", `Delete "${l.name}"?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} load(); } }, { label: "Cancel", style: "cancel" }]); }
//   function confirmDeleteSelected() { showAlert("Delete Selected", `Delete ${selected.size} lesson(s)?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); for (const id of selected) { const l = lessons.find(x => x.id === id); if (!l) continue; await db.runAsync("DELETE FROM lessons WHERE id=?", [id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } setSelected(new Set()); setSelectMode(false); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function clearFolderContents(folder: Lesson) { showAlert("Clear Folder Content", `Delete all photos inside "${folder.name}"? The folder itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(l => l.image_uri?.startsWith(`FC:${folder.id}:`)); for (const l of children) { await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); const real = l.image_uri!.replace(/^FC:\d+:/, ""); try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {} } load(); } }, { label: "Cancel", style: "cancel" }]); }

//   // Collect all photo URIs in display order for gallery swipe
//   function getPhotoUris(): string[] {
//     return lessons.filter(l => !l.is_folder && l.image_uri).map(l => l.image_uri!);
//   }

//   function openPhotoViewer(l: Lesson) {
//     if (!l.image_uri) return;
//     const allUris = getPhotoUris();
//     const idx = allUris.indexOf(l.image_uri);
//     setViewerState({ uris: allUris, index: idx >= 0 ? idx : 0 });
//   }

//   function openMenu(l: Lesson) { showSheet(l.name, [...(!l.is_folder && l.image_uri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => openPhotoViewer(l) }] : []), ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []), { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) }, { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) }, { label: "Cancel", style: "cancel" as const, onPress: () => {} }]); }

//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (openFolder) { setOpenFolder(null); load(); return true; } return false; }); return () => handler.remove(); }, [openFolder]);

//   if (openFolder) return <FolderLessonsScreen folder={openFolder} subject={subject} semesterName={semesterName} yearName={yearName} onBack={() => { setOpenFolder(null); load(); }} />;

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={subject.name} subtitle={`${semesterName} · ${yearName} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No items yet</Text><Btn label="+ Add Lesson" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => { const isSel = selected.has(item.id); return (<TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenFolder(item); else openPhotoViewer(item); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>{item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : <Image source={{ uri: item.image_uri! }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />}<View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>{isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}</TouchableOpacity>); }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__folder__" ? "Name this Folder" : "Name this Lesson"} placeholder={pendingUris[0] === "__folder__" ? "e.g. Exercises" : "e.g. Chapter 3 Notes"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__folder__") commit(name, null, true); else if (pendingUris.length) commit(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       {viewerState && <ImageViewer uris={viewerState.uris} initialIndex={viewerState.index} onClose={() => setViewerState(null)} />}
//     </View>
//   );
// }

// // ─── SUBJECTS SCREEN ──────────────────────────────────────────────────────────
// function SubjectsScreen({ semester, yearName, onBack }: { semester: Semester; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [subjects, setSubjects] = useState<Subject[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSubject, setEditSubject] = useState<Subject | null>(null); const [active, setActive] = useState<Subject | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSubjects(await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? ORDER BY name ASC", [semester.id])); }, [semester.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (active) { setActive(null); return true; } return false; }); return () => handler.remove(); }, [active]);

//   async function applySubjectToOthers(name: string, scope: "all_semesters" | "all_years") { const db = await getDb(); if (scope === "all_semesters") { const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND id!=?", [semester.year_id, semester.id]); for (const s of sems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } else if (scope === "all_years") { const allSems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE name=? AND id!=?", [semester.name, semester.id]); for (const s of allSems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } }

//   function addSubjectFlow(name: string) { setShowAdd(false); showSheet("Apply to other semesters?", [{ label: "This semester only", icon: "📂", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); load(); } }, { label: "All semesters in this year", icon: "📅", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_semesters"); load(); } }, { label: "All years (same semester name)", icon: "🗂️", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_years"); load(); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }

//   async function rename(sub: Subject, name: string) { const db = await getDb(); await db.runAsync("UPDATE subjects SET name=? WHERE id=?", [name, sub.id]); setEditSubject(null); load(); }

//   function confirmDelete(sub: Subject) { showAlert("Delete Subject", `Delete "${sub.name}" and all its lessons?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (active) return <LessonsScreen subject={active} semesterName={semester.name} yearName={yearName} onBack={() => setActive(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={semester.name} subtitle={`${yearName} · ${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Subject" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
//         {subjects.map(sub => (
//           <TouchableOpacity key={sub.id} onPress={() => setActive(sub)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 24 }}>📗</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sub.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sub.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSubject(sub) }, { label: "Clear All Lessons", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Lessons", `Delete all lessons in "${sub.name}"?`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM lessons WHERE subject_id=?", [sub.id]); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Subject", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sub) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {subjects.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📗</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No subjects yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Subject" placeholder="e.g. Mathematics" onConfirm={addSubjectFlow} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSubject} title="Rename Subject" initial={editSubject?.name} onConfirm={v => editSubject && rename(editSubject, v)} onCancel={() => setEditSubject(null)} />
//     </View>
//   );
// }

// // ─── YEAR SCREEN ──────────────────────────────────────────────────────────────
// function YearScreen({ year, onBack }: { year: Year; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [semesters, setSemesters] = useState<Semester[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSem, setEditSem] = useState<Semester | null>(null); const [activeSem, setActiveSem] = useState<Semester | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSemesters(await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? ORDER BY created_at ASC", [year.id])); }, [year.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeSem) { setActiveSem(null); return true; } return false; }); return () => handler.remove(); }, [activeSem]);

//   async function add(name: string) { const db = await getDb(); await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [year.id, name]); load(); }
//   async function rename(sem: Semester, name: string) { const db = await getDb(); await db.runAsync("UPDATE semesters SET name=? WHERE id=?", [name, sem.id]); setEditSem(null); load(); }

//   async function deleteSemContent(sem: Semester) { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } await db.runAsync("DELETE FROM semesters WHERE id=?", [sem.id]); }

//   function confirmDelete(sem: Semester) { showAlert("Delete Semester", `Delete "${sem.name}" and all its content?`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteSemContent(sem); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (activeSem) return <SubjectsScreen semester={activeSem} yearName={year.name} onBack={() => setActiveSem(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={year.name} subtitle={`${semesters.length} semester${semesters.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Semester" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
//         {semesters.map(sem => (
//           <TouchableOpacity key={sem.id} onPress={() => setActiveSem(sem)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 26 }}>📂</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sem.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sem.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSem(sem) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Semester Content", `Delete all subjects and lessons inside "${sem.name}"? The semester itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Semester", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sem) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {semesters.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No semesters yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Semester" placeholder="e.g. Semester 1" onConfirm={v => { setShowAdd(false); add(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSem} title="Rename Semester" initial={editSem?.name} onConfirm={v => editSem && rename(editSem, v)} onCancel={() => setEditSem(null)} />
//     </View>
//   );
// }

// // ─── HOME SCREEN ──────────────────────────────────────────────────────────────
// function HomeScreen() {
//   const { colors, isDark, colorMode, setColorMode } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const insets = useSafeAreaInsets();
//   const [years, setYears] = useState<Year[]>([]); const [showAdd, setShowAdd] = useState(false); const [editYear, setEditYear] = useState<Year | null>(null); const [activeYear, setActiveYear] = useState<Year | null>(null); const [busy, setBusy] = useState<"export" | "import" | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setYears(await db.getAllAsync<Year>("SELECT * FROM years ORDER BY created_at DESC")); }, []);
//   useEffect(() => { seedDefault().then(load); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeYear) { setActiveYear(null); return true; } return false; }); return () => handler.remove(); }, [activeYear]);

//   async function addYear(name: string) { const db = await getDb(); try { const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", [name]); const yid = r.lastInsertRowId; for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s]); load(); } catch (e: any) { if (String(e).includes("UNIQUE")) showAlert("Name Taken", "A year with that name already exists."); else showAlert("Error", String(e)); } }
//   async function renameYear(year: Year, name: string) { const db = await getDb(); await db.runAsync("UPDATE years SET name=? WHERE id=?", [name, year.id]); setEditYear(null); load(); }

//   async function deleteYearContent(year: Year) { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } } await db.runAsync("DELETE FROM years WHERE id=?", [year.id]); }
//   function confirmDeleteYear(year: Year) { showAlert("Delete Year", `Delete "${year.name}" and all its content? This cannot be undone.`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteYearContent(year); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   // ── EXPORT ────────────────────────────────────────────────────────────────
//   async function exportZip() {
//     const fname = `LessonVault_${new Date().toISOString().slice(0, 10)}.zip`;
//     const zipPath = FileSystem.cacheDirectory + fname;

//     async function buildZip(): Promise<string> {
//       const db = await getDb(); const zip = new JSZip();
//       const allYears = await db.getAllAsync<Year>("SELECT * FROM years");
//       const manifest: any = { exportedAt: new Date().toISOString(), years: [] };
//       for (const y of allYears) {
//         const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [y.id]); const semData: any[] = [];
//         for (const s of sems) {
//           const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); const subData: any[] = [];
//           for (const sub of subs) {
//             const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at ASC", [sub.id]);
//             for (const l of ls) {
//               if (l.is_folder) continue;
//               let realUri = l.image_uri || "";
//               while (realUri.startsWith("FC:")) realUri = realUri.replace(/^FC:\d+:/, "");
//               if (!realUri || realUri === "__folder__") continue;
//               try {
//                 const info = await FileSystem.getInfoAsync(realUri); if (!info.exists) continue;
//                 const b64 = await FileSystem.readAsStringAsync(realUri, { encoding: FileSystem.EncodingType.Base64 }); if (!b64) continue;
//                 const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//                 zip.file(`files/${l.id}.${ext}`, b64, { base64: true });
//               } catch {}
//             }
//             subData.push({ id: sub.id, name: sub.name, lessons: ls });
//           }
//           semData.push({ id: s.id, name: s.name, subjects: subData });
//         }
//         manifest.years.push({ id: y.id, name: y.name, semesters: semData });
//       }
//       zip.file("manifest.json", JSON.stringify(manifest, null, 2));
//       const zipB64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
//       await FileSystem.writeAsStringAsync(zipPath, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       return zipPath;
//     }

//     showSheet("Export ZIP", [
//       { label: Platform.OS === "android" ? "Save to Downloads" : "Save to Files", icon: "💾", onPress: async () => { setBusy("export"); try { const path = await buildZip(); await saveOrShareZip(path, fname, (t, m) => showAlert(t, m)); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Share…", icon: "📤", onPress: async () => { setBusy("export"); try { const path = await buildZip(); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "application/zip", dialogTitle: "Export LessonVault" }); else showAlert("Not available", "Sharing is not available on this device."); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   // ── IMPORT ────────────────────────────────────────────────────────────────
//   async function importZip() {
//     setBusy("import");
//     try {
//       const res = await DocumentPicker.getDocumentAsync({ type: "application/zip", copyToCacheDirectory: true });
//       if (res.canceled) { setBusy(null); return; }
//       const zipB64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
//       if (!zipB64) { showAlert("Import Error", "Could not read the zip file."); return; }
//       const zip = await JSZip.loadAsync(zipB64, { base64: true });
//       const mf = zip.file("manifest.json"); if (!mf) { showAlert("Import Error", "No manifest.json found."); return; }
//       const manifest = JSON.parse(await mf.async("string")); const db = await getDb(); let imported = 0;
//       for (const y of manifest.years) {
//         let yr = await db.getFirstAsync<Year>("SELECT * FROM years WHERE name=?", [y.name]); let yid = yr ? yr.id : (await db.runAsync("INSERT INTO years (name) VALUES (?)", [y.name])).lastInsertRowId;
//         for (const s of y.semesters) {
//           let sr = await db.getFirstAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND name=?", [yid, s.name]); let sid = sr ? sr.id : (await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s.name])).lastInsertRowId;
//           for (const sub of (s.subjects || [])) {
//             let subr = await db.getFirstAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? AND name=?", [sid, sub.name]); let subid = subr ? subr.id : (await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [sid, sub.name])).lastInsertRowId;
//             const allLessons: any[] = sub.lessons || [];
//             const idMap: Record<number, number> = {};
//             const sorted = [...allLessons].sort((a, b) => {
//               const aIsRootFolder = a.is_folder && (!a.image_uri || !a.image_uri.startsWith("FC:"));
//               const bIsRootFolder = b.is_folder && (!b.image_uri || !b.image_uri.startsWith("FC:"));
//               if (aIsRootFolder && !bIsRootFolder) return -1;
//               if (!aIsRootFolder && bIsRootFolder) return 1;
//               return 0;
//             });
//             for (const l of sorted) {
//               try {
//                 if (l.is_folder) {
//                   const r = await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,1)", [subid, l.name, null]);
//                   idMap[l.id] = Number(r.lastInsertRowId); imported++;
//                 } else {
//                   let realUri = l.image_uri || "";
//                   while (realUri.startsWith("FC:")) realUri = realUri.replace(/^FC:\d+:/, "");
//                   if (!realUri || realUri === "__folder__") continue;
//                   const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//                   const file = zip.file(`files/${l.id}.${ext}`);
//                   if (!file) continue;
//                   const b64 = await file.async("base64"); if (!b64) continue;
//                   const dir = FileSystem.documentDirectory + `LessonVault/${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/`;
//                   await ensureDir(dir);
//                   const dest = `${dir}${slug(l.name)}_${Date.now()}_${l.id}.${ext}`;
//                   await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
//                   const r = await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,0)", [subid, l.name, dest]);
//                   idMap[l.id] = Number(r.lastInsertRowId); imported++;
//                 }
//               } catch {}
//             }
//             for (const l of allLessons) {
//               const newId = idMap[l.id]; if (!newId) continue;
//               if (!l.image_uri) continue;
//               let newUri = l.image_uri;
//               newUri = newUri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                 const mapped = idMap[Number(oid)];
//                 return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//               });
//               if (!l.is_folder) {
//                 const prefixMatch = l.image_uri.match(/^((?:FC:\d+:)+)/);
//                 if (prefixMatch) {
//                   const newPrefix = prefixMatch[1].replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                     const mapped = idMap[Number(oid)]; return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//                   });
//                   const row = await db.getFirstAsync<Lesson>("SELECT * FROM lessons WHERE id=?", [newId]);
//                   if (row && row.image_uri && !row.image_uri.startsWith("FC:")) {
//                     newUri = newPrefix + row.image_uri;
//                   }
//                 }
//               }
//               await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
//             }
//             for (const l of allLessons) {
//               if (!l.is_folder) continue;
//               const newId = idMap[l.id]; if (!newId) continue;
//               if (!l.image_uri) continue;
//               const newUri = l.image_uri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                 const mapped = idMap[Number(oid)]; return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//               });
//               await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
//             }
//           }
//         }
//       }
//       showAlert("Import Complete", `${imported} item(s) imported successfully.`); load();
//     } catch (e) { showAlert("Import Error", String(e)); } finally { setBusy(null); }
//   }

//   if (activeYear) return <YearScreen year={activeYear} onBack={() => setActiveYear(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <StatusBar barStyle={colors.statusBar} />
//       <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//         <Row>
//           <Text style={{ flex: 1, color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>📚 LessonVault</Text>
//           <TouchableOpacity onPress={() => setColorMode(colorMode === "dark" ? "light" : "dark")} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
//           </TouchableOpacity>
//         </Row>
//         <Row gap={8} wrap style={{ marginTop: 14 }}>
//           <Btn label={busy === "export" ? "Exporting…" : "Export ZIP"} onPress={exportZip} variant="outline" small icon="📤" disabled={busy !== null} />
//           <Btn label={busy === "import" ? "Importing…" : "Import ZIP"} onPress={importZip} variant="outline" small icon="📥" disabled={busy !== null} />
//           <View style={{ flex: 1 }} />
//           <Btn label="+ Year" onPress={() => setShowAdd(true)} small icon="📁" />
//         </Row>
//       </View>
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: insets.bottom + 24 }}>
//         <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{years.length} Year{years.length !== 1 ? "s" : ""}</Text>
//         {years.map(year => (
//           <TouchableOpacity key={year.id} onPress={() => setActiveYear(year)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 16 }}>
//             <View style={{ backgroundColor: colors.accent + "1A", borderRadius: 14, padding: 10 }}><Text style={{ fontSize: 24 }}>🗂️</Text></View>
//             <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{year.name}</Text><Text style={{ color: colors.textSub, fontSize: 12, marginTop: 2 }}>{new Date(year.created_at).toLocaleDateString()}</Text></View>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(year.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditYear(year) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Year Content", `Delete all semesters and everything inside "${year.name}"? The year itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); } await db.runAsync("DELETE FROM semesters WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Year", icon: "🗑️", style: "destructive", onPress: () => confirmDeleteYear(year) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {years.length === 0 && <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}><Text style={{ fontSize: 56 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 16, textAlign: "center" }}>No years yet.{"\n"}Tap "+ Year" to get started.</Text></View>}
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Year" placeholder="e.g. 2nd Year" onConfirm={v => { setShowAdd(false); addYear(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editYear} title="Rename Year" initial={editYear?.name} onConfirm={v => editYear && renameYear(editYear, v)} onCancel={() => setEditYear(null)} />
//     </View>
//   );
// }

// // ─── THEME PROVIDER ───────────────────────────────────────────────────────────
// const THEME_KEY = "lessonvault_theme_v2";
// function ThemeProvider({ children }: { children: React.ReactNode }) {
//   const sys = useColorScheme(); const [colorMode, setModeState] = useState<ColorMode>("system"); const [loaded, setLoaded] = useState(false);
//   useEffect(() => { AsyncStorage.getItem(THEME_KEY).then(v => { if (v === "light" || v === "dark") setModeState(v as ColorMode); setLoaded(true); }); }, []);
//   const setColorMode = useCallback((m: ColorMode) => { setModeState(m); if (m === "light" || m === "dark") AsyncStorage.setItem(THEME_KEY, m); else AsyncStorage.removeItem(THEME_KEY); }, []);
//   const isDark = colorMode === "dark" || (colorMode === "system" && sys === "dark"); const colors = isDark ? DARK : LIGHT;
//   if (!loaded) return null;
//   return <ThemeContext.Provider value={{ colors, colorMode, setColorMode, isDark }}>{children}</ThemeContext.Provider>;
// }

// export default function Index() {
//   return (
//     <ThemeProvider>
//       <AlertProvider>
//         <SheetProvider>
//           <HomeScreen />
//         </SheetProvider>
//       </AlertProvider>
//     </ThemeProvider>
//   );
// }









// /**
//  * LessonVault — School Lesson Manager
//  * PASTE AS: app/index.tsx
//  */

// import AsyncStorage from "@react-native-async-storage/async-storage";
// import * as DocumentPicker from "expo-document-picker";
// import * as FileSystem from "expo-file-system/legacy";
// import * as ImagePicker from "expo-image-picker";
// import * as MediaLibrary from "expo-media-library";
// import * as Sharing from "expo-sharing";
// import * as SQLite from "expo-sqlite";
// import JSZip from "jszip";
// import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
// import { Animated, BackHandler, Dimensions, FlatList, Image, Modal, PanResponder, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// type ColorMode = "light" | "dark" | "system";
// interface Year { id: number; name: string; created_at: string }
// interface Semester { id: number; year_id: number; name: string; created_at: string }
// interface Subject { id: number; semester_id: number; name: string; created_at: string }
// interface Lesson { id: number; subject_id: number; name: string; image_uri: string | null; is_folder: number; created_at: string }

// const LIGHT = { bg: "#F5F4F0", surface: "#FFFFFF", surfaceAlt: "#EDEDEA", border: "#DDDDD8", text: "#1A1917", textSub: "#7A7874", accent: "#2563EB", accentText: "#FFFFFF", danger: "#DC2626", dangerBg: "#FEF2F2", card: "#FAFAF8", overlay: "rgba(0,0,0,0.5)", statusBar: "dark-content" as const };
// const DARK = { bg: "#111110", surface: "#1C1C1A", surfaceAlt: "#252523", border: "#333330", text: "#F2F0EB", textSub: "#888884", accent: "#3B82F6", accentText: "#FFFFFF", danger: "#EF4444", dangerBg: "#2D1515", card: "#161614", overlay: "rgba(0,0,0,0.72)", statusBar: "light-content" as const };

// interface ThemeCtx { colors: typeof LIGHT; colorMode: ColorMode; setColorMode: (m: ColorMode) => void; isDark: boolean }
// const ThemeContext = createContext<ThemeCtx>({ colors: DARK, colorMode: "system", setColorMode: () => {}, isDark: true });
// const useTheme = () => useContext(ThemeContext);

// interface AlertBtn { label: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }
// const AlertCtx = createContext<{ showAlert: (t: string, m?: string, b?: AlertBtn[]) => void }>({ showAlert: () => {} });
// const useAlert = () => useContext(AlertCtx);

// function AlertProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const [st, setSt] = useState<{ visible: boolean; title: string; message?: string; buttons: AlertBtn[] }>({ visible: false, title: "", buttons: [] });
//   const showAlert = useCallback((title: string, message?: string, buttons: AlertBtn[] = [{ label: "OK" }]) => setSt({ visible: true, title, message, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <AlertCtx.Provider value={{ showAlert }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="fade">
//         <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
//           <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: st.message ? 8 : 20 }}>{st.title}</Text>
//             {st.message && <Text style={{ color: colors.textSub, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 20 }}>{st.message}</Text>}
//             <View style={{ gap: 8 }}>
//               {st.buttons.map((b, i) => (
//                 <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress?.(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.danger : b.style === "cancel" ? colors.surfaceAlt : colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: "center", borderWidth: b.style === "cancel" ? 1 : 0, borderColor: colors.border }}>
//                   <Text style={{ color: b.style === "cancel" ? colors.text : "#fff", fontWeight: b.style === "cancel" ? "500" : "700", fontSize: 15 }}>{b.label}</Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </AlertCtx.Provider>
//   );
// }

// interface SheetBtn { label: string; icon?: string; onPress: () => void; style?: "destructive" | "cancel" }
// const SheetCtx = createContext<{ showSheet: (t?: string, b?: SheetBtn[]) => void }>({ showSheet: () => {} });
// const useSheet = () => useContext(SheetCtx);

// function SheetProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const insets = useSafeAreaInsets();
//   const [st, setSt] = useState<{ visible: boolean; title?: string; buttons: SheetBtn[] }>({ visible: false, buttons: [] });
//   const showSheet = useCallback((title?: string, buttons: SheetBtn[] = []) => setSt({ visible: true, title, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <SheetCtx.Provider value={{ showSheet }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="slide">
//         <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay }} activeOpacity={1} onPress={dismiss} />
//         <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 20 + insets.bottom, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
//           {st.title && <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>{st.title}</Text>}
//           {st.buttons.map((b, i) => (
//             <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.dangerBg : colors.surfaceAlt, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
//               {b.icon && <Text style={{ fontSize: 20 }}>{b.icon}</Text>}
//               <Text style={{ color: b.style === "destructive" ? colors.danger : colors.text, fontSize: 16, fontWeight: b.style === "cancel" ? "500" : "600" }}>{b.label}</Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </Modal>
//     </SheetCtx.Provider>
//   );
// }

// let _db: SQLite.SQLiteDatabase | null = null;
// const DB_SCHEMA = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS years (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name TEXT NOT NULL, image_uri TEXT, is_folder INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`;
// async function getDb(): Promise<SQLite.SQLiteDatabase> {
//   if (_db) { try { await _db.getFirstAsync("SELECT 1"); return _db; } catch { _db = null; } }
//   _db = await SQLite.openDatabaseAsync("lessonvault3.db");
//   await _db.execAsync(DB_SCHEMA);
//   return _db;
// }

// async function seedDefault() {
//   const db = await getDb();
//   const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM years");
//   if (row && row.count > 0) return;
//   const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", ["Current-Year"]);
//   const yid = r.lastInsertRowId;
//   for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id, name) VALUES (?,?)", [yid, s]);
// }

// function slug(s: string) { return s.replace(/[^a-zA-Z0-9_-]/g, "_"); }
// async function ensureDir(path: string) { const info = await FileSystem.getInfoAsync(path); if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true }); }

// async function copyImage(uri: string, yearName: string, semName: string, subName: string, label: string) {
//   const dir = FileSystem.documentDirectory + `LessonVault/${slug(yearName)}/${slug(semName)}/${slug(subName)}/`;
//   await ensureDir(dir);
//   const cleanUri = uri.split("?")[0]; const rawExt = cleanUri.split(".").pop()?.toLowerCase() || "jpg"; const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(rawExt) ? rawExt : "jpg";
//   const dest = `${dir}${slug(label)}_${Date.now()}.${safeExt}`;
//   await FileSystem.copyAsync({ from: uri, to: dest }); return dest;
// }

// async function pickCamera() {
//   const { status } = await ImagePicker.requestCameraPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGallery(): Promise<string | null> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: false });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGalleryMultiple(): Promise<string[]> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return [];
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
//   return r.canceled ? [] : r.assets.map(a => a.uri);
// }

// // ── Save ZIP to Downloads on Android using SAF, share on iOS ─────────────────
// async function saveOrShareZip(zipPath: string, fname: string, showAlert: (t: string, m?: string) => void) {
//   if (Platform.OS === "android") {
//     try {
//       // Android 10+ (API 29+): use StorageAccessFramework to write directly to Downloads
//       const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
//       if (!permissions.granted) {
//         // User cancelled SAF picker — fallback to share
//         if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" }); }
//         else { showAlert("Cancelled", "No download location selected."); }
//         return;
//       }
//       // Create file in the chosen directory
//       const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fname, "application/zip");
//       const zipB64 = await FileSystem.readAsStringAsync(zipPath, { encoding: FileSystem.EncodingType.Base64 });
//       await FileSystem.StorageAccessFramework.writeAsStringAsync(destUri, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       showAlert("Saved", `ZIP saved as ${fname}`);
//     } catch (e: any) {
//       // Fallback: share sheet
//       try {
//         if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" });
//         else showAlert("Error", String(e));
//       } catch (e2) { showAlert("Error", String(e2)); }
//     }
//   } else {
//     if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save to Files" });
//     else showAlert("Not available", "Sharing is not available on this device.");
//   }
// }

// function Btn({ label, onPress, variant = "primary", small = false, icon, disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "danger" | "ghost" | "outline"; small?: boolean; icon?: string; disabled?: boolean }) {
//   const { colors } = useTheme();
//   const bg = variant === "primary" ? colors.accent : variant === "danger" ? colors.danger : "transparent";
//   const tc = variant === "primary" || variant === "danger" ? "#fff" : variant === "outline" ? colors.accent : colors.text;
//   return (
//     <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} style={{ backgroundColor: disabled ? colors.surfaceAlt : bg, borderColor: variant === "outline" ? colors.accent : "transparent", borderWidth: variant === "outline" ? 1.5 : 0, borderRadius: 10, paddingHorizontal: small ? 12 : 18, paddingVertical: small ? 7 : 11, flexDirection: "row", alignItems: "center", gap: 5, opacity: disabled ? 0.5 : 1 }}>
//       {icon && <Text style={{ fontSize: small ? 14 : 16 }}>{icon}</Text>}
//       <Text style={{ color: disabled ? colors.textSub : tc, fontWeight: "600", fontSize: small ? 13 : 15 }}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// function Row({ children, gap = 8, wrap = false }: { children: React.ReactNode; gap?: number; wrap?: boolean }) { return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>; }

// function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
//   const { colors } = useTheme(); const insets = useSafeAreaInsets();
//   return (
//     <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//       {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 6, alignSelf: "flex-start" }}><Text style={{ color: colors.accent, fontSize: 16 }}>← Back</Text></TouchableOpacity>}
//       <Row><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: onBack ? 22 : 26, fontWeight: "900", letterSpacing: -0.4 }}>{title}</Text>{subtitle && <Text style={{ color: colors.textSub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}</View>{right}</Row>
//     </View>
//   );
// }

// function NameModal({ visible, title, initial, placeholder, onConfirm, onCancel }: { visible: boolean; title: string; initial?: string; placeholder?: string; onConfirm: (v: string) => void; onCancel: () => void }) {
//   const { colors } = useTheme(); const [val, setVal] = useState(initial || "");
//   useEffect(() => setVal(initial || ""), [visible, initial]);
//   return (
//     <Modal visible={visible} transparent animationType="fade">
//       <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
//         <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
//           <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 14 }}>{title}</Text>
//           <TextInput value={val} onChangeText={setVal} placeholder={placeholder || "Name…"} placeholderTextColor={colors.textSub} autoFocus style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 18, borderWidth: 1, borderColor: colors.border }} />
//           <Row gap={10}><Btn label="Cancel" onPress={onCancel} variant="ghost" /><View style={{ flex: 1 }} /><Btn label="Confirm" onPress={() => { if (val.trim()) onConfirm(val.trim()); }} /></Row>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// // ─── ZOOMABLE IMAGE — fixed sensitivity ───────────────────────────────────────
// // Key changes:
// //  • Pinch scale uses a dampening factor (0.65) so fast finger spreads don't jump
// //  • MIN_SCALE = 1, MAX_SCALE = 5 (was 0.5–8)
// //  • Translation clamping applied immediately during move
// function ZoomableImage({ uri }: { uri: string }) {
//   const [dims, setDims] = useState({ w: Dimensions.get("window").width, h: Dimensions.get("window").height });

//   const currentScale = useRef(1);
//   const currentTx = useRef(0);
//   const currentTy = useRef(0);

//   const scaleAnim = useRef(new Animated.Value(1)).current;
//   const txAnim = useRef(new Animated.Value(0)).current;
//   const tyAnim = useRef(new Animated.Value(0)).current;

//   const pinchStartDist = useRef(0);
//   const pinchStartScale = useRef(1);
//   const panStartTx = useRef(0);
//   const panStartTy = useRef(0);
//   const lastTapTime = useRef(0);
//   const lastTapX = useRef(0);
//   const lastTapY = useRef(0);
//   const isPinching = useRef(false);

//   const MIN_SCALE = 1;
//   const MAX_SCALE = 5;
//   // Dampening: how aggressively pinch maps to scale change. Lower = less sensitive.
//   const PINCH_DAMPEN = 0.65;
//   // Pan dampening: multiplier on drag distance. Lower = slower pan movement.
//   const PAN_DAMPEN = 0.4;

//   function getTouchDist(touches: any[]) {
//     const dx = touches[0].pageX - touches[1].pageX; const dy = touches[0].pageY - touches[1].pageY;
//     return Math.sqrt(dx * dx + dy * dy);
//   }

//   function clampTranslation(tx: number, ty: number, scale: number) {
//     const maxTx = Math.max(0, (dims.w * (scale - 1)) / 2);
//     const maxTy = Math.max(0, (dims.h * (scale - 1)) / 2);
//     return { tx: Math.min(maxTx, Math.max(-maxTx, tx)), ty: Math.min(maxTy, Math.max(-maxTy, ty)) };
//   }

//   function applyTransform(scale: number, tx: number, ty: number, animated = false) {
//     const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
//     const clamped = clampTranslation(tx, ty, s);
//     currentScale.current = s; currentTx.current = clamped.tx; currentTy.current = clamped.ty;
//     if (animated) {
//       Animated.parallel([
//         Animated.spring(scaleAnim, { toValue: s, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(txAnim, { toValue: clamped.tx, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(tyAnim, { toValue: clamped.ty, useNativeDriver: true, tension: 120, friction: 10 }),
//       ]).start();
//     } else {
//       scaleAnim.setValue(s); txAnim.setValue(clamped.tx); tyAnim.setValue(clamped.ty);
//     }
//   }

//   function resetZoom(animated = true) { applyTransform(1, 0, 0, animated); }

//   function doubleTapZoom(tapX: number, tapY: number) {
//     if (currentScale.current > 1.5) { resetZoom(true); return; }
//     const newScale = 2.5;
//     const tx = (dims.w / 2 - tapX) * (newScale - 1);
//     const ty = (dims.h / 2 - tapY) * (newScale - 1);
//     applyTransform(newScale, tx, ty, true);
//   }

//   const panResponder = useRef(PanResponder.create({
//     onStartShouldSetPanResponder: () => true,
//     onMoveShouldSetPanResponder: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) return true;
//       return currentScale.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
//     },
//     onPanResponderGrant: (e) => {
//       const touches = e.nativeEvent.touches;
//       isPinching.current = touches.length >= 2;
//       if (touches.length >= 2) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; }
//       panStartTx.current = currentTx.current; panStartTy.current = currentTy.current;
//     },
//     onPanResponderMove: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) {
//         isPinching.current = true;
//         if (pinchStartDist.current === 0) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; return; }
//         const dist = getTouchDist(Array.from(touches));
//         const rawRatio = dist / pinchStartDist.current;
//         // Apply dampening: interpolate ratio toward 1 to reduce sensitivity
//         const dampenedRatio = 1 + (rawRatio - 1) * PINCH_DAMPEN;
//         const newScale = pinchStartScale.current * dampenedRatio;
//         applyTransform(newScale, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       } else if (!isPinching.current && currentScale.current > 1) {
//         applyTransform(currentScale.current, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       }
//     },
//     onPanResponderRelease: (e, g) => {
//       const wasPinching = isPinching.current;
//       isPinching.current = false; pinchStartDist.current = 0;
//       if (currentScale.current <= 1.05) { resetZoom(true); return; }
//       // Snap into bounds
//       const { tx, ty } = clampTranslation(currentTx.current, currentTy.current, currentScale.current);
//       if (tx !== currentTx.current || ty !== currentTy.current) applyTransform(currentScale.current, tx, ty, true);
//       // Double-tap
//       if (!wasPinching && Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
//         const now = Date.now();
//         const x = e.nativeEvent.changedTouches[0]?.pageX ?? dims.w / 2;
//         const y = e.nativeEvent.changedTouches[0]?.pageY ?? dims.h / 2;
//         if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) { lastTapTime.current = 0; doubleTapZoom(x, y); }
//         else { lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y; }
//       }
//     },
//     onPanResponderTerminationRequest: () => false,
//   })).current;

//   return (
//     <View style={{ flex: 1 }} onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
//       <Animated.Image source={{ uri }} {...panResponder.panHandlers} style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateX: txAnim }, { translateY: tyAnim }] }} resizeMode="contain" />
//     </View>
//   );
// }

// function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
//   const insets = useSafeAreaInsets();
//   if (!uri) return null;
//   return (
//     <Modal visible animationType="fade" statusBarTranslucent>
//       <View style={{ flex: 1, backgroundColor: "#000" }}>
//         <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: insets.top + 10, right: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 22, width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
//           <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
//         </TouchableOpacity>
//         <ZoomableImage uri={uri} />
//         <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 12, paddingBottom: insets.bottom + 12 }}>Pinch or double-tap to zoom</Text>
//       </View>
//     </Modal>
//   );
// }

// // ─── FOLDER LESSONS SCREEN — infinite nesting ────────────────────────────────
// // Items belonging to a folder use image_uri = `FC:<folderId>:<realPath>` for photos
// // and image_uri = `FC:<folderId>:__folder__` + is_folder=1 for sub-folders.
// // Each level only shows items whose image_uri starts with `FC:<thisFolder.id>:`.
// // Opening a sub-folder just renders another FolderLessonsScreen on top — infinite depth.
// function FolderLessonsScreen({ folder, subject, semesterName, yearName, onBack, breadcrumb }: { folder: Lesson; subject: Subject; semesterName: string; yearName: string; onBack: () => void; breadcrumb?: string }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null); const [viewUri, setViewUri] = useState<string | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openSubFolder, setOpenSubFolder] = useState<Lesson | null>(null);

//   const PREFIX = `FC:${folder.id}:`;

//   const load = useCallback(async () => {
//     const db = await getDb();
//     const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]);
//     // Direct children: image_uri starts with FC:<folder.id>: AND the rest contains no further FC: prefix
//     // (sub-folder children use FC:<subFolderId>: so they won't match this folder's prefix)
//     setLessons(all.filter(l => l.image_uri?.startsWith(PREFIX)));
//   }, [subject.id, folder.id]);

//   useEffect(() => { load(); }, [load]);

//   useEffect(() => {
//     const handler = BackHandler.addEventListener("hardwareBackPress", () => {
//       if (openSubFolder) { setOpenSubFolder(null); load(); return true; }
//       return false;
//     });
//     return () => handler.remove();
//   }, [openSubFolder]);

//   // For photos: store as FC:<folderId>:<copiedPath>
//   async function commitPhoto(name: string, uri: string) {
//     const copied = await copyImage(uri, yearName, semesterName, subject.name, name);
//     const storedUri = `${PREFIX}${copied}`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,0)", [subject.id, name, storedUri]);
//   }
//   // For sub-folders: store as FC:<folderId>:__folder__ with is_folder=1
//   async function commitSubFolder(name: string) {
//     const storedUri = `${PREFIX}__folder__`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,1)", [subject.id, name, storedUri]);
//   }

//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitPhoto(`Photo ${lessons.length + i + 1}`, uris[i]); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitNamed(name: string, uri: string) { try { await commitPhoto(name, uri); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() {
//     showSheet("Add to " + folder.name, [
//       { label: "Quick Photos (auto-name)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) },
//       { label: "Named Photo", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) },
//       { label: "Create Sub-Folder", icon: "📁", onPress: () => { setPendingUris(["__subfolder__"]); setNameModalVis(true); } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   // Get the real file URI for a photo (strip the FC:<id>: prefix)
//   function getRealUri(l: Lesson): string | null {
//     if (!l.image_uri || l.is_folder) return null;
//     return l.image_uri.startsWith(PREFIX) ? l.image_uri.slice(PREFIX.length) : l.image_uri;
//   }

//   // Recursively delete all descendant photos then delete the lesson row
//   async function deepDelete(l: Lesson) {
//     const db = await getDb();
//     if (l.is_folder) {
//       // Delete all children of this sub-folder recursively
//       const childPrefix = `FC:${l.id}:`;
//       const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]);
//       const children = all.filter(c => c.image_uri?.startsWith(childPrefix));
//       for (const c of children) await deepDelete(c);
//     } else {
//       const real = getRealUri(l);
//       if (real) try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {}
//     }
//     await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]);
//   }

//   function confirmDelete(l: Lesson) {
//     showAlert("Delete", `Delete "${l.name}"${l.is_folder ? " and all its contents" : ""}?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { await deepDelete(l); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function confirmDeleteSelected() {
//     showAlert("Delete Selected", `Delete ${selected.size} item(s)?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { for (const id of selected) { const l = lessons.find(x => x.id === id); if (l) await deepDelete(l); } setSelected(new Set()); setSelectMode(false); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function clearFolderContents(l: Lesson) {
//     showAlert("Clear Sub-Folder", `Delete all contents inside "${l.name}"? The folder itself will remain.`, [
//       { label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const childPrefix = `FC:${l.id}:`; const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(c => c.image_uri?.startsWith(childPrefix)); for (const c of children) await deepDelete(c); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function openMenu(l: Lesson) {
//     const realUri = getRealUri(l);
//     showSheet(l.name, [
//       ...(realUri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => setViewUri(realUri) }] : []),
//       ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenSubFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []),
//       { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) },
//       { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) },
//       { label: "Cancel", style: "cancel" as const, onPress: () => {} },
//     ]);
//   }

//   // Recursively render sub-folder screen when one is open
//   if (openSubFolder) {
//     const bc = breadcrumb ? `${breadcrumb} › ${folder.name}` : folder.name;
//     return <FolderLessonsScreen folder={openSubFolder} subject={subject} semesterName={semesterName} yearName={yearName} breadcrumb={bc} onBack={() => { setOpenSubFolder(null); load(); }} />;
//   }

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;
//   const subtitle = breadcrumb ? `${breadcrumb} › ${folder.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}` : `📁 ${subject.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={folder.name} subtitle={subtitle} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>Folder is empty</Text><Btn label="+ Add" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => {
//           const isSel = selected.has(item.id); const realUri = getRealUri(item);
//           return (
//             <TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenSubFolder(item); else if (realUri) setViewUri(realUri); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>
//               {item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : realUri ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" /> : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>}
//               <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>
//               {isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}
//             </TouchableOpacity>
//           );
//         }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__subfolder__" ? "Name this Sub-Folder" : "Name this Photo"} placeholder={pendingUris[0] === "__subfolder__" ? "e.g. Week 1" : "e.g. Page 1"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__subfolder__") commitSubFolder(name).then(load); else if (pendingUris.length) commitNamed(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       <ImageViewer uri={viewUri} onClose={() => setViewUri(null)} />
//     </View>
//   );
// }

// // ─── LESSONS SCREEN ───────────────────────────────────────────────────────────
// function LessonsScreen({ subject, semesterName, yearName, onBack }: { subject: Subject; semesterName: string; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null); const [viewUri, setViewUri] = useState<string | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openFolder, setOpenFolder] = useState<Lesson | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]); setLessons(all.filter(l => !l.image_uri?.startsWith("FC:"))); }, [subject.id]);
//   useEffect(() => { load(); }, [load]);

//   async function commitOne(name: string, uri: string, isFolder = false) { let storedUri: string | null = uri; if (uri && !isFolder) storedUri = await copyImage(uri, yearName, semesterName, subject.name, name); const db = await getDb(); await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,?)", [subject.id, name, storedUri, isFolder ? 1 : 0]); }
//   async function commit(name: string, uri: string | null, isFolder = false) { try { await commitOne(name, uri ?? "", isFolder); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitOne(`Photo ${lessons.length + i + 1}`, uris[i], false); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access is required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access is required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access is required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() { showSheet("Add to " + subject.name, [{ label: "Quick Photos (auto-name, multi)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) }, { label: "Named Image Lesson", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) }, { label: "Create Folder Lesson", icon: "📁", onPress: () => { setPendingUris(["__folder__"]); setNameModalVis(true); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }
//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   function confirmDelete(l: Lesson) { showAlert("Delete Lesson", `Delete "${l.name}"?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} load(); } }, { label: "Cancel", style: "cancel" }]); }
//   function confirmDeleteSelected() { showAlert("Delete Selected", `Delete ${selected.size} lesson(s)?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); for (const id of selected) { const l = lessons.find(x => x.id === id); if (!l) continue; await db.runAsync("DELETE FROM lessons WHERE id=?", [id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } setSelected(new Set()); setSelectMode(false); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function clearFolderContents(folder: Lesson) { showAlert("Clear Folder Content", `Delete all photos inside "${folder.name}"? The folder itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(l => l.image_uri?.startsWith(`FC:${folder.id}:`)); for (const l of children) { await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); const real = l.image_uri!.replace(/^FC:\d+:/, ""); try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {} } load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function openMenu(l: Lesson) { showSheet(l.name, [...(!l.is_folder && l.image_uri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => setViewUri(l.image_uri!) }] : []), ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []), { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) }, { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) }, { label: "Cancel", style: "cancel" as const, onPress: () => {} }]); }

//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (openFolder) { setOpenFolder(null); load(); return true; } return false; }); return () => handler.remove(); }, [openFolder]);

//   if (openFolder) return <FolderLessonsScreen folder={openFolder} subject={subject} semesterName={semesterName} yearName={yearName} onBack={() => { setOpenFolder(null); load(); }} />;

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={subject.name} subtitle={`${semesterName} · ${yearName} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No items yet</Text><Btn label="+ Add Lesson" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => { const isSel = selected.has(item.id); return (<TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenFolder(item); else if (item.image_uri) setViewUri(item.image_uri); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>{item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : <Image source={{ uri: item.image_uri! }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />}<View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>{isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}</TouchableOpacity>); }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__folder__" ? "Name this Folder" : "Name this Lesson"} placeholder={pendingUris[0] === "__folder__" ? "e.g. Exercises" : "e.g. Chapter 3 Notes"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__folder__") commit(name, null, true); else if (pendingUris.length) commit(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       <ImageViewer uri={viewUri} onClose={() => setViewUri(null)} />
//     </View>
//   );
// }

// // ─── SUBJECTS SCREEN ──────────────────────────────────────────────────────────
// function SubjectsScreen({ semester, yearName, onBack }: { semester: Semester; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [subjects, setSubjects] = useState<Subject[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSubject, setEditSubject] = useState<Subject | null>(null); const [active, setActive] = useState<Subject | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSubjects(await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? ORDER BY name ASC", [semester.id])); }, [semester.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (active) { setActive(null); return true; } return false; }); return () => handler.remove(); }, [active]);

//   async function applySubjectToOthers(name: string, scope: "all_semesters" | "all_years") { const db = await getDb(); if (scope === "all_semesters") { const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND id!=?", [semester.year_id, semester.id]); for (const s of sems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } else if (scope === "all_years") { const allSems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE name=? AND id!=?", [semester.name, semester.id]); for (const s of allSems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } }

//   function addSubjectFlow(name: string) { setShowAdd(false); showSheet("Apply to other semesters?", [{ label: "This semester only", icon: "📂", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); load(); } }, { label: "All semesters in this year", icon: "📅", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_semesters"); load(); } }, { label: "All years (same semester name)", icon: "🗂️", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_years"); load(); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }

//   async function rename(sub: Subject, name: string) { const db = await getDb(); await db.runAsync("UPDATE subjects SET name=? WHERE id=?", [name, sub.id]); setEditSubject(null); load(); }

//   function confirmDelete(sub: Subject) { showAlert("Delete Subject", `Delete "${sub.name}" and all its lessons?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (active) return <LessonsScreen subject={active} semesterName={semester.name} yearName={yearName} onBack={() => setActive(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={semester.name} subtitle={`${yearName} · ${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Subject" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
//         {subjects.map(sub => (
//           <TouchableOpacity key={sub.id} onPress={() => setActive(sub)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 24 }}>📗</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sub.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sub.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSubject(sub) }, { label: "Clear All Lessons", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Lessons", `Delete all lessons in "${sub.name}"?`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM lessons WHERE subject_id=?", [sub.id]); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Subject", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sub) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {subjects.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📗</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No subjects yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Subject" placeholder="e.g. Mathematics" onConfirm={addSubjectFlow} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSubject} title="Rename Subject" initial={editSubject?.name} onConfirm={v => editSubject && rename(editSubject, v)} onCancel={() => setEditSubject(null)} />
//     </View>
//   );
// }

// // ─── YEAR SCREEN ──────────────────────────────────────────────────────────────
// function YearScreen({ year, onBack }: { year: Year; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet(); const insets = useSafeAreaInsets();
//   const [semesters, setSemesters] = useState<Semester[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSem, setEditSem] = useState<Semester | null>(null); const [activeSem, setActiveSem] = useState<Semester | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSemesters(await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? ORDER BY created_at ASC", [year.id])); }, [year.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeSem) { setActiveSem(null); return true; } return false; }); return () => handler.remove(); }, [activeSem]);

//   async function add(name: string) { const db = await getDb(); await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [year.id, name]); load(); }
//   async function rename(sem: Semester, name: string) { const db = await getDb(); await db.runAsync("UPDATE semesters SET name=? WHERE id=?", [name, sem.id]); setEditSem(null); load(); }

//   async function deleteSemContent(sem: Semester) { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } await db.runAsync("DELETE FROM semesters WHERE id=?", [sem.id]); }

//   function confirmDelete(sem: Semester) { showAlert("Delete Semester", `Delete "${sem.name}" and all its content?`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteSemContent(sem); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (activeSem) return <SubjectsScreen semester={activeSem} yearName={year.name} onBack={() => setActiveSem(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={year.name} subtitle={`${semesters.length} semester${semesters.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Semester" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
//         {semesters.map(sem => (
//           <TouchableOpacity key={sem.id} onPress={() => setActiveSem(sem)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 26 }}>📂</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sem.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sem.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSem(sem) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Semester Content", `Delete all subjects and lessons inside "${sem.name}"? The semester itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Semester", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sem) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {semesters.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No semesters yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Semester" placeholder="e.g. Semester 1" onConfirm={v => { setShowAdd(false); add(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSem} title="Rename Semester" initial={editSem?.name} onConfirm={v => editSem && rename(editSem, v)} onCancel={() => setEditSem(null)} />
//     </View>
//   );
// }

// // ─── HOME SCREEN ──────────────────────────────────────────────────────────────
// function HomeScreen() {
//   const { colors, isDark, colorMode, setColorMode } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const insets = useSafeAreaInsets();
//   const [years, setYears] = useState<Year[]>([]); const [showAdd, setShowAdd] = useState(false); const [editYear, setEditYear] = useState<Year | null>(null); const [activeYear, setActiveYear] = useState<Year | null>(null); const [busy, setBusy] = useState<"export" | "import" | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setYears(await db.getAllAsync<Year>("SELECT * FROM years ORDER BY created_at DESC")); }, []);
//   useEffect(() => { seedDefault().then(load); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeYear) { setActiveYear(null); return true; } return false; }); return () => handler.remove(); }, [activeYear]);

//   async function addYear(name: string) { const db = await getDb(); try { const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", [name]); const yid = r.lastInsertRowId; for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s]); load(); } catch (e: any) { if (String(e).includes("UNIQUE")) showAlert("Name Taken", "A year with that name already exists."); else showAlert("Error", String(e)); } }
//   async function renameYear(year: Year, name: string) { const db = await getDb(); await db.runAsync("UPDATE years SET name=? WHERE id=?", [name, year.id]); setEditYear(null); load(); }

//   async function deleteYearContent(year: Year) { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } } await db.runAsync("DELETE FROM years WHERE id=?", [year.id]); }
//   function confirmDeleteYear(year: Year) { showAlert("Delete Year", `Delete "${year.name}" and all its content? This cannot be undone.`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteYearContent(year); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   // ── EXPORT ────────────────────────────────────────────────────────────────
//   async function exportZip() {
//     const fname = `LessonVault_${new Date().toISOString().slice(0, 10)}.zip`;
//     const zipPath = FileSystem.cacheDirectory + fname;

//     async function buildZip(): Promise<string> {
//       const db = await getDb(); const zip = new JSZip();
//       const allYears = await db.getAllAsync<Year>("SELECT * FROM years");
//       const manifest: any = { exportedAt: new Date().toISOString(), years: [] };
//       for (const y of allYears) {
//         const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [y.id]); const semData: any[] = [];
//         for (const s of sems) {
//           const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); const subData: any[] = [];
//           for (const sub of subs) {
//             // Fetch ALL lessons for this subject — root level and all nested folder contents
//             const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at ASC", [sub.id]);
//             for (const l of ls) {
//               if (l.is_folder) continue;
//               // Strip all FC:<id>: prefixes to get the real file path (handles infinite nesting)
//               let realUri = l.image_uri || "";
//               while (realUri.startsWith("FC:")) realUri = realUri.replace(/^FC:\d+:/, "");
//               if (!realUri || realUri === "__folder__") continue;
//               try {
//                 const info = await FileSystem.getInfoAsync(realUri); if (!info.exists) continue;
//                 const b64 = await FileSystem.readAsStringAsync(realUri, { encoding: FileSystem.EncodingType.Base64 }); if (!b64) continue;
//                 const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//                 // Key by lesson id — globally unique, no path collision regardless of nesting depth
//                 zip.file(`files/${l.id}.${ext}`, b64, { base64: true });
//               } catch {}
//             }
//             // Store all lessons with image_uri intact so all FC: folder relationships are preserved in manifest
//             subData.push({ id: sub.id, name: sub.name, lessons: ls });
//           }
//           semData.push({ id: s.id, name: s.name, subjects: subData });
//         }
//         manifest.years.push({ id: y.id, name: y.name, semesters: semData });
//       }
//       zip.file("manifest.json", JSON.stringify(manifest, null, 2));
//       const zipB64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
//       await FileSystem.writeAsStringAsync(zipPath, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       return zipPath;
//     }

//     showSheet("Export ZIP", [
//       { label: Platform.OS === "android" ? "Save to Downloads" : "Save to Files", icon: "💾", onPress: async () => { setBusy("export"); try { const path = await buildZip(); await saveOrShareZip(path, fname, (t, m) => showAlert(t, m)); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Share…", icon: "📤", onPress: async () => { setBusy("export"); try { const path = await buildZip(); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "application/zip", dialogTitle: "Export LessonVault" }); else showAlert("Not available", "Sharing is not available on this device."); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   // ── IMPORT ────────────────────────────────────────────────────────────────
//   async function importZip() {
//     setBusy("import");
//     try {
//       const res = await DocumentPicker.getDocumentAsync({ type: "application/zip", copyToCacheDirectory: true });
//       if (res.canceled) { setBusy(null); return; }
//       const zipB64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
//       if (!zipB64) { showAlert("Import Error", "Could not read the zip file."); return; }
//       const zip = await JSZip.loadAsync(zipB64, { base64: true });
//       const mf = zip.file("manifest.json"); if (!mf) { showAlert("Import Error", "No manifest.json found."); return; }
//       const manifest = JSON.parse(await mf.async("string")); const db = await getDb(); let imported = 0;
//       for (const y of manifest.years) {
//         let yr = await db.getFirstAsync<Year>("SELECT * FROM years WHERE name=?", [y.name]); let yid = yr ? yr.id : (await db.runAsync("INSERT INTO years (name) VALUES (?)", [y.name])).lastInsertRowId;
//         for (const s of y.semesters) {
//           let sr = await db.getFirstAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND name=?", [yid, s.name]); let sid = sr ? sr.id : (await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s.name])).lastInsertRowId;
//           for (const sub of (s.subjects || [])) {
//             let subr = await db.getFirstAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? AND name=?", [sid, sub.name]); let subid = subr ? subr.id : (await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [sid, sub.name])).lastInsertRowId;
//             // Two-pass import: first create all lessons (folders first so their new IDs exist),
//             // then fix up image_uri FC: references to remap old IDs to new IDs.
//             const allLessons: any[] = sub.lessons || [];
//             // oldId -> newId mapping for this subject's lessons
//             const idMap: Record<number, number> = {};
//             // Pass 1: insert lessons in order (folders before their children since they were inserted first)
//             // Sort: folders with no FC: parent come first, then by created_at
//             const sorted = [...allLessons].sort((a, b) => {
//               const aIsRootFolder = a.is_folder && (!a.image_uri || !a.image_uri.startsWith("FC:"));
//               const bIsRootFolder = b.is_folder && (!b.image_uri || !b.image_uri.startsWith("FC:"));
//               if (aIsRootFolder && !bIsRootFolder) return -1;
//               if (!aIsRootFolder && bIsRootFolder) return 1;
//               return 0;
//             });
//             for (const l of sorted) {
//               try {
//                 if (l.is_folder) {
//                   // Folders: insert with null image_uri first, fix up after idMap is built
//                   const r = await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,1)", [subid, l.name, null]);
//                   idMap[l.id] = Number(r.lastInsertRowId); imported++;
//                 } else {
//                   // Photos: find the file in zip by old lesson id
//                   let realUri = l.image_uri || "";
//                   while (realUri.startsWith("FC:")) realUri = realUri.replace(/^FC:\d+:/, "");
//                   if (!realUri || realUri === "__folder__") continue;
//                   const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//                   const file = zip.file(`files/${l.id}.${ext}`);
//                   if (!file) continue;
//                   const b64 = await file.async("base64"); if (!b64) continue;
//                   const dir = FileSystem.documentDirectory + `LessonVault/${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/`;
//                   await ensureDir(dir);
//                   const dest = `${dir}${slug(l.name)}_${Date.now()}_${l.id}.${ext}`;
//                   await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
//                   // Store with placeholder image_uri; we'll remap FC: ids in pass 2
//                   const r = await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,0)", [subid, l.name, dest]);
//                   idMap[l.id] = Number(r.lastInsertRowId); imported++;
//                 }
//               } catch {}
//             }
//             // Pass 2: fix up image_uri for all lessons that had a FC:<oldId>: prefix
//             for (const l of allLessons) {
//               const newId = idMap[l.id]; if (!newId) continue;
//               if (!l.image_uri) continue;
//               // Rebuild the image_uri by remapping each FC:<oldId> segment to FC:<newId>
//               // image_uri format: FC:<parentId>:<realPathOrFolderMarker>
//               // For photos directly in a root folder: FC:<folderId>:<realPath>
//               // For sub-folder marker: FC:<parentFolderId>:__folder__
//               // For photos in sub-folders: FC:<subFolderId>:<realPath>
//               // Strategy: replace all FC:<oldId>: occurrences using idMap
//               let newUri = l.image_uri;
//               // Replace each FC:<oldId>: with FC:<newId>: using the idMap
//               newUri = newUri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                 const mapped = idMap[Number(oid)];
//                 return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//               });
//               // For photos: also update the real file path portion (it now points to the newly written dest)
//               // We stored dest directly for photos, but if there's a FC: wrapper we need to keep prefix + dest
//               if (!l.is_folder) {
//                 // The dest we wrote is already the correct final path; we just need the correct FC: prefix chain
//                 // Extract prefix chain (everything up to and including the last FC:<id>:)
//                 const prefixMatch = l.image_uri.match(/^((?:FC:\d+:)+)/);
//                 if (prefixMatch) {
//                   // Remap prefix, then append the new dest path for this lesson
//                   const newPrefix = prefixMatch[1].replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                     const mapped = idMap[Number(oid)]; return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//                   });
//                   // Find the dest we wrote by looking it up from the newly inserted row
//                   const row = await db.getFirstAsync<Lesson>("SELECT * FROM lessons WHERE id=?", [newId]);
//                   if (row && row.image_uri && !row.image_uri.startsWith("FC:")) {
//                     newUri = newPrefix + row.image_uri;
//                   }
//                 }
//               }
//               await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
//             }
//             // Pass 3: fix folder image_uri (root folders had null; sub-folders had FC:<parentId>:__folder__)
//             for (const l of allLessons) {
//               if (!l.is_folder) continue;
//               const newId = idMap[l.id]; if (!newId) continue;
//               if (!l.image_uri) continue; // root folder stays null
//               // Remap FC: parent id
//               const newUri = l.image_uri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                 const mapped = idMap[Number(oid)]; return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//               });
//               await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
//             }
//           }
//         }
//       }
//       showAlert("Import Complete", `${imported} item(s) imported successfully.`); load();
//     } catch (e) { showAlert("Import Error", String(e)); } finally { setBusy(null); }
//   }

//   if (activeYear) return <YearScreen year={activeYear} onBack={() => setActiveYear(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <StatusBar barStyle={colors.statusBar} />
//       <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//         <Row>
//           <Text style={{ flex: 1, color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>📚 LessonVault</Text>
//           <TouchableOpacity onPress={() => setColorMode(colorMode === "dark" ? "light" : "dark")} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
//           </TouchableOpacity>
//         </Row>
//         <Row gap={8} wrap style={{ marginTop: 14 }}>
//           <Btn label={busy === "export" ? "Exporting…" : "Export ZIP"} onPress={exportZip} variant="outline" small icon="📤" disabled={busy !== null} />
//           <Btn label={busy === "import" ? "Importing…" : "Import ZIP"} onPress={importZip} variant="outline" small icon="📥" disabled={busy !== null} />
//           <View style={{ flex: 1 }} />
//           <Btn label="+ Year" onPress={() => setShowAdd(true)} small icon="📁" />
//         </Row>
//       </View>
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: insets.bottom + 24 }}>
//         <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{years.length} Year{years.length !== 1 ? "s" : ""}</Text>
//         {years.map(year => (
//           <TouchableOpacity key={year.id} onPress={() => setActiveYear(year)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 16 }}>
//             <View style={{ backgroundColor: colors.accent + "1A", borderRadius: 14, padding: 10 }}><Text style={{ fontSize: 24 }}>🗂️</Text></View>
//             <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{year.name}</Text><Text style={{ color: colors.textSub, fontSize: 12, marginTop: 2 }}>{new Date(year.created_at).toLocaleDateString()}</Text></View>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(year.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditYear(year) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Year Content", `Delete all semesters and everything inside "${year.name}"? The year itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); } await db.runAsync("DELETE FROM semesters WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Year", icon: "🗑️", style: "destructive", onPress: () => confirmDeleteYear(year) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {years.length === 0 && <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}><Text style={{ fontSize: 56 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 16, textAlign: "center" }}>No years yet.{"\n"}Tap "+ Year" to get started.</Text></View>}
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Year" placeholder="e.g. 2nd Year" onConfirm={v => { setShowAdd(false); addYear(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editYear} title="Rename Year" initial={editYear?.name} onConfirm={v => editYear && renameYear(editYear, v)} onCancel={() => setEditYear(null)} />
//     </View>
//   );
// }

// // ─── THEME PROVIDER ───────────────────────────────────────────────────────────
// const THEME_KEY = "lessonvault_theme_v2";
// function ThemeProvider({ children }: { children: React.ReactNode }) {
//   const sys = useColorScheme(); const [colorMode, setModeState] = useState<ColorMode>("system"); const [loaded, setLoaded] = useState(false);
//   useEffect(() => { AsyncStorage.getItem(THEME_KEY).then(v => { if (v === "light" || v === "dark") setModeState(v as ColorMode); setLoaded(true); }); }, []);
//   const setColorMode = useCallback((m: ColorMode) => { setModeState(m); if (m === "light" || m === "dark") AsyncStorage.setItem(THEME_KEY, m); else AsyncStorage.removeItem(THEME_KEY); }, []);
//   const isDark = colorMode === "dark" || (colorMode === "system" && sys === "dark"); const colors = isDark ? DARK : LIGHT;
//   if (!loaded) return null;
//   return <ThemeContext.Provider value={{ colors, colorMode, setColorMode, isDark }}>{children}</ThemeContext.Provider>;
// }

// export default function Index() {
//   return (
//     <ThemeProvider>
//       <AlertProvider>
//         <SheetProvider>
//           <HomeScreen />
//         </SheetProvider>
//       </AlertProvider>
//     </ThemeProvider>
//   );
// }






// /**
//  * LessonVault — School Lesson Manager
//  * PASTE AS: app/index.tsx
//  */

// import AsyncStorage from "@react-native-async-storage/async-storage";
// import * as DocumentPicker from "expo-document-picker";
// import * as FileSystem from "expo-file-system/legacy";
// import * as ImagePicker from "expo-image-picker";
// import * as MediaLibrary from "expo-media-library";
// import * as Sharing from "expo-sharing";
// import * as SQLite from "expo-sqlite";
// import JSZip from "jszip";
// import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
// import { Animated, BackHandler, Dimensions, FlatList, Image, Modal, PanResponder, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// type ColorMode = "light" | "dark" | "system";
// interface Year { id: number; name: string; created_at: string }
// interface Semester { id: number; year_id: number; name: string; created_at: string }
// interface Subject { id: number; semester_id: number; name: string; created_at: string }
// interface Lesson { id: number; subject_id: number; name: string; image_uri: string | null; is_folder: number; created_at: string }

// const LIGHT = { bg: "#F5F4F0", surface: "#FFFFFF", surfaceAlt: "#EDEDEA", border: "#DDDDD8", text: "#1A1917", textSub: "#7A7874", accent: "#2563EB", accentText: "#FFFFFF", danger: "#DC2626", dangerBg: "#FEF2F2", card: "#FAFAF8", overlay: "rgba(0,0,0,0.5)", statusBar: "dark-content" as const };
// const DARK = { bg: "#111110", surface: "#1C1C1A", surfaceAlt: "#252523", border: "#333330", text: "#F2F0EB", textSub: "#888884", accent: "#3B82F6", accentText: "#FFFFFF", danger: "#EF4444", dangerBg: "#2D1515", card: "#161614", overlay: "rgba(0,0,0,0.72)", statusBar: "light-content" as const };

// interface ThemeCtx { colors: typeof LIGHT; colorMode: ColorMode; setColorMode: (m: ColorMode) => void; isDark: boolean }
// const ThemeContext = createContext<ThemeCtx>({ colors: DARK, colorMode: "system", setColorMode: () => {}, isDark: true });
// const useTheme = () => useContext(ThemeContext);

// interface AlertBtn { label: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }
// const AlertCtx = createContext<{ showAlert: (t: string, m?: string, b?: AlertBtn[]) => void }>({ showAlert: () => {} });
// const useAlert = () => useContext(AlertCtx);

// function AlertProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const [st, setSt] = useState<{ visible: boolean; title: string; message?: string; buttons: AlertBtn[] }>({ visible: false, title: "", buttons: [] });
//   const showAlert = useCallback((title: string, message?: string, buttons: AlertBtn[] = [{ label: "OK" }]) => setSt({ visible: true, title, message, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <AlertCtx.Provider value={{ showAlert }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="fade">
//         <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
//           <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: st.message ? 8 : 20 }}>{st.title}</Text>
//             {st.message && <Text style={{ color: colors.textSub, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 20 }}>{st.message}</Text>}
//             <View style={{ gap: 8 }}>
//               {st.buttons.map((b, i) => (
//                 <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress?.(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.danger : b.style === "cancel" ? colors.surfaceAlt : colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: "center", borderWidth: b.style === "cancel" ? 1 : 0, borderColor: colors.border }}>
//                   <Text style={{ color: b.style === "cancel" ? colors.text : "#fff", fontWeight: b.style === "cancel" ? "500" : "700", fontSize: 15 }}>{b.label}</Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </AlertCtx.Provider>
//   );
// }

// interface SheetBtn { label: string; icon?: string; onPress: () => void; style?: "destructive" | "cancel" }
// const SheetCtx = createContext<{ showSheet: (t?: string, b?: SheetBtn[]) => void }>({ showSheet: () => {} });
// const useSheet = () => useContext(SheetCtx);

// function SheetProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const insets = useSafeAreaInsets();
//   const [st, setSt] = useState<{ visible: boolean; title?: string; buttons: SheetBtn[] }>({ visible: false, buttons: [] });
//   const showSheet = useCallback((title?: string, buttons: SheetBtn[] = []) => setSt({ visible: true, title, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <SheetCtx.Provider value={{ showSheet }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="slide">
//         <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay }} activeOpacity={1} onPress={dismiss} />
//         <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 20 + insets.bottom, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
//           {st.title && <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>{st.title}</Text>}
//           {st.buttons.map((b, i) => (
//             <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.dangerBg : colors.surfaceAlt, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
//               {b.icon && <Text style={{ fontSize: 20 }}>{b.icon}</Text>}
//               <Text style={{ color: b.style === "destructive" ? colors.danger : colors.text, fontSize: 16, fontWeight: b.style === "cancel" ? "500" : "600" }}>{b.label}</Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </Modal>
//     </SheetCtx.Provider>
//   );
// }

// let _db: SQLite.SQLiteDatabase | null = null;
// const DB_SCHEMA = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS years (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name TEXT NOT NULL, image_uri TEXT, is_folder INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`;
// async function getDb(): Promise<SQLite.SQLiteDatabase> {
//   if (_db) { try { await _db.getFirstAsync("SELECT 1"); return _db; } catch { _db = null; } }
//   _db = await SQLite.openDatabaseAsync("lessonvault3.db");
//   await _db.execAsync(DB_SCHEMA);
//   return _db;
// }

// async function seedDefault() {
//   const db = await getDb();
//   const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM years");
//   if (row && row.count > 0) return;
//   const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", ["Current-Year"]);
//   const yid = r.lastInsertRowId;
//   for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id, name) VALUES (?,?)", [yid, s]);
// }

// function slug(s: string) { return s.replace(/[^a-zA-Z0-9_-]/g, "_"); }
// async function ensureDir(path: string) { const info = await FileSystem.getInfoAsync(path); if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true }); }

// async function copyImage(uri: string, yearName: string, semName: string, subName: string, label: string) {
//   const dir = FileSystem.documentDirectory + `LessonVault/${slug(yearName)}/${slug(semName)}/${slug(subName)}/`;
//   await ensureDir(dir);
//   const cleanUri = uri.split("?")[0]; const rawExt = cleanUri.split(".").pop()?.toLowerCase() || "jpg"; const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(rawExt) ? rawExt : "jpg";
//   const dest = `${dir}${slug(label)}_${Date.now()}.${safeExt}`;
//   await FileSystem.copyAsync({ from: uri, to: dest }); return dest;
// }

// async function pickCamera() {
//   const { status } = await ImagePicker.requestCameraPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGallery(): Promise<string | null> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: false });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGalleryMultiple(): Promise<string[]> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return [];
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
//   return r.canceled ? [] : r.assets.map(a => a.uri);
// }

// // ── Save ZIP to Downloads on Android using SAF, share on iOS ─────────────────
// async function saveOrShareZip(zipPath: string, fname: string, showAlert: (t: string, m?: string) => void) {
//   if (Platform.OS === "android") {
//     try {
//       // Android 10+ (API 29+): use StorageAccessFramework to write directly to Downloads
//       const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
//       if (!permissions.granted) {
//         // User cancelled SAF picker — fallback to share
//         if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" }); }
//         else { showAlert("Cancelled", "No download location selected."); }
//         return;
//       }
//       // Create file in the chosen directory
//       const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fname, "application/zip");
//       const zipB64 = await FileSystem.readAsStringAsync(zipPath, { encoding: FileSystem.EncodingType.Base64 });
//       await FileSystem.StorageAccessFramework.writeAsStringAsync(destUri, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       showAlert("Saved", `ZIP saved as ${fname}`);
//     } catch (e: any) {
//       // Fallback: share sheet
//       try {
//         if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" });
//         else showAlert("Error", String(e));
//       } catch (e2) { showAlert("Error", String(e2)); }
//     }
//   } else {
//     if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save to Files" });
//     else showAlert("Not available", "Sharing is not available on this device.");
//   }
// }

// function Btn({ label, onPress, variant = "primary", small = false, icon, disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "danger" | "ghost" | "outline"; small?: boolean; icon?: string; disabled?: boolean }) {
//   const { colors } = useTheme();
//   const bg = variant === "primary" ? colors.accent : variant === "danger" ? colors.danger : "transparent";
//   const tc = variant === "primary" || variant === "danger" ? "#fff" : variant === "outline" ? colors.accent : colors.text;
//   return (
//     <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} style={{ backgroundColor: disabled ? colors.surfaceAlt : bg, borderColor: variant === "outline" ? colors.accent : "transparent", borderWidth: variant === "outline" ? 1.5 : 0, borderRadius: 10, paddingHorizontal: small ? 12 : 18, paddingVertical: small ? 7 : 11, flexDirection: "row", alignItems: "center", gap: 5, opacity: disabled ? 0.5 : 1 }}>
//       {icon && <Text style={{ fontSize: small ? 14 : 16 }}>{icon}</Text>}
//       <Text style={{ color: disabled ? colors.textSub : tc, fontWeight: "600", fontSize: small ? 13 : 15 }}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// function Row({ children, gap = 8, wrap = false }: { children: React.ReactNode; gap?: number; wrap?: boolean }) { return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>; }

// function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
//   const { colors } = useTheme(); const insets = useSafeAreaInsets();
//   return (
//     <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//       {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 6, alignSelf: "flex-start" }}><Text style={{ color: colors.accent, fontSize: 16 }}>← Back</Text></TouchableOpacity>}
//       <Row><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: onBack ? 22 : 26, fontWeight: "900", letterSpacing: -0.4 }}>{title}</Text>{subtitle && <Text style={{ color: colors.textSub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}</View>{right}</Row>
//     </View>
//   );
// }

// function NameModal({ visible, title, initial, placeholder, onConfirm, onCancel }: { visible: boolean; title: string; initial?: string; placeholder?: string; onConfirm: (v: string) => void; onCancel: () => void }) {
//   const { colors } = useTheme(); const [val, setVal] = useState(initial || "");
//   useEffect(() => setVal(initial || ""), [visible, initial]);
//   return (
//     <Modal visible={visible} transparent animationType="fade">
//       <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
//         <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
//           <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 14 }}>{title}</Text>
//           <TextInput value={val} onChangeText={setVal} placeholder={placeholder || "Name…"} placeholderTextColor={colors.textSub} autoFocus style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 18, borderWidth: 1, borderColor: colors.border }} />
//           <Row gap={10}><Btn label="Cancel" onPress={onCancel} variant="ghost" /><View style={{ flex: 1 }} /><Btn label="Confirm" onPress={() => { if (val.trim()) onConfirm(val.trim()); }} /></Row>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// // ─── ZOOMABLE IMAGE — fixed sensitivity ───────────────────────────────────────
// // Key changes:
// //  • Pinch scale uses a dampening factor (0.65) so fast finger spreads don't jump
// //  • MIN_SCALE = 1, MAX_SCALE = 5 (was 0.5–8)
// //  • Translation clamping applied immediately during move
// function ZoomableImage({ uri }: { uri: string }) {
//   const [dims, setDims] = useState({ w: Dimensions.get("window").width, h: Dimensions.get("window").height });

//   const currentScale = useRef(1);
//   const currentTx = useRef(0);
//   const currentTy = useRef(0);

//   const scaleAnim = useRef(new Animated.Value(1)).current;
//   const txAnim = useRef(new Animated.Value(0)).current;
//   const tyAnim = useRef(new Animated.Value(0)).current;

//   const pinchStartDist = useRef(0);
//   const pinchStartScale = useRef(1);
//   const panStartTx = useRef(0);
//   const panStartTy = useRef(0);
//   const lastTapTime = useRef(0);
//   const lastTapX = useRef(0);
//   const lastTapY = useRef(0);
//   const isPinching = useRef(false);

//   const MIN_SCALE = 1;
//   const MAX_SCALE = 5;
//   // Dampening: how aggressively pinch maps to scale change. Lower = less sensitive.
//   const PINCH_DAMPEN = 0.65;
//   // Pan dampening: multiplier on drag distance. Lower = slower pan movement.
//   const PAN_DAMPEN = 0.4;

//   function getTouchDist(touches: any[]) {
//     const dx = touches[0].pageX - touches[1].pageX; const dy = touches[0].pageY - touches[1].pageY;
//     return Math.sqrt(dx * dx + dy * dy);
//   }

//   function clampTranslation(tx: number, ty: number, scale: number) {
//     const maxTx = Math.max(0, (dims.w * (scale - 1)) / 2);
//     const maxTy = Math.max(0, (dims.h * (scale - 1)) / 2);
//     return { tx: Math.min(maxTx, Math.max(-maxTx, tx)), ty: Math.min(maxTy, Math.max(-maxTy, ty)) };
//   }

//   function applyTransform(scale: number, tx: number, ty: number, animated = false) {
//     const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
//     const clamped = clampTranslation(tx, ty, s);
//     currentScale.current = s; currentTx.current = clamped.tx; currentTy.current = clamped.ty;
//     if (animated) {
//       Animated.parallel([
//         Animated.spring(scaleAnim, { toValue: s, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(txAnim, { toValue: clamped.tx, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(tyAnim, { toValue: clamped.ty, useNativeDriver: true, tension: 120, friction: 10 }),
//       ]).start();
//     } else {
//       scaleAnim.setValue(s); txAnim.setValue(clamped.tx); tyAnim.setValue(clamped.ty);
//     }
//   }

//   function resetZoom(animated = true) { applyTransform(1, 0, 0, animated); }

//   function doubleTapZoom(tapX: number, tapY: number) {
//     if (currentScale.current > 1.5) { resetZoom(true); return; }
//     const newScale = 2.5;
//     const tx = (dims.w / 2 - tapX) * (newScale - 1);
//     const ty = (dims.h / 2 - tapY) * (newScale - 1);
//     applyTransform(newScale, tx, ty, true);
//   }

//   const panResponder = useRef(PanResponder.create({
//     onStartShouldSetPanResponder: () => true,
//     onMoveShouldSetPanResponder: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) return true;
//       return currentScale.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
//     },
//     onPanResponderGrant: (e) => {
//       const touches = e.nativeEvent.touches;
//       isPinching.current = touches.length >= 2;
//       if (touches.length >= 2) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; }
//       panStartTx.current = currentTx.current; panStartTy.current = currentTy.current;
//     },
//     onPanResponderMove: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) {
//         isPinching.current = true;
//         if (pinchStartDist.current === 0) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; return; }
//         const dist = getTouchDist(Array.from(touches));
//         const rawRatio = dist / pinchStartDist.current;
//         // Apply dampening: interpolate ratio toward 1 to reduce sensitivity
//         const dampenedRatio = 1 + (rawRatio - 1) * PINCH_DAMPEN;
//         const newScale = pinchStartScale.current * dampenedRatio;
//         applyTransform(newScale, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       } else if (!isPinching.current && currentScale.current > 1) {
//         applyTransform(currentScale.current, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       }
//     },
//     onPanResponderRelease: (e, g) => {
//       const wasPinching = isPinching.current;
//       isPinching.current = false; pinchStartDist.current = 0;
//       if (currentScale.current <= 1.05) { resetZoom(true); return; }
//       // Snap into bounds
//       const { tx, ty } = clampTranslation(currentTx.current, currentTy.current, currentScale.current);
//       if (tx !== currentTx.current || ty !== currentTy.current) applyTransform(currentScale.current, tx, ty, true);
//       // Double-tap
//       if (!wasPinching && Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
//         const now = Date.now();
//         const x = e.nativeEvent.changedTouches[0]?.pageX ?? dims.w / 2;
//         const y = e.nativeEvent.changedTouches[0]?.pageY ?? dims.h / 2;
//         if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) { lastTapTime.current = 0; doubleTapZoom(x, y); }
//         else { lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y; }
//       }
//     },
//     onPanResponderTerminationRequest: () => false,
//   })).current;

//   return (
//     <View style={{ flex: 1 }} onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
//       <Animated.Image source={{ uri }} {...panResponder.panHandlers} style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateX: txAnim }, { translateY: tyAnim }] }} resizeMode="contain" />
//     </View>
//   );
// }

// function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
//   const insets = useSafeAreaInsets();
//   if (!uri) return null;
//   return (
//     <Modal visible animationType="fade" statusBarTranslucent>
//       <View style={{ flex: 1, backgroundColor: "#000" }}>
//         <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: insets.top + 10, right: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 22, width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
//           <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
//         </TouchableOpacity>
//         <ZoomableImage uri={uri} />
//         <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 12, paddingBottom: insets.bottom + 12 }}>Pinch or double-tap to zoom</Text>
//       </View>
//     </Modal>
//   );
// }

// // ─── FOLDER LESSONS SCREEN — infinite nesting ────────────────────────────────
// // Items belonging to a folder use image_uri = `FC:<folderId>:<realPath>` for photos
// // and image_uri = `FC:<folderId>:__folder__` + is_folder=1 for sub-folders.
// // Each level only shows items whose image_uri starts with `FC:<thisFolder.id>:`.
// // Opening a sub-folder just renders another FolderLessonsScreen on top — infinite depth.
// function FolderLessonsScreen({ folder, subject, semesterName, yearName, onBack, breadcrumb }: { folder: Lesson; subject: Subject; semesterName: string; yearName: string; onBack: () => void; breadcrumb?: string }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null); const [viewUri, setViewUri] = useState<string | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openSubFolder, setOpenSubFolder] = useState<Lesson | null>(null);

//   const PREFIX = `FC:${folder.id}:`;

//   const load = useCallback(async () => {
//     const db = await getDb();
//     const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]);
//     // Direct children: image_uri starts with FC:<folder.id>: AND the rest contains no further FC: prefix
//     // (sub-folder children use FC:<subFolderId>: so they won't match this folder's prefix)
//     setLessons(all.filter(l => l.image_uri?.startsWith(PREFIX)));
//   }, [subject.id, folder.id]);

//   useEffect(() => { load(); }, [load]);

//   useEffect(() => {
//     const handler = BackHandler.addEventListener("hardwareBackPress", () => {
//       if (openSubFolder) { setOpenSubFolder(null); load(); return true; }
//       return false;
//     });
//     return () => handler.remove();
//   }, [openSubFolder]);

//   // For photos: store as FC:<folderId>:<copiedPath>
//   async function commitPhoto(name: string, uri: string) {
//     const copied = await copyImage(uri, yearName, semesterName, subject.name, name);
//     const storedUri = `${PREFIX}${copied}`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,0)", [subject.id, name, storedUri]);
//   }
//   // For sub-folders: store as FC:<folderId>:__folder__ with is_folder=1
//   async function commitSubFolder(name: string) {
//     const storedUri = `${PREFIX}__folder__`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,1)", [subject.id, name, storedUri]);
//   }

//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitPhoto(`Photo ${lessons.length + i + 1}`, uris[i]); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitNamed(name: string, uri: string) { try { await commitPhoto(name, uri); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() {
//     showSheet("Add to " + folder.name, [
//       { label: "Quick Photos (auto-name)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) },
//       { label: "Named Photo", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) },
//       { label: "Create Sub-Folder", icon: "📁", onPress: () => { setPendingUris(["__subfolder__"]); setNameModalVis(true); } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   // Get the real file URI for a photo (strip the FC:<id>: prefix)
//   function getRealUri(l: Lesson): string | null {
//     if (!l.image_uri || l.is_folder) return null;
//     return l.image_uri.startsWith(PREFIX) ? l.image_uri.slice(PREFIX.length) : l.image_uri;
//   }

//   // Recursively delete all descendant photos then delete the lesson row
//   async function deepDelete(l: Lesson) {
//     const db = await getDb();
//     if (l.is_folder) {
//       // Delete all children of this sub-folder recursively
//       const childPrefix = `FC:${l.id}:`;
//       const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]);
//       const children = all.filter(c => c.image_uri?.startsWith(childPrefix));
//       for (const c of children) await deepDelete(c);
//     } else {
//       const real = getRealUri(l);
//       if (real) try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {}
//     }
//     await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]);
//   }

//   function confirmDelete(l: Lesson) {
//     showAlert("Delete", `Delete "${l.name}"${l.is_folder ? " and all its contents" : ""}?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { await deepDelete(l); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function confirmDeleteSelected() {
//     showAlert("Delete Selected", `Delete ${selected.size} item(s)?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { for (const id of selected) { const l = lessons.find(x => x.id === id); if (l) await deepDelete(l); } setSelected(new Set()); setSelectMode(false); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function clearFolderContents(l: Lesson) {
//     showAlert("Clear Sub-Folder", `Delete all contents inside "${l.name}"? The folder itself will remain.`, [
//       { label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const childPrefix = `FC:${l.id}:`; const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(c => c.image_uri?.startsWith(childPrefix)); for (const c of children) await deepDelete(c); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function openMenu(l: Lesson) {
//     const realUri = getRealUri(l);
//     showSheet(l.name, [
//       ...(realUri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => setViewUri(realUri) }] : []),
//       ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenSubFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []),
//       { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) },
//       { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) },
//       { label: "Cancel", style: "cancel" as const, onPress: () => {} },
//     ]);
//   }

//   // Recursively render sub-folder screen when one is open
//   if (openSubFolder) {
//     const bc = breadcrumb ? `${breadcrumb} › ${folder.name}` : folder.name;
//     return <FolderLessonsScreen folder={openSubFolder} subject={subject} semesterName={semesterName} yearName={yearName} breadcrumb={bc} onBack={() => { setOpenSubFolder(null); load(); }} />;
//   }

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;
//   const subtitle = breadcrumb ? `${breadcrumb} › ${folder.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}` : `📁 ${subject.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={folder.name} subtitle={subtitle} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>Folder is empty</Text><Btn label="+ Add" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => {
//           const isSel = selected.has(item.id); const realUri = getRealUri(item);
//           return (
//             <TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenSubFolder(item); else if (realUri) setViewUri(realUri); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>
//               {item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : realUri ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" /> : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>}
//               <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>
//               {isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}
//             </TouchableOpacity>
//           );
//         }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__subfolder__" ? "Name this Sub-Folder" : "Name this Photo"} placeholder={pendingUris[0] === "__subfolder__" ? "e.g. Week 1" : "e.g. Page 1"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__subfolder__") commitSubFolder(name).then(load); else if (pendingUris.length) commitNamed(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       <ImageViewer uri={viewUri} onClose={() => setViewUri(null)} />
//     </View>
//   );
// }

// // ─── LESSONS SCREEN ───────────────────────────────────────────────────────────
// function LessonsScreen({ subject, semesterName, yearName, onBack }: { subject: Subject; semesterName: string; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null); const [viewUri, setViewUri] = useState<string | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openFolder, setOpenFolder] = useState<Lesson | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]); setLessons(all.filter(l => !l.image_uri?.startsWith("FC:"))); }, [subject.id]);
//   useEffect(() => { load(); }, [load]);

//   async function commitOne(name: string, uri: string, isFolder = false) { let storedUri: string | null = uri; if (uri && !isFolder) storedUri = await copyImage(uri, yearName, semesterName, subject.name, name); const db = await getDb(); await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,?)", [subject.id, name, storedUri, isFolder ? 1 : 0]); }
//   async function commit(name: string, uri: string | null, isFolder = false) { try { await commitOne(name, uri ?? "", isFolder); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitOne(`Photo ${lessons.length + i + 1}`, uris[i], false); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access is required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access is required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access is required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() { showSheet("Add to " + subject.name, [{ label: "Quick Photos (auto-name, multi)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) }, { label: "Named Image Lesson", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) }, { label: "Create Folder Lesson", icon: "📁", onPress: () => { setPendingUris(["__folder__"]); setNameModalVis(true); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }
//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   function confirmDelete(l: Lesson) { showAlert("Delete Lesson", `Delete "${l.name}"?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} load(); } }, { label: "Cancel", style: "cancel" }]); }
//   function confirmDeleteSelected() { showAlert("Delete Selected", `Delete ${selected.size} lesson(s)?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); for (const id of selected) { const l = lessons.find(x => x.id === id); if (!l) continue; await db.runAsync("DELETE FROM lessons WHERE id=?", [id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } setSelected(new Set()); setSelectMode(false); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function clearFolderContents(folder: Lesson) { showAlert("Clear Folder Content", `Delete all photos inside "${folder.name}"? The folder itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(l => l.image_uri?.startsWith(`FC:${folder.id}:`)); for (const l of children) { await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); const real = l.image_uri!.replace(/^FC:\d+:/, ""); try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {} } load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function openMenu(l: Lesson) { showSheet(l.name, [...(!l.is_folder && l.image_uri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => setViewUri(l.image_uri!) }] : []), ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []), { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) }, { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) }, { label: "Cancel", style: "cancel" as const, onPress: () => {} }]); }

//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (openFolder) { setOpenFolder(null); load(); return true; } return false; }); return () => handler.remove(); }, [openFolder]);

//   if (openFolder) return <FolderLessonsScreen folder={openFolder} subject={subject} semesterName={semesterName} yearName={yearName} onBack={() => { setOpenFolder(null); load(); }} />;

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={subject.name} subtitle={`${semesterName} · ${yearName} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No items yet</Text><Btn label="+ Add Lesson" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => { const isSel = selected.has(item.id); return (<TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenFolder(item); else if (item.image_uri) setViewUri(item.image_uri); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>{item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : <Image source={{ uri: item.image_uri! }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />}<View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>{isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}</TouchableOpacity>); }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__folder__" ? "Name this Folder" : "Name this Lesson"} placeholder={pendingUris[0] === "__folder__" ? "e.g. Exercises" : "e.g. Chapter 3 Notes"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__folder__") commit(name, null, true); else if (pendingUris.length) commit(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       <ImageViewer uri={viewUri} onClose={() => setViewUri(null)} />
//     </View>
//   );
// }

// // ─── SUBJECTS SCREEN ──────────────────────────────────────────────────────────
// function SubjectsScreen({ semester, yearName, onBack }: { semester: Semester; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [subjects, setSubjects] = useState<Subject[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSubject, setEditSubject] = useState<Subject | null>(null); const [active, setActive] = useState<Subject | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSubjects(await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? ORDER BY name ASC", [semester.id])); }, [semester.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (active) { setActive(null); return true; } return false; }); return () => handler.remove(); }, [active]);

//   async function applySubjectToOthers(name: string, scope: "all_semesters" | "all_years") { const db = await getDb(); if (scope === "all_semesters") { const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND id!=?", [semester.year_id, semester.id]); for (const s of sems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } else if (scope === "all_years") { const allSems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE name=? AND id!=?", [semester.name, semester.id]); for (const s of allSems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } }

//   function addSubjectFlow(name: string) { setShowAdd(false); showSheet("Apply to other semesters?", [{ label: "This semester only", icon: "📂", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); load(); } }, { label: "All semesters in this year", icon: "📅", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_semesters"); load(); } }, { label: "All years (same semester name)", icon: "🗂️", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_years"); load(); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }

//   async function rename(sub: Subject, name: string) { const db = await getDb(); await db.runAsync("UPDATE subjects SET name=? WHERE id=?", [name, sub.id]); setEditSubject(null); load(); }

//   function confirmDelete(sub: Subject) { showAlert("Delete Subject", `Delete "${sub.name}" and all its lessons?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (active) return <LessonsScreen subject={active} semesterName={semester.name} yearName={yearName} onBack={() => setActive(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={semester.name} subtitle={`${yearName} · ${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Subject" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
//         {subjects.map(sub => (
//           <TouchableOpacity key={sub.id} onPress={() => setActive(sub)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 24 }}>📗</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sub.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sub.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSubject(sub) }, { label: "Clear All Lessons", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Lessons", `Delete all lessons in "${sub.name}"?`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM lessons WHERE subject_id=?", [sub.id]); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Subject", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sub) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {subjects.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📗</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No subjects yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Subject" placeholder="e.g. Mathematics" onConfirm={addSubjectFlow} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSubject} title="Rename Subject" initial={editSubject?.name} onConfirm={v => editSubject && rename(editSubject, v)} onCancel={() => setEditSubject(null)} />
//     </View>
//   );
// }

// // ─── YEAR SCREEN ──────────────────────────────────────────────────────────────
// function YearScreen({ year, onBack }: { year: Year; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [semesters, setSemesters] = useState<Semester[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSem, setEditSem] = useState<Semester | null>(null); const [activeSem, setActiveSem] = useState<Semester | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSemesters(await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? ORDER BY created_at ASC", [year.id])); }, [year.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeSem) { setActiveSem(null); return true; } return false; }); return () => handler.remove(); }, [activeSem]);

//   async function add(name: string) { const db = await getDb(); await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [year.id, name]); load(); }
//   async function rename(sem: Semester, name: string) { const db = await getDb(); await db.runAsync("UPDATE semesters SET name=? WHERE id=?", [name, sem.id]); setEditSem(null); load(); }

//   async function deleteSemContent(sem: Semester) { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } await db.runAsync("DELETE FROM semesters WHERE id=?", [sem.id]); }

//   function confirmDelete(sem: Semester) { showAlert("Delete Semester", `Delete "${sem.name}" and all its content?`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteSemContent(sem); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (activeSem) return <SubjectsScreen semester={activeSem} yearName={year.name} onBack={() => setActiveSem(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={year.name} subtitle={`${semesters.length} semester${semesters.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Semester" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
//         {semesters.map(sem => (
//           <TouchableOpacity key={sem.id} onPress={() => setActiveSem(sem)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 26 }}>📂</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sem.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sem.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSem(sem) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Semester Content", `Delete all subjects and lessons inside "${sem.name}"? The semester itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Semester", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sem) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {semesters.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No semesters yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Semester" placeholder="e.g. Semester 1" onConfirm={v => { setShowAdd(false); add(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSem} title="Rename Semester" initial={editSem?.name} onConfirm={v => editSem && rename(editSem, v)} onCancel={() => setEditSem(null)} />
//     </View>
//   );
// }

// // ─── HOME SCREEN ──────────────────────────────────────────────────────────────
// function HomeScreen() {
//   const { colors, isDark, colorMode, setColorMode } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const insets = useSafeAreaInsets();
//   const [years, setYears] = useState<Year[]>([]); const [showAdd, setShowAdd] = useState(false); const [editYear, setEditYear] = useState<Year | null>(null); const [activeYear, setActiveYear] = useState<Year | null>(null); const [busy, setBusy] = useState<"export" | "import" | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setYears(await db.getAllAsync<Year>("SELECT * FROM years ORDER BY created_at DESC")); }, []);
//   useEffect(() => { seedDefault().then(load); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeYear) { setActiveYear(null); return true; } return false; }); return () => handler.remove(); }, [activeYear]);

//   async function addYear(name: string) { const db = await getDb(); try { const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", [name]); const yid = r.lastInsertRowId; for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s]); load(); } catch (e: any) { if (String(e).includes("UNIQUE")) showAlert("Name Taken", "A year with that name already exists."); else showAlert("Error", String(e)); } }
//   async function renameYear(year: Year, name: string) { const db = await getDb(); await db.runAsync("UPDATE years SET name=? WHERE id=?", [name, year.id]); setEditYear(null); load(); }

//   async function deleteYearContent(year: Year) { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } } await db.runAsync("DELETE FROM years WHERE id=?", [year.id]); }
//   function confirmDeleteYear(year: Year) { showAlert("Delete Year", `Delete "${year.name}" and all its content? This cannot be undone.`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteYearContent(year); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   // ── EXPORT ────────────────────────────────────────────────────────────────
//   async function exportZip() {
//     const fname = `LessonVault_${new Date().toISOString().slice(0, 10)}.zip`;
//     const zipPath = FileSystem.cacheDirectory + fname;

//     async function buildZip(): Promise<string> {
//       const db = await getDb(); const zip = new JSZip();
//       const allYears = await db.getAllAsync<Year>("SELECT * FROM years");
//       const manifest: any = { exportedAt: new Date().toISOString(), years: [] };
//       for (const y of allYears) {
//         const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [y.id]); const semData: any[] = [];
//         for (const s of sems) {
//           const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); const subData: any[] = [];
//           for (const sub of subs) {
//             // Fetch ALL lessons for this subject — root level and all nested folder contents
//             const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at ASC", [sub.id]);
//             for (const l of ls) {
//               if (l.is_folder) continue;
//               // Strip all FC:<id>: prefixes to get the real file path (handles infinite nesting)
//               let realUri = l.image_uri || "";
//               while (realUri.startsWith("FC:")) realUri = realUri.replace(/^FC:\d+:/, "");
//               if (!realUri || realUri === "__folder__") continue;
//               try {
//                 const info = await FileSystem.getInfoAsync(realUri); if (!info.exists) continue;
//                 const b64 = await FileSystem.readAsStringAsync(realUri, { encoding: FileSystem.EncodingType.Base64 }); if (!b64) continue;
//                 const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//                 // Key by lesson id — globally unique, no path collision regardless of nesting depth
//                 zip.file(`files/${l.id}.${ext}`, b64, { base64: true });
//               } catch {}
//             }
//             // Store all lessons with image_uri intact so all FC: folder relationships are preserved in manifest
//             subData.push({ id: sub.id, name: sub.name, lessons: ls });
//           }
//           semData.push({ id: s.id, name: s.name, subjects: subData });
//         }
//         manifest.years.push({ id: y.id, name: y.name, semesters: semData });
//       }
//       zip.file("manifest.json", JSON.stringify(manifest, null, 2));
//       const zipB64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
//       await FileSystem.writeAsStringAsync(zipPath, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       return zipPath;
//     }

//     showSheet("Export ZIP", [
//       { label: Platform.OS === "android" ? "Save to Downloads" : "Save to Files", icon: "💾", onPress: async () => { setBusy("export"); try { const path = await buildZip(); await saveOrShareZip(path, fname, (t, m) => showAlert(t, m)); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Share…", icon: "📤", onPress: async () => { setBusy("export"); try { const path = await buildZip(); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "application/zip", dialogTitle: "Export LessonVault" }); else showAlert("Not available", "Sharing is not available on this device."); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   // ── IMPORT ────────────────────────────────────────────────────────────────
//   async function importZip() {
//     setBusy("import");
//     try {
//       const res = await DocumentPicker.getDocumentAsync({ type: "application/zip", copyToCacheDirectory: true });
//       if (res.canceled) { setBusy(null); return; }
//       const zipB64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
//       if (!zipB64) { showAlert("Import Error", "Could not read the zip file."); return; }
//       const zip = await JSZip.loadAsync(zipB64, { base64: true });
//       const mf = zip.file("manifest.json"); if (!mf) { showAlert("Import Error", "No manifest.json found."); return; }
//       const manifest = JSON.parse(await mf.async("string")); const db = await getDb(); let imported = 0;
//       for (const y of manifest.years) {
//         let yr = await db.getFirstAsync<Year>("SELECT * FROM years WHERE name=?", [y.name]); let yid = yr ? yr.id : (await db.runAsync("INSERT INTO years (name) VALUES (?)", [y.name])).lastInsertRowId;
//         for (const s of y.semesters) {
//           let sr = await db.getFirstAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND name=?", [yid, s.name]); let sid = sr ? sr.id : (await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s.name])).lastInsertRowId;
//           for (const sub of (s.subjects || [])) {
//             let subr = await db.getFirstAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? AND name=?", [sid, sub.name]); let subid = subr ? subr.id : (await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [sid, sub.name])).lastInsertRowId;
//             // Two-pass import: first create all lessons (folders first so their new IDs exist),
//             // then fix up image_uri FC: references to remap old IDs to new IDs.
//             const allLessons: any[] = sub.lessons || [];
//             // oldId -> newId mapping for this subject's lessons
//             const idMap: Record<number, number> = {};
//             // Pass 1: insert lessons in order (folders before their children since they were inserted first)
//             // Sort: folders with no FC: parent come first, then by created_at
//             const sorted = [...allLessons].sort((a, b) => {
//               const aIsRootFolder = a.is_folder && (!a.image_uri || !a.image_uri.startsWith("FC:"));
//               const bIsRootFolder = b.is_folder && (!b.image_uri || !b.image_uri.startsWith("FC:"));
//               if (aIsRootFolder && !bIsRootFolder) return -1;
//               if (!aIsRootFolder && bIsRootFolder) return 1;
//               return 0;
//             });
//             for (const l of sorted) {
//               try {
//                 if (l.is_folder) {
//                   // Folders: insert with null image_uri first, fix up after idMap is built
//                   const r = await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,1)", [subid, l.name, null]);
//                   idMap[l.id] = Number(r.lastInsertRowId); imported++;
//                 } else {
//                   // Photos: find the file in zip by old lesson id
//                   let realUri = l.image_uri || "";
//                   while (realUri.startsWith("FC:")) realUri = realUri.replace(/^FC:\d+:/, "");
//                   if (!realUri || realUri === "__folder__") continue;
//                   const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
//                   const file = zip.file(`files/${l.id}.${ext}`);
//                   if (!file) continue;
//                   const b64 = await file.async("base64"); if (!b64) continue;
//                   const dir = FileSystem.documentDirectory + `LessonVault/${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/`;
//                   await ensureDir(dir);
//                   const dest = `${dir}${slug(l.name)}_${Date.now()}_${l.id}.${ext}`;
//                   await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
//                   // Store with placeholder image_uri; we'll remap FC: ids in pass 2
//                   const r = await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,0)", [subid, l.name, dest]);
//                   idMap[l.id] = Number(r.lastInsertRowId); imported++;
//                 }
//               } catch {}
//             }
//             // Pass 2: fix up image_uri for all lessons that had a FC:<oldId>: prefix
//             for (const l of allLessons) {
//               const newId = idMap[l.id]; if (!newId) continue;
//               if (!l.image_uri) continue;
//               // Rebuild the image_uri by remapping each FC:<oldId> segment to FC:<newId>
//               // image_uri format: FC:<parentId>:<realPathOrFolderMarker>
//               // For photos directly in a root folder: FC:<folderId>:<realPath>
//               // For sub-folder marker: FC:<parentFolderId>:__folder__
//               // For photos in sub-folders: FC:<subFolderId>:<realPath>
//               // Strategy: replace all FC:<oldId>: occurrences using idMap
//               let newUri = l.image_uri;
//               // Replace each FC:<oldId>: with FC:<newId>: using the idMap
//               newUri = newUri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                 const mapped = idMap[Number(oid)];
//                 return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//               });
//               // For photos: also update the real file path portion (it now points to the newly written dest)
//               // We stored dest directly for photos, but if there's a FC: wrapper we need to keep prefix + dest
//               if (!l.is_folder) {
//                 // The dest we wrote is already the correct final path; we just need the correct FC: prefix chain
//                 // Extract prefix chain (everything up to and including the last FC:<id>:)
//                 const prefixMatch = l.image_uri.match(/^((?:FC:\d+:)+)/);
//                 if (prefixMatch) {
//                   // Remap prefix, then append the new dest path for this lesson
//                   const newPrefix = prefixMatch[1].replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                     const mapped = idMap[Number(oid)]; return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//                   });
//                   // Find the dest we wrote by looking it up from the newly inserted row
//                   const row = await db.getFirstAsync<Lesson>("SELECT * FROM lessons WHERE id=?", [newId]);
//                   if (row && row.image_uri && !row.image_uri.startsWith("FC:")) {
//                     newUri = newPrefix + row.image_uri;
//                   }
//                 }
//               }
//               await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
//             }
//             // Pass 3: fix folder image_uri (root folders had null; sub-folders had FC:<parentId>:__folder__)
//             for (const l of allLessons) {
//               if (!l.is_folder) continue;
//               const newId = idMap[l.id]; if (!newId) continue;
//               if (!l.image_uri) continue; // root folder stays null
//               // Remap FC: parent id
//               const newUri = l.image_uri.replace(/FC:(\d+):/g, (_: string, oid: string) => {
//                 const mapped = idMap[Number(oid)]; return mapped ? `FC:${mapped}:` : `FC:${oid}:`;
//               });
//               await db.runAsync("UPDATE lessons SET image_uri=? WHERE id=?", [newUri, newId]);
//             }
//           }
//         }
//       }
//       showAlert("Import Complete", `${imported} item(s) imported successfully.`); load();
//     } catch (e) { showAlert("Import Error", String(e)); } finally { setBusy(null); }
//   }

//   if (activeYear) return <YearScreen year={activeYear} onBack={() => setActiveYear(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <StatusBar barStyle={colors.statusBar} />
//       <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//         <Row>
//           <Text style={{ flex: 1, color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>📚 LessonVault</Text>
//           <TouchableOpacity onPress={() => setColorMode(colorMode === "dark" ? "light" : "dark")} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
//           </TouchableOpacity>
//         </Row>
//         <Row gap={8} wrap style={{ marginTop: 14 }}>
//           <Btn label={busy === "export" ? "Exporting…" : "Export ZIP"} onPress={exportZip} variant="outline" small icon="📤" disabled={busy !== null} />
//           <Btn label={busy === "import" ? "Importing…" : "Import ZIP"} onPress={importZip} variant="outline" small icon="📥" disabled={busy !== null} />
//           <View style={{ flex: 1 }} />
//           <Btn label="+ Year" onPress={() => setShowAdd(true)} small icon="📁" />
//         </Row>
//       </View>
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: insets.bottom + 24 }}>
//         <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{years.length} Year{years.length !== 1 ? "s" : ""}</Text>
//         {years.map(year => (
//           <TouchableOpacity key={year.id} onPress={() => setActiveYear(year)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 16 }}>
//             <View style={{ backgroundColor: colors.accent + "1A", borderRadius: 14, padding: 10 }}><Text style={{ fontSize: 24 }}>🗂️</Text></View>
//             <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{year.name}</Text><Text style={{ color: colors.textSub, fontSize: 12, marginTop: 2 }}>{new Date(year.created_at).toLocaleDateString()}</Text></View>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(year.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditYear(year) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Year Content", `Delete all semesters and everything inside "${year.name}"? The year itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); } await db.runAsync("DELETE FROM semesters WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Year", icon: "🗑️", style: "destructive", onPress: () => confirmDeleteYear(year) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {years.length === 0 && <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}><Text style={{ fontSize: 56 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 16, textAlign: "center" }}>No years yet.{"\n"}Tap "+ Year" to get started.</Text></View>}
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Year" placeholder="e.g. 2nd Year" onConfirm={v => { setShowAdd(false); addYear(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editYear} title="Rename Year" initial={editYear?.name} onConfirm={v => editYear && renameYear(editYear, v)} onCancel={() => setEditYear(null)} />
//     </View>
//   );
// }

// // ─── THEME PROVIDER ───────────────────────────────────────────────────────────
// const THEME_KEY = "lessonvault_theme_v2";
// function ThemeProvider({ children }: { children: React.ReactNode }) {
//   const sys = useColorScheme(); const [colorMode, setModeState] = useState<ColorMode>("system"); const [loaded, setLoaded] = useState(false);
//   useEffect(() => { AsyncStorage.getItem(THEME_KEY).then(v => { if (v === "light" || v === "dark") setModeState(v as ColorMode); setLoaded(true); }); }, []);
//   const setColorMode = useCallback((m: ColorMode) => { setModeState(m); if (m === "light" || m === "dark") AsyncStorage.setItem(THEME_KEY, m); else AsyncStorage.removeItem(THEME_KEY); }, []);
//   const isDark = colorMode === "dark" || (colorMode === "system" && sys === "dark"); const colors = isDark ? DARK : LIGHT;
//   if (!loaded) return null;
//   return <ThemeContext.Provider value={{ colors, colorMode, setColorMode, isDark }}>{children}</ThemeContext.Provider>;
// }

// export default function Index() {
//   return (
//     <ThemeProvider>
//       <AlertProvider>
//         <SheetProvider>
//           <HomeScreen />
//         </SheetProvider>
//       </AlertProvider>
//     </ThemeProvider>
//   );
// }







// /**
//  * LessonVault — School Lesson Manager
//  * PASTE AS: app/index.tsx
//  */

// import AsyncStorage from "@react-native-async-storage/async-storage";
// import * as DocumentPicker from "expo-document-picker";
// import * as FileSystem from "expo-file-system/legacy";
// import * as ImagePicker from "expo-image-picker";
// import * as MediaLibrary from "expo-media-library";
// import * as Sharing from "expo-sharing";
// import * as SQLite from "expo-sqlite";
// import JSZip from "jszip";
// import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
// import { Animated, BackHandler, Dimensions, FlatList, Image, Modal, PanResponder, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// type ColorMode = "light" | "dark" | "system";
// interface Year { id: number; name: string; created_at: string }
// interface Semester { id: number; year_id: number; name: string; created_at: string }
// interface Subject { id: number; semester_id: number; name: string; created_at: string }
// interface Lesson { id: number; subject_id: number; name: string; image_uri: string | null; is_folder: number; created_at: string }

// const LIGHT = { bg: "#F5F4F0", surface: "#FFFFFF", surfaceAlt: "#EDEDEA", border: "#DDDDD8", text: "#1A1917", textSub: "#7A7874", accent: "#2563EB", accentText: "#FFFFFF", danger: "#DC2626", dangerBg: "#FEF2F2", card: "#FAFAF8", overlay: "rgba(0,0,0,0.5)", statusBar: "dark-content" as const };
// const DARK = { bg: "#111110", surface: "#1C1C1A", surfaceAlt: "#252523", border: "#333330", text: "#F2F0EB", textSub: "#888884", accent: "#3B82F6", accentText: "#FFFFFF", danger: "#EF4444", dangerBg: "#2D1515", card: "#161614", overlay: "rgba(0,0,0,0.72)", statusBar: "light-content" as const };

// interface ThemeCtx { colors: typeof LIGHT; colorMode: ColorMode; setColorMode: (m: ColorMode) => void; isDark: boolean }
// const ThemeContext = createContext<ThemeCtx>({ colors: DARK, colorMode: "system", setColorMode: () => {}, isDark: true });
// const useTheme = () => useContext(ThemeContext);

// interface AlertBtn { label: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }
// const AlertCtx = createContext<{ showAlert: (t: string, m?: string, b?: AlertBtn[]) => void }>({ showAlert: () => {} });
// const useAlert = () => useContext(AlertCtx);

// function AlertProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const [st, setSt] = useState<{ visible: boolean; title: string; message?: string; buttons: AlertBtn[] }>({ visible: false, title: "", buttons: [] });
//   const showAlert = useCallback((title: string, message?: string, buttons: AlertBtn[] = [{ label: "OK" }]) => setSt({ visible: true, title, message, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <AlertCtx.Provider value={{ showAlert }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="fade">
//         <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
//           <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: st.message ? 8 : 20 }}>{st.title}</Text>
//             {st.message && <Text style={{ color: colors.textSub, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 20 }}>{st.message}</Text>}
//             <View style={{ gap: 8 }}>
//               {st.buttons.map((b, i) => (
//                 <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress?.(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.danger : b.style === "cancel" ? colors.surfaceAlt : colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: "center", borderWidth: b.style === "cancel" ? 1 : 0, borderColor: colors.border }}>
//                   <Text style={{ color: b.style === "cancel" ? colors.text : "#fff", fontWeight: b.style === "cancel" ? "500" : "700", fontSize: 15 }}>{b.label}</Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </AlertCtx.Provider>
//   );
// }

// interface SheetBtn { label: string; icon?: string; onPress: () => void; style?: "destructive" | "cancel" }
// const SheetCtx = createContext<{ showSheet: (t?: string, b?: SheetBtn[]) => void }>({ showSheet: () => {} });
// const useSheet = () => useContext(SheetCtx);

// function SheetProvider({ children }: { children: React.ReactNode }) {
//   const { colors } = useTheme();
//   const insets = useSafeAreaInsets();
//   const [st, setSt] = useState<{ visible: boolean; title?: string; buttons: SheetBtn[] }>({ visible: false, buttons: [] });
//   const showSheet = useCallback((title?: string, buttons: SheetBtn[] = []) => setSt({ visible: true, title, buttons }), []);
//   const dismiss = () => setSt(s => ({ ...s, visible: false }));
//   return (
//     <SheetCtx.Provider value={{ showSheet }}>
//       {children}
//       <Modal visible={st.visible} transparent animationType="slide">
//         <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay }} activeOpacity={1} onPress={dismiss} />
//         <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 20 + insets.bottom, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
//           {st.title && <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>{st.title}</Text>}
//           {st.buttons.map((b, i) => (
//             <TouchableOpacity key={i} onPress={() => { dismiss(); b.onPress(); }} activeOpacity={0.78} style={{ backgroundColor: b.style === "destructive" ? colors.dangerBg : colors.surfaceAlt, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
//               {b.icon && <Text style={{ fontSize: 20 }}>{b.icon}</Text>}
//               <Text style={{ color: b.style === "destructive" ? colors.danger : colors.text, fontSize: 16, fontWeight: b.style === "cancel" ? "500" : "600" }}>{b.label}</Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </Modal>
//     </SheetCtx.Provider>
//   );
// }

// let _db: SQLite.SQLiteDatabase | null = null;
// const DB_SCHEMA = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS years (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name TEXT NOT NULL, image_uri TEXT, is_folder INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`;
// async function getDb(): Promise<SQLite.SQLiteDatabase> {
//   if (_db) { try { await _db.getFirstAsync("SELECT 1"); return _db; } catch { _db = null; } }
//   _db = await SQLite.openDatabaseAsync("lessonvault3.db");
//   await _db.execAsync(DB_SCHEMA);
//   return _db;
// }

// async function seedDefault() {
//   const db = await getDb();
//   const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM years");
//   if (row && row.count > 0) return;
//   const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", ["Current-Year"]);
//   const yid = r.lastInsertRowId;
//   for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id, name) VALUES (?,?)", [yid, s]);
// }

// function slug(s: string) { return s.replace(/[^a-zA-Z0-9_-]/g, "_"); }
// async function ensureDir(path: string) { const info = await FileSystem.getInfoAsync(path); if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true }); }

// async function copyImage(uri: string, yearName: string, semName: string, subName: string, label: string) {
//   const dir = FileSystem.documentDirectory + `LessonVault/${slug(yearName)}/${slug(semName)}/${slug(subName)}/`;
//   await ensureDir(dir);
//   const cleanUri = uri.split("?")[0]; const rawExt = cleanUri.split(".").pop()?.toLowerCase() || "jpg"; const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(rawExt) ? rawExt : "jpg";
//   const dest = `${dir}${slug(label)}_${Date.now()}.${safeExt}`;
//   await FileSystem.copyAsync({ from: uri, to: dest }); return dest;
// }

// async function pickCamera() {
//   const { status } = await ImagePicker.requestCameraPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGallery(): Promise<string | null> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return null;
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: false });
//   return r.canceled ? null : r.assets[0].uri;
// }

// async function pickGalleryMultiple(): Promise<string[]> {
//   const { status } = await MediaLibrary.requestPermissionsAsync();
//   if (status !== "granted") return [];
//   const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
//   return r.canceled ? [] : r.assets.map(a => a.uri);
// }

// // ── Save ZIP to Downloads on Android using SAF, share on iOS ─────────────────
// async function saveOrShareZip(zipPath: string, fname: string, showAlert: (t: string, m?: string) => void) {
//   if (Platform.OS === "android") {
//     try {
//       // Android 10+ (API 29+): use StorageAccessFramework to write directly to Downloads
//       const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
//       if (!permissions.granted) {
//         // User cancelled SAF picker — fallback to share
//         if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" }); }
//         else { showAlert("Cancelled", "No download location selected."); }
//         return;
//       }
//       // Create file in the chosen directory
//       const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fname, "application/zip");
//       const zipB64 = await FileSystem.readAsStringAsync(zipPath, { encoding: FileSystem.EncodingType.Base64 });
//       await FileSystem.StorageAccessFramework.writeAsStringAsync(destUri, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       showAlert("Saved", `ZIP saved as ${fname}`);
//     } catch (e: any) {
//       // Fallback: share sheet
//       try {
//         if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save ZIP" });
//         else showAlert("Error", String(e));
//       } catch (e2) { showAlert("Error", String(e2)); }
//     }
//   } else {
//     if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "Save to Files" });
//     else showAlert("Not available", "Sharing is not available on this device.");
//   }
// }

// function Btn({ label, onPress, variant = "primary", small = false, icon, disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "danger" | "ghost" | "outline"; small?: boolean; icon?: string; disabled?: boolean }) {
//   const { colors } = useTheme();
//   const bg = variant === "primary" ? colors.accent : variant === "danger" ? colors.danger : "transparent";
//   const tc = variant === "primary" || variant === "danger" ? "#fff" : variant === "outline" ? colors.accent : colors.text;
//   return (
//     <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} style={{ backgroundColor: disabled ? colors.surfaceAlt : bg, borderColor: variant === "outline" ? colors.accent : "transparent", borderWidth: variant === "outline" ? 1.5 : 0, borderRadius: 10, paddingHorizontal: small ? 12 : 18, paddingVertical: small ? 7 : 11, flexDirection: "row", alignItems: "center", gap: 5, opacity: disabled ? 0.5 : 1 }}>
//       {icon && <Text style={{ fontSize: small ? 14 : 16 }}>{icon}</Text>}
//       <Text style={{ color: disabled ? colors.textSub : tc, fontWeight: "600", fontSize: small ? 13 : 15 }}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// function Row({ children, gap = 8, wrap = false }: { children: React.ReactNode; gap?: number; wrap?: boolean }) { return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>; }

// function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
//   const { colors } = useTheme(); const insets = useSafeAreaInsets();
//   return (
//     <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//       {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 6, alignSelf: "flex-start" }}><Text style={{ color: colors.accent, fontSize: 16 }}>← Back</Text></TouchableOpacity>}
//       <Row><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: onBack ? 22 : 26, fontWeight: "900", letterSpacing: -0.4 }}>{title}</Text>{subtitle && <Text style={{ color: colors.textSub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}</View>{right}</Row>
//     </View>
//   );
// }

// function NameModal({ visible, title, initial, placeholder, onConfirm, onCancel }: { visible: boolean; title: string; initial?: string; placeholder?: string; onConfirm: (v: string) => void; onCancel: () => void }) {
//   const { colors } = useTheme(); const [val, setVal] = useState(initial || "");
//   useEffect(() => setVal(initial || ""), [visible, initial]);
//   return (
//     <Modal visible={visible} transparent animationType="fade">
//       <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
//         <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
//           <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 14 }}>{title}</Text>
//           <TextInput value={val} onChangeText={setVal} placeholder={placeholder || "Name…"} placeholderTextColor={colors.textSub} autoFocus style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 18, borderWidth: 1, borderColor: colors.border }} />
//           <Row gap={10}><Btn label="Cancel" onPress={onCancel} variant="ghost" /><View style={{ flex: 1 }} /><Btn label="Confirm" onPress={() => { if (val.trim()) onConfirm(val.trim()); }} /></Row>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// // ─── ZOOMABLE IMAGE — fixed sensitivity ───────────────────────────────────────
// // Key changes:
// //  • Pinch scale uses a dampening factor (0.65) so fast finger spreads don't jump
// //  • MIN_SCALE = 1, MAX_SCALE = 5 (was 0.5–8)
// //  • Translation clamping applied immediately during move
// function ZoomableImage({ uri }: { uri: string }) {
//   const [dims, setDims] = useState({ w: Dimensions.get("window").width, h: Dimensions.get("window").height });

//   const currentScale = useRef(1);
//   const currentTx = useRef(0);
//   const currentTy = useRef(0);

//   const scaleAnim = useRef(new Animated.Value(1)).current;
//   const txAnim = useRef(new Animated.Value(0)).current;
//   const tyAnim = useRef(new Animated.Value(0)).current;

//   const pinchStartDist = useRef(0);
//   const pinchStartScale = useRef(1);
//   const panStartTx = useRef(0);
//   const panStartTy = useRef(0);
//   const lastTapTime = useRef(0);
//   const lastTapX = useRef(0);
//   const lastTapY = useRef(0);
//   const isPinching = useRef(false);

//   const MIN_SCALE = 1;
//   const MAX_SCALE = 5;
//   // Dampening: how aggressively pinch maps to scale change. Lower = less sensitive.
//   const PINCH_DAMPEN = 0.65;
//   // Pan dampening: multiplier on drag distance. Lower = slower pan movement.
//   const PAN_DAMPEN = 0.4;

//   function getTouchDist(touches: any[]) {
//     const dx = touches[0].pageX - touches[1].pageX; const dy = touches[0].pageY - touches[1].pageY;
//     return Math.sqrt(dx * dx + dy * dy);
//   }

//   function clampTranslation(tx: number, ty: number, scale: number) {
//     const maxTx = Math.max(0, (dims.w * (scale - 1)) / 2);
//     const maxTy = Math.max(0, (dims.h * (scale - 1)) / 2);
//     return { tx: Math.min(maxTx, Math.max(-maxTx, tx)), ty: Math.min(maxTy, Math.max(-maxTy, ty)) };
//   }

//   function applyTransform(scale: number, tx: number, ty: number, animated = false) {
//     const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
//     const clamped = clampTranslation(tx, ty, s);
//     currentScale.current = s; currentTx.current = clamped.tx; currentTy.current = clamped.ty;
//     if (animated) {
//       Animated.parallel([
//         Animated.spring(scaleAnim, { toValue: s, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(txAnim, { toValue: clamped.tx, useNativeDriver: true, tension: 120, friction: 10 }),
//         Animated.spring(tyAnim, { toValue: clamped.ty, useNativeDriver: true, tension: 120, friction: 10 }),
//       ]).start();
//     } else {
//       scaleAnim.setValue(s); txAnim.setValue(clamped.tx); tyAnim.setValue(clamped.ty);
//     }
//   }

//   function resetZoom(animated = true) { applyTransform(1, 0, 0, animated); }

//   function doubleTapZoom(tapX: number, tapY: number) {
//     if (currentScale.current > 1.5) { resetZoom(true); return; }
//     const newScale = 2.5;
//     const tx = (dims.w / 2 - tapX) * (newScale - 1);
//     const ty = (dims.h / 2 - tapY) * (newScale - 1);
//     applyTransform(newScale, tx, ty, true);
//   }

//   const panResponder = useRef(PanResponder.create({
//     onStartShouldSetPanResponder: () => true,
//     onMoveShouldSetPanResponder: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) return true;
//       return currentScale.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
//     },
//     onPanResponderGrant: (e) => {
//       const touches = e.nativeEvent.touches;
//       isPinching.current = touches.length >= 2;
//       if (touches.length >= 2) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; }
//       panStartTx.current = currentTx.current; panStartTy.current = currentTy.current;
//     },
//     onPanResponderMove: (e, g) => {
//       const touches = e.nativeEvent.touches;
//       if (touches.length >= 2) {
//         isPinching.current = true;
//         if (pinchStartDist.current === 0) { pinchStartDist.current = getTouchDist(Array.from(touches)); pinchStartScale.current = currentScale.current; return; }
//         const dist = getTouchDist(Array.from(touches));
//         const rawRatio = dist / pinchStartDist.current;
//         // Apply dampening: interpolate ratio toward 1 to reduce sensitivity
//         const dampenedRatio = 1 + (rawRatio - 1) * PINCH_DAMPEN;
//         const newScale = pinchStartScale.current * dampenedRatio;
//         applyTransform(newScale, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       } else if (!isPinching.current && currentScale.current > 1) {
//         applyTransform(currentScale.current, panStartTx.current + g.dx * PAN_DAMPEN, panStartTy.current + g.dy * PAN_DAMPEN, false);
//       }
//     },
//     onPanResponderRelease: (e, g) => {
//       const wasPinching = isPinching.current;
//       isPinching.current = false; pinchStartDist.current = 0;
//       if (currentScale.current <= 1.05) { resetZoom(true); return; }
//       // Snap into bounds
//       const { tx, ty } = clampTranslation(currentTx.current, currentTy.current, currentScale.current);
//       if (tx !== currentTx.current || ty !== currentTy.current) applyTransform(currentScale.current, tx, ty, true);
//       // Double-tap
//       if (!wasPinching && Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
//         const now = Date.now();
//         const x = e.nativeEvent.changedTouches[0]?.pageX ?? dims.w / 2;
//         const y = e.nativeEvent.changedTouches[0]?.pageY ?? dims.h / 2;
//         if (now - lastTapTime.current < 280 && Math.abs(x - lastTapX.current) < 40 && Math.abs(y - lastTapY.current) < 40) { lastTapTime.current = 0; doubleTapZoom(x, y); }
//         else { lastTapTime.current = now; lastTapX.current = x; lastTapY.current = y; }
//       }
//     },
//     onPanResponderTerminationRequest: () => false,
//   })).current;

//   return (
//     <View style={{ flex: 1 }} onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
//       <Animated.Image source={{ uri }} {...panResponder.panHandlers} style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateX: txAnim }, { translateY: tyAnim }] }} resizeMode="contain" />
//     </View>
//   );
// }

// function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
//   const insets = useSafeAreaInsets();
//   if (!uri) return null;
//   return (
//     <Modal visible animationType="fade" statusBarTranslucent>
//       <View style={{ flex: 1, backgroundColor: "#000" }}>
//         <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: insets.top + 10, right: 18, zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 22, width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
//           <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
//         </TouchableOpacity>
//         <ZoomableImage uri={uri} />
//         <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 12, paddingBottom: insets.bottom + 12 }}>Pinch or double-tap to zoom</Text>
//       </View>
//     </Modal>
//   );
// }

// // ─── FOLDER LESSONS SCREEN — infinite nesting ────────────────────────────────
// // Items belonging to a folder use image_uri = `FC:<folderId>:<realPath>` for photos
// // and image_uri = `FC:<folderId>:__folder__` + is_folder=1 for sub-folders.
// // Each level only shows items whose image_uri starts with `FC:<thisFolder.id>:`.
// // Opening a sub-folder just renders another FolderLessonsScreen on top — infinite depth.
// function FolderLessonsScreen({ folder, subject, semesterName, yearName, onBack, breadcrumb }: { folder: Lesson; subject: Subject; semesterName: string; yearName: string; onBack: () => void; breadcrumb?: string }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null); const [viewUri, setViewUri] = useState<string | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openSubFolder, setOpenSubFolder] = useState<Lesson | null>(null);

//   const PREFIX = `FC:${folder.id}:`;

//   const load = useCallback(async () => {
//     const db = await getDb();
//     const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]);
//     // Direct children: image_uri starts with FC:<folder.id>: AND the rest contains no further FC: prefix
//     // (sub-folder children use FC:<subFolderId>: so they won't match this folder's prefix)
//     setLessons(all.filter(l => l.image_uri?.startsWith(PREFIX)));
//   }, [subject.id, folder.id]);

//   useEffect(() => { load(); }, [load]);

//   useEffect(() => {
//     const handler = BackHandler.addEventListener("hardwareBackPress", () => {
//       if (openSubFolder) { setOpenSubFolder(null); load(); return true; }
//       return false;
//     });
//     return () => handler.remove();
//   }, [openSubFolder]);

//   // For photos: store as FC:<folderId>:<copiedPath>
//   async function commitPhoto(name: string, uri: string) {
//     const copied = await copyImage(uri, yearName, semesterName, subject.name, name);
//     const storedUri = `${PREFIX}${copied}`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,0)", [subject.id, name, storedUri]);
//   }
//   // For sub-folders: store as FC:<folderId>:__folder__ with is_folder=1
//   async function commitSubFolder(name: string) {
//     const storedUri = `${PREFIX}__folder__`;
//     const db = await getDb();
//     await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,1)", [subject.id, name, storedUri]);
//   }

//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitPhoto(`Photo ${lessons.length + i + 1}`, uris[i]); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitNamed(name: string, uri: string) { try { await commitPhoto(name, uri); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() {
//     showSheet("Add to " + folder.name, [
//       { label: "Quick Photos (auto-name)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) },
//       { label: "Named Photo", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) },
//       { label: "Create Sub-Folder", icon: "📁", onPress: () => { setPendingUris(["__subfolder__"]); setNameModalVis(true); } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   // Get the real file URI for a photo (strip the FC:<id>: prefix)
//   function getRealUri(l: Lesson): string | null {
//     if (!l.image_uri || l.is_folder) return null;
//     return l.image_uri.startsWith(PREFIX) ? l.image_uri.slice(PREFIX.length) : l.image_uri;
//   }

//   // Recursively delete all descendant photos then delete the lesson row
//   async function deepDelete(l: Lesson) {
//     const db = await getDb();
//     if (l.is_folder) {
//       // Delete all children of this sub-folder recursively
//       const childPrefix = `FC:${l.id}:`;
//       const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]);
//       const children = all.filter(c => c.image_uri?.startsWith(childPrefix));
//       for (const c of children) await deepDelete(c);
//     } else {
//       const real = getRealUri(l);
//       if (real) try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {}
//     }
//     await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]);
//   }

//   function confirmDelete(l: Lesson) {
//     showAlert("Delete", `Delete "${l.name}"${l.is_folder ? " and all its contents" : ""}?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { await deepDelete(l); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function confirmDeleteSelected() {
//     showAlert("Delete Selected", `Delete ${selected.size} item(s)?`, [
//       { label: "Delete", style: "destructive", onPress: async () => { for (const id of selected) { const l = lessons.find(x => x.id === id); if (l) await deepDelete(l); } setSelected(new Set()); setSelectMode(false); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function clearFolderContents(l: Lesson) {
//     showAlert("Clear Sub-Folder", `Delete all contents inside "${l.name}"? The folder itself will remain.`, [
//       { label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const childPrefix = `FC:${l.id}:`; const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(c => c.image_uri?.startsWith(childPrefix)); for (const c of children) await deepDelete(c); load(); } },
//       { label: "Cancel", style: "cancel" },
//     ]);
//   }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function openMenu(l: Lesson) {
//     const realUri = getRealUri(l);
//     showSheet(l.name, [
//       ...(realUri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => setViewUri(realUri) }] : []),
//       ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenSubFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []),
//       { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) },
//       { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) },
//       { label: "Cancel", style: "cancel" as const, onPress: () => {} },
//     ]);
//   }

//   // Recursively render sub-folder screen when one is open
//   if (openSubFolder) {
//     const bc = breadcrumb ? `${breadcrumb} › ${folder.name}` : folder.name;
//     return <FolderLessonsScreen folder={openSubFolder} subject={subject} semesterName={semesterName} yearName={yearName} breadcrumb={bc} onBack={() => { setOpenSubFolder(null); load(); }} />;
//   }

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;
//   const subtitle = breadcrumb ? `${breadcrumb} › ${folder.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}` : `📁 ${subject.name} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={folder.name} subtitle={subtitle} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>Folder is empty</Text><Btn label="+ Add" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => {
//           const isSel = selected.has(item.id); const realUri = getRealUri(item);
//           return (
//             <TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenSubFolder(item); else if (realUri) setViewUri(realUri); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>
//               {item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : realUri ? <Image source={{ uri: realUri }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" /> : <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>🖼️</Text></View>}
//               <View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>
//               {isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}
//             </TouchableOpacity>
//           );
//         }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__subfolder__" ? "Name this Sub-Folder" : "Name this Photo"} placeholder={pendingUris[0] === "__subfolder__" ? "e.g. Week 1" : "e.g. Page 1"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__subfolder__") commitSubFolder(name).then(load); else if (pendingUris.length) commitNamed(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       <ImageViewer uri={viewUri} onClose={() => setViewUri(null)} />
//     </View>
//   );
// }

// // ─── LESSONS SCREEN ───────────────────────────────────────────────────────────
// function LessonsScreen({ subject, semesterName, yearName, onBack }: { subject: Subject; semesterName: string; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [lessons, setLessons] = useState<Lesson[]>([]); const [nameModalVis, setNameModalVis] = useState(false); const [pendingUris, setPendingUris] = useState<string[]>([]); const [editLesson, setEditLesson] = useState<Lesson | null>(null); const [viewUri, setViewUri] = useState<string | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set()); const [selectMode, setSelectMode] = useState(false); const [openFolder, setOpenFolder] = useState<Lesson | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=? ORDER BY created_at DESC", [subject.id]); setLessons(all.filter(l => !l.image_uri?.startsWith("FC:"))); }, [subject.id]);
//   useEffect(() => { load(); }, [load]);

//   async function commitOne(name: string, uri: string, isFolder = false) { let storedUri: string | null = uri; if (uri && !isFolder) storedUri = await copyImage(uri, yearName, semesterName, subject.name, name); const db = await getDb(); await db.runAsync("INSERT INTO lessons (subject_id, name, image_uri, is_folder) VALUES (?,?,?,?)", [subject.id, name, storedUri, isFolder ? 1 : 0]); }
//   async function commit(name: string, uri: string | null, isFolder = false) { try { await commitOne(name, uri ?? "", isFolder); load(); } catch (e) { showAlert("Error saving", String(e)); } }
//   async function commitBatch(uris: string[]) { try { for (let i = 0; i < uris.length; i++) await commitOne(`Photo ${lessons.length + i + 1}`, uris[i], false); load(); } catch (e) { showAlert("Error saving", String(e)); } }

//   function promptSource(onUris: (uris: string[]) => void, allowMultiple = false) {
//     showSheet("Add Image", [
//       { label: "Take Photo", icon: "📷", onPress: async () => { const u = await pickCamera(); if (!u) showAlert("Permission Denied", "Camera access is required."); else onUris([u]); } },
//       { label: allowMultiple ? "Choose from Gallery (multi)" : "Choose from Gallery", icon: "🖼️", onPress: async () => { if (allowMultiple) { const uris = await pickGalleryMultiple(); if (!uris.length) showAlert("Permission Denied", "Photo library access is required."); else onUris(uris); } else { const u = await pickGallery(); if (!u) showAlert("Permission Denied", "Photo library access is required."); else onUris([u]); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   function handleAdd() { showSheet("Add to " + subject.name, [{ label: "Quick Photos (auto-name, multi)", icon: "📷", onPress: () => promptSource(uris => commitBatch(uris), true) }, { label: "Named Image Lesson", icon: "🖼️", onPress: () => promptSource(uris => { setPendingUris(uris); setNameModalVis(true); }, false) }, { label: "Create Folder Lesson", icon: "📁", onPress: () => { setPendingUris(["__folder__"]); setNameModalVis(true); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }
//   async function rename(lesson: Lesson, name: string) { const db = await getDb(); await db.runAsync("UPDATE lessons SET name=? WHERE id=?", [name, lesson.id]); setEditLesson(null); load(); }

//   function confirmDelete(l: Lesson) { showAlert("Delete Lesson", `Delete "${l.name}"?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} load(); } }, { label: "Cancel", style: "cancel" }]); }
//   function confirmDeleteSelected() { showAlert("Delete Selected", `Delete ${selected.size} lesson(s)?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); for (const id of selected) { const l = lessons.find(x => x.id === id); if (!l) continue; await db.runAsync("DELETE FROM lessons WHERE id=?", [id]); if (l.image_uri && !l.is_folder) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } setSelected(new Set()); setSelectMode(false); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function toggleSel(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
//   function selectAll() { setSelected(new Set(lessons.map(l => l.id))); }

//   function clearFolderContents(folder: Lesson) { showAlert("Clear Folder Content", `Delete all photos inside "${folder.name}"? The folder itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const all = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [subject.id]); const children = all.filter(l => l.image_uri?.startsWith(`FC:${folder.id}:`)); for (const l of children) { await db.runAsync("DELETE FROM lessons WHERE id=?", [l.id]); const real = l.image_uri!.replace(/^FC:\d+:/, ""); try { await FileSystem.deleteAsync(real, { idempotent: true }); } catch {} } load(); } }, { label: "Cancel", style: "cancel" }]); }

//   function openMenu(l: Lesson) { showSheet(l.name, [...(!l.is_folder && l.image_uri ? [{ label: "View Full Screen", icon: "🔍", onPress: () => setViewUri(l.image_uri!) }] : []), ...(l.is_folder ? [{ label: "Open Folder", icon: "📂", onPress: () => setOpenFolder(l) }, { label: "Clear Folder Content", icon: "🧹", style: "destructive" as const, onPress: () => clearFolderContents(l) }] : []), { label: "Rename", icon: "✏️", onPress: () => setEditLesson(l) }, { label: "Delete", icon: "🗑️", style: "destructive" as const, onPress: () => confirmDelete(l) }, { label: "Cancel", style: "cancel" as const, onPress: () => {} }]); }

//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (openFolder) { setOpenFolder(null); load(); return true; } return false; }); return () => handler.remove(); }, [openFolder]);

//   if (openFolder) return <FolderLessonsScreen folder={openFolder} subject={subject} semesterName={semesterName} yearName={yearName} onBack={() => { setOpenFolder(null); load(); }} />;

//   const W = Dimensions.get("window").width; const IMG = (W - 48 - 12) / 2;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={subject.name} subtitle={`${semesterName} · ${yearName} · ${lessons.length} item${lessons.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Row gap={6}>{!selectMode && <><Btn label="Select" onPress={() => setSelectMode(true)} variant="outline" small /><Btn label="+ Add" onPress={handleAdd} small /></>}{selectMode && <><Btn label={`Del (${selected.size})`} onPress={confirmDeleteSelected} variant="danger" small disabled={selected.size === 0} /><Btn label="All" onPress={selectAll} variant="outline" small /><Btn label="Done" onPress={() => { setSelectMode(false); setSelected(new Set()); }} variant="outline" small /></>}</Row>} />
//       {lessons.length === 0 ? (<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}><Text style={{ fontSize: 52 }}>📸</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No items yet</Text><Btn label="+ Add Lesson" onPress={handleAdd} /></View>) : (
//         <FlatList data={lessons} keyExtractor={i => String(i.id)} numColumns={2} contentContainerStyle={{ padding: 18, gap: 12 }} columnWrapperStyle={{ gap: 12 }} renderItem={({ item }) => { const isSel = selected.has(item.id); return (<TouchableOpacity activeOpacity={0.85} onPress={() => { if (selectMode) toggleSel(item.id); else if (item.is_folder) setOpenFolder(item); else if (item.image_uri) setViewUri(item.image_uri); }} onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSel(item.id); } }} style={{ width: IMG, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: isSel ? 2.5 : 1, borderColor: isSel ? colors.accent : colors.border }}>{item.is_folder ? <View style={{ width: IMG, height: IMG * 0.75, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 40 }}>📁</Text></View> : <Image source={{ uri: item.image_uri! }} style={{ width: IMG, height: IMG * 1.15 }} resizeMode="cover" />}<View style={{ padding: 8, flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item.name}</Text>{!selectMode && <TouchableOpacity onPress={() => openMenu(item)}><Text style={{ color: colors.textSub, fontSize: 18, paddingLeft: 6 }}>⋯</Text></TouchableOpacity>}</View>{isSel && <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>}</TouchableOpacity>); }} />
//       )}
//       <NameModal visible={nameModalVis} title={pendingUris[0] === "__folder__" ? "Name this Folder" : "Name this Lesson"} placeholder={pendingUris[0] === "__folder__" ? "e.g. Exercises" : "e.g. Chapter 3 Notes"} onConfirm={name => { setNameModalVis(false); if (pendingUris[0] === "__folder__") commit(name, null, true); else if (pendingUris.length) commit(name, pendingUris[0]); setPendingUris([]); }} onCancel={() => { setNameModalVis(false); setPendingUris([]); }} />
//       <NameModal visible={!!editLesson} title="Rename" initial={editLesson?.name} onConfirm={v => editLesson && rename(editLesson, v)} onCancel={() => setEditLesson(null)} />
//       <ImageViewer uri={viewUri} onClose={() => setViewUri(null)} />
//     </View>
//   );
// }

// // ─── SUBJECTS SCREEN ──────────────────────────────────────────────────────────
// function SubjectsScreen({ semester, yearName, onBack }: { semester: Semester; yearName: string; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [subjects, setSubjects] = useState<Subject[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSubject, setEditSubject] = useState<Subject | null>(null); const [active, setActive] = useState<Subject | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSubjects(await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? ORDER BY name ASC", [semester.id])); }, [semester.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (active) { setActive(null); return true; } return false; }); return () => handler.remove(); }, [active]);

//   async function applySubjectToOthers(name: string, scope: "all_semesters" | "all_years") { const db = await getDb(); if (scope === "all_semesters") { const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND id!=?", [semester.year_id, semester.id]); for (const s of sems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } else if (scope === "all_years") { const allSems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE name=? AND id!=?", [semester.name, semester.id]); for (const s of allSems) { const exists = await db.getFirstAsync("SELECT id FROM subjects WHERE semester_id=? AND name=?", [s.id, name]); if (!exists) await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [s.id, name]); } } }

//   function addSubjectFlow(name: string) { setShowAdd(false); showSheet("Apply to other semesters?", [{ label: "This semester only", icon: "📂", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); load(); } }, { label: "All semesters in this year", icon: "📅", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_semesters"); load(); } }, { label: "All years (same semester name)", icon: "🗂️", onPress: async () => { const db = await getDb(); await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [semester.id, name]); await applySubjectToOthers(name, "all_years"); load(); } }, { label: "Cancel", style: "cancel", onPress: () => {} }]); }

//   async function rename(sub: Subject, name: string) { const db = await getDb(); await db.runAsync("UPDATE subjects SET name=? WHERE id=?", [name, sub.id]); setEditSubject(null); load(); }

//   function confirmDelete(sub: Subject) { showAlert("Delete Subject", `Delete "${sub.name}" and all its lessons?`, [{ label: "Delete", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (active) return <LessonsScreen subject={active} semesterName={semester.name} yearName={yearName} onBack={() => setActive(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={semester.name} subtitle={`${yearName} · ${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Subject" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
//         {subjects.map(sub => (
//           <TouchableOpacity key={sub.id} onPress={() => setActive(sub)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 24 }}>📗</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sub.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sub.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSubject(sub) }, { label: "Clear All Lessons", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Lessons", `Delete all lessons in "${sub.name}"?`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM lessons WHERE subject_id=?", [sub.id]); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Subject", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sub) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {subjects.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📗</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No subjects yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Subject" placeholder="e.g. Mathematics" onConfirm={addSubjectFlow} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSubject} title="Rename Subject" initial={editSubject?.name} onConfirm={v => editSubject && rename(editSubject, v)} onCancel={() => setEditSubject(null)} />
//     </View>
//   );
// }

// // ─── YEAR SCREEN ──────────────────────────────────────────────────────────────
// function YearScreen({ year, onBack }: { year: Year; onBack: () => void }) {
//   const { colors } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const [semesters, setSemesters] = useState<Semester[]>([]); const [showAdd, setShowAdd] = useState(false); const [editSem, setEditSem] = useState<Semester | null>(null); const [activeSem, setActiveSem] = useState<Semester | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setSemesters(await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=? ORDER BY created_at ASC", [year.id])); }, [year.id]);
//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeSem) { setActiveSem(null); return true; } return false; }); return () => handler.remove(); }, [activeSem]);

//   async function add(name: string) { const db = await getDb(); await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [year.id, name]); load(); }
//   async function rename(sem: Semester, name: string) { const db = await getDb(); await db.runAsync("UPDATE semesters SET name=? WHERE id=?", [name, sem.id]); setEditSem(null); load(); }

//   async function deleteSemContent(sem: Semester) { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } await db.runAsync("DELETE FROM semesters WHERE id=?", [sem.id]); }

//   function confirmDelete(sem: Semester) { showAlert("Delete Semester", `Delete "${sem.name}" and all its content?`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteSemContent(sem); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   if (activeSem) return <SubjectsScreen semester={activeSem} yearName={year.name} onBack={() => setActiveSem(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <ScreenHeader title={year.name} subtitle={`${semesters.length} semester${semesters.length !== 1 ? "s" : ""}`} onBack={onBack} right={<Btn label="+ Semester" onPress={() => setShowAdd(true)} small />} />
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
//         {semesters.map(sem => (
//           <TouchableOpacity key={sem.id} onPress={() => setActiveSem(sem)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
//             <View style={{ backgroundColor: colors.accent + "18", borderRadius: 12, padding: 10 }}><Text style={{ fontSize: 26 }}>📂</Text></View>
//             <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{sem.name}</Text>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(sem.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditSem(sem) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Semester Content", `Delete all subjects and lessons inside "${sem.name}"? The semester itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [sem.id]); for (const s of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [s.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Semester", icon: "🗑️", style: "destructive", onPress: () => confirmDelete(sem) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {semesters.length === 0 && <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}><Text style={{ fontSize: 48 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 15 }}>No semesters yet</Text></View>}
//         <View style={{ height: 40 }} />
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Semester" placeholder="e.g. Semester 1" onConfirm={v => { setShowAdd(false); add(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editSem} title="Rename Semester" initial={editSem?.name} onConfirm={v => editSem && rename(editSem, v)} onCancel={() => setEditSem(null)} />
//     </View>
//   );
// }

// // ─── HOME SCREEN ──────────────────────────────────────────────────────────────
// function HomeScreen() {
//   const { colors, isDark, colorMode, setColorMode } = useTheme(); const { showAlert } = useAlert(); const { showSheet } = useSheet();
//   const insets = useSafeAreaInsets();
//   const [years, setYears] = useState<Year[]>([]); const [showAdd, setShowAdd] = useState(false); const [editYear, setEditYear] = useState<Year | null>(null); const [activeYear, setActiveYear] = useState<Year | null>(null); const [busy, setBusy] = useState<"export" | "import" | null>(null);

//   const load = useCallback(async () => { const db = await getDb(); setYears(await db.getAllAsync<Year>("SELECT * FROM years ORDER BY created_at DESC")); }, []);
//   useEffect(() => { seedDefault().then(load); }, [load]);
//   useEffect(() => { const handler = BackHandler.addEventListener("hardwareBackPress", () => { if (activeYear) { setActiveYear(null); return true; } return false; }); return () => handler.remove(); }, [activeYear]);

//   async function addYear(name: string) { const db = await getDb(); try { const r = await db.runAsync("INSERT INTO years (name) VALUES (?)", [name]); const yid = r.lastInsertRowId; for (const s of ["Semester 1", "Semester 2", "Semester 3"]) await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s]); load(); } catch (e: any) { if (String(e).includes("UNIQUE")) showAlert("Name Taken", "A year with that name already exists."); else showAlert("Error", String(e)); } }
//   async function renameYear(year: Year, name: string) { const db = await getDb(); await db.runAsync("UPDATE years SET name=? WHERE id=?", [name, year.id]); setEditYear(null); load(); }

//   async function deleteYearContent(year: Year) { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} } } await db.runAsync("DELETE FROM years WHERE id=?", [year.id]); }
//   function confirmDeleteYear(year: Year) { showAlert("Delete Year", `Delete "${year.name}" and all its content? This cannot be undone.`, [{ label: "Delete", style: "destructive", onPress: async () => { await deleteYearContent(year); load(); } }, { label: "Cancel", style: "cancel" }]); }

//   // ── EXPORT ────────────────────────────────────────────────────────────────
//   async function exportZip() {
//     const fname = `LessonVault_${new Date().toISOString().slice(0, 10)}.zip`;
//     const zipPath = FileSystem.cacheDirectory + fname;

//     async function buildZip(): Promise<string> {
//       const db = await getDb(); const zip = new JSZip();
//       const allYears = await db.getAllAsync<Year>("SELECT * FROM years");
//       const manifest: any = { exportedAt: new Date().toISOString(), years: [] };
//       for (const y of allYears) {
//         const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [y.id]); const semData: any[] = [];
//         for (const s of sems) {
//           const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); const subData: any[] = [];
//           for (const sub of subs) {
//             const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]);
//             for (const l of ls) { const realUri = l.image_uri?.startsWith("FC:") ? l.image_uri.replace(/^FC:\d+:/, "") : l.image_uri; if (!realUri || l.is_folder) continue; try { const info = await FileSystem.getInfoAsync(realUri); if (!info.exists) continue; const b64 = await FileSystem.readAsStringAsync(realUri, { encoding: FileSystem.EncodingType.Base64 }); if (!b64) continue; const ext = realUri.split("?")[0].split(".").pop()?.toLowerCase() || "jpg"; zip.file(`${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/${slug(l.name)}_${l.id}.${ext}`, b64, { base64: true }); } catch {} }
//             subData.push({ id: sub.id, name: sub.name, lessons: ls });
//           }
//           semData.push({ id: s.id, name: s.name, subjects: subData });
//         }
//         manifest.years.push({ id: y.id, name: y.name, semesters: semData });
//       }
//       zip.file("manifest.json", JSON.stringify(manifest, null, 2));
//       const zipB64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
//       await FileSystem.writeAsStringAsync(zipPath, zipB64, { encoding: FileSystem.EncodingType.Base64 });
//       return zipPath;
//     }

//     showSheet("Export ZIP", [
//       { label: Platform.OS === "android" ? "Save to Downloads" : "Save to Files", icon: "💾", onPress: async () => { setBusy("export"); try { const path = await buildZip(); await saveOrShareZip(path, fname, (t, m) => showAlert(t, m)); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Share…", icon: "📤", onPress: async () => { setBusy("export"); try { const path = await buildZip(); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "application/zip", dialogTitle: "Export LessonVault" }); else showAlert("Not available", "Sharing is not available on this device."); } catch (e) { showAlert("Export Error", String(e)); } finally { setBusy(null); } } },
//       { label: "Cancel", style: "cancel", onPress: () => {} },
//     ]);
//   }

//   // ── IMPORT ────────────────────────────────────────────────────────────────
//   async function importZip() {
//     setBusy("import");
//     try {
//       const res = await DocumentPicker.getDocumentAsync({ type: "application/zip", copyToCacheDirectory: true });
//       if (res.canceled) { setBusy(null); return; }
//       const zipB64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
//       if (!zipB64) { showAlert("Import Error", "Could not read the zip file."); return; }
//       const zip = await JSZip.loadAsync(zipB64, { base64: true });
//       const mf = zip.file("manifest.json"); if (!mf) { showAlert("Import Error", "No manifest.json found."); return; }
//       const manifest = JSON.parse(await mf.async("string")); const db = await getDb(); let imported = 0;
//       for (const y of manifest.years) {
//         let yr = await db.getFirstAsync<Year>("SELECT * FROM years WHERE name=?", [y.name]); let yid = yr ? yr.id : (await db.runAsync("INSERT INTO years (name) VALUES (?)", [y.name])).lastInsertRowId;
//         for (const s of y.semesters) {
//           let sr = await db.getFirstAsync<Semester>("SELECT * FROM semesters WHERE year_id=? AND name=?", [yid, s.name]); let sid = sr ? sr.id : (await db.runAsync("INSERT INTO semesters (year_id,name) VALUES (?,?)", [yid, s.name])).lastInsertRowId;
//           for (const sub of (s.subjects || [])) {
//             let subr = await db.getFirstAsync<Subject>("SELECT * FROM subjects WHERE semester_id=? AND name=?", [sid, sub.name]); let subid = subr ? subr.id : (await db.runAsync("INSERT INTO subjects (semester_id,name) VALUES (?,?)", [sid, sub.name])).lastInsertRowId;
//             for (const l of (sub.lessons || [])) {
//               const cleanUri = (l.image_uri || "").replace(/^FC:\d+:/, "").split("?")[0]; const ext = cleanUri.split(".").pop()?.toLowerCase() || "jpg";
//               const zipPath = `${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/${slug(l.name)}_${l.id}.${ext}`; const file = zip.file(zipPath);
//               if (!file && !l.is_folder) continue;
//               try { if (l.is_folder) { await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,1)", [subid, l.name, null]); } else if (file) { const b64 = await file.async("base64"); if (!b64) continue; const dir = FileSystem.documentDirectory + `LessonVault/${slug(y.name)}/${slug(s.name)}/${slug(sub.name)}/`; await ensureDir(dir); const dest = `${dir}${slug(l.name)}_${Date.now()}.${ext}`; await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 }); await db.runAsync("INSERT INTO lessons (subject_id,name,image_uri,is_folder) VALUES (?,?,?,0)", [subid, l.name, dest]); } imported++; } catch {}
//             }
//           }
//         }
//       }
//       showAlert("Import Complete", `${imported} item(s) imported successfully.`); load();
//     } catch (e) { showAlert("Import Error", String(e)); } finally { setBusy(null); }
//   }

//   if (activeYear) return <YearScreen year={activeYear} onBack={() => setActiveYear(null)} />;

//   return (
//     <View style={{ flex: 1, backgroundColor: colors.bg }}>
//       <StatusBar barStyle={colors.statusBar} />
//       <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
//         <Row>
//           <Text style={{ flex: 1, color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>📚 LessonVault</Text>
//           <TouchableOpacity onPress={() => setColorMode(colorMode === "dark" ? "light" : "dark")} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border }}>
//             <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
//           </TouchableOpacity>
//         </Row>
//         <Row gap={8} wrap style={{ marginTop: 14 }}>
//           <Btn label={busy === "export" ? "Exporting…" : "Export ZIP"} onPress={exportZip} variant="outline" small icon="📤" disabled={busy !== null} />
//           <Btn label={busy === "import" ? "Importing…" : "Import ZIP"} onPress={importZip} variant="outline" small icon="📥" disabled={busy !== null} />
//           <View style={{ flex: 1 }} />
//           <Btn label="+ Year" onPress={() => setShowAdd(true)} small icon="📁" />
//         </Row>
//       </View>
//       <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: insets.bottom + 24 }}>
//         <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{years.length} Year{years.length !== 1 ? "s" : ""}</Text>
//         {years.map(year => (
//           <TouchableOpacity key={year.id} onPress={() => setActiveYear(year)} activeOpacity={0.8} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 16 }}>
//             <View style={{ backgroundColor: colors.accent + "1A", borderRadius: 14, padding: 10 }}><Text style={{ fontSize: 24 }}>🗂️</Text></View>
//             <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{year.name}</Text><Text style={{ color: colors.textSub, fontSize: 12, marginTop: 2 }}>{new Date(year.created_at).toLocaleDateString()}</Text></View>
//             <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => showSheet(year.name, [{ label: "Rename", icon: "✏️", onPress: () => setEditYear(year) }, { label: "Clear All Content", icon: "🧹", style: "destructive", onPress: () => showAlert("Clear Year Content", `Delete all semesters and everything inside "${year.name}"? The year itself will remain.`, [{ label: "Clear All", style: "destructive", onPress: async () => { const db = await getDb(); const sems = await db.getAllAsync<Semester>("SELECT * FROM semesters WHERE year_id=?", [year.id]); for (const s of sems) { const subs = await db.getAllAsync<Subject>("SELECT * FROM subjects WHERE semester_id=?", [s.id]); for (const sub of subs) { const ls = await db.getAllAsync<Lesson>("SELECT * FROM lessons WHERE subject_id=?", [sub.id]); for (const l of ls) if (l.image_uri && !l.image_uri.startsWith("FC:")) try { await FileSystem.deleteAsync(l.image_uri, { idempotent: true }); } catch {} await db.runAsync("DELETE FROM subjects WHERE id=?", [sub.id]); } await db.runAsync("DELETE FROM semesters WHERE id=?", [s.id]); } load(); } }, { label: "Cancel", style: "cancel" }]) }, { label: "Delete Year", icon: "🗑️", style: "destructive", onPress: () => confirmDeleteYear(year) }, { label: "Cancel", style: "cancel", onPress: () => {} }])}>
//               <Text style={{ color: colors.textSub, fontSize: 22 }}>⋯</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//         {years.length === 0 && <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}><Text style={{ fontSize: 56 }}>📁</Text><Text style={{ color: colors.textSub, fontSize: 16, textAlign: "center" }}>No years yet.{"\n"}Tap "+ Year" to get started.</Text></View>}
//       </ScrollView>
//       <NameModal visible={showAdd} title="New Year" placeholder="e.g. 2nd Year" onConfirm={v => { setShowAdd(false); addYear(v); }} onCancel={() => setShowAdd(false)} />
//       <NameModal visible={!!editYear} title="Rename Year" initial={editYear?.name} onConfirm={v => editYear && renameYear(editYear, v)} onCancel={() => setEditYear(null)} />
//     </View>
//   );
// }

// // ─── THEME PROVIDER ───────────────────────────────────────────────────────────
// const THEME_KEY = "lessonvault_theme_v2";
// function ThemeProvider({ children }: { children: React.ReactNode }) {
//   const sys = useColorScheme(); const [colorMode, setModeState] = useState<ColorMode>("system"); const [loaded, setLoaded] = useState(false);
//   useEffect(() => { AsyncStorage.getItem(THEME_KEY).then(v => { if (v === "light" || v === "dark") setModeState(v as ColorMode); setLoaded(true); }); }, []);
//   const setColorMode = useCallback((m: ColorMode) => { setModeState(m); if (m === "light" || m === "dark") AsyncStorage.setItem(THEME_KEY, m); else AsyncStorage.removeItem(THEME_KEY); }, []);
//   const isDark = colorMode === "dark" || (colorMode === "system" && sys === "dark"); const colors = isDark ? DARK : LIGHT;
//   if (!loaded) return null;
//   return <ThemeContext.Provider value={{ colors, colorMode, setColorMode, isDark }}>{children}</ThemeContext.Provider>;
// }

// export default function Index() {
//   return (
//     <ThemeProvider>
//       <AlertProvider>
//         <SheetProvider>
//           <HomeScreen />
//         </SheetProvider>
//       </AlertProvider>
//     </ThemeProvider>
//   );
// }


