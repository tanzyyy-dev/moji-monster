# コンポーネント構成

`index.html` が画面の骨格を定義し、`src/main.js` が各機能を取り付けます。HTML断片は対応するコンポーネントが Vite の `?raw` で読み込みます。共通レイアウトと CSS の読み込み順は `styles/main.css` が管理します。

| 場所 | 責務と接続 |
| --- | --- |
| `src/components/drawing-editor/` | 描画、ツール、テンプレート、画像、消去、完成カウントダウン。完成した絵は画像、または線・色・境界のスナップショットとして `onComplete(artwork, landing)` に渡す。受理されたときに用紙を初期化する。 |
| `src/components/playground/` | キャラクターの生成、操作、衝突、進行、背景・天候・花火・爆弾の描画。エディタには `isBusy()`、浮上先を決める `planLanding(hasImage)`、絵を受け取る `addArtwork(artwork, landing)` を公開する。撮影や花火が始まるとエディタにカウントダウンの取り消しを依頼する。 |
| `src/components/photo/` | 撮影の合図、フラッシュ、PNGの保存、プリント演出。遊び場から整列開始・整列確定・解除・描画のコールバックを受ける。 |
| `src/components/audio/` | BGMの再生とページの表示状態に応じた制御、Web Audioの効果音。BGM開始と各効果音の関数を公開する。 |
| `src/components/pointer-effects/` | カーソルとポインター演出。エディタと遊び場向けに `sparkle(x, y, burst)` を公開する。 |
| `src/zoom-guard.mjs` | ブラウザーの拡大操作を抑止。起動時にページと2つのキャンバスを登録する。 |

遊び場が進行を所有し、撮影や天候がキャラクターに与える影響を同じ場所で調整します。背景、キャラクターの描画、粒子・花火・爆弾の演出は、遊び場の内部モジュールに分かれています。フレームの予約は `main.js` の一か所で行い、遊び場の更新とエディタの浮上演出を呼び出します。

## 次期の描画エディタの表示切替

表示切替を追加する際は、主に `drawing-editor.html`、`drawing-editor.css`、`drawing-editor.js` を変更します。エディタはキャンバスの表示サイズを監視し、描き始めた用紙の縦横比を `paper.mjs` の等比配置で保ちます。線、塗りつぶし、読み込んだ画像は描画データとして保持し、表示用キャンバスの再確保後に描き直します。テンプレートは元の縦横比とテンプレート内の座標で再描画します。座標の変換規則を変える場合は `paper.mjs` と `tests/drawing-paper.test.mjs` も対象です。
