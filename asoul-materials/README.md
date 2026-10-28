# A-SOUL 素材站

一个粉丝自发的 **A-SOUL 素材归档站**：收集表情包、官方立绘、壁纸与音乐作品索引。

收录范围为 **5 位现役成员** —— 贝拉、嘉然、乃琳、心宜、思诺；
已退团 / 休眠的成员（向晚、珈乐）以及非 A-SOUL 成员的来芙，**不在收录范围内**。

---

## 快速开始

**推荐：用本地服务打开**（这样「导入后台」的保存功能才可用）

```bash
# macOS / Linux
./start.sh            # 默认 8080 端口
./start.sh 9000       # 自定义端口
```

```bat
:: Windows
双击 start.bat
```

然后浏览器访问 <http://localhost:8080/>

> 直接双击 `index.html` 也能浏览全部内置素材，但浏览器在 `file://` 协议下会禁用 IndexedDB，
> 导致导入后台无法保存。所以想用导入功能请走上面的启动脚本。

---

## 内置素材

| 类型 | 数量 | 来源 |
| --- | --- | --- |
| 表情包 / 装扮表情 | 205 | [stormyyd/asoul-sticker](https://github.com/stormyyd/asoul-sticker)（GitHub 公开仓库） |
| 图片（官方立绘 / 服设三视图 / 专辑封面 / 标识 / 截图） | 122 | [萌娘百科](https://mzh.moegirl.org.cn/A-SOUL) · [urlyy/asoul_gallery](https://github.com/urlyy/asoul_gallery) |
| 曲目索引 | 23 | 公开资料整理（不含音频文件） |

成员分布：嘉然 112 · 贝拉 90 · 乃琳 70 · 团体与吉祥物 43 · 心宜 6 · 思诺 6

---

## 页面功能

| 页面 | 说明 |
| --- | --- |
| `index.html` | 首页。团体概览、成员卡片、分类入口、精选预览 |
| `gallery.html` | 素材库。按成员 / 类型 / 系列多维筛选，关键词搜索，四种排序，三档视图密度，收藏夹，灯箱预览与下载 |
| `audio.html` | 曲目索引（团曲 / 个人曲 / 专辑曲 / 联动曲），以及可导入本地文件的「我的音频库」 |
| `import.html` | 浏览器导入后台。拖拽或粘贴文件，自动识别成员与尺寸，批量编辑标签，写入本地素材库，导出索引 |
| `about.html` | 收录范围说明、数据来源、相关资源导航（官方账号 / 百科 / 开源仓库）、版权声明、扩展方法 |

---

## 自己往里加素材

三种方式，由易到难：

1. **导入后台**（最简单）
   打开 `import.html` → 拖入文件 → 核对成员/类型 → 「保存到本地素材库」。
   数据存在浏览器 IndexedDB，刷新后仍在，并会立刻出现在素材库页面。

2. **导出固化**（可分发）
   在导入后台点「导出 data.js」，覆盖 `assets/js/data.js`；
   把素材文件放进 `assets/images/` 或 `assets/stickers/` 对应目录，并修正 JSON 里的 `file` 路径。

3. **直接改数据**
   编辑 `data/assets.json` 或 `assets/js/data.js`，按同样字段结构追加条目。

### 素材条目字段

```json
{
  "id": "st-bella-bella_ok",
  "type": "sticker",
  "member": "bella",
  "set": "贝拉 · B站装扮表情（一期）",
  "name": "贝拉 · OK",
  "file": "assets/stickers/bella/bella_ok.png",
  "ext": "png",
  "bytes": 5120,
  "w": 100,
  "h": 100,
  "tags": ["表情包", "贝拉"],
  "source": "stormyyd/asoul-sticker（GitHub 公开仓库 · UNLICENSE）",
  "sourceUrl": "https://github.com/stormyyd/asoul-sticker"
}
```

`member` 取值：`bella` `diana` `eileen` `fiona` `sinuo` `group`

---

## 目录结构

```
asoul-materials/
├─ index.html
├─ gallery.html
├─ audio.html
├─ import.html
├─ about.html
├─ assets/
│  ├─ css/site.css
│  ├─ js/data.js        站点数据（生成物，可被导入后台覆盖）
│  ├─ js/core.js        核心逻辑（数据 / 存储 / 灯箱 / 卡片）
│  ├─ js/gallery.js
│  ├─ js/audio.js
│  ├─ js/import.js
│  ├─ images/           122 张图片素材（含 86 张服设三视图）
│  └─ stickers/         205 个表情包
├─ data/
│  ├─ members.json
│  ├─ assets.json
│  └─ music.json
├─ start.sh / start.bat
└─ README.md
```

---

## 版权声明

- 本站为 **非官方粉丝项目**，与 A-SOUL 制作委员会、乐华娱乐、枝江娱乐无任何隶属或合作关系。
- 站内所有角色形象与美术素材的版权，归 A-SOUL 制作委员会及各原始创作者所有。
- 素材仅供 **个人学习、交流与二创参考**，请勿用于商业用途。
- 本站 **不存储、不分发** 任何音乐音源文件，音频专区仅提供曲目索引与官方平台跳转。
- 支持官方渠道：<https://space.bilibili.com/703007996>
