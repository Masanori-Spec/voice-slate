VoiceSlate / USTX 共有用コピーの準備

ZIP を展開し、index.html をデスクトップの Chrome / Chromium で開いてください。
Extract the ZIP and open index.html in desktop Chrome / Chromium. No server or account is required.

保存した .ustx を選び、クリアする設定を選択します。初期状態では何も選びません。
Choose a saved .ustx file, then explicitly select the settings to clear. Nothing is selected initially.
変更箇所・元の値を確認し、確認欄をチェックして USTX コピーを書き出します。
Review affected locations and original values, acknowledge the review, then export the USTX copy.
選択の変更や新しいファイルは、前の確認を解除します。元ファイルは変更しません。
Changing selection or input clears acknowledgment. The original file is not modified.

対象：OpenUtau 0.1.572.3-alpha / USTX 0.10 の音声パートのみ。
Scope: OpenUtau 0.1.572.3-alpha / USTX 0.10 voice parts only.
選択外のデータ、パート・音符・タイミング・歌詞・音符のピッチ点・ビブラート・定義を保持します。
Unselected data, original parts, notes, timing, lyrics, note pitch points, vibrato and expression definitions remain.
設定を変更した場合、YAML の書式・コメントは保持しません。選択なしでは元のバイト列をコピーします。
Changed output does not preserve YAML formatting/comments. With nothing selected, output is byte-identical.

匿名化ではありません。名前・歌詞・コメントや選択外の設定が残ります。
This is not anonymization. Names, lyrics, comments and unselected settings remain.
JSON レポートにも元の値が含まれます。共有する前に内容を確認してください。
The JSON report includes original affected values. Review it before sharing it.
音源の互換性、音声の再現や同一性を保証しません。
Voicebank compatibility and audio reproduction/equivalence are not guaranteed.

ファイルはこのブラウザ内で処理します。アップロード、認証、ネットワーク通信はありません。
Files are processed inside this browser. No upload, credentials or background network requests.
入力は UTF-8、最大 8 MiB。1 回の画面レビューは最大 2,000 変更です。
Input is UTF-8, up to 8 MiB. One UI review supports up to 2,000 changes.
未対応の YAML、エイリアス・アンカー、不正なデータ、wave parts は拒否します。
Unsupported YAML, aliases/anchors, invalid data and wave parts are rejected.
数値の精度をそのまま保持できない入力は、書き出す前に拒否します。丸めて処理しません。
Input whose exact numeric precision cannot be preserved is rejected before export; values are not rounded silently.
50 行ずつ確認でき、JSON と印刷にはすべての変更を含みます。
Review is paged in groups of 50 rows. JSON and print contain all affected rows.

ソースのみ。OpenUtau/.NET の実行ファイルや音源は含みません。
Source only. No OpenUtau/.NET executables or voicebanks are included.
js-yaml 5.4.2 のソースを含みます。上流の MIT 通知は web/vendor/LICENSE-js-yaml.txt にあります。
Includes js-yaml 5.4.2 source; its upstream MIT notice is web/vendor/LICENSE-js-yaml.txt.
VoiceSlate のオリジナルコードに新たなライセンスを付与するものではありません。
No original VoiceSlate code license grant is included.
Source and verification: https://github.com/Masanori-Spec/voice-slate
