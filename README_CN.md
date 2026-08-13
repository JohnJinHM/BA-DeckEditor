# [BA-DeckEditor](https://johnjinhm.github.io/BA-DeckEditor/)

在浏览器里编辑 **《Broken Arrow》战斗群（battlegroup）**：选择国家与两个专精，
在游戏自身的点数与可用数量限制下填满各类别槽位，并**导入 / 导出真正的 `.dek` 文件**。

单位卡片由 **[BA-ReCard](https://github.com/JohnJinHM/BA-ReCard)** 的卡片引擎渲染；
游戏数据来自 **[BA-Units](https://github.com/JohnJinHM/BA-Units)**。

使用 **React + TypeScript + Vite** 构建，部署在 GitHub Pages。
全部逻辑在本地运行——你的编组不会离开浏览器。

> 🇬🇧 [English](README.md)

## 功能

- **编组设置**——国家 + 两个专精，并实时预览该组合带来的槽位数与点数预算。
- **七个类别标签**，每个都有消耗条：预算线、其后 10% 的超支余量，以及 10000 点的总上限。
- **槽位编辑**——单位池只列出两个专精能编入的单位并显示每张卡的可用数量。
  **点击一次加入一个**：首次点击将单位放入空槽位，之后每次点击让该卡数量 +1，
  直至达到可用上限。
- **运输载具**——列出游戏为该单位在该专精下提供的载具，可单独设置数量，
  并拥有自己的卡片与自定义面板，配置方式与步兵完全一致。
- **单位卡片**支持默认 / 详细两种模式（以及旧版卡片样式），随选项改变实时重算。
- 每张卡片下方都有与游戏信息卡同款样式的 **自定义选项（Customization options）**
  面板——每个改装槽一行，显示所选配置与点数增量，展开后可看到各选项及其配置图。
- **随变体更新的图标**——重命名单位、替换 `Units` 行（Scout Snipers → M107 变体）
  或覆盖标签图的选项，都会同步更新槽位与卡片。
- **`.dek` 导入 / 导出**，与游戏字节级兼容（也可导出解密后的 JSON 便于查看）。

## 目录结构

```
src/
  data/        表类型、加载与索引（GameDb）、单位→卡片解析      [来自 BA-ReCard]
  card/        CardModel 与游戏内卡片渲染器                    [来自 BA-ReCard]
  deck/        model.ts   类别、槽位、Deck 类型
               rules.ts   槽位、预算、可用数量、计价、校验
               label.ts   随变体解析的单位名称与标签图
               dek.ts     .dek 编解码（WebCrypto AES-256-CBC）
  state/       zustand store（编组、选中项、已渲染卡片）
  ui/          设置对话框、类别栏、槽位条、单位池、
               卡片面板、自定义选项、工具栏
public/
  data/        游戏数据库导出（24 张表 + 本地化，来自 BA-Units）
  assets/      提取的游戏素材——由 scripts/extract-assets.mjs 生成
docs/
  DECK_FORMAT.md   .dek 容器、其 JSON 结构，以及解密过程
  DECK_RULES.md    槽位 / 点数 / 可用数量规则及其验证方式
scripts/
  extract-assets.mjs   AssetRipper 导出 → public/assets
  check-assets.mjs     校验表中引用的每个贴图名都能找到文件
  verify-dek.mjs       用示例编组验证编解码与规则
  e2e-roundtrip.mjs    在构建产物上跑：导入 → 导出 → 比对，以及从零建组
  dev-screenshot.mjs   无头浏览器截图
```

## 开发

```sh
npm install
npm run dev        # http://localhost:5173/BA-DeckEditor/
npm run build      # 类型检查 + 生产构建到 dist/
npm run verify     # 用 /samples 验证规则与 .dek 编解码，并检查素材覆盖率
npm run deploy     # 构建并发布 dist/ 到 gh-pages 分支
```

`npm run e2e` 会用无头浏览器驱动构建产物（需先运行
`npx vite preview --port 4173`），验证两个示例编组能原样往返，
再从零搭建一个编组并核对计价。

## 游戏更新后刷新数据

```sh
# 1. 用 AssetRipper 重新导出游戏。
# 2. 在 BA-Units 目录下解密数据库：
python tools/extract_database.py     --asset <export>/Assets/Resources/DataBaseCompiled.asset \
                                     --out   <本仓库>/public/data --indent 0
python tools/extract_localization.py --text-dir <export>/Assets/TextAsset \
                                     --out   <本仓库>/public/data/localization --all
python tools/extract_manifest.py     --root  <export> --out <本仓库>/public/data
#（保留 eng.json 与 chi.json，其余语言可删除）

# 3. 重新提取素材并确认没有失效引用：
npm run extract-assets -- <export>
npm run verify
```

若 `extract_database.py` 报 *"blob does not start with marker"*，说明官方更换了
加密密钥——用 `BA-Units/tools/recover_key.py` 找回，并同步更新
[`src/deck/dek.ts`](src/deck/dek.ts) 中的 `KEY_TEXT`，因为 `.dek` 使用同一把密钥。

## 工作原理

1. `loadGameDb()` 拉取 24 张表与本地化文件并建立主键 / 外键索引——
   其中包含卡片工具用不到的三张编组表
   （`Specializations`、`SpecializationAvailabilities`、`TransportAvailabilities`）。
2. 选定两个专精后编组即被确定：`deck/rules.ts` 据此推导每个类别的槽位数
   （`min(7, s1 + s2)`）、点数预算（`s1 + s2`，七项之和恒为该国的 10000）、
   每类别 10% 的超支余量、单位池、每卡可用数量与运输载具列表。
3. 槽位为其单位的**每一个**改装项都保存明确的选项 id，与 `.dek` 完全一致，
   因此计价就是 `Units.Cost + Σ Options.Cost` 乘以数量，运输载具同理。
4. 选中槽位会重新执行 BA-ReCard 的 `resolveCard(db, unitId, selection)`，
   并用其 `UnitCard` 渲染，因此卡片与游戏内一致。
5. 导入 / 导出用 WebCrypto 解密并重新加密 `fhk3s0g3` + IV + AES-256-CBC 信封，
   并复现游戏的缩进、CRLF 换行与字段顺序。

## 文档

- [docs/DECK_FORMAT.md](docs/DECK_FORMAT.md)——`.dek` 容器与 JSON 结构逐字段说明。
- [docs/DECK_RULES.md](docs/DECK_RULES.md)——全部编组规则、数据来源列及验证方式。
- [BA-ReCard/docs/DATA_SCHEMA.md](https://github.com/JohnJinHM/BA-ReCard/blob/main/docs/DATA_SCHEMA.md)
  ——24 张表及其关联方式。
- [BA-Units/docs/EXTRACTION.md](https://github.com/JohnJinHM/BA-Units/blob/main/docs/EXTRACTION.md)
  ——数据库（也即 `.dek` 密钥）的解密过程。

## 进度

- [x] 国家 + 双专精设置与预算预览
- [x] 类别槽位、点数预算、10% 余量、10000 总上限
- [x] 带专精可用数量限制的单位池
- [x] 运输载具选择与独立的载具数量
- [x] 单位与运输载具卡片（默认、详细、旧版）
- [x] 两张卡片各自的自定义选项面板，采用信息卡样式
- [x] 随变体更新的名称与标签图
- [x] `.dek` 导入导出，已用真实游戏文件验证
- [x] 编组校验（点数、可用数量、运输载具、完整度）
- [ ] 单位涂装（`unitSkinId`/`tranSkinId` 会被保留但暂不可编辑——
      `DataBaseCompiled.asset` 中没有涂装表）
- [ ] 通过 URL 分享编组 / 导出编组图片
