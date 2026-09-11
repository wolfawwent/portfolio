把你的 .glb 模型放在這裡，例如 sample.glb
然後在 index.html 找到 <div id="viewer" data-model="assets/models/sample.glb">
改成你的檔名即可。

Blockbench：File → Export → Export glTF/glb（勾 Binary / .glb）
Blender：File → Export → glTF 2.0（格式選 glb）

建議單檔 < 5 MB，貼圖記得一起打包在 glb 裡。
沒有檔案時網頁會顯示內建的體素小鴨。
