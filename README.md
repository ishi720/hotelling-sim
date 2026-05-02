# ホテリングの法則シミュレーター

## 概要

ホテリングの法則とは、競合する企業が互いに立地を近づけていく傾向を説明する経済学の原理です。

<img width="573" height="572" alt="image" src="https://github.com/user-attachments/assets/26d9de9e-70ed-40bf-be51-114aec75cacc" />


## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | [Nuxt 3](https://nuxt.com/) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 描画 | HTML5 Canvas API |

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
│   └── HotellingSimulation.vue   # シミュレーション本体
├── pages/
│   └── index.vue                 # エントリーページ
├── assets/
│   └── css/main.css              # グローバルスタイル
├── app.vue                       # ルートレイアウト
├── nuxt.config.ts
└── tailwind.config.ts
```
