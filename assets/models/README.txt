把你的 .glb 模型放在這裡，例如 model-1.glb、model-2.glb
然後在 index.html 的 #modelGrid 裡，把對應卡片的 data-model 改成檔名。

Blockbench：File → Export → Export glTF/glb（勾 .glb）
Blender：File → Export → glTF 2.0（格式選 glb）

建議單檔 < 5 MB，貼圖記得一起打包在 glb 裡（Blockbench 預設會）。
還沒放檔案的卡片點了會顯示「no model yet」。
