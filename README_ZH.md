# DSH-better-classifier

中文 · [English](README.md)

用嵌套虚拟文件夹、彩色标签和树形搜索整理 DSH 左侧的项目与会话。

![使用合成测试数据的侧栏示例](detail/sidebar.jpg)

**0.2.1** 支持未经修改的 **DSH 0.2.2-rc.2**，无需源码补丁。要求 Node.js **24.9.0 或更新版本**，已在 Windows x64 验证；暂不宣称兼容其他 DSH 版本及平台。详见[验证记录](docs/validation.md)。

## 功能

- 外层文件夹整理项目，项目内文件夹整理会话，两类文件夹均可嵌套。分类移动不会改变真实文件位置或工作目录。
- 在列表下方空白、空列表或搜索无结果区域右键新建根文件夹；聚焦空白区域后也可按菜单键或 `Shift+F10`。项目和文件夹行菜单可在内部新建。
- 单项拖拽、移动菜单、重命名和排序。删除文件夹时，直接子项移到上一层。
- 标签编辑同页完成：已添加气泡在上，可添加气泡在下；点击气泡修改名称或颜色，× 移除当前关联。保存统一提交，取消放弃草稿。
- 标签只属于明确打标的对象，不向下继承。拉宽侧栏会显示更多标签，仅溢出时显示 `+N`，标签与时间／操作区保留间距。
- 统一搜索名称、直接标签、会话 ID 和正文。命中容器默认折叠，可逐层展开；只命中会话时展开祖先路径。最多显示 20 个结果入口。
- 保留原生项目／会话菜单、置顶、归档、运行状态、排序、目录选择器和快捷键。停用插件恢复原生列表。

## 安装

先确认 `dsh --version` 为 `0.2.2-rc.2`，再从 npm 安装：

```powershell
dsh plugin --profile web add dsh-better-classifier@0.2.1
dsh web --no-open
```

已运行的 DSH 需要重启，浏览器需要刷新。按实际情况替换 profile 名称 `web`。安装包包含构建产物，安装时不执行构建或修改 DSH 文件。

也可从 [GitHub Releases](https://github.com/MakerFlyFly/DSH-better-classifier/releases/tag/v0.2.1) 下载 `dsh-better-classifier-0.2.1.tgz`，用配套校验和文件核对 SHA-256，再将上述安装命令中的包名替换为本地压缩包路径。

Git 仓库提供源码，本地安装前需要执行下方开发构建。npm 发布与社区目录收录进展见[分发状态](docs/distribution.md)。

## 升级与卸载

沿用 `better_classifier` 存储域及第 1 版数据格式。分类、标签、顺序和修订号无需迁移，浏览器展开偏好保持原键；已删除的独立筛选及标签隐藏偏好继续忽略。

0.1.x 依赖自定义 DSH 补丁。升级到 0.2.x 时，备份数据后，在原版 0.2.2-rc.2 中使用相同的数据目录/profile 安装新版。不要在包含其他改动的源码工作区盲目反向应用旧补丁。本地旧试用环境可与新审查环境并存。

可在 DSH 插件页停用，或执行卸载：

```powershell
dsh plugin --profile web remove dsh-better-classifier
```

卸载保留分类数据，默认位置为 DSH 数据目录中的 `storages/better_classifier.json`。重新安装可继续使用。展开状态按浏览器保存，不提供独立实例间云同步。

## 开发与验证

构建依赖从 npm 安装，Loader 回归还会使用系统 `tar` 工具；不需要本机 DSH 源码、目录链接或固定机器路径。

```powershell
corepack pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm typecheck
pnpm package
pnpm test
pnpm dev --fixture
```

`pnpm verify` 按构建 → 类型检查 → 打包 → 测试的顺序完成验证。类型检查需要构建生成的 Remote 声明；Loader 测试需要当前版本安装包。Host 和 Client 的测试文件分别接受类型检查。

审查环境使用独立的 `.dev/review-0.2.1/home`，默认端口为 3085；使用 `--port=3087` 可与旧试用页并存。启动输出提供本地认证地址。`--fixture` 创建合成测试项目和会话，验证存储与搜索，不调用模型。夹具具有独立的私有包边界，避免 DSH 从夹具发现源码仓库的 Client。准备数据后，停止该进程，再用 `pnpm dev --installed --port=3087`（不加 `--fixture`）进行浏览器启停验收。自动化测试使用各自的数据目录和正式发布的原版 DSH CLI。安装包与源码 ZIP 输出到 `dist/`；源码打包遵守根目录及嵌套忽略规则，解压后没有 `.git` 也可构建。

适配层通过公开 `sidebar.workspaces` 注册表接入，复用原生操作回调与查看状态。目录选择器、行操作和装饰贡献映射到插件自己的子插槽，并跟随原注册释放。原生接口仍在演进，因此兼容版本精确固定。正文搜索经插件自己的 `betterClassifier.searchContent` 接口执行，权限与候选范围在截取前检查。Remote 元数据在临时构建目录生成，不改动已安装的 DSH 或生成器文件。

## 数据与失败处理

分类元数据独立于会话日志，不进入模型上下文。保存使用修订号并原子提交；并发冲突拒绝覆盖，重新打开编辑器后重试。写入失败保留草稿。正文搜索失败保留名称结果并提供重试。暂未加载的项目或会话不会被自动清理。

遇到不支持的侧栏扩展时，插件恢复原有侧栏，并隐藏新的分类操作入口。已打开的草稿继续保留，适配恢复前禁用保存；移除冲突的嵌套扩展后可自动恢复分类视图。

### 正文搜索索引

标准插件配置会在首次正文搜索时启用共享的 SQLite 索引服务，默认保存到 `DSH_HOME` 下的 `storages/better_classifier_search.sqlite`。索引包含可检索的消息正文，不只是摘要或哈希；可能索引全部持久化会话。候选范围和权限限制的是查询结果，不是建库范围，磁盘占用会随历史内容增加。

配置优先级依次为：插件 bundle → profile 补丁 → `DSH_HOME` 补丁 → 命令行覆盖。后面的用户配置优先。若希望索引仅保存在内存，可在所用 profile 的 `cordis.patch.yml` 或现有用户覆盖文件加入：

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search
```

`openAt: never` 可关闭正文索引，名称和标签搜索仍可使用。停用或卸载插件会移除其配置层，但不会删除派生索引文件；删除会话也不代表其正文立即从 SQLite 中物理清除。需要清空默认索引时，先关闭所有使用该 `DSH_HOME` 的 DSH 进程，再手动删除 `storages` 中的 `better_classifier_search.sqlite` 及对应 `-wal`、`-shm` 文件，后续搜索可重新建立。不要删除分类数据 `better_classifier.json`、会话日志或其他配置共用的自定义数据库路径。

公开文档素材只使用合成测试数据；本地 profile、会话文件、凭据、缓存、日志和开发记录不进入交付压缩包。

## 许可证

MIT。界面适配代码基于 MIT 许可的 DeepSeek Harness，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
