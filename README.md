# ホテリングの法則シミュレーター

## バッジ

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/88b9c1a9dace468591939289dd12c6c4)](https://app.codacy.com/gh/ishi720/hotelling-sim/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

## 概要

ホテリングの法則とは、競合する企業が互いに立地を近づけていく傾向を説明する経済学の原理です。
このツールでは **1次元・2次元・3次元** の空間でその挙動をインタラクティブにシミュレーションできます。

<img width="573" height="572" alt="image" src="https://github.com/user-attachments/assets/26d9de9e-70ed-40bf-be51-114aec75cacc" />

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | [Nuxt 3](https://nuxt.com/) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 描画（2D/1D） | HTML5 Canvas API |
| 描画（3D） | [Three.js](https://threejs.org/) |

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 開発サーバーの起動（http://localhost:3000）
npm run dev
```

## コマンド一覧

```bash
npm run dev       # 開発サーバーの起動
npm run build     # プロダクション用ビルド
npm run generate  # 静的サイトの生成
npm run preview   # プロダクションビルドのプレビュー
```

## ディレクトリ構成

```
hotelling-sim/
├── components/
│   ├── HotellingSimulation1D.vue   # 1Dシミュレーション
│   ├── HotellingSimulation2D.vue   # 2Dシミュレーション
│   └── HotellingSimulation3D.vue   # 3Dシミュレーション
├── pages/
│   ├── index.vue                   # 2Dページへリダイレクト
│   ├── 1d.vue                      # 1Dページ
│   ├── 2d.vue                      # 2Dページ
│   └── 3d.vue                      # 3Dページ
├── assets/
│   └── css/main.css
├── app.vue                         # ルートレイアウト・ナビゲーション
├── nuxt.config.ts
└── tailwind.config.ts
```
