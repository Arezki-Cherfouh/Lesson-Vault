# 📚 LessonVault

A React Native (Expo) app for students to organize and store lesson photos by academic year, semester, and subject — with full offline storage, infinite folder nesting, and ZIP backup/restore.

---

## Features

- **4-level hierarchy** — Years → Semesters → Subjects → Lessons
- **Infinite folder nesting** — create folders inside folders at any depth
- **Photo capture** — take photos directly or import from gallery (single or multi-select)
- **Zoomable image viewer** — pinch to zoom, double-tap to fit, drag to pan
- **ZIP export/restore** — back up everything and reimport on any device, with full folder structure preserved
- **Dark / light mode** — manual toggle with system preference fallback
- **Fully offline** — SQLite database, all files stored locally in app documents

## Tech Stack

- **Expo** (React Native) · **expo-sqlite** · **expo-file-system** · **expo-image-picker**
- **JSZip** for export/import · **expo-media-library** · **react-native-safe-area-context**

## Getting Started

```bash
npm install
npx expo start
```

> Requires a real device or dev build for full camera and storage access. Some features are restricted in Expo Go.

## Project Structure

```
app/
  index.tsx   # entire app — screens, DB, theme, ZIP logic
```