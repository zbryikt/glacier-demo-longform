1版: 做出了一個工具
弄 vanilla html , 做 before.jpg after.jpg 圖片比較效果


2版: 做出了一個左右對比的 scrollytelling
現在做 scrollytelling, 左邊是 image comparison, 用 bar 分隔上下; 右邊是敘事. 幫我隨便生成約 10 段 各 500 字的冰川消溶內容. 最後, 隨著往下捲, 左邊的 bar 從下慢慢往上, reveal 新圖
左邊圖滿版不用外框.  不寫消融比例. ( 因為那其實也不精確 )

3版: 底圖式 scrolltelling
再一版, 這次不是左右並列, 而是左邊圖直接當底圖. 右方文字現在置中, 每段落背景半透明以利閱讀.
文字區塊背景要半透明  以利看圖
不要圓角與 shadow
不要 border
文字區塊間距 75 vh

4版: 局部強調
現在讓文字區塊靠右, 讓左邊 6成空間露出. 保持目前底圖效果. 
隨文字區塊的滑動, 隨機找幾個點做局部放大, 然後用紅圈框出一個點, 寫個短文字, 做為焦點. 
bar 改為可以拖動, 不隨 scroll 移動, 預設置中 (一樣是垂直, 往上/下移動模式)
ok 4. 的文本跟 html 拆開. 把資料跟html/css/js decouple, 看是要讀檔載入 render 還是怎麼做?
整個 json 能變成 markdown 嗎 (已轉為 story.md + Frontmatter)

5版: 5-ee 探索式解釋 (Explorable Explanation)
參考 ee.md, 做 5-ee/index.html 解釋探索 (包含氣溫/ELA、時間延遲、高度正回饋、質量收支矩陣與自由沙盒)

6版: 6-能源轉型與氣候變遷 (Energy Transition & Climate Calculator)
各種碳排能源 (煤/油/氣/核/風/光/水地), 消長時需要其它能源替代 (自動維護 100% 能源供需平衡)
即時算至 2050 年全球碳排減量、地球均溫變化 (ΔT) 與海平面預計上升幅度 (ΔSL), 支援 Preset 一鍵切換情境
