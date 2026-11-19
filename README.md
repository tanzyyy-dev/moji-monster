# うかべてあそぼ

えをかいて、ふわふわ浮かべてあそぶブラウザーゲームです。Vite で開発し、ビルドした静的ファイルを配信します。

## 開発とプレビュー

Node.js 22.12 以上を推奨します（20 系は 20.19 以上）。

```sh
npm ci
npm run dev
```

Vite が表示したローカルURLを開いてください。BGMは最初の操作後に再生します。同一LAN上の iPhone や iPad で開く場合は `npm run serve` で起動し、表示された Network URL を使います。

```sh
npm run build
npm run preview
```

ビルド結果は `dist/` に出力されます。Pythonで静的配信を再現する場合は `python3 -m http.server 8000 --directory dist` を実行します。

## 公開

静的ホストの公開ディレクトリに `dist/` の中身を配置します。Vite の相対ベース `./` により、ドメイン直下とサブパスの両方で同じ成果物を配れます。

GitHub Pages では、リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定します。以降は `main` への push または Actions からの手動実行で、`.github/workflows/pages.yml` がテスト・ビルドし、`dist/` を公開します。

## あそびかた

- 画面下のキャンバスに絵をかき、色や塗り絵テンプレートを選べます。
- 写真ボタンから画像を読み込み、完成ボタンを押すと絵が画面に浮かびます。
- 浮かんだキャラクターはクリック／タップでつかんでドラッグできます。近づいたキャラクター同士は反応して離れ、ときどきジャンプやダンスもします。
- 爆弾ボタンを押してキャラクターを選ぶと、10秒後に弾けます。
- カメラボタンで画面を画像として保存し、戻る矢印で最初から遊べます。

## コードの入口

`index.html` が画面の配置を定義し、`src/main.js` が機能の初期化と接続を行います。機能を変更するときは `src/components/` 内の該当ディレクトリから確認してください。[責務と公開API](docs/COMPONENTS.md)

## テスト

```sh
npm test
npm run build
```

Node.js の標準テストでブラウザーの拡大操作を抑止する処理と描画面の等比配置を検証します。既存の Python 静的サーバーのテストも同じコマンドで実行されるため、テストには Python 3 が必要です。

## 音源

BGMの `assets/audio/Through_the_Garden_Gate.mp3` はGeminiで生成した音源です。生成に使ったモデル、プロンプト、生成日時はリポジトリに記録されていません。素材の記録と権利上の扱いは [docs/ASSETS.md](docs/ASSETS.md) を参照してください。

## 権利と利用条件

このリポジトリは公開されていますが、公開は再利用の許諾を意味しません。Gemini生成音源を除く本プロジェクトのコード、文章、デザインおよびプロジェクト独自素材は、著作権者の事前の書面による許可なく複製、改変、再配布、商用利用できません。詳細は [LICENSE.md](LICENSE.md) を参照してください。
