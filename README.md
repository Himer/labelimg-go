# LabelImg Wails

基于 Wails v2 的图片标注桌面工具，仅支持 YOLO 格式。Go 后端复用 `labelimg_go/libs` 核心库，前端使用原生 HTML5 Canvas。

## 项目结构

```
labelimg_wails/
├── main.go              # Wails 入口，窗口配置
├── app.go               # Go 后端绑定（图片加载、标注读写、目录扫描）
├── wails.json            # Wails 项目配置
├── go.mod               # Go 模块，依赖 wails/v2 + 本地 labelimg_go
├── build/bin/            # 编译产物
└── frontend/
    ├── index.html        # 主页面布局
    ├── package.json
    └── src/
        ├── canvas.js     # Canvas 绘制引擎（bbox 绘制/选择/移动/缩放）
        ├── main.js       # 应用逻辑，连接前端 UI 与 Go 后端
        └── style.css     # 暗色主题样式
```

## 依赖

- Go 1.21+
- Node.js
- Wails CLI v2：`go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Windows 11 自带 WebView2

> 若遇到 `git.sr.ht` 模块校验失败，设置环境变量：
> `GONOSUMDB="git.sr.ht/*" GONOSUMCHECK="git.sr.ht/*"`

## 开发 & 构建

```bash
# 开发模式（热重载）
wails dev

# 构建可执行文件
wails build
# 产物：build/bin/labelimg-wails.exe
```

## 功能

- 打开图片目录，自然排序浏览
- 鼠标拖拽创建矩形标注框，输入标签
- 选择/移动/角点缩放已有标注框
- 保存为 YOLO 格式（`.txt` + `classes.txt`）
- 自动加载已有 YOLO 标注
- 切换图片时自动保存
- Undo/Redo（Ctrl+Z / Ctrl+Y，最多 50 步）
- 预定义标签快速标注（勾选 Use Default Label，画框时跳过标签对话框）
- 加载预定义 classes.txt（打开目录时自动加载，也可手动选择文件）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| W | 创建模式 |
| E | 编辑模式 |
| A | 上一张图片 |
| D | 下一张图片 |
| Ctrl+S | 保存标注 |
| Ctrl+Z | 撤销 |
| Ctrl+Y / Ctrl+Shift+Z | 重做 |
| Del / Backspace | 删除选中框 |
| + / - | 缩放 |
| F | 适应窗口 |
| 滚轮 | 缩放 |
| 中键拖拽 | 平移画布 |

## 后端 API（app.go 绑定方法）

| 方法 | 说明 |
|------|------|
| `SelectDirectory()` | 原生目录选择对话框 |
| `OpenDirectory(dir)` | 扫描目录返回图片列表 |
| `LoadImage(index)` | 加载图片（base64）+ 已有 YOLO 标注 |
| `NextImage()` / `PrevImage()` | 前后导航 |
| `SaveAnnotations(data)` | 保存 YOLO 标注 |
| `GetClassList()` | 获取已知类别列表 |
| `LoadClassFile()` | 打开文件对话框选择 classes.txt 并加载 |

## 待优化

- [x] 支持加载预定义 classes.txt
- [ ] 标注框复制/粘贴
- [x] Undo/Redo
- [x] 预定义标签快速标注
- [ ] 图片亮度/对比度调节
- [ ] 标注统计面板
- [ ] 批量自动标注（接入模型推理）
- [ ] 跨平台构建（macOS / Linux）
- [ ] 自定义快捷键配置
